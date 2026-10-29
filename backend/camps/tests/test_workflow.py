"""Pure workflow rules: no database."""
from datetime import date, timedelta

from django.test import SimpleTestCase

from camps import workflow
from camps.constants import CampStatus as S, PartnerStatus as P, STAGES, TERMINAL_STATUSES

TODAY = date(2026, 11, 1)
LATER = TODAY + timedelta(days=5)


class TransitionTests(SimpleTestCase):
    def test_happy_path_is_allowed_step_by_step(self):
        path = [S.SUBMITTED, S.UNDER_REVIEW, S.PARTNER_COORDINATION, S.APPROVED, S.COMPLETED]
        for a, b in zip(path, path[1:]):
            self.assertTrue(workflow.can_transition(a, b), f'{a} -> {b}')

    def test_stages_cannot_be_skipped(self):
        self.assertFalse(workflow.can_transition(S.SUBMITTED, S.APPROVED))
        self.assertFalse(workflow.can_transition(S.UNDER_REVIEW, S.APPROVED))
        self.assertFalse(workflow.can_transition(S.SUBMITTED, S.PARTNER_COORDINATION))
        self.assertFalse(workflow.can_transition(S.PARTNER_COORDINATION, S.COMPLETED))

    def test_cannot_go_backwards(self):
        self.assertFalse(workflow.can_transition(S.APPROVED, S.PARTNER_COORDINATION))
        self.assertFalse(workflow.can_transition(S.UNDER_REVIEW, S.SUBMITTED))

    def test_terminal_statuses_have_no_exit(self):
        for status in TERMINAL_STATUSES:
            self.assertTrue(workflow.is_terminal(status))
            for target in S.values:
                self.assertFalse(workflow.can_transition(status, target), f'{status} -> {target}')

    def test_cancellation_is_possible_until_a_terminal_state(self):
        for status in (S.SUBMITTED, S.UNDER_REVIEW, S.PARTNER_COORDINATION, S.APPROVED):
            self.assertTrue(workflow.can_transition(status, S.CANCELLED))

    def test_rejection_only_while_in_progress(self):
        for status in (S.SUBMITTED, S.UNDER_REVIEW, S.PARTNER_COORDINATION):
            self.assertTrue(workflow.can_transition(status, S.REJECTED))
        self.assertFalse(workflow.can_transition(S.APPROVED, S.REJECTED))

    def test_stage_index_follows_the_tracker_order(self):
        self.assertEqual([workflow.stage_index(s) for s in STAGES], [0, 1, 2, 3, 4])
        self.assertIsNone(workflow.stage_index(S.REJECTED))


class GateTests(SimpleTestCase):
    def test_approval_requires_a_confirmed_partner(self):
        for status in (P.NOT_CONTACTED, P.CONTACTED, P.DECLINED):
            self.assertTrue(workflow.approval_blockers(status, True, ['MEDICAL_PERSONNEL'], LATER, TODAY), status)

    def test_approval_requires_a_named_partner_and_support(self):
        self.assertTrue(workflow.approval_blockers(P.CONFIRMED, False, ['MEDICAL_PERSONNEL'], LATER, TODAY))
        self.assertTrue(workflow.approval_blockers(P.CONFIRMED, True, [], LATER, TODAY))

    def test_approval_blocked_when_date_has_passed(self):
        self.assertTrue(workflow.approval_blockers(P.CONFIRMED, True, ['X'], TODAY - timedelta(days=1), TODAY))

    def test_approval_open_when_everything_is_in_place(self):
        self.assertEqual(workflow.approval_blockers(P.CONFIRMED, True, ['MEDICAL_PERSONNEL'], LATER, TODAY), [])
        self.assertEqual(workflow.approval_blockers(P.CONFIRMED, True, ['MEDICAL_PERSONNEL'], TODAY, TODAY), [])

    def test_completion_only_on_or_after_the_camp_date(self):
        self.assertTrue(workflow.completion_blockers(LATER, TODAY))
        self.assertEqual(workflow.completion_blockers(TODAY, TODAY), [])
        self.assertEqual(workflow.completion_blockers(TODAY - timedelta(days=3), TODAY), [])

    def test_partner_details_only_editable_before_approval(self):
        self.assertEqual(workflow.partner_update_blockers(S.UNDER_REVIEW), [])
        self.assertEqual(workflow.partner_update_blockers(S.PARTNER_COORDINATION), [])
        for status in (S.SUBMITTED, S.APPROVED, S.COMPLETED, S.REJECTED, S.CANCELLED):
            self.assertTrue(workflow.partner_update_blockers(status), status)
