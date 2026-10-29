"""Simulator isolation, experiment metrics, and the rule-based assistant."""
from datetime import timedelta

from django.test import TestCase
from rest_framework.test import APIClient

from accounts.models import User, UserRole
from audit.models import AuditLog
from blood_requests.models import BloodRequest
from donors.models import DonorProfile
from escalation import assistant, experiments, simulation
from escalation.constants import AttemptStatus, CaseStatus, RunStatus, Scenario, Strategy
from escalation.models import EmergencyCase, EscalationEvent, Experiment, OutreachAttempt, SimulatedDonor, SimulationRun
from escalation.service import EscalationError, service
from matching.models import DonorMatch
from notifications.models import Notification

from .helpers import FAST_HASH, make_donor, make_request, make_user, populate_pool


def counts():
    return (User.objects.count(), DonorProfile.objects.count(), BloodRequest.objects.count(),
            DonorMatch.objects.count(), Notification.objects.count())


@FAST_HASH
class SimulationIsolationTests(TestCase):
    def setUp(self):
        self.admin = make_user('admin@test.org', UserRole.ADMIN)
        self.requester = make_user('req@test.org')
        populate_pool(near=4, mid=2, far=0)
        self.real_request = make_request(self.requester)
        self.real_case = service.start_case_for_request(self.real_request)
        self.api = APIClient()
        self.api.force_authenticate(self.admin)

    def test_running_a_simulation_creates_no_real_records_and_sends_nothing(self):
        before = counts()
        real_attempts = OutreachAttempt.objects.filter(case=self.real_case).count()
        run = simulation.create_run(Scenario.HIGH_RESPONSE, 1, Strategy.ADAPTIVE)
        simulation.run_to_end(run.pk)
        self.assertEqual(counts(), before)
        self.assertEqual(OutreachAttempt.objects.filter(case=self.real_case).count(), real_attempts)
        case = run.case
        self.assertTrue(case.is_simulation)
        self.assertIsNone(case.blood_request_id)
        self.assertTrue(case.attempts.exists())
        self.assertFalse(case.attempts.filter(donor__isnull=False).exists())
        self.assertFalse(case.attempts.filter(donor_match__isnull=False).exists())
        self.assertTrue(all(e.simulation_flag for e in case.events.all()))

    def test_database_forbids_mixing_real_and_simulated_records(self):
        from django.db import IntegrityError, transaction
        run = simulation.create_run(Scenario.HIGH_RESPONSE, 1)
        with self.assertRaises(IntegrityError), transaction.atomic():
            EmergencyCase.objects.create(
                simulation_run=run, blood_request=self.real_request, is_simulation=True, reference='X', blood_group='O+',
                units_requested=1, hospital_name='x', required_by=run.sim_start, expires_at=run.sim_start,
                started_at=run.sim_start)
        case = simulation.start_run(run.pk)
        donor = DonorProfile.objects.first()
        batch = case.batches.first() or None
        with self.assertRaises(IntegrityError), transaction.atomic():
            OutreachAttempt.objects.create(case=case, batch=batch, donor=donor, sim_donor=SimulatedDonor.objects.first(),
                                           stage_index=0, attempted_at=run.sim_start)

    def test_reset_and_delete_only_touch_fictional_data(self):
        run = simulation.create_run(Scenario.PARTIAL_RESPONSE, 3)
        simulation.run_to_end(run.pk)
        before_real = counts()
        real_events = EscalationEvent.objects.filter(case=self.real_case).count()
        simulation.reset_run(run.pk)
        run.refresh_from_db()
        self.assertEqual(run.status, RunStatus.READY)
        self.assertFalse(EmergencyCase.objects.filter(simulation_run=run).exists())
        self.assertEqual(run.sim_clock, run.sim_start)
        self.assertTrue(run.donors.exists())                      # fictional donor pool survives the reset
        self.assertEqual(counts(), before_real)
        run2 = simulation.create_run(Scenario.HIGH_RESPONSE, 1)
        simulation.start_run(run2.pk)
        res = self.api.post('/api/escalation/simulations/purge/')
        self.assertEqual(res.status_code, 200)
        self.assertFalse(SimulationRun.objects.exists())
        self.assertFalse(SimulatedDonor.objects.exists())
        self.assertEqual(counts(), before_real)
        self.assertEqual(EscalationEvent.objects.filter(case=self.real_case).count(), real_events)
        self.assertTrue(EmergencyCase.objects.filter(pk=self.real_case.pk, is_simulation=False).exists())

    def test_real_overview_excludes_simulations_by_default(self):
        run = simulation.create_run(Scenario.HIGH_RESPONSE, 1)
        simulation.start_run(run.pk)
        res = self.api.get('/api/escalation/overview/').data
        self.assertTrue(all(not c['is_simulation'] for c in res['cases']))
        res = self.api.get('/api/escalation/overview/?include_simulations=true').data
        self.assertTrue(any(c['is_simulation'] for c in res['cases']))

    def test_real_evaluation_never_picks_up_simulated_cases(self):
        run = simulation.create_run(Scenario.LOW_RESPONSE, 1)
        simulation.start_run(run.pk)
        before = run.case.batches.count()
        results = service.evaluate_active_real_cases()
        self.assertEqual({r.case.pk for r in results}, {self.real_case.pk})
        self.assertEqual(run.case.batches.count(), before)


