"""Engine behaviour against the database: eligibility, batches, responses, escalation, closure."""
from datetime import timedelta

from django.db import IntegrityError, transaction
from django.test import TestCase
from django.utils import timezone

from accounts.models import UserRole
from blood_requests.models import RequestStatus
from escalation.constants import AttemptStatus, CaseStatus, EventType, Fulfilment
from escalation.models import EmergencyCase, EscalationEvent, OutreachAttempt
from escalation.service import EscalationError, service
from matching.models import DonorMatch
from notifications.models import Notification

from .helpers import FAST_HASH, make_donor, make_request, make_user, populate_pool


@FAST_HASH
class EngineTestBase(TestCase):
    def setUp(self):
        self.admin = make_user('admin@test.org', UserRole.ADMIN)
        self.requester = make_user('req@test.org', UserRole.REQUESTER)

    def start(self, **req_kwargs):
        req = make_request(self.requester, **req_kwargs)
        case = service.start_case_for_request(req, actor=self.admin)
        return req, case

    def at(self, case, minutes):
        return case.started_at + timedelta(minutes=minutes)


class EligibilityTests(EngineTestBase):
    def test_only_consenting_available_matching_donors_are_alerted(self):
        ok = make_donor(1, 'Adyar', 'O+')
        no_consent = make_donor(2, 'Adyar', 'O+', consent=False)
        unavailable = make_donor(3, 'Adyar', 'O+', available=False)
        wrong_group = make_donor(4, 'Adyar', 'A+')
        inactive = make_donor(5, 'Adyar', 'O+')
        inactive.user.is_active = False
        inactive.user.save()
        _, case = self.start()
        alerted = set(case.attempts.values_list('donor_id', flat=True))
        self.assertEqual(alerted, {ok.pk})
        self.assertFalse(DonorMatch.objects.filter(donor__in=[no_consent, unavailable, wrong_group, inactive]).exists())
        self.assertFalse(Notification.objects.filter(recipient__in=[no_consent.user, unavailable.user]).exists())

    def test_requester_is_never_a_candidate(self):
        profile = make_donor(1, 'Adyar', 'O+')
        profile.user.role = UserRole.DONOR
        req = make_request(profile.user)
        make_donor(2, 'Adyar', 'O+')
        case = service.start_case_for_request(req)
        self.assertNotIn(profile.pk, case.attempts.values_list('donor_id', flat=True))

    def test_donor_with_no_location_information_is_excluded_not_guessed(self):
        blank = make_donor(1, 'Adyar', 'O+', coords=False)
        blank.city, blank.locality = '', ''
        blank.save()
        listed = make_donor(2, 'Adyar', 'O+')
        _, case = self.start()
        self.assertEqual(set(case.attempts.values_list('donor_id', flat=True)), {listed.pk})
        from escalation.candidates import rank_candidates
        rank = rank_candidates(case, case.get_policy(), timezone.now())
        self.assertEqual(rank.excluded_counts.get('INSUFFICIENT_INFO'), 1)

    def test_unknown_distance_donors_are_placed_by_locality_not_by_invented_distance(self):
        near = make_donor(1, 'Adyar', 'O+', coords=False)
        far = make_donor(2, 'Tambaram', 'O+', coords=False)
        _, case = self.start()
        first = case.attempts.get(donor=near)
        self.assertIsNone(first.distance_km)
        self.assertEqual(first.stage_index, 0)
        # Tambaram has no coordinates and is not in the request locality: only the city-wide stage can include it.
        self.assertFalse(case.attempts.filter(donor=far).exists())

    def test_zero_eligible_candidates_requires_administrator_intervention(self):
        _, case = self.start()
        self.assertEqual(case.status, CaseStatus.NEEDS_ADMIN_INTERVENTION)
        self.assertEqual(case.attempts.count(), 0)
        self.assertEqual(case.batches.count(), 0)
        self.assertTrue(case.events.filter(event_type=EventType.ADMIN_INTERVENTION_REQUIRED).exists())
        self.assertTrue(Notification.objects.filter(recipient=self.admin, title__startswith='Intervention needed').exists())

    def test_every_alert_records_a_transparent_score_and_explanation(self):
        make_donor(1, 'Adyar', 'O+', verified=True)
        _, case = self.start()
        attempt = case.attempts.get()
        self.assertTrue(attempt.explanation.startswith('Prioritised because'))
        keys = {b['key'] for b in attempt.score_breakdown}
        self.assertEqual(keys, {'proximity', 'group_match', 'verified_profile', 'availability_freshness'})
        self.assertAlmostEqual(sum(b['points'] for b in attempt.score_breakdown), attempt.rank_score *
                               case.get_policy().weight_total / 100, places=1)

    def test_nearer_verified_donor_ranks_first(self):
        far = make_donor(1, 'Velachery', 'O+')
        near = make_donor(2, 'Adyar', 'O+', verified=True)
        _, case = self.start(units=1)
        self.assertEqual(case.attempts.order_by('rank_position').first().donor_id, near.pk)
        self.assertEqual(case.attempts.get(donor=far).stage_index, case.attempts.get(donor=far).batch.stage_index)


