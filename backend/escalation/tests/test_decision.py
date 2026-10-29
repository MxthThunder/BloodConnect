"""The decision rules are pure functions: no database, no UI."""
from django.test import SimpleTestCase

from escalation import decision as d


def snap(**kw):
    base = dict(
        strategy='ADAPTIVE', urgency='CRITICAL', target=4, accepted=0, declined=0, no_response=0, pending=0,
        contacted=0, batches=0, current_stage=-1, minutes_since_start=0, minutes_since_last_batch=None,
        accept_rate=0.35, wait_minutes=10, min_gap_minutes=3, max_batches=8, fixed_interval_minutes=15,
        stage_caps=(8, 10, 14, 20), available=(8, 18, 30, 40), auto_escalate=True, manual=False)
    base.update(kw)
    return d.Snapshot(**base)


class AdaptiveRuleTests(SimpleTestCase):
    def test_first_batch_is_sized_by_need_and_capped_by_stage(self):
        dec = d.decide(snap())
        self.assertEqual(dec.action, d.SEND_BATCH)
        self.assertEqual(dec.stage_index, 0)
        self.assertEqual(dec.batch_size, 8)            # ceil(4 / 0.35) = 12, capped at the stage limit of 8
        self.assertEqual(dec.trigger, 'INITIAL')
        self.assertFalse(dec.allow_fill)

    def test_small_need_gives_small_first_batch(self):
        dec = d.decide(snap(target=1, accept_rate=0.5))
        self.assertEqual(dec.batch_size, 2)

    def test_need_met_pauses_outreach_and_is_not_resolution(self):
        dec = d.decide(snap(accepted=4, batches=1, current_stage=0, pending=3))
        self.assertEqual(dec.action, d.SECURED)
        self.assertIn('does not confirm donations', dec.reason)

    def test_waits_when_pending_alerts_are_expected_to_cover_the_need(self):
        dec = d.decide(snap(batches=1, current_stage=0, pending=12, minutes_since_last_batch=1,
                            available=(0, 10, 20, 30)))
        self.assertEqual((dec.action, dec.reason_code), (d.WAIT, 'PENDING_COVERS_NEED'))

    def test_respects_minimum_gap_between_batches(self):
        dec = d.decide(snap(batches=1, current_stage=0, pending=4, minutes_since_last_batch=1))
        self.assertEqual((dec.action, dec.reason_code), (d.WAIT, 'MIN_BATCH_GAP'))

    def test_tops_up_in_the_current_stage_when_yield_is_short(self):
        dec = d.decide(snap(batches=1, current_stage=0, pending=4, declined=3, minutes_since_last_batch=5))
        self.assertEqual(dec.action, d.SEND_BATCH)
        self.assertEqual(dec.stage_index, 0)
        self.assertEqual(dec.trigger, 'TOP_UP')

    def test_does_not_expand_while_alerts_are_still_inside_their_window(self):
        dec = d.decide(snap(batches=1, current_stage=0, pending=2, minutes_since_last_batch=5,
                            available=(0, 10, 20, 30)))
        self.assertEqual((dec.action, dec.reason_code), (d.WAIT, 'STAGE_EXHAUSTED_AWAITING_RESPONSES'))

    def test_expands_when_stage_exhausted_and_everything_answered_or_lapsed(self):
        dec = d.decide(snap(batches=1, current_stage=0, pending=0, no_response=8, contacted=8,
                            minutes_since_last_batch=11, available=(0, 10, 20, 30)))
        self.assertEqual(dec.action, d.SEND_BATCH)
        self.assertEqual(dec.stage_index, 1)
        self.assertEqual(dec.trigger, 'EXPANSION')

    def test_expansion_waits_for_approval_when_auto_escalation_is_off(self):
        dec = d.decide(snap(batches=1, current_stage=0, pending=0, minutes_since_last_batch=11,
                            available=(0, 10, 20, 30), auto_escalate=False))
        self.assertEqual(dec.action, d.AWAIT_APPROVAL)
        approved = d.decide(snap(batches=1, current_stage=0, pending=0, minutes_since_last_batch=11,
                                 available=(0, 10, 20, 30), auto_escalate=False, manual=True))
        self.assertEqual(approved.action, d.SEND_BATCH)

    def test_no_candidates_anywhere_needs_an_administrator(self):
        dec = d.decide(snap(available=(0, 0, 0, 0)))
        self.assertEqual(dec.action, d.ESCALATE_ADMIN)
        later = d.decide(snap(batches=2, current_stage=1, pending=0, available=(0, 0, 0, 0),
                              minutes_since_last_batch=20))
        self.assertEqual((later.action, later.reason_code), (d.ESCALATE_ADMIN, 'NO_ELIGIBLE_REMAINING'))

    def test_batch_limit_needs_an_administrator_but_manual_approval_overrides_once(self):
        s = dict(batches=8, current_stage=2, pending=0, minutes_since_last_batch=20)
        self.assertEqual(d.decide(snap(**s)).reason_code, 'MAX_BATCHES_REACHED')
        self.assertEqual(d.decide(snap(manual=True, **s)).action, d.SEND_BATCH)

    def test_observed_declines_increase_the_next_batch_size(self):
        common = dict(batches=1, current_stage=1, minutes_since_last_batch=11, available=(0, 30, 40, 50),
                      stage_caps=(8, 50, 50, 50))
        low = d.decide(snap(accept_rate=0.10, **common))
        high = d.decide(snap(accept_rate=0.60, **common))
        self.assertGreater(low.batch_size, high.batch_size)


class BaselineRuleTests(SimpleTestCase):
    def test_broadcast_contacts_the_whole_pool_once(self):
        dec = d.decide(snap(strategy='BROADCAST'))
        self.assertEqual((dec.action, dec.batch_size, dec.trigger), (d.SEND_BATCH, 40, 'BROADCAST'))
        again = d.decide(snap(strategy='BROADCAST', batches=1, pending=10, current_stage=3))
        self.assertEqual(again.action, d.WAIT)
        done = d.decide(snap(strategy='BROADCAST', batches=1, pending=0, current_stage=3))
        self.assertEqual(done.action, d.ESCALATE_ADMIN)

    def test_fixed_strategy_opens_stages_on_a_timer_regardless_of_responses(self):
        first = d.decide(snap(strategy='FIXED'))
        self.assertEqual((first.action, first.stage_index, first.batch_size), (d.SEND_BATCH, 0, 8))
        early = d.decide(snap(strategy='FIXED', batches=1, current_stage=0, minutes_since_start=14,
                              available=(0, 10, 22, 32)))
        self.assertEqual(early.action, d.WAIT)
        due = d.decide(snap(strategy='FIXED', batches=1, current_stage=0, minutes_since_start=15, accepted=3,
                            available=(0, 10, 22, 32)))
        self.assertEqual((due.action, due.stage_index, due.batch_size), (d.SEND_BATCH, 1, 10))

    def test_fixed_strategy_advances_through_an_empty_stage(self):
        dec = d.decide(snap(strategy='FIXED', batches=1, current_stage=0, minutes_since_start=16,
                            available=(0, 0, 5, 9)))
        self.assertEqual(dec.action, d.ADVANCE_EMPTY)
