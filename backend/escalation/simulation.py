"""
Emergency Response Simulator.

A simulation is a SimulationRun that owns its own fictional SimulatedDonor rows and an
EmergencyCase flagged `is_simulation`. It drives the *same* AdaptiveEscalationService as real
emergencies, advancing a virtual clock and feeding in scripted donor responses. It never
creates DonorMatch/Notification rows (nothing is ever sent) and never references real donors,
so resetting or deleting a run can only ever touch fictional data.
"""
import random
from datetime import timedelta

from django.db import transaction
from django.utils import timezone

from accounts.constants import UrgencyLevel
from matching.services import calculate_haversine_distance
from .constants import (
    AttemptStatus, CaseStatus, EventType, LOCALITY_REFERENCE_POINTS, PENDING_ATTEMPT_STATUSES, RunStatus,
    Scenario, Strategy,
)
from .models import EmergencyCase, EscalationEvent, EscalationPolicy, SimulatedDonor, SimulationRun
from .policy import Policy, normalize_policy
from .service import EscalationError, service

SIM_HOSPITAL = {
    'name': 'Demo Hospital, Adyar (fictional)',
    'locality': 'Adyar',
    'lat': LOCALITY_REFERENCE_POINTS['Adyar'][0],
    'lng': LOCALITY_REFERENCE_POINTS['Adyar'][1],
}

# Distance bands in km from the hospital: (upper bound, accept prob, decline prob, delay range in minutes)
# Remaining probability is "silent": the donor never answers.
_BANDS = (5, 10, 20, 9999)

SCENARIOS = {
    Scenario.HIGH_RESPONSE: {
        'label': 'High response',
        'description': 'Many candidates in the initial area accept quickly. The engine should recalculate the remaining '
                       'need and avoid unnecessary further outreach.',
        'bands': [(.65, .15, (2, 12)), (.60, .15, (2, 12)), (.55, .15, (3, 14)), (.50, .15, (3, 14))],
    },
    Scenario.LOW_RESPONSE: {
        'label': 'Low response',
        'description': 'Most candidates decline or stay silent, and some answer only after the response window. '
                       'Declines are kept separate from "no response (status unknown)".',
        'bands': [(.10, .35, (3, 30)), (.10, .35, (3, 30)), (.12, .33, (3, 30)), (.15, .30, (3, 30))],
    },
    Scenario.NO_RESPONSE_INITIAL_AREA: {
        'label': 'No response in the initial area',
        'description': 'Nobody in the first search stage answers. The request should move to escalation and the '
                       'search area should expand according to policy.',
        'bands': [(0.0, 0.0, (3, 10)), (.45, .20, (3, 18)), (.45, .20, (3, 18)), (.40, .20, (3, 18))],
    },
    Scenario.PARTIAL_RESPONSE: {
        'label': 'Partial response',
        'description': 'Some candidates accept but not enough. The request must stay unresolved with the '
                       'outstanding need visible while coordination continues.',
        'bands': [(.30, .25, (3, 20)), (.30, .25, (3, 20)), (.30, .25, (3, 20)), (.30, .25, (3, 20))],
    },
    Scenario.CANCELLED: {
        'label': 'Request cancelled',
        'description': 'The hospital administrator cancels the request while outreach is under way. All further '
                       'outreach and escalation must stop.',
        'bands': [(.30, .20, (3, 20)), (.30, .20, (3, 20)), (.30, .20, (3, 20)), (.30, .20, (3, 20))],
        'cancel_at_minute': 5,
    },
}

_LOCALITY_WEIGHTS = {
    'Adyar': 6, 'Guindy': 5, 'Mylapore': 5, 'Velachery': 6, 'T. Nagar': 5, 'Royapettah': 4, 'Nungambakkam': 4,
    'Thoraipakkam': 4, 'Vadapalani': 4, 'Sholinganallur': 4, 'Anna Nagar': 4, 'Porur': 3, 'Perambur': 3,
    'Tambaram': 3, 'Ambattur': 3,
}
_GROUP_WEIGHTS = {'O+': 37, 'B+': 30, 'A+': 20, 'AB+': 6, 'O-': 2.5, 'B-': 2, 'A-': 1.5, 'AB-': 1}
POOL_SIZE = 70
REQUEST_GROUP = 'B+'
REQUEST_UNITS = 2
HORIZON_MINUTES = 120


def scenario_catalogue():
    return [
        {'key': k.value, 'label': v['label'], 'description': v['description'],
         'cancel_at_minute': v.get('cancel_at_minute'), 'blood_group': REQUEST_GROUP, 'units': REQUEST_UNITS,
         'urgency': 'CRITICAL', 'locality': SIM_HOSPITAL['locality'], 'horizon_minutes': HORIZON_MINUTES}
        for k, v in SCENARIOS.items()
    ]


