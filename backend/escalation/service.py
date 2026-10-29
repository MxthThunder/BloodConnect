"""
AdaptiveEscalationService - the persistent side of the escalation engine.

It loads state, asks the pure rules in `decision.py` what to do, and applies the result
(batches, attempts, events). The simulator and experiment module call this same service;
the only difference for a simulated case is that no real notification is ever created.

Concurrency: every mutation runs inside a transaction that locks the case row
(`select_for_update`; effective on PostgreSQL, and SQLite serialises writers with
`transaction_mode=IMMEDIATE`). Writes are idempotent - repeating a response or an evaluation
cannot create duplicate batches/attempts - and database unique constraints are the last line
of defence against duplicate outreach.
"""
import logging
from dataclasses import dataclass, field
from datetime import timedelta

from django.db import IntegrityError, transaction
from django.utils import timezone

from . import decision as rules
from .candidates import rank_candidates
from .constants import (
    AttemptStatus, BatchTrigger, CaseStatus, EventType, Fulfilment, PENDING_ATTEMPT_STATUSES,
    RESPONDABLE_ATTEMPT_STATUSES, Strategy, TERMINAL_CASE_STATUSES,
)
from .models import (
    EmergencyCase, EscalationEvent, EscalationPolicy, OutreachAttempt, OutreachBatch,
)

logger = logging.getLogger(__name__)


class EscalationError(Exception):
    """Raised for invalid requests/operations; carries a user-presentable message."""

    def __init__(self, message, code='invalid'):
        super().__init__(message)
        self.message = message
        self.code = code


@dataclass
class EvaluationResult:
    case: EmergencyCase
    action: str
    reason: str
    changed: bool = False
    batch: OutreachBatch | None = None
    events: list = field(default_factory=list)


@dataclass
class ResponseResult:
    attempt: OutreachAttempt
    changed: bool
    message: str


def validate_request_for_escalation(req, now=None):
    """Return a list of problems that stop a BloodRequest entering coordination."""
    from accounts.constants import BloodGroup
    now = now or timezone.now()
    problems = []
    if req.blood_group not in BloodGroup.values:
        problems.append('Blood group is not a recognised value.')
    if not req.units_requested or req.units_requested < 1 or req.units_requested > 50:
        problems.append('Units requested must be between 1 and 50.')
    if not (req.hospital_name or '').strip():
        problems.append('Hospital or collection location is required.')
    if not (req.locality or '').strip() and (req.hospital_lat is None or req.hospital_lng is None):
        problems.append('A locality or hospital coordinates are required to define the search area.')
    if req.urgency not in ('CRITICAL', 'URGENT', 'STANDARD'):
        problems.append('Urgency is not a recognised value.')
    if req.required_by is None:
        problems.append('Required time is missing.')
    return problems