class OutreachTests(EngineTestBase):
    def test_first_batch_is_limited_to_the_initial_stage_and_stage_cap(self):
        populate_pool(near=12, mid=6, far=6)
        _, case = self.start()
        self.assertEqual(case.batches_created, 1)
        self.assertEqual(case.current_stage_index, 0)
        self.assertLessEqual(case.attempts.count(), 8)
        self.assertEqual(case.attempts.exclude(batch__stage_index=0).count(), 0)
        self.assertEqual(case.status, CaseStatus.COLLECTING_RESPONSES)

    def test_repeated_evaluation_never_duplicates_outreach(self):
        populate_pool()
        _, case = self.start()
        before = case.attempts.count()
        for _ in range(5):
            service.evaluate(case.pk, now=self.at(case, 1))
        self.assertEqual(case.attempts.count(), before)
        self.assertEqual(case.batches.count(), 1)

    def test_same_candidate_cannot_be_recorded_twice_for_the_same_stage(self):
        make_donor(1, 'Adyar', 'O+')
        _, case = self.start()
        first = case.attempts.get()
        with self.assertRaises(IntegrityError), transaction.atomic():
            OutreachAttempt.objects.create(case=case, batch=first.batch, donor=first.donor,
                                           stage_index=first.stage_index, attempted_at=timezone.now())

    def test_each_donor_is_alerted_at_most_once_across_the_whole_escalation(self):
        populate_pool()
        _, case = self.start()
        for minute in range(2, 60, 2):
            service.evaluate(case.pk, now=self.at(case, minute))
        ids = list(case.attempts.values_list('donor_id', flat=True))
        self.assertEqual(len(ids), len(set(ids)))
        self.assertEqual(DonorMatch.objects.filter(blood_request=case.blood_request).count(), len(ids))

    def test_real_alerts_create_in_app_notifications_only(self):
        make_donor(1, 'Adyar', 'O+')
        _, case = self.start()
        n = Notification.objects.filter(related_request=case.blood_request, notification_type='EMERGENCY_ALERT')
        self.assertEqual(n.count(), 1)
        self.assertIn('potential candidate', n.first().message)


