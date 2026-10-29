"""
Candidate discovery, eligibility filtering and transparent prioritisation.

Everything that ranks a donor is spelled out here, and every ranked candidate carries a
point-by-point breakdown plus a plain-language explanation. Blood-group filtering is
only a *matching criterion* (it reuses the platform's existing ABO/Rh table); it does not
establish transfusion compatibility, and nothing here judges medical eligibility.
"""
from dataclasses import dataclass, field
from datetime import datetime, timedelta

from matching.services import COMPATIBLE_DONORS_MAP, calculate_haversine_distance
from .constants import AttemptStatus, LOCALITY_REFERENCE_POINTS

EXCLUSION_LABELS = {
    'NO_CONSENT': 'No consent to receive emergency alerts',
    'UNAVAILABLE': 'Declared unavailable',
    'DECLINED_THIS_REQUEST': 'Declined this request',
    'ALREADY_CONTACTED': 'Already contacted for this request',
    'ALREADY_VOLUNTEERED': 'Already accepted as a volunteer',
    'INSUFFICIENT_INFO': 'Insufficient profile information for the matching rules',
    'OUTSIDE_SEARCH_AREA': 'Outside every configured search stage',
    'INACTIVE_ACCOUNT': 'Account inactive',
    'IS_REQUESTER': 'Is the requester',
    'NOT_WITHIN_ELIGIBLE_STAGE': 'Not yet inside the search area',
}


@dataclass
class Candidate:
    kind: str                      # 'real' | 'sim'
    pk: int
    display_name: str
    blood_group: str
    city: str
    locality: str
    lat: float | None
    lng: float | None
    is_available: bool | None
    has_consent: bool | None
    verified: bool
    profile_updated_at: datetime | None
    is_active: bool = True
    user_id: int | None = None

    @property
    def key(self):
        return (self.kind, self.pk)


@dataclass
class Assessment:
    candidate: Candidate
    eligible: bool = False
    exclusion: str | None = None
    first_stage: int | None = None
    distance_km: float | None = None
    score: float = 0.0
    breakdown: list = field(default_factory=list)
    explanation: str = ''
    unknown_fields: list = field(default_factory=list)
    attempt: object = None         # latest OutreachAttempt for this candidate, if any

    @property
    def exclusion_label(self):
        return EXCLUSION_LABELS.get(self.exclusion, '') if self.exclusion else ''


@dataclass
class RankResult:
    assessments: list              # every blood-group-matching candidate considered
    available_by_stage: list       # cumulative count of eligible, uncontacted candidates per stage
    origin_basis: str              # how the search origin was determined

    @property
    def eligible(self):
        rows = [a for a in self.assessments if a.eligible]
        rows.sort(key=lambda a: (-a.score, a.distance_km if a.distance_km is not None else 1e9, a.candidate.pk))
        return rows

    @property
    def excluded_counts(self):
        counts = {}
        for a in self.assessments:
            if not a.eligible and a.exclusion:
                counts[a.exclusion] = counts.get(a.exclusion, 0) + 1
        return counts


def compatible_groups(blood_group):
    return COMPATIBLE_DONORS_MAP.get(blood_group, [blood_group])


def _same(a, b):
    return bool(a) and bool(b) and a.strip().lower() == b.strip().lower()


def privacy_name(first_name, last_name, fallback):
    first = (first_name or '').strip()
    last = (last_name or '').strip()
    if first and last:
        return f'{first.split()[0]} {last[0]}.'
    return first.split()[0] if first else fallback


def case_origin(case):
    """Return (lat, lng, basis). Never invents coordinates: a locality reference point is
    used only when the request has none, and is labelled approximate."""
    if case.hospital_lat is not None and case.hospital_lng is not None:
        return case.hospital_lat, case.hospital_lng, 'hospital coordinates'
    point = LOCALITY_REFERENCE_POINTS.get(case.locality)
    if point:
        return point[0], point[1], 'approximate locality reference point (request has no coordinates)'
    return None, None, 'unknown (no coordinates and unrecognised locality)'


