from django.db import models
from django.conf import settings


class AuditLog(models.Model):
    actor = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name='audit_records'
    )
    actor_email = models.CharField(max_length=255, blank=True)
    actor_role = models.CharField(max_length=50, blank=True)
    action = models.CharField(
        max_length=120,
        help_text="Standardized action code e.g. REQUEST_APPROVED, STOCK_UPDATED"
    )
    target_model = models.CharField(max_length=100)
    target_id = models.CharField(max_length=100, blank=True)
    details = models.TextField(blank=True)
    ip_address = models.CharField(max_length=50, default='127.0.0.1')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"[{self.created_at}] {self.actor_email or 'System'} performed {self.action} on {self.target_model} #{self.target_id}"

    @classmethod
    def record(cls, actor, action, target_model, target_id='', details='', request=None):
        ip = '127.0.0.1'
        if request:
            ip = request.META.get('HTTP_X_FORWARDED_FOR', request.META.get('REMOTE_ADDR', '127.0.0.1'))
            if ip and ',' in ip:
                ip = ip.split(',')[0].strip()

        actor_email = actor.email if actor and actor.is_authenticated else 'Anonymous/System'
        actor_role = getattr(actor, 'role', 'system') if actor and actor.is_authenticated else 'system'

        return cls.objects.create(
            actor=actor if actor and actor.is_authenticated else None,
            actor_email=actor_email,
            actor_role=actor_role,
            action=action,
            target_model=target_model,
            target_id=str(target_id),
            details=details,
            ip_address=ip or '127.0.0.1'
        )
