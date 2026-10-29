"""Turns engine state into API payloads. Contact details are never included."""
from django.utils import timezone

from .assistant import CaseContext, recommendations, unknowns
from .candidates import approximate_point, case_origin, rank_candidates
from .constants import (
    AttemptStatus, CaseStatus, EventType, Fulfilment, PENDING_ATTEMPT_STATUSES, TERMINAL_CASE_STATUSES,
)

LIFECYCLE_LABELS = {
    'POTENTIAL': 'Potential candidate',
    'ALERT_SENT': 'Alert sent (delivery not confirmed)',
    'ALERT_VIEWED': 'Alert viewed - awaiting response',
    'NO_RESPONSE': 'No response (status unknown)',
    'RESPONSE_DECLINED': 'Response received - declined',
    'VOLUNTEER_CONFIRMED': 'Volunteer confirmed (accepted)',
    'HOSPITAL_VERIFICATION_PENDING': 'Hospital verification pending',
    'DONATION_CONFIRMED': 'Donation outcome confirmed by hospital',
    'NOT_DONATED': 'Did not donate / deferred by hospital',
    'WITHDRAWN': 'Alert withdrawn - request ended',
    'EXCLUDED': 'Excluded',
}


def lifecycle(attempt, eligible=True):
    if attempt is None:
        return 'POTENTIAL' if eligible else 'EXCLUDED'
    s = attempt.status
    if s == AttemptStatus.ACCEPTED:
        return {Fulfilment.VERIFICATION_PENDING: 'HOSPITAL_VERIFICATION_PENDING',
                Fulfilment.DONATION_CONFIRMED: 'DONATION_CONFIRMED',
                Fulfilment.NOT_DONATED: 'NOT_DONATED'}.get(attempt.fulfilment, 'VOLUNTEER_CONFIRMED')
    return {AttemptStatus.ALERTED: 'ALERT_SENT', AttemptStatus.VIEWED: 'ALERT_VIEWED',
            AttemptStatus.NO_RESPONSE: 'NO_RESPONSE', AttemptStatus.DECLINED: 'RESPONSE_DECLINED',
            AttemptStatus.WITHDRAWN: 'WITHDRAWN'}[s]


def counts_for(attempts):
    c = {
        'outreach_attempts': len(attempts), 'alerts_awaiting_response': 0, 'accepted_volunteers': 0,
        'declined': 0, 'no_response': 0, 'withdrawn': 0, 'hospital_verification_pending': 0,
        'donations_confirmed': 0,
    }
    for a in attempts:
        if a.status in PENDING_ATTEMPT_STATUSES:
            c['alerts_awaiting_response'] += 1
        elif a.status == AttemptStatus.ACCEPTED:
            if a.fulfilment != Fulfilment.NOT_DONATED:
                c['accepted_volunteers'] += 1
            if a.fulfilment == Fulfilment.VERIFICATION_PENDING:
                c['hospital_verification_pending'] += 1
            if a.fulfilment == Fulfilment.DONATION_CONFIRMED:
                c['donations_confirmed'] += 1
        elif a.status == AttemptStatus.DECLINED:
            c['declined'] += 1
        elif a.status == AttemptStatus.NO_RESPONSE:
            c['no_response'] += 1
        elif a.status == AttemptStatus.WITHDRAWN:
            c['withdrawn'] += 1
    return c


def _stage(case, policy):
    i = case.current_stage_index
    if 0 <= i < len(policy.stages):
        return {'index': i, 'name': policy.stages[i].name}
    return {'index': -1, 'name': 'Not started'}


