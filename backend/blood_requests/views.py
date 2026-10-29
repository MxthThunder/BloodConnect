from datetime import timedelta

from rest_framework import status, views, permissions, generics
from rest_framework.response import Response
from django.utils import timezone
from .models import BloodRequest, VerificationStatus, RequestStatus
from .serializers import (
    BloodRequestListSerializer,
    BloodRequestDetailSerializer,
    BloodRequestCreateSerializer,
    BloodRequestVerifySerializer
)
from matching.services import run_donor_matching
from escalation import hooks as escalation_hooks
from escalation.models import EmergencyCase
from escalation.service import EscalationError, service as escalation_service, validate_request_for_escalation
from notifications.models import Notification, NotificationType
from audit.models import AuditLog
from accounts.permissions import IsAdminUserRole


class BloodRequestListCreateView(generics.ListCreateAPIView):
    permission_classes = [permissions.IsAuthenticated]

    def get_serializer_class(self):
        if self.request.method == 'POST':
            return BloodRequestCreateSerializer
        return BloodRequestListSerializer

    def get_queryset(self):
        user = self.request.user
        queryset = BloodRequest.objects.all().select_related('requester').prefetch_related('matches')

        # If normal requester, only return their own requests unless admin
        if user.role != 'admin' and not user.is_superuser:
            queryset = queryset.filter(requester=user)

        # Apply filters
        status_filter = self.request.query_params.get('status')
        verification_filter = self.request.query_params.get('verification')
        urgency_filter = self.request.query_params.get('urgency')
        blood_group = self.request.query_params.get('blood_group')

        if status_filter:
            queryset = queryset.filter(request_status=status_filter)
        if verification_filter:
            queryset = queryset.filter(verification_status=verification_filter)
        if urgency_filter:
            queryset = queryset.filter(urgency=urgency_filter)
        if blood_group:
            queryset = queryset.filter(blood_group=blood_group)

        return queryset.order_by('-created_at')

    def perform_create(self, serializer):
        req = serializer.save()
        AuditLog.record(
            actor=self.request.user,
            action='CREATE_BLOOD_REQUEST',
            target_model='BloodRequest',
            target_id=req.id,
            details=f"Created request {req.reference_number} for {req.blood_group} ({req.units_requested} units) at {req.hospital_name}",
            request=self.request
        )

        # Notify admins that a new request requires verification
        from accounts.models import User
        admin_users = User.objects.filter(role='admin') | User.objects.filter(is_superuser=True)
        for admin in admin_users.distinct():
            Notification.objects.create(
                recipient=admin,
                related_request=req,
                title=f"New Blood Request Submitted: {req.reference_number}",
                message=f"Requester {req.requester.get_full_name() or req.requester.email} requested {req.units_requested} units of {req.blood_group} at {req.hospital_name}. Requires administrator verification.",
                notification_type=NotificationType.STATUS_UPDATE,
                urgency=req.urgency,
                action_url=f"/admin-portal/verification-queue"
            )


class BloodRequestDetailView(generics.RetrieveUpdateAPIView):
    permission_classes = [permissions.IsAuthenticated]
    serializer_class = BloodRequestDetailSerializer
    queryset = BloodRequest.objects.all().select_related('requester', 'verified_by').prefetch_related('matches')

    def check_object_permissions(self, request, obj):
        super().check_object_permissions(request, obj)
        # Users can view their own requests or admins can view all
        if request.user.role != 'admin' and not request.user.is_superuser:
            if obj.requester != request.user:
                self.permission_denied(request, message="You do not have permission to access this blood request.")


