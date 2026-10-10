from django.db import models
from django.conf import settings
from accounts.constants import BloodGroup, BloodComponent


class ContactPreference(models.TextChoices):
    IN_APP = 'in_app', 'In-App Alerts'
    PHONE = 'phone', 'Phone Call'
    SMS = 'sms', 'Simulated SMS'
    EMAIL = 'email', 'Email Notification'


class DonorProfile(models.Model):
    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='donor_profile'
    )
    blood_group = models.CharField(
        max_length=5,
        choices=BloodGroup.choices
    )
    city = models.CharField(max_length=100)
    locality = models.CharField(max_length=100)
    state = models.CharField(max_length=100, default='Tamil Nadu')
    approx_latitude = models.FloatField(null=True, blank=True)
    approx_longitude = models.FloatField(null=True, blank=True)
    is_available = models.BooleanField(
        default=True,
        help_text="Whether donor is currently willing and able to be matched"
    )
    notification_consent = models.BooleanField(
        default=True,
        help_text="Explicit consent to receive emergency donor alerts"
    )
    preferred_contact = models.CharField(
        max_length=20,
        choices=ContactPreference.choices,
        default=ContactPreference.IN_APP
    )
    is_medically_verified = models.BooleanField(
        default=False,
        help_text="Clinical eligibility verified by authorized blood bank staff"
    )
    medical_verification_note = models.CharField(
        max_length=255,
        default="Potential donor match — final suitability and compatibility must be confirmed by authorized blood bank."
    )
    last_donation_date = models.DateField(null=True, blank=True)
    total_donations = models.PositiveIntegerField(default=0)
    last_profile_update = models.DateTimeField(auto_now=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-last_profile_update']

    def __str__(self):
        status = "Available" if self.is_available else "Unavailable"
        return f"{self.user.get_full_name() or self.user.username} ({self.blood_group}) - {self.city} [{status}]"


class DonationHistory(models.Model):
    donor = models.ForeignKey(
        DonorProfile,
        on_delete=models.CASCADE,
        related_name='donation_history'
    )
    donation_date = models.DateField()
    facility_name = models.CharField(max_length=200)
    units = models.PositiveIntegerField(default=1)
    component = models.CharField(
        max_length=50,
        choices=BloodComponent.choices,
        default=BloodComponent.WHOLE_BLOOD
    )
    certificate_ref = models.CharField(max_length=50, blank=True)
    notes = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-donation_date']

    def __str__(self):
        return f"{self.donor.user.username} - {self.units} unit(s) at {self.facility_name} on {self.donation_date}"