def serialize_case(case, detail=False):
    policy = case.get_policy()
    attempts = list(case.attempts.select_related('batch', 'donor__user', 'sim_donor'))
    counts = counts_for(attempts)
    ctx_rank = rank_candidates(case, policy, case.last_evaluated_at if case.is_simulation and case.last_evaluated_at
                               else timezone.now(), attempts)
    permanent = ('ALREADY_CONTACTED', 'DECLINED_THIS_REQUEST', 'ALREADY_VOLUNTEERED')
    potential = sum(1 for a in ctx_rank.assessments if a.eligible or a.exclusion in permanent)
    data = {
        'id': case.pk, 'reference': case.reference, 'is_simulation': case.is_simulation,
        'strategy': case.strategy, 'strategy_label': case.get_strategy_display(),
        'blood_request_id': case.blood_request_id,
        'request_status': case.blood_request.request_status if case.blood_request_id else None,
        'simulation_run_id': case.simulation_run_id,
        'blood_group': case.blood_group, 'units_requested': case.units_requested,
        'hospital_name': case.hospital_name, 'locality': case.locality, 'city': case.city, 'urgency': case.urgency,
        'created_at': case.blood_request.created_at if case.blood_request_id else case.created_at,
        'started_at': case.started_at, 'required_by': case.required_by, 'expires_at': case.expires_at,
        'status': case.status, 'status_label': case.get_status_display(), 'is_terminal': case.is_terminal,
        'current_stage': _stage(case, policy),
        'target_volunteers': case.target_volunteers,
        'remaining_coordination_need': case.remaining_coordination_need,
        'potential_candidates': potential, 'eligible_uncontacted': len(ctx_rank.eligible),
        'batches': case.batches_created, 'counts': counts,
        'last_decision': case.last_decision or None, 'closure_reason': case.closure_reason,
        'reviewed_at': case.reviewed_at,
    }
    if detail:
        data['pipeline'] = pipeline(case, policy, counts)
        ctx = CaseContext(case)
        ctx._rank = ctx_rank
        ctx.attempts = attempts
        data['recommendations'] = recommendations(ctx)
        data['unknowns'] = unknowns(ctx)
        data['stages'] = [
            {'index': s.index, 'name': s.name, 'radius_km': s.radius_km, 'fallback_scope': s.fallback_scope,
             'max_batch_size': s.max_batch_size, 'eligible_uncontacted': ctx_rank.available_by_stage[s.index]}
            for s in policy.stages
        ]
        data['excluded_counts'] = ctx_rank.excluded_counts
        data['origin_basis'] = ctx_rank.origin_basis
        data['policy_summary'] = {
            'response_wait_minutes': policy.wait_minutes(case.urgency), 'min_batch_gap_minutes': policy.min_gap(case.urgency),
            'max_batches': policy.max_batches, 'auto_escalate': policy.auto_escalate,
            'volunteers_per_unit': policy.volunteers_per_unit, 'weights': policy.weights,
        }
        if case.is_simulation:
            run = case.simulation_run
            data['simulation'] = {
                'run_id': run.pk, 'scenario': run.scenario, 'scenario_label': run.get_scenario_display(),
                'seed': run.seed, 'status': run.status, 'sim_start': run.sim_start, 'sim_clock': run.sim_clock,
                'horizon_minutes': run.horizon_minutes, 'metrics': run.metrics, 'final_outcome': run.final_outcome,
                'elapsed_minutes': round((run.sim_clock - run.sim_start).total_seconds() / 60, 1),
            }
    return data


