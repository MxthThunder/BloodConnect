from datetime import timedelta

from django.core.management import call_command
from django.db import IntegrityError, transaction
from django.test import TestCase
from django.utils import timezone

from accounts.models import UserRole
from audit.models import AuditLog
from camps.constants import CampStatus as S, PartnerStatus as P
from camps.models import CampApplication, CampInterest
from notifications.models import Notification

from .helpers import FAST_HASH, client_for, make_app, make_bank, make_user, payload

API = '/api/camps/'
PRIVATE_MARKERS = ['organiser-contact@test.org', '+91 90000 00001', 'Test Person', 'INTERNAL-SECRET']


@FAST_HASH
class Base(TestCase):
    def setUp(self):
        self.admin = make_user('admin@test.org', UserRole.ADMIN)
        self.org = make_user('org@test.org', UserRole.ORGANISER, first_name='Org')
        self.org2 = make_user('org2@test.org', UserRole.ORGANISER)
        self.donor = make_user('donor@test.org', UserRole.DONOR)
        self.requester = make_user('req@test.org', UserRole.REQUESTER)
        self.bank = make_bank()
        self.anon = client_for()
        self.admin_c, self.org_c, self.org2_c = client_for(self.admin), client_for(self.org), client_for(self.org2)
        self.donor_c, self.req_c = client_for(self.donor), client_for(self.requester)

    def act(self, app, action, **body):
        return self.admin_c.post(f'{API}applications/{app.pk}/action/', {'action': action, **body}, format='json')

    def confirm_partner(self, app, **extra):
        body = {'partner_status': 'CONFIRMED', 'partner_id': self.bank.pk, 'partner_support': ['MEDICAL_PERSONNEL', 'DONOR_SCREENING']}
        body.update(extra)
        return self.act(app, 'partner', **body)


class RegistrationTests(Base):
    def test_cannot_self_register_as_administrator(self):
        r = self.anon.post('/api/auth/register/', {
            'email': 'sneaky@test.org', 'password': 'Password@123', 'first_name': 'S', 'role': 'admin',
            'city': 'Chennai', 'locality': 'Adyar'}, format='json')
        self.assertEqual(r.status_code, 400)
        self.assertIn('role', r.json())

    def test_can_register_as_organiser(self):
        r = self.anon.post('/api/auth/register/', {
            'email': 'neworg@test.org', 'password': 'Password@123', 'first_name': 'N', 'role': 'organiser',
            'city': 'Chennai', 'locality': 'Adyar'}, format='json')
        self.assertEqual(r.status_code, 201)
        self.assertEqual(r.json()['user']['role'], 'organiser')


class SubmissionTests(Base):
    def test_organiser_submits_an_application(self):
        r = self.org_c.post(f'{API}applications/', payload(), format='json')
        self.assertEqual(r.status_code, 201, r.content)
        body = r.json()
        self.assertEqual(body['status'], S.SUBMITTED)
        self.assertEqual(body['progress'][0]['state'], 'current')
        self.assertEqual(body['events'][0]['kind'], 'SUBMITTED')
        self.assertTrue(body['can_edit'] and body['can_cancel'])
        self.assertTrue(Notification.objects.filter(recipient=self.admin, action_url__contains='/admin-portal/camps/').exists())
        self.assertTrue(AuditLog.objects.filter(action='CAMP_SUBMITTED').exists())

    def test_only_organisers_can_submit(self):
        for client in (self.donor_c, self.req_c, self.admin_c):
            self.assertEqual(client.post(f'{API}applications/', payload(), format='json').status_code, 403)
        self.assertEqual(self.anon.post(f'{API}applications/', payload(), format='json').status_code, 401)

    def test_validation_rejects_bad_input(self):
        today = timezone.localdate()
        bad = [
            ('camp_date', (today + timedelta(days=1)).isoformat()),
            ('camp_date', (today - timedelta(days=1)).isoformat()),
            ('camp_date', (today + timedelta(days=900)).isoformat()),
            ('locality', 'Mumbai'),
            ('contact_phone', 'abc'),
            ('expected_donors', 3),
            ('facilities', ['SEATING', 'JACUZZI']),
            ('organisation_type', 'PIRATES'),
        ]
        for field, value in bad:
            r = self.org_c.post(f'{API}applications/', payload(**{field: value}), format='json')
            self.assertEqual(r.status_code, 400, field)
            self.assertIn(field, r.json()['fields'], field)
        self.assertEqual(CampApplication.objects.count(), 0)

    def test_end_time_must_follow_start_time(self):
        r = self.org_c.post(f'{API}applications/', payload(start_time='15:00', end_time='09:00'), format='json')
        self.assertEqual(r.status_code, 400)
        self.assertIn('end_time', r.json()['fields'])

    def test_coordinates_must_be_a_pair_inside_chennai(self):
        for extra in ({'latitude': 13.0}, {'latitude': 28.6, 'longitude': 77.2}):
            self.assertEqual(self.org_c.post(f'{API}applications/', payload(**extra), format='json').status_code, 400)
        ok = self.org_c.post(f'{API}applications/', payload(latitude=13.01, longitude=80.25), format='json')
        self.assertEqual(ok.status_code, 201)
        self.assertFalse(ok.json()['location_approximate'])

    def test_missing_coordinates_fall_back_to_an_approximate_locality_point(self):
        body = self.org_c.post(f'{API}applications/', payload(), format='json').json()
        self.assertTrue(body['location_approximate'])
        self.assertIsNotNone(body['latitude'])


