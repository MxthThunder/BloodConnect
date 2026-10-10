from rest_framework import serializers
from .models import Notification


class NotificationSerializer(serializers.ModelSerializer):
    recipient_email = serializers.CharField(source='recipient.email', read_only=True)
    recipient_name = serializers.CharField(source='recipient.get_full_name', read_only=True)
    request_reference = serializers.CharField(source='related_request.reference_number', read_only=True)

    class Meta:
        model = Notification
        fields = [
            'id', 'recipient', 'recipient_email', 'recipient_name',
            'related_request', 'request_reference', 'title', 'message',
            'notification_type', 'urgency', 'is_read', 'action_url',
            'created_at'
        ]
        read_only_fields = ['id', 'recipient', 'related_request', 'title', 'message', 'notification_type', 'created_at']