def pipeline(case, policy, counts):
    answered = counts['accepted_volunteers'] + counts['declined']
    terminal = case.status in TERMINAL_CASE_STATUSES
    started = case.batches_created > 0

    def st(done, current=False):
        return 'done' if done else 'current' if current else 'pending'

    expanded = case.current_stage_index >= 1
    steps = [
        {'key': 'initial_search', 'label': 'Initial search',
         'state': st(started or terminal, case.status == CaseStatus.OPEN),
         'detail': 'Eligible candidates found and ranked inside the first search stage.'},
        {'key': 'first_batch', 'label': 'First outreach batch', 'state': st(started, not started and not terminal),
         'detail': f'{case.batches_created} batch(es) created so far.' if started else 'Not created yet.'},
        {'key': 'response_collection', 'label': 'Response collection',
         'state': st(started and (answered > 0 or counts['no_response'] > 0) and case.status != CaseStatus.COLLECTING_RESPONSES,
                     case.status == CaseStatus.COLLECTING_RESPONSES),
         'detail': f"{answered} response(s) received; {counts['alerts_awaiting_response']} awaiting; "
                   f"{counts['no_response']} lapsed (status unknown)."},
        {'key': 'expanded_search', 'label': 'Expanded search',
         'state': st(expanded, case.status == CaseStatus.AWAITING_ESCALATION),
         'detail': f'Reached {_stage(case, policy)["name"]}.' if expanded else 'Not needed so far.'},
        {'key': 'further_coordination', 'label': 'Further coordination',
         'state': st(case.batches_created >= 2, False),
         'detail': f'{max(case.batches_created - 1, 0)} follow-up batch(es).'},
        {'key': 'admin_review', 'label': 'Administrator review',
         'state': st(case.reviewed_at is not None, case.status == CaseStatus.NEEDS_ADMIN_INTERVENTION),
         'detail': 'Reviewed.' if case.reviewed_at else
         ('Intervention required.' if case.status == CaseStatus.NEEDS_ADMIN_INTERVENTION else 'Not yet reviewed.')},
        {'key': 'resolution', 'label': 'Resolution or cancellation',
         'state': st(terminal, case.status == CaseStatus.VOLUNTEERS_SECURED),
         'detail': (case.get_status_display() + (f' - {case.closure_reason}' if case.closure_reason else '')) if terminal
         else ('Volunteer target reached; awaiting hospital verification.' if case.status == CaseStatus.VOLUNTEERS_SECURED
               else 'Open.')},
    ]
    return steps


def serialize_event(e):
    return {
        'id': e.pk, 'type': e.event_type, 'type_label': e.get_event_type_display(), 'time': e.event_time,
        'message': e.decision_reason, 'previous_stage': e.previous_stage, 'new_stage': e.new_stage,
        'actor': (e.actor.get_full_name() or e.actor.username) if e.actor_id else None,
        'attempt_id': e.attempt_id, 'batch_id': e.batch_id, 'is_simulation': e.simulation_flag,
        'details': e.details,
    }


def _availability_label(c):
    if c.is_available is None:
        return 'Unknown'
    return 'Declared available' if c.is_available else 'Declared unavailable'


def serialize_assessment(a, policy):
    c, at = a.candidate, a.attempt
    stage = policy.stages[a.first_stage].name if a.first_stage is not None else 'Unknown'
    life = lifecycle(at, a.eligible)
    return {
        'candidate_key': f'{c.kind}:{c.pk}', 'attempt_id': at.pk if at else None,
        'display_name': c.display_name, 'blood_group': c.blood_group, 'locality': c.locality or 'Unknown',
        'distance_km': a.distance_km, 'availability': _availability_label(c),
        'consent': 'Consented' if c.has_consent else 'No consent' if c.has_consent is False else 'Unknown',
        'verified_profile': c.verified, 'search_stage': stage,
        'contacted': at is not None, 'status': life, 'status_label': LIFECYCLE_LABELS[life],
        'fulfilment': at.fulfilment if at else None,
        'batch': at.batch.sequence if at else None,
        'score': at.rank_score if at else a.score,
        'breakdown': (at.score_breakdown if at else a.breakdown),
        'explanation': (at.explanation if at and at.explanation else a.explanation),
        'unknown_fields': a.unknown_fields,
        'exclusion_code': a.exclusion, 'exclusion_label': a.exclusion_label,
        'attempted_at': at.attempted_at if at else None, 'responded_at': at.responded_at if at else None,
        'response_source': at.response_source if at else '', 'is_simulation': c.kind == 'sim',
    }


