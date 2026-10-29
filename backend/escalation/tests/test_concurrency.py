"""Parallel responses and evaluations from separate threads (separate DB connections)."""
import threading

from django.db import connection, connections
from django.test import TransactionTestCase

from accounts.models import UserRole
from escalation.constants import AttemptStatus
from escalation.models import EmergencyCase
from escalation.service import service

from .helpers import FAST_HASH, make_request, make_user, populate_pool


def in_threads(jobs):
    errors = []

    def wrap(job):
        try:
            job()
        except Exception as exc:  # noqa: BLE001 - surfaced below
            errors.append(exc)
        finally:
            connections.close_all()

    threads = [threading.Thread(target=wrap, args=(j,)) for j in jobs]
    for t in threads:
        t.start()
    for t in threads:
        t.join(timeout=60)
    return errors


@FAST_HASH
class ConcurrentResponseTests(TransactionTestCase):
    def setUp(self):
        make_user('admin@test.org', UserRole.ADMIN)
        requester = make_user('req@test.org')
        populate_pool(near=8, mid=0, far=0)
        self.case = service.start_case_for_request(make_request(requester))
        self.attempts = list(self.case.attempts.order_by('rank_position'))

    def test_the_same_response_sent_in_parallel_is_applied_once(self):
        target = self.attempts[0].pk
        errors = in_threads([
            lambda: service.record_response(target, AttemptStatus.ACCEPTED, 'donor_app') for _ in range(4)
        ])
        self.assertEqual(errors, [])
        case = EmergencyCase.objects.get(pk=self.case.pk)
        self.assertEqual(case.remaining_coordination_need, 3)
        self.assertEqual(case.events.filter(event_type='CANDIDATE_ACCEPTED').count(), 1)

    def test_different_donors_responding_at_once_are_all_counted(self):
        errors = in_threads([
            (lambda pk=a.pk: service.record_response(pk, AttemptStatus.ACCEPTED, 'donor_app')) for a in self.attempts[:3]
        ])
        self.assertEqual(errors, [])
        case = EmergencyCase.objects.get(pk=self.case.pk)
        self.assertEqual(case.remaining_coordination_need, 1)
        self.assertEqual(case.attempts.filter(status=AttemptStatus.ACCEPTED).count(), 3)

    def test_parallel_evaluations_never_duplicate_outreach(self):
        before = self.case.attempts.count()
        errors = in_threads([lambda: service.evaluate(self.case.pk) for _ in range(4)])
        self.assertEqual(errors, [])
        ids = list(self.case.attempts.values_list('donor_id', flat=True))
        self.assertEqual(len(ids), len(set(ids)))
        self.assertGreaterEqual(len(ids), before)
