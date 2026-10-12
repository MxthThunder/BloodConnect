from rest_framework import serializers
from django.contrib.auth import authenticate
from rest_framework.authtoken.models import Token
from django.db.models import Q
from .models import User, UserRole
from donors.models import DonorProfile
from accounts.constants import BloodGroup


class UserProfileSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = [
            'id', 'username', 'email', 'first_name', 'last_name',
            'role', 'phone', 'city', 'locality', 'is_verified',
            'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'email', 'role', 'created_at', 'updated_at']


class DonorProfileNestedSerializer(serializers.ModelSerializer):
    class Meta:
        model = DonorProfile
        fields = [
            'id', 'blood_group', 'city', 'locality', 'state',
            'approx_latitude', 'approx_longitude', 'is_available',
            'notification_consent', 'preferred_contact', 'is_medically_verified',
            'medical_verification_note', 'last_donation_date', 'total_donations',
            'last_profile_update'
        ]


class UserDetailWithProfileSerializer(serializers.ModelSerializer):
    donor_profile = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = [
            'id', 'username', 'email', 'first_name', 'last_name',
            'role', 'phone', 'city', 'locality', 'is_verified',
            'created_at', 'donor_profile'
        ]

    def get_donor_profile(self, obj):
        if hasattr(obj, 'donor_profile'):
            return DonorProfileNestedSerializer(obj.donor_profile).data
        return None


class RegisterSerializer(serializers.Serializer):
    email = serializers.EmailField()
    password = serializers.CharField(write_only=True, min_length=6)
    first_name = serializers.CharField(max_length=150)
    last_name = serializers.CharField(max_length=150, required=False, allow_blank=True)
    role = serializers.ChoiceField(choices=UserRole.choices, default=UserRole.REQUESTER)
    phone = serializers.CharField(max_length=20, required=False, allow_blank=True)
    city = serializers.CharField(max_length=100)
    locality = serializers.CharField(max_length=100)

    # Optional Donor fields if role is 'donor'
    blood_group = serializers.ChoiceField(choices=BloodGroup.choices, required=False)
    notification_consent = serializers.BooleanField(default=True, required=False)
    preferred_contact = serializers.CharField(default='in_app', required=False)

    def validate_email(self, value):
        norm_email = value.strip().lower()
        if User.objects.filter(email=norm_email).exists():
            raise serializers.ValidationError("An account with this email address already exists.")
        return norm_email

    def validate(self, attrs):
        if attrs.get('role') == UserRole.DONOR and not attrs.get('blood_group'):
            raise serializers.ValidationError({"blood_group": "Blood group is required when registering as a donor."})
        return attrs

    def create(self, validated_data):
        email = validated_data['email']
        role = validated_data.get('role', UserRole.REQUESTER)
        user = User.objects.create_user(
            username=email,
            email=email,
            password=validated_data['password'],
            first_name=validated_data.get('first_name', ''),
            last_name=validated_data.get('last_name', ''),
            role=role,
            phone=validated_data.get('phone', ''),
            city=validated_data.get('city', ''),
            locality=validated_data.get('locality', ''),
            is_verified=True
        )

        if role == UserRole.DONOR:
            DonorProfile.objects.create(
                user=user,
                blood_group=validated_data.get('blood_group', 'O+'),
                city=validated_data.get('city', ''),
                locality=validated_data.get('locality', ''),
                notification_consent=validated_data.get('notification_consent', True),
                preferred_contact=validated_data.get('preferred_contact', 'in_app')
            )

        token, _ = Token.objects.get_or_create(user=user)
        return user, token


class LoginSerializer(serializers.Serializer):
    email = serializers.CharField(required=False, allow_blank=True)
    username = serializers.CharField(required=False, allow_blank=True)
    password = serializers.CharField(write_only=True)

    def validate(self, attrs):
        identifier = attrs.get('email') or attrs.get('username') or ''
        identifier = identifier.strip()
        password = attrs.get('password')

        if not identifier:
            raise serializers.ValidationError("Please provide your username or email.")

        user_obj = User.objects.filter(
            Q(email__iexact=identifier) | Q(username__iexact=identifier)
        ).first()

        if user_obj and user_obj.check_password(password):
            user = user_obj
        else:
            user = None

        if not user:
            raise serializers.ValidationError("Invalid email/username or password.")
        if not user.is_active:
            raise serializers.ValidationError("Account is inactive or disabled.")

        attrs['user'] = user
        return attrs

