import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { FastForward, FlaskConical, Pause, Play, RotateCcw, SkipForward, Trash2 } from 'lucide-react';
import { escalationApi, errorMessage } from '../../api/escalation';
import CandidateTable from '../../components/escalation/CandidateTable';
import {
  AssistantPanel, CaseMetrics, DecisionLog, Pipeline, Timeline,
} from '../../components/escalation/CaseViews';
import { CaseMap } from '../../components/escalation/EscalationMap';
import {
  Alert, Button, CaseStatusBadge, Metric, Panel, SimBadge, SimulationBanner, useInterval,
} from '../../components/escalation/shared';

const SPEEDS = [{ label: 'Slow (1.5 s / step)', ms: 1500 }, { label: 'Normal (0.8 s / step)', ms: 800 }, { label: 'Fast (0.3 s / step)', ms: 300 }];

const METRIC_LABELS = [
  ['time_to_target_minutes', 'Minutes until volunteer target reached', (v) => (v == null ? 'Not reached' : `${v} min`)],
  ['candidates_contacted', 'Candidates contacted'], ['outreach_batches', 'Outreach batches'],
  ['communication_attempts', 'Simulated alerts issued'], ['volunteers_accepted', 'Volunteers accepted'],
  ['declines', 'Declines'], ['unanswered_alerts', 'Unanswered alerts at end'], ['stage_reached', 'Search stages reached'],
];

