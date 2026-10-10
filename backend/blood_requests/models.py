import uuid
from django.db import models
from django.conf import settings
from accounts.constants import BloodGroup, BloodComponent, UrgencyLevel


class VerificationStatus(models.TextChoices):
    PENDING = 'PENDING', 'Pending Verification'
    APPROVED = 'APPROVED', 'Approved by Administrator'
    REJECTED = 'REJECTED', 'Rejected'


class RequestStatus(models.TextChoices):
    PENDING_VERIFICATION = 'PENDING_VERIFICATION', 'Pending Verification'
    MATCHING = 'MATCHING', 'Matching Donors'
    ACTIVE_ALERTS_SENT = 'ACTIVE_ALERTS_SENT', 'Alerts Dispatched'
    DONOR_RESPONDED = 'DONOR_RESPONDED', 'Donor Response Received'
    FULFILLED = 'FULFILLED', 'Fulfilled'
    CANCELLED = 'CANCELLED', 'Cancelled'
    CLOSED = 'CLOSED', 'Closed'


def generate_ref_number():
    random_hex = uuid.uuid4().hex[:6].upper()
    return f"BC-REQ-{random_hex}"


class BloodRequest(models.Model):
    reference_number = models.CharField(
        max_length=25,
        unique=True,
        default=generate_ref_number
    )
    requester = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='blood_requests'
    )
    patient_case_ref = models.CharField(
        max_length=60,
        blank=True,
        help_text="Anonymized hospital case reference or bed ID"
    )
    blood_group = models.CharField(
        max_length=5,
        choices=BloodGroup.choices
    )
    component = models.CharField(
        max_length=50,
        choices=BloodComponent.choices,
        default=BloodComponent.WHOLE_BLOOD
    )
    units_requested = models.PositiveIntegerField(default=1)
    hospital_name = models.CharField(max_length=200)
    hospital_address = models.TextField()
    city = models.CharField(max_length=100)
    locality = models.CharField(max_length=100)
    hospital_lat = models.FloatField(null=True, blank=True)
    hospital_lng = models.FloatField(null=True, blank=True)
    urgency = models.CharField(
        max_length=20,
        choices=UrgencyLevel.choices,
        default=UrgencyLevel.URGENT
    )
    required_by = models.DateTimeField()
    reason = models.TextField(
        blank=True,
        help_text="Clinical justification (e.g. emergency surgery, trauma, oncology transfusion)"
    )
    contact_phone = models.CharField(max_length=25)
    contact_preference = models.CharField(
        max_length=30,
        default='phone',
        choices=[
            ('phone', 'Phone Call'),
            ('in_app', 'In-App Coordination'),
            ('hospital_desk', 'Hospital Blood Bank Desk')
        ]
    )
    verification_status = models.CharField(
        max_length=20,
        choices=VerificationStatus.choices,
        default=VerificationStatus.PENDING
    )
    request_status = models.CharField(
        max_length=25,
        choices=RequestStatus.choices,
        default=RequestStatus.PENDING_VERIFICATION
    )
    verified_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name='verified_requests'
    )
    verified_at = models.DateTimeField(null=True, blank=True)
    verification_notes = models.TextField(blank=True)
    fulfillment_notes = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.reference_number} - {self.blood_group} ({self.units_requested} units) at {self.hospital_name}"

    @property
    def responses_count(self):
        return self.matches.filter(alert_status__in=['ACCEPTED', 'DECLINED']).count()

    @property
    def accepted_responses_count(self):
        return self.matches.filter(alert_status='ACCEPTED').count()
