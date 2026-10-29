from datetime import timedelta

from django.test import override_settings
from django.utils import timezone

from accounts.models import User, UserRole
from blood_requests.models import BloodRequest, RequestStatus, VerificationStatus
from donors.models import DonorProfile
from escalation.constants import LOCALITY_REFERENCE_POINTS

FAST_HASH = override_settings(PASSWORD_HASHERS=['django.contrib.auth.hashers.MD5PasswordHasher'])

ADYAR = LOCALITY_REFERENCE_POINTS['Adyar']


def make_user(email, role=UserRole.REQUESTER, **extra):
    extra.setdefault('username', email)
    if role == UserRole.ADMIN:
        extra.setdefault('is_staff', True)
    return User.objects.create_user(email=email, password='Password@123', role=role, **extra)


def make_donor(n, locality='Adyar', group='O+', available=True, consent=True, coords=True, verified=False,
               first='Test', **extra):
    user = make_user(f'donor{n}@test.org', UserRole.DONOR, first_name=first, last_name=f'Person{n}')
    lat, lng = LOCALITY_REFERENCE_POINTS[locality]
    return DonorProfile.objects.create(
        user=user, blood_group=group, city='Chennai', locality=locality,
        approx_latitude=lat + n * 0.0002 if coords else None,
        approx_longitude=lng if coords else None,
        is_available=available, notification_consent=consent, is_medically_verified=verified, **extra)


def make_request(requester, group='O+', units=2, urgency='CRITICAL', hours=2, approved=True, locality='Adyar', **extra):
    return BloodRequest.objects.create(
        requester=requester, blood_group=group, units_requested=units, hospital_name='Test Hospital Adyar',
        hospital_address='Test Road', city='Chennai', locality=locality,
        hospital_lat=ADYAR[0], hospital_lng=ADYAR[1], urgency=urgency,
        required_by=timezone.now() + timedelta(hours=hours), contact_phone='9000000000',
        verification_status=VerificationStatus.APPROVED if approved else VerificationStatus.PENDING,
        request_status=RequestStatus.ACTIVE_ALERTS_SENT if approved else RequestStatus.PENDING_VERIFICATION,
        **extra)


NEAR = ['Adyar', 'Guindy', 'Mylapore']            # within 5 km of the Adyar hospital
MID = ['Velachery', 'T. Nagar', 'Royapettah']     # roughly 6-10 km
FAR = ['Anna Nagar', 'Porur', 'Tambaram']         # 12+ km


def populate_pool(near=6, mid=6, far=6, group='O+', start=1):
    donors, n = [], start
    for localities, count in ((NEAR, near), (MID, mid), (FAR, far)):
        for i in range(count):
            donors.append(make_donor(n, localities[i % len(localities)], group))
            n += 1
    return donors
