"""
Persistence layer for camp applications. Every mutation runs in a transaction under a row lock, writes a timeline
event, and notifies the people affected. Business rules live in `workflow.py`.
"""
from django.db import IntegrityError, transaction
from django.utils import timezone

from accounts.models import User, UserRole
from audit.models import AuditLog
from bloodbank.models import BloodBank
from notifications.models import Notification, NotificationType
from . import workflow
from .constants import CampStatus, EventKind, PartnerStatus, SUPPORT_LABELS
from .models import CampApplication, CampEvent, CampInterest


class CampError(Exception):
    def __init__(self, message, code='invalid'):
        super().__init__(message)
        self.message = message
        self.code = code


def camp_url_for(user, camp):
    if user.role == UserRole.DONOR:
        return f'/donor/camps/{camp.pk}'
    if user.role == UserRole.REQUESTER:
        return f'/requester/camps/{camp.pk}'
    return f'/camps/{camp.pk}'


def _notify(recipient, title, message, url):
    Notification.objects.create(
        recipient=recipient, title=title, message=message, notification_type=NotificationType.STATUS_UPDATE,
        urgency='STANDARD', action_url=url,
    )


def _event(app, kind, actor, message='', from_status='', to_status='', internal=False):
    return CampEvent.objects.create(
        application=app, kind=kind, actor=actor, message=message[:600], from_status=from_status,
        to_status=to_status, internal=internal,
    )


def _audit(actor, action, app, details, request=None):
    AuditLog.record(actor=actor, action=action, target_model='CampApplication', target_id=app.pk,
                    details=details, request=request)


def _locked(pk):
    try:
        return CampApplication.objects.select_for_update().select_related('partner', 'organiser').get(pk=pk)
    except CampApplication.DoesNotExist:
        raise CampError('Camp application not found.', 'not_found')


# ----------------------------------------------------------------------------------------------- organiser
@transaction.atomic
def submit(organiser, data, request=None):
    app = CampApplication.objects.create(organiser=organiser, **data)
    _event(app, EventKind.SUBMITTED, organiser, 'Application submitted by the organiser.', to_status=app.status)
    _audit(organiser, 'CAMP_SUBMITTED', app, f'{app.organisation_name}: {app.title} on {app.camp_date}', request)
    for admin in User.objects.filter(role=UserRole.ADMIN, is_active=True):
        _notify(admin, 'New blood donation camp application',
                f'{app.organisation_name} applied to hold "{app.title}" in {app.locality} on {app.camp_date}.',
                f'/admin-portal/camps/{app.pk}')
    return app


@transaction.atomic
def edit(pk, organiser, data, request=None):
    app = _locked(pk)
    if app.organiser_id != organiser.pk:
        raise CampError('Camp application not found.', 'not_found')
    if app.status != CampStatus.SUBMITTED:
        raise CampError('An application can only be edited before the review has started.', 'locked')
    changed = [k for k, v in data.items() if getattr(app, k) != v]
    for key, value in data.items():
        setattr(app, key, value)
    app.save()
    if changed:
        _event(app, EventKind.EDITED, organiser, 'Organiser updated: ' + ', '.join(sorted(changed)) + '.')
        _audit(organiser, 'CAMP_EDITED', app, 'Fields changed: ' + ', '.join(sorted(changed)), request)
    return app


@transaction.atomic
def cancel(pk, actor, reason, request=None):
    """Cancelled by the organiser, or by an administrator (`actor` decides the wording)."""
    app = _locked(pk)
    is_admin = actor.role == UserRole.ADMIN or actor.is_superuser
    if not is_admin and app.organiser_id != actor.pk:
        raise CampError('Camp application not found.', 'not_found')
    if not workflow.can_transition(app.status, CampStatus.CANCELLED):
        raise CampError('This application can no longer be cancelled.', 'invalid_transition')
    reason = (reason or '').strip()
    if is_admin and not reason:
        raise CampError('Give a reason so the organiser knows why the camp was cancelled.', 'reason_required')
    was_public = app.status == CampStatus.APPROVED
    previous = app.status
    app.status = CampStatus.CANCELLED
    app.cancellation_reason = reason[:500]
    app.save()
    who = 'an administrator' if is_admin else 'the organiser'
    _event(app, EventKind.STATUS, actor, f'Cancelled by {who}.' + (f' Reason: {reason}' if reason else ''),
           previous, app.status)
    _audit(actor, 'CAMP_CANCELLED', app, reason or 'No reason given', request)
    if is_admin:
        _notify(app.organiser, 'Your camp application was cancelled',
                f'"{app.title}" was cancelled by an administrator. Reason: {reason}',
                f'/organiser/applications/{app.pk}')
    if was_public:
        for interest in app.interests.select_related('user'):
            _notify(interest.user, 'A blood donation camp you were interested in was cancelled',
                    f'"{app.title}" on {app.camp_date} in {app.locality} will no longer take place.',
                    camp_url_for(interest.user, app))
    return app