def generate_dataset(scenario, seed):
    """Deterministic fictional donor pool + scripted behaviour for (scenario, seed)."""
    spec = SCENARIOS[Scenario(scenario)]
    rng = random.Random(f'{scenario}:{seed}')
    localities, loc_w = zip(*_LOCALITY_WEIGHTS.items())
    groups, grp_w = zip(*_GROUP_WEIGHTS.items())
    origin = (SIM_HOSPITAL['lat'], SIM_HOSPITAL['lng'])
    donors = []
    for i in range(1, POOL_SIZE + 1):
        loc = rng.choices(localities, loc_w)[0]
        base = LOCALITY_REFERENCE_POINTS[loc]
        lat, lng = base[0] + rng.uniform(-0.012, 0.012), base[1] + rng.uniform(-0.012, 0.012)
        true_dist = calculate_haversine_distance(origin[0], origin[1], lat, lng)
        band = next(b for b, edge in enumerate(_BANDS) if true_dist <= edge)
        accept_p, decline_p, (dmin, dmax) = spec['bands'][band]
        roll = rng.random()
        plan = 'ACCEPT' if roll < accept_p else 'DECLINE' if roll < accept_p + decline_p else 'SILENT'
        has_coords = rng.random() > 0.15           # 15% of profiles carry no reliable coordinates
        donors.append({
            'code': f'SIM-{i:03d}', 'blood_group': rng.choices(groups, grp_w)[0], 'locality': loc,
            'latitude': round(lat, 5) if has_coords else None, 'longitude': round(lng, 5) if has_coords else None,
            'is_available': rng.random() < 0.88, 'notification_consent': rng.random() < 0.92,
            'medically_verified': rng.random() < 0.55, 'profile_age_days': rng.randint(1, 120),
            'response_plan': plan, 'response_delay_minutes': rng.randint(dmin, dmax),
        })
    return donors


# --------------------------------------------------------------------------------------
# Run lifecycle
# --------------------------------------------------------------------------------------
def _policy_config(overrides=None):
    config = dict(EscalationPolicy.active().config)
    config['auto_escalate'] = True
    config['expiry_grace_minutes'] = 0
    config.update(overrides or {})
    return normalize_policy(config)


@transaction.atomic
def create_run(scenario, seed=1, strategy=Strategy.ADAPTIVE, actor=None, experiment=None, policy_overrides=None):
    if scenario not in Scenario.values:
        raise EscalationError('Unknown scenario.', 'invalid_scenario')
    if strategy not in Strategy.values:
        raise EscalationError('Unknown strategy.', 'invalid_strategy')
    start = timezone.now().replace(second=0, microsecond=0)
    spec = SCENARIOS[Scenario(scenario)]
    run = SimulationRun.objects.create(
        scenario=scenario, strategy=strategy, seed=seed, sim_start=start, sim_clock=start,
        horizon_minutes=HORIZON_MINUTES, policy_snapshot=_policy_config(policy_overrides), experiment=experiment,
        created_by=actor if getattr(actor, 'is_authenticated', False) else None,
        scenario_params={'cancel_at_minute': spec.get('cancel_at_minute')},
    )
    SimulatedDonor.objects.bulk_create(SimulatedDonor(run=run, **d) for d in generate_dataset(scenario, seed))
    return run


@transaction.atomic
def start_run(run_id, actor=None):
    run = SimulationRun.objects.select_for_update().get(pk=run_id)
    if hasattr(run, 'case'):
        return run.case
    policy = Policy(run.policy_snapshot)
    target = REQUEST_UNITS * policy.volunteers_per_unit
    case = EmergencyCase.objects.create(
        simulation_run=run, is_simulation=True, strategy=run.strategy,
        reference=f'SIM-{run.pk}-{run.strategy[0]}', blood_group=REQUEST_GROUP, units_requested=REQUEST_UNITS,
        hospital_name=SIM_HOSPITAL['name'], city='Chennai', locality=SIM_HOSPITAL['locality'],
        hospital_lat=SIM_HOSPITAL['lat'], hospital_lng=SIM_HOSPITAL['lng'], urgency=UrgencyLevel.CRITICAL,
        required_by=run.sim_start + timedelta(minutes=run.horizon_minutes),
        expires_at=run.sim_start + timedelta(minutes=run.horizon_minutes),
        target_volunteers=target, remaining_coordination_need=target, started_at=run.sim_start,
        policy_snapshot=run.policy_snapshot,
    )
    def ev(event_type, text):
        EscalationEvent.objects.create(case=case, event_type=event_type, event_time=run.sim_start,
                                       decision_reason=text, simulation_flag=True)

    ev(EventType.SIMULATION, f'SIMULATION STARTED - scenario "{SCENARIOS[Scenario(run.scenario)]["label"]}", strategy '
                             f'{run.get_strategy_display()}, seed {run.seed}. All donors, hospitals and responses are '
                             'fictional; no message is sent to anyone.')
    ev(EventType.REQUEST_CREATED, f'Fictional request: {REQUEST_UNITS} unit(s) of {REQUEST_GROUP} at '
                                  f'{SIM_HOSPITAL["name"]}, CRITICAL, needed within {run.horizon_minutes} minutes.')
    ev(EventType.REQUEST_VALIDATED, 'Request passed validation.')
    ev(EventType.CASE_STARTED, f'Coordination target: {target} volunteer(s) ({REQUEST_UNITS} unit(s) x '
                               f'{policy.volunteers_per_unit} volunteers per unit).')
    run.status = RunStatus.RUNNING
    run.save(update_fields=['status', 'updated_at'])
    service.evaluate(case.pk, now=run.sim_start)
    _maybe_complete(run)
    return case