class ResponseTests(EngineTestBase):
    def setUp(self):
        super().setUp()
        self.donors = populate_pool(near=8, mid=0, far=0)
        _, self.case = self.start()   # 2 units x 2 = target 4

    def attempts(self):
        return list(self.case.attempts.order_by('rank_position'))

    def test_accept_recalculates_remaining_need_but_does_not_resolve(self):
        a = self.attempts()[0]
        res = service.record_response(a.pk, AttemptStatus.ACCEPTED, 'donor_app', now=self.at(self.case, 2))
        self.assertTrue(res.changed)
        self.case.refresh_from_db()
        self.assertEqual(self.case.remaining_coordination_need, 3)
        self.assertEqual(self.case.status, CaseStatus.COLLECTING_RESPONSES)
        self.case.blood_request.refresh_from_db()
        self.assertNotEqual(self.case.blood_request.request_status, RequestStatus.FULFILLED)

    def test_duplicate_response_is_idempotent(self):
        a = self.attempts()[0]
        service.record_response(a.pk, AttemptStatus.ACCEPTED, 'donor_app', now=self.at(self.case, 2))
        events = self.case.events.count()
        again = service.record_response(a.pk, AttemptStatus.ACCEPTED, 'donor_app', now=self.at(self.case, 3))
        self.assertFalse(again.changed)
        self.assertEqual(self.case.events.count(), events)
        self.case.refresh_from_db()
        self.assertEqual(self.case.remaining_coordination_need, 3)

    def test_decline_is_distinct_from_no_response(self):
        a, b = self.attempts()[:2]
        service.record_response(a.pk, AttemptStatus.DECLINED, 'donor_app', now=self.at(self.case, 2))
        service.evaluate(self.case.pk, now=self.at(self.case, 11))   # CRITICAL window is 10 minutes
        a.refresh_from_db(), b.refresh_from_db()
        self.assertEqual(a.status, AttemptStatus.DECLINED)
        self.assertEqual(b.status, AttemptStatus.NO_RESPONSE)
        self.assertTrue(self.case.events.filter(event_type=EventType.RESPONSE_WINDOW_ELAPSED).exists())
        # a declined donor is excluded from further outreach, a non-responder is merely unknown
        self.assertEqual(self.case.attempts.filter(donor=a.donor).count(), 1)

    def test_late_acceptance_after_window_is_still_counted(self):
        b = self.attempts()[1]
        service.evaluate(self.case.pk, now=self.at(self.case, 11))
        b.refresh_from_db()
        self.assertEqual(b.status, AttemptStatus.NO_RESPONSE)
        service.record_response(b.pk, AttemptStatus.ACCEPTED, 'donor_app', now=self.at(self.case, 14))
        b.refresh_from_db()
        self.assertEqual(b.status, AttemptStatus.ACCEPTED)
        self.case.refresh_from_db()
        self.assertEqual(self.case.remaining_coordination_need, 3)

    def test_target_reached_pauses_outreach_without_closing_the_request(self):
        for a in self.attempts()[:4]:
            service.record_response(a.pk, AttemptStatus.ACCEPTED, 'donor_app', now=self.at(self.case, 3))
        self.case.refresh_from_db()
        self.assertEqual(self.case.status, CaseStatus.VOLUNTEERS_SECURED)
        self.assertEqual(self.case.remaining_coordination_need, 0)
        batches = self.case.batches.count()
        service.evaluate(self.case.pk, now=self.at(self.case, 30))
        self.assertEqual(self.case.batches.count(), batches)
        self.assertFalse(self.case.is_terminal)

    def test_volunteer_withdrawing_reopens_the_need(self):
        first, *rest = self.attempts()
        for a in [first] + rest[:3]:
            service.record_response(a.pk, AttemptStatus.ACCEPTED, 'donor_app', now=self.at(self.case, 3))
        service.record_response(first.pk, AttemptStatus.DECLINED, 'donor_app', now=self.at(self.case, 4))
        self.case.refresh_from_db()
        self.assertEqual(self.case.remaining_coordination_need, 1)
        self.assertNotEqual(self.case.status, CaseStatus.VOLUNTEERS_SECURED)
        self.assertTrue(self.case.events.filter(event_type=EventType.NEED_REOPENED).exists() or
                        self.case.status == CaseStatus.COLLECTING_RESPONSES)

    def test_accept_then_hospital_deferral_reopens_need_and_confirmed_donations_resolve(self):
        a, b = self.attempts()[:2]
        service.record_response(a.pk, AttemptStatus.ACCEPTED, 'donor_app', now=self.at(self.case, 2))
        service.set_fulfilment(a.pk, Fulfilment.VERIFICATION_PENDING, self.admin, now=self.at(self.case, 3))
        service.set_fulfilment(a.pk, Fulfilment.NOT_DONATED, self.admin, now=self.at(self.case, 4))
        self.case.refresh_from_db()
        self.assertEqual(self.case.remaining_coordination_need, 4)
        service.record_response(b.pk, AttemptStatus.ACCEPTED, 'donor_app', now=self.at(self.case, 5))
        service.set_fulfilment(b.pk, Fulfilment.DONATION_CONFIRMED, self.admin, now=self.at(self.case, 6))
        self.case.refresh_from_db()
        self.assertFalse(self.case.is_terminal)           # 1 of 2 units confirmed
        c = self.attempts()[2]
        service.record_response(c.pk, AttemptStatus.ACCEPTED, 'donor_app', now=self.at(self.case, 7))
        service.set_fulfilment(c.pk, Fulfilment.DONATION_CONFIRMED, self.admin, now=self.at(self.case, 8))
        self.case.refresh_from_db()
        self.assertEqual(self.case.status, CaseStatus.RESOLVED)

    def test_only_accepted_volunteers_can_enter_hospital_verification(self):
        a = self.attempts()[0]
        with self.assertRaises(EscalationError):
            service.set_fulfilment(a.pk, Fulfilment.VERIFICATION_PENDING, self.admin)