class OrganiserVisibilityTests(Base):
    def test_organiser_only_sees_their_own_applications(self):
        mine, theirs = make_app(self.org), make_app(self.org2)
        ids = [a['id'] for a in self.org_c.get(f'{API}applications/').json()['results']]
        self.assertEqual(ids, [mine.pk])
        self.assertEqual(self.org_c.get(f'{API}applications/{theirs.pk}/').status_code, 404)
        self.assertEqual(self.org_c.patch(f'{API}applications/{theirs.pk}/', {'title': 'x'}, format='json').status_code, 404)
        self.assertEqual(self.org_c.post(f'{API}applications/{theirs.pk}/cancel/', {}, format='json').status_code, 404)

    def test_donor_and_requester_cannot_read_applications(self):
        app = make_app(self.org)
        for client in (self.donor_c, self.req_c):
            self.assertEqual(client.get(f'{API}applications/').status_code, 403)
            self.assertEqual(client.get(f'{API}applications/{app.pk}/').status_code, 403)

    def test_organiser_never_sees_internal_notes_or_unconfirmed_partner(self):
        app = make_app(self.org, S.PARTNER_COORDINATION, partner_status=P.CONTACTED, bank=self.bank,
                       admin_notes='INTERNAL-SECRET', partner_notes='INTERNAL-SECRET')
        self.act(app, 'note', message='INTERNAL-SECRET follow-up')
        text = self.org_c.get(f'{API}applications/{app.pk}/').content.decode()
        self.assertNotIn('INTERNAL-SECRET', text)
        self.assertNotIn(self.bank.name, text)
        body = self.org_c.get(f'{API}applications/{app.pk}/').json()
        self.assertFalse(body['medical_support']['confirmed'])
        self.assertIn('No medical support is confirmed', body['medical_support']['message'])

    def test_administrator_sees_everything(self):
        app = make_app(self.org, S.PARTNER_COORDINATION, partner_status=P.CONTACTED, bank=self.bank, admin_notes='INTERNAL-SECRET')
        body = self.admin_c.get(f'{API}applications/{app.pk}/').json()
        self.assertEqual(body['admin_notes'], 'INTERNAL-SECRET')
        self.assertEqual(body['organiser']['email'], 'org@test.org')
        self.assertEqual(body['partner_name'], self.bank.name)

    def test_edit_allowed_only_before_review(self):
        app = make_app(self.org)
        r = self.org_c.patch(f'{API}applications/{app.pk}/', {'title': 'New title', 'expected_donors': 250}, format='json')
        self.assertEqual(r.status_code, 200, r.content)
        app.refresh_from_db()
        self.assertEqual((app.title, app.expected_donors), ('New title', 250))
        self.act(app, 'start_review')
        locked = self.org_c.patch(f'{API}applications/{app.pk}/', {'title': 'Too late'}, format='json')
        self.assertEqual(locked.status_code, 409)

    def test_edit_cannot_make_end_before_start(self):
        app = make_app(self.org)
        r = self.org_c.patch(f'{API}applications/{app.pk}/', {'end_time': '08:00'}, format='json')
        self.assertEqual(r.status_code, 400)

    def test_organiser_can_cancel_until_the_camp_is_finished(self):
        app = make_app(self.org)
        r = self.org_c.post(f'{API}applications/{app.pk}/cancel/', {'reason': 'Venue unavailable'}, format='json')
        self.assertEqual(r.status_code, 200)
        self.assertEqual(r.json()['status'], S.CANCELLED)
        done = make_app(self.org, S.COMPLETED, days=-3)
        self.assertEqual(self.org_c.post(f'{API}applications/{done.pk}/cancel/', {}, format='json').status_code, 409)