def candidate_rows(case, view='all'):
    policy = case.get_policy()
    now = case.last_evaluated_at if case.is_simulation and case.last_evaluated_at else timezone.now()
    attempts = list(case.attempts.select_related('batch', 'donor__user', 'sim_donor'))
    rank = rank_candidates(case, policy, now, attempts)
    rows = []
    for a in rank.assessments:
        contacted = a.attempt is not None
        if view == 'eligible' and not (a.eligible and not contacted):
            continue
        if view == 'contacted' and not contacted:
            continue
        if view == 'excluded' and (a.eligible or contacted):
            continue
        if view == 'all' and not (a.eligible or contacted):
            continue
        rows.append(a)
    order = {'eligible': lambda a: (-a.score, a.candidate.pk)}
    rows.sort(key=lambda a: (
        0 if a.attempt else 1,
        (a.attempt.batch.sequence, a.attempt.rank_position) if a.attempt else (0, 0),
        -a.score, a.candidate.pk,
    ))
    return [serialize_assessment(a, policy) for a in rows], rank


def map_payload(case):
    policy = case.get_policy()
    lat, lng, basis = case_origin(case)
    attempts = list(case.attempts.select_related('donor__user', 'sim_donor'))
    rank = rank_candidates(case, policy, timezone.now() if not case.is_simulation else (case.last_evaluated_at or case.started_at), attempts)
    points, unplaced = [], {}
    for a in rank.assessments:
        c = a.candidate
        if not (a.eligible or a.attempt):
            continue
        pt = approximate_point(c)
        life = lifecycle(a.attempt, a.eligible)
        if pt is None:
            unplaced[c.locality or 'Unknown locality'] = unplaced.get(c.locality or 'Unknown locality', 0) + 1
            continue
        points.append({'label': c.display_name, 'lat': pt[0], 'lng': pt[1], 'status': life,
                       'status_label': LIFECYCLE_LABELS[life], 'approximate': True})
    banks = []
    if not case.is_simulation:
        from bloodbank.models import BloodBank
        banks = [{'name': b.name, 'lat': b.latitude, 'lng': b.longitude, 'locality': b.locality}
                 for b in BloodBank.objects.filter(is_active=True)]
    return {
        'hospital': {'name': case.hospital_name, 'lat': lat, 'lng': lng, 'approximate': case.hospital_lat is None,
                     'basis': basis, 'fictional': case.is_simulation},
        'stages': [{'name': s.name, 'radius_km': s.radius_km} for s in policy.stages],
        'candidates': points, 'unplaced_by_locality': [{'locality': k, 'count': v} for k, v in sorted(unplaced.items())],
        'blood_banks': banks, 'privacy_note': 'Candidate positions are rounded to ~1 km; contact details are never shown.',
        'is_simulation': case.is_simulation,
    }


def serialize_batch(b):
    return {
        'id': b.pk, 'sequence': b.sequence, 'stage_index': b.stage_index, 'trigger': b.trigger,
        'trigger_label': b.get_trigger_display(), 'planned_size': b.planned_size,
        'decision_reason': b.decision_reason, 'created_at': b.created_at,
    }


def serialize_simulation(run, with_case=True):
    data = {
        'id': run.pk, 'scenario': run.scenario, 'scenario_label': run.get_scenario_display(),
        'strategy': run.strategy, 'strategy_label': run.get_strategy_display(), 'seed': run.seed,
        'status': run.status, 'sim_start': run.sim_start, 'sim_clock': run.sim_clock,
        'elapsed_minutes': round((run.sim_clock - run.sim_start).total_seconds() / 60, 1),
        'horizon_minutes': run.horizon_minutes, 'experiment_id': run.experiment_id,
        'metrics': run.metrics, 'final_outcome': run.final_outcome, 'created_at': run.created_at,
        'tick_minutes': run.policy_snapshot.get('sim_tick_minutes', 2), 'is_simulation': True,
        'donor_pool_size': run.donors.count(),
        'case_id': getattr(getattr(run, 'case', None), 'pk', None),
    }
    return data
