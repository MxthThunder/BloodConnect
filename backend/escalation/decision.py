"""
Pure decision rules of the escalation engine.

Nothing in this module touches the database, the clock or the UI: it takes a `Snapshot`
(numbers describing the current emergency) and returns a `Decision`. That makes the
algorithm testable on its own, and lets the real application, the simulator and the
experiment module all execute exactly the same rules.
"""
import math
from dataclasses import dataclass, field

# Decision actions
SECURED = 'SECURED'                  # volunteer target reached - pause outreach
WAIT = 'WAIT'                        # nothing to do yet (explains why)
SEND_BATCH = 'SEND_BATCH'            # create an outreach batch
ADVANCE_EMPTY = 'ADVANCE_EMPTY'      # fixed strategy: stage reached but it has no new candidates
AWAIT_APPROVAL = 'AWAIT_APPROVAL'    # expansion needed but policy requires administrator approval
ESCALATE_ADMIN = 'ESCALATE_ADMIN'    # engine cannot make progress alone


@dataclass(frozen=True)
class Snapshot:
    strategy: str
    urgency: str
    target: int                 # volunteers needed (units x volunteers_per_unit)
    accepted: int               # volunteers currently accepted (not "units")
    declined: int
    no_response: int            # window elapsed - status UNKNOWN, not "unavailable"
    pending: int                # alerts still inside their response window
    contacted: int
    batches: int
    current_stage: int          # -1 before the first batch
    minutes_since_start: float
    minutes_since_last_batch: float | None
    accept_rate: float          # blended prior + observed acceptance rate per alert
    wait_minutes: int
    min_gap_minutes: int
    max_batches: int
    fixed_interval_minutes: int
    stage_caps: tuple           # max batch size per stage
    available: tuple            # eligible, not-yet-contacted candidates within each stage (cumulative)
    auto_escalate: bool = True
    manual: bool = False        # administrator explicitly approved this evaluation

    @property
    def need(self):
        return max(0, self.target - self.accepted)

    @property
    def last_stage(self):
        return len(self.available) - 1


@dataclass
class Decision:
    action: str
    reason_code: str
    reason: str
    stage_index: int | None = None
    batch_size: int = 0
    trigger: str | None = None
    allow_fill: bool = False
    details: dict = field(default_factory=dict)


def _first_stage_with_candidates(available, start=0):
    for i in range(max(start, 0), len(available)):
        if available[i] > 0:
            return i
    return None


def _facts(s, expected_pending=None):
    out = {
        'target_volunteers': s.target, 'accepted_volunteers': s.accepted, 'remaining_need': s.need,
        'pending_alerts': s.pending, 'declined': s.declined, 'no_response': s.no_response,
        'accept_rate_estimate': round(s.accept_rate, 3), 'batches': s.batches,
        'current_stage': s.current_stage,
    }
    if expected_pending is not None:
        out['expected_from_pending'] = round(expected_pending, 2)
    return out


def decide(s: Snapshot) -> Decision:
    if s.need <= 0:
        return Decision(
            SECURED, 'NEED_MET',
            f'{s.accepted} volunteer(s) have accepted against a target of {s.target}. Further outreach is paused. '
            'This does not confirm donations: hospital verification is still required.',
            details=_facts(s),
        )
    if s.strategy == 'BROADCAST':
        return _decide_broadcast(s)
    if s.strategy == 'FIXED':
        return _decide_fixed(s)
    return _decide_adaptive(s)


