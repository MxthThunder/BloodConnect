from datetime import time, timedelta

from django.test import override_settings
from django.utils import timezone
from rest_framework.test import APIClient

from accounts.models import User, UserRole
from bloodbank.models import BloodBank
from camps.constants import CampStatus, OrganisationType, PartnerStatus
from camps.models import CampApplication

FAST_HASH = override_settings(PASSWORD_HASHERS=['django.contrib.auth.hashers.MD5PasswordHasher'])


def make_user(email, role=UserRole.REQUESTER, **extra):
    extra.setdefault('username', email)
    if role == UserRole.ADMIN:
        extra.setdefault('is_staff', True)
    return User.objects.create_user(email=email, password='Password@123', role=role, **extra)


def client_for(user=None):
    client = APIClient()
    if user is not None:
        client.force_authenticate(user)
    return client


def make_bank(name='Test Blood Bank', locality='Adyar'):
    return BloodBank.objects.create(name=name, address='Test Road', city='Chennai', locality=locality,
                                    contact_phone='04400000000')


def payload(**overrides):
    data = {
        'organisation_name': 'Test College', 'organisation_type': 'COLLEGE', 'title': 'Test Drive',
        'description': 'A test camp.', 'venue_name': 'Main Hall', 'address': '1 Test Road, Adyar',
        'locality': 'Adyar', 'camp_date': (timezone.localdate() + timedelta(days=10)).isoformat(),
        'start_time': '09:00', 'end_time': '14:00', 'expected_donors': 100,
        'facilities': ['SEATING', 'POWER_BACKUP'], 'contact_name': 'Test Person',
        'contact_phone': '+91 90000 00001', 'contact_email': 'organiser-contact@test.org',
        'registration_info': 'Walk in with photo ID.',
    }
    data.update(overrides)
    return data


def make_app(organiser, status=CampStatus.SUBMITTED, days=10, locality='Adyar', partner_status=None, bank=None,
             support=None, **extra):
    """Create an application straight in the database (bypasses the workflow, for setting up states)."""
    if partner_status is None:
        partner_status = PartnerStatus.CONFIRMED if status in (CampStatus.APPROVED, CampStatus.COMPLETED) else PartnerStatus.NOT_CONTACTED
    if partner_status == PartnerStatus.CONFIRMED and bank is None:
        bank = make_bank(f'Bank {CampApplication.objects.count()}')
    return CampApplication.objects.create(
        organiser=organiser, organisation_name='Test College', organisation_type=OrganisationType.COLLEGE,
        title=extra.pop('title', 'Test Drive'), venue_name='Main Hall', address='1 Test Road', locality=locality,
        camp_date=timezone.localdate() + timedelta(days=days), start_time=time(9), end_time=time(14),
        expected_donors=100, contact_name='Organiser', contact_phone='+91 90000 00001',
        contact_email='organiser-contact@test.org', status=status, partner_status=partner_status, partner=bank,
        partner_support=support if support is not None else (['MEDICAL_PERSONNEL', 'DONOR_SCREENING']
                                                              if partner_status == PartnerStatus.CONFIRMED else []),
        admin_notes=extra.pop('admin_notes', ''), **extra)
