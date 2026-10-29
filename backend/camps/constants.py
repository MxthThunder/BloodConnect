from django.db import models

# An application needs at least this many days of lead time so that a medical partner can be arranged.
MIN_LEAD_DAYS = 3
MAX_LEAD_DAYS = 365
MIN_EXPECTED_DONORS = 10
MAX_EXPECTED_DONORS = 5000

# Rough bounding box of the Chennai metropolitan area; used only to reject obviously wrong coordinates.
CHENNAI_BOUNDS = {'lat': (12.70, 13.40), 'lng': (79.90, 80.50)}


class OrganisationType(models.TextChoices):
    COLLEGE = 'COLLEGE', 'College / university'
    COMPANY = 'COMPANY', 'Company / workplace'
    NGO = 'NGO', 'NGO / charitable trust'
    COMMUNITY = 'COMMUNITY', 'Community / residents group'
    HOSPITAL = 'HOSPITAL', 'Hospital / clinic'
    OTHER = 'OTHER', 'Other organisation'


class CampStatus(models.TextChoices):
    SUBMITTED = 'SUBMITTED', 'Submitted'
    UNDER_REVIEW = 'UNDER_REVIEW', 'Under review'
    PARTNER_COORDINATION = 'PARTNER_COORDINATION', 'Medical partner coordination'
    APPROVED = 'APPROVED', 'Approved'
    COMPLETED = 'COMPLETED', 'Completed'
    REJECTED = 'REJECTED', 'Not approved'
    CANCELLED = 'CANCELLED', 'Cancelled'


# The happy path shown to organisers as a progress tracker.
STAGES = (
    CampStatus.SUBMITTED, CampStatus.UNDER_REVIEW, CampStatus.PARTNER_COORDINATION,
    CampStatus.APPROVED, CampStatus.COMPLETED,
)
TERMINAL_STATUSES = (CampStatus.COMPLETED, CampStatus.REJECTED, CampStatus.CANCELLED)


class PartnerStatus(models.TextChoices):
    NOT_CONTACTED = 'NOT_CONTACTED', 'No partner contacted yet'
    CONTACTED = 'CONTACTED', 'Partner contacted, awaiting reply'
    CONFIRMED = 'CONFIRMED', 'Partner confirmed availability'
    DECLINED = 'DECLINED', 'Partner unable to support'


class EventKind(models.TextChoices):
    SUBMITTED = 'SUBMITTED', 'Application submitted'
    EDITED = 'EDITED', 'Application edited'
    STATUS = 'STATUS', 'Status changed'
    PARTNER = 'PARTNER', 'Medical partner update'
    NOTE = 'NOTE', 'Note'


# Venue facilities the organiser can offer. These are NOT medical facilities.
FACILITIES = [
    ('SEATING', 'Seating and waiting area'),
    ('WATER_REFRESH', 'Drinking water and refreshments'),
    ('POWER_BACKUP', 'Power backup'),
    ('AIR_COOLING', 'Fans / air conditioning'),
    ('DONATION_SPACE', 'Hall or rooms suitable for donation beds'),
    ('SCREENING_ROOM', 'Private room for donor screening'),
    ('REG_DESK', 'Registration desk'),
    ('FIRST_AID', 'First-aid kit'),
    ('PARKING', 'Parking'),
    ('WHEELCHAIR', 'Wheelchair-accessible venue'),
]
FACILITY_LABELS = dict(FACILITIES)

# Support a qualified partner may provide. Never promised until the partner has confirmed.
SUPPORT_TYPES = [
    ('MEDICAL_PERSONNEL', 'Qualified medical personnel'),
    ('DONOR_SCREENING', 'Donor screening arrangements'),
    ('COLLECTION_EQUIPMENT', 'Blood collection equipment'),
    ('UNIT_TRANSPORT', 'Transport and storage of collected units'),
    ('OTHER', 'Other essential requirements'),
]
SUPPORT_LABELS = dict(SUPPORT_TYPES)

COORDINATION_NOTICE = (
    'BloodConnect only coordinates. Donor screening, blood collection and every clinical procedure must be '
    'carried out by qualified, authorised professionals or institutions. No medical support is promised '
    'until a suitable partner has confirmed availability.'
)
