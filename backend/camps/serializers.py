from datetime import timedelta

from django.utils import timezone
from rest_framework import serializers

from accounts.constants import CHENNAI_LOCALITIES
from .constants import (
    CHENNAI_BOUNDS, FACILITY_LABELS, MAX_EXPECTED_DONORS, MAX_LEAD_DAYS, MIN_EXPECTED_DONORS, MIN_LEAD_DAYS,
    OrganisationType, SUPPORT_LABELS,
)

PHONE_RE = r'^[+0-9][0-9 \-()]{6,19}$'


class CampWriteSerializer(serializers.Serializer):
    """Organiser input for a new application, or an edit while it is still SUBMITTED."""
    organisation_name = serializers.CharField(max_length=150)
    organisation_type = serializers.ChoiceField(choices=OrganisationType.choices)
    title = serializers.CharField(max_length=150)
    description = serializers.CharField(max_length=2000, required=False, allow_blank=True)
    venue_name = serializers.CharField(max_length=200)
    address = serializers.CharField(max_length=500)
    locality = serializers.CharField(max_length=100)
    latitude = serializers.FloatField(required=False, allow_null=True)
    longitude = serializers.FloatField(required=False, allow_null=True)
    camp_date = serializers.DateField()
    start_time = serializers.TimeField()
    end_time = serializers.TimeField()
    expected_donors = serializers.IntegerField(min_value=MIN_EXPECTED_DONORS, max_value=MAX_EXPECTED_DONORS)
    facilities = serializers.ListField(child=serializers.CharField(), required=False)
    facilities_notes = serializers.CharField(max_length=300, required=False, allow_blank=True)
    contact_name = serializers.CharField(max_length=120)
    contact_phone = serializers.RegexField(PHONE_RE, max_length=25, error_messages={'invalid': 'Enter a valid phone number.'})
    contact_email = serializers.EmailField(required=False, allow_blank=True)
    registration_info = serializers.CharField(max_length=2000, required=False, allow_blank=True)

    def validate_locality(self, value):
        if value not in CHENNAI_LOCALITIES:
            raise serializers.ValidationError('Choose one of the supported Chennai localities.')
        return value

    def validate_camp_date(self, value):
        today = timezone.localdate()
        if value < today + timedelta(days=MIN_LEAD_DAYS):
            raise serializers.ValidationError(
                f'Allow at least {MIN_LEAD_DAYS} days so a medical partner can be arranged.')
        if value > today + timedelta(days=MAX_LEAD_DAYS):
            raise serializers.ValidationError(f'The date must be within {MAX_LEAD_DAYS} days from today.')
        return value

    def validate_facilities(self, value):
        unknown = [v for v in value if v not in FACILITY_LABELS]
        if unknown:
            raise serializers.ValidationError(f'Unknown facilities: {", ".join(unknown)}')
        return sorted(set(value))

    def validate(self, attrs):
        start, end = attrs.get('start_time'), attrs.get('end_time')
        if start and end and start >= end:
            raise serializers.ValidationError({'end_time': 'The end time must be after the start time.'})
        lat, lng = attrs.get('latitude'), attrs.get('longitude')
        if (lat is None) != (lng is None):
            raise serializers.ValidationError({'latitude': 'Provide both latitude and longitude, or neither.'})
        if lat is not None:
            (lat_lo, lat_hi), (lng_lo, lng_hi) = CHENNAI_BOUNDS['lat'], CHENNAI_BOUNDS['lng']
            if not (lat_lo <= lat <= lat_hi and lng_lo <= lng <= lng_hi):
                raise serializers.ValidationError({'latitude': 'These coordinates are outside the Chennai area.'})
        return attrs


class PartnerSerializer(serializers.Serializer):
    partner_status = serializers.ChoiceField(choices=[
        'NOT_CONTACTED', 'CONTACTED', 'CONFIRMED', 'DECLINED',
    ])
    partner_id = serializers.IntegerField(required=False, allow_null=True)
    partner_name = serializers.CharField(max_length=200, required=False, allow_blank=True)
    partner_support = serializers.ListField(child=serializers.CharField(), required=False)
    partner_notes = serializers.CharField(max_length=2000, required=False, allow_blank=True)
    note = serializers.CharField(max_length=500, required=False, allow_blank=True)

    def validate_partner_support(self, value):
        unknown = [v for v in value if v not in SUPPORT_LABELS]
        if unknown:
            raise serializers.ValidationError(f'Unknown support types: {", ".join(unknown)}')
        return sorted(set(value))