class AdaptiveEscalationService:
    def __init__(self, policy=None):
        self._policy = policy

    # ------------------------------------------------------------------ helpers
    def policy_for(self, case):
        if self._policy is not None:
            return self._policy
        return case.get_policy()

    def policy_for_new(self):
        return self._policy or EscalationPolicy.active_policy()

    @staticmethod
    def _now(now):
        return now or timezone.now()

    @staticmethod
    def _lock(case_id):
        return EmergencyCase.objects.select_for_update().select_related('blood_request', 'simulation_run').get(pk=case_id)

    def _event(self, case, event_type, now, reason='', *, previous_stage=None, new_stage=None,
               details=None, actor=None, batch=None, attempt=None):
        return EscalationEvent.objects.create(
            case=case, event_type=event_type, event_time=now, decision_reason=reason,
            previous_stage=previous_stage, new_stage=new_stage, details=details or {},
            actor=actor if getattr(actor, 'is_authenticated', False) else None,
            batch=batch, attempt=attempt, simulation_flag=case.is_simulation,
        )

    # ------------------------------------------------------------------ lifecycle
    @transaction.atomic
    def start_case_for_request(self, blood_request, actor=None, now=None):
        """Start (or return the existing) coordination for an approved real request.

        Idempotent: calling twice never creates a second case or duplicate outreach.
        Existing DonorMatch alerts (pre-engine broadcast) are imported as already-contacted.
        """
        now = self._now(now)
        existing = EmergencyCase.objects.filter(blood_request=blood_request).first()
        if existing:
            return existing
        problems = validate_request_for_escalation(blood_request, now)
        if problems:
            raise EscalationError(' '.join(problems), 'invalid_request')
        policy = self._policy or EscalationPolicy.active_policy()
        expires_at = blood_request.required_by + timedelta(minutes=policy.expiry_grace_minutes)
        if expires_at <= now:
            raise EscalationError('The required time for this request has already passed.', 'expired_request')

        target = blood_request.units_requested * policy.volunteers_per_unit
        case = EmergencyCase.objects.create(
            blood_request=blood_request, is_simulation=False, strategy=Strategy.ADAPTIVE,
            reference=blood_request.reference_number, blood_group=blood_request.blood_group,
            units_requested=blood_request.units_requested, hospital_name=blood_request.hospital_name,
            city=blood_request.city or 'Chennai', locality=blood_request.locality,
            hospital_lat=blood_request.hospital_lat, hospital_lng=blood_request.hospital_lng,
            urgency=blood_request.urgency, required_by=blood_request.required_by, expires_at=expires_at,
            target_volunteers=target, remaining_coordination_need=target, started_at=now,
        )
        self._event(case, EventType.REQUEST_CREATED, blood_request.created_at,
                    f'Request {case.reference} created for {case.units_requested} unit(s) of {case.blood_group} '
                    f'at {case.hospital_name} ({case.urgency}).', actor=None)
        self._event(case, EventType.REQUEST_VALIDATED, now,
                    'Request passed validation: blood group, units, location, urgency and required time are present.')
        self._event(case, EventType.CASE_STARTED, now,
                    f'Coordination target: {target} volunteer(s) ({case.units_requested} unit(s) x '
                    f'{policy.volunteers_per_unit} volunteers per unit). Volunteers are not blood units.',
                    actor=actor, details={'target_volunteers': target})
        self._import_legacy_matches(case, now)
        self.evaluate(case.pk, now=now, actor=actor)
        case.refresh_from_db()
        return case

    def _import_legacy_matches(self, case, now):
        """Alerts that were broadcast before the engine existed count as already contacted."""
        from matching.models import AlertStatus, DonorMatch
        matches = list(DonorMatch.objects.filter(blood_request=case.blood_request).select_related('donor'))
        if not matches:
            return
        status_map = {
            AlertStatus.QUEUED: AttemptStatus.ALERTED, AlertStatus.DISPATCHED: AttemptStatus.ALERTED,
            AlertStatus.VIEWED: AttemptStatus.VIEWED, AlertStatus.ACCEPTED: AttemptStatus.ACCEPTED,
            AlertStatus.DECLINED: AttemptStatus.DECLINED,
        }
        batch = OutreachBatch.objects.create(
            case=case, sequence=1, stage_index=0, trigger=BatchTrigger.LEGACY_IMPORT, planned_size=len(matches),
            decision_reason='Alerts that existed before the escalation engine was activated were imported and '
                            'are not repeated.', created_at=matches[0].created_at,
        )
        for rank, m in enumerate(matches, 1):
            OutreachAttempt.objects.create(
                case=case, batch=batch, donor=m.donor, donor_match=m, stage_index=0,
                status=status_map.get(m.alert_status, AttemptStatus.ALERTED), attempted_at=m.created_at,
                responded_at=m.responded_at, response_source='donor_app' if m.responded_at else '',
                response_message=(m.donor_response_message or '')[:300], rank_position=rank,
                rank_score=m.compatibility_score, distance_km=m.distance_km,
                explanation='Imported from the alert that was sent before the escalation engine was activated.',
            )
        case.batches_created = 1
        case.current_stage_index = 0
        case.last_batch_at = batch.created_at
        case.save(update_fields=['batches_created', 'current_stage_index', 'last_batch_at'])
        self._event(case, EventType.OUTREACH_INITIATED, now,
                    f'{len(matches)} existing alert(s) imported from before the engine was activated; '
                    'these donors will not be contacted again.', batch=batch, new_stage=0)

    # ------------------------------------------------------------------ snapshot
    def _counts(self, attempts):
        c = dict(accepted=0, declined=0, no_response=0, pending=0, withdrawn=0)
        for a in attempts:
            if a.status == AttemptStatus.ACCEPTED and a.fulfilment != Fulfilment.NOT_DONATED:
                c['accepted'] += 1
            elif a.status == AttemptStatus.DECLINED:
                c['declined'] += 1
            elif a.status == AttemptStatus.NO_RESPONSE:
                c['no_response'] += 1
            elif a.status in PENDING_ATTEMPT_STATUSES:
                c['pending'] += 1
            elif a.status == AttemptStatus.WITHDRAWN:
                c['withdrawn'] += 1
        return c

    @staticmethod
    def accept_rate(counts, policy):
        resolved = counts['accepted'] + counts['declined'] + counts['no_response']
        prior = policy.assumed_response_rate
        return (counts['accepted'] + prior * policy.prior_weight) / (resolved + policy.prior_weight)

    def build_snapshot(self, case, policy, now, attempts, rank, manual=False):
        counts = self._counts(attempts)
        since_last = None if case.last_batch_at is None else (now - case.last_batch_at).total_seconds() / 60
        return rules.Snapshot(
            strategy=case.strategy, urgency=case.urgency, target=case.target_volunteers,
            accepted=counts['accepted'], declined=counts['declined'], no_response=counts['no_response'],
            pending=counts['pending'], contacted=len(attempts), batches=case.batches_created,
            current_stage=case.current_stage_index,
            minutes_since_start=(now - case.started_at).total_seconds() / 60,
            minutes_since_last_batch=since_last, accept_rate=self.accept_rate(counts, policy),
            wait_minutes=policy.wait_minutes(case.urgency), min_gap_minutes=policy.min_gap(case.urgency),
            max_batches=policy.max_batches, fixed_interval_minutes=policy.fixed_interval_minutes,
            stage_caps=tuple(s.max_batch_size for s in policy.stages),
            available=tuple(rank.available_by_stage), auto_escalate=policy.auto_escalate, manual=manual,
        )

    # ------------------------------------------------------------------ evaluation
    @transaction.atomic
    def evaluate(self, case_id, now=None, manual=False, actor=None):
        """Run one decision cycle. Safe to call repeatedly."""
        now = self._now(now)
        case = self._lock(case_id)
        policy = self.policy_for(case)
        result = EvaluationResult(case=case, action=rules.WAIT, reason='')

        if case.is_terminal:
            result.reason = f'Request is {case.get_status_display().lower()}; no outreach is generated.'
            return result

        if self._sync_external_state(case, now):
            result.action, result.changed = 'CLOSED', True
            result.reason = case.closure_reason
            return result

        if now >= case.expires_at:
            self._close(case, CaseStatus.EXPIRED, now,
                        f'Request passed its required time ({case.required_by:%d/%m/%Y %H:%M}) plus the '
                        f'{policy.expiry_grace_minutes}-minute grace period without being resolved.',
                        EventType.REQUEST_EXPIRED)
            result.action, result.changed, result.reason = 'CLOSED', True, case.closure_reason
            return result

        attempts = list(case.attempts.select_related('batch').all())
        self._lapse_unanswered(case, policy, now, attempts)
        counts = self._counts(attempts)
        case.remaining_coordination_need = max(0, case.target_volunteers - counts['accepted'])

        rank = rank_candidates(case, policy, now, attempts)
        snap = self.build_snapshot(case, policy, now, attempts, rank, manual=manual)
        dec = rules.decide(snap)
        result.action, result.reason = dec.action, dec.reason

        previous_status = case.status
        if dec.action == rules.SECURED:
            case.status = CaseStatus.VOLUNTEERS_SECURED
            if previous_status != CaseStatus.VOLUNTEERS_SECURED:
                self._event(case, EventType.VOLUNTEERS_SECURED, now, dec.reason, details=dec.details)
                result.changed = True
        elif dec.action == rules.SEND_BATCH:
            result.batch = self._create_batch(case, policy, dec, rank, now, actor, manual)
            result.changed = True
            case.status = CaseStatus.COLLECTING_RESPONSES
            if previous_status == CaseStatus.VOLUNTEERS_SECURED:
                self._event(case, EventType.NEED_REOPENED, now, 'Accepted volunteers fell below the target; '
                            'outreach resumed.', details=dec.details)
        elif dec.action == rules.ADVANCE_EMPTY:
            self._event(case, EventType.SEARCH_EXPANDED, now, dec.reason, previous_stage=case.current_stage_index,
                        new_stage=dec.stage_index, details=dec.details)
            case.current_stage_index = dec.stage_index
            case.status = CaseStatus.COLLECTING_RESPONSES
            result.changed = True
        elif dec.action == rules.AWAIT_APPROVAL:
            case.status = CaseStatus.AWAITING_ESCALATION
            if previous_status != CaseStatus.AWAITING_ESCALATION:
                self._event(case, EventType.AWAITING_ESCALATION, now, dec.reason, details=dec.details)
                result.changed = True
        elif dec.action == rules.ESCALATE_ADMIN:
            case.status = CaseStatus.NEEDS_ADMIN_INTERVENTION
            if previous_status != CaseStatus.NEEDS_ADMIN_INTERVENTION:
                self._event(case, EventType.ADMIN_INTERVENTION_REQUIRED, now, dec.reason, details=dec.details)
                self._notify_admins(case, dec.reason)
                result.changed = True
        else:  # WAIT
            if case.status in (CaseStatus.OPEN, CaseStatus.VOLUNTEERS_SECURED, CaseStatus.AWAITING_ESCALATION,
                               CaseStatus.NEEDS_ADMIN_INTERVENTION):
                case.status = CaseStatus.COLLECTING_RESPONSES if case.batches_created else CaseStatus.OPEN
            prev = (case.last_decision or {}).get('reason_code')
            if prev != dec.reason_code:
                self._event(case, EventType.ENGINE_HOLD, now, dec.reason, details=dec.details)
                result.changed = True

        case.last_decision = {
            'action': dec.action, 'reason_code': dec.reason_code, 'reason': dec.reason,
            'at': now.isoformat(), 'details': dec.details,
        }
        case.last_evaluated_at = now
        case.save()
        result.case = case
        return result

    def _sync_external_state(self, case, now):
        """For real cases: the BloodRequest is the source of truth for cancellation/closure."""
        req = case.blood_request
        if req is None:
            return False
        from blood_requests.models import RequestStatus, VerificationStatus
        if req.request_status == RequestStatus.CANCELLED:
            self._close(case, CaseStatus.CANCELLED, now, 'The blood request was cancelled.', EventType.REQUEST_CANCELLED)
            return True
        if req.request_status == RequestStatus.FULFILLED:
            self._close(case, CaseStatus.RESOLVED, now, 'The blood request was marked fulfilled.', EventType.REQUEST_RESOLVED)
            return True
        if req.request_status == RequestStatus.CLOSED or req.verification_status == VerificationStatus.REJECTED:
            self._close(case, CaseStatus.CANCELLED, now, 'The blood request was closed or rejected.', EventType.REQUEST_CANCELLED)
            return True
        return False

    def _lapse_unanswered(self, case, policy, now, attempts):
        """Alerts past their window become NO_RESPONSE - 'unknown', never 'unavailable'."""
        wait = timedelta(minutes=policy.wait_minutes(case.urgency))
        by_batch = {}
        for a in attempts:
            if a.status in PENDING_ATTEMPT_STATUSES and a.attempted_at + wait <= now:
                a.status = AttemptStatus.NO_RESPONSE
                a.save(update_fields=['status', 'updated_at'])
                by_batch.setdefault(a.batch, []).append(a)
        for batch, rows in by_batch.items():
            self._event(
                case, EventType.RESPONSE_WINDOW_ELAPSED, now,
                f'{len(rows)} alert(s) in batch {batch.sequence} received no response within '
                f'{policy.wait_minutes(case.urgency)} minutes. Their availability is unknown, not declined.',
                batch=batch, details={'count': len(rows)},
            )

    # ------------------------------------------------------------------ batches
    def _create_batch(self, case, policy, dec, rank, now, actor, manual):
        eligible = rank.eligible
        chosen, taken = [], set()
        if dec.allow_fill:
            for stage in range(dec.stage_index, len(policy.stages)):
                room = dec.batch_size - len(chosen)
                if room <= 0:
                    break
                for a in eligible:
                    if a.first_stage <= stage and id(a) not in taken and room > 0:
                        chosen.append(a)
                        taken.add(id(a))
                        room -= 1
        else:
            chosen = [a for a in eligible if a.first_stage <= dec.stage_index][:dec.batch_size]
        if not chosen:
            raise EscalationError('No candidates available for the requested batch.', 'no_candidates')
        stage_used = max(dec.stage_index, max(a.first_stage for a in chosen))

        previous_stage = case.current_stage_index
        trigger = dec.trigger
        if trigger == BatchTrigger.TOP_UP and stage_used > max(previous_stage, 0):
            trigger = BatchTrigger.EXPANSION
        if manual and trigger in (BatchTrigger.TOP_UP, BatchTrigger.EXPANSION):
            trigger = BatchTrigger.MANUAL

        seq = case.batches_created + 1
        batch = OutreachBatch.objects.create(
            case=case, sequence=seq, stage_index=stage_used, trigger=trigger, planned_size=len(chosen),
            decision_reason=dec.reason, created_at=now,
        )
        stage_name = policy.stages[stage_used].name

        expanded = stage_used > previous_stage and previous_stage >= 0
        if expanded:
            self._event(case, EventType.ESCALATION_TRIGGERED, now, dec.reason, previous_stage=previous_stage,
                        new_stage=stage_used, details=dec.details, actor=actor, batch=batch)
            self._event(case, EventType.SEARCH_EXPANDED, now,
                        f'Search area expanded from {policy.stages[previous_stage].name} to {stage_name}.',
                        previous_stage=previous_stage, new_stage=stage_used, actor=actor, batch=batch)
        if not case.events.filter(event_type=EventType.CANDIDATES_RANKED).exists():
            self._event(case, EventType.CANDIDATES_RANKED, now,
                        f'{len(rank.eligible)} eligible candidate(s) ranked across {len(policy.stages)} stage(s); '
                        f'search origin: {rank.origin_basis}. Excluded: '
                        f"{', '.join(f'{v} {k.lower()}' for k, v in rank.excluded_counts.items()) or 'none'}.",
                        details={'available_by_stage': rank.available_by_stage, 'excluded': rank.excluded_counts})

        self._event(case, EventType.BATCH_CREATED, now,
                    f'Batch {seq} ({batch.get_trigger_display().lower()}): {len(chosen)} candidate(s) from {stage_name}. '
                    f'{dec.reason}', previous_stage=previous_stage, new_stage=stage_used, batch=batch,
                    details=dec.details, actor=actor)

        issued = 0
        for position, a in enumerate(chosen, 1):
            if self._issue_alert(case, batch, a, position, stage_used, now):
                issued += 1
        case.batches_created = seq
        case.current_stage_index = max(previous_stage, stage_used)
        case.last_batch_at = now
        self._event(case, EventType.OUTREACH_INITIATED, now,
                    f'{issued} alert(s) issued for batch {seq}. '
                    + ('Simulation: no real message was sent.' if case.is_simulation else
                       'In-app alerts were recorded; delivery is confirmed only when a donor opens the alert.'),
                    batch=batch, new_stage=stage_used, details={'alerts_issued': issued})
        return batch

    def _issue_alert(self, case, batch, assessment, position, stage_used, now):
        c = assessment.candidate
        kwargs = dict(
            case=case, batch=batch, stage_index=stage_used, status=AttemptStatus.ALERTED, attempted_at=now,
            rank_position=position, rank_score=assessment.score, score_breakdown=assessment.breakdown,
            explanation=assessment.explanation, distance_km=assessment.distance_km,
        )
        if c.kind == 'sim':
            kwargs['sim_donor_id'] = c.pk
        else:
            kwargs['donor_id'] = c.pk
        try:
            with transaction.atomic():  # savepoint: a duplicate must not poison the outer transaction
                attempt = OutreachAttempt.objects.create(**kwargs)
        except IntegrityError:
            logger.info('Duplicate outreach prevented for case %s candidate %s', case.pk, c.key)
            return False
        if c.kind == 'real':
            self._dispatch_real_alert(case, attempt, assessment)
        return True

    def _dispatch_real_alert(self, case, attempt, assessment):
        """Create/refresh the donor-facing DonorMatch and an in-app Notification (real cases only)."""
        from matching.models import AlertStatus, DonorMatch
        from notifications.models import Notification, NotificationType
        req = case.blood_request
        donor = attempt.donor
        match, created = DonorMatch.objects.get_or_create(
            blood_request=req, donor=donor, defaults={'alert_status': AlertStatus.DISPATCHED})
        match.compatibility_score = int(round(assessment.score))
        match.match_type = 'EXACT_MATCH' if donor.blood_group == req.blood_group else 'COMPATIBLE_SUBSTITUTE'
        match.match_explanation = (assessment.explanation + ' Potential donor match - final suitability, screening '
                                   'and transfusion compatibility must be confirmed by the blood bank.')
        match.distance_km = assessment.distance_km
        if not created and match.alert_status not in (AlertStatus.ACCEPTED, AlertStatus.DECLINED):
            match.alert_status = AlertStatus.DISPATCHED
        match.save()
        attempt.donor_match = match
        attempt.save(update_fields=['donor_match', 'updated_at'])
        Notification.objects.create(
            recipient=donor.user, related_request=req,
            title=f'{"REMINDER: " if not created else "URGENT: "}Emergency Blood Request ({req.blood_group})',
            message=(f"Hospital '{req.hospital_name}' urgently requires {req.units_requested} unit(s) of "
                     f'{req.blood_group} {req.component}. Urgency: {req.urgency}. You are a potential candidate only; '
                     'please respond if you are available. Medical staff make the final eligibility decision.'),
            notification_type=NotificationType.EMERGENCY_ALERT, urgency=req.urgency,
            action_url=f'/donor/alerts/{match.id}',
        )

    # ------------------------------------------------------------------ responses
    @transaction.atomic
    def record_response(self, attempt_id, new_status, source, message='', now=None, evaluate=True):
        """Record accept/decline for an attempt. Idempotent; handles late and changed responses."""
        now = self._now(now)
        if new_status not in (AttemptStatus.ACCEPTED, AttemptStatus.DECLINED):
            raise EscalationError('Response must be ACCEPTED or DECLINED.', 'invalid_response')
        case_id = OutreachAttempt.objects.values_list('case_id', flat=True).get(pk=attempt_id)
        case = self._lock(case_id)
        attempt = OutreachAttempt.objects.select_for_update().select_related('batch', 'donor', 'sim_donor').get(pk=attempt_id)
        if attempt.status == new_status:
            return ResponseResult(attempt, False, 'Response already recorded; nothing changed.')
        if attempt.status not in RESPONDABLE_ATTEMPT_STATUSES:
            return ResponseResult(attempt, False, f'Alert is {attempt.get_status_display().lower()}; response ignored.')

        previous = attempt.status
        attempt.status = new_status
        attempt.responded_at = now
        attempt.response_source = source
        attempt.response_message = (message or '')[:300]
        attempt.save()
        who = self._attempt_label(attempt)

        if case.is_terminal:
            self._event(case, EventType.LATE_RESPONSE, now,
                        f'{who} responded {new_status} after the request was {case.status.lower()}. '
                        'No further outreach is generated.', attempt=attempt)
            return ResponseResult(attempt, True, 'Recorded after the request closed.')

        event = EventType.CANDIDATE_ACCEPTED if new_status == AttemptStatus.ACCEPTED else EventType.CANDIDATE_DECLINED
        suffix = ' (they had previously responded differently)' if previous in (
            AttemptStatus.ACCEPTED, AttemptStatus.DECLINED) else (
            ' after the response window had elapsed' if previous == AttemptStatus.NO_RESPONSE else '')
        self._event(case, event, now,
                    f'{who} {"accepted - volunteer, not yet verified by the hospital" if new_status == AttemptStatus.ACCEPTED else "declined"}{suffix}.',
                    attempt=attempt, batch=attempt.batch, details={'source': source})
        self._refresh_need(case)
        case.save(update_fields=['remaining_coordination_need'])
        if evaluate:
            self.evaluate(case.pk, now=now)
        return ResponseResult(attempt, True, 'Response recorded.')

    @transaction.atomic
    def mark_viewed(self, attempt_id, now=None):
        now = self._now(now)
        attempt = OutreachAttempt.objects.select_for_update().select_related('case').get(pk=attempt_id)
        if attempt.status in (AttemptStatus.ALERTED, AttemptStatus.NO_RESPONSE) and attempt.viewed_at is None:
            if attempt.status == AttemptStatus.ALERTED:
                attempt.status = AttemptStatus.VIEWED
            attempt.viewed_at = now
            attempt.save(update_fields=['status', 'viewed_at', 'updated_at'])
            self._event(attempt.case, EventType.ALERT_VIEWED, now,
                        f'{self._attempt_label(attempt)} opened the alert (delivery confirmed).', attempt=attempt)
            return True
        return False

    @staticmethod
    def _attempt_label(attempt):
        if attempt.sim_donor_id:
            return f'{attempt.sim_donor.code} (fictional)'
        from .candidates import privacy_name
        u = attempt.donor.user
        return f'Candidate {privacy_name(u.first_name, u.last_name, "Donor")} (#{attempt.donor_id})'

    def _refresh_need(self, case):
        counts = self._counts(list(case.attempts.all()))
        case.remaining_coordination_need = max(0, case.target_volunteers - counts['accepted'])
        return counts

    # ------------------------------------------------------------------ administrator actions
    @transaction.atomic
    def approve_escalation(self, case_id, actor, now=None):
        """Administrator approves the next batch / expansion (manual evaluation)."""
        return self.evaluate(case_id, now=now, manual=True, actor=actor)

    @transaction.atomic
    def mark_reviewed(self, case_id, actor, note='', now=None):
        now = self._now(now)
        case = self._lock(case_id)
        case.reviewed_at, case.reviewed_by = now, actor
        case.save(update_fields=['reviewed_at', 'reviewed_by'])
        self._event(case, EventType.ADMIN_REVIEWED, now,
                    f'Administrator reviewed the request.{" Note: " + note if note else ""}', actor=actor,
                    details={'note': note})
        return case

    @transaction.atomic
    def cancel(self, case_id, actor=None, reason='', now=None, sync_request=True):
        now = self._now(now)
        case = self._lock(case_id)
        if case.is_terminal:
            return case
        self._close(case, CaseStatus.CANCELLED, now, reason or 'Cancelled by administrator.',
                    EventType.REQUEST_CANCELLED, actor=actor)
        if sync_request and case.blood_request_id:
            from blood_requests.models import RequestStatus
            req = case.blood_request
            if req.request_status not in (RequestStatus.CANCELLED, RequestStatus.FULFILLED, RequestStatus.CLOSED):
                req.request_status = RequestStatus.CANCELLED
                req.save(update_fields=['request_status', 'updated_at'])
        return case

    @transaction.atomic
    def resolve(self, case_id, actor, note, now=None):
        """Administrator resolves the emergency (hospital confirmed the requirement is met)."""
        now = self._now(now)
        if not (note or '').strip():
            raise EscalationError('A resolution note is required.', 'note_required')
        case = self._lock(case_id)
        if case.is_terminal:
            raise EscalationError(f'Request is already {case.status.lower()}.', 'already_closed')
        self._close(case, CaseStatus.RESOLVED, now, note.strip(), EventType.REQUEST_RESOLVED, actor=actor)
        if case.blood_request_id:
            from blood_requests.models import RequestStatus
            req = case.blood_request
            if req.request_status not in (RequestStatus.CANCELLED, RequestStatus.FULFILLED, RequestStatus.CLOSED):
                req.request_status = RequestStatus.FULFILLED
                req.fulfillment_notes = note.strip()
                req.save(update_fields=['request_status', 'fulfillment_notes', 'updated_at'])
        return case

    @transaction.atomic
    def set_fulfilment(self, attempt_id, stage, actor, note='', now=None):
        """Hospital-side progress for an accepted volunteer. Only administrators move this."""
        now = self._now(now)
        if stage not in Fulfilment.values:
            raise EscalationError('Unknown fulfilment stage.', 'invalid_stage')
        case_id = OutreachAttempt.objects.values_list('case_id', flat=True).get(pk=attempt_id)
        case = self._lock(case_id)
        attempt = OutreachAttempt.objects.select_for_update().select_related('donor', 'sim_donor', 'batch').get(pk=attempt_id)
        if attempt.status != AttemptStatus.ACCEPTED:
            raise EscalationError('Only an accepted volunteer can have a hospital verification status.', 'not_accepted')
        if attempt.fulfilment == stage:
            return attempt
        attempt.fulfilment = stage
        attempt.save(update_fields=['fulfilment', 'updated_at'])
        label = dict(Fulfilment.choices)[stage]
        self._event(case, EventType.FULFILMENT_UPDATED, now,
                    f'{self._attempt_label(attempt)}: {label}.{" Note: " + note if note else ""}',
                    actor=actor, attempt=attempt, details={'fulfilment': stage})
        counts = self._refresh_need(case)
        case.save(update_fields=['remaining_coordination_need'])
        confirmed = case.attempts.filter(fulfilment=Fulfilment.DONATION_CONFIRMED).count()
        if not case.is_terminal and confirmed >= case.units_requested:
            self._close(case, CaseStatus.RESOLVED, now,
                        f'Hospital confirmed {confirmed} donation outcome(s), meeting the {case.units_requested} '
                        'unit(s) requested.', EventType.REQUEST_RESOLVED, actor=actor)
        elif not case.is_terminal:
            self.evaluate(case.pk, now=now)
        return attempt

    # ------------------------------------------------------------------ closing
    def _close(self, case, status, now, reason, event_type, actor=None):
        case.status = status
        case.closed_at = now
        case.closure_reason = reason[:300]
        withdrawn = 0
        for a in case.attempts.filter(status__in=list(PENDING_ATTEMPT_STATUSES)):
            a.status = AttemptStatus.WITHDRAWN
            a.save(update_fields=['status', 'updated_at'])
            withdrawn += 1
        self._event(case, event_type, now,
                    f'{reason} {withdrawn} unanswered alert(s) withdrawn; no further outreach or escalation.',
                    actor=actor, details={'withdrawn_alerts': withdrawn})
        case.save()
        if not case.is_simulation:
            self._notify_closure(case, status)
            if status == CaseStatus.EXPIRED and case.blood_request_id:
                from blood_requests.models import RequestStatus
                req = case.blood_request
                if req.request_status not in (RequestStatus.CANCELLED, RequestStatus.FULFILLED, RequestStatus.CLOSED):
                    req.request_status = RequestStatus.CLOSED
                    req.fulfillment_notes = (req.fulfillment_notes + ' ' if req.fulfillment_notes else '') + \
                        'Closed automatically: required time passed without resolution.'
                    req.save(update_fields=['request_status', 'fulfillment_notes', 'updated_at'])

    def _notify_closure(self, case, status):
        from notifications.models import Notification, NotificationType
        text = {
            CaseStatus.CANCELLED: 'was cancelled', CaseStatus.EXPIRED: 'has expired',
            CaseStatus.RESOLVED: 'has been resolved',
        }[status]
        donors = {a.donor.user for a in case.attempts.select_related('donor__user').filter(
            status__in=[AttemptStatus.WITHDRAWN, AttemptStatus.ACCEPTED]) if a.donor_id}
        for user in donors:
            Notification.objects.create(
                recipient=user, related_request=case.blood_request,
                title=f'Request {case.reference} {text}',
                message=f'The emergency request at {case.hospital_name} {text}. No further action is needed from you.',
                notification_type=NotificationType.STATUS_UPDATE, urgency='STANDARD',
            )
        if status == CaseStatus.EXPIRED and case.blood_request_id:
            Notification.objects.create(
                recipient=case.blood_request.requester, related_request=case.blood_request,
                title=f'Request {case.reference} expired',
                message='The required time passed before the request was resolved. Outreach has stopped; '
                        'please contact the hospital blood bank or submit a new request.',
                notification_type=NotificationType.STATUS_UPDATE, urgency=case.urgency,
                action_url=f'/requester/requests/{case.blood_request_id}',
            )

    def _notify_admins(self, case, reason):
        if case.is_simulation:
            return
        from accounts.models import User
        from django.db.models import Q
        from notifications.models import Notification, NotificationType
        for admin in User.objects.filter(Q(role='admin') | Q(is_superuser=True)).distinct():
            Notification.objects.create(
                recipient=admin, related_request=case.blood_request,
                title=f'Intervention needed: {case.reference}', message=reason,
                notification_type=NotificationType.STATUS_UPDATE, urgency=case.urgency,
                action_url=f'/admin-portal/outreach/{case.pk}',
            )

    # ------------------------------------------------------------------ batch evaluation
    def evaluate_active_real_cases(self, now=None):
        """Evaluate every open real case once. Used by the worker command and the Command Center poll."""
        now = self._now(now)
        ids = list(EmergencyCase.objects.filter(is_simulation=False).exclude(
            status__in=TERMINAL_CASE_STATUSES).values_list('pk', flat=True))
        results = []
        for cid in ids:
            try:
                results.append(self.evaluate(cid, now=now))
            except Exception:  # one bad case must not stop the others
                logger.exception('Evaluation failed for case %s', cid)
        return results


service = AdaptiveEscalationService()
