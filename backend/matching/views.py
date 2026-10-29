from rest_framework import status, views, permissions, generics
from rest_framework.response import Response
from django.utils import timezone
from .models import DonorMatch, AlertStatus
from .serializers import DonorMatchSerializer, DonorAlertResponseSerializer
from blood_requests.models import BloodRequest, RequestStatus
from notifications.models import Notification, NotificationType
from audit.models import AuditLog
from accounts.permissions import IsAdminUserRole
from escalation import hooks as escalation_hooks


class RequestMatchesListView(generics.ListAPIView):
    """
    Returns all potential donor matches for a specific blood request.
    Restricted to request owner and administrators.
    """
    permission_classes = [permissions.IsAuthenticated]
    serializer_class = DonorMatchSerializer

    def get_queryset(self):
        request_id = self.kwargs['request_id']
        try:
            blood_req = BloodRequest.objects.get(pk=request_id)
        except BloodRequest.DoesNotExist:
            return DonorMatch.objects.none()

        user = self.request.user
        if user.role != 'admin' and not user.is_superuser and blood_req.requester != user:
            return DonorMatch.objects.none()

        return DonorMatch.objects.filter(blood_request=blood_req).select_related('donor', 'donor__user', 'blood_request')


class DonorAlertsListView(generics.ListAPIView):
    """
    Returns emergency alert invitations sent to the currently logged-in donor.
    """
    permission_classes = [permissions.IsAuthenticated]
    serializer_class = DonorMatchSerializer

    def get_queryset(self):
        try:
            profile = self.request.user.donor_profile
            return DonorMatch.objects.filter(donor=profile).select_related('blood_request', 'donor', 'donor__user').order_by('-created_at')
        except Exception:
            return DonorMatch.objects.none()


class DonorAlertDetailView(views.APIView):
    """
    Retrieve single alert detail for donor. Automatically marks status as VIEWED if previously DISPATCHED.
    """
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, pk):
        try:
            match = DonorMatch.objects.select_related('blood_request', 'donor', 'donor__user').get(pk=pk)
        except DonorMatch.DoesNotExist:
            return Response({'error': 'Alert match not found'}, status=status.HTTP_404_NOT_FOUND)

        # Check permission: must be recipient donor or admin
        if request.user.role != 'admin' and not request.user.is_superuser:
            if not hasattr(request.user, 'donor_profile') or match.donor != request.user.donor_profile:
                return Response({'error': 'Unauthorized to view this alert'}, status=status.HTTP_403_FORBIDDEN)

        # Mark as VIEWED if DISPATCHED
        if match.alert_status == AlertStatus.DISPATCHED:
            match.alert_status = AlertStatus.VIEWED
            match.save()
            escalation_hooks.on_donor_viewed(match)

        serializer = DonorMatchSerializer(match, context={'request': request})
        return Response(serializer.data)


class DonorAlertResponseView(views.APIView):
    """
    Donor accepts or declines an emergency blood donation alert.
    """
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, pk):
        try:
            match = DonorMatch.objects.select_related('blood_request', 'donor', 'donor__user').get(pk=pk)
        except DonorMatch.DoesNotExist:
            return Response({'error': 'Alert not found'}, status=status.HTTP_404_NOT_FOUND)

        if not hasattr(request.user, 'donor_profile') or match.donor != request.user.donor_profile:
            return Response({'error': 'Unauthorized to respond to this alert'}, status=status.HTTP_403_FORBIDDEN)

        serializer = DonorAlertResponseSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        resp = serializer.validated_data['response']
        msg = serializer.validated_data.get('message', '')

        match.alert_status = AlertStatus.ACCEPTED if resp == 'ACCEPTED' else AlertStatus.DECLINED
        match.donor_response_message = msg
        match.responded_at = timezone.now()
        match.save()

        req = match.blood_request
        # Feed the response into the escalation engine (recalculates the remaining need, may trigger a batch)
        escalation_hooks.on_donor_response(match, resp, msg)

        if resp == 'ACCEPTED':
            # Update blood request status if not already fulfilled or closed
            if req.request_status in [RequestStatus.ACTIVE_ALERTS_SENT, RequestStatus.PENDING_VERIFICATION, RequestStatus.MATCHING]:
                req.request_status = RequestStatus.DONOR_RESPONDED
                req.save()

            donor_name = request.user.get_full_name() or f"Donor #{match.donor.id}"
            
            # Notify requester
            Notification.objects.create(
                recipient=req.requester,
                related_request=req,
                title=f"Potential Donor Accepted Your Alert ({req.reference_number})",
                message=(
                    f"A registered donor ({match.donor.blood_group}) has responded ACCEPT to your emergency request "
                    f"for {req.hospital_name}. Note: Final clinical suitability must be verified by the blood bank."
                ),
                notification_type=NotificationType.DONOR_RESPONSE,
                urgency=req.urgency,
                action_url=f"/requester/requests/{req.id}"
            )

        AuditLog.record(
            actor=request.user,
            action='DONOR_ALERT_RESPONSE',
            target_model='DonorMatch',
            target_id=match.id,
            details=f"Donor {request.user.email} responded {resp} for request {req.reference_number}",
            request=request
        )

        return Response({
            'message': f"Response recorded: {resp}",
            'match': DonorMatchSerializer(match, context={'request': request}).data
        })


class AdminMatchingOverviewView(generics.ListAPIView):
    """
    Administrator view of all donor matches across all requests.
    """
    permission_classes = [IsAdminUserRole]
    serializer_class = DonorMatchSerializer

    def get_queryset(self):
        queryset = DonorMatch.objects.all().select_related('blood_request', 'donor', 'donor__user').order_by('-created_at')
        status_filter = self.request.query_params.get('status')
        if status_filter:
            queryset = queryset.filter(alert_status=status_filter)
        return queryset