const SimulatorPage = () => {
  const [params, setParams] = useSearchParams();
  const [catalogue, setCatalogue] = useState({ scenarios: [], strategies: [] });
  const [history, setHistory] = useState([]);
  const [scenario, setScenario] = useState('NO_RESPONSE_INITIAL_AREA');
  const [strategy, setStrategy] = useState('ADAPTIVE');
  const [seed, setSeed] = useState(1);
  const [speed, setSpeed] = useState(SPEEDS[1].ms);
  const [run, setRun] = useState(null);
  const [events, setEvents] = useState([]);
  const [playing, setPlaying] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [busy, setBusy] = useState(null);
  const [error, setError] = useState('');
  const inFlight = useRef(false);

  const loadHistory = useCallback(() => escalationApi.simulations().then((d) => setHistory(d.results)).catch(() => {}), []);

  useEffect(() => {
    escalationApi.scenarios().then(setCatalogue).catch((err) => setError(errorMessage(err)));
    loadHistory();
  }, [loadHistory]);

  const apply = useCallback(async (r) => {
    setRun(r);
    if (r.case_id) {
      const tl = await escalationApi.timeline(r.case_id);
      setEvents(tl.results);
    } else setEvents([]);
    setRefreshKey((k) => k + 1);
  }, []);

  const open = useCallback(async (id) => {
    try { setPlaying(false); await apply(await escalationApi.simulation(id)); setError(''); }
    catch (err) { setError(errorMessage(err)); }
  }, [apply]);

  useEffect(() => { const id = params.get('run'); if (id) open(id); }, [params, open]);

  const guard = async (key, fn) => {
    setBusy(key); setError('');
    try { return await fn(); }
    catch (err) { setError(errorMessage(err)); setPlaying(false); return null; }
    finally { setBusy(null); }
  };

  const create = () => guard('create', async () => {
    const r = await escalationApi.createSimulation({ scenario, strategy, seed: Number(seed) });
    setParams({ run: r.id });
    await apply(r); loadHistory();
  });

  const control = (op) => guard(op, async () => {
    const r = await escalationApi.simControl(run.id, op);
    await apply(r);
    if (op === 'start') setPlaying(true);
    if (op === 'pause') setPlaying(false);
    if (op === 'resume') setPlaying(true);
    if (op === 'reset' || op === 'run-to-end') setPlaying(false);
    loadHistory();
  });

  const stepOnce = useCallback(async () => {
    if (inFlight.current || !run) return;
    inFlight.current = true;
    try {
      const r = await escalationApi.simControl(run.id, 'step');
      await apply(r);
      if (r.status === 'COMPLETED') { setPlaying(false); loadHistory(); }
    } catch (err) { setError(errorMessage(err)); setPlaying(false); }
    finally { inFlight.current = false; }
  }, [run, apply, loadHistory]);

  useInterval(stepOnce, speed, playing && run?.status === 'RUNNING');

  const remove = () => guard('delete', async () => {
    await escalationApi.deleteSimulation(run.id);
    setRun(null); setEvents([]); setPlaying(false); setParams({}); loadHistory();
  });
  const purge = () => guard('purge', async () => {
    if (!window.confirm('Delete ALL fictional simulation runs and experiments? Real donors and requests are not affected.')) return;
    await escalationApi.purgeSimulations();
    setRun(null); setEvents([]); setPlaying(false); setParams({}); loadHistory();
  });

  const c = run?.case;
  const selected = catalogue.scenarios.find((s) => s.key === scenario);
  return (
    <div className="space-y-5">
      <div>
        <p className="text-[11px] font-bold text-violet-700 uppercase tracking-wider">Demonstration and evaluation</p>
        <h1 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">Emergency Response Simulator <SimBadge /></h1>
        <p className="text-xs text-slate-600 mt-1 max-w-3xl">
          Runs the same escalation service as real emergencies against a fictional donor pool with scripted responses. Pick a scenario, start it, and watch each decision appear in the timeline.
        </p>
      </div>
      <SimulationBanner />
      {error && <Alert>{error}</Alert>}

      <Panel title="Scenario" icon={FlaskConical}>
        <fieldset className="grid gap-2 md:grid-cols-2 xl:grid-cols-5">
          <legend className="sr-only">Choose a scenario</legend>
          {catalogue.scenarios.map((s) => (
            <label key={s.key} className={`cursor-pointer rounded-lg border p-3 text-xs ${scenario === s.key ? 'border-violet-500 bg-violet-50' : 'border-slate-200 bg-white hover:bg-slate-50'}`}>
              <input type="radio" name="scenario" className="sr-only" checked={scenario === s.key} onChange={() => setScenario(s.key)} />
              <span className="font-bold text-slate-900 block">{s.label}</span>
              <span className="text-[11px] text-slate-600 leading-snug block mt-1">{s.description}</span>
            </label>
          ))}
        </fieldset>
        <div className="flex flex-wrap items-end gap-3 mt-4">
          <div>
            <label className="block text-[11px] font-semibold text-slate-700 mb-1" htmlFor="sim-strategy">Outreach strategy</label>
            <select id="sim-strategy" value={strategy} onChange={(e) => setStrategy(e.target.value)} className="text-xs border border-slate-300 rounded-lg px-2 py-1.5 bg-white">
              <option value="ADAPTIVE">C - Adaptive escalation (the engine)</option>
              <option value="FIXED">B - Fixed escalation (baseline)</option>
              <option value="BROADCAST">A - Basic broadcast (baseline)</option>
            </select>
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-slate-700 mb-1" htmlFor="sim-seed">Random seed</label>
            <input id="sim-seed" type="number" value={seed} onChange={(e) => setSeed(e.target.value)} className="w-24 text-xs border border-slate-300 rounded-lg px-2 py-1.5" />
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-slate-700 mb-1" htmlFor="sim-speed">Playback speed</label>
            <select id="sim-speed" value={speed} onChange={(e) => setSpeed(Number(e.target.value))} className="text-xs border border-slate-300 rounded-lg px-2 py-1.5 bg-white">
              {SPEEDS.map((s) => <option key={s.ms} value={s.ms}>{s.label}</option>)}
            </select>
          </div>
          <Button variant="primary" busy={busy === 'create'} onClick={create}>Create simulation</Button>
          {history.length > 0 && (
            <div>
              <label className="block text-[11px] font-semibold text-slate-700 mb-1" htmlFor="sim-history">Previous runs</label>
              <select id="sim-history" value={run?.id || ''} onChange={(e) => e.target.value && setParams({ run: e.target.value })} className="text-xs border border-slate-300 rounded-lg px-2 py-1.5 bg-white max-w-[15rem]">
                <option value="">Open a previous run...</option>
                {history.map((h) => <option key={h.id} value={h.id}>#{h.id} {h.scenario_label} / {h.strategy_label} ({h.status.toLowerCase()})</option>)}
              </select>
            </div>
          )}
        </div>
        {selected && <p className="text-[11px] text-slate-500 mt-3">
          Fictional request: {selected.units} unit(s) of {selected.blood_group} at a fictional Adyar hospital, {selected.urgency}, {selected.horizon_minutes}-minute horizon
          {selected.cancel_at_minute != null && `; the hospital cancels at minute ${selected.cancel_at_minute}`}. Donor behaviour is scripted from the seed, so the same seed replays identically.
        </p>}
      </Panel>

      {run && (
        <>
          <Panel title={`Run #${run.id}: ${run.scenario_label} - ${run.strategy_label} (seed ${run.seed})`} icon={Play}
            actions={<span className="text-[11px] font-semibold text-slate-600">{run.status}</span>}>
            <div className="flex flex-wrap gap-2 mb-3">
              {run.status === 'READY' && <Button variant="primary" busy={busy === 'start'} onClick={() => control('start')}><Play className="w-3.5 h-3.5" aria-hidden="true" /> Start simulation</Button>}
              {run.status === 'RUNNING' && !playing && <Button variant="primary" onClick={() => setPlaying(true)}><Play className="w-3.5 h-3.5" aria-hidden="true" /> Play</Button>}
              {run.status === 'RUNNING' && playing && <Button onClick={() => control('pause')} busy={busy === 'pause'}><Pause className="w-3.5 h-3.5" aria-hidden="true" /> Pause</Button>}
              {run.status === 'PAUSED' && <Button variant="primary" busy={busy === 'resume'} onClick={() => control('resume')}><Play className="w-3.5 h-3.5" aria-hidden="true" /> Resume</Button>}
              {run.status === 'RUNNING' && !playing && <Button busy={busy === 'step'} onClick={() => guard('step', stepOnce)}><SkipForward className="w-3.5 h-3.5" aria-hidden="true" /> Step ({run.tick_minutes} min)</Button>}
              {['RUNNING', 'PAUSED'].includes(run.status) && <Button busy={busy === 'run-to-end'} onClick={() => run.status === 'PAUSED' ? control('resume').then(() => control('run-to-end')) : control('run-to-end')}><FastForward className="w-3.5 h-3.5" aria-hidden="true" /> Run to end</Button>}
              <Button busy={busy === 'reset'} onClick={() => control('reset')}><RotateCcw className="w-3.5 h-3.5" aria-hidden="true" /> Reset</Button>
              <Button variant="danger" busy={busy === 'delete'} onClick={remove}><Trash2 className="w-3.5 h-3.5" aria-hidden="true" /> Delete run</Button>
            </div>
            <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-xs text-slate-700">
              <span>Simulated clock: <strong className="tabular-nums">T+{run.elapsed_minutes} min</strong> of {run.horizon_minutes}</span>
              {c && <span>Stage: <strong>{c.current_stage.name}</strong></span>}
              {c && <CaseStatusBadge status={c.status} />}
            </div>
            <div className="h-1.5 bg-slate-100 rounded-full mt-3 overflow-hidden" role="progressbar" aria-valuemin={0} aria-valuemax={run.horizon_minutes} aria-valuenow={run.elapsed_minutes} aria-label="Simulated time">
              <div className="h-full bg-violet-500" style={{ width: `${Math.min(100, (run.elapsed_minutes / run.horizon_minutes) * 100)}%` }} />
            </div>
          </Panel>

          {run.status === 'COMPLETED' && (
            <Panel title="Final outcome" bodyClass="p-4 space-y-3">
              <p className="text-sm font-semibold text-slate-900">{run.final_outcome}</p>
              <div className="bg-slate-50 border border-slate-200 rounded-lg grid grid-cols-2 sm:flex sm:flex-wrap sm:divide-x divide-slate-200">
                {METRIC_LABELS.map(([key, label, fmt]) => <Metric key={key} label={label} value={fmt ? fmt(run.metrics[key]) : run.metrics[key]} />)}
              </div>
              <p className="text-[11px] text-slate-500">Simulation figures are not measured hospital performance or real donation outcomes. To compare strategies on this scenario, open <Link to="/admin-portal/strategy-comparison" className="text-red-700 font-semibold underline">Strategy Comparison</Link>.</p>
            </Panel>
          )}

          {c && (
            <>
              <CaseMetrics c={c} />
              <Panel title="Outreach pipeline"><Pipeline steps={c.pipeline} /></Panel>
              <div className="grid gap-5 xl:grid-cols-5">
                <div className="xl:col-span-3 space-y-5 min-w-0">
                  <CandidateTable caseId={c.id} isTerminal={c.is_terminal} refreshKey={refreshKey} onChanged={() => open(run.id)} />
                  <DecisionLog events={events} />
                </div>
                <div className="xl:col-span-2 space-y-5 min-w-0">
                  <Panel title="Event timeline (simulated time)"><Timeline events={events} simStart={run.sim_start} /></Panel>
                  <CaseMap caseId={c.id} refreshKey={refreshKey} />
                  <AssistantPanel caseId={c.id} refreshKey={refreshKey} />
                </div>
              </div>
            </>
          )}
        </>
      )}

      <div className="flex justify-end">
        <Button variant="danger" busy={busy === 'purge'} onClick={purge}><Trash2 className="w-3.5 h-3.5" aria-hidden="true" /> Delete all fictional simulation data</Button>
      </div>
    </div>
  );
};

export default SimulatorPage;
