from django.core.management.base import BaseCommand

from blood_requests.models import RequestStatus, VerificationStatus, BloodRequest
from escalation.models import EscalationPolicy
from escalation.service import EscalationError, service


class Command(BaseCommand):
    help = ('Ensures the escalation policy exists and brings already-approved, still-open requests under the '
            'adaptive escalation engine (their existing alerts are imported, never repeated). Idempotent.')

    def handle(self, *args, **options):
        policy = EscalationPolicy.active()
        self.stdout.write(f'Escalation policy "{policy.name}" ready.')
        open_requests = BloodRequest.objects.filter(
            verification_status=VerificationStatus.APPROVED,
            request_status__in=[RequestStatus.ACTIVE_ALERTS_SENT, RequestStatus.DONOR_RESPONDED, RequestStatus.MATCHING],
            emergency_case__isnull=True,
        )
        started = skipped = 0
        for req in open_requests:
            try:
                service.start_case_for_request(req)
                started += 1
            except EscalationError as exc:
                skipped += 1
                self.stdout.write(f'  skipped {req.reference_number}: {exc.message}')
        self.stdout.write(self.style.SUCCESS(f'Escalation engine active for {started} request(s); {skipped} skipped.'))