class BloodRequestCancelView(views.APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, pk):
        try:
            req = BloodRequest.objects.get(pk=pk)
        except BloodRequest.DoesNotExist:
            return Response({'error': 'Blood request not found'}, status=status.HTTP_404_NOT_FOUND)

        if request.user.role != 'admin' and not request.user.is_superuser and req.requester != request.user:
            return Response({'error': 'Unauthorized to cancel this request'}, status=status.HTTP_403_FORBIDDEN)

        if req.request_status in [RequestStatus.FULFILLED, RequestStatus.CLOSED, RequestStatus.CANCELLED]:
            return Response({'error': f'Request cannot be cancelled in status: {req.request_status}'}, status=status.HTTP_400_BAD_REQUEST)

        req.request_status = RequestStatus.CANCELLED
        req.save()
        # Stop any further outreach / escalation for this request
        escalation_hooks.on_request_cancelled(req, request.user)

        AuditLog.record(
            actor=request.user,
            action='CANCEL_BLOOD_REQUEST',
            target_model='BloodRequest',
            target_id=req.id,
            details=f"Cancelled request {req.reference_number}",
            request=request
        )

        return Response({'message': 'Blood request cancelled successfully', 'status': req.request_status})


class BloodRequestVerifyView(views.APIView):
    """
    Administrator endpoint to approve or reject emergency blood requests.
    Upon approval, triggers the donor matching engine and dispatches notifications.
    """
    permission_classes = [IsAdminUserRole]

    def post(self, request, pk):
        try:
            req = BloodRequest.objects.get(pk=pk)
        except BloodRequest.DoesNotExist:
            return Response({'error': 'Blood request not found'}, status=status.HTTP_404_NOT_FOUND)

        serializer = BloodRequestVerifySerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        action = serializer.validated_data['action']
        notes = serializer.validated_data.get('notes', '')

        if action == 'APPROVE':
            problems = validate_request_for_escalation(req)
            grace = escalation_service.policy_for_new().expiry_grace_minutes
            if req.required_by and req.required_by + timedelta(minutes=grace) <= timezone.now():
                problems.append('The required time for this request has already passed.')
            if problems:
                return Response({'error': 'Request cannot be approved: ' + ' '.join(problems)},
                                status=status.HTTP_400_BAD_REQUEST)
            req.verification_status = VerificationStatus.APPROVED
            req.request_status = RequestStatus.ACTIVE_ALERTS_SENT
            req.verified_by = request.user
            req.verified_at = timezone.now()
            req.verification_notes = notes
            req.save()

            # Start adaptive coordination: rank candidates and alert the initial batch only
            case = escalation_service.start_case_for_request(req, actor=request.user)
            matches = list(case.attempts.all())

            # Notify requester
            Notification.objects.create(
                recipient=req.requester,
                related_request=req,
                title=f"Blood Request Approved ({req.reference_number})",
                message=(
                    f"Your emergency request for {req.units_requested} unit(s) of {req.blood_group} at "
                    f"{req.hospital_name} has been verified by the administrator. "
                    f"Emergency alerts have been sent to {len(matches)} potential donors in the initial search area; "
                    f"the search widens automatically if more volunteers are needed."
                ),
                notification_type=NotificationType.STATUS_UPDATE,
                urgency=req.urgency,
                action_url=f"/requester/requests/{req.id}"
            )

            AuditLog.record(
                actor=request.user,
                action='APPROVE_BLOOD_REQUEST',
                target_model='BloodRequest',
                target_id=req.id,
                details=f"Approved request {req.reference_number}. Dispatched {len(matches)} alerts. Notes: {notes}",
                request=request
            )

            return Response({
                'message': f'Blood request approved. {len(matches)} potential donors alerted in the initial search '
                           f'stage; adaptive escalation will widen the search if more volunteers are needed.',
                'matches_count': len(matches),
                'escalation_case_id': case.id,
                'request': BloodRequestDetailSerializer(req).data
            })

        elif action == 'REJECT':
            req.verification_status = VerificationStatus.REJECTED
            req.request_status = RequestStatus.CLOSED
            req.verified_by = request.user
            req.verified_at = timezone.now()
            req.verification_notes = notes
            req.save()

            # Notify requester
            Notification.objects.create(
                recipient=req.requester,
                related_request=req,
                title=f"Blood Request Not Approved ({req.reference_number})",
                message=f"Your request for {req.blood_group} at {req.hospital_name} was rejected. Note: {notes or 'Incomplete verification data.'}",
                notification_type=NotificationType.STATUS_UPDATE,
                urgency='STANDARD',
                action_url=f"/requester/requests/{req.id}"
            )

            AuditLog.record(
                actor=request.user,
                action='REJECT_BLOOD_REQUEST',
                target_model='BloodRequest',
                target_id=req.id,
                details=f"Rejected request {req.reference_number}. Notes: {notes}",
                request=request
            )

            return Response({
                'message': 'Blood request rejected.',
                'request': BloodRequestDetailSerializer(req).data
            })


