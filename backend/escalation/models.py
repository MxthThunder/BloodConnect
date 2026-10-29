from django.conf import settings
from django.db import models
from django.db.models import Q
from django.utils import timezone

from accounts.constants import BloodGroup, UrgencyLevel
from .constants import (
    AttemptStatus, BatchTrigger, CaseStatus, EventType, Fulfilment, RunStatus,
    Scenario, Strategy, TERMINAL_CASE_STATUSES,
)
from .policy import DEFAULT_POLICY, Policy, normalize_policy


class EscalationPolicy(models.Model):
    """Administrator-editable configuration. One active row is used by real emergencies."""
    name = models.CharField(max_length=60, unique=True, default='default')
    config = models.JSONField(default=dict)
    is_active = models.BooleanField(default=True)
    updated_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL, related_name='+'
    )
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f'Escalation policy "{self.name}"'

    @classmethod
    def active(cls):
        row = cls.objects.filter(is_active=True).order_by('id').first()
        if row is None:
            row = cls.objects.create(name='default', config=normalize_policy(DEFAULT_POLICY))
        return row

    @classmethod
    def active_policy(cls):
        return Policy(cls.active().config)


class SimulationRun(models.Model):
    """One fictional run of the engine. Never linked to real donors or requests."""
    scenario = models.CharField(max_length=40, choices=Scenario.choices)
    strategy = models.CharField(max_length=12, choices=Strategy.choices, default=Strategy.ADAPTIVE)
    seed = models.IntegerField(default=1)
    status = models.CharField(max_length=12, choices=RunStatus.choices, default=RunStatus.READY)
    sim_start = models.DateTimeField()
    sim_clock = models.DateTimeField()
    horizon_minutes = models.PositiveIntegerField(default=120)
    scenario_params = models.JSONField(default=dict)
    policy_snapshot = models.JSONField(default=dict)
    experiment = models.ForeignKey(
        'Experiment', null=True, blank=True, on_delete=models.CASCADE, related_name='runs'
    )
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL, related_name='+'
    )
    metrics = models.JSONField(null=True, blank=True)
    final_outcome = models.CharField(max_length=300, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f'SIM #{self.pk} {self.scenario}/{self.strategy} seed={self.seed}'


class SimulatedDonor(models.Model):
    """A fictional donor that exists only inside one simulation run."""
    run = models.ForeignKey(SimulationRun, on_delete=models.CASCADE, related_name='donors')
    code = models.CharField(max_length=20)
    blood_group = models.CharField(max_length=5, choices=BloodGroup.choices)
    city = models.CharField(max_length=100, default='Chennai')
    locality = models.CharField(max_length=100, blank=True)
    latitude = models.FloatField(null=True, blank=True)
    longitude = models.FloatField(null=True, blank=True)
    is_available = models.BooleanField(default=True)
    notification_consent = models.BooleanField(default=True)
    medically_verified = models.BooleanField(default=False)
    profile_age_days = models.PositiveIntegerField(default=10)
    # Scripted behaviour (same for every strategy run on the same seed -> fair comparison).
    response_plan = models.CharField(max_length=10, default='SILENT')  # ACCEPT | DECLINE | SILENT
    response_delay_minutes = models.PositiveIntegerField(default=5)

    class Meta:
        ordering = ['code']
        constraints = [models.UniqueConstraint(fields=['run', 'code'], name='uniq_sim_donor_code')]

    def __str__(self):
        return f'{self.code} (fictional)'


class EmergencyCase(models.Model):
    """Escalation state for one emergency (real request, or fictional simulation)."""
    blood_request = models.OneToOneField(
        'blood_requests.BloodRequest', null=True, blank=True,
        on_delete=models.CASCADE, related_name='emergency_case'
    )
    simulation_run = models.OneToOneField(
        SimulationRun, null=True, blank=True, on_delete=models.CASCADE, related_name='case'
    )
    is_simulation = models.BooleanField(default=False, db_index=True)
    strategy = models.CharField(max_length=12, choices=Strategy.choices, default=Strategy.ADAPTIVE)
    reference = models.CharField(max_length=40)

    # Snapshot of the request fields the engine needs.
    blood_group = models.CharField(max_length=5, choices=BloodGroup.choices)
    units_requested = models.PositiveIntegerField()
    hospital_name = models.CharField(max_length=200)
    city = models.CharField(max_length=100, default='Chennai')
    locality = models.CharField(max_length=100, blank=True)
    hospital_lat = models.FloatField(null=True, blank=True)
    hospital_lng = models.FloatField(null=True, blank=True)
    urgency = models.CharField(max_length=20, choices=UrgencyLevel.choices, default=UrgencyLevel.URGENT)
    required_by = models.DateTimeField()
    expires_at = models.DateTimeField()

    status = models.CharField(max_length=30, choices=CaseStatus.choices, default=CaseStatus.OPEN, db_index=True)
    current_stage_index = models.IntegerField(default=-1, help_text='-1 until the first batch is created')
    target_volunteers = models.PositiveIntegerField(default=1)
    remaining_coordination_need = models.PositiveIntegerField(default=1)
    batches_created = models.PositiveIntegerField(default=0)
    last_batch_at = models.DateTimeField(null=True, blank=True)
    last_evaluated_at = models.DateTimeField(null=True, blank=True)
    last_decision = models.JSONField(default=dict, blank=True)
    policy_snapshot = models.JSONField(null=True, blank=True)

    started_at = models.DateTimeField()
    closed_at = models.DateTimeField(null=True, blank=True)
    closure_reason = models.CharField(max_length=300, blank=True)
    reviewed_at = models.DateTimeField(null=True, blank=True)
    reviewed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL, related_name='+'
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']
        constraints = [
            models.CheckConstraint(
                condition=(
                    Q(is_simulation=True, blood_request__isnull=True, simulation_run__isnull=False)
                    | Q(is_simulation=False, simulation_run__isnull=True, blood_request__isnull=False)
                ),
                name='case_real_xor_simulated',
            ),
        ]

    def __str__(self):
        return f'{self.reference} [{self.status}]'

    @property
    def is_terminal(self):
        return self.status in TERMINAL_CASE_STATUSES

    def get_policy(self):
        if self.policy_snapshot:
            return Policy(self.policy_snapshot)
        return EscalationPolicy.active_policy()


class OutreachBatch(models.Model):
    case = models.ForeignKey(EmergencyCase, on_delete=models.CASCADE, related_name='batches')
    sequence = models.PositiveIntegerField()
    stage_index = models.IntegerField()
    trigger = models.CharField(max_length=20, choices=BatchTrigger.choices)
    planned_size = models.PositiveIntegerField(default=0)
    decision_reason = models.TextField(blank=True)
    created_at = models.DateTimeField()  # engine time (simulated clock for simulations)

    class Meta:
        ordering = ['sequence']
        constraints = [models.UniqueConstraint(fields=['case', 'sequence'], name='uniq_batch_sequence')]

    def __str__(self):
        return f'Batch {self.sequence} of {self.case.reference}'


class OutreachAttempt(models.Model):
    case = models.ForeignKey(EmergencyCase, on_delete=models.CASCADE, related_name='attempts')
    batch = models.ForeignKey(OutreachBatch, on_delete=models.CASCADE, related_name='attempts')
    donor = models.ForeignKey(
        'donors.DonorProfile', null=True, blank=True, on_delete=models.CASCADE, related_name='outreach_attempts'
    )
    sim_donor = models.ForeignKey(
        SimulatedDonor, null=True, blank=True, on_delete=models.CASCADE, related_name='outreach_attempts'
    )
    donor_match = models.ForeignKey(
        'matching.DonorMatch', null=True, blank=True, on_delete=models.SET_NULL, related_name='outreach_attempts'
    )
    stage_index = models.IntegerField()
    status = models.CharField(max_length=15, choices=AttemptStatus.choices, default=AttemptStatus.ALERTED)
    fulfilment = models.CharField(max_length=24, choices=Fulfilment.choices, default=Fulfilment.NONE)
    attempted_at = models.DateTimeField()
    viewed_at = models.DateTimeField(null=True, blank=True)
    responded_at = models.DateTimeField(null=True, blank=True)
    response_source = models.CharField(max_length=20, blank=True)  # donor_app | admin | simulation
    response_message = models.CharField(max_length=300, blank=True)
    rank_position = models.PositiveIntegerField(default=0)
    rank_score = models.FloatField(default=0)
    score_breakdown = models.JSONField(default=list, blank=True)
    explanation = models.TextField(blank=True)
    distance_km = models.FloatField(null=True, blank=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['batch__sequence', 'rank_position']
        constraints = [
            models.CheckConstraint(
                condition=(
                    Q(donor__isnull=False, sim_donor__isnull=True)
                    | Q(donor__isnull=True, sim_donor__isnull=False)
                ),
                name='attempt_exactly_one_donor_kind',
            ),
            models.UniqueConstraint(
                fields=['case', 'donor', 'stage_index'], condition=Q(donor__isnull=False),
                name='uniq_attempt_real_donor_stage',
            ),
            models.UniqueConstraint(
                fields=['case', 'sim_donor', 'stage_index'], condition=Q(sim_donor__isnull=False),
                name='uniq_attempt_sim_donor_stage',
            ),
        ]
        indexes = [models.Index(fields=['case', 'status'])]

    def __str__(self):
        return f'Attempt {self.pk} ({self.status}) for {self.case.reference}'


class EscalationEvent(models.Model):
    case = models.ForeignKey(EmergencyCase, on_delete=models.CASCADE, related_name='events')
    event_type = models.CharField(max_length=40, choices=EventType.choices)
    event_time = models.DateTimeField()  # engine time (simulated clock for simulations)
    created_at = models.DateTimeField(auto_now_add=True)
    previous_stage = models.IntegerField(null=True, blank=True)
    new_stage = models.IntegerField(null=True, blank=True)
    decision_reason = models.TextField(blank=True)
    details = models.JSONField(default=dict, blank=True)
    actor = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL, related_name='+'
    )
    batch = models.ForeignKey(OutreachBatch, null=True, blank=True, on_delete=models.SET_NULL, related_name='events')
    attempt = models.ForeignKey(OutreachAttempt, null=True, blank=True, on_delete=models.SET_NULL, related_name='events')
    simulation_flag = models.BooleanField(default=False)

    class Meta:
        ordering = ['event_time', 'id']
        indexes = [models.Index(fields=['case', 'event_time'])]

    def __str__(self):
        return f'{self.event_time:%Y-%m-%d %H:%M} {self.event_type} ({self.case.reference})'


class Experiment(models.Model):
    """Runs the same scenario + seeds through all three strategies."""
    scenario = models.CharField(max_length=40, choices=Scenario.choices)
    seeds = models.JSONField(default=list)
    results = models.JSONField(null=True, blank=True)
    rerun_of = models.ForeignKey('self', null=True, blank=True, on_delete=models.SET_NULL, related_name='reruns')
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL, related_name='+'
    )
    created_at = models.DateTimeField(default=timezone.now)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f'Experiment #{self.pk} {self.scenario} seeds={self.seeds}'