# ----------------------------------------------------------------------------------------------- administrator
@transaction.atomic
def start_review(pk, admin, request=None):
    app = _locked(pk)
    if not workflow.can_transition(app.status, CampStatus.UNDER_REVIEW):
        raise CampError('Only a newly submitted application can move into review.', 'invalid_transition')
    previous = app.status
    app.status = CampStatus.UNDER_REVIEW
    app.reviewed_by, app.reviewed_at = admin, timezone.now()
    app.save()
    _event(app, EventKind.STATUS, admin, 'BloodConnect started reviewing the application.', previous, app.status)
    _audit(admin, 'CAMP_REVIEW_STARTED', app, app.title, request)
    _notify(app.organiser, 'Your camp application is under review',
            f'BloodConnect has started reviewing "{app.title}".', f'/organiser/applications/{app.pk}')
    return app


@transaction.atomic
def update_partner(pk, admin, data, request=None):
    app = _locked(pk)
    blockers = workflow.partner_update_blockers(app.status)
    if blockers:
        raise CampError(blockers[0], 'invalid_transition')

    status = data['partner_status']
    partner = None
    if data.get('partner_id'):
        try:
            partner = BloodBank.objects.get(pk=data['partner_id'], is_active=True)
        except BloodBank.DoesNotExist:
            raise CampError('That blood bank was not found.', 'invalid_partner')
    name = (data.get('partner_name') or '').strip()
    if partner is None and not name:
        # keep any previously chosen partner when only the status is being updated
        partner = app.partner
        name = app.partner_name
    support = data.get('partner_support', app.partner_support)
    if status == PartnerStatus.CONFIRMED:
        if partner is None and not name:
            raise CampError('Name the blood bank or medical team that confirmed.', 'partner_required')
        if not support:
            raise CampError('Record which kinds of support the partner has confirmed.', 'support_required')

    previous = app.status
    app.partner, app.partner_name = partner, name
    app.partner_status = status
    app.partner_support = support if status != PartnerStatus.DECLINED else []
    if 'partner_notes' in data:
        app.partner_notes = data['partner_notes']
    if status != PartnerStatus.NOT_CONTACTED and app.status == CampStatus.UNDER_REVIEW:
        app.status = CampStatus.PARTNER_COORDINATION
    app.save()

    label = PartnerStatus(status).label
    who = app.partner_display_name or 'no partner named yet'
    _event(app, EventKind.PARTNER, admin, f'{label} ({who}).' + (f' {data["note"]}' if data.get('note') else ''),
           previous, app.status, internal=True)
    if app.status != previous:
        _event(app, EventKind.STATUS, admin, 'Coordination with a medical partner has started.', previous, app.status)
        _notify(app.organiser, 'Medical partner coordination started',
                f'BloodConnect is now coordinating a medical partner for "{app.title}". '
                'No medical support is confirmed yet.', f'/organiser/applications/{app.pk}')
    _audit(admin, 'CAMP_PARTNER_UPDATED', app, f'{label}; partner={who}; support={app.partner_support}', request)
    return app