class BloodRequestFulfillView(views.APIView):
    """
    Administrator endpoint to mark a request fulfilled.
    """
    permission_classes = [IsAdminUserRole]

    def post(self, request, pk):
        try:
            req = BloodRequest.objects.get(pk=pk)
        except BloodRequest.DoesNotExist:
            return Response({'error': 'Blood request not found'}, status=status.HTTP_404_NOT_FOUND)

        notes = request.data.get('notes', 'Transfusion completed successfully via authorized blood bank.')
        req.request_status = RequestStatus.FULFILLED
        req.fulfillment_notes = notes
        req.save()
        escalation_hooks.on_request_changed(req)

        Notification.objects.create(
            recipient=req.requester,
            related_request=req,
            title=f"Blood Request Fulfilled ({req.reference_number})",
            message=f"Emergency request fulfilled at {req.hospital_name}. Notes: {notes}",
            notification_type=NotificationType.STATUS_UPDATE,
            action_url=f"/requester/requests/{req.id}"
        )

        AuditLog.record(
            actor=request.user,
            action='FULFILL_BLOOD_REQUEST',
            target_model='BloodRequest',
            target_id=req.id,
            details=f"Marked request {req.reference_number} as fulfilled.",
            request=request
        )

        return Response({'message': 'Request marked as fulfilled', 'request': BloodRequestDetailSerializer(req).data})


class BloodRequestRematchView(views.APIView):
    """
    Manually re-run donor matching for an approved blood request.
    """
    permission_classes = [IsAdminUserRole]

    def post(self, request, pk):
        try:
            req = BloodRequest.objects.get(pk=pk)
        except BloodRequest.DoesNotExist:
            return Response({'error': 'Blood request not found'}, status=status.HTTP_404_NOT_FOUND)

        if req.verification_status == VerificationStatus.APPROVED and req.request_status not in [
                RequestStatus.CANCELLED, RequestStatus.CLOSED, RequestStatus.FULFILLED]:
            # Approved requests go through the escalation engine as an administrator-approved evaluation.
            try:
                case = escalation_service.start_case_for_request(req, actor=request.user)
                if case.is_terminal:
                    return Response({'error': f'Coordination is {case.get_status_display().lower()}; no new alerts.'},
                                    status=status.HTTP_400_BAD_REQUEST)
                escalation_service.approve_escalation(case.pk, actor=request.user)
            except EscalationError as exc:
                return Response({'error': exc.message}, status=status.HTTP_400_BAD_REQUEST)
            matches = list(EmergencyCase.objects.get(pk=case.pk).attempts.all())
        else:
            matches = run_donor_matching(req)
        AuditLog.record(
            actor=request.user,
            action='REMATCH_BLOOD_REQUEST',
            target_model='BloodRequest',
            target_id=req.id,
            details=f"Manually reran donor matching for {req.reference_number}. Found {len(matches)} matches.",
            request=request
        )

        return Response({
            'message': f'Matching rerun successfully. {len(matches)} donors currently matched.',
            'matches_count': len(matches)
        })
