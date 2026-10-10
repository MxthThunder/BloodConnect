from django.db import models


class AlertStatus(models.TextChoices):
    QUEUED = 'QUEUED', 'Queued'
    DISPATCHED = 'DISPATCHED', 'Alert Dispatched'
    VIEWED = 'VIEWED', 'Viewed by Donor'
    ACCEPTED = 'ACCEPTED', 'Accepted by Donor'
    DECLINED = 'DECLINED', 'Declined by Donor'


class DonorMatch(models.Model):
    blood_request = models.ForeignKey(
        'blood_requests.BloodRequest',
        on_delete=models.CASCADE,
        related_name='matches'
    )
    donor = models.ForeignKey(
        'donors.DonorProfile',
        on_delete=models.CASCADE,
        related_name='request_matches'
    )
    compatibility_score = models.PositiveIntegerField(
        default=100,
        help_text="Calculated match score based on compatibility, proximity, and availability"
    )
    match_type = models.CharField(
        max_length=50,
        default='EXACT_MATCH',
        help_text="EXACT_MATCH or COMPATIBLE_SUBSTITUTE"
    )
    match_explanation = models.TextField(
        help_text="Transparent clinical and geographic matching rationale"
    )
    distance_km = models.FloatField(null=True, blank=True)
    alert_status = models.CharField(
        max_length=20,
        choices=AlertStatus.choices,
        default=AlertStatus.DISPATCHED
    )
    donor_response_message = models.TextField(blank=True)
    responded_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-compatibility_score', '-created_at']
        constraints = [
            models.UniqueConstraint(
                fields=['blood_request', 'donor'],
                name='unique_request_donor_match'
            )
        ]

    def __str__(self):
        return f"Match: {self.donor.blood_group} -> {self.blood_request.reference_number} ({self.alert_status})"