@transaction.atomic
def approve(pk, admin, note='', request=None):
    app = _locked(pk)
    if not workflow.can_transition(app.status, CampStatus.APPROVED):
        raise CampError('Approval comes after medical partner coordination.', 'invalid_transition')
    blockers = workflow.approval_blockers(
        app.partner_status, bool(app.partner_id or app.partner_name), app.partner_support,
        app.camp_date, timezone.localdate(),
    )
    if blockers:
        raise CampError(' '.join(blockers), 'approval_blocked')
    previous = app.status
    app.status = CampStatus.APPROVED
    app.approved_at = timezone.now()
    try:
        app.save()
    except IntegrityError:  # the DB constraint is the last line of defence
        raise CampError('A confirmed medical partner is required for approval.', 'approval_blocked')
    support = ', '.join(SUPPORT_LABELS[s] for s in app.partner_support if s in SUPPORT_LABELS)
    _event(app, EventKind.STATUS, admin,
           f'Approved. {app.partner_display_name} confirmed: {support}.' + (f' {note}' if note else ''),
           previous, app.status)
    _audit(admin, 'CAMP_APPROVED', app, f'Partner {app.partner_display_name}', request)
    _notify(app.organiser, 'Your blood donation camp is approved',
            f'"{app.title}" on {app.camp_date} is approved and now listed publicly. '
            f'{app.partner_display_name} has confirmed support.', f'/organiser/applications/{app.pk}')
    return app


@transaction.atomic
def reject(pk, admin, reason, request=None):
    app = _locked(pk)
    reason = (reason or '').strip()
    if not reason:
        raise CampError('Give the organiser a reason.', 'reason_required')
    if not workflow.can_transition(app.status, CampStatus.REJECTED):
        raise CampError('Only an application that is still in progress can be declined.', 'invalid_transition')
    previous = app.status
    app.status = CampStatus.REJECTED
    app.rejection_reason = reason[:500]
    app.reviewed_by, app.reviewed_at = admin, timezone.now()
    app.save()
    _event(app, EventKind.STATUS, admin, f'Not approved. Reason: {reason}', previous, app.status)
    _audit(admin, 'CAMP_REJECTED', app, reason, request)
    _notify(app.organiser, 'Your camp application was not approved',
            f'"{app.title}" could not be approved. Reason: {reason}', f'/organiser/applications/{app.pk}')
    return app


@transaction.atomic
def complete(pk, admin, actual_donors=None, notes='', request=None):
    app = _locked(pk)
    if not workflow.can_transition(app.status, CampStatus.COMPLETED):
        raise CampError('Only an approved camp can be marked completed.', 'invalid_transition')
    blockers = workflow.completion_blockers(app.camp_date, timezone.localdate())
    if blockers:
        raise CampError(blockers[0], 'completion_blocked')
    previous = app.status
    app.status = CampStatus.COMPLETED
    app.completed_at = timezone.now()
    app.actual_donors = actual_donors
    app.completion_notes = (notes or '')[:1000]
    app.save()
    detail = f'{actual_donors} donors recorded.' if actual_donors is not None else 'Donor count not recorded.'
    _event(app, EventKind.STATUS, admin, f'Camp completed. {detail}', previous, app.status)
    _audit(admin, 'CAMP_COMPLETED', app, detail, request)
    _notify(app.organiser, 'Your blood donation camp is marked completed',
            f'Thank you for organising "{app.title}".', f'/organiser/applications/{app.pk}')
    return app


@transaction.atomic
def add_note(pk, admin, message, visible_to_organiser=False, request=None):
    app = _locked(pk)
    message = (message or '').strip()
    if not message:
        raise CampError('Write a note first.', 'note_required')
    _event(app, EventKind.NOTE, admin, message, internal=not visible_to_organiser)
    if visible_to_organiser:
        _notify(app.organiser, 'Update on your camp application', message[:200],
                f'/organiser/applications/{app.pk}')
    else:
        app.admin_notes = (app.admin_notes + '\n' + message).strip()[-4000:]
        app.save(update_fields=['admin_notes', 'updated_at'])
    _audit(admin, 'CAMP_NOTE_ADDED', app, 'Visible to organiser' if visible_to_organiser else 'Internal', request)
    return app


# ----------------------------------------------------------------------------------------------- participants
@transaction.atomic
def set_interest(pk, user, interested):
    """Idempotent. Only approved, upcoming camps accept interest."""
    app = _locked(pk)
    if not app.is_public:
        raise CampError('This camp is not open for registration of interest.', 'not_open')
    if interested:
        CampInterest.objects.get_or_create(application=app, user=user)
    else:
        CampInterest.objects.filter(application=app, user=user).delete()
    return app
