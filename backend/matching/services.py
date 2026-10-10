import math
from django.utils import timezone
from donors.models import DonorProfile
from matching.models import DonorMatch, AlertStatus
from notifications.models import Notification, NotificationType

# Standard ABO / Rh red cell donor compatibility mapping
# Key is recipient blood group, values are compatible donor blood groups
COMPATIBLE_DONORS_MAP = {
    'O-': ['O-'],
    'O+': ['O-', 'O+'],
    'A-': ['O-', 'A-'],
    'A+': ['O-', 'O+', 'A-', 'A+'],
    'B-': ['O-', 'B-'],
    'B+': ['O-', 'O+', 'B-', 'B+'],
    'AB-': ['O-', 'A-', 'B-', 'AB-'],
    'AB+': ['O-', 'O+', 'A-', 'A+', 'B-', 'B+', 'AB-', 'AB+'],
}

CLINICAL_DISCLAIMER = (
    "Potential donor match — final suitability, antibody screening, and transfusion compatibility "
    "must be confirmed through authorized blood bank crossmatching."
)


def calculate_haversine_distance(lat1, lon1, lat2, lon2):
    """
    Calculates great-circle distance between two coordinates in kilometers.
    """
    if lat1 is None or lon1 is None or lat2 is None or lon2 is None:
        return None
    try:
        r = 6371.0  # Earth radius in kilometers
        d_lat = math.radians(lat2 - lat1)
        d_lon = math.radians(lon2 - lon1)
        a = (
            math.sin(d_lat / 2) ** 2
            + math.cos(math.radians(lat1))
            * math.cos(math.radians(lat2))
            * math.sin(d_lon / 2) ** 2
        )
        c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
        return round(r * c, 1)
    except Exception:
        return None


def run_donor_matching(blood_request, max_matches=15):
    """
    Matches registered, available, consenting donors for an approved blood request.
    Creates DonorMatch records and dispatches in-app notifications.
    Guarantees no duplicate matches are created for the same request and donor.
    """
    recipient_group = blood_request.blood_group
    compatible_groups = COMPATIBLE_DONORS_MAP.get(recipient_group, [recipient_group])

    # Filter eligible potential donors:
    # 1. Available
    # 2. Notification consent given
    # 3. Compatible blood group
    # 4. Exclude the requester themselves if they are also registered as a donor
    candidate_donors = DonorProfile.objects.filter(
        is_available=True,
        notification_consent=True,
        blood_group__in=compatible_groups
    ).exclude(user=blood_request.requester).select_related('user')

    created_matches = []
    
    for donor in candidate_donors:
        # Check if match already exists
        match_obj, created = DonorMatch.objects.get_or_create(
            blood_request=blood_request,
            donor=donor,
            defaults={'alert_status': AlertStatus.DISPATCHED}
        )

        is_exact = (donor.blood_group == recipient_group)
        base_score = 100 if is_exact else 80
        match_type = 'EXACT_MATCH' if is_exact else 'COMPATIBLE_SUBSTITUTE'

        # Geographic proximity score bonus
        dist = calculate_haversine_distance(
            blood_request.hospital_lat,
            blood_request.hospital_lng,
            donor.approx_latitude,
            donor.approx_longitude
        )

        proximity_bonus = 0
        if dist is not None:
            if dist <= 10.0:
                proximity_bonus = 15
            elif dist <= 25.0:
                proximity_bonus = 10
            elif dist <= 50.0:
                proximity_bonus = 5
        elif donor.city and blood_request.city and donor.city.strip().lower() == blood_request.city.strip().lower():
            proximity_bonus = 10
            if donor.locality and blood_request.locality and donor.locality.strip().lower() == blood_request.locality.strip().lower():
                proximity_bonus += 5

        final_score = min(100, base_score + proximity_bonus)

        explanation = (
            f"{'Identical blood group match' if is_exact else f'Compatible donor group ({donor.blood_group}) for recipient ({recipient_group})'}. "
            f"Donor locality: {donor.locality or 'Not specified'}, {donor.city}. "
            f"{f'Proximity: ~{dist} km. ' if dist else ''}"
            f"{CLINICAL_DISCLAIMER}"
        )

        match_obj.compatibility_score = final_score
        match_obj.match_type = match_type
        match_obj.match_explanation = explanation
        match_obj.distance_km = dist
        match_obj.save()

        # Send in-app notification if new match
        if created:
            Notification.objects.create(
                recipient=donor.user,
                related_request=blood_request,
                title=f"URGENT: Emergency Blood Request ({blood_request.blood_group})",
                message=(
                    f"Hospital '{blood_request.hospital_name}' urgently requires {blood_request.units_requested} unit(s) "
                    f"of {blood_request.blood_group} {blood_request.component}. "
                    f"Urgency: {blood_request.urgency}. Please review and respond if available to donate."
                ),
                notification_type=NotificationType.EMERGENCY_ALERT,
                urgency=blood_request.urgency,
                action_url=f"/donor/alerts/{match_obj.id}"
            )

        created_matches.append(match_obj)

    # Sort matches by score descending
    created_matches.sort(key=lambda m: m.compatibility_score, reverse=True)
    return created_matches[:max_matches]
