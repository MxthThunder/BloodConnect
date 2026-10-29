import uuid

from django.conf import settings
from django.db import models
from django.db.models import Q
from django.utils import timezone

from .constants import CampStatus, EventKind, OrganisationType, PartnerStatus


def generate_camp_ref():
    return f"BC-CAMP-{uuid.uuid4().hex[:6].upper()}"


class CampApplication(models.Model):
    """An organisation's application to hold a blood donation camp, and (once approved) the public camp listing."""
    reference_number = models.CharField(max_length=25, unique=True, default=generate_camp_ref)
    organiser = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='camp_applications')

    organisation_name = models.CharField(max_length=150)
    organisation_type = models.CharField(max_length=12, choices=OrganisationType.choices)
    title = models.CharField(max_length=150)
    description = models.TextField(blank=True, help_text='Public: what the camp is about')

    venue_name = models.CharField(max_length=200)
    address = models.TextField()
    city = models.CharField(max_length=100, default='Chennai')
    locality = models.CharField(max_length=100)
    latitude = models.FloatField(null=True, blank=True)
    longitude = models.FloatField(null=True, blank=True)

    camp_date = models.DateField(db_index=True)
    start_time = models.TimeField()
    end_time = models.TimeField()
    expected_donors = models.PositiveIntegerField()
    facilities = models.JSONField(default=list, blank=True)
    facilities_notes = models.CharField(max_length=300, blank=True)

    # Private to organiser + administrators. Never shown in the public listing.
    contact_name = models.CharField(max_length=120)
    contact_phone = models.CharField(max_length=25)
    contact_email = models.EmailField(blank=True)
    # Public: how a donor registers or what to bring (organiser-written).
    registration_info = models.TextField(blank=True)

    status = models.CharField(max_length=24, choices=CampStatus.choices, default=CampStatus.SUBMITTED, db_index=True)
    partner_status = models.CharField(max_length=14, choices=PartnerStatus.choices, default=PartnerStatus.NOT_CONTACTED)
    partner = models.ForeignKey(
        'bloodbank.BloodBank', null=True, blank=True, on_delete=models.SET_NULL, related_name='camp_applications'
    )
    partner_name = models.CharField(max_length=200, blank=True, help_text='Authorised medical team, if not a listed blood bank')
    partner_support = models.JSONField(default=list, blank=True)
    partner_notes = models.TextField(blank=True, help_text='Internal')

    admin_notes = models.TextField(blank=True, help_text='Internal')
    rejection_reason = models.CharField(max_length=500, blank=True)
    cancellation_reason = models.CharField(max_length=500, blank=True)
    reviewed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL, related_name='+'
    )
    reviewed_at = models.DateTimeField(null=True, blank=True)
    approved_at = models.DateTimeField(null=True, blank=True)
    completed_at = models.DateTimeField(null=True, blank=True)
    actual_donors = models.PositiveIntegerField(null=True, blank=True, help_text='Recorded by an administrator after the camp')
    completion_notes = models.TextField(blank=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']
        constraints = [
            # Approval can never precede a confirmed partner (the platform must not promise medical support).
            models.CheckConstraint(
                condition=~Q(status__in=[CampStatus.APPROVED, CampStatus.COMPLETED]) | Q(partner_status=PartnerStatus.CONFIRMED),
                name='camp_confirmed_partner_required',
            ),
            models.CheckConstraint(
                condition=~Q(partner_status=PartnerStatus.CONFIRMED) | Q(partner__isnull=False) | ~Q(partner_name=''),
                name='camp_confirmed_partner_named',
            ),
            models.CheckConstraint(condition=Q(start_time__lt=models.F('end_time')), name='camp_start_before_end'),
        ]

    def __str__(self):
        return f'{self.reference_number} {self.title} [{self.status}]'

    @property
    def is_public(self):
        return self.status == CampStatus.APPROVED and self.camp_date >= timezone.localdate()

    @property
    def partner_display_name(self):
        if self.partner_id:
            return self.partner.name
        return self.partner_name


class CampEvent(models.Model):
    """Timeline of an application. `internal` events are visible to administrators only."""
    application = models.ForeignKey(CampApplication, on_delete=models.CASCADE, related_name='events')
    kind = models.CharField(max_length=12, choices=EventKind.choices)
    from_status = models.CharField(max_length=24, blank=True)
    to_status = models.CharField(max_length=24, blank=True)
    message = models.CharField(max_length=600, blank=True)
    internal = models.BooleanField(default=False)
    actor = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL, related_name='+')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['created_at', 'id']

    def __str__(self):
        return f'{self.application.reference_number} {self.kind} {self.to_status}'


class CampInterest(models.Model):
    """A signed-in person saying they intend to take part in an approved camp (not a booking)."""
    application = models.ForeignKey(CampApplication, on_delete=models.CASCADE, related_name='interests')
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='camp_interests')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']
        constraints = [models.UniqueConstraint(fields=['application', 'user'], name='uniq_camp_interest_per_user')]

    def __str__(self):
        return f'{self.user_id} -> {self.application.reference_number}'