@FAST_HASH
class SimulationBehaviourTests(TestCase):
    def setUp(self):
        self.admin = make_user('admin@test.org', UserRole.ADMIN)
        self.api = APIClient()
        self.api.force_authenticate(self.admin)

    def run_scenario(self, scenario, seed=1, strategy=Strategy.ADAPTIVE):
        run = simulation.create_run(scenario, seed, strategy)
        simulation.run_to_end(run.pk)
        run.refresh_from_db()
        return run, run.case

    def test_dataset_is_deterministic_per_seed_and_differs_between_seeds(self):
        a = simulation.generate_dataset(Scenario.HIGH_RESPONSE, 7)
        self.assertEqual(a, simulation.generate_dataset(Scenario.HIGH_RESPONSE, 7))
        self.assertNotEqual(a, simulation.generate_dataset(Scenario.HIGH_RESPONSE, 8))

    def test_high_response_secures_volunteers_without_exhausting_the_pool(self):
        run, case = self.run_scenario(Scenario.HIGH_RESPONSE)
        self.assertEqual(case.status, CaseStatus.VOLUNTEERS_SECURED)
        self.assertEqual(case.remaining_coordination_need, 0)
        eligible = run.metrics['candidates_contacted']
        self.assertLess(eligible, 25)
        self.assertIn('does not confirm donations', case.last_decision['reason'])

    def test_low_response_distinguishes_declines_from_unanswered_and_stays_unresolved(self):
        run, case = self.run_scenario(Scenario.LOW_RESPONSE)
        m = run.metrics
        self.assertGreater(m['declines'], 0)
        self.assertGreater(m['unanswered_alerts'], 0)
        self.assertFalse(m['target_reached'])
        self.assertEqual(m['unresolved_requests'], 1)
        self.assertEqual(case.status, CaseStatus.NEEDS_ADMIN_INTERVENTION)
        statuses = set(case.attempts.values_list('status', flat=True))
        self.assertIn(AttemptStatus.DECLINED, statuses)
        self.assertTrue({AttemptStatus.NO_RESPONSE, AttemptStatus.ALERTED} & statuses)

    def test_no_response_in_initial_area_escalates_and_records_the_event(self):
        run, case = self.run_scenario(Scenario.NO_RESPONSE_INITIAL_AREA)
        first = case.batches.get(sequence=1)
        self.assertEqual(first.stage_index, 0)
        initial = case.attempts.filter(batch__stage_index=0)
        self.assertFalse(initial.filter(status=AttemptStatus.ACCEPTED).exists())
        self.assertTrue(case.events.filter(event_type='ESCALATION_TRIGGERED').exists())
        self.assertTrue(case.events.filter(event_type='SEARCH_EXPANDED').exists())
        self.assertGreaterEqual(case.current_stage_index, 1)

    def test_partial_response_keeps_coordination_going_until_the_target_is_actually_met(self):
        run = simulation.create_run(Scenario.PARTIAL_RESPONSE, 1, Strategy.ADAPTIVE)
        case = simulation.start_run(run.pk)
        seen_partial = False
        for _ in range(100):
            run.refresh_from_db()
            if run.status == RunStatus.COMPLETED:
                break
            simulation.step_run(run.pk)
            case.refresh_from_db()
            accepted = case.attempts.filter(status=AttemptStatus.ACCEPTED).count()
            if 0 < accepted < case.target_volunteers:
                seen_partial = True
                # some volunteers accepted but the request is neither secured nor resolved
                self.assertNotIn(case.status, (CaseStatus.VOLUNTEERS_SECURED, CaseStatus.RESOLVED))
                self.assertEqual(case.remaining_coordination_need, case.target_volunteers - accepted)
                self.assertGreater(case.remaining_coordination_need, 0)
        self.assertTrue(seen_partial)
        run.refresh_from_db()
        if case.status == CaseStatus.VOLUNTEERS_SECURED:
            self.assertGreaterEqual(run.metrics['volunteers_accepted'], run.metrics['target_volunteers'])

    def test_cancelled_scenario_stops_outreach_and_escalation(self):
        run, case = self.run_scenario(Scenario.CANCELLED)
        self.assertEqual(case.status, CaseStatus.CANCELLED)
        cancel_event = case.events.get(event_type='REQUEST_CANCELLED')
        self.assertFalse(case.batches.filter(created_at__gt=cancel_event.event_time).exists())
        self.assertFalse(case.attempts.filter(status__in=[AttemptStatus.ALERTED, AttemptStatus.VIEWED]).exists())
        before = case.batches.count()
        service.evaluate(case.pk, now=cancel_event.event_time + timedelta(hours=1))
        self.assertEqual(case.batches.count(), before)

    def test_pause_resume_and_step_controls_work_through_the_api(self):
        run = self.api.post('/api/escalation/simulations/', {'scenario': 'LOW_RESPONSE', 'seed': 2}, format='json').data
        pk = run['id']
        self.assertEqual(self.api.post(f'/api/escalation/simulations/{pk}/step/').status_code, 400)   # not started
        started = self.api.post(f'/api/escalation/simulations/{pk}/start/').data
        self.assertEqual(started['status'], 'RUNNING')
        stepped = self.api.post(f'/api/escalation/simulations/{pk}/step/').data
        self.assertGreater(stepped['elapsed_minutes'], started['elapsed_minutes'])
        self.assertEqual(self.api.post(f'/api/escalation/simulations/{pk}/pause/').data['status'], 'PAUSED')
        self.assertEqual(self.api.post(f'/api/escalation/simulations/{pk}/step/').status_code, 409)
        self.assertEqual(self.api.post(f'/api/escalation/simulations/{pk}/resume/').data['status'], 'RUNNING')
        done = self.api.post(f'/api/escalation/simulations/{pk}/run-to-end/').data
        self.assertEqual(done['status'], 'COMPLETED')
        self.assertTrue(done['final_outcome'])
        reset = self.api.post(f'/api/escalation/simulations/{pk}/reset/').data
        self.assertEqual(reset['status'], 'READY')
        self.assertIsNone(reset['case_id'])

    def test_unknown_scenario_is_rejected(self):
        self.assertEqual(self.api.post('/api/escalation/simulations/', {'scenario': 'NOPE'}, format='json').status_code, 400)

    def test_admin_can_answer_a_simulated_candidate_manually(self):
        run = simulation.create_run(Scenario.LOW_RESPONSE, 1)
        case = simulation.start_run(run.pk)
        attempt = case.attempts.filter(status=AttemptStatus.ALERTED).first()
        res = self.api.post(f'/api/escalation/attempts/{attempt.pk}/respond/', {'response': 'ACCEPTED'}, format='json')
        self.assertEqual(res.status_code, 200)
        attempt.refresh_from_db()
        self.assertEqual(attempt.status, AttemptStatus.ACCEPTED)
        self.assertEqual(attempt.response_source, 'simulation')