def _scripted_responses(case, run, old_clock, new_clock):
    """Responses due in (old_clock, new_clock], chronologically."""
    due = []
    open_statuses = list(PENDING_ATTEMPT_STATUSES) + [AttemptStatus.NO_RESPONSE]
    for a in case.attempts.filter(status__in=open_statuses, sim_donor__isnull=False).select_related('sim_donor'):
        d = a.sim_donor
        if d.response_plan == 'SILENT':
            continue
        at = a.attempted_at + timedelta(minutes=d.response_delay_minutes)
        if at <= new_clock:
            due.append((at, a.pk, AttemptStatus.ACCEPTED if d.response_plan == 'ACCEPT' else AttemptStatus.DECLINED))
    due.sort()
    return due


def _has_future_responses(case):
    open_statuses = list(PENDING_ATTEMPT_STATUSES) + [AttemptStatus.NO_RESPONSE]
    return case.attempts.filter(status__in=open_statuses, sim_donor__isnull=False,
                                sim_donor__response_plan__in=['ACCEPT', 'DECLINE']).exists()


@transaction.atomic
def step_run(run_id, minutes=None):
    run = SimulationRun.objects.select_for_update().get(pk=run_id)
    if run.status == RunStatus.PAUSED:
        raise EscalationError('The simulation is paused. Resume it to continue.', 'paused')
    if run.status == RunStatus.READY:
        raise EscalationError('Start the simulation first.', 'not_started')
    if run.status == RunStatus.COMPLETED:
        return run
    case = run.case
    policy = Policy(run.policy_snapshot)
    tick = int(minutes or policy.sim_tick_minutes)
    old_clock, new_clock = run.sim_clock, run.sim_clock + timedelta(minutes=tick)

    timeline = [(t, 0, pk, status) for t, pk, status in _scripted_responses(case, run, old_clock, new_clock)]
    cancel_at = run.scenario_params.get('cancel_at_minute')
    cancel_time = run.sim_start + timedelta(minutes=cancel_at) if cancel_at is not None else None
    if cancel_time and old_clock < cancel_time <= new_clock and not case.is_terminal:
        timeline.append((cancel_time, 1, None, None))
    timeline.sort(key=lambda x: (x[0], x[1]))

    for at, kind, attempt_id, status in timeline:
        case.refresh_from_db()
        if kind == 1:
            service.cancel(case.pk, actor=None, reason='Simulated hospital administrator cancelled the request.', now=at)
        elif not case.is_terminal:
            service.record_response(attempt_id, status, 'simulation', now=at, evaluate=False)

    run.sim_clock = new_clock
    run.save(update_fields=['sim_clock', 'updated_at'])
    service.evaluate(case.pk, now=new_clock)
    _maybe_complete(run)
    run.refresh_from_db()
    return run


def _maybe_complete(run):
    case = EmergencyCase.objects.get(simulation_run=run)
    done = False
    if case.is_terminal or case.status == CaseStatus.VOLUNTEERS_SECURED:
        done = True
    elif case.status == CaseStatus.NEEDS_ADMIN_INTERVENTION and not _has_future_responses(case):
        done = True
    if not done:
        return False
    run.status = RunStatus.COMPLETED
    run.metrics = compute_metrics(run, case)
    run.final_outcome = describe_outcome(case, run.metrics)
    run.save(update_fields=['status', 'metrics', 'final_outcome', 'updated_at'])
    EscalationEvent.objects.create(
        case=case, event_type=EventType.SIMULATION, event_time=run.sim_clock, simulation_flag=True,
        decision_reason=f'SIMULATION ENDED - {run.final_outcome}')
    return True


def run_to_end(run_id, max_steps=400):
    run = SimulationRun.objects.get(pk=run_id)
    if run.status == RunStatus.READY:
        start_run(run_id)
    for _ in range(max_steps):
        run = SimulationRun.objects.get(pk=run_id)
        if run.status == RunStatus.COMPLETED:
            break
        if run.status == RunStatus.PAUSED:
            raise EscalationError('The simulation is paused.', 'paused')
        step_run(run_id)
    return SimulationRun.objects.get(pk=run_id)


