from rest_framework import serializers
from .models import AuditLog


class AuditLogSerializer(serializers.ModelSerializer):
    class Meta:
        model = AuditLog
        fields = [
            'id', 'actor_email', 'actor_role', 'action',
            'target_model', 'target_id', 'details', 'ip_address',
            'created_at'
        ]
