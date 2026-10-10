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
    help = 'Seeds Chennai-localized demonstration data for BloodConnect College Design Thinking evaluation'

    def handle(self, *args, **options):
        self.stdout.write(self.style.NOTICE("==> Seeding BloodConnect Chennai demonstration records..."))

        # -------------------------------------------------------------
        # 1. SIX ADMINISTRATOR ACCOUNTS FOR TEAM MEMBERS
        # -------------------------------------------------------------
        team_members = [
            {
                'username': 'freddy.admin',
                'email': 'freddy.admin@bloodconnect.org',
                'first_name': 'Freddy Matthew',
                'last_name': 'R',
                'phone': '+91 94440 10001',
                'locality': 'Adyar',
            },
            {
                'username': 'joshua.admin',
                'email': 'joshua.admin@bloodconnect.org',
                'first_name': 'Joshua Bennet',
                'last_name': 'C',
                'phone': '+91 94440 10002',
                'locality': 'Anna Nagar',
            },
            {
                'username': 'boopathi.admin',
                'email': 'boopathi.admin@bloodconnect.org',
                'first_name': 'Boopathi',
                'last_name': 'P R',
                'phone': '+91 94440 10003',
                'locality': 'T. Nagar',
            },
            {
                'username': 'balakumaran.admin',
                'email': 'balakumaran.admin@bloodconnect.org',
                'first_name': 'Balakumaran',
                'last_name': 'E',
                'phone': '+91 94440 10004',
                'locality': 'Velachery',
            },
            {
                'username': 'abilash.admin',
                'email': 'abilash.admin@bloodconnect.org',
                'first_name': 'Abilash Alexander',
                'last_name': 'A',
                'phone': '+91 94440 10005',
                'locality': 'Guindy',
            },
            {
                'username': 'harisankaran.admin',
                'email': 'harisankaran.admin@bloodconnect.org',
                'first_name': 'Harisankaran',
                'last_name': 'J',
                'phone': '+91 94440 10006',
                'locality': 'Mylapore',
            },
        ]

        admin_users = []
        for tm in team_members:
            u, created = User.objects.get_or_create(
                email=tm['email'],
                defaults={
                    'username': tm['username'],
                    'first_name': tm['first_name'],
                    'last_name': tm['last_name'],
                    'role': UserRole.ADMIN,
                    'phone': tm['phone'],
                    'city': 'Chennai',
                    'locality': tm['locality'],
                    'is_staff': True,
                    'is_superuser': True,
                    'is_verified': True
                }
            )
            # Ensure username and password are synchronized
            u.username = tm['username']
            u.role = UserRole.ADMIN
            u.is_staff = True
            u.is_superuser = True
            u.city = 'Chennai'
            u.locality = tm['locality']
            u.set_password('Admin@1234')
            u.save()
            admin_users.append(u)
            status_text = "created" if created else "updated"
            self.stdout.write(self.style.SUCCESS(f"  [+] Admin [{status_text}]: {tm['username']} ({tm['email']}) / Admin@1234"))

        # Maintain legacy master admin for compatibility
        legacy_admin, _ = User.objects.get_or_create(
            email='admin@bloodconnect.org',
            defaults={
                'username': 'admin@bloodconnect.org',
                'first_name': 'Dr. Ramesh',
                'last_name': 'Verma',
                'role': UserRole.ADMIN,
                'phone': '+91 94440 99999',
                'city': 'Chennai',
                'locality': 'Central Chennai',
                'is_staff': True,
                'is_superuser': True
            }
        )
        legacy_admin.city = 'Chennai'
        legacy_admin.set_password('Admin@1234')
        legacy_admin.save()
        primary_admin = admin_users[0]  # Freddy Matthew R

        # -------------------------------------------------------------
        # 2. DEMO REQUESTERS IN CHENNAI
        # -------------------------------------------------------------
        requesters_data = [
            {
                'email': 'requester@bloodconnect.org',
                'username': 'requester@bloodconnect.org',
                'first_name': 'Ananya',
                'last_name': 'Sharma',
                'phone': '+91 94440 12345',
                'city': 'Chennai',
                'locality': 'T. Nagar',
            },
            {
                'email': 'requester.kavitha@bloodconnect.org',
                'username': 'requester.kavitha@bloodconnect.org',
                'first_name': 'Kavitha',
                'last_name': 'Senthil',
                'phone': '+91 94440 12346',
                'city': 'Chennai',
                'locality': 'Adyar',
            },
            {
                'email': 'requester.karthik@bloodconnect.org',
                'username': 'requester.karthik@bloodconnect.org',
                'first_name': 'Karthik',
                'last_name': 'Raja',
                'phone': '+91 94440 12347',
                'city': 'Chennai',
                'locality': 'Anna Nagar',
            }
        ]

        created_requesters = []
        for r_info in requesters_data:
            ru, _ = User.objects.get_or_create(
                email=r_info['email'],
                defaults={
                    'username': r_info['username'],
                    'first_name': r_info['first_name'],
                    'last_name': r_info['last_name'],
                    'role': UserRole.REQUESTER,
                    'phone': r_info['phone'],
                    'city': r_info['city'],
                    'locality': r_info['locality'],
                    'is_verified': True
                }
            )
            ru.city = 'Chennai'
            ru.locality = r_info['locality']
            ru.set_password('Requester@1234')
            ru.save()
            created_requesters.append(ru)

        primary_requester = created_requesters[0]

        # -------------------------------------------------------------
        # 3. 32 FICTIONAL CHENNAI DONORS ACROSS 15 LOCALITIES & 8 GROUPS
        # -------------------------------------------------------------
        donors_data = [
            # O- Universal Donors
            {'email': 'donor.o_neg@bloodconnect.org', 'first_name': 'Vikram', 'last_name': 'Malhotra', 'phone': '+91 94441 10001', 'locality': 'Adyar', 'bg': 'O-', 'avail': True, 'verified': True, 'lat': 13.0012, 'lng': 80.2565, 'donations': 4},
            {'email': 'donor.saravanan@bloodconnect.org', 'first_name': 'Saravanan', 'last_name': 'Murugan', 'phone': '+91 94441 10002', 'locality': 'Anna Nagar', 'bg': 'O-', 'avail': True, 'verified': True, 'lat': 13.0850, 'lng': 80.2101, 'donations': 5},
            {'email': 'donor.divya.oneg@bloodconnect.org', 'first_name': 'Divya', 'last_name': 'Krishnan', 'phone': '+91 94441 10003', 'locality': 'Mylapore', 'bg': 'O-', 'avail': True, 'verified': False, 'lat': 13.0368, 'lng': 80.2676, 'donations': 2},
            {'email': 'donor.karthik.oneg@bloodconnect.org', 'first_name': 'Karthik', 'last_name': 'Venkatesh', 'phone': '+91 94441 10004', 'locality': 'Tambaram', 'bg': 'O-', 'avail': False, 'verified': True, 'lat': 12.9249, 'lng': 80.1000, 'donations': 3},

            # O+ Common Donors
            {'email': 'donor.o_pos@bloodconnect.org', 'first_name': 'Priya', 'last_name': 'Nair', 'phone': '+91 94441 10005', 'locality': 'T. Nagar', 'bg': 'O+', 'avail': True, 'verified': True, 'lat': 13.0418, 'lng': 80.2341, 'donations': 6},
            {'email': 'donor.senthil@bloodconnect.org', 'first_name': 'Senthil', 'last_name': 'Kumar', 'phone': '+91 94441 10006', 'locality': 'Velachery', 'bg': 'O+', 'avail': True, 'verified': True, 'lat': 12.9815, 'lng': 80.2180, 'donations': 8},
            {'email': 'donor.ramya@bloodconnect.org', 'first_name': 'Ramya', 'last_name': 'Sundar', 'phone': '+91 94441 10007', 'locality': 'Guindy', 'bg': 'O+', 'avail': True, 'verified': False, 'lat': 13.0067, 'lng': 80.2030, 'donations': 1},
            {'email': 'donor.dinesh@bloodconnect.org', 'first_name': 'Dinesh', 'last_name': 'Chandran', 'phone': '+91 94441 10008', 'locality': 'Porur', 'bg': 'O+', 'avail': True, 'verified': True, 'lat': 13.0382, 'lng': 80.1565, 'donations': 4},

            # A+ Donors
            {'email': 'donor.a_pos@bloodconnect.org', 'first_name': 'Rahul', 'last_name': 'Deshmukh', 'phone': '+91 94441 10009', 'locality': 'Nungambakkam', 'bg': 'A+', 'avail': True, 'verified': True, 'lat': 13.0595, 'lng': 80.2425, 'donations': 3},
            {'email': 'donor.anand@bloodconnect.org', 'first_name': 'Anand', 'last_name': 'Subramaniam', 'phone': '+91 94441 10010', 'locality': 'Royapettah', 'bg': 'A+', 'avail': True, 'verified': True, 'lat': 13.0524, 'lng': 80.2606, 'donations': 5},
            {'email': 'donor.shalini@bloodconnect.org', 'first_name': 'Shalini', 'last_name': 'Ramesh', 'phone': '+91 94441 10011', 'locality': 'Vadapalani', 'bg': 'A+', 'avail': True, 'verified': False, 'lat': 13.0500, 'lng': 80.2121, 'donations': 2},
            {'email': 'donor.praveen@bloodconnect.org', 'first_name': 'Praveen', 'last_name': 'Raj', 'phone': '+91 94441 10012', 'locality': 'Perambur', 'bg': 'A+', 'avail': False, 'verified': True, 'lat': 13.1075, 'lng': 80.2435, 'donations': 4},

            # A- Rare Donors
            {'email': 'donor.a_neg@bloodconnect.org', 'first_name': 'Sneha', 'last_name': 'Kulkarni', 'phone': '+91 94441 10013', 'locality': 'Sholinganallur', 'bg': 'A-', 'avail': True, 'verified': True, 'lat': 12.9010, 'lng': 80.2279, 'donations': 3},
            {'email': 'donor.murali@bloodconnect.org', 'first_name': 'Murali', 'last_name': 'Dharan', 'phone': '+91 94441 10014', 'locality': 'Thoraipakkam', 'bg': 'A-', 'avail': True, 'verified': True, 'lat': 12.9432, 'lng': 80.2366, 'donations': 2},
            {'email': 'donor.kavya@bloodconnect.org', 'first_name': 'Kavya', 'last_name': 'Balaji', 'phone': '+91 94441 10015', 'locality': 'Ambattur', 'bg': 'A-', 'avail': True, 'verified': False, 'lat': 13.1143, 'lng': 80.1548, 'donations': 1},
            {'email': 'donor.suresh.aneg@bloodconnect.org', 'first_name': 'Suresh', 'last_name': 'Gopal', 'phone': '+91 94441 10016', 'locality': 'Anna Nagar', 'bg': 'A-', 'avail': True, 'verified': True, 'lat': 13.0850, 'lng': 80.2101, 'donations': 6},

            # B+ High Demand Donors
            {'email': 'donor.b_pos@bloodconnect.org', 'first_name': 'Kavita', 'last_name': 'Reddy', 'phone': '+91 94441 10017', 'locality': 'T. Nagar', 'bg': 'B+', 'avail': True, 'verified': True, 'lat': 13.0418, 'lng': 80.2341, 'donations': 5},
            {'email': 'donor.aravind@bloodconnect.org', 'first_name': 'Aravind', 'last_name': 'Swaminathan', 'phone': '+91 94441 10018', 'locality': 'Velachery', 'bg': 'B+', 'avail': True, 'verified': True, 'lat': 12.9815, 'lng': 80.2180, 'donations': 7},
            {'email': 'donor.meenakshi@bloodconnect.org', 'first_name': 'Meenakshi', 'last_name': 'Sundaram', 'phone': '+91 94441 10019', 'locality': 'Mylapore', 'bg': 'B+', 'avail': True, 'verified': False, 'lat': 13.0368, 'lng': 80.2676, 'donations': 2},
            {'email': 'donor.vijay@bloodconnect.org', 'first_name': 'Vijay', 'last_name': 'Anand', 'phone': '+91 94441 10020', 'locality': 'Tambaram', 'bg': 'B+', 'avail': True, 'verified': True, 'lat': 12.9249, 'lng': 80.1000, 'donations': 3},

            # B- Rare Donors
            {'email': 'donor.b_neg@bloodconnect.org', 'first_name': 'Arjun', 'last_name': 'Mehta', 'phone': '+91 94441 10021', 'locality': 'Adyar', 'bg': 'B-', 'avail': True, 'verified': True, 'lat': 13.0012, 'lng': 80.2565, 'donations': 2},
            {'email': 'donor.harini@bloodconnect.org', 'first_name': 'Harini', 'last_name': 'Rajaraman', 'phone': '+91 94441 10022', 'locality': 'Guindy', 'bg': 'B-', 'avail': True, 'verified': True, 'lat': 13.0067, 'lng': 80.2030, 'donations': 4},
            {'email': 'donor.balaji.bneg@bloodconnect.org', 'first_name': 'Balaji', 'last_name': 'Krishnamurthy', 'phone': '+91 94441 10023', 'locality': 'Porur', 'bg': 'B-', 'avail': False, 'verified': False, 'lat': 13.0382, 'lng': 80.1565, 'donations': 1},
            {'email': 'donor.deepika@bloodconnect.org', 'first_name': 'Deepika', 'last_name': 'Manoharan', 'phone': '+91 94441 10024', 'locality': 'Royapettah', 'bg': 'B-', 'avail': True, 'verified': True, 'lat': 13.0524, 'lng': 80.2606, 'donations': 3},

            # AB+ Universal Plasma Donors
            {'email': 'donor.ab_pos@bloodconnect.org', 'first_name': 'Deepak', 'last_name': 'Hegde', 'phone': '+91 94441 10025', 'locality': 'Vadapalani', 'bg': 'AB+', 'avail': True, 'verified': True, 'lat': 13.0500, 'lng': 80.2121, 'donations': 2},
            {'email': 'donor.nandhini@bloodconnect.org', 'first_name': 'Nandhini', 'last_name': 'Sekar', 'phone': '+91 94441 10026', 'locality': 'Nungambakkam', 'bg': 'AB+', 'avail': True, 'verified': True, 'lat': 13.0595, 'lng': 80.2425, 'donations': 4},
            {'email': 'donor.ashwin@bloodconnect.org', 'first_name': 'Ashwin', 'last_name': 'Prasad', 'phone': '+91 94441 10027', 'locality': 'Perambur', 'bg': 'AB+', 'avail': True, 'verified': False, 'lat': 13.1075, 'lng': 80.2435, 'donations': 1},
            {'email': 'donor.lavanya@bloodconnect.org', 'first_name': 'Lavanya', 'last_name': 'Ramesh', 'phone': '+91 94441 10028', 'locality': 'Ambattur', 'bg': 'AB+', 'avail': True, 'verified': True, 'lat': 13.1143, 'lng': 80.1548, 'donations': 3},

            # AB- Extremely Rare Donors
            {'email': 'donor.ab_neg@bloodconnect.org', 'first_name': 'Meera', 'last_name': 'Iyer', 'phone': '+91 94441 10029', 'locality': 'Mylapore', 'bg': 'AB-', 'avail': True, 'verified': True, 'lat': 13.0368, 'lng': 80.2676, 'donations': 3},
            {'email': 'donor.ganesh@bloodconnect.org', 'first_name': 'Ganesh', 'last_name': 'Raghavan', 'phone': '+91 94441 10030', 'locality': 'Adyar', 'bg': 'AB-', 'avail': True, 'verified': True, 'lat': 13.0012, 'lng': 80.2565, 'donations': 2},
            {'email': 'donor.swetha@bloodconnect.org', 'first_name': 'Swetha', 'last_name': 'Sridhar', 'phone': '+91 94441 10031', 'locality': 'Anna Nagar', 'bg': 'AB-', 'avail': False, 'verified': False, 'lat': 13.0850, 'lng': 80.2101, 'donations': 0},
            {'email': 'donor.vignesh@bloodconnect.org', 'first_name': 'Vignesh', 'last_name': 'Kannan', 'phone': '+91 94441 10032', 'locality': 'Velachery', 'bg': 'AB-', 'avail': True, 'verified': True, 'lat': 12.9815, 'lng': 80.2180, 'donations': 1},
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
                    'city': 'Chennai',
                    'locality': d['locality'],
                    'is_verified': True
                }
            )
            u.city = 'Chennai'
            u.locality = d['locality']
            u.set_password('Donor@1234')
            u.save()

            dp, created_p = DonorProfile.objects.get_or_create(
                user=u,
                defaults={
                    'blood_group': d['bg'],
                    'city': 'Chennai',
                    'locality': d['locality'],
                    'state': 'Tamil Nadu',
                    'approx_latitude': d['lat'],
                    'approx_longitude': d['lng'],
                    'is_available': d['avail'],
                    'notification_consent': True,
                    'is_medically_verified': d['verified'],
                    'total_donations': d['donations'],
                    'last_donation_date': timezone.now().date() - timedelta(days=50) if d['donations'] > 0 else None
                }
            )
            if not created_p:
                dp.blood_group = d['bg']
                dp.city = 'Chennai'
                dp.locality = d['locality']
                dp.state = 'Tamil Nadu'
                dp.approx_latitude = d['lat']
                dp.approx_longitude = d['lng']
                dp.is_available = d['avail']
                dp.is_medically_verified = d['verified']
                dp.total_donations = d['donations']
                dp.save()

            created_donors.append(dp)

        self.stdout.write(self.style.SUCCESS(f"  [+] Seeded {len(created_donors)} Chennai demonstration donors."))

        # -------------------------------------------------------------
        # 4. 8 CHENNAI BLOOD BANKS
        # -------------------------------------------------------------
        banks_data = [
            {
                'name': 'Rajiv Gandhi Govt General Hospital Blood Centre',
                'license_number': 'TN-BLD-01042',
                'address': 'EVR Periyar Salai, Park Town, Chennai, Tamil Nadu 600003',
                'city': 'Chennai',
                'locality': 'Perambur',
                'contact_phone': '+91 44 2530 5000',
                'contact_email': 'bloodbank@rggh.tn.gov.in',
                'latitude': 13.0805,
                'longitude': 80.2785
            },
            {
                'name': 'Government Stanley Hospital Blood Centre',
                'license_number': 'TN-BLD-01088',
                'address': 'Old Jail Road, Royapuram, Chennai, Tamil Nadu 600001',
                'city': 'Chennai',
                'locality': 'Perambur',
                'contact_phone': '+91 44 2528 0900',
                'contact_email': 'bloodcentre@stanley.tn.gov.in',
                'latitude': 13.1052,
                'longitude': 80.2886
            },
            {
                'name': 'Apollo Hospitals Regional Blood Bank',
                'license_number': 'TN-BLD-02114',
                'address': '21 Greams Lane, Thousand Lights, Chennai, Tamil Nadu 600006',
                'city': 'Chennai',
                'locality': 'Nungambakkam',
                'contact_phone': '+91 44 2829 0200',
                'contact_email': 'bloodbank_chennai@apollohospitals.com',
                'latitude': 13.0604,
                'longitude': 80.2514
            },
            {
                'name': 'Fortis Malar Hospital Blood Centre',
                'license_number': 'TN-BLD-02480',
                'address': '52, 1st Main Rd, Gandhi Nagar, Adyar, Chennai, Tamil Nadu 600020',
                'city': 'Chennai',
                'locality': 'Adyar',
                'contact_phone': '+91 44 4289 2222',
                'contact_email': 'transfusion@fortismalar.com',
                'latitude': 13.0076,
                'longitude': 80.2575
            },
            {
                'name': 'MIOT International Blood Centre',
                'license_number': 'TN-BLD-02750',
                'address': '4/112, Mount Poonamallee Rd, Manapakkam, Chennai, Tamil Nadu 600089',
                'city': 'Chennai',
                'locality': 'Porur',
                'contact_phone': '+91 44 4200 2288',
                'contact_email': 'bloodbank@miotinternational.com',
                'latitude': 13.0232,
                'longitude': 80.1873
            },
            {
                'name': 'Sri Ramachandra Medical Centre Blood Centre',
                'license_number': 'TN-BLD-02910',
                'address': 'No.1 Ramachandra Nagar, Porur, Chennai, Tamil Nadu 600116',
                'city': 'Chennai',
                'locality': 'Porur',
                'contact_phone': '+91 44 4592 8500',
                'contact_email': 'transfusion@sriramachandra.edu.in',
                'latitude': 13.0360,
                'longitude': 80.1444
            },
            {
                'name': 'Rotary Central TTK Blood Bank',
                'license_number': 'TN-BLD-00890',
                'address': '130/1, Royapettah High Road, Mylapore, Chennai, Tamil Nadu 600004',
                'city': 'Chennai',
                'locality': 'Mylapore',
                'contact_phone': '+91 44 2811 0500',
                'contact_email': 'info@rotaryttkbloodbank.org',
                'latitude': 13.0425,
                'longitude': 80.2650
            },
            {
                'name': 'SIMS Hospital Blood Centre',
                'license_number': 'TN-BLD-03120',
                'address': 'Metro No. 1, Jawaharlal Nehru Salai, Vadapalani, Chennai, Tamil Nadu 600026',
                'city': 'Chennai',
                'locality': 'Vadapalani',
                'contact_phone': '+91 44 2000 2001',
                'contact_email': 'bloodbank@simshospitals.com',
                'latitude': 13.0515,
                'longitude': 80.2105
            }
        ]

        blood_banks = []
        for b in banks_data:
            bb, created = BloodBank.objects.get_or_create(
                name=b['name'],
                defaults=b
            )
            if not created:
                for k, v in b.items():
                    setattr(bb, k, v)
                bb.save()
            blood_banks.append(bb)

        self.stdout.write(self.style.SUCCESS(f"  [+] Seeded {len(blood_banks)} Chennai blood banks."))

        # -------------------------------------------------------------
        # 5. BLOOD BANK STOCK & INTENTIONAL LOW-STOCK WARNINGS
        # -------------------------------------------------------------
        stock_configs = [
            ('O+', 18, 5),
            ('O-', 2, 5),   # LOW STOCK ALERT
            ('A+', 20, 5),
            ('A-', 3, 4),   # LOW STOCK ALERT
            ('B+', 24, 5),
            ('B-', 4, 5),   # LOW STOCK ALERT
            ('AB+', 11, 4),
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

        self.stdout.write(self.style.SUCCESS("  [+] Seeded Chennai stock reserves with configurable low-stock triggers."))

        # -------------------------------------------------------------
        # 6. 12 EMERGENCY REQUESTS ACROSS CHENNAI HOSPITALS & STATUSES
        # -------------------------------------------------------------
        now = timezone.now()

        requests_seed = [
            # 1. PENDING VERIFICATION (Examiner demo test case 1)
            {
                'ref': 'BC-REQ-CHN-01',
                'requester': primary_requester,
                'case': 'BED-ICU-402',
                'bg': 'O+',
                'comp': 'Packed Red Blood Cells',
                'units': 2,
                'hospital': 'Rajiv Gandhi Govt General Hospital',
                'addr': 'EVR Periyar Salai, Park Town, Chennai',
                'locality': 'Perambur',
                'lat': 13.0805, 'lng': 80.2785,
                'urgency': 'CRITICAL',
                'req_by': now + timedelta(hours=2),
                'reason': 'Emergency cardiac surgery; immediate PRBC standby required.',
                'phone': '+91 94440 12345',
                'contact_pref': 'phone',
                'v_status': VerificationStatus.PENDING,
                'r_status': RequestStatus.PENDING_VERIFICATION,
                'v_by': None, 'v_at': None, 'v_notes': ''
            },
            # 2. PENDING VERIFICATION (Examiner demo test case 2)
            {
                'ref': 'BC-REQ-CHN-02',
                'requester': primary_requester,
                'case': 'TRAUMA-ER-118',
                'bg': 'O-',
                'comp': 'Whole Blood',
                'units': 3,
                'hospital': 'Apollo Hospitals Greams Road',
                'addr': '21 Greams Lane, Thousand Lights, Chennai',
                'locality': 'Nungambakkam',
                'lat': 13.0604, 'lng': 80.2514,
                'urgency': 'CRITICAL',
                'req_by': now + timedelta(hours=3),
                'reason': 'Multiple road trauma resuscitation; universal O- units needed immediately.',
                'phone': '+91 94440 12345',
                'contact_pref': 'hospital_desk',
                'v_status': VerificationStatus.PENDING,
                'r_status': RequestStatus.PENDING_VERIFICATION,
                'v_by': None, 'v_at': None, 'v_notes': ''
            },
            # 3. APPROVED & DONOR RESPONDED (Donor Accepted alert demo)
            {
                'ref': 'BC-REQ-CHN-03',
                'requester': created_requesters[1],
                'case': 'SURG-WARD-304',
                'bg': 'A+',
                'comp': 'Whole Blood',
                'units': 2,
                'hospital': 'Fortis Malar Hospital',
                'addr': '52, 1st Main Rd, Gandhi Nagar, Adyar, Chennai',
                'locality': 'Adyar',
                'lat': 13.0076, 'lng': 80.2575,
                'urgency': 'URGENT',
                'req_by': now + timedelta(hours=6),
                'reason': 'Orthopedic fracture stabilization and emergency blood coverage.',
                'phone': '+91 94440 12346',
                'contact_pref': 'phone',
                'v_status': VerificationStatus.APPROVED,
                'r_status': RequestStatus.DONOR_RESPONDED,
                'v_by': primary_admin,
                'v_at': now - timedelta(hours=1),
                'v_notes': 'Verified with Chief Resident, Fortis Malar Adyar.'
            },
            # 4. APPROVED & ALERTS SENT (Active in circulation)
            {
                'ref': 'BC-REQ-CHN-04',
                'requester': created_requesters[2],
                'case': 'PED-ICU-88',
                'bg': 'B+',
                'comp': 'Platelets',
                'units': 2,
                'hospital': 'Government Stanley Hospital',
                'addr': 'Old Jail Road, Royapuram, Chennai',
                'locality': 'Perambur',
                'lat': 13.1052, 'lng': 80.2886,
                'urgency': 'URGENT',
                'req_by': now + timedelta(hours=8),
                'reason': 'Severe dengue platelet depletion transfusion support.',
                'phone': '+91 94440 12347',
                'contact_pref': 'in_app',
                'v_status': VerificationStatus.APPROVED,
                'r_status': RequestStatus.ACTIVE_ALERTS_SENT,
                'v_by': primary_admin,
                'v_at': now - timedelta(hours=2),
                'v_notes': 'Admission slip verified with pediatric casualty desk.'
            },
            # 5. APPROVED & ACTIVE
            {
                'ref': 'BC-REQ-CHN-05',
                'requester': primary_requester,
                'case': 'NEURO-ICU-12',
                'bg': 'AB+',
                'comp': 'Fresh Frozen Plasma',
                'units': 2,
                'hospital': 'SIMS Hospital Vadapalani',
                'addr': 'Jawaharlal Nehru Salai, Vadapalani, Chennai',
                'locality': 'Vadapalani',
                'lat': 13.0515, 'lng': 80.2105,
                'urgency': 'STANDARD',
                'req_by': now + timedelta(hours=14),
                'reason': 'Coagulation management during neurovascular procedure.',
                'phone': '+91 94440 12345',
                'contact_pref': 'in_app',
                'v_status': VerificationStatus.APPROVED,
                'r_status': RequestStatus.ACTIVE_ALERTS_SENT,
                'v_by': primary_admin,
                'v_at': now - timedelta(hours=3),
                'v_notes': 'Verified with neuro department coordinator.'
            },
            # 6. FULFILLED REQUEST
            {
                'ref': 'BC-REQ-CHN-06',
                'requester': created_requesters[1],
                'case': 'ONCO-DAY-99',
                'bg': 'B-',
                'comp': 'Packed Red Blood Cells',
                'units': 1,
                'hospital': 'MIOT International',
                'addr': 'Mount Poonamallee Rd, Manapakkam, Chennai',
                'locality': 'Porur',
                'lat': 13.0232, 'lng': 80.1873,
                'urgency': 'STANDARD',
                'req_by': now - timedelta(hours=12),
                'reason': 'Oncology transfusion protocol completed successfully.',
                'phone': '+91 94440 12346',
                'contact_pref': 'phone',
                'v_status': VerificationStatus.APPROVED,
                'r_status': RequestStatus.FULFILLED,
                'v_by': primary_admin,
                'v_at': now - timedelta(days=1),
                'v_notes': 'Verified oncology day-care case.',
                'fulfill_notes': 'Donation fulfilled by volunteer donor; crossmatch cleared at MIOT blood bank.'
            },
            # 7. FULFILLED REQUEST
            {
                'ref': 'BC-REQ-CHN-07',
                'requester': created_requesters[2],
                'case': 'MAT-DELIV-45',
                'bg': 'A-',
                'comp': 'Whole Blood',
                'units': 2,
                'hospital': 'Sri Ramachandra Medical Centre',
                'addr': 'No.1 Ramachandra Nagar, Porur, Chennai',
                'locality': 'Porur',
                'lat': 13.0360, 'lng': 80.1444,
                'urgency': 'URGENT',
                'req_by': now - timedelta(days=2),
                'reason': 'Postpartum hemorrhage emergency management.',
                'phone': '+91 94440 12347',
                'contact_pref': 'phone',
                'v_status': VerificationStatus.APPROVED,
                'r_status': RequestStatus.FULFILLED,
                'v_by': primary_admin,
                'v_at': now - timedelta(days=3),
                'v_notes': 'Obstetric ICU emergency verified.',
                'fulfill_notes': 'Transfusion successfully completed; patient stable.'
            },
            # 8. REJECTED REQUEST (Demonstrates anti-fraud verification)
            {
                'ref': 'BC-REQ-CHN-08',
                'requester': primary_requester,
                'case': 'MOCK-INVALID-99',
                'bg': 'AB-',
                'comp': 'Whole Blood',
                'units': 4,
                'hospital': 'Unverified Private Clinic',
                'addr': 'T. Nagar, Chennai',
                'locality': 'T. Nagar',
                'lat': 13.0418, 'lng': 80.2341,
                'urgency': 'STANDARD',
                'req_by': now - timedelta(days=1),
                'reason': 'Non-emergency standby request lacking physician sign-off.',
                'phone': '+91 94440 12345',
                'contact_pref': 'phone',
                'v_status': VerificationStatus.REJECTED,
                'r_status': RequestStatus.CLOSED,
                'v_by': primary_admin,
                'v_at': now - timedelta(days=1),
                'v_notes': 'Rejected: Facility registration could not be verified and no valid medical officer order was attached.'
            },
            # 9. CANCELLED REQUEST
            {
                'ref': 'BC-REQ-CHN-09',
                'requester': created_requesters[1],
                'case': 'SURG-RESCHED-55',
                'bg': 'O+',
                'comp': 'Whole Blood',
                'units': 1,
                'hospital': 'Rotary Central TTK Blood Bank',
                'addr': 'Royapettah High Road, Mylapore, Chennai',
                'locality': 'Mylapore',
                'lat': 13.0425, 'lng': 80.2650,
                'urgency': 'STANDARD',
                'req_by': now - timedelta(hours=10),
                'reason': 'Elective surgery postponed due to patient medical parameters.',
                'phone': '+91 94440 12346',
                'contact_pref': 'in_app',
                'v_status': VerificationStatus.APPROVED,
                'r_status': RequestStatus.CANCELLED,
                'v_by': primary_admin,
                'v_at': now - timedelta(hours=18),
                'v_notes': 'Verified case file.'
            },
            # 10. ACTIVE ALERTS SENT
            {
                'ref': 'BC-REQ-CHN-10',
                'requester': created_requesters[2],
                'case': 'DIALYSIS-UNIT-71',
                'bg': 'B+',
                'comp': 'Packed Red Blood Cells',
                'units': 2,
                'hospital': 'Fortis Malar Hospital',
                'addr': 'Gandhi Nagar, Adyar, Chennai',
                'locality': 'Adyar',
                'lat': 13.0076, 'lng': 80.2575,
                'urgency': 'URGENT',
                'req_by': now + timedelta(hours=5),
                'reason': 'Chronic renal failure with severe symptomatic anemia.',
                'phone': '+91 94440 12347',
                'contact_pref': 'phone',
                'v_status': VerificationStatus.APPROVED,
                'r_status': RequestStatus.ACTIVE_ALERTS_SENT,
                'v_by': primary_admin,
                'v_at': now - timedelta(minutes=45),
                'v_notes': 'Dialysis nephrology resident verified admission.'
            },
            # 11. PENDING VERIFICATION
            {
                'ref': 'BC-REQ-CHN-11',
                'requester': primary_requester,
                'case': 'TRAUMA-ICU-62',
                'bg': 'A+',
                'comp': 'Whole Blood',
                'units': 2,
                'hospital': 'Government Stanley Hospital',
                'addr': 'Old Jail Road, Royapuram, Chennai',
                'locality': 'Perambur',
                'lat': 13.1052, 'lng': 80.2886,
                'urgency': 'CRITICAL',
                'req_by': now + timedelta(hours=4),
                'reason': 'Industrial burn trauma patient in emergency surgical debridement.',
                'phone': '+91 94440 12345',
                'contact_pref': 'hospital_desk',
                'v_status': VerificationStatus.PENDING,
                'r_status': RequestStatus.PENDING_VERIFICATION,
                'v_by': None, 'v_at': None, 'v_notes': ''
            },
            # 12. DONOR RESPONDED
            {
                'ref': 'BC-REQ-CHN-12',
                'requester': created_requesters[1],
                'case': 'ICU-BED-21',
                'bg': 'AB-',
                'comp': 'Fresh Frozen Plasma',
                'units': 1,
                'hospital': 'Apollo Hospitals Greams Road',
                'addr': '21 Greams Lane, Thousand Lights, Chennai',
                'locality': 'Nungambakkam',
                'lat': 13.0604, 'lng': 80.2514,
                'urgency': 'URGENT',
                'req_by': now + timedelta(hours=7),
                'reason': 'Severe hepatic coagulopathy requiring rare AB- plasma transfusion.',
                'phone': '+91 94440 12346',
                'contact_pref': 'phone',
                'v_status': VerificationStatus.APPROVED,
                'r_status': RequestStatus.DONOR_RESPONDED,
                'v_by': primary_admin,
                'v_at': now - timedelta(hours=2),
                'v_notes': 'Hepatology ICU specialist validated request.'
            }
        ]

        created_requests = []
        for r_data in requests_seed:
            req, created = BloodRequest.objects.get_or_create(
                reference_number=r_data['ref'],
                defaults={
                    'requester': r_data['requester'],
                    'patient_case_ref': r_data['case'],
                    'blood_group': r_data['bg'],
                    'component': r_data['comp'],
                    'units_requested': r_data['units'],
                    'hospital_name': r_data['hospital'],
                    'hospital_address': r_data['addr'],
                    'city': 'Chennai',
                    'locality': r_data['locality'],
                    'hospital_lat': r_data['lat'],
                    'hospital_lng': r_data['lng'],
                    'urgency': r_data['urgency'],
                    'required_by': r_data['req_by'],
                    'reason': r_data['reason'],
                    'contact_phone': r_data['phone'],
                    'contact_preference': r_data['contact_pref'],
                    'verification_status': r_data['v_status'],
                    'request_status': r_data['r_status'],
                    'verified_by': r_data['v_by'],
                    'verified_at': r_data['v_at'],
                    'verification_notes': r_data['v_notes'],
                    'fulfillment_notes': r_data.get('fulfill_notes', '')
                }
            )
            created_requests.append(req)

            # If request is approved/matching, automatically execute donor matching
            if req.verification_status == VerificationStatus.APPROVED:
                matches = run_donor_matching(req)

                # For BC-REQ-CHN-03 (Fortis Malar A+), mark one match ACCEPTED
                if req.reference_number == 'BC-REQ-CHN-03' and matches:
                    first_match = matches[0]
                    first_match.alert_status = AlertStatus.ACCEPTED
                    first_match.donor_response_message = "I am at Adyar now. Can reach Fortis Malar blood bank in 15 minutes."
                    first_match.responded_at = now - timedelta(minutes=25)
                    first_match.save()

                # For BC-REQ-CHN-12 (Apollo AB-), mark one match ACCEPTED
                if req.reference_number == 'BC-REQ-CHN-12' and matches:
                    first_match = matches[0]
                    first_match.alert_status = AlertStatus.ACCEPTED
                    first_match.donor_response_message = "Confirmed. Eligible AB- donor, arriving at Apollo Greams Road blood bank."
                    first_match.responded_at = now - timedelta(minutes=40)
                    first_match.save()

        self.stdout.write(self.style.SUCCESS(f"  [+] Seeded {len(created_requests)} Chennai emergency blood requests."))

        # -------------------------------------------------------------
        # 7. SAMPLE NOTIFICATIONS (ADMIN, REQUESTER, AND DONORS)
        # -------------------------------------------------------------
        # Low-stock alerts for admin
        for admin_u in admin_users:
            Notification.objects.get_or_create(
                recipient=admin_u,
                title='LOW STOCK ALERT: AB- at Rajiv Gandhi Govt General Hospital',
                defaults={
                    'message': 'Only 1 unit available for AB- Whole Blood (Threshold: 3 units). Replenishment warning triggered for Chennai central hub.',
                    'notification_type': NotificationType.LOW_STOCK,
                    'urgency': 'URGENT',
                    'action_url': '/admin-portal/low-stock'
                }
            )
            Notification.objects.get_or_create(
                recipient=admin_u,
                title='LOW STOCK ALERT: O- at Apollo Hospitals Regional Blood Bank',
                defaults={
                    'message': 'Only 2 units of O- universal red cell units remain in stock (Threshold: 5 units). Chennai regional buffer low.',
                    'notification_type': NotificationType.LOW_STOCK,
                    'urgency': 'URGENT',
                    'action_url': '/admin-portal/low-stock'
                }
            )

        # Requester Notification
        Notification.objects.get_or_create(
            recipient=primary_requester,
            title='Emergency Request BC-REQ-CHN-03 Approved',
            defaults={
                'message': 'Your request for 2 units of A+ blood at Fortis Malar Hospital was verified and matching donors in Adyar were alerted.',
                'notification_type': NotificationType.STATUS_UPDATE,
                'urgency': 'URGENT',
                'action_url': '/requester/my-requests'
            }
        )

        # Donor Notification
        if created_donors:
            donor_first = created_donors[0]
            Notification.objects.get_or_create(
                recipient=donor_first.user,
                title='Emergency Blood Alert: Nearby Patient in Need',
                defaults={
                    'message': 'Urgent requirement for O- blood at Rajiv Gandhi Govt General Hospital (Perambur / Central Chennai). Please review and respond.',
                    'notification_type': NotificationType.EMERGENCY_ALERT,
                    'urgency': 'CRITICAL',
                    'action_url': '/donor/notifications'
                }
            )

        # -------------------------------------------------------------
        # 8. AUDIT LOGS FOR CHENNAI INITIALIZATION
        # -------------------------------------------------------------
        AuditLog.objects.get_or_create(
            action='CHENNAI_LOCALIZATION_BOOTSTRAP',
            target_model='System',
            target_id='INIT-CHN',
            defaults={
                'actor': primary_admin,
                'actor_email': primary_admin.email,
                'actor_role': 'admin',
                'details': 'System initialized with 6 team admin accounts, 32 Chennai donors across 15 localities, 8 regional blood banks, and 12 emergency requests.'
            }
        )

        self.stdout.write(self.style.SUCCESS("\n==> BloodConnect Chennai Seed Data Initialized Successfully!"))
        self.stdout.write(self.style.SUCCESS("=================================================================="))
        self.stdout.write(self.style.SUCCESS("  SIX TEAM ADMINISTRATOR ACCOUNTS (Password: Admin@1234):"))
        for tm in team_members:
            self.stdout.write(self.style.SUCCESS(f"  - {tm['first_name']} {tm['last_name']}: {tm['username']} / {tm['email']}"))
        self.stdout.write(self.style.SUCCESS("------------------------------------------------------------------"))
        self.stdout.write(self.style.SUCCESS("  DEMO REQUESTER:  requester@bloodconnect.org   / Requester@1234"))
        self.stdout.write(self.style.SUCCESS("  DEMO DONOR (O-): donor.o_neg@bloodconnect.org / Donor@1234"))
        self.stdout.write(self.style.SUCCESS("  DEMO DONOR (O+): donor.o_pos@bloodconnect.org / Donor@1234"))
        self.stdout.write(self.style.SUCCESS("  DEMO DONOR (A+): donor.a_pos@bloodconnect.org / Donor@1234"))
        self.stdout.write(self.style.SUCCESS("=================================================================="))