class AdminWorkflowTests(Base):
    def test_full_journey_submit_to_completion(self):
        app = CampApplication.objects.get(pk=self.org_c.post(f'{API}applications/', payload(), format='json').json()['id'])
        self.assertEqual(self.act(app, 'start_review').json()['status'], S.UNDER_REVIEW)

        contacted = self.act(app, 'partner', partner_status='CONTACTED', partner_id=self.bank.pk).json()
        self.assertEqual(contacted['status'], S.PARTNER_COORDINATION)
        self.assertEqual(contacted['partner_status'], P.CONTACTED)
        self.assertTrue(contacted['approval_blockers'])

        blocked = self.act(app, 'approve')
        self.assertEqual(blocked.status_code, 400)
        self.assertEqual(blocked.json()['code'], 'approval_blocked')
        self.assertEqual(self.anon.get(API).json()['count'], 0)

        self.assertEqual(self.confirm_partner(app).status_code, 200)
        approved = self.act(app, 'approve')
        self.assertEqual(approved.status_code, 200, approved.content)
        self.assertEqual(approved.json()['status'], S.APPROVED)
        listing = self.anon.get(API).json()
        self.assertEqual(listing['count'], 1)
        self.assertTrue(listing['results'][0]['medical_support']['confirmed'])
        self.assertEqual(listing['results'][0]['medical_support']['partner'], self.bank.name)

        CampApplication.objects.filter(pk=app.pk).update(camp_date=timezone.localdate())
        done = self.act(app, 'complete', actual_donors=42, notes='Went well')
        self.assertEqual(done.status_code, 200)
        self.assertEqual(done.json()['actual_donors'], 42)
        self.assertEqual(self.anon.get(API).json()['count'], 0)

        titles = list(Notification.objects.filter(recipient=self.org).values_list('title', flat=True))
        for expected in ('under review', 'Medical partner coordination started', 'is approved', 'marked completed'):
            self.assertTrue(any(expected in t for t in titles), expected)
        actions = set(AuditLog.objects.values_list('action', flat=True))
        self.assertTrue({'CAMP_REVIEW_STARTED', 'CAMP_PARTNER_UPDATED', 'CAMP_APPROVED', 'CAMP_COMPLETED'} <= actions)

    def test_approval_cannot_skip_review_or_partner_stage(self):
        for status in (S.SUBMITTED, S.UNDER_REVIEW):
            app = make_app(self.org, status)
            r = self.act(app, 'approve')
            self.assertEqual(r.status_code, 409, status)
            app.refresh_from_db()
            self.assertEqual(app.status, status)

    def test_confirming_needs_a_named_partner_and_support(self):
        app = make_app(self.org, S.UNDER_REVIEW)
        self.assertEqual(self.act(app, 'partner', partner_status='CONFIRMED', partner_support=['MEDICAL_PERSONNEL']).status_code, 400)
        self.assertEqual(self.act(app, 'partner', partner_status='CONFIRMED', partner_id=self.bank.pk).status_code, 400)
        self.assertEqual(self.act(app, 'partner', partner_status='CONFIRMED', partner_name='Team X', partner_support=['MEDICAL_PERSONNEL']).status_code, 200)

    def test_a_declined_partner_keeps_the_camp_unapprovable(self):
        app = make_app(self.org, S.PARTNER_COORDINATION, partner_status=P.CONTACTED, bank=self.bank)
        body = self.act(app, 'partner', partner_status='DECLINED').json()
        self.assertEqual(body['partner_status'], P.DECLINED)
        self.assertEqual(self.act(app, 'approve').status_code, 400)

    def test_unknown_partner_or_support_is_rejected(self):
        app = make_app(self.org, S.UNDER_REVIEW)
        self.assertEqual(self.act(app, 'partner', partner_status='CONTACTED', partner_id=99999).status_code, 400)
        self.assertEqual(self.act(app, 'partner', partner_status='CONFIRMED', partner_id=self.bank.pk, partner_support=['LASERS']).status_code, 400)

    def test_partner_cannot_change_after_approval(self):
        app = make_app(self.org, S.APPROVED, bank=self.bank)
        self.assertEqual(self.act(app, 'partner', partner_status='DECLINED').status_code, 409)

    def test_rejection_needs_a_reason_and_is_final(self):
        app = make_app(self.org, S.UNDER_REVIEW)
        self.assertEqual(self.act(app, 'reject').status_code, 400)
        r = self.act(app, 'reject', reason='No screening room')
        self.assertEqual(r.json()['status'], S.REJECTED)
        self.assertEqual(self.act(app, 'start_review').status_code, 409)
        self.assertIn('No screening room', self.org_c.get(f'{API}applications/{app.pk}/').json()['rejection_reason'])
        stopped = [s for s in self.org_c.get(f'{API}applications/{app.pk}/').json()['progress'] if s['state'] == 'stopped']
        self.assertEqual(len(stopped), 1)

    def test_completion_blocked_before_the_camp_date(self):
        app = make_app(self.org, S.APPROVED, days=5, bank=self.bank)
        self.assertEqual(self.act(app, 'complete').status_code, 400)
        self.assertEqual(self.act(make_app(self.org, S.SUBMITTED), 'complete').status_code, 409)

    def test_completion_validates_the_donor_count(self):
        app = make_app(self.org, S.APPROVED, days=-1, bank=self.bank)
        self.assertEqual(self.act(app, 'complete', actual_donors='lots').status_code, 400)
        self.assertEqual(self.act(app, 'complete', actual_donors=-4).status_code, 400)
        self.assertEqual(self.act(app, 'complete').json()['actual_donors'], None)

    def test_non_admins_cannot_run_workflow_actions(self):
        app = make_app(self.org)
        for client in (self.org_c, self.donor_c, self.req_c, self.anon):
            r = client.post(f'{API}applications/{app.pk}/action/', {'action': 'start_review'}, format='json')
            self.assertIn(r.status_code, (401, 403))
        app.refresh_from_db()
        self.assertEqual(app.status, S.SUBMITTED)

    def test_unknown_action_is_rejected(self):
        self.assertEqual(self.act(make_app(self.org), 'teleport').status_code, 400)

    def test_notes_can_be_internal_or_shared_with_the_organiser(self):
        app = make_app(self.org)
        self.act(app, 'note', message='internal chatter')
        self.assertEqual(self.org_c.get(f'{API}applications/{app.pk}/').json()['events'], [])
        before = Notification.objects.filter(recipient=self.org).count()
        self.act(app, 'note', message='Please share the venue floor plan.', visible_to_organiser=True)
        msgs = [e['message'] for e in self.org_c.get(f'{API}applications/{app.pk}/').json()['events']]
        self.assertIn('Please share the venue floor plan.', msgs)
        self.assertEqual(Notification.objects.filter(recipient=self.org).count(), before + 1)
        self.assertEqual(self.act(app, 'note', message='  ').status_code, 400)

    def test_admin_cancel_requires_reason_and_notifies_the_organiser(self):
        app = make_app(self.org, S.PARTNER_COORDINATION, partner_status=P.CONTACTED, bank=self.bank)
        self.assertEqual(self.admin_c.post(f'{API}applications/{app.pk}/cancel/', {}, format='json').status_code, 400)
        r = self.admin_c.post(f'{API}applications/{app.pk}/cancel/', {'reason': 'Partner unavailable'}, format='json')
        self.assertEqual(r.json()['status'], S.CANCELLED)
        self.assertTrue(Notification.objects.filter(recipient=self.org, title__icontains='cancelled').exists())

    def test_admin_list_has_status_counts_and_filters(self):
        make_app(self.org), make_app(self.org2, S.UNDER_REVIEW), make_app(self.org, S.APPROVED)
        body = self.admin_c.get(f'{API}applications/').json()
        self.assertEqual(body['count'], 3)
        self.assertEqual(body['status_counts'], {S.SUBMITTED: 1, S.UNDER_REVIEW: 1, S.APPROVED: 1})
        only = self.admin_c.get(f'{API}applications/?status=UNDER_REVIEW').json()
        self.assertEqual(only['count'], 1)

    def test_database_refuses_approval_without_a_confirmed_partner(self):
        app = make_app(self.org, S.PARTNER_COORDINATION, partner_status=P.CONTACTED, bank=self.bank)
        with self.assertRaises(IntegrityError), transaction.atomic():
            CampApplication.objects.filter(pk=app.pk).update(status=S.APPROVED)

    def test_database_refuses_a_confirmed_partner_with_no_name(self):
        app = make_app(self.org, S.UNDER_REVIEW)
        with self.assertRaises(IntegrityError), transaction.atomic():
            CampApplication.objects.filter(pk=app.pk).update(partner_status=P.CONFIRMED, partner=None, partner_name='')


