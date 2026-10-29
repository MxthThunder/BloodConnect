"""
Pure rules for the camp application workflow (no database, no clock, no HTTP), so they can be unit-tested directly.
"""
from .constants import CampStatus, PartnerStatus, STAGES, TERMINAL_STATUSES

ALLOWED_TRANSITIONS = {
    CampStatus.SUBMITTED: {CampStatus.UNDER_REVIEW, CampStatus.REJECTED, CampStatus.CANCELLED},
    CampStatus.UNDER_REVIEW: {CampStatus.PARTNER_COORDINATION, CampStatus.REJECTED, CampStatus.CANCELLED},
    CampStatus.PARTNER_COORDINATION: {CampStatus.APPROVED, CampStatus.REJECTED, CampStatus.CANCELLED},
    CampStatus.APPROVED: {CampStatus.COMPLETED, CampStatus.CANCELLED},
    CampStatus.COMPLETED: set(),
    CampStatus.REJECTED: set(),
    CampStatus.CANCELLED: set(),
}


def can_transition(current, target):
    return target in ALLOWED_TRANSITIONS.get(current, set())


def is_terminal(status):
    return status in TERMINAL_STATUSES


def stage_index(status):
    """Position on the progress tracker; None for statuses off the happy path."""
    try:
        return STAGES.index(status)
    except ValueError:
        return None


def approval_blockers(partner_status, has_partner, support_types, camp_date, today):
    """Reasons an application cannot be approved yet. An empty list means it may be approved."""
    blockers = []
    if partner_status != PartnerStatus.CONFIRMED:
        blockers.append('A medical partner must confirm availability before the camp can be approved.')
    elif not has_partner:
        blockers.append('Name the confirmed blood bank or medical team.')
    if partner_status == PartnerStatus.CONFIRMED and not support_types:
        blockers.append('Record which kinds of support the partner has confirmed.')
    if camp_date < today:
        blockers.append('The proposed date has already passed.')
    return blockers


def completion_blockers(camp_date, today):
    if camp_date > today:
        return ['A camp can only be marked completed on or after its date.']
    return []


def partner_update_blockers(status):
    if status not in (CampStatus.UNDER_REVIEW, CampStatus.PARTNER_COORDINATION):
        return ['Partner details can only be changed while the application is under review or in partner coordination.']
    return []
