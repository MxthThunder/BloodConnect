"""HTTP-level behaviour: permissions, validation, and integration with the pre-existing workflows."""
from datetime import timedelta

from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient

from accounts.models import User, UserRole
from audit.models import AuditLog
from blood_requests.models import BloodRequest, RequestStatus, VerificationStatus
from donors.models import DonorProfile
from escalation.constants import AttemptStatus, CaseStatus
from escalation.models import EmergencyCase, EscalationPolicy
from escalation.service import service
from matching.models import AlertStatus, DonorMatch

from .helpers import FAST_HASH, make_donor, make_request, make_user, populate_pool


def emergency_payload(**over):
    data = {
        'blood_group': 'O+', 'component': 'Whole Blood', 'units_requested': 2,
        'hospital_name': 'Test Hospital Adyar', 'hospital_address': '1 Test Road, Adyar', 'city': 'Chennai',
        'locality': 'Adyar', 'hospital_lat': 13.0012, 'hospital_lng': 80.2565, 'urgency': 'CRITICAL',
        'required_by': (timezone.now() + timedelta(hours=2)).isoformat(), 'contact_phone': '9000000000',
        'reason': 'Surgery standby', 'contact_preference': 'phone',
    }
    data.update(over)
    return data


@FAST_HASH
class ApiBase(TestCase):
    def setUp(self):
        self.admin = make_user('admin@test.org', UserRole.ADMIN)
        self.requester = make_user('req@test.org', UserRole.REQUESTER)
        self.donor_user = make_user('someone@test.org', UserRole.DONOR)
        self.api = APIClient()
        self.api.force_authenticate(self.admin)

    def as_user(self, user):
        client = APIClient()
        if user:
            client.force_authenticate(user)
        return client


class CreateEmergencyTests(ApiBase):
    def test_admin_creates_valid_emergency_and_engine_starts(self):
        populate_pool(near=6, mid=3, far=0)
        res = self.api.post('/api/escalation/emergencies/', emergency_payload(), format='json')
        self.assertEqual(res.status_code, 201, res.data)
        case = res.data['case']
        self.assertEqual(case['status'], 'COLLECTING_RESPONSES')
        self.assertEqual(case['target_volunteers'], 4)
        self.assertGreater(case['counts']['outreach_attempts'], 0)
        req = BloodRequest.objects.get(pk=res.data['request']['id'])
        self.assertEqual(req.verification_status, VerificationStatus.APPROVED)
        self.assertTrue(AuditLog.objects.filter(action='ESCALATION_STARTED').exists())

    def test_invalid_requests_are_rejected(self):
        bad = [
            emergency_payload(units_requested=0),
            emergency_payload(units_requested=99),
            emergency_payload(blood_group='Z+'),
            emergency_payload(hospital_name=''),
            emergency_payload(urgency='WHENEVER'),
            emergency_payload(required_by=(timezone.now() - timedelta(hours=1)).isoformat()),
            emergency_payload(required_by=(timezone.now() + timedelta(days=30)).isoformat()),
        ]
        for payload in bad:
            res = self.api.post('/api/escalation/emergencies/', payload, format='json')
            self.assertEqual(res.status_code, 400, payload)
        self.assertEqual(BloodRequest.objects.count(), 0)
        self.assertEqual(EmergencyCase.objects.count(), 0)

    def test_starting_coordination_twice_returns_the_same_case(self):
        populate_pool(near=3, mid=0, far=0)
        req = make_request(self.requester)
        a = self.api.post('/api/escalation/cases/', {'blood_request': req.pk}, format='json')
        b = self.api.post('/api/escalation/cases/', {'blood_request': req.pk}, format='json')
        self.assertEqual((a.status_code, b.status_code), (201, 200))
        self.assertEqual(a.data['id'], b.data['id'])
        self.assertEqual(EmergencyCase.objects.count(), 1)

    def test_unapproved_request_cannot_enter_coordination(self):
        req = make_request(self.requester, approved=False)
        res = self.api.post('/api/escalation/cases/', {'blood_request': req.pk}, format='json')
        self.assertEqual(res.status_code, 400)


