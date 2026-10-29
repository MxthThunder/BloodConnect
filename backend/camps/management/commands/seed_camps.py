from datetime import time, timedelta

from django.core.management.base import BaseCommand
from django.utils import timezone

from accounts.models import User, UserRole
from camps.constants import CampStatus, EventKind, OrganisationType, PartnerStatus
from camps.models import CampApplication, CampEvent, CampInterest
from donors.models import DonorProfile

ORGANISERS = [
    ('organiser@bloodconnect.org', 'Kavya', 'Ramesh', 'Adyar'),
    ('organiser.ngo@bloodconnect.org', 'Arjun', 'Natarajan', 'Anna Nagar'),
]

FULL_SUPPORT = ['MEDICAL_PERSONNEL', 'DONOR_SCREENING', 'COLLECTION_EQUIPMENT']
COMMON = ['SEATING', 'WATER_REFRESH', 'POWER_BACKUP', 'DONATION_SPACE', 'REG_DESK', 'FIRST_AID']

# (ref, organiser#, org name, type, title, locality, venue, address, days from today, start, end, expected,
#  status, partner_status, partner# (1-based label of a fictional demo partner, or None), support)
# All organisations below are fictional demonstration data.
CAMPS = [
    ('BC-CAMP-DEMO-01', 0, 'Greenfield Arts & Science College (NSS Unit)', OrganisationType.COLLEGE,
     'Campus Blood Donation Drive', 'Velachery', 'Greenfield College Auditorium', 'Demo Campus Road, Velachery, Chennai',
     21, time(9, 30), time(15, 0), 150, CampStatus.SUBMITTED, PartnerStatus.NOT_CONTACTED, None, []),
    ('BC-CAMP-DEMO-02', 1, 'Bayview Software Services (Employee Welfare Club)', OrganisationType.COMPANY,
     'Corporate Blood Donation Day', 'Sholinganallur', 'Bayview Tech Park, Cafeteria Block', 'Demo IT Corridor, Sholinganallur, Chennai',
     18, time(10, 0), time(16, 0), 200, CampStatus.UNDER_REVIEW, PartnerStatus.NOT_CONTACTED, None, []),
    ('BC-CAMP-DEMO-03', 0, 'Marina Residents Welfare Association', OrganisationType.COMMUNITY,
     'Neighbourhood Donation Camp', 'Adyar', 'Residents Association Hall', 'Demo Lane, Adyar, Chennai',
     15, time(8, 30), time(13, 0), 80, CampStatus.PARTNER_COORDINATION, PartnerStatus.CONTACTED, 0, []),
    ('BC-CAMP-DEMO-04', 1, 'Anna Nagar Youth Volunteers Trust', OrganisationType.NGO,
     'Youth Volunteers Blood Camp', 'Anna Nagar', 'Community Centre', 'Demo Main Road, Anna Nagar, Chennai',
     9, time(9, 0), time(14, 0), 120, CampStatus.APPROVED, PartnerStatus.CONFIRMED, 1, FULL_SUPPORT),
    ('BC-CAMP-DEMO-05', 1, 'Tambaram Community Service Society', OrganisationType.NGO,
     'Community Service Blood Camp', 'Tambaram', 'Society Hall', 'Demo Station Road, Tambaram, Chennai',
     12, time(9, 0), time(13, 30), 100, CampStatus.APPROVED, PartnerStatus.CONFIRMED, 2, FULL_SUPPORT + ['UNIT_TRANSPORT']),
    ('BC-CAMP-DEMO-06', 0, 'Porur Tech Park Employees Forum', OrganisationType.COMPANY,
     'Employees Forum Donation Day', 'Porur', 'Tech Park Conference Hall', 'Demo Trunk Road, Porur, Chennai',
     6, time(10, 0), time(15, 30), 180, CampStatus.APPROVED, PartnerStatus.CONFIRMED, 3, FULL_SUPPORT),
    ('BC-CAMP-DEMO-07', 0, 'Mylapore Cultural Academy', OrganisationType.NGO,
     'Cultural Academy Blood Camp', 'Mylapore', 'Academy Auditorium', 'Demo Temple Street, Mylapore, Chennai',
     26, time(9, 30), time(13, 30), 90, CampStatus.APPROVED, PartnerStatus.CONFIRMED, 4, FULL_SUPPORT),
    ('BC-CAMP-DEMO-08', 1, 'Guindy Institute of Technology (Student Council)', OrganisationType.COLLEGE,
     'Student Council Blood Drive', 'Guindy', 'Institute Main Hall', 'Demo Campus, Guindy, Chennai',
     -20, time(9, 0), time(14, 0), 140, CampStatus.COMPLETED, PartnerStatus.CONFIRMED, 0, FULL_SUPPORT),
    ('BC-CAMP-DEMO-09', 1, 'Perambur Traders Association', OrganisationType.COMMUNITY,
     'Traders Association Camp', 'Perambur', 'Association Office', 'Demo Market Road, Perambur, Chennai',
     14, time(10, 0), time(14, 0), 60, CampStatus.REJECTED, PartnerStatus.NOT_CONTACTED, None, []),
]

INTERESTED = ['donor.o_neg@bloodconnect.org', 'donor.o_pos@bloodconnect.org', 'donor.a_pos@bloodconnect.org',
              'donor.saravanan@bloodconnect.org', 'donor.senthil@bloodconnect.org']