def load_pool(case):
    """All candidates whose declared blood group matches the request criteria."""
    groups = compatible_groups(case.blood_group)
    out = []
    if case.is_simulation:
        for d in case.simulation_run.donors.all():
            if d.blood_group not in groups:
                continue
            updated = case.started_at - timedelta(days=d.profile_age_days)
            out.append(Candidate(
                'sim', d.pk, d.code, d.blood_group, d.city, d.locality, d.latitude, d.longitude,
                d.is_available, d.notification_consent, d.medically_verified, updated,
            ))
        return out

    from donors.models import DonorProfile
    qs = DonorProfile.objects.filter(blood_group__in=groups).select_related('user')
    for d in qs:
        out.append(Candidate(
            'real', d.pk, privacy_name(d.user.first_name, d.user.last_name, f'Donor #{d.pk}'),
            d.blood_group, d.city, d.locality, d.approx_latitude, d.approx_longitude,
            d.is_available, d.notification_consent, d.is_medically_verified, d.last_profile_update,
            is_active=d.user.is_active, user_id=d.user_id,
        ))
    return out


def _distance(c, origin):
    if origin[0] is None or c.lat is None or c.lng is None:
        return None
    return calculate_haversine_distance(origin[0], origin[1], c.lat, c.lng)


def _first_stage(c, case, policy, dist):
    for st in policy.stages:
        if dist is not None:
            if st.radius_km is None or dist <= st.radius_km:
                return st.index
        elif st.fallback_scope == 'LOCALITY':
            if _same(c.locality, case.locality):
                return st.index
        elif _same(c.city, case.city):
            return st.index
    return None


def _score(c, case, policy, dist, now, group_exact):
    w = policy.weights
    parts, unknown = [], []

    # Proximity
    if dist is not None:
        frac = max(0.0, 1.0 - dist / policy.max_finite_radius)
        detail = f'about {dist} km from the request location'
    elif _same(c.locality, case.locality):
        frac, detail = 0.6, 'distance unknown; same locality as the request'
        unknown.append('distance')
    else:
        frac, detail = 0.0, 'distance unknown; no proximity points awarded'
        unknown.append('distance')
    parts.append(('proximity', 'Proximity', frac, detail))

    # Blood-group criteria
    parts.append((
        'group_match', 'Blood-group criteria',
        1.0 if group_exact else 0.6,
        'same declared group as the request' if group_exact
        else f'declared group {c.blood_group} is listed in the configured matching table for {case.blood_group}',
    ))

    # Profile verified by blood-bank staff (an existing platform flag, not our judgement)
    parts.append((
        'verified_profile', 'Profile verified by blood bank',
        1.0 if c.verified else 0.0,
        'profile marked verified by authorised staff' if c.verified else 'profile not marked verified (suitability unknown)',
    ))

    # Freshness of the declared availability
    if c.profile_updated_at is None:
        parts.append(('availability_freshness', 'Availability freshness', 0.0, 'last profile update unknown'))
        unknown.append('profile_updated')
    else:
        days = max(0, (now - c.profile_updated_at).days)
        frac = 1.0 if days <= 14 else 0.7 if days <= 45 else 0.4 if days <= 90 else 0.1
        parts.append(('availability_freshness', 'Availability freshness', frac,
                      f'availability declared/updated {days} day(s) ago'))

    breakdown, total = [], 0.0
    for key, label, frac, detail in parts:
        mx = float(w.get(key, 0))
        pts = round(mx * frac, 2)
        total += pts
        breakdown.append({'key': key, 'label': label, 'points': pts, 'max': mx, 'detail': detail})
    pct = round(100.0 * total / policy.weight_total, 1) if policy.weight_total else 0.0
    return pct, breakdown, unknown


