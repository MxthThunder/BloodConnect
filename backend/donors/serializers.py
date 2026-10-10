from rest_framework import serializers
from .models import DonorProfile, DonationHistory
from accounts.serializers import UserProfileSerializer


class DonationHistorySerializer(serializers.ModelSerializer):
    class Meta:
        model = DonationHistory
        fields = [
            'id', 'donation_date', 'facility_name', 'units',
            'component', 'certificate_ref', 'notes', 'created_at'
        ]


class DonorProfileSerializer(serializers.ModelSerializer):
    user_details = UserProfileSerializer(source='user', read_only=True)
    donation_history = DonationHistorySerializer(many=True, read_only=True)

    class Meta:
        model = DonorProfile
        fields = [
            'id', 'user_details', 'blood_group', 'city', 'locality', 'state',
            'approx_latitude', 'approx_longitude', 'is_available',
            'notification_consent', 'preferred_contact', 'is_medically_verified',
            'medical_verification_note', 'last_donation_date', 'total_donations',
            'last_profile_update', 'created_at', 'donation_history'
        ]
        read_only_fields = ['id', 'is_medically_verified', 'total_donations', 'created_at']


class DonorDirectorySerializer(serializers.ModelSerializer):
    display_name = serializers.SerializerMethodField()
    contact_phone = serializers.SerializerMethodField()

    class Meta:
        model = DonorProfile
        fields = [
            'id', 'display_name', 'blood_group', 'city', 'locality',
            'is_available', 'notification_consent', 'preferred_contact',
            'is_medically_verified', 'total_donations', 'last_profile_update',
            'contact_phone'
        ]

    def get_display_name(self, obj):
        # Respect privacy: show initials or first name for general display
        name = obj.user.get_full_name()
        if name:
            parts = name.split()
            if len(parts) > 1:
                return f"{parts[0]} {parts[1][0]}."
            return parts[0]
        return f"Donor #{obj.id}"

    def get_contact_phone(self, obj):
        # Only return phone if user allows contact or request is authenticated
        request = self.context.get('request')
        if request and request.user and (request.user.role == 'admin' or request.user.is_superuser):
            return obj.user.phone or "N/A"
        return "Protected (Consent-mediated)"