class PermissionTests(ApiBase):
    def test_only_administrators_can_use_escalation_endpoints(self):
        populate_pool(near=3, mid=0, far=0)
        case = service.start_case_for_request(make_request(self.requester))
        urls = [
            ('get', '/api/escalation/overview/'), ('get', f'/api/escalation/cases/{case.pk}/'),
            ('get', f'/api/escalation/cases/{case.pk}/candidates/'), ('post', f'/api/escalation/cases/{case.pk}/evaluate/'),
            ('post', f'/api/escalation/cases/{case.pk}/cancel/'), ('post', f'/api/escalation/cases/{case.pk}/assistant/'),
            ('get', '/api/escalation/policy/'), ('put', '/api/escalation/policy/'),
            ('post', '/api/escalation/simulations/'), ('post', '/api/escalation/experiments/'),
            ('post', '/api/escalation/emergencies/'), ('post', '/api/escalation/simulations/purge/'),
        ]
        for user, expected in ((self.donor_user, 403), (self.requester, 403), (None, 401)):
            client = self.as_user(user)
            for method, url in urls:
                res = getattr(client, method)(url, {}, format='json')
                self.assertEqual(res.status_code, expected, f'{user} {method} {url}')
        case.refresh_from_db()
        self.assertEqual(case.status, CaseStatus.COLLECTING_RESPONSES)

    def test_responses_never_expose_contact_details(self):
        d = make_donor(1, 'Adyar', 'O+')
        d.user.phone = '+91 99999 00000'
        d.user.save()
        case = service.start_case_for_request(make_request(self.requester))
        body = ''.join(self.api.get(f'/api/escalation/cases/{case.pk}/{part}').content.decode()
                       for part in ('', 'candidates/', 'timeline/', 'map/'))
        self.assertNotIn('99999', body)
        self.assertNotIn('donor1@test.org', body)
        self.assertNotIn('Person1', body)          # last name is reduced to an initial


class PolicyApiTests(ApiBase):
    def test_policy_is_configurable_validated_and_audited(self):
        cfg = self.api.get('/api/escalation/policy/').data['config']
        cfg['stages'][0]['radius_km'] = 3
        cfg['response_wait_minutes']['CRITICAL'] = 7
        res = self.api.put('/api/escalation/policy/', {'config': cfg}, format='json')
        self.assertEqual(res.status_code, 200)
        self.assertEqual(EscalationPolicy.active_policy().wait_minutes('CRITICAL'), 7)
        self.assertTrue(AuditLog.objects.filter(action='ESCALATION_POLICY_UPDATED').exists())
        for broken in (
            {**cfg, 'stages': [{'name': 'a', 'radius_km': 10, 'fallback_scope': 'CITY', 'max_batch_size': 5},
                               {'name': 'b', 'radius_km': 5, 'fallback_scope': 'CITY', 'max_batch_size': 5}]},
            {**cfg, 'assumed_response_rate': 5},
            {**cfg, 'weights': {'proximity': 0, 'group_match': 0, 'verified_profile': 0, 'availability_freshness': 0}},
            {**cfg, 'unknown_setting': 1},
        ):
            self.assertEqual(self.api.put('/api/escalation/policy/', {'config': broken}, format='json').status_code, 400)
        self.assertEqual(EscalationPolicy.active_policy().wait_minutes('CRITICAL'), 7)

    def test_changed_threshold_changes_engine_behaviour(self):
        populate_pool(near=12, mid=0, far=0)
        cfg = self.api.get('/api/escalation/policy/').data['config']
        cfg['stages'][0]['max_batch_size'] = 3
        self.api.put('/api/escalation/policy/', {'config': cfg}, format='json')
        case = service.start_case_for_request(make_request(self.requester))
        self.assertEqual(case.attempts.count(), 3)


