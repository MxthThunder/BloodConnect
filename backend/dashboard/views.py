from rest_framework import views, permissions
from rest_framework.response import Response
from django.db.models import Sum, Count, Q
from accounts.models import User
from donors.models import DonorProfile
from blood_requests.models import BloodRequest, VerificationStatus, RequestStatus
from matching.models import DonorMatch, AlertStatus
from bloodbank.models import BloodStock, BloodBank
from audit.models import AuditLog
from accounts.constants import BloodGroup


class DashboardStatsView(views.APIView):
    """
    Returns authentic, real-time platform statistics computed dynamically from database.
    Adapts response content to current user's role.
    """
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        user = request.user
        role = user.role

        if role == 'admin' or user.is_superuser:
            return self.get_admin_stats(request)
        elif role == 'donor':
            return self.get_donor_stats(request)
        else:
            return self.get_requester_stats(request)

    def get_admin_stats(self, request):
        total_donors = DonorProfile.objects.count()
        available_donors = DonorProfile.objects.filter(is_available=True).count()
        consenting_donors = DonorProfile.objects.filter(notification_consent=True).count()

        total_requests = BloodRequest.objects.count()
        pending_verification = BloodRequest.objects.filter(verification_status=VerificationStatus.PENDING).count()
        active_approved = BloodRequest.objects.filter(verification_status=VerificationStatus.APPROVED, request_status__in=['ACTIVE_ALERTS_SENT', 'DONOR_RESPONDED']).count()
        fulfilled_requests = BloodRequest.objects.filter(request_status=RequestStatus.FULFILLED).count()
        requests_with_responses = BloodRequest.objects.filter(matches__alert_status=AlertStatus.ACCEPTED).distinct().count()

        total_matches = DonorMatch.objects.count()
        accepted_responses = DonorMatch.objects.filter(alert_status=AlertStatus.ACCEPTED).count()
        declined_responses = DonorMatch.objects.filter(alert_status=AlertStatus.DECLINED).count()

        # Blood Stock aggregates
        stocks = BloodStock.objects.all().select_related('blood_bank')
        stock_by_group = []
        low_stock_items = []
        total_units = 0

        for bg, _ in BloodGroup.choices:
            bg_stocks = [s for s in stocks if s.blood_group == bg]
            units = sum(s.units_available for s in bg_stocks)
            total_units += units
            is_low = any(s.is_low_stock for s in bg_stocks) or (units < 10)
            stock_by_group.append({
                'blood_group': bg,
                'units': units,
                'is_low': is_low
            })
            if is_low:
                low_stock_items.append({
                    'blood_group': bg,
                    'units': units
                })

        # Donors by Locality in Chennai
        donors_by_locality = list(
            DonorProfile.objects.values('locality')
            .annotate(count=Count('id'))
            .order_by('-count')[:10]
        )

        recent_requests = BloodRequest.objects.all().order_by('-created_at')[:8].values(
            'id', 'reference_number', 'blood_group', 'units_requested',
            'hospital_name', 'locality', 'urgency', 'verification_status', 'request_status', 'created_at'
        )

        recent_responses_qs = DonorMatch.objects.filter(
            alert_status__in=[AlertStatus.ACCEPTED, AlertStatus.DECLINED]
        ).select_related('blood_request', 'donor__user').order_by('-responded_at')[:6]

        recent_donor_responses = []
        for r in recent_responses_qs:
            recent_donor_responses.append({
                'id': r.id,
                'request_ref': r.blood_request.reference_number,
                'hospital_name': r.blood_request.hospital_name,
                'blood_group': r.blood_request.blood_group,
                'status': r.alert_status,
                'donor_name': f"Donor {r.donor.user.first_name} ({r.donor.blood_group})",
                'locality': r.donor.locality,
                'message': r.donor_response_message,
                'responded_at': r.responded_at
            })

        recent_audits = AuditLog.objects.all().order_by('-created_at')[:8].values(
            'id', 'actor_email', 'action', 'target_model', 'details', 'created_at'
        )

        return Response({
            'role': 'admin',
            'environment': 'Chennai Demo Environment',
            'is_demo_data': True,
            'donors': {
                'total': total_donors,
                'available': available_donors,
                'consenting': consenting_donors,
                'by_locality': donors_by_locality
            },
            'requests': {
                'total': total_requests,
                'pending_verification': pending_verification,
                'active_approved': active_approved,
                'fulfilled': fulfilled_requests,
                'with_responses': requests_with_responses
            },
            'matches': {
                'total': total_matches,
                'accepted': accepted_responses,
                'declined': declined_responses
            },
            'inventory': {
                'total_units': total_units,
                'stock_by_group': stock_by_group,
                'low_stock_count': len(low_stock_items),
                'low_stock_items': low_stock_items
            },
            'recent_requests': list(recent_requests),
            'recent_donor_responses': recent_donor_responses,
            'recent_audits': list(recent_audits)
        })

    def get_requester_stats(self, request):
        user_requests = BloodRequest.objects.filter(requester=request.user)
        total = user_requests.count()
        pending = user_requests.filter(verification_status=VerificationStatus.PENDING).count()
        approved = user_requests.filter(verification_status=VerificationStatus.APPROVED).count()
        fulfilled = user_requests.filter(request_status=RequestStatus.FULFILLED).count()

        # Count total donor responses across requester's requests
        responses_received = DonorMatch.objects.filter(
            blood_request__requester=request.user,
            alert_status=AlertStatus.ACCEPTED
        ).count()

        recent = user_requests.order_by('-created_at')[:5].values(
            'id', 'reference_number', 'blood_group', 'units_requested',
            'hospital_name', 'urgency', 'verification_status', 'request_status', 'created_at'
        )

        return Response({
            'role': 'requester',
            'requests': {
                'total': total,
                'pending': pending,
                'approved': approved,
                'fulfilled': fulfilled,
                'responses_received': responses_received
            },
            'recent_requests': list(recent)
        })

    def get_donor_stats(self, request):
        try:
            profile = request.user.donor_profile
            matches = DonorMatch.objects.filter(donor=profile)
            total_alerts = matches.count()
            accepted = matches.filter(alert_status=AlertStatus.ACCEPTED).count()
            declined = matches.filter(alert_status=AlertStatus.DECLINED).count()
            pending_review = matches.filter(alert_status__in=[AlertStatus.DISPATCHED, AlertStatus.VIEWED]).count()

            donations_count = profile.donation_history.count()

            # Profile completion check
            fields = [
                profile.blood_group, profile.city, profile.locality,
                request.user.phone, profile.preferred_contact
            ]
            filled = sum(1 for f in fields if f)
            completion_pct = int((filled / len(fields)) * 100)

            recent_alerts = matches.order_by('-created_at')[:5]
            recent_alerts_data = []
            for m in recent_alerts:
                recent_alerts_data.append({
                    'id': m.id,
                    'request_ref': m.blood_request.reference_number,
                    'hospital': m.blood_request.hospital_name,
                    'blood_group': m.blood_request.blood_group,
                    'urgency': m.blood_request.urgency,
                    'alert_status': m.alert_status,
                    'score': m.compatibility_score,
                    'created_at': m.created_at
                })

            return Response({
                'role': 'donor',
                'profile': {
                    'blood_group': profile.blood_group,
                    'is_available': profile.is_available,
                    'city': profile.city,
                    'locality': profile.locality,
                    'completion_percentage': completion_pct,
                    'notification_consent': profile.notification_consent,
                    'is_medically_verified': profile.is_medically_verified
                },
                'alerts': {
                    'total': total_alerts,
                    'pending_review': pending_review,
                    'accepted': accepted,
                    'declined': declined
                },
                'donations': {
                    'total_recorded': donations_count,
                    'last_donation': profile.last_donation_date
                },
                'recent_alerts': recent_alerts_data
            })
        except DonorProfile.DoesNotExist:
            return Response({
                'role': 'donor',
                'profile': None,
                'alerts': {'total': 0, 'pending_review': 0, 'accepted': 0, 'declined': 0},
                'donations': {'total_recorded': 0, 'last_donation': None},
                'recent_alerts': []
            })
