from django.db import models


class CaseStatus(models.TextChoices):
    OPEN = 'OPEN', 'Open - no outreach yet'
    COLLECTING_RESPONSES = 'COLLECTING_RESPONSES', 'Collecting responses'
    AWAITING_ESCALATION = 'AWAITING_ESCALATION', 'Awaiting escalation approval'
    VOLUNTEERS_SECURED = 'VOLUNTEERS_SECURED', 'Volunteer target reached'
    NEEDS_ADMIN_INTERVENTION = 'NEEDS_ADMIN_INTERVENTION', 'Administrator intervention required'
    RESOLVED = 'RESOLVED', 'Resolved'
    CANCELLED = 'CANCELLED', 'Cancelled'
    EXPIRED = 'EXPIRED', 'Expired'


TERMINAL_CASE_STATUSES = (CaseStatus.RESOLVED, CaseStatus.CANCELLED, CaseStatus.EXPIRED)


class AttemptStatus(models.TextChoices):
    ALERTED = 'ALERTED', 'Alert sent (no response yet)'
    VIEWED = 'VIEWED', 'Alert viewed (no response yet)'
    ACCEPTED = 'ACCEPTED', 'Accepted (volunteer)'
    DECLINED = 'DECLINED', 'Declined'
    NO_RESPONSE = 'NO_RESPONSE', 'No response within window (status unknown)'
    WITHDRAWN = 'WITHDRAWN', 'Alert withdrawn (request ended)'


PENDING_ATTEMPT_STATUSES = (AttemptStatus.ALERTED, AttemptStatus.VIEWED)
RESPONDABLE_ATTEMPT_STATUSES = (
    AttemptStatus.ALERTED, AttemptStatus.VIEWED, AttemptStatus.NO_RESPONSE,
    AttemptStatus.ACCEPTED, AttemptStatus.DECLINED,
)


class Fulfilment(models.TextChoices):
    NONE = 'NONE', 'Not started'
    VERIFICATION_PENDING = 'VERIFICATION_PENDING', 'Hospital verification pending'
    DONATION_CONFIRMED = 'DONATION_CONFIRMED', 'Donation outcome confirmed by hospital'
    NOT_DONATED = 'NOT_DONATED', 'Did not donate / deferred by hospital'


class Strategy(models.TextChoices):
    ADAPTIVE = 'ADAPTIVE', 'Adaptive escalation'
    FIXED = 'FIXED', 'Fixed escalation'
    BROADCAST = 'BROADCAST', 'Basic broadcast'


class BatchTrigger(models.TextChoices):
    INITIAL = 'INITIAL', 'Initial search'
    TOP_UP = 'TOP_UP', 'Top-up in current area'
    EXPANSION = 'EXPANSION', 'Expanded search area'
    MANUAL = 'MANUAL', 'Administrator-approved'
    BROADCAST = 'BROADCAST', 'Broadcast to whole pool'
    FIXED_INTERVAL = 'FIXED_INTERVAL', 'Fixed-interval stage'
    LEGACY_IMPORT = 'LEGACY_IMPORT', 'Imported pre-existing alerts'


class EventType(models.TextChoices):
    REQUEST_CREATED = 'REQUEST_CREATED', 'Request created'
    REQUEST_VALIDATED = 'REQUEST_VALIDATED', 'Request validated'
    CASE_STARTED = 'CASE_STARTED', 'Coordination started'
    CANDIDATES_RANKED = 'CANDIDATES_RANKED', 'Candidates ranked'
    BATCH_CREATED = 'BATCH_CREATED', 'Candidate batch generated'
    OUTREACH_INITIATED = 'OUTREACH_INITIATED', 'Outreach initiated'
    ALERT_VIEWED = 'ALERT_VIEWED', 'Alert viewed'
    CANDIDATE_ACCEPTED = 'CANDIDATE_ACCEPTED', 'Candidate accepted'
    CANDIDATE_DECLINED = 'CANDIDATE_DECLINED', 'Candidate declined'
    RESPONSE_WINDOW_ELAPSED = 'RESPONSE_WINDOW_ELAPSED', 'Response window elapsed'
    ESCALATION_TRIGGERED = 'ESCALATION_TRIGGERED', 'Escalation triggered'
    SEARCH_EXPANDED = 'SEARCH_EXPANDED', 'Search expanded'
    ENGINE_HOLD = 'ENGINE_HOLD', 'Engine holding'
    AWAITING_ESCALATION = 'AWAITING_ESCALATION', 'Awaiting escalation approval'
    VOLUNTEERS_SECURED = 'VOLUNTEERS_SECURED', 'Volunteer target reached'
    NEED_REOPENED = 'NEED_REOPENED', 'Coordination need reopened'
    ADMIN_INTERVENTION_REQUIRED = 'ADMIN_INTERVENTION_REQUIRED', 'Administrator intervention required'
    ADMIN_REVIEWED = 'ADMIN_REVIEWED', 'Administrator reviewed the request'
    FULFILMENT_UPDATED = 'FULFILMENT_UPDATED', 'Hospital verification / outcome updated'
    LATE_RESPONSE = 'LATE_RESPONSE', 'Response after request closed'
    REQUEST_RESOLVED = 'REQUEST_RESOLVED', 'Request resolved'
    REQUEST_CANCELLED = 'REQUEST_CANCELLED', 'Request cancelled'
    REQUEST_EXPIRED = 'REQUEST_EXPIRED', 'Request expired'
    POLICY_CHANGED = 'POLICY_CHANGED', 'Policy changed'
    SIMULATION = 'SIMULATION', 'Simulation control'


class Scenario(models.TextChoices):
    HIGH_RESPONSE = 'HIGH_RESPONSE', 'High response'
    LOW_RESPONSE = 'LOW_RESPONSE', 'Low response'
    NO_RESPONSE_INITIAL_AREA = 'NO_RESPONSE_INITIAL_AREA', 'No response in the initial area'
    PARTIAL_RESPONSE = 'PARTIAL_RESPONSE', 'Partial response'
    CANCELLED = 'CANCELLED', 'Request cancelled'


class RunStatus(models.TextChoices):
    READY = 'READY', 'Ready'
    RUNNING = 'RUNNING', 'Running'
    PAUSED = 'PAUSED', 'Paused'
    COMPLETED = 'COMPLETED', 'Completed'


# Approximate reference points for the 15 supported Chennai localities (same values the
# demo seed uses for donors). They are used ONLY to place a request on the map / measure
# distance when the request has no coordinates, and are always labelled "approximate".
LOCALITY_REFERENCE_POINTS = {
    'Adyar': (13.0012, 80.2565),
    'Anna Nagar': (13.0850, 80.2101),
    'T. Nagar': (13.0418, 80.2341),
    'Velachery': (12.9815, 80.2180),
    'Tambaram': (12.9249, 80.1000),
    'Guindy': (13.0067, 80.2030),
    'Mylapore': (13.0368, 80.2676),
    'Porur': (13.0382, 80.1565),
    'Perambur': (13.1075, 80.2435),
    'Royapettah': (13.0524, 80.2606),
    'Vadapalani': (13.0500, 80.2121),
    'Sholinganallur': (12.9010, 80.2279),
    'Thoraipakkam': (12.9432, 80.2366),
    'Nungambakkam': (13.0595, 80.2425),
    'Ambattur': (13.1143, 80.1548),
}
