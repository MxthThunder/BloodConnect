from rest_framework import serializers
from .models import BloodRequest, VerificationStatus, RequestStatus
from accounts.serializers import UserProfileSerializer


class BloodRequestListSerializer(serializers.ModelSerializer):
    requester_name = serializers.CharField(source='requester.get_full_name', read_only=True)
    responses_count = serializers.IntegerField(read_only=True)
    accepted_responses_count = serializers.IntegerField(read_only=True)

    class Meta:
        model = BloodRequest
        fields = [
            'id', 'reference_number', 'requester_name', 'patient_case_ref',
            'blood_group', 'component', 'units_requested', 'hospital_name',
            'city', 'locality', 'urgency', 'required_by',
            'verification_status', 'request_status', 'responses_count',
            'accepted_responses_count', 'created_at'
        ]


class BloodRequestDetailSerializer(serializers.ModelSerializer):
    requester_details = UserProfileSerializer(source='requester', read_only=True)
    verified_by_name = serializers.CharField(source='verified_by.get_full_name', read_only=True)
    responses_count = serializers.IntegerField(read_only=True)
    accepted_responses_count = serializers.IntegerField(read_only=True)

    class Meta:
        model = BloodRequest
        fields = [
            'id', 'reference_number', 'requester', 'requester_details',
            'patient_case_ref', 'blood_group', 'component', 'units_requested',
            'hospital_name', 'hospital_address', 'city', 'locality',
            'hospital_lat', 'hospital_lng', 'urgency', 'required_by',
            'reason', 'contact_phone', 'contact_preference',
            'verification_status', 'request_status', 'verified_by',
            'verified_by_name', 'verified_at', 'verification_notes',
            'fulfillment_notes', 'responses_count', 'accepted_responses_count',
            'created_at', 'updated_at'
        ]
        read_only_fields = [
            'id', 'reference_number', 'requester', 'verification_status',
            'request_status', 'verified_by', 'verified_at', 'created_at', 'updated_at'
        ]


class BloodRequestCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = BloodRequest
        fields = [
            'id', 'reference_number', 'patient_case_ref', 'blood_group',
            'component', 'units_requested', 'hospital_name',
            'hospital_address', 'city', 'locality', 'hospital_lat',
            'hospital_lng', 'urgency', 'required_by', 'reason',
            'contact_phone', 'contact_preference', 'verification_status',
            'request_status', 'created_at'
        ]
        read_only_fields = [
            'id', 'reference_number', 'verification_status',
            'request_status', 'created_at'
        ]

    def validate_units_requested(self, value):
        if value < 1 or value > 50:
            raise serializers.ValidationError("Requested blood units must be between 1 and 50.")
        return value

    def create(self, validated_data):
        request = self.context['request']
        validated_data['requester'] = request.user
        validated_data['verification_status'] = VerificationStatus.PENDING
        validated_data['request_status'] = RequestStatus.PENDING_VERIFICATION
        return super().create(validated_data)


class BloodRequestVerifySerializer(serializers.Serializer):
    action = serializers.ChoiceField(choices=['APPROVE', 'REJECT'])
    notes = serializers.CharField(required=False, allow_blank=True)
