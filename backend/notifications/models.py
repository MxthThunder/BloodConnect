from django.db import models
from django.conf import settings


class NotificationType(models.TextChoices):
    EMERGENCY_ALERT = 'EMERGENCY_ALERT', 'Emergency Donor Alert'
    STATUS_UPDATE = 'STATUS_UPDATE', 'Request Status Update'
    DONOR_RESPONSE = 'DONOR_RESPONSE', 'Donor Response Received'
    LOW_STOCK = 'LOW_STOCK', 'Blood Bank Low-Stock Warning'
    SYSTEM = 'SYSTEM', 'System Message'


class Notification(models.Model):
    recipient = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='notifications'
    )
    related_request = models.ForeignKey(
        'blood_requests.BloodRequest',
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name='notifications'
    )
    title = models.CharField(max_length=255)
    message = models.TextField()
    notification_type = models.CharField(
        max_length=30,
        choices=NotificationType.choices,
        default=NotificationType.SYSTEM
    )
    urgency = models.CharField(max_length=20, default='STANDARD')
    is_read = models.BooleanField(default=False)
    action_url = models.CharField(max_length=255, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        status = "Read" if self.is_read else "Unread"
        return f"[{self.notification_type}] {self.title} -> {self.recipient.email} ({status})"