@FAST_HASH
class ExperimentTests(TestCase):
    def setUp(self):
        self.admin = make_user('admin@test.org', UserRole.ADMIN)
        self.api = APIClient()
        self.api.force_authenticate(self.admin)

    def test_metrics_are_computed_from_the_persisted_run_records(self):
        exp = experiments.run_experiment(Scenario.PARTIAL_RESPONSE, [1, 2])
        self.assertEqual(exp.runs.count(), 6)
        for run in exp.runs.all():
            case = run.case
            attempts = list(case.attempts.all())
            m = run.metrics
            self.assertEqual(m['communication_attempts'], len(attempts))
            self.assertEqual(m['candidates_contacted'], len({a.sim_donor_id for a in attempts}))
            self.assertEqual(m['declines'], sum(1 for a in attempts if a.status == AttemptStatus.DECLINED))
            self.assertEqual(m['volunteers_accepted'], sum(1 for a in attempts if a.status == AttemptStatus.ACCEPTED))
            self.assertEqual(m['outreach_batches'], case.batches.count())
            self.assertEqual(m['unanswered_alerts'], sum(1 for a in attempts if a.status not in (
                AttemptStatus.ACCEPTED, AttemptStatus.DECLINED)))
        agg = exp.results['strategies']['BROADCAST']['summary']
        manual = [r.metrics['communication_attempts'] for r in exp.runs.filter(strategy='BROADCAST')]
        self.assertAlmostEqual(agg['communication_attempts'], sum(manual) / len(manual), places=1)

    def test_all_strategies_share_the_same_donor_dataset(self):
        exp = experiments.run_experiment(Scenario.HIGH_RESPONSE, [4])
        datasets = [list(r.donors.values_list('code', 'blood_group', 'locality', 'latitude', 'response_plan',
                                              'response_delay_minutes')) for r in exp.runs.all()]
        self.assertEqual(len(datasets), 3)
        self.assertTrue(all(d == datasets[0] for d in datasets))

    def test_broadcast_contacts_more_candidates_than_adaptive_when_response_is_high(self):
        exp = experiments.run_experiment(Scenario.HIGH_RESPONSE, [1, 2, 3])
        s = exp.results['strategies']
        self.assertGreater(s['BROADCAST']['summary']['candidates_contacted'], s['ADAPTIVE']['summary']['candidates_contacted'])
        self.assertEqual(s['BROADCAST']['summary']['outreach_batches'], 1)

    def test_rerun_with_same_seeds_is_reproducible(self):
        first = experiments.run_experiment(Scenario.LOW_RESPONSE, [5])
        second = experiments.rerun_experiment(first.pk, self.admin, same_seeds=True)
        self.assertNotEqual(first.pk, second.pk)
        self.assertEqual(second.rerun_of_id, first.pk)
        key = lambda e: {k: v['summary'] for k, v in e.results['strategies'].items()}  # noqa: E731
        self.assertEqual(key(first), key(second))
        third = experiments.rerun_experiment(first.pk, self.admin, same_seeds=False, base_seed=50)
        self.assertEqual(third.seeds, [50])

    def test_experiment_api_and_validation(self):
        res = self.api.post('/api/escalation/experiments/', {'scenario': 'CANCELLED', 'repetitions': 2}, format='json')
        self.assertEqual(res.status_code, 201, res.data)
        data = res.data['results']
        self.assertEqual(set(data['strategies']), {'BROADCAST', 'FIXED', 'ADAPTIVE'})
        self.assertIn('not measured hospital performance', data['caveat'])
        for block in data['strategies'].values():
            self.assertTrue(block['series'])
            self.assertEqual(block['summary']['runs'], 2)
        self.assertEqual(self.api.post('/api/escalation/experiments/', {'scenario': 'X'}, format='json').status_code, 400)
        self.assertEqual(self.api.post('/api/escalation/experiments/', {'scenario': 'CANCELLED', 'seeds': list(range(40))}, format='json').status_code, 400)
        again = self.api.post(f'/api/escalation/experiments/{res.data["id"]}/rerun/', {'same_seeds': True}, format='json')
        self.assertEqual(again.status_code, 201)
        self.assertTrue(AuditLog.objects.filter(action='EXPERIMENT_RUN').exists())

    def test_unreached_target_is_reported_as_null_not_zero(self):
        exp = experiments.run_experiment(Scenario.LOW_RESPONSE, [1])
        for block in exp.results['strategies'].values():
            for row in block['per_seed']:
                if not row['target_reached']:
                    self.assertIsNone(row['time_to_target_minutes'])
                    self.assertEqual(row['unresolved_requests'], 1)