class EscalationTests(EngineTestBase):
    def test_silent_initial_area_expands_search_after_window_and_logs_it(self):
        populate_pool(near=5, mid=8, far=8)
        _, case = self.start()
        first_batch_ids = set(case.attempts.values_list('donor_id', flat=True))
        for minute in (2, 4, 6, 8):
            service.evaluate(case.pk, now=self.at(case, minute))
        self.assertEqual(case.batches.filter(stage_index__gte=1).count(), 0)      # still waiting inside the window
        service.evaluate(case.pk, now=self.at(case, 12))                          # window elapsed
        case.refresh_from_db()
        self.assertGreaterEqual(case.current_stage_index, 1)
        self.assertTrue(case.events.filter(event_type=EventType.ESCALATION_TRIGGERED).exists())
        expansion = case.events.get(event_type=EventType.SEARCH_EXPANDED)
        self.assertEqual((expansion.previous_stage, expansion.new_stage), (0, case.current_stage_index))
        expanded_ids = set(case.attempts.filter(batch__stage_index__gte=1).values_list('donor_id', flat=True))
        self.assertTrue(expanded_ids)
        self.assertFalse(expanded_ids & first_batch_ids)

    def test_expansion_waits_for_approval_when_policy_requires_it(self):
        from escalation.models import EscalationPolicy
        row = EscalationPolicy.active()
        row.config = {**row.config, 'auto_escalate': False}
        row.save()
        populate_pool(near=3, mid=6, far=0)
        _, case = self.start()
        service.evaluate(case.pk, now=self.at(case, 12))
        case.refresh_from_db()
        self.assertEqual(case.status, CaseStatus.AWAITING_ESCALATION)
        self.assertEqual(case.batches.count(), 1)
        service.approve_escalation(case.pk, self.admin, now=self.at(case, 13))
        case.refresh_from_db()
        self.assertEqual(case.batches.count(), 2)
        self.assertEqual(case.status, CaseStatus.COLLECTING_RESPONSES)

    def test_exhausting_every_candidate_requires_administrator_intervention(self):
        populate_pool(near=2, mid=1, far=1)
        _, case = self.start()
        for minute in range(2, 60, 2):
            service.evaluate(case.pk, now=self.at(case, minute))
        case.refresh_from_db()
        self.assertEqual(case.status, CaseStatus.NEEDS_ADMIN_INTERVENTION)
        self.assertEqual(case.attempts.count(), 4)

    def test_partial_response_keeps_request_unresolved(self):
        populate_pool(near=8, mid=8, far=0)
        _, case = self.start()
        first = case.attempts.order_by('rank_position').first()
        service.record_response(first.pk, AttemptStatus.ACCEPTED, 'donor_app', now=self.at(case, 2))
        service.evaluate(case.pk, now=self.at(case, 12))
        case.refresh_from_db()
        self.assertEqual(case.remaining_coordination_need, 3)
        self.assertNotIn(case.status, (CaseStatus.VOLUNTEERS_SECURED, CaseStatus.RESOLVED))


