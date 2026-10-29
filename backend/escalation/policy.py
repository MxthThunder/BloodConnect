"""
Escalation policy: every threshold the engine uses lives here and is editable by
administrators (Admin Settings page / PUT /api/escalation/policy/).
"""
import copy
from dataclasses import dataclass

URGENCIES = ('CRITICAL', 'URGENT', 'STANDARD')

DEFAULT_POLICY = {
    # Coordination target: volunteers needed per requested unit. >1 leaves a buffer because
    # hospital screening may defer some volunteers. Volunteers are NOT blood units.
    'volunteers_per_unit': 2,
    # Prior belief that an alert turns into an acceptance. Blended with observed outcomes.
    'assumed_response_rate': 0.35,
    # How many "virtual alerts" the prior is worth when blending with observed outcomes.
    'prior_weight': 4,
    # Minutes after an alert before an unanswered alert is classed NO_RESPONSE (status unknown).
    'response_wait_minutes': {'CRITICAL': 10, 'URGENT': 20, 'STANDARD': 45},
    # Minimum minutes between two batches while earlier alerts are still inside their window.
    'min_batch_gap_minutes': {'CRITICAL': 3, 'URGENT': 5, 'STANDARD': 10},
    'max_batches': 8,
    # Minutes after required_by before a request is treated as expired.
    'expiry_grace_minutes': 30,
    # If False, expansion is only executed after an administrator approves it.
    'auto_escalate': True,
    # If True, donors who never answered an earlier stage may be alerted once more in a later stage.
    'allow_reminders': False,
    # Baseline "fixed escalation" strategy: minutes between predefined stages.
    'fixed_interval_minutes': 15,
    # Search stages. Each stage includes every inner stage (cumulative).
    # radius_km=None means "no distance limit". When a donor's distance is unknown the stage
    # falls back to locality/city matching instead of inventing a distance.
    'stages': [
        {'name': 'Stage 1 - Immediate area', 'radius_km': 5, 'fallback_scope': 'LOCALITY', 'max_batch_size': 8},
        {'name': 'Stage 2 - Nearby localities', 'radius_km': 10, 'fallback_scope': 'CITY', 'max_batch_size': 10},
        {'name': 'Stage 3 - Greater Chennai', 'radius_km': 20, 'fallback_scope': 'CITY', 'max_batch_size': 14},
        {'name': 'Stage 4 - Whole metro area', 'radius_km': None, 'fallback_scope': 'CITY', 'max_batch_size': 20},
    ],
    # Prioritisation weights (points). Total of weights = 100% of the score.
    'weights': {
        'proximity': 35,
        'group_match': 25,
        'verified_profile': 20,
        'availability_freshness': 20,
    },
    # Simulator clock step in simulated minutes.
    'sim_tick_minutes': 2,
}


@dataclass(frozen=True)
class Stage:
    index: int
    name: str
    radius_km: float | None
    fallback_scope: str
    max_batch_size: int


class PolicyError(ValueError):
    pass


def _num(value, name, lo=None, hi=None, integer=False):
    try:
        value = int(value) if integer else float(value)
    except (TypeError, ValueError):
        raise PolicyError(f'{name} must be a number.')
    if lo is not None and value < lo:
        raise PolicyError(f'{name} must be at least {lo}.')
    if hi is not None and value > hi:
        raise PolicyError(f'{name} must be at most {hi}.')
    return value


