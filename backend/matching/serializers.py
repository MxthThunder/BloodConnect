from rest_framework import serializers
from .models import DonorMatch, AlertStatus
from blood_requests.serializers import BloodRequestListSerializer
from donors.serializers import DonorDirectorySerializer


class DonorMatchSerializer(serializers.ModelSerializer):
    donor_details = DonorDirectorySerializer(source='donor', read_only=True)
    request_details = BloodRequestListSerializer(source='blood_request', read_only=True)
    request_reference = serializers.CharField(source='blood_request.reference_number', read_only=True)

    class Meta:
        model = DonorMatch
        fields = [
            'id', 'blood_request', 'request_reference', 'donor',
            'donor_details', 'request_details', 'compatibility_score',
            'match_type', 'match_explanation', 'distance_km',
            'alert_status', 'donor_response_message', 'responded_at',
            'created_at', 'updated_at'
        ]
        read_only_fields = [
            'id', 'blood_request', 'donor', 'compatibility_score',
            'match_type', 'match_explanation', 'distance_km',
            'created_at', 'updated_at'
        ]


class DonorAlertResponseSerializer(serializers.Serializer):
    response = serializers.ChoiceField(choices=['ACCEPTED', 'DECLINED'])
    message = serializers.CharField(required=False, allow_blank=True)
