"""
Strategy comparison: runs the same fictional scenario and donor dataset (same seed) through
three outreach strategies using the same engine, then derives every metric from the persisted
simulation records. Nothing here is a predetermined result.
"""
from statistics import mean

from django.db import transaction

from .constants import Scenario, Strategy
from .models import Experiment, SimulationRun
from .simulation import create_run, run_to_end, series_for_run
from .service import EscalationError

STRATEGY_ORDER = [Strategy.BROADCAST, Strategy.FIXED, Strategy.ADAPTIVE]
STRATEGY_LABELS = {
    Strategy.BROADCAST: 'A - Basic broadcast',
    Strategy.FIXED: 'B - Fixed escalation',
    Strategy.ADAPTIVE: 'C - Adaptive escalation',
}
NUMERIC_KEYS = [
    'candidates_contacted', 'outreach_batches', 'unanswered_alerts', 'declines',
    'volunteers_accepted', 'communication_attempts', 'simulated_minutes',
]
MAX_SEEDS = 20


def default_seeds(base, count):
    return [base + i for i in range(count)]


def run_experiment(scenario, seeds, actor=None, rerun_of=None, policy_overrides=None):
    if scenario not in Scenario.values:
        raise EscalationError('Unknown scenario.', 'invalid_scenario')
    seeds = [int(s) for s in seeds]
    if not seeds or len(seeds) > MAX_SEEDS:
        raise EscalationError(f'Provide between 1 and {MAX_SEEDS} seeds.', 'invalid_seeds')
    exp = Experiment.objects.create(
        scenario=scenario, seeds=seeds, rerun_of=rerun_of,
        created_by=actor if getattr(actor, 'is_authenticated', False) else None,
    )
    for seed in seeds:
        for strategy in STRATEGY_ORDER:
            run = create_run(scenario, seed, strategy, actor=actor, experiment=exp, policy_overrides=policy_overrides)
            run_to_end(run.pk)
    exp.results = aggregate(exp)
    exp.save(update_fields=['results'])
    return exp


def aggregate(exp):
    runs = list(exp.runs.order_by('seed', 'id'))
    per_strategy = {}
    for strategy in STRATEGY_ORDER:
        rows = [r for r in runs if r.strategy == strategy]
        per_seed = [{'seed': r.seed, 'run_id': r.pk, **r.metrics} for r in rows]
        reached = [m['time_to_target_minutes'] for m in per_seed if m['target_reached']]
        agg = {k: round(mean(m[k] for m in per_seed), 2) for k in NUMERIC_KEYS} if per_seed else {}
        agg.update({
            'runs': len(per_seed),
            'runs_target_reached': len(reached),
            'mean_time_to_target_minutes': round(mean(reached), 1) if reached else None,
            'unresolved_requests': sum(m['unresolved_requests'] for m in per_seed),
            'totals': {k: sum(m[k] for m in per_seed) for k in NUMERIC_KEYS if k != 'simulated_minutes'},
        })
        per_strategy[strategy.value] = {
            'label': STRATEGY_LABELS[strategy], 'summary': agg, 'per_seed': per_seed,
            'series': _mean_series(rows),
        }
    return {
        'scenario': exp.scenario, 'seeds': exp.seeds, 'strategies': per_strategy,
        'caveat': ('These figures come from a fictional simulation with scripted donor behaviour. They are not '
                   'measured hospital performance, real donor response rates or actual donation outcomes.'),
    }


def _mean_series(rows, step=2):
    all_series = [series_for_run(r, step) for r in rows]
    if not all_series:
        return []
    horizon = max(len(s) for s in all_series)
    out = []
    for i in range(horizon):
        pts = []
        for s in all_series:
            # A finished run keeps its last cumulative values (nothing changes after it stops).
            pts.append(s[i] if i < len(s) else {**s[-1], 'minute': i * step})
        out.append({
            'minute': i * step,
            'alerts': round(mean(p['alerts'] for p in pts), 2),
            'accepted': round(mean(p['accepted'] for p in pts), 2),
        })
    return out


@transaction.atomic
def rerun_experiment(exp_id, actor=None, same_seeds=True, base_seed=None):
    exp = Experiment.objects.get(pk=exp_id)
    seeds = exp.seeds if same_seeds else default_seeds(base_seed or (max(exp.seeds) + 1), len(exp.seeds))
    return run_experiment(exp.scenario, seeds, actor=actor, rerun_of=exp)


def experiment_payload(exp):
    return {
        'id': exp.pk, 'scenario': exp.scenario, 'scenario_label': Scenario(exp.scenario).label,
        'seeds': exp.seeds, 'created_at': exp.created_at, 'rerun_of': exp.rerun_of_id,
        'results': exp.results, 'is_simulation': True,
    }