def _explain(a, case, policy, contacted_note):
    c = a.candidate
    bits = []
    exact = c.blood_group == case.blood_group
    bits.append('the declared blood group matches the request criteria' + ('' if exact else ' (listed substitute group)'))
    bits.append('the donor has declared availability and consented to emergency alerts')
    if a.first_stage is not None:
        st = policy.stages[a.first_stage]
        if a.distance_km is not None:
            bits.append(f'the donor is about {a.distance_km} km away, inside {st.name}')
        else:
            bits.append(f'distance is Unknown, so the donor was placed in {st.name} by '
                        f'{"locality" if st.fallback_scope == "LOCALITY" else "city"} match')
    bits.append(contacted_note)
    top = sorted(a.breakdown, key=lambda b: b['points'], reverse=True)[:2]
    ranked = ' and '.join(f"{b['label'].lower()} ({b['points']:g}/{b['max']:g})" for b in top)
    text = 'Prioritised because ' + ', '.join(bits[:-1]) + f', and {bits[-1]}.'
    text += f' Score {a.score}% (largest contributions: {ranked}).'
    if a.unknown_fields:
        text += ' Unknown: ' + ', '.join(a.unknown_fields) + '.'
    return text


def rank_candidates(case, policy, now, attempts=None):
    """Assess every blood-group-matching candidate for `case` at time `now`."""
    attempts = list(case.attempts.all()) if attempts is None else attempts
    by_key = {}
    for at in attempts:
        key = ('sim', at.sim_donor_id) if at.sim_donor_id else ('real', at.donor_id)
        by_key.setdefault(key, []).append(at)

    origin = case_origin(case)
    pool = load_pool(case)
    requester_id = case.blood_request.requester_id if case.blood_request_id else None
    assessments = []

    for c in pool:
        a = Assessment(candidate=c)
        prior = by_key.get(c.key, [])
        a.attempt = max(prior, key=lambda x: (x.batch.sequence, x.id)) if prior else None
        a.distance_km = _distance(c, origin)

        # Hard exclusion rules, in the order they are explained to administrators.
        if requester_id and c.user_id == requester_id:
            a.exclusion = 'IS_REQUESTER'
        elif not c.is_active:
            a.exclusion = 'INACTIVE_ACCOUNT'
        elif not c.blood_group or (c.lat is None and not c.locality and not c.city):
            a.exclusion = 'INSUFFICIENT_INFO'
        elif not c.has_consent:
            a.exclusion = 'NO_CONSENT'
        elif not c.is_available:
            a.exclusion = 'UNAVAILABLE'
        elif any(p.status == AttemptStatus.DECLINED for p in prior):
            a.exclusion = 'DECLINED_THIS_REQUEST'
        elif any(p.status == AttemptStatus.ACCEPTED for p in prior):
            a.exclusion = 'ALREADY_VOLUNTEERED'
        elif prior:
            reminder_ok = (
                policy.allow_reminders
                and all(p.status in (AttemptStatus.NO_RESPONSE, AttemptStatus.WITHDRAWN) for p in prior)
                and all(case.current_stage_index > p.stage_index for p in prior)
            )
            if not reminder_ok:
                a.exclusion = 'ALREADY_CONTACTED'

        # Shown for every candidate (including already-contacted ones); only decides eligibility if nothing else did.
        a.first_stage = _first_stage(c, case, policy, a.distance_km)
        if a.exclusion is None and a.first_stage is None:
            a.exclusion = 'OUTSIDE_SEARCH_AREA'

        a.score, a.breakdown, a.unknown_fields = _score(
            c, case, policy, a.distance_km, now, c.blood_group == case.blood_group
        )
        if a.exclusion is None:
            a.eligible = True
            note = ('has not been contacted for this request' if not prior
                    else 'may receive one reminder because the search has since expanded')
            a.explanation = _explain(a, case, policy, note)
        assessments.append(a)

    stage_count = len(policy.stages)
    available = [0] * stage_count
    for a in assessments:
        if a.eligible:
            for i in range(a.first_stage, stage_count):
                available[i] += 1
    return RankResult(assessments, available, origin[2])


def approximate_point(c):
    """Privacy-protected map position: rounded to 2 decimals (~1 km). None when unknown."""
    if c.lat is None or c.lng is None:
        return None
    return round(c.lat, 2), round(c.lng, 2)
