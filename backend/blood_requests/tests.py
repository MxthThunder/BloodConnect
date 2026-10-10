from django.test import TestCase
from django.utils import timezone
from datetime import timedelta
from rest_framework.test import APIClient
from rest_framework import status
from accounts.models import User, UserRole
from donors.models import DonorProfile
from blood_requests.models import BloodRequest, VerificationStatus, RequestStatus
from matching.models import DonorMatch, AlertStatus
from notifications.models import Notification


class BloodRequestAndMatchingWorkflowTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.admin = User.objects.create_user(
            username='admin@test.com',
            email='admin@test.com',
            password='Password@123',
            role=UserRole.ADMIN,
            is_staff=True
        )
        self.requester = User.objects.create_user(
            username='req@test.com',
            email='req@test.com',
            password='Password@123',
            role=UserRole.REQUESTER
        )
        self.donor1_user = User.objects.create_user(
            username='donor1@test.com',
            email='donor1@test.com',
            password='Password@123',
            role=UserRole.DONOR
        )
        self.donor1 = DonorProfile.objects.create(
            user=self.donor1_user,
            blood_group='O-',  # Universal donor
            city='Bengaluru',
            locality='Indiranagar',
            is_available=True,
            notification_consent=True
        )
        self.donor2_user = User.objects.create_user(
            username='donor2@test.com',
            email='donor2@test.com',
            password='Password@123',
            role=UserRole.DONOR
        )
        self.donor2 = DonorProfile.objects.create(
            user=self.donor2_user,
            blood_group='A+',  # Incompatible with O+ recipient
            city='Bengaluru',
            locality='Indiranagar',
            is_available=True,
            notification_consent=True
        )

    def test_requester_can_create_blood_request(self):
        self.client.force_authenticate(user=self.requester)
        req_data = {
            'patient_case_ref': 'CASE-001',
            'blood_group': 'O+',
            'component': 'Packed Red Blood Cells',
            'units_requested': 2,
            'hospital_name': 'Manipal Hospital',
            'hospital_address': 'HAL Airport Road',
            'city': 'Bengaluru',
            'locality': 'HAL',
            'urgency': 'CRITICAL',
            'required_by': (timezone.now() + timedelta(hours=4)).isoformat(),
            'reason': 'Emergency surgery standby',
            'contact_phone': '9845012345',
            'contact_preference': 'phone'
        }
        response = self.client.post('/api/requests/', req_data)
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data['verification_status'], 'PENDING')
        self.assertEqual(response.data['request_status'], 'PENDING_VERIFICATION')

    def test_donor_cannot_approve_request(self):
        req = BloodRequest.objects.create(
            requester=self.requester,
            blood_group='O+',
            units_requested=2,
            hospital_name='Manipal Hospital',
            hospital_address='HAL Airport Road',
            city='Bengaluru',
            locality='HAL',
            urgency='CRITICAL',
            required_by=timezone.now() + timedelta(hours=4),
            contact_phone='9845012345'
        )
        self.client.force_authenticate(user=self.donor1_user)
        response = self.client.post(f'/api/requests/{req.id}/verify/', {'action': 'APPROVE'})
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_admin_approve_triggers_donor_matching_and_notifications(self):
        req = BloodRequest.objects.create(
            requester=self.requester,
            blood_group='O+',
            units_requested=2,
            hospital_name='Manipal Hospital',
            hospital_address='HAL Airport Road',
            city='Bengaluru',
            locality='Indiranagar',
            urgency='CRITICAL',
            required_by=timezone.now() + timedelta(hours=4),
            contact_phone='9845012345'
        )

        self.client.force_authenticate(user=self.admin)
        response = self.client.post(f'/api/requests/{req.id}/verify/', {'action': 'APPROVE', 'notes': 'Verified'})
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        req.refresh_from_db()
        self.assertEqual(req.verification_status, VerificationStatus.APPROVED)
        self.assertEqual(req.request_status, RequestStatus.ACTIVE_ALERTS_SENT)

        # Donor 1 (O-) is compatible with O+ recipient, so a match must exist
        matches = DonorMatch.objects.filter(blood_request=req)
        self.assertTrue(matches.filter(donor=self.donor1).exists())
        # Donor 2 (A+) is incompatible with O+ recipient, so must NOT be matched
        self.assertFalse(matches.filter(donor=self.donor2).exists())

        # Notification must be created for donor 1
        notif = Notification.objects.filter(recipient=self.donor1_user, related_request=req)
        self.assertTrue(notif.exists())

    def test_donor_can_respond_to_alert_and_updates_status(self):
        req = BloodRequest.objects.create(
            requester=self.requester,
            blood_group='O+',
            units_requested=1,
            hospital_name='Manipal Hospital',
            hospital_address='HAL Airport Road',
            city='Bengaluru',
            locality='Indiranagar',
            urgency='URGENT',
            required_by=timezone.now() + timedelta(hours=6),
            contact_phone='9845012345',
            verification_status=VerificationStatus.APPROVED,
            request_status=RequestStatus.ACTIVE_ALERTS_SENT
        )
        match = DonorMatch.objects.create(
            blood_request=req,
            donor=self.donor1,
            compatibility_score=95,
            alert_status=AlertStatus.DISPATCHED
        )

        self.client.force_authenticate(user=self.donor1_user)
        response = self.client.post(f'/api/matching/donor-alerts/{match.id}/respond/', {
            'response': 'ACCEPTED',
            'message': 'Available to reach hospital in 45 minutes.'
        })
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        match.refresh_from_db()
        self.assertEqual(match.alert_status, AlertStatus.ACCEPTED)

        # Request status updates to DONOR_RESPONDED
        req.refresh_from_db()
        self.assertEqual(req.request_status, RequestStatus.DONOR_RESPONDED)

        # Acceptance does NOT automatically mark request fulfilled
        self.assertNotEqual(req.request_status, RequestStatus.FULFILLED)