class ExistingWorkflowIntegrationTests(ApiBase):
    """The pre-existing registration -> request -> approve -> respond flow keeps working."""

    def test_full_legacy_flow_now_runs_through_the_engine(self):
        client = APIClient()
        res = client.post('/api/auth/register/', {
            'email': 'newdonor@test.org', 'password': 'Password@123', 'first_name': 'Newly', 'last_name': 'Registered',
            'role': 'donor', 'phone': '9876543210', 'city': 'Chennai', 'locality': 'Adyar', 'blood_group': 'O+',
            'approx_latitude': 13.0, 'approx_longitude': 80.25}, format='json')
        self.assertEqual(res.status_code, 201, res.data)
        donor_user = User.objects.get(email='newdonor@test.org')
        self.assertTrue(DonorProfile.objects.filter(user=donor_user).exists())

        self.api.force_authenticate(self.requester)
        res = self.api.post('/api/requests/', emergency_payload(), format='json')
        self.assertEqual(res.status_code, 201, res.data)
        req_id = res.data['id']

        self.api.force_authenticate(self.admin)
        res = self.api.post(f'/api/requests/{req_id}/verify/', {'action': 'APPROVE', 'notes': 'ok'}, format='json')
        self.assertEqual(res.status_code, 200, res.data)
        self.assertGreaterEqual(res.data['matches_count'], 1)
        case = EmergencyCase.objects.get(blood_request_id=req_id)
        self.assertEqual(case.status, CaseStatus.COLLECTING_RESPONSES)

        donor_client = self.as_user(donor_user)
        alerts = donor_client.get('/api/matching/donor-alerts/').data
        alerts = alerts['results'] if isinstance(alerts, dict) else alerts
        self.assertEqual(len(alerts), 1)
        match_id = alerts[0]['id']
        donor_client.get(f'/api/matching/donor-alerts/{match_id}/')
        attempt = case.attempts.get()
        attempt.refresh_from_db()
        self.assertEqual(attempt.status, AttemptStatus.VIEWED)

        res = donor_client.post(f'/api/matching/donor-alerts/{match_id}/respond/',
                                {'response': 'ACCEPTED', 'message': 'On my way'}, format='json')
        self.assertEqual(res.status_code, 200)
        attempt.refresh_from_db()
        case.refresh_from_db()
        self.assertEqual(attempt.status, AttemptStatus.ACCEPTED)
        self.assertEqual(attempt.response_source, 'donor_app')
        self.assertEqual(case.remaining_coordination_need, 3)
        self.assertNotEqual(case.status, CaseStatus.RESOLVED)

        # repeated API call is harmless
        again = donor_client.post(f'/api/matching/donor-alerts/{match_id}/respond/', {'response': 'ACCEPTED'}, format='json')
        self.assertEqual(again.status_code, 200)
        case.refresh_from_db()
        self.assertEqual(case.remaining_coordination_need, 3)
        self.assertEqual(case.events.filter(event_type='CANDIDATE_ACCEPTED').count(), 1)

    def test_donor_decline_through_existing_endpoint_is_tracked(self):
        populate_pool(near=3, mid=0, far=0)
        req = make_request(self.requester)
        case = service.start_case_for_request(req)
        attempt = case.attempts.first()
        client = self.as_user(attempt.donor.user)
        res = client.post(f'/api/matching/donor-alerts/{attempt.donor_match_id}/respond/',
                          {'response': 'DECLINED'}, format='json')
        self.assertEqual(res.status_code, 200)
        attempt.refresh_from_db()
        self.assertEqual(attempt.status, AttemptStatus.DECLINED)

    def test_cancelling_through_existing_endpoint_stops_the_engine(self):
        populate_pool()
        req = make_request(self.requester)
        case = service.start_case_for_request(req)
        res = self.as_user(self.requester).post(f'/api/requests/{req.pk}/cancel/')
        self.assertEqual(res.status_code, 200)
        case.refresh_from_db()
        self.assertEqual(case.status, CaseStatus.CANCELLED)
        batches = case.batches.count()
        res = self.api.post(f'/api/escalation/cases/{case.pk}/evaluate/')
        self.assertEqual(res.status_code, 200)
        self.assertEqual(case.batches.count(), batches)
        res = self.api.post(f'/api/escalation/cases/{case.pk}/escalate/')
        self.assertEqual(res.status_code, 409)

    def test_approving_an_already_expired_request_is_rejected(self):
        req = make_request(self.requester, approved=False, hours=-5)
        res = self.api.post(f'/api/requests/{req.pk}/verify/', {'action': 'APPROVE'}, format='json')
        self.assertEqual(res.status_code, 400)
        req.refresh_from_db()
        self.assertEqual(req.verification_status, VerificationStatus.PENDING)

    def test_fulfilling_through_existing_endpoint_resolves_the_case(self):
        populate_pool(near=3, mid=0, far=0)
        req = make_request(self.requester)
        case = service.start_case_for_request(req)
        self.api.post(f'/api/requests/{req.pk}/fulfill/', {'notes': 'done'}, format='json')
        case.refresh_from_db()
        self.assertEqual(case.status, CaseStatus.RESOLVED)

    def test_rematch_on_approved_request_goes_through_the_engine_without_duplicates(self):
        populate_pool(near=4, mid=0, far=0)
        req = make_request(self.requester)
        res = self.api.post(f'/api/requests/{req.pk}/rematch/')
        self.assertEqual(res.status_code, 200)
        first = res.data['matches_count']
        res = self.api.post(f'/api/requests/{req.pk}/rematch/')
        self.assertEqual(res.status_code, 200)
        case = EmergencyCase.objects.get(blood_request=req)
        ids = list(case.attempts.values_list('donor_id', flat=True))
        self.assertEqual(len(ids), len(set(ids)))
        self.assertGreaterEqual(res.data['matches_count'], first)


