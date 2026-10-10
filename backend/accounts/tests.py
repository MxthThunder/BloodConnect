from django.test import TestCase
from django.urls import reverse
from rest_framework.test import APIClient
from rest_framework import status
from accounts.models import User, UserRole
from donors.models import DonorProfile


class AuthenticationAndPermissionTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.admin_user = User.objects.create_user(
            username='admin_test@bloodconnect.org',
            email='admin_test@bloodconnect.org',
            password='Password@123',
            role=UserRole.ADMIN,
            is_staff=True
        )
        self.requester_user = User.objects.create_user(
            username='req_test@bloodconnect.org',
            email='req_test@bloodconnect.org',
            password='Password@123',
            role=UserRole.REQUESTER
        )
        self.donor_user = User.objects.create_user(
            username='donor_test@bloodconnect.org',
            email='donor_test@bloodconnect.org',
            password='Password@123',
            role=UserRole.DONOR
        )
        self.donor_profile = DonorProfile.objects.create(
            user=self.donor_user,
            blood_group='O+',
            city='Chennai',
            locality='Adyar',
            is_available=True
        )

    def test_user_registration_requester(self):
        response = self.client.post('/api/auth/register/', {
            'email': 'new_requester@bloodconnect.org',
            'password': 'Password@123',
            'first_name': 'Test',
            'last_name': 'Requester',
            'role': 'requester',
            'phone': '9876543210',
            'city': 'Chennai',
            'locality': 'Koramangala'
        })
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertIn('token', response.data)
        self.assertEqual(response.data['user']['role'], 'requester')

    def test_user_registration_donor(self):
        response = self.client.post('/api/auth/register/', {
            'email': 'new_donor@bloodconnect.org',
            'password': 'Password@123',
            'first_name': 'Test',
            'last_name': 'Donor',
            'role': 'donor',
            'blood_group': 'B+',
            'phone': '9876543211',
            'city': 'Chennai',
            'locality': 'Whitefield'
        })
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertIn('token', response.data)
        donor = User.objects.get(email='new_donor@bloodconnect.org')
        self.assertTrue(hasattr(donor, 'donor_profile'))
        self.assertEqual(donor.donor_profile.blood_group, 'B+')

    def test_user_login_success(self):
        response = self.client.post('/api/auth/login/', {
            'email': 'req_test@bloodconnect.org',
            'password': 'Password@123'
        })
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn('token', response.data)

    def test_user_login_failure(self):
        response = self.client.post('/api/auth/login/', {
            'email': 'req_test@bloodconnect.org',
            'password': 'WrongPassword'
        })
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_unauthenticated_user_cannot_access_protected_endpoint(self):
        response = self.client.get('/api/auth/me/')
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_donor_cannot_access_admin_user_management(self):
        self.client.force_authenticate(user=self.donor_user)
        response = self.client.get('/api/auth/users/')
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_admin_can_access_user_management(self):
        self.client.force_authenticate(user=self.admin_user)
        response = self.client.get('/api/auth/users/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
