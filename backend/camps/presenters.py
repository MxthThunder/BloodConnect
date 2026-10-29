"""
API payloads. Three audiences, three shapes:
  public      - approved, upcoming camps; no contact details, no internal notes
  organiser   - their own application; no internal notes and no partner name until the partner has confirmed
  admin       - everything
"""
from django.utils import timezone

from accounts.constants import CHENNAI_LOCALITIES
from escalation.constants import LOCALITY_REFERENCE_POINTS
from . import workflow
from .constants import (
    COORDINATION_NOTICE, FACILITIES, FACILITY_LABELS, OrganisationType, PartnerStatus, STAGES, CampStatus,
    SUPPORT_LABELS, SUPPORT_TYPES,
)


def _coords(app):
    """Organiser-supplied coordinates, else the approximate point of the locality (flagged as approximate)."""
    if app.latitude is not None and app.longitude is not None:
        return app.latitude, app.longitude, False
    point = LOCALITY_REFERENCE_POINTS.get(app.locality)
    if point:
        return point[0], point[1], True
    return None, None, True


def _labelled(codes, labels):
    return [{'code': c, 'label': labels.get(c, c)} for c in (codes or [])]


def _base(app):
    lat, lng, approx = _coords(app)
    return {
        'id': app.pk,
        'reference_number': app.reference_number,
        'title': app.title,
        'organisation_name': app.organisation_name,
        'organisation_type': app.organisation_type,
        'organisation_type_label': OrganisationType(app.organisation_type).label,
        'description': app.description,
        'venue_name': app.venue_name,
        'address': app.address,
        'city': app.city,
        'locality': app.locality,
        'latitude': lat,
        'longitude': lng,
        'location_approximate': approx,
        'camp_date': app.camp_date.isoformat(),
        'start_time': app.start_time.strftime('%H:%M'),
        'end_time': app.end_time.strftime('%H:%M'),
        'facilities': _labelled(app.facilities, FACILITY_LABELS),
        'facilities_notes': app.facilities_notes,
        'registration_info': app.registration_info,
        'status': app.status,
        'status_label': CampStatus(app.status).label,
    }


def public_camp(app, interest_count, is_interested=False):
    data = _base(app)
    data.update({
        'interest_count': interest_count,
        'is_interested': is_interested,
        # An approved camp always has a confirmed partner (database constraint), so this is safe to state.
        'medical_support': {
            'confirmed': app.partner_status == PartnerStatus.CONFIRMED,
            'partner': app.partner_display_name if app.partner_status == PartnerStatus.CONFIRMED else '',
            'support': _labelled(app.partner_support, SUPPORT_LABELS) if app.partner_status == PartnerStatus.CONFIRMED else [],
        },
        'notice': COORDINATION_NOTICE,
    })
    return data


def _event(e, admin_view=False):
    if e.actor_id is None:
        actor = 'System'
    elif e.actor.role == 'admin':
        actor = (e.actor.get_full_name() or e.actor.email) if admin_view else 'BloodConnect team'
    else:
        actor = 'Organiser'
    return {
        'id': e.pk, 'kind': e.kind, 'from_status': e.from_status, 'to_status': e.to_status, 'message': e.message,
        'internal': e.internal, 'created_at': e.created_at.isoformat(), 'actor': actor,
    }


def _progress(app):
    """Progress tracker rows. Rejected / cancelled applications show where they stopped."""
    stopped = app.status in (CampStatus.REJECTED, CampStatus.CANCELLED)
    if stopped:
        seen = [workflow.stage_index(e.to_status) for e in app.events.all()]
        reached = max([i for i in seen if i is not None] or [0])
    else:
        reached = workflow.stage_index(app.status)
    rows = []
    for i, status in enumerate(STAGES):
        if app.status == CampStatus.COMPLETED or i < reached:
            state = 'done'
        elif i == reached:
            state = 'stopped' if stopped else 'current'
        else:
            state = 'todo'
        rows.append({'status': status, 'label': CampStatus(status).label, 'state': state})
    return rows


def organiser_application(app, with_events=True):
    data = _base(app)
    confirmed = app.partner_status == PartnerStatus.CONFIRMED
    data.update({
        'contact_name': app.contact_name,
        'contact_phone': app.contact_phone,
        'contact_email': app.contact_email,
        'expected_donors': app.expected_donors,
        'rejection_reason': app.rejection_reason,
        'cancellation_reason': app.cancellation_reason,
        'actual_donors': app.actual_donors,
        'interest_count': app.interests.count(),
        'is_public': app.is_public,
        'can_edit': app.status == CampStatus.SUBMITTED,
        'can_cancel': workflow.can_transition(app.status, CampStatus.CANCELLED),
        'progress': _progress(app),
        'medical_support': {
            'confirmed': confirmed,
            'partner': app.partner_display_name if confirmed else '',
            'support': _labelled(app.partner_support, SUPPORT_LABELS) if confirmed else [],
            'message': (f'{app.partner_display_name} has confirmed support.' if confirmed else
                        'No medical support is confirmed yet. BloodConnect will not promise any until a '
                        'qualified partner confirms availability.'),
        },
        'notice': COORDINATION_NOTICE,
        'created_at': app.created_at.isoformat(),
        'updated_at': app.updated_at.isoformat(),
    })
    if with_events:
        data['events'] = [_event(e) for e in app.events.select_related('actor') if not e.internal]
    return data


def admin_application(app, with_events=True):
    data = organiser_application(app, with_events=False)
    data.update({
        'organiser': {
            'id': app.organiser_id, 'name': app.organiser.get_full_name() or app.organiser.email,
            'email': app.organiser.email,
        },
        'partner_status': app.partner_status,
        'partner_status_label': PartnerStatus(app.partner_status).label,
        'partner_id': app.partner_id,
        'partner_name': app.partner_display_name,
        'partner_support': app.partner_support,
        'partner_notes': app.partner_notes,
        'admin_notes': app.admin_notes,
        'completion_notes': app.completion_notes,
        'reviewed_at': app.reviewed_at.isoformat() if app.reviewed_at else None,
        'approved_at': app.approved_at.isoformat() if app.approved_at else None,
        'medical_support': {  # administrators see the true coordination state
            'confirmed': app.partner_status == PartnerStatus.CONFIRMED,
            'partner': app.partner_display_name, 'support': _labelled(app.partner_support, SUPPORT_LABELS),
            'message': PartnerStatus(app.partner_status).label,
        },
        'approval_blockers': workflow.approval_blockers(
            app.partner_status, bool(app.partner_id or app.partner_name), app.partner_support,
            app.camp_date, timezone.localdate(),
        ) if app.status == CampStatus.PARTNER_COORDINATION else [],
    })
    if with_events:
        data['events'] = [_event(e, admin_view=True) for e in app.events.select_related('actor')]
    return data


def options_payload(is_admin=False):
    data = {
        'organisation_types': [{'value': v, 'label': l} for v, l in OrganisationType.choices],
        'facilities': [{'value': v, 'label': l} for v, l in FACILITIES],
        'support_types': [{'value': v, 'label': l} for v, l in SUPPORT_TYPES],
        'localities': CHENNAI_LOCALITIES,
        'partner_statuses': [{'value': v, 'label': l} for v, l in PartnerStatus.choices],
        'notice': COORDINATION_NOTICE,
    }
    if is_admin:
        from bloodbank.models import BloodBank
        data['blood_banks'] = [
            {'id': b.pk, 'name': b.name, 'locality': b.locality}
            for b in BloodBank.objects.filter(is_active=True).order_by('name')
        ]
    return data