def normalize_policy(data):
    """Validate a (possibly partial) policy dict and return a complete one. Raises PolicyError."""
    merged = copy.deepcopy(DEFAULT_POLICY)
    if data:
        for key, value in data.items():
            if key not in DEFAULT_POLICY:
                raise PolicyError(f'Unknown policy setting: {key}')
            merged[key] = copy.deepcopy(value)

    merged['volunteers_per_unit'] = _num(merged['volunteers_per_unit'], 'volunteers_per_unit', 1, 10, integer=True)
    merged['assumed_response_rate'] = _num(merged['assumed_response_rate'], 'assumed_response_rate', 0.02, 1)
    merged['prior_weight'] = _num(merged['prior_weight'], 'prior_weight', 0, 100)
    merged['max_batches'] = _num(merged['max_batches'], 'max_batches', 1, 50, integer=True)
    merged['expiry_grace_minutes'] = _num(merged['expiry_grace_minutes'], 'expiry_grace_minutes', 0, 1440, integer=True)
    merged['fixed_interval_minutes'] = _num(merged['fixed_interval_minutes'], 'fixed_interval_minutes', 1, 240, integer=True)
    merged['sim_tick_minutes'] = _num(merged['sim_tick_minutes'], 'sim_tick_minutes', 1, 30, integer=True)
    merged['auto_escalate'] = bool(merged['auto_escalate'])
    merged['allow_reminders'] = bool(merged['allow_reminders'])

    for key, lo in (('response_wait_minutes', 1), ('min_batch_gap_minutes', 0)):
        block = merged[key]
        if not isinstance(block, dict) or set(block) != set(URGENCIES):
            raise PolicyError(f'{key} must define {", ".join(URGENCIES)}.')
        merged[key] = {u: _num(block[u], f'{key}.{u}', lo, 1440, integer=True) for u in URGENCIES}

    stages = merged['stages']
    if not isinstance(stages, list) or not 1 <= len(stages) <= 8:
        raise PolicyError('Define between 1 and 8 search stages.')
    clean, last_radius = [], 0
    for i, st in enumerate(stages):
        if not isinstance(st, dict):
            raise PolicyError('Each stage must be an object.')
        name = str(st.get('name') or f'Stage {i + 1}').strip()[:80]
        radius = st.get('radius_km')
        if radius in (None, ''):
            radius = None
            if i != len(stages) - 1:
                raise PolicyError('Only the last stage may have no distance limit.')
        else:
            radius = _num(radius, f'stage {i + 1} radius_km', 0.5, 500)
            if radius < last_radius:
                raise PolicyError('Stage radii must not decrease.')
            last_radius = radius
        scope = st.get('fallback_scope', 'CITY')
        if scope not in ('LOCALITY', 'CITY'):
            raise PolicyError("fallback_scope must be 'LOCALITY' or 'CITY'.")
        size = _num(st.get('max_batch_size', 10), f'stage {i + 1} max_batch_size', 1, 500, integer=True)
        clean.append({'name': name, 'radius_km': radius, 'fallback_scope': scope, 'max_batch_size': size})
    merged['stages'] = clean

    weights = merged['weights']
    expected = set(DEFAULT_POLICY['weights'])
    if not isinstance(weights, dict) or set(weights) != expected:
        raise PolicyError(f'weights must define: {", ".join(sorted(expected))}.')
    merged['weights'] = {k: _num(weights[k], f'weight {k}', 0, 100) for k in weights}
    if sum(merged['weights'].values()) <= 0:
        raise PolicyError('At least one prioritisation weight must be above zero.')
    return merged


class Policy:
    """Read-only typed view over a normalised policy dict."""

    def __init__(self, data=None):
        self.data = normalize_policy(data)
        self.stages = [Stage(i, **s) for i, s in enumerate(self.data['stages'])]

    def __getattr__(self, item):
        try:
            return self.__dict__['data'][item]
        except KeyError:
            raise AttributeError(item)

    @property
    def last_stage(self):
        return len(self.stages) - 1

    @property
    def max_finite_radius(self):
        radii = [s.radius_km for s in self.stages if s.radius_km]
        return max(radii) if radii else 25.0

    def wait_minutes(self, urgency):
        return self.data['response_wait_minutes'].get(urgency, self.data['response_wait_minutes']['URGENT'])

    def min_gap(self, urgency):
        return self.data['min_batch_gap_minutes'].get(urgency, self.data['min_batch_gap_minutes']['URGENT'])

    @property
    def weight_total(self):
        return sum(self.data['weights'].values())