@transaction.atomic
def set_paused(run_id, paused):
    run = SimulationRun.objects.select_for_update().get(pk=run_id)
    if run.status not in (RunStatus.RUNNING, RunStatus.PAUSED):
        raise EscalationError('Only a running simulation can be paused or resumed.', 'invalid_state')
    run.status = RunStatus.PAUSED if paused else RunStatus.RUNNING
    run.save(update_fields=['status', 'updated_at'])
    if hasattr(run, 'case'):
        EscalationEvent.objects.create(
            case=run.case, event_type=EventType.SIMULATION, event_time=run.sim_clock, simulation_flag=True,
            decision_reason='Simulation paused.' if paused else 'Simulation resumed.')
    return run


@transaction.atomic
def reset_run(run_id):
    """Remove this run's cases/attempts/events and return it to READY. Only fictional rows are touched."""
    run = SimulationRun.objects.select_for_update().get(pk=run_id)
    EmergencyCase.objects.filter(simulation_run=run, is_simulation=True).delete()
    run.status, run.sim_clock = RunStatus.READY, run.sim_start
    run.metrics, run.final_outcome = None, ''
    run.save()
    return run


@transaction.atomic
def purge_all():
    """Delete every simulation and experiment. Real donors and requests are not referenced."""
    from .models import Experiment
    n_runs = SimulationRun.objects.count()
    Experiment.objects.all().delete()
    SimulationRun.objects.all().delete()
    return n_runs


# --------------------------------------------------------------------------------------
# Metrics - always computed from the persisted attempts/batches/events of the run
# --------------------------------------------------------------------------------------
def _minutes(run, t):
    return (t - run.sim_start).total_seconds() / 60


def compute_metrics(run, case=None):
    case = case or EmergencyCase.objects.get(simulation_run=run)
    attempts = list(case.attempts.select_related('batch'))
    accepted = [a for a in attempts if a.status == AttemptStatus.ACCEPTED]
    declined = [a for a in attempts if a.status == AttemptStatus.DECLINED]
    unanswered = [a for a in attempts if a.status not in (AttemptStatus.ACCEPTED, AttemptStatus.DECLINED)]
    times = sorted(a.responded_at for a in accepted if a.responded_at)
    target = case.target_volunteers
    reached_at = _minutes(run, times[target - 1]) if len(times) >= target else None
    return {
        'time_to_target_minutes': None if reached_at is None else round(reached_at, 1),
        'target_reached': reached_at is not None,
        'candidates_contacted': len({a.sim_donor_id for a in attempts}),
        'outreach_batches': case.batches.count(),
        'unanswered_alerts': len(unanswered),
        'declines': len(declined),
        'volunteers_accepted': len(accepted),
        'target_volunteers': target,
        'unresolved_requests': 0 if reached_at is not None else 1,
        'communication_attempts': len(attempts),
        'stage_reached': case.current_stage_index + 1,
        'final_status': case.status,
        'simulated_minutes': round(_minutes(run, run.sim_clock), 1),
    }


def series_for_run(run, step=2):
    """Cumulative alerts issued and volunteers accepted over simulated minutes."""
    case = EmergencyCase.objects.get(simulation_run=run)
    attempts = list(case.attempts.all())
    end = int(max(_minutes(run, run.sim_clock), 0))
    out = []
    for t in range(0, end + step, step):
        limit = run.sim_start + timedelta(minutes=t)
        out.append({
            'minute': t,
            'alerts': sum(1 for a in attempts if a.attempted_at <= limit),
            'accepted': sum(1 for a in attempts if a.status == AttemptStatus.ACCEPTED and a.responded_at and a.responded_at <= limit),
        })
    return out


def describe_outcome(case, metrics):
    if case.status == CaseStatus.CANCELLED:
        return (f'Request cancelled; outreach stopped after {metrics["communication_attempts"]} alert(s). '
                f'{metrics["volunteers_accepted"]} volunteer(s) had accepted at that point.')
    if metrics['target_reached']:
        return (f'Volunteer target reached after {metrics["time_to_target_minutes"]} simulated minutes using '
                f'{metrics["communication_attempts"]} alert(s) in {metrics["outreach_batches"]} batch(es). '
                'Donations are not confirmed: hospital verification would still be required.')
    if case.status == CaseStatus.EXPIRED:
        return (f'Request expired unresolved: {metrics["volunteers_accepted"]} of {metrics["target_volunteers"]} '
                'volunteers accepted.')
    return (f'Administrator intervention required: {metrics["volunteers_accepted"]} of '
            f'{metrics["target_volunteers"]} volunteers accepted and no automatic step remains.')
