from django.db import models

class BloodGroup(models.TextChoices):
    A_POS = 'A+', 'A+'
    A_NEG = 'A-', 'A-'
    B_POS = 'B+', 'B+'
    B_NEG = 'B-', 'B-'
    AB_POS = 'AB+', 'AB+'
    AB_NEG = 'AB-', 'AB-'
    O_POS = 'O+', 'O+'
    O_NEG = 'O-', 'O-'

class BloodComponent(models.TextChoices):
    WHOLE_BLOOD = 'Whole Blood', 'Whole Blood'
    PACKED_RED_CELLS = 'Packed Red Blood Cells', 'Packed Red Blood Cells (PRBC)'
    PLATELETS = 'Platelets', 'Platelet Concentrate'
    FRESH_FROZEN_PLASMA = 'Fresh Frozen Plasma', 'Fresh Frozen Plasma (FFP)'
    CRYOPRECIPITATE = 'Cryoprecipitate', 'Cryoprecipitate'

class UrgencyLevel(models.TextChoices):
    CRITICAL = 'CRITICAL', 'Critical (Within 2 Hours)'
    URGENT = 'URGENT', 'Urgent (Within 6 Hours)'
    STANDARD = 'STANDARD', 'Standard (Within 24 Hours)'

CHENNAI_LOCALITIES = [
    'Adyar',
    'Anna Nagar',
    'T. Nagar',
    'Velachery',
    'Tambaram',
    'Guindy',
    'Mylapore',
    'Porur',
    'Perambur',
    'Royapettah',
    'Vadapalani',
    'Sholinganallur',
    'Thoraipakkam',
    'Nungambakkam',
    'Ambattur',
]