class PublicListingTests(Base):
    def setUp(self):
        super().setUp()
        self.adyar = make_app(self.org, S.APPROVED, days=5, locality='Adyar', title='Adyar Drive', bank=self.bank)
        self.tamb = make_app(self.org, S.APPROVED, days=20, locality='Tambaram', title='Tambaram Camp')

    def test_only_approved_upcoming_camps_are_listed(self):
        make_app(self.org, S.SUBMITTED), make_app(self.org, S.UNDER_REVIEW), make_app(self.org, S.PARTNER_COORDINATION, partner_status=P.CONTACTED, bank=self.bank)
        make_app(self.org, S.REJECTED), make_app(self.org, S.CANCELLED), make_app(self.org, S.COMPLETED, days=-5)
        make_app(self.org, S.APPROVED, days=-1, title='Yesterday')
        titles = [c['title'] for c in self.anon.get(API).json()['results']]
        self.assertEqual(titles, ['Adyar Drive', 'Tambaram Camp'])

    def test_public_payload_hides_private_details(self):
        text = self.anon.get(API).content.decode() + self.anon.get(f'{API}{self.adyar.pk}/').content.decode()
        for marker in PRIVATE_MARKERS + ['org@test.org', 'admin_notes', 'partner_notes', 'contact_phone']:
            self.assertNotIn(marker, text)

    def test_search_by_locality_text_and_date(self):
        self.assertEqual([c['title'] for c in self.anon.get(f'{API}?locality=Tambaram').json()['results']], ['Tambaram Camp'])
        self.assertEqual(self.anon.get(f'{API}?q=adyar').json()['count'], 1)
        self.assertEqual(self.anon.get(f'{API}?locality=Guindy').json()['count'], 0)
        cutoff = (timezone.localdate() + timedelta(days=10)).isoformat()
        self.assertEqual(self.anon.get(f'{API}?date_to={cutoff}').json()['count'], 1)
        self.assertEqual(self.anon.get(f'{API}?date_from={cutoff}').json()['count'], 1)
        self.assertEqual(self.anon.get(f'{API}?date_from=garbage').status_code, 400)

    def test_listing_is_ordered_by_date(self):
        dates = [c['camp_date'] for c in self.anon.get(API).json()['results']]
        self.assertEqual(dates, sorted(dates))

    def test_detail_exists_only_for_public_camps(self):
        self.assertEqual(self.anon.get(f'{API}{self.adyar.pk}/').status_code, 200)
        hidden = make_app(self.org, S.UNDER_REVIEW)
        self.assertEqual(self.anon.get(f'{API}{hidden.pk}/').status_code, 404)

    def test_map_points_are_flagged_when_approximate(self):
        row = self.anon.get(f'{API}{self.adyar.pk}/').json()
        self.assertTrue(row['location_approximate'])
        CampApplication.objects.filter(pk=self.adyar.pk).update(latitude=13.0, longitude=80.2)
        row = self.anon.get(f'{API}{self.adyar.pk}/').json()
        self.assertFalse(row['location_approximate'])
        self.assertEqual((row['latitude'], row['longitude']), (13.0, 80.2))

    def test_options_expose_blood_banks_to_admins_only(self):
        self.assertNotIn('blood_banks', self.anon.get(f'{API}options/').json())
        self.assertNotIn('blood_banks', self.org_c.get(f'{API}options/').json())
        self.assertTrue(self.admin_c.get(f'{API}options/').json()['blood_banks'])
        self.assertIn('Adyar', self.anon.get(f'{API}options/').json()['localities'])


