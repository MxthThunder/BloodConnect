from rest_framework import status, views, permissions, generics
from rest_framework.response import Response
from .models import DonorProfile, DonationHistory
from .serializers import (
    DonorProfileSerializer,
    DonorDirectorySerializer,
    DonationHistorySerializer
)
from blood_requests.models import BloodRequest
from blood_requests.serializers import BloodRequestListSerializer
from accounts.permissions import IsDonorUserRole, IsAdminUserRole
from audit.models import AuditLog


class DonorProfileView(views.APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        try:
            profile = request.user.donor_profile
            serializer = DonorProfileSerializer(profile, context={'request': request})
            return Response(serializer.data)
        except DonorProfile.DoesNotExist:
            return Response(
                {'error': 'No donor profile associated with this account. Register as a donor to create one.'},
                status=status.HTTP_404_NOT_FOUND
            )

    def put(self, request):
        try:
            profile = request.user.donor_profile
        except DonorProfile.DoesNotExist:
            # If user has role donor, create profile
            profile = DonorProfile.objects.create(
                user=request.user,
                blood_group=request.data.get('blood_group', 'O+'),
                city=request.user.city or 'Bengaluru',
                locality=request.user.locality or 'Central'
            )

        serializer = DonorProfileSerializer(profile, data=request.data, partial=True)
        if serializer.is_valid():
            serializer.save()
            AuditLog.record(
                actor=request.user,
                action='UPDATE_DONOR_PROFILE',
                target_model='DonorProfile',
                target_id=profile.id,
                details=f"Updated profile: availability={profile.is_available}, blood={profile.blood_group}",
                request=request
            )
            return Response(DonorProfileSerializer(profile, context={'request': request}).data)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class ToggleAvailabilityView(views.APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        try:
            profile = request.user.donor_profile
            profile.is_available = not profile.is_available
            profile.save()
            AuditLog.record(
                actor=request.user,
                action='TOGGLE_AVAILABILITY',
                target_model='DonorProfile',
                target_id=profile.id,
                details=f"Availability toggled to {profile.is_available}",
                request=request
            )
            return Response({
                'is_available': profile.is_available,
                'message': f"Status updated to {'Available' if profile.is_available else 'Unavailable'}"
            })
        except DonorProfile.DoesNotExist:
            return Response({'error': 'Donor profile not found'}, status=status.HTTP_404_NOT_FOUND)


class DonationHistoryListView(generics.ListCreateAPIView):
    permission_classes = [permissions.IsAuthenticated]
    serializer_class = DonationHistorySerializer

    def get_queryset(self):
        try:
            profile = self.request.user.donor_profile
            return DonationHistory.objects.filter(donor=profile)
        except DonorProfile.DoesNotExist:
            return DonationHistory.objects.none()

    def perform_create(self, serializer):
        profile = self.request.user.donor_profile
        history_record = serializer.save(donor=profile)
        # Update donor total donations
        profile.total_donations = profile.donation_history.count()
        profile.last_donation_date = history_record.donation_date
        profile.save()
        AuditLog.record(
            actor=self.request.user,
            action='RECORD_DONATION',
            target_model='DonationHistory',
            target_id=history_record.id,
            details=f"Recorded donation of {history_record.units} units at {history_record.facility_name}",
            request=self.request
        )


class DonorDirectoryListView(generics.ListAPIView):
    permission_classes = [permissions.IsAuthenticated]
    serializer_class = DonorDirectorySerializer

    def get_queryset(self):
        queryset = DonorProfile.objects.all().select_related('user')
        blood_group = self.request.query_params.get('blood_group')
        city = self.request.query_params.get('city')
        available_only = self.request.query_params.get('available')

        if blood_group:
            queryset = queryset.filter(blood_group=blood_group)
        if city:
            queryset = queryset.filter(city__icontains=city)
        if available_only == 'true':
            queryset = queryset.filter(is_available=True)

        return queryset


class DonorRelevantRequestsView(generics.ListAPIView):
    """
    Returns active, approved emergency blood requests that are compatible with this donor.
    """
    permission_classes = [permissions.IsAuthenticated]
    serializer_class = BloodRequestListSerializer

    def get_queryset(self):
        try:
            profile = self.request.user.donor_profile
            from matching.services import COMPATIBLE_DONORS_MAP
            # Find all recipient blood groups that this donor can give to
            recipient_groups = [
                rec_bg for rec_bg, donors in COMPATIBLE_DONORS_MAP.items()
                if profile.blood_group in donors
            ]
            return BloodRequest.objects.filter(
                verification_status='APPROVED',
                request_status__in=['ACTIVE_ALERTS_SENT', 'DONOR_RESPONDED'],
                blood_group__in=recipient_groups
            ).order_by('-urgency', '-created_at')
        except DonorProfile.DoesNotExist:
            return BloodRequest.objects.none()