class CaseEndpointTests(ApiBase):
    def setUp(self):
        super().setUp()
        populate_pool(near=10, mid=8, far=8)
        self.case = service.start_case_for_request(make_request(self.requester))

    def test_candidates_are_paginated_and_explained(self):
        res = self.api.get(f'/api/escalation/cases/{self.case.pk}/candidates/?view=all&page_size=5')
        self.assertEqual(res.status_code, 200)
        self.assertEqual(len(res.data['results']), 5)
        self.assertGreater(res.data['count'], 5)
        row = res.data['results'][0]
        self.assertTrue(row['explanation'].startswith('Prioritised because'))
        self.assertIn('breakdown', row)
        self.assertIn(row['status'], ('ALERT_SENT',))
        eligible = self.api.get(f'/api/escalation/cases/{self.case.pk}/candidates/?view=eligible').data
        self.assertTrue(all(r['status'] == 'POTENTIAL' and not r['contacted'] for r in eligible['results']))
        self.assertEqual(self.api.get(f'/api/escalation/cases/{self.case.pk}/candidates/?view=bogus').status_code, 400)

    def test_excluded_view_lists_reasons(self):
        make_donor(90, 'Adyar', 'O+', consent=False)
        make_donor(91, 'Adyar', 'O+', available=False)
        res = self.api.get(f'/api/escalation/cases/{self.case.pk}/candidates/?view=excluded&page_size=50').data
        codes = {r['exclusion_code'] for r in res['results']}
        self.assertTrue({'NO_CONSENT', 'UNAVAILABLE'} <= codes)

    def test_unknown_distance_is_reported_as_null_not_invented(self):
        make_donor(92, 'Adyar', 'O+', coords=False)
        res = self.api.get(f'/api/escalation/cases/{self.case.pk}/candidates/?view=all&page_size=100').data
        row = next(r for r in res['results'] if r['display_name'].startswith('Test P') and r['distance_km'] is None)
        self.assertIsNone(row['distance_km'])

    def test_timeline_records_the_decision_trail(self):
        types = [e['type'] for e in self.api.get(f'/api/escalation/cases/{self.case.pk}/timeline/').data['results']]
        for expected in ('REQUEST_CREATED', 'REQUEST_VALIDATED', 'CASE_STARTED', 'CANDIDATES_RANKED', 'BATCH_CREATED',
                         'OUTREACH_INITIATED'):
            self.assertIn(expected, types)

    def test_admin_actions_are_functional_and_audited(self):
        pk = self.case.pk
        self.assertEqual(self.api.post(f'/api/escalation/cases/{pk}/evaluate/').status_code, 200)
        self.assertEqual(self.api.post(f'/api/escalation/cases/{pk}/review/', {'note': 'looks right'}, format='json').status_code, 200)
        self.assertTrue(self.case.events.filter(event_type='ADMIN_REVIEWED').exists())
        att = self.case.attempts.first()
        res = self.api.post(f'/api/escalation/attempts/{att.pk}/respond/', {'response': 'ACCEPTED'}, format='json')
        self.assertEqual(res.status_code, 200)
        self.assertTrue(res.data['changed'])
        att.refresh_from_db()
        self.assertEqual(att.response_source, 'admin')
        self.assertEqual(att.donor_match.alert_status, AlertStatus.ACCEPTED)
        res = self.api.post(f'/api/escalation/attempts/{att.pk}/fulfilment/', {'stage': 'VERIFICATION_PENDING'}, format='json')
        self.assertEqual(res.status_code, 200)
        self.assertEqual(self.api.post(f'/api/escalation/cases/{pk}/resolve/', {'note': ''}, format='json').status_code, 400)
        self.assertEqual(self.api.post(f'/api/escalation/cases/{pk}/resolve/', {'note': 'Hospital confirmed'}, format='json').status_code, 200)
        self.assertEqual(self.api.post(f'/api/escalation/cases/{pk}/cancel/').status_code, 409)
        actions = set(AuditLog.objects.values_list('action', flat=True))
        for a in ('ESCALATION_EVALUATED', 'ESCALATION_REVIEWED', 'ESCALATION_RESPONSE_RECORDED',
                  'ESCALATION_FULFILMENT', 'ESCALATION_RESOLVED'):
            self.assertIn(a, actions)

    def test_overview_reports_real_data_and_labels_metrics_accurately(self):
        res = self.api.get('/api/escalation/overview/').data
        self.assertEqual(res['kpis']['active_emergencies'], 1)
        c = res['cases'][0]
        self.assertIn('accepted_volunteers', c['counts'])
        self.assertIn('remaining_coordination_need', c)
        self.assertNotIn('units_confirmed', c)
        self.assertTrue(res['markers'])

    def test_map_payload_never_invents_coordinates(self):
        make_donor(93, 'Adyar', 'O+', coords=False)
        data = self.api.get(f'/api/escalation/cases/{self.case.pk}/map/').data
        self.assertTrue(all(round(p['lat'], 2) == p['lat'] for p in data['candidates']))
        self.assertEqual(sum(u['count'] for u in data['unplaced_by_locality']), 1)   # shown by locality only
        self.assertTrue(all(p['approximate'] for p in data['candidates']))

    def test_cancel_endpoint_stops_outreach(self):
        res = self.api.post(f'/api/escalation/cases/{self.case.pk}/cancel/', {'reason': 'Patient stable'}, format='json')
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.data['status'], 'CANCELLED')
        self.case.blood_request.refresh_from_db()
        self.assertEqual(self.case.blood_request.request_status, RequestStatus.CANCELLED)
