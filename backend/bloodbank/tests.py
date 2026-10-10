from django.test import TestCase
from rest_framework.test import APIClient
from rest_framework import status
from accounts.models import User, UserRole
from bloodbank.models import BloodBank, BloodStock, StockTransaction, TransactionType


class BloodBankAndStockManagementTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.admin = User.objects.create_user(
            username='admin_bb@test.com',
            email='admin_bb@test.com',
            password='Password@123',
            role=UserRole.ADMIN,
            is_staff=True
        )
        self.requester = User.objects.create_user(
            username='requester_bb@test.com',
            email='requester_bb@test.com',
            password='Password@123',
            role=UserRole.REQUESTER
        )
        self.bank = BloodBank.objects.create(
            name='Test Central Blood Bank',
            address='123 Test Street',
            city='Bengaluru',
            locality='City Centre',
            contact_phone='9845000000'
        )
        self.stock = BloodStock.objects.create(
            blood_bank=self.bank,
            blood_group='O-',
            component='Whole Blood',
            units_available=5,
            low_stock_threshold=3
        )

    def test_requester_cannot_modify_blood_stock(self):
        self.client.force_authenticate(user=self.requester)
        response = self.client.post(f'/api/bloodbank/stock/{self.stock.id}/transaction/', {
            'transaction_type': 'ADDITION',
            'units': 2,
            'reason': 'Attempted donation'
        })
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_admin_can_add_stock(self):
        self.client.force_authenticate(user=self.admin)
        response = self.client.post(f'/api/bloodbank/stock/{self.stock.id}/transaction/', {
            'transaction_type': 'ADDITION',
            'units': 4,
            'reason': 'Voluntary donor camp replenishment'
        })
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.stock.refresh_from_db()
        self.assertEqual(self.stock.units_available, 9)

    def test_stock_cannot_become_negative(self):
        self.client.force_authenticate(user=self.admin)
        # Attempt to issue 10 units when only 5 are in stock
        response = self.client.post(f'/api/bloodbank/stock/{self.stock.id}/transaction/', {
            'transaction_type': 'USAGE_ISSUE',
            'units': 10,
            'reason': 'Emergency request dispatch'
        })
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('negative', response.data['error'].lower())
        self.stock.refresh_from_db()
        self.assertEqual(self.stock.units_available, 5)

    def test_low_stock_status_triggered(self):
        self.client.force_authenticate(user=self.admin)
        # Deduct 3 units: 5 - 3 = 2 units, which is <= threshold 3
        response = self.client.post(f'/api/bloodbank/stock/{self.stock.id}/transaction/', {
            'transaction_type': 'USAGE_ISSUE',
            'units': 3,
            'reason': 'Clinical issue to ICU'
        })
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.stock.refresh_from_db()
        self.assertEqual(self.stock.units_available, 2)
        self.assertTrue(self.stock.is_low_stock)