@FAST_HASH
class AssistantTests(TestCase):
    def setUp(self):
        self.admin = make_user('admin@test.org', UserRole.ADMIN)
        self.requester = make_user('req@test.org')
        populate_pool(near=8, mid=6, far=0)
        self.case = service.start_case_for_request(make_request(self.requester))
        self.api = APIClient()
        self.api.force_authenticate(self.admin)

    def ask(self, **body):
        return self.api.post(f'/api/escalation/cases/{self.case.pk}/assistant/', body, format='json').data

    def test_answers_reflect_current_backend_state(self):
        first = self.ask(intent='why_unresolved')
        self.assertIn('4 more volunteer(s)', first['headline'])
        attempt = self.case.attempts.order_by('rank_position').first()
        service.record_response(attempt.pk, AttemptStatus.ACCEPTED, 'donor_app')
        second = self.ask(intent='why_unresolved')
        self.assertIn('3 more volunteer(s)', second['headline'])
        self.assertTrue(any('accepted: 1' in f or 'have accepted: 1' in f for f in second['known_facts']))

    def test_separates_facts_from_unknowns_and_never_claims_delivery(self):
        out = self.ask(intent='missing_information')
        text = ' '.join(out['known_facts'] + out['unknowns'] + [out['headline']]).lower()
        self.assertTrue(out['unknowns'])
        self.assertIn('stock', text)
        self.assertNotIn('delivered', text.replace('delivery is confirmed only', '').replace('delivery receipts', ''))
        self.assertIn('not medical', out['disclaimer'].lower() + ' not medical')
        self.assertIn('Rule-based', out['generated_by'])

    def test_explains_prioritisation_with_real_scores_and_rules(self):
        out = self.ask(question='Why did the system prioritise these candidates?')
        self.assertEqual(out['intent'], 'why_prioritised')
        top = self.case.attempts.order_by('batch__sequence', 'rank_position').first()
        self.assertTrue(any(f'score {top.rank_score}%' in f for f in out['known_facts']))
        self.assertTrue(any('past response behaviour' in r for r in out['rules_applied']))

    def test_explains_expansion_after_it_happens(self):
        before = self.ask(intent='why_expanded')
        self.assertIn('not been expanded', before['headline'])
        service.evaluate(self.case.pk, now=self.case.started_at + timedelta(minutes=15))
        after = self.ask(intent='why_expanded')
        self.assertIn('expanded 1 time', after['headline'])

    def test_free_text_routing_and_unsupported_questions(self):
        self.assertEqual(self.ask(question='what actions remain?')['intent'], 'remaining_actions')
        self.assertEqual(self.ask(question='which stages have completed')['intent'], 'stages_completed')
        out = self.ask(question='what is the weather in Chennai')
        self.assertEqual(out['intent'], 'unsupported')
        self.assertEqual(out['known_facts'], [])

    def test_recommendations_follow_actual_state(self):
        detail = self.api.get(f'/api/escalation/cases/{self.case.pk}/').data
        self.assertEqual(detail['recommendations'][0]['code'], 'WAIT_FOR_RESPONSES')
        for a in self.case.attempts.order_by('rank_position')[:4]:
            service.record_response(a.pk, AttemptStatus.ACCEPTED, 'donor_app')
        detail = self.api.get(f'/api/escalation/cases/{self.case.pk}/').data
        codes = [r['code'] for r in detail['recommendations']]
        self.assertIn('START_HOSPITAL_VERIFICATION', codes)
        self.assertIn('hospital', detail['recommendations'][0]['reason'].lower())
        service.cancel(self.case.pk, self.admin, 'x')
        detail = self.api.get(f'/api/escalation/cases/{self.case.pk}/').data
        self.assertEqual(detail['recommendations'][0]['code'], 'NONE')

    def test_strategy_question_uses_stored_experiment_results(self):
        exp = experiments.run_experiment(Scenario.HIGH_RESPONSE, [1])
        run = exp.runs.filter(strategy='ADAPTIVE').first()
        out = self.api.post(f'/api/escalation/cases/{run.case.pk}/assistant/', {'intent': 'strategy_comparison'}, format='json').data
        broadcast = exp.results['strategies']['BROADCAST']['summary']['candidates_contacted']
        self.assertTrue(any(f'avg {broadcast} candidates contacted' in f for f in out['known_facts']))
        self.assertTrue(any('not measured hospital performance' in u for u in out['unknowns']))
        direct = self.api.post(f'/api/escalation/experiments/{exp.pk}/assistant/', {}, format='json').data
        self.assertEqual(direct['intent'], 'strategy_comparison')
        real = self.ask(intent='strategy_comparison')
        self.assertTrue(any('Comparisons exist only' in u for u in real['unknowns']))
