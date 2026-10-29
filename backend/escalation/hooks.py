"""
Thin, failure-tolerant bridges used by the pre-existing request/matching views.
A problem inside the escalation engine must never break donor responses or request
cancellation, so every hook logs and swallows its own errors.
"""
import logging

from .constants import AttemptStatus
from .models import EmergencyCase, OutreachAttempt
from .service import service

logger = logging.getLogger(__name__)


def _attempt_for_match(match):
    return (OutreachAttempt.objects.filter(donor_match=match, case__is_simulation=False)
            .order_by('-batch__sequence', '-id').first())


def on_donor_viewed(match):
    try:
        attempt = _attempt_for_match(match)
        if attempt:
            service.mark_viewed(attempt.pk)
    except Exception:
        logger.exception('escalation hook failed: viewed')


def on_donor_response(match, response, message=''):
    """`response` is ACCEPTED or DECLINED as sent by the donor app."""
    try:
        attempt = _attempt_for_match(match)
        if attempt:
            service.record_response(attempt.pk, AttemptStatus(response), 'donor_app', message)
    except Exception:
        logger.exception('escalation hook failed: response')


def on_request_cancelled(blood_request, actor=None):
    try:
        case = EmergencyCase.objects.filter(blood_request=blood_request).first()
        if case:
            service.cancel(case.pk, actor, 'The blood request was cancelled.', sync_request=False)
    except Exception:
        logger.exception('escalation hook failed: cancel')


def on_request_changed(blood_request):
    """Let the engine re-read the request (for example, when it is marked fulfilled)."""
    try:
        case = EmergencyCase.objects.filter(blood_request=blood_request).first()
        if case:
            service.evaluate(case.pk)
    except Exception:
        logger.exception('escalation hook failed: request changed')