# --------------------------------------------------------------------------------------
# Strategy C - adaptive
# --------------------------------------------------------------------------------------
def _decide_adaptive(s: Snapshot) -> Decision:
    need, rate = s.need, max(s.accept_rate, 0.01)
    expected_pending = s.pending * rate
    facts = _facts(s, expected_pending)

    if s.batches == 0:
        stage = _first_stage_with_candidates(s.available)
        if stage is None:
            return Decision(ESCALATE_ADMIN, 'NO_ELIGIBLE_CANDIDATES',
                            'No eligible candidates were found in any configured search stage '
                            '(blood-group criteria, availability, consent and location were all applied).', details=facts)
        size = max(1, min(math.ceil(need / rate), s.stage_caps[stage], s.available[stage]))
        reason = (f'Initial search: {need} volunteer(s) still needed and about {rate:.0%} of alerts are expected to '
                  f'be accepted, so alerting {size} candidate(s) in stage {stage + 1}.')
        if stage > 0:
            reason += f' Earlier stage(s) had no eligible candidates.'
        return Decision(SEND_BATCH, 'INITIAL_SEARCH', reason, stage, size, 'INITIAL', False, facts)

    if s.pending > 0 and expected_pending >= need - 1e-9 and not s.manual:
        return Decision(
            WAIT, 'PENDING_COVERS_NEED',
            f'{s.pending} alert(s) are still inside their {s.wait_minutes}-minute response window. At the observed '
            f'~{rate:.0%} acceptance rate they are expected to yield about {expected_pending:.1f} volunteer(s), '
            f'which covers the remaining need of {need}. No further outreach yet.',
            details=facts)

    since = s.minutes_since_last_batch
    if (not s.manual and s.pending > 0 and since is not None and since < s.min_gap_minutes):
        return Decision(
            WAIT, 'MIN_BATCH_GAP',
            f'Expected yield from pending alerts ({expected_pending:.1f}) is below the remaining need of {need}, '
            f'but the last batch was only {since:.0f} minute(s) ago (minimum gap {s.min_gap_minutes}).', details=facts)

    total_available = s.available[s.last_stage]
    if total_available == 0:
        return Decision(
            ESCALATE_ADMIN, 'NO_ELIGIBLE_REMAINING',
            f'{need} volunteer(s) are still needed but every eligible candidate in every stage has already been '
            'contacted (or none remain). Administrator intervention is required, for example widening the stages '
            'or contacting the hospital blood bank.', details=facts)
    if s.batches >= s.max_batches and not s.manual:
        return Decision(
            ESCALATE_ADMIN, 'MAX_BATCHES_REACHED',
            f'The policy limit of {s.max_batches} batches has been reached with {need} volunteer(s) still needed.',
            details=facts)

    cur = max(s.current_stage, 0)
    start = _first_stage_with_candidates(s.available, cur)
    crossing = start > cur          # the current search area has nobody eligible left
    shortfall = need - expected_pending

    if crossing and s.pending > 0 and not s.manual:
        return Decision(
            WAIT, 'STAGE_EXHAUSTED_AWAITING_RESPONSES',
            f'Stage {cur + 1} has no eligible candidates left and {s.pending} alert(s) are still inside their '
            f'{s.wait_minutes}-minute window. The search will be expanded to stage {start + 1} once they are '
            f'answered or lapse (remaining need: {need}).', details=facts)
    if crossing and not s.auto_escalate and not s.manual:
        return Decision(
            AWAIT_APPROVAL, 'EXPANSION_NEEDS_APPROVAL',
            f'Stage {cur + 1} is exhausted with {need} volunteer(s) still needed. Policy requires administrator '
            f'approval before expanding to stage {start + 1}.', start,
            max(1, min(math.ceil(shortfall / rate), s.stage_caps[start], s.available[start])), 'EXPANSION', False, facts)

    allow_fill = (s.pending == 0 or s.manual) and (s.auto_escalate or s.manual)
    pool = total_available if allow_fill else s.available[start]
    size = max(1, min(math.ceil(shortfall / rate), s.stage_caps[start], pool))
    if crossing:
        reason = (f'Stage {cur + 1} has no eligible candidates left and earlier alerts have been answered or have '
                  f'lapsed, so the search expands to stage {start + 1}. {need} volunteer(s) still needed '
                  f'(observed acceptance ~{rate:.0%}); alerting {size}.')
        trigger = 'EXPANSION'
    else:
        reason = (f'{need} volunteer(s) still needed and pending alerts are expected to yield only '
                  f'{expected_pending:.1f}. Alerting {size} more candidate(s) starting in stage {start + 1}'
                  f'{" (expanding further if that stage runs out)" if allow_fill else ""}.')
        trigger = 'MANUAL' if s.manual else 'TOP_UP'
    return Decision(SEND_BATCH, 'TOP_UP_OR_EXPAND', reason, start, size, trigger, allow_fill, facts)


