from django.core.management.base import BaseCommand
from django.utils import timezone
from datetime import timedelta
from accounts.models import User, UserRole
from donors.models import DonorProfile, DonationHistory
from blood_requests.models import BloodRequest, VerificationStatus, RequestStatus
from matching.models import DonorMatch, AlertStatus
from matching.services import run_donor_matching
from bloodbank.models import BloodBank, BloodStock, StockTransaction, TransactionType
from notifications.models import Notification, NotificationType
from audit.models import AuditLog


class Command(BaseCommand):
    help = 'Seeds initial demonstration data for BloodConnect College Design Thinking evaluation'

    def handle(self, *args, **options):
        self.stdout.write(self.style.NOTICE("==> Seeding BloodConnect demonstration records..."))

        # 1. Administrator Account
        admin_user, created = User.objects.get_or_create(
            email='admin@bloodconnect.org',
            defaults={
                'username': 'admin@bloodconnect.org',
                'first_name': 'Dr. Ramesh',
                'last_name': 'Verma',
                'role': UserRole.ADMIN,
                'phone': '+91 98450 99999',
                'city': 'Bengaluru',
                'locality': 'Medical City',
                'is_staff': True,
                'is_superuser': True
            }
        )
        if created:
            admin_user.set_password('Admin@1234')
            admin_user.save()
            self.stdout.write(self.style.SUCCESS("  [+] Admin user created: admin@bloodconnect.org / Admin@1234"))
        else:
            admin_user.set_password('Admin@1234')
            admin_user.save()
            self.stdout.write("  [*] Admin user exists: admin@bloodconnect.org")

        # 2. Requester Account
        requester_user, created = User.objects.get_or_create(
            email='requester@bloodconnect.org',
            defaults={
                'username': 'requester@bloodconnect.org',
                'first_name': 'Ananya',
                'last_name': 'Sharma',
                'role': UserRole.REQUESTER,
                'phone': '+91 98450 12345',
                'city': 'Bengaluru',
                'locality': 'Indiranagar',
                'is_verified': True
            }
        )
        if created:
            requester_user.set_password('Requester@1234')
            requester_user.save()
            self.stdout.write(self.style.SUCCESS("  [+] Requester user created: requester@bloodconnect.org / Requester@1234"))
        else:
            requester_user.set_password('Requester@1234')
            requester_user.save()

        # 3. Fictional Donors across ABO/Rh groups
        donors_data = [
            {
                'email': 'donor.o_neg@bloodconnect.org',
                'first_name': 'Vikram',
                'last_name': 'Malhotra',
                'phone': '+91 98451 10001',
                'city': 'Bengaluru',
                'locality': 'Koramangala',
                'blood_group': 'O-',
                'is_available': True,
                'is_medically_verified': True,
                'lat': 12.9352,
                'lng': 77.6245,
                'total_donations': 4
            },
            {
                'email': 'donor.o_pos@bloodconnect.org',
                'first_name': 'Priya',
                'last_name': 'Nair',
                'phone': '+91 98451 10002',
                'city': 'Bengaluru',
                'locality': 'Indiranagar',
                'blood_group': 'O+',
                'is_available': True,
                'is_medically_verified': True,
                'lat': 12.9784,
                'lng': 77.6408,
                'total_donations': 6
            },
            {
                'email': 'donor.a_pos@bloodconnect.org',
                'first_name': 'Rahul',
                'last_name': 'Deshmukh',
                'phone': '+91 98451 10003',
                'city': 'Bengaluru',
                'locality': 'Whitefield',
                'blood_group': 'A+',
                'is_available': True,
                'is_medically_verified': False,
                'lat': 12.9698,
                'lng': 77.7499,
                'total_donations': 2
            },
            {
                'email': 'donor.a_neg@bloodconnect.org',
                'first_name': 'Sneha',
                'last_name': 'Kulkarni',
                'phone': '+91 98451 10004',
                'city': 'Bengaluru',
                'locality': 'Jayanagar',
                'blood_group': 'A-',
                'is_available': True,
                'is_medically_verified': True,
                'lat': 12.9308,
                'lng': 77.5838,
                'total_donations': 3
            },
            {
                'email': 'donor.b_pos@bloodconnect.org',
                'first_name': 'Kavita',
                'last_name': 'Reddy',
                'phone': '+91 98451 10005',
                'city': 'Bengaluru',
                'locality': 'HSR Layout',
                'blood_group': 'B+',
                'is_available': True,
                'is_medically_verified': True,
                'lat': 12.9121,
                'lng': 77.6446,
                'total_donations': 5
            },
            {
                'email': 'donor.b_neg@bloodconnect.org',
                'first_name': 'Arjun',
                'last_name': 'Mehta',
                'phone': '+91 98451 10006',
                'city': 'Bengaluru',
                'locality': 'Malleshwaram',
                'blood_group': 'B-',
                'is_available': True,
                'is_medically_verified': False,
                'lat': 12.9982,
                'lng': 77.5703,
                'total_donations': 1
            },
            {
                'email': 'donor.ab_pos@bloodconnect.org',
                'first_name': 'Deepak',
                'last_name': 'Hegde',
                'phone': '+91 98451 10007',
                'city': 'Bengaluru',
                'locality': 'BTM Layout',
                'blood_group': 'AB+',
                'is_available': True,
                'is_medically_verified': True,
                'lat': 12.9166,
                'lng': 77.6101,
                'total_donations': 2
            },
            {
                'email': 'donor.ab_neg@bloodconnect.org',
                'first_name': 'Meera',
                'last_name': 'Iyer',
                'phone': '+91 98451 10008',
                'city': 'Bengaluru',
                'locality': 'Hebbal',
                'blood_group': 'AB-',
                'is_available': False,  # Unavailable donor test case
                'is_medically_verified': False,
                'lat': 13.0358,
                'lng': 77.5970,
                'total_donations': 0
            },
        ]

        created_donors = []
        for d in donors_data:
            u, _ = User.objects.get_or_create(
                email=d['email'],
                defaults={
                    'username': d['email'],
                    'first_name': d['first_name'],
                    'last_name': d['last_name'],
                    'role': UserRole.DONOR,
                    'phone': d['phone'],
                    'city': d['city'],
                    'locality': d['locality'],
                    'is_verified': True
                }
            )
            u.set_password('Donor@1234')
            u.save()

            dp, _ = DonorProfile.objects.get_or_create(
                user=u,
                defaults={
                    'blood_group': d['blood_group'],
                    'city': d['city'],
                    'locality': d['locality'],
                    'state': 'Karnataka',
                    'approx_latitude': d['lat'],
                    'approx_longitude': d['lng'],
                    'is_available': d['is_available'],
                    'notification_consent': True,
                    'is_medically_verified': d['is_medically_verified'],
                    'total_donations': d['total_donations'],
                    'last_donation_date': timezone.now().date() - timedelta(days=45) if d['total_donations'] > 0 else None
                }
            )
            created_donors.append(dp)

        self.stdout.write(self.style.SUCCESS(f"  [+] Seeded {len(created_donors)} demonstration donors."))

        # 4. Blood Banks
        banks_data = [
            {
                'name': 'Victoria Hospital Central Blood Centre',
                'license_number': 'KA-BLD-01982',
                'address': 'Fort Road, Near City Market, Kalasipalya',
                'city': 'Bengaluru',
                'locality': 'Fort',
                'contact_phone': '+91 80 2670 1150',
                'contact_email': 'bloodbank@victoriahospital.kar.nic.in',
                'latitude': 12.9634,
                'longitude': 77.5755
            },
            {
                'name': 'Manipal Hospital Transfusion Medicine',
                'license_number': 'KA-BLD-02419',
                'address': '98, HAL Old Airport Rd, Kodihalli',
                'city': 'Bengaluru',
                'locality': 'HAL Airport Road',
                'contact_phone': '+91 80 2502 4444',
                'contact_email': 'transfusion@manipalhospitals.com',
                'latitude': 12.9592,
                'longitude': 77.6499
            },
            {
                'name': 'Rashtrotthana Rotary Blood Centre',
                'license_number': 'KA-BLD-00874',
                'address': 'Subbarama Chetty Road, Basavanagudi',
                'city': 'Bengaluru',
                'locality': 'Basavanagudi',
                'contact_phone': '+91 80 2664 5645',
                'contact_email': 'info@rashtrotthanabloodbank.org',
                'latitude': 12.9421,
                'longitude': 77.5739
            }
        ]

        blood_banks = []
        for b in banks_data:
            bb, _ = BloodBank.objects.get_or_create(
                name=b['name'],
                defaults=b
            )
            blood_banks.append(bb)

        self.stdout.write(self.style.SUCCESS(f"  [+] Seeded {len(blood_banks)} blood banks."))

        # 5. Blood Bank Stock with configured LOW STOCK triggers
        stock_configs = [
            # Group, Units, Low threshold (triggers alert if units <= threshold)
            ('O+', 16, 5),
            ('O-', 2, 5),   # LOW STOCK ALERT
            ('A+', 18, 5),
            ('A-', 3, 4),   # LOW STOCK ALERT
            ('B+', 22, 5),
            ('B-', 4, 5),   # LOW STOCK ALERT
            ('AB+', 9, 4),
            ('AB-', 1, 3),  # CRITICAL LOW STOCK ALERT
        ]

        for bb in blood_banks:
            for bg, units, thresh in stock_configs:
                stock_obj, created = BloodStock.objects.get_or_create(
                    blood_bank=bb,
                    blood_group=bg,
                    component='Whole Blood',
                    defaults={
                        'units_available': units,
                        'low_stock_threshold': thresh
                    }
                )
                if not created:
                    stock_obj.units_available = units
                    stock_obj.low_stock_threshold = thresh
                    stock_obj.save()

        self.stdout.write(self.style.SUCCESS("  [+] Seeded stock inventories with intentional low-stock alerts."))

        # 6. Pre-seeded Blood Requests in different workflow states
        now = timezone.now()

        # Request 1: PENDING VERIFICATION (For examiner demo step 1 & 2)
        r1, _ = BloodRequest.objects.get_or_create(
            reference_number='BC-REQ-DEMO-01',
            defaults={
                'requester': requester_user,
                'patient_case_ref': 'BED-ICU-402',
                'blood_group': 'O+',
                'component': 'Packed Red Blood Cells',
                'units_requested': 2,
                'hospital_name': 'Manipal Hospital Bangalore',
                'hospital_address': '98, HAL Old Airport Rd, Kodihalli',
                'city': 'Bengaluru',
                'locality': 'HAL Airport Road',
                'hospital_lat': 12.9592,
                'hospital_lng': 77.6499,
                'urgency': 'CRITICAL',
                'required_by': now + timedelta(hours=3),
                'reason': 'Emergency cardiac bypass surgery requires PRBC units on standby.',
                'contact_phone': '+91 98450 12345',
                'contact_preference': 'phone',
                'verification_status': VerificationStatus.PENDING,
                'request_status': RequestStatus.PENDING_VERIFICATION
            }
        )

        # Request 2: APPROVED & ALERTS SENT WITH DONOR ACCEPTANCE (For examiner demo step 6 & 7)
        r2, _ = BloodRequest.objects.get_or_create(
            reference_number='BC-REQ-DEMO-02',
            defaults={
                'requester': requester_user,
                'patient_case_ref': 'TRAUMA-ER-109',
                'blood_group': 'A+',
                'component': 'Whole Blood',
                'units_requested': 3,
                'hospital_name': 'Victoria Hospital',
                'hospital_address': 'Fort Road, Kalasipalya',
                'city': 'Bengaluru',
                'locality': 'Fort',
                'hospital_lat': 12.9634,
                'hospital_lng': 77.5755,
                'urgency': 'URGENT',
                'required_by': now + timedelta(hours=8),
                'reason': 'Road traffic accident trauma patient resuscitation.',
                'contact_phone': '+91 98450 12345',
                'contact_preference': 'hospital_desk',
                'verification_status': VerificationStatus.APPROVED,
                'request_status': RequestStatus.DONOR_RESPONDED,
                'verified_by': admin_user,
                'verified_at': now - timedelta(hours=1),
                'verification_notes': 'Verified with Trauma Care ICU on duty resident.'
            }
        )

        # Automatically run matching for r2
        matches_r2 = run_donor_matching(r2)
        # Mark one match as ACCEPTED to demonstrate response tracking
        if matches_r2:
            first_match = matches_r2[0]
            first_match.alert_status = AlertStatus.ACCEPTED
            first_match.donor_response_message = "I am on my way to Victoria Hospital Blood Bank now. Can donate immediately."
            first_match.responded_at = now - timedelta(minutes=20)
            first_match.save()

        # Request 3: FULFILLED Request
        r3, _ = BloodRequest.objects.get_or_create(
            reference_number='BC-REQ-DEMO-03',
            defaults={
                'requester': requester_user,
                'patient_case_ref': 'ONCO-DAYCARE-77',
                'blood_group': 'B+',
                'component': 'Platelets',
                'units_requested': 1,
                'hospital_name': 'Rashtrotthana Blood Centre',
                'hospital_address': 'Basavanagudi',
                'city': 'Bengaluru',
                'locality': 'Basavanagudi',
                'hospital_lat': 12.9421,
                'hospital_lng': 77.5739,
                'urgency': 'STANDARD',
                'required_by': now - timedelta(hours=24),
                'reason': 'Chemotherapy induced thrombocytopenia replacement.',
                'contact_phone': '+91 98450 12345',
                'contact_preference': 'in_app',
                'verification_status': VerificationStatus.APPROVED,
                'request_status': RequestStatus.FULFILLED,
                'verified_by': admin_user,
                'verified_at': now - timedelta(days=2),
                'verification_notes': 'Verified case file.',
                'fulfillment_notes': 'Donation fulfilled by volunteer donor; crossmatch cleared.'
            }
        )

        self.stdout.write(self.style.SUCCESS("  [+] Seeded sample blood requests across statuses."))

        # 7. Seed Initial Low Stock Warning Notifications
        Notification.objects.get_or_create(
            recipient=admin_user,
            title='LOW STOCK ALERT: AB- at Victoria Hospital Central Blood Centre',
            defaults={
                'message': 'Only 1 unit available for AB- Whole Blood (Threshold: 3 units). Replenishment required.',
                'notification_type': NotificationType.LOW_STOCK,
                'urgency': 'URGENT',
                'action_url': '/admin-portal/low-stock'
            }
        )

        Notification.objects.get_or_create(
            recipient=admin_user,
            title='LOW STOCK ALERT: O- at Manipal Hospital Transfusion Medicine',
            defaults={
                'message': 'Only 2 units of O- universal red cell units remain in stock (Threshold: 5 units).',
                'notification_type': NotificationType.LOW_STOCK,
                'urgency': 'URGENT',
                'action_url': '/admin-portal/low-stock'
            }
        )

        # 8. Record initial Audit Logs
        AuditLog.objects.get_or_create(
            action='INITIAL_SYSTEM_BOOTSTRAP',
            target_model='System',
            target_id='INIT',
            defaults={
                'actor': admin_user,
                'actor_email': admin_user.email,
                'actor_role': 'admin',
                'details': 'System initialized with mock hospitals, stock levels, and donor registry.'
            }
        )

        self.stdout.write(self.style.SUCCESS("\n==> BloodConnect Seed Data Completed Successfully!"))
        self.stdout.write(self.style.SUCCESS("=================================================================="))
        self.stdout.write(self.style.SUCCESS("  DEMO USER ACCOUNTS:"))
        self.stdout.write(self.style.SUCCESS("  - Administrator: admin@bloodconnect.org       / Admin@1234"))
        self.stdout.write(self.style.SUCCESS("  - Requester:     requester@bloodconnect.org   / Requester@1234"))
        self.stdout.write(self.style.SUCCESS("  - Donor (O-):    donor.o_neg@bloodconnect.org / Donor@1234"))
        self.stdout.write(self.style.SUCCESS("  - Donor (O+):    donor.o_pos@bloodconnect.org / Donor@1234"))
        self.stdout.write(self.style.SUCCESS("  - Donor (A+):    donor.a_pos@bloodconnect.org / Donor@1234"))
        self.stdout.write(self.style.SUCCESS("=================================================================="))