class InterestTests(Base):
    def setUp(self):
        super().setUp()
        self.camp = make_app(self.org, S.APPROVED, days=7, bank=self.bank)

    def url(self, camp=None):
        return f'{API}{(camp or self.camp).pk}/interest/'

    def test_sign_in_required(self):
        self.assertEqual(self.anon.post(self.url()).status_code, 401)

    def test_register_is_idempotent_and_counted(self):
        for _ in range(3):
            r = self.donor_c.post(self.url())
            self.assertEqual(r.status_code, 200)
        self.assertEqual(r.json(), {'is_interested': True, 'interest_count': 1})
        self.assertEqual(self.req_c.post(self.url()).json()['interest_count'], 2)
        self.assertEqual(CampInterest.objects.filter(application=self.camp).count(), 2)

    def test_listing_shows_my_interest_and_the_count_only(self):
        self.donor_c.post(self.url())
        mine = self.donor_c.get(API).json()['results'][0]
        self.assertTrue(mine['is_interested'])
        self.assertEqual(mine['interest_count'], 1)
        self.assertFalse(self.anon.get(API).json()['results'][0]['is_interested'])
        self.assertNotIn('donor@test.org', self.anon.get(API).content.decode())

    def test_withdraw_interest(self):
        self.donor_c.post(self.url())
        r = self.donor_c.delete(self.url())
        self.assertEqual(r.json(), {'is_interested': False, 'interest_count': 0})
        self.assertEqual(self.donor_c.delete(self.url()).status_code, 200)

    def test_interest_not_accepted_for_camps_that_are_not_open(self):
        for camp in (make_app(self.org, S.UNDER_REVIEW), make_app(self.org, S.APPROVED, days=-1), make_app(self.org, S.REJECTED)):
            self.assertEqual(self.donor_c.post(self.url(camp)).status_code, 409)

    def test_my_interests_lists_upcoming_camps(self):
        self.donor_c.post(self.url())
        rows = self.donor_c.get(f'{API}my-interests/').json()['results']
        self.assertEqual([r['id'] for r in rows], [self.camp.pk])
        self.assertEqual(self.req_c.get(f'{API}my-interests/').json()['results'], [])

    def test_cancelling_an_approved_camp_notifies_interested_people(self):
        self.donor_c.post(self.url())
        self.org_c.post(f'{API}applications/{self.camp.pk}/cancel/', {'reason': 'Venue flooded'}, format='json')
        note = Notification.objects.filter(recipient=self.donor, title__icontains='cancelled').first()
        self.assertIsNotNone(note)
        self.assertIn('/camps/', note.action_url)
        self.assertEqual(self.anon.get(API).json()['count'], 0)


class SeedTests(Base):
    def test_seed_is_idempotent_and_covers_every_stage(self):
        make_bank('Seed Bank 1'), make_bank('Seed Bank 2'), make_bank('Seed Bank 3'), make_bank('Seed Bank 4')
        call_command('seed_camps')
        first = CampApplication.objects.count()
        call_command('seed_camps')
        self.assertEqual(CampApplication.objects.count(), first)
        statuses = set(CampApplication.objects.values_list('status', flat=True))
        self.assertEqual(statuses, {S.SUBMITTED, S.UNDER_REVIEW, S.PARTNER_COORDINATION, S.APPROVED, S.COMPLETED, S.REJECTED})
        self.assertGreaterEqual(self.anon.get(API).json()['count'], 4)
        for app in CampApplication.objects.filter(status__in=[S.APPROVED, S.COMPLETED]):
            self.assertEqual(app.partner_status, P.CONFIRMED)