# --------------------------------------------------------------------------------------
# Strategy B - fixed escalation (baseline)
# --------------------------------------------------------------------------------------
def _decide_fixed(s: Snapshot) -> Decision:
    facts = _facts(s)
    nxt = s.current_stage + 1
    due = min(int(s.minutes_since_start // max(s.fixed_interval_minutes, 1)), s.last_stage)
    if nxt > s.last_stage:
        if s.pending == 0:
            return Decision(ESCALATE_ADMIN, 'ALL_STAGES_DONE',
                            f'All {len(s.available)} fixed stages have been contacted and {s.need} volunteer(s) '
                            'are still needed.', details=facts)
        return Decision(WAIT, 'FINAL_STAGE_PENDING',
                        f'Final fixed stage contacted; {s.pending} alert(s) still inside their window.', details=facts)
    if nxt > due and s.batches > 0:
        return Decision(WAIT, 'FIXED_INTERVAL_NOT_ELAPSED',
                        f'Fixed rule: stage {nxt + 1} opens {s.fixed_interval_minutes * nxt} minutes after the start '
                        f'(now {s.minutes_since_start:.0f}).', details=facts)
    if not s.auto_escalate and not s.manual and nxt > 0:
        return Decision(AWAIT_APPROVAL, 'EXPANSION_NEEDS_APPROVAL',
                        f'Fixed rule reached stage {nxt + 1}; policy requires administrator approval.',
                        nxt, s.available[nxt], 'FIXED_INTERVAL', False, facts)
    new_here = s.available[nxt]
    trigger = 'INITIAL' if s.batches == 0 else 'FIXED_INTERVAL'
    if new_here == 0:
        return Decision(ADVANCE_EMPTY, 'FIXED_STAGE_EMPTY',
                        f'Fixed rule reached stage {nxt + 1} but it has no new eligible candidates.', nxt, 0, trigger,
                        False, facts)
    return Decision(SEND_BATCH, 'FIXED_STAGE',
                    f'Fixed rule: alert every eligible candidate in stage {nxt + 1} ({new_here}), regardless of '
                    f'responses so far.', nxt, new_here, trigger, False, facts)


# --------------------------------------------------------------------------------------
# Strategy A - basic broadcast (baseline)
# --------------------------------------------------------------------------------------
def _decide_broadcast(s: Snapshot) -> Decision:
    facts = _facts(s)
    if s.batches == 0:
        total = s.available[s.last_stage]
        if total == 0:
            return Decision(ESCALATE_ADMIN, 'NO_ELIGIBLE_CANDIDATES',
                            'No eligible candidates exist in the configured pool.', details=facts)
        return Decision(SEND_BATCH, 'BROADCAST_ALL',
                        f'Basic broadcast: alert all {total} eligible candidates in the configured pool at once.',
                        s.last_stage, total, 'BROADCAST', False, facts)
    if s.pending == 0:
        return Decision(ESCALATE_ADMIN, 'BROADCAST_EXHAUSTED',
                        f'The single broadcast has been answered or has lapsed and {s.need} volunteer(s) are still '
                        'needed; this baseline strategy never sends a second wave.', details=facts)
    return Decision(WAIT, 'BROADCAST_PENDING',
                    f'Broadcast already sent; waiting for {s.pending} alert(s).', details=facts)