class ClosureTests(EngineTestBase):
    def test_cancelled_request_stops_all_further_outreach(self):
        populate_pool()
        req, case = self.start()
        batches = case.batches.count()
        req.request_status = RequestStatus.CANCELLED
        req.save()
        result = service.evaluate(case.pk, now=self.at(case, 20))
        case.refresh_from_db()
        self.assertEqual(case.status, CaseStatus.CANCELLED)
        self.assertEqual(case.batches.count(), batches)
        self.assertEqual(case.attempts.filter(status__in=[AttemptStatus.ALERTED, AttemptStatus.VIEWED]).count(), 0)
        service.evaluate(case.pk, now=self.at(case, 40))
        self.assertEqual(case.batches.count(), batches)
        self.assertTrue(case.events.filter(event_type=EventType.REQUEST_CANCELLED).exists())

    def test_cancel_through_service_syncs_request_and_notifies_donors(self):
        populate_pool(near=3, mid=0, far=0)
        req, case = self.start()
        service.cancel(case.pk, self.admin, 'Hospital no longer needs blood.')
        req.refresh_from_db(), case.refresh_from_db()
        self.assertEqual(req.request_status, RequestStatus.CANCELLED)
        self.assertEqual(case.status, CaseStatus.CANCELLED)
        self.assertTrue(Notification.objects.filter(title__contains='was cancelled').exists())

    def test_late_response_after_cancellation_is_recorded_but_generates_nothing(self):
        make_donor(1, 'Adyar', 'O+')
        make_donor(2, 'Adyar', 'O+')
        _, case = self.start()
        service.evaluate(case.pk, now=self.at(case, 11))       # alerts lapse to NO_RESPONSE
        lapsed = case.attempts.first()
        service.cancel(case.pk, self.admin, 'cancel')
        lapsed.refresh_from_db()
        res = service.record_response(lapsed.pk, AttemptStatus.ACCEPTED, 'donor_app')
        self.assertTrue(res.changed)                            # recorded for the audit trail ...
        self.assertTrue(case.events.filter(event_type=EventType.LATE_RESPONSE).exists())
        case.refresh_from_db()
        self.assertEqual(case.status, CaseStatus.CANCELLED)     # ... but nothing is reopened or generated
        self.assertEqual(case.batches.count(), 1)

    def test_alerts_still_pending_at_cancellation_are_withdrawn_and_cannot_be_answered(self):
        make_donor(1, 'Adyar', 'O+')
        _, case = self.start()
        pending = case.attempts.get()
        service.cancel(case.pk, self.admin, 'cancel')
        pending.refresh_from_db()
        self.assertEqual(pending.status, AttemptStatus.WITHDRAWN)
        self.assertFalse(service.record_response(pending.pk, AttemptStatus.ACCEPTED, 'donor_app').changed)

    def test_expired_request_is_closed_and_stops_outreach(self):
        populate_pool()
        req, case = self.start(hours=1)
        batches = case.batches.count()
        service.evaluate(case.pk, now=case.expires_at + timedelta(minutes=1))
        case.refresh_from_db(), req.refresh_from_db()
        self.assertEqual(case.status, CaseStatus.EXPIRED)
        self.assertEqual(req.request_status, RequestStatus.CLOSED)
        self.assertEqual(case.batches.count(), batches)
        self.assertTrue(Notification.objects.filter(recipient=self.requester, title__contains='expired').exists())
        service.evaluate(case.pk, now=case.expires_at + timedelta(hours=1))
        self.assertEqual(case.batches.count(), batches)

    def test_fulfilled_request_resolves_the_case(self):
        make_donor(1, 'Adyar', 'O+')
        req, case = self.start()
        req.request_status = RequestStatus.FULFILLED
        req.save()
        service.evaluate(case.pk)
        case.refresh_from_db()
        self.assertEqual(case.status, CaseStatus.RESOLVED)

    def test_resolve_requires_a_note_and_cannot_repeat(self):
        make_donor(1, 'Adyar', 'O+')
        _, case = self.start()
        with self.assertRaises(EscalationError):
            service.resolve(case.pk, self.admin, '  ')
        service.resolve(case.pk, self.admin, 'Hospital blood bank confirmed supply.')
        with self.assertRaises(EscalationError):
            service.resolve(case.pk, self.admin, 'again')

    def test_starting_twice_is_idempotent(self):
        populate_pool(near=4, mid=0, far=0)
        req, case = self.start()
        again = service.start_case_for_request(req)
        self.assertEqual(again.pk, case.pk)
        self.assertEqual(EmergencyCase.objects.filter(blood_request=req).count(), 1)

    def test_expired_or_invalid_requests_cannot_start(self):
        past = make_request(self.requester, hours=-3)
        with self.assertRaises(EscalationError):
            service.start_case_for_request(past)
        bad = make_request(self.requester, units=0)
        with self.assertRaises(EscalationError):
            service.start_case_for_request(bad)

    def test_existing_broadcast_alerts_are_imported_not_repeated(self):
        from matching.services import run_donor_matching
        populate_pool(near=3, mid=0, far=0)
        req = make_request(self.requester)
        run_donor_matching(req)                                  # legacy behaviour
        legacy = DonorMatch.objects.filter(blood_request=req).count()
        case = service.start_case_for_request(req)
        self.assertEqual(case.attempts.count(), legacy)
        self.assertEqual(DonorMatch.objects.filter(blood_request=req).count(), legacy)
        self.assertEqual(Notification.objects.filter(related_request=req, notification_type='EMERGENCY_ALERT').count(), legacy)
        self.assertEqual(case.batches.first().trigger, 'LEGACY_IMPORT')
