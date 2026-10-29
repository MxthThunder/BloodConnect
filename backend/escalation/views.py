from datetime import timedelta

from django.db import transaction
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import status as http
from rest_framework.response import Response
from rest_framework.views import APIView

from accounts.permissions import IsAdminUserRole
from audit.models import AuditLog
from blood_requests.models import BloodRequest, RequestStatus, VerificationStatus
from blood_requests.serializers import BloodRequestCreateSerializer, BloodRequestDetailSerializer
from . import assistant, experiments, simulation
from .constants import AttemptStatus, CaseStatus, Fulfilment, TERMINAL_CASE_STATUSES
from .models import EmergencyCase, EscalationEvent, EscalationPolicy, Experiment, OutreachAttempt, SimulationRun
from .policy import DEFAULT_POLICY, PolicyError, normalize_policy
from .presenters import (
    candidate_rows, counts_for, map_payload, serialize_batch, serialize_case, serialize_event, serialize_simulation,
)
from .service import EscalationError, service

MAX_PAGE_SIZE = 100


def paginate(request, rows, default_size=20):
    try:
        page = max(1, int(request.query_params.get('page', 1)))
        size = min(MAX_PAGE_SIZE, max(1, int(request.query_params.get('page_size', default_size))))
    except ValueError:
        page, size = 1, default_size
    start = (page - 1) * size
    return {'count': len(rows), 'page': page, 'page_size': size,
            'num_pages': max(1, -(-len(rows) // size)), 'results': rows[start:start + size]}


def error(message, code='invalid', status=http.HTTP_400_BAD_REQUEST):
    return Response({'error': message, 'code': code}, status=status)


def audit(request, action, case_or_label, details, target_model='EmergencyCase', target_id=''):
    AuditLog.record(
        actor=request.user, action=action, target_model=target_model,
        target_id=getattr(case_or_label, 'pk', target_id), details=details, request=request,
    )


class AdminView(APIView):
    """All escalation endpoints are administrator-only."""
    permission_classes = [IsAdminUserRole]

    def handle_exception(self, exc):
        if isinstance(exc, EscalationError):
            code = http.HTTP_409_CONFLICT if exc.code in ('paused', 'already_closed') else http.HTTP_400_BAD_REQUEST
            return error(exc.message, exc.code, code)
        return super().handle_exception(exc)


# --------------------------------------------------------------------------- overview & cases
class OverviewView(AdminView):
    """Command Center: active real emergencies and headline numbers."""

    def get(self, request):
        include_sim = request.query_params.get('include_simulations') == 'true'
        qs = EmergencyCase.objects.select_related('blood_request', 'simulation_run')
        if not include_sim:
            qs = qs.filter(is_simulation=False)
        active = [c for c in qs.exclude(status__in=TERMINAL_CASE_STATUSES)]
        rank = {'CRITICAL': 0, 'URGENT': 1, 'STANDARD': 2}
        active.sort(key=lambda c: (rank.get(c.urgency, 3), c.required_by))
        cases = [serialize_case(c) for c in active[:50]]
        recent = [serialize_case(c) for c in qs.filter(status__in=TERMINAL_CASE_STATUSES).order_by('-closed_at')[:5]]
        pending_adopt = BloodRequest.objects.filter(
            verification_status=VerificationStatus.APPROVED,
            request_status__in=[RequestStatus.ACTIVE_ALERTS_SENT, RequestStatus.DONOR_RESPONDED, RequestStatus.MATCHING],
            emergency_case__isnull=True,
        ).count()
        kpis = {
            'active_emergencies': len(cases),
            'needs_intervention': sum(1 for c in cases if c['status'] in ('NEEDS_ADMIN_INTERVENTION', 'AWAITING_ESCALATION')),
            'accepted_volunteers': sum(c['counts']['accepted_volunteers'] for c in cases),
            'remaining_coordination_need': sum(c['remaining_coordination_need'] for c in cases),
            'alerts_awaiting_response': sum(c['counts']['alerts_awaiting_response'] for c in cases),
            'requests_without_engine': pending_adopt,
        }
        markers = []
        for c in active[:50]:
            from .candidates import case_origin
            lat, lng, basis = case_origin(c)
            if lat is not None:
                markers.append({'case_id': c.pk, 'reference': c.reference, 'hospital': c.hospital_name,
                                'lat': lat, 'lng': lng, 'approximate': c.hospital_lat is None,
                                'urgency': c.urgency, 'blood_group': c.blood_group, 'fictional': c.is_simulation})
        return Response({'kpis': kpis, 'cases': cases, 'recently_closed': recent, 'markers': markers,
                         'server_time': timezone.now()})


class CaseListView(AdminView):
    def get(self, request):
        qs = EmergencyCase.objects.select_related('blood_request', 'simulation_run')
        sim = request.query_params.get('simulation')
        if sim in ('true', 'false'):
            qs = qs.filter(is_simulation=(sim == 'true'))
        st = request.query_params.get('status')
        if st:
            qs = qs.filter(status=st)
        if request.query_params.get('active') == 'true':
            qs = qs.exclude(status__in=TERMINAL_CASE_STATUSES)
        page = paginate(request, list(qs.order_by('-created_at')), 10)
        page['results'] = [serialize_case(c) for c in page['results']]
        return Response(page)

    def post(self, request):
        """Start (or adopt) coordination for an approved BloodRequest."""
        req = get_object_or_404(BloodRequest, pk=request.data.get('blood_request'))
        if req.verification_status != VerificationStatus.APPROVED:
            return error('Only approved requests can enter coordination. Approve it in the Verification Queue first.', 'not_approved')
        if req.request_status in (RequestStatus.CANCELLED, RequestStatus.CLOSED, RequestStatus.FULFILLED):
            return error(f'Request is {req.request_status}; coordination cannot start.', 'request_closed')
        existing = EmergencyCase.objects.filter(blood_request=req).first()
        case = service.start_case_for_request(req, actor=request.user)
        audit(request, 'ESCALATION_STARTED', case, f'Coordination {"already running" if existing else "started"} for {req.reference_number}.')
        return Response(serialize_case(case, detail=True), status=http.HTTP_200_OK if existing else http.HTTP_201_CREATED)


class EmergencyCreateView(AdminView):
    """Administrator creates a validated, pre-approved emergency request and starts coordination."""

    @transaction.atomic
    def post(self, request):
        ser = BloodRequestCreateSerializer(data=request.data, context={'request': request})
        if not ser.is_valid():
            return Response(ser.errors, status=http.HTTP_400_BAD_REQUEST)
        required_by = ser.validated_data['required_by']
        if required_by <= timezone.now():
            return error('The required time must be in the future.', 'invalid_required_by')
        if required_by > timezone.now() + timedelta(days=7):
            return error('The required time must be within the next 7 days for an emergency request.', 'invalid_required_by')
        req = ser.save()
        req.verification_status = VerificationStatus.APPROVED
        req.request_status = RequestStatus.ACTIVE_ALERTS_SENT
        req.verified_by, req.verified_at = request.user, timezone.now()
        req.verification_notes = 'Created and verified directly by an administrator in the Command Center.'
        req.save()
        audit(request, 'CREATE_BLOOD_REQUEST', req, f'Administrator created emergency {req.reference_number}.',
              'BloodRequest')
        case = service.start_case_for_request(req, actor=request.user)
        audit(request, 'ESCALATION_STARTED', case, f'Coordination started for {req.reference_number}.')
        return Response({'request': BloodRequestDetailSerializer(req).data, 'case': serialize_case(case, detail=True)},
                        status=http.HTTP_201_CREATED)


class CaseDetailView(AdminView):
    def get(self, request, pk):
        case = get_object_or_404(EmergencyCase.objects.select_related('blood_request', 'simulation_run'), pk=pk)
        return Response(serialize_case(case, detail=True))


class CaseCandidatesView(AdminView):
    """Paginated, explainable candidate table. Never includes phone/e-mail."""

    def get(self, request, pk):
        case = get_object_or_404(EmergencyCase, pk=pk)
        view = request.query_params.get('view', 'all')
        if view not in ('all', 'eligible', 'contacted', 'excluded'):
            return error('view must be all, eligible, contacted or excluded.')
        rows, rank = candidate_rows(case, view)
        page = paginate(request, rows, 15)
        page['summary'] = {'available_by_stage': rank.available_by_stage, 'excluded_counts': rank.excluded_counts,
                           'origin_basis': rank.origin_basis}
        return Response(page)


class CaseTimelineView(AdminView):
    def get(self, request, pk):
        case = get_object_or_404(EmergencyCase, pk=pk)
        qs = case.events.select_related('actor')
        after = request.query_params.get('after_id')
        if after and after.isdigit():
            qs = qs.filter(pk__gt=int(after))
        return Response({'results': [serialize_event(e) for e in qs], 'is_simulation': case.is_simulation})


class CaseBatchesView(AdminView):
    def get(self, request, pk):
        case = get_object_or_404(EmergencyCase, pk=pk)
        return Response({'results': [serialize_batch(b) for b in case.batches.all()]})


class CaseMapView(AdminView):
    def get(self, request, pk):
        return Response(map_payload(get_object_or_404(EmergencyCase, pk=pk)))


class CaseActionView(AdminView):
    """Base for POST actions on one case."""
    action_name = ''

    def post(self, request, pk):
        case = get_object_or_404(EmergencyCase, pk=pk)
        return self.run(request, case)

    def respond(self, case_id):
        case = EmergencyCase.objects.select_related('blood_request', 'simulation_run').get(pk=case_id)
        return Response(serialize_case(case, detail=True))


class CaseEvaluateView(CaseActionView):
    def run(self, request, case):
        result = service.evaluate(case.pk, actor=request.user)
        audit(request, 'ESCALATION_EVALUATED', case, f'Engine evaluated {case.reference}: {result.action}.')
        payload = serialize_case(result.case, detail=True)
        payload['evaluation'] = {'action': result.action, 'reason': result.reason, 'changed': result.changed}
        return Response(payload)


class CaseEscalateView(CaseActionView):
    """Administrator approves the next batch / expansion (also bypasses the batch limit once)."""

    def run(self, request, case):
        if case.is_terminal:
            return error(f'Request is {case.get_status_display().lower()}; no outreach can be generated.', 'already_closed', http.HTTP_409_CONFLICT)
        result = service.approve_escalation(case.pk, actor=request.user)
        audit(request, 'ESCALATION_APPROVED', case, f'Administrator approved escalation for {case.reference}: {result.action}.')
        payload = serialize_case(result.case, detail=True)
        payload['evaluation'] = {'action': result.action, 'reason': result.reason, 'changed': result.changed}
        return Response(payload)


class CaseReviewView(CaseActionView):
    def run(self, request, case):
        note = str(request.data.get('note', ''))[:300]
        service.mark_reviewed(case.pk, request.user, note)
        audit(request, 'ESCALATION_REVIEWED', case, f'Reviewed {case.reference}. {note}')
        return self.respond(case.pk)


class CaseResolveView(CaseActionView):
    def run(self, request, case):
        note = str(request.data.get('note', ''))
        service.resolve(case.pk, request.user, note)
        audit(request, 'ESCALATION_RESOLVED', case, f'Resolved {case.reference}. {note[:200]}')
        return self.respond(case.pk)


class CaseCancelView(CaseActionView):
    def run(self, request, case):
        if case.is_terminal:
            return error(f'Request is already {case.get_status_display().lower()}.', 'already_closed', http.HTTP_409_CONFLICT)
        reason = str(request.data.get('reason', '')) or 'Cancelled by administrator.'
        service.cancel(case.pk, request.user, reason)
        audit(request, 'ESCALATION_CANCELLED', case, f'Cancelled {case.reference}. {reason[:200]}')
        return self.respond(case.pk)


class CaseAssistantView(CaseActionView):
    def run(self, request, case):
        out = assistant.answer_case_question(case, request.data.get('question'), request.data.get('intent'))
        return Response(out)


class AssistantQuestionsView(AdminView):
    def get(self, request):
        return Response({'questions': assistant.QUESTIONS, 'generated_by': assistant.GENERATED_BY,
                         'disclaimer': assistant.DISCLAIMER})


class EvaluateActiveView(AdminView):
    def post(self, request):
        results = service.evaluate_active_real_cases()
        return Response({'evaluated': len(results), 'changed': sum(1 for r in results if r.changed)})


# --------------------------------------------------------------------------- attempts
class AttemptRespondView(AdminView):
    """Record a response for an attempt (e.g. a donor phoned the desk, or manual simulation click)."""

    def post(self, request, pk):
        attempt = get_object_or_404(OutreachAttempt.objects.select_related('case'), pk=pk)
        resp = request.data.get('response')
        if resp not in ('ACCEPTED', 'DECLINED'):
            return error("response must be 'ACCEPTED' or 'DECLINED'.")
        source = 'simulation' if attempt.case.is_simulation else 'admin'
        res = service.record_response(pk, resp, source, str(request.data.get('message', '')))
        if not attempt.case.is_simulation and attempt.donor_match_id:
            from matching.models import AlertStatus
            m = attempt.donor_match
            m.alert_status = AlertStatus.ACCEPTED if resp == 'ACCEPTED' else AlertStatus.DECLINED
            m.responded_at = timezone.now()
            m.save()
        audit(request, 'ESCALATION_RESPONSE_RECORDED', attempt.case,
              f'Recorded {resp} for attempt {pk} ({source}). {res.message}')
        case = EmergencyCase.objects.select_related('blood_request', 'simulation_run').get(pk=attempt.case_id)
        return Response({'changed': res.changed, 'message': res.message, 'case': serialize_case(case, detail=True)})


class AttemptFulfilmentView(AdminView):
    def post(self, request, pk):
        attempt = get_object_or_404(OutreachAttempt.objects.select_related('case'), pk=pk)
        service.set_fulfilment(pk, request.data.get('stage'), request.user, str(request.data.get('note', ''))[:200])
        audit(request, 'ESCALATION_FULFILMENT', attempt.case, f'Attempt {pk} -> {request.data.get("stage")}.')
        case = EmergencyCase.objects.select_related('blood_request', 'simulation_run').get(pk=attempt.case_id)
        return Response(serialize_case(case, detail=True))


# --------------------------------------------------------------------------- policy
class PolicyView(AdminView):
    def get(self, request):
        row = EscalationPolicy.active()
        return Response({'config': row.config, 'defaults': DEFAULT_POLICY, 'updated_at': row.updated_at,
                         'updated_by': (row.updated_by.get_full_name() or row.updated_by.username) if row.updated_by_id else None})

    def put(self, request):
        try:
            config = normalize_policy(request.data.get('config', request.data))
        except PolicyError as exc:
            return error(str(exc), 'invalid_policy')
        row = EscalationPolicy.active()
        row.config, row.updated_by = config, request.user
        row.save()
        audit(request, 'ESCALATION_POLICY_UPDATED', row, 'Escalation policy updated.', 'EscalationPolicy')
        return Response({'config': row.config, 'updated_at': row.updated_at})


class PolicyResetView(AdminView):
    def post(self, request):
        row = EscalationPolicy.active()
        row.config, row.updated_by = normalize_policy(DEFAULT_POLICY), request.user
        row.save()
        audit(request, 'ESCALATION_POLICY_RESET', row, 'Escalation policy reset to defaults.', 'EscalationPolicy')
        return Response({'config': row.config})


# --------------------------------------------------------------------------- simulations
class ScenarioListView(AdminView):
    def get(self, request):
        return Response({'scenarios': simulation.scenario_catalogue(), 'strategies': [
            {'key': s.value, 'label': s.label} for s in experiments.STRATEGY_ORDER],
            'notice': 'All simulation donors, hospitals and responses are fictional. No SMS, e-mail or push '
                      'notification is ever sent from a simulation.'})


class SimulationListView(AdminView):
    def get(self, request):
        qs = SimulationRun.objects.filter(experiment__isnull=True).select_related('case')
        return Response({'results': [serialize_simulation(r) for r in qs[:30]]})

    def post(self, request):
        scenario = request.data.get('scenario')
        strategy = request.data.get('strategy', 'ADAPTIVE')
        try:
            seed = int(request.data.get('seed', 1))
        except (TypeError, ValueError):
            return error('seed must be an integer.')
        run = simulation.create_run(scenario, seed, strategy, actor=request.user)
        audit(request, 'SIMULATION_CREATED', run, f'Created fictional simulation {run}.', 'SimulationRun')
        return Response(serialize_simulation(run), status=http.HTTP_201_CREATED)


class SimulationPurgeView(AdminView):
    def post(self, request):
        n = simulation.purge_all()
        audit(request, 'SIMULATION_PURGED', None, f'Deleted {n} simulation run(s); no real records were affected.',
              'SimulationRun', 'all')
        return Response({'deleted_runs': n})


class SimulationDetailView(AdminView):
    def get(self, request, pk):
        run = get_object_or_404(SimulationRun, pk=pk)
        data = serialize_simulation(run)
        if data['case_id']:
            data['case'] = serialize_case(run.case, detail=True)
        return Response(data)

    def delete(self, request, pk):
        run = get_object_or_404(SimulationRun, pk=pk)
        audit(request, 'SIMULATION_DELETED', run, f'Deleted fictional simulation {run}.', 'SimulationRun')
        run.delete()
        return Response(status=http.HTTP_204_NO_CONTENT)


class SimulationControlView(AdminView):
    op = ''

    def post(self, request, pk):
        get_object_or_404(SimulationRun, pk=pk)
        if self.op == 'start':
            simulation.start_run(pk, request.user)
        elif self.op == 'step':
            minutes = request.data.get('minutes')
            simulation.step_run(pk, int(minutes) if minutes else None)
        elif self.op == 'pause':
            simulation.set_paused(pk, True)
        elif self.op == 'resume':
            simulation.set_paused(pk, False)
        elif self.op == 'run-to-end':
            simulation.run_to_end(pk)
        elif self.op == 'reset':
            simulation.reset_run(pk)
        if self.op in ('start', 'reset', 'run-to-end'):
            run = SimulationRun.objects.get(pk=pk)
            audit(request, f'SIMULATION_{self.op.upper().replace("-", "_")}', run, f'{self.op} on {run}.', 'SimulationRun')
        run = SimulationRun.objects.get(pk=pk)
        data = serialize_simulation(run)
        if data['case_id']:
            data['case'] = serialize_case(run.case, detail=True)
        return Response(data)


# --------------------------------------------------------------------------- experiments
class ExperimentListView(AdminView):
    def get(self, request):
        return Response({'results': [experiments.experiment_payload(e) for e in Experiment.objects.all()[:20]]})

    def post(self, request):
        scenario = request.data.get('scenario')
        try:
            repetitions = int(request.data.get('repetitions', 3))
            base = int(request.data.get('base_seed', 1))
        except (TypeError, ValueError):
            return error('repetitions and base_seed must be integers.')
        seeds = request.data.get('seeds') or experiments.default_seeds(base, repetitions)
        exp = experiments.run_experiment(scenario, seeds, actor=request.user)
        audit(request, 'EXPERIMENT_RUN', exp, f'Ran strategy comparison on {scenario} with seeds {exp.seeds}.', 'Experiment')
        return Response(experiments.experiment_payload(exp), status=http.HTTP_201_CREATED)


class ExperimentDetailView(AdminView):
    def get(self, request, pk):
        return Response(experiments.experiment_payload(get_object_or_404(Experiment, pk=pk)))


class ExperimentRerunView(AdminView):
    def post(self, request, pk):
        same = request.data.get('same_seeds', True) not in (False, 'false', 'False', 0)
        exp = experiments.rerun_experiment(pk, request.user, same_seeds=same)
        audit(request, 'EXPERIMENT_RERUN', exp, f'Re-ran experiment {pk} ({"same" if same else "new"} seeds).', 'Experiment')
        return Response(experiments.experiment_payload(exp), status=http.HTTP_201_CREATED)


class ExperimentAssistantView(AdminView):
    def post(self, request, pk):
        exp = get_object_or_404(Experiment, pk=pk)
        return Response(assistant.answer_experiment_question(exp, request.data.get('question')))


class ExperimentRunsView(AdminView):
    """Drill-down: the runs behind an experiment, each with its own case id (timeline via /cases/<id>/)."""

    def get(self, request, pk):
        exp = get_object_or_404(Experiment, pk=pk)
        return Response({'results': [serialize_simulation(r) for r in exp.runs.select_related('case').order_by('seed', 'id')]})