class Command(BaseCommand):
    help = 'Creates demonstration camp organisers and applications at every workflow stage (fictional organisations). Idempotent.'

    def handle(self, *args, **options):
        admin = User.objects.filter(role=UserRole.ADMIN).order_by('id').first()
        organisers = []
        for email, first, last, locality in ORGANISERS:
            user, _ = User.objects.get_or_create(email=email, defaults={
                'username': email, 'first_name': first, 'last_name': last, 'role': UserRole.ORGANISER,
                'city': 'Chennai', 'locality': locality, 'phone': '+91 90000 00000',
            })
            user.role = UserRole.ORGANISER
            user.set_password('Organiser@1234')
            user.save()
            organisers.append(user)

        today = timezone.localdate()
        created = 0
        for (ref, org_i, org_name, org_type, title, locality, venue, address, days, start, end, expected,
             status, partner_status, partner_i, support) in CAMPS:
            # Demo partners are clearly fictional: seeded camps never claim a real institution has confirmed support.
            partner_name = f'Demo Partner Blood Centre {partner_i + 1} (fictional)' if partner_i is not None else ''
            existing = CampApplication.objects.filter(reference_number=ref).first()
            if existing:
                changed = []
                if existing.partner_id or existing.partner_name != partner_name:
                    existing.partner, existing.partner_name = None, partner_name
                    changed += ['partner', 'partner_name']
                if existing.venue_name != venue:
                    existing.venue_name = venue
                    changed.append('venue_name')
                # keep upcoming demo camps upcoming when the seed is re-run on a later day
                if status in (CampStatus.SUBMITTED, CampStatus.UNDER_REVIEW, CampStatus.PARTNER_COORDINATION,
                              CampStatus.APPROVED, CampStatus.REJECTED) and existing.camp_date < today + timedelta(days=2):
                    existing.camp_date = today + timedelta(days=days)
                    changed.append('camp_date')
                if changed:
                    existing.save(update_fields=changed + ['updated_at'])
                continue
            app = CampApplication.objects.create(
                reference_number=ref, organiser=organisers[org_i], organisation_name=org_name, organisation_type=org_type,
                title=title, description=f'{title}, organised by {org_name}. Open to everyone aged 18-65 in good health.',
                venue_name=venue, address=address, locality=locality, camp_date=today + timedelta(days=days),
                start_time=start, end_time=end, expected_donors=expected, facilities=COMMON,
                contact_name=organisers[org_i].first_name, contact_phone='+91 90000 00000',
                contact_email=organisers[org_i].email, registration_info='Walk in with a photo ID, or register interest here.',
                status=status, partner_status=partner_status, partner_name=partner_name, partner_support=support,
            )
            now = timezone.now()
            org_user = organisers[org_i]
            CampEvent.objects.create(application=app, kind=EventKind.SUBMITTED, actor=org_user,
                                     message='Application submitted by the organiser.', to_status=CampStatus.SUBMITTED)
            if status != CampStatus.SUBMITTED:
                app.reviewed_by, app.reviewed_at = admin, now
                CampEvent.objects.create(application=app, kind=EventKind.STATUS, actor=admin,
                                         message='BloodConnect started reviewing the application.',
                                         from_status=CampStatus.SUBMITTED, to_status=CampStatus.UNDER_REVIEW)
            if status in (CampStatus.PARTNER_COORDINATION, CampStatus.APPROVED, CampStatus.COMPLETED):
                CampEvent.objects.create(application=app, kind=EventKind.STATUS, actor=admin,
                                         message='Coordination with a medical partner has started.',
                                         from_status=CampStatus.UNDER_REVIEW, to_status=CampStatus.PARTNER_COORDINATION)
            if status in (CampStatus.APPROVED, CampStatus.COMPLETED):
                app.approved_at = now
                CampEvent.objects.create(application=app, kind=EventKind.STATUS, actor=admin,
                                         message=f'Approved. {partner_name} confirmed support.',
                                         from_status=CampStatus.PARTNER_COORDINATION, to_status=CampStatus.APPROVED)
            if status == CampStatus.COMPLETED:
                app.completed_at = now
                app.completion_notes = 'Demonstration record: donor count was not recorded.'
                CampEvent.objects.create(application=app, kind=EventKind.STATUS, actor=admin,
                                         message='Camp completed. Donor count not recorded.',
                                         from_status=CampStatus.APPROVED, to_status=CampStatus.COMPLETED)
            if status == CampStatus.REJECTED:
                app.rejection_reason = 'The venue has no separate room for donor screening. You are welcome to re-apply with a suitable venue.'
                CampEvent.objects.create(application=app, kind=EventKind.STATUS, actor=admin,
                                         message=f'Not approved. Reason: {app.rejection_reason}',
                                         from_status=CampStatus.UNDER_REVIEW, to_status=CampStatus.REJECTED)
            app.save()
            created += 1

        interested = 0
        for camp in CampApplication.objects.filter(status=CampStatus.APPROVED, reference_number__startswith='BC-CAMP-DEMO'):
            for email in INTERESTED[:3] if camp.locality in ('Anna Nagar', 'Porur') else INTERESTED[2:5]:
                donor = User.objects.filter(email=email).first()
                if donor and DonorProfile.objects.filter(user=donor).exists():
                    _, new = CampInterest.objects.get_or_create(application=camp, user=donor)
                    interested += int(new)
        self.stdout.write(self.style.SUCCESS(
            f'Camps: {created} demo application(s) created, {interested} interest record(s) added. '
            f'Organiser demo login: organiser@bloodconnect.org / Organiser@1234'))
