import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import { BarChart3, FlaskConical, MessageSquareText, RefreshCw } from 'lucide-react';
import { escalationApi, errorMessage } from '../../api/escalation';
import { AssistantAnswer } from '../../components/escalation/CaseViews';
import { Alert, Button, Panel, SimBadge, SimulationBanner, fmtTime } from '../../components/escalation/shared';

const ORDER = ['BROADCAST', 'FIXED', 'ADAPTIVE'];
const SHORT = { BROADCAST: 'A Broadcast', FIXED: 'B Fixed', ADAPTIVE: 'C Adaptive' };
const TICK = { BROADCAST: 'A', FIXED: 'B', ADAPTIVE: 'C' };
const COLOR = { BROADCAST: '#7a6f66', FIXED: '#b7791f', ADAPTIVE: '#8a2338' };
const DASH = { BROADCAST: '2 4', FIXED: '6 3', ADAPTIVE: undefined };

const ROWS = [
  ['mean_time_to_target_minutes', 'Mean minutes until volunteer target reached', (s) => (s.mean_time_to_target_minutes == null ? 'Never reached' : `${s.mean_time_to_target_minutes} min`), 'Averaged over the runs that reached the target only'],
  ['runs_target_reached', 'Runs that reached the target', (s) => `${s.runs_target_reached} / ${s.runs}`],
  ['unresolved_requests', 'Unresolved requests (runs)', (s) => s.unresolved_requests, 'Target not reached before the horizon'],
  ['candidates_contacted', 'Candidates contacted (avg per run)', (s) => s.candidates_contacted],
  ['outreach_batches', 'Outreach batches (avg per run)', (s) => s.outreach_batches],
  ['communication_attempts', 'Simulated communication attempts (avg)', (s) => s.communication_attempts, 'Alerts issued; nothing real is sent'],
  ['declines', 'Declines (avg per run)', (s) => s.declines],
  ['unanswered_alerts', 'Unanswered alerts when the run stopped (avg)', (s) => s.unanswered_alerts, 'No response yet; status unknown'],
  ['volunteers_accepted', 'Volunteers accepted (avg per run)', (s) => s.volunteers_accepted, 'Not confirmed donations'],
];

const ChartCard = ({ title, data, unit }) => (
  <Panel title={title} bodyClass="p-3">
    <div style={{ height: 190 }} role="img" aria-label={`${title}: ${data.map((d) => `${d.name} ${d.value}`).join(', ')}`}>
      <ResponsiveContainer>
        <BarChart data={data} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e6dfd9" />
          <XAxis dataKey="name" tick={{ fontSize: 10 }} interval={0} />
          <YAxis tick={{ fontSize: 10 }} allowDecimals />
          <Tooltip formatter={(v) => [`${v}${unit || ''}`, title]} />
          <Bar dataKey="value" radius={[3, 3, 0, 0]} label={{ position: 'top', fontSize: 10 }}>
            {data.map((d) => <Cell key={d.key} fill={COLOR[d.key]} />)}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  </Panel>
);

const StrategyComparisonPage = () => {
  const [scenarios, setScenarios] = useState([]);
  const [scenario, setScenario] = useState('NO_RESPONSE_INITIAL_AREA');
  const [reps, setReps] = useState(3);
  const [base, setBase] = useState(1);
  const [history, setHistory] = useState([]);
  const [exp, setExp] = useState(null);
  const [busy, setBusy] = useState(null);
  const [error, setError] = useState('');
  const [explain, setExplain] = useState(null);

  const loadHistory = useCallback(() => escalationApi.experiments().then((d) => {
    setHistory(d.results);
    return d.results;
  }).catch(() => []), []);

  useEffect(() => {
    escalationApi.scenarios().then((d) => setScenarios(d.scenarios)).catch((err) => setError(errorMessage(err)));
    loadHistory().then((list) => { if (list.length) setExp(list[0]); });
  }, [loadHistory]);

  const guard = async (key, fn) => {
    setBusy(key); setError('');
    try { const r = await fn(); setExp(r); setExplain(null); await loadHistory(); }
    catch (err) { setError(errorMessage(err)); }
    finally { setBusy(null); }
  };

  const run = () => guard('run', () => escalationApi.runExperiment({ scenario, repetitions: Number(reps), base_seed: Number(base) }));
  const rerun = (same) => guard(same ? 'same' : 'new', () => escalationApi.rerunExperiment(exp.id, same));

  const explainResults = async () => {
    setBusy('explain'); setError('');
    try { setExplain(await escalationApi.askExperiment(exp.id, 'How did the escalation strategies perform?')); }
    catch (err) { setError(errorMessage(err)); }
    finally { setBusy(null); }
  };

  const res = exp?.results;
  const strategies = res?.strategies;
  const bars = useMemo(() => {
    if (!strategies) return null;
    const mk = (get) => ORDER.map((k) => ({ key: k, name: TICK[k], value: get(strategies[k].summary) ?? 0 }));
    return {
      contacted: mk((s) => s.candidates_contacted), batches: mk((s) => s.outreach_batches),
      declines: mk((s) => s.declines), unanswered: mk((s) => s.unanswered_alerts),
      time: mk((s) => s.mean_time_to_target_minutes),
    };
  }, [strategies]);
  const series = useMemo(() => {
    if (!strategies) return [];
    const len = Math.max(...ORDER.map((k) => strategies[k].series.length));
    return Array.from({ length: len }, (_, i) => {
      const row = { minute: i * 2 };
      ORDER.forEach((k) => {
        const s = strategies[k].series[i] || strategies[k].series[strategies[k].series.length - 1];
        row[`${k}_accepted`] = s?.accepted; row[`${k}_alerts`] = s?.alerts;
      });
      return row;
    });
  }, [strategies]);

  return (
    <div className="space-y-5">
      <div>
        <p className="text-[11px] font-bold text-violet-700 uppercase tracking-wider">Experiment</p>
        <h1 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">Strategy Comparison <SimBadge /></h1>
        <p className="text-xs text-slate-600 mt-1 max-w-3xl">
          Runs one fictional scenario and the same donor dataset through three outreach strategies using the same engine, then reports what actually happened in each run. Nothing here is pre-computed.
        </p>
      </div>
      <SimulationBanner>
        Results describe scripted fictional donors. They are not measured hospital performance, real donor response rates or actual donation outcomes.
      </SimulationBanner>
      {error && <Alert>{error}</Alert>}

      <Panel title="Run a comparison" icon={FlaskConical}>
        <div className="flex flex-wrap items-end gap-3">
          <div><label className="block text-[11px] font-semibold text-slate-700 mb-1" htmlFor="cmp-scn">Scenario</label>
            <select id="cmp-scn" value={scenario} onChange={(e) => setScenario(e.target.value)} className="text-xs border border-slate-300 rounded-lg px-2 py-1.5 bg-white">
              {scenarios.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
            </select></div>
          <div><label className="block text-[11px] font-semibold text-slate-700 mb-1" htmlFor="cmp-reps">Repetitions (seeds)</label>
            <input id="cmp-reps" type="number" min="1" max="10" value={reps} onChange={(e) => setReps(e.target.value)} className="w-20 text-xs border border-slate-300 rounded-lg px-2 py-1.5" /></div>
          <div><label className="block text-[11px] font-semibold text-slate-700 mb-1" htmlFor="cmp-base">First seed</label>
            <input id="cmp-base" type="number" value={base} onChange={(e) => setBase(e.target.value)} className="w-20 text-xs border border-slate-300 rounded-lg px-2 py-1.5" /></div>
          <Button variant="primary" busy={busy === 'run'} onClick={run}><BarChart3 className="w-3.5 h-3.5" aria-hidden="true" /> Run all three strategies</Button>
          {history.length > 0 && (
            <div><label className="block text-[11px] font-semibold text-slate-700 mb-1" htmlFor="cmp-hist">Previous experiments</label>
              <select id="cmp-hist" value={exp?.id || ''} onChange={(e) => { setExp(history.find((h) => h.id === Number(e.target.value))); setExplain(null); }}
                className="text-xs border border-slate-300 rounded-lg px-2 py-1.5 bg-white max-w-[16rem]">
                {history.map((h) => <option key={h.id} value={h.id}>#{h.id} {h.scenario_label}, seeds {h.seeds.join(',')}</option>)}
              </select></div>
          )}
        </div>
        {busy === 'run' && <p className="text-[11px] text-slate-500 mt-2">Running {reps * 3} simulations through the escalation engine...</p>}
      </Panel>

      {exp && res && bars && (
        <>
          <Panel title={`Experiment #${exp.id}: ${exp.scenario_label} - seeds ${exp.seeds.join(', ')}`} icon={BarChart3}
            actions={<span className="text-[11px] text-slate-500">{fmtTime(exp.created_at)}{exp.rerun_of ? ` - rerun of #${exp.rerun_of}` : ''}</span>} bodyClass="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <caption className="sr-only">Strategy comparison metrics</caption>
                <thead className="bg-slate-50 text-slate-600 text-[10px] uppercase tracking-wider">
                  <tr><th className="py-2 px-4">Metric</th>{ORDER.map((k) => <th key={k} className="py-2 px-3" style={{ color: COLOR[k] }}>{strategies[k].label}</th>)}</tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {ROWS.map(([key, label, fmt, hint]) => (
                    <tr key={key}>
                      <th scope="row" className="py-2 px-4 font-medium text-slate-800 text-left">{label}{hint && <span className="block text-[10px] font-normal text-slate-500">{hint}</span>}</th>
                      {ORDER.map((k) => <td key={k} className="py-2 px-3 tabular-nums font-semibold">{fmt(strategies[k].summary)}</td>)}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex flex-wrap items-center gap-2 px-4 py-3 border-t border-slate-200">
              <Button busy={busy === 'same'} onClick={() => rerun(true)}><RefreshCw className="w-3.5 h-3.5" aria-hidden="true" /> Rerun same scenario and seeds</Button>
              <Button busy={busy === 'new'} onClick={() => rerun(false)}>Rerun with new seeds</Button>
              <Button busy={busy === 'explain'} onClick={explainResults}><MessageSquareText className="w-3.5 h-3.5" aria-hidden="true" /> Explain these results</Button>
              <span className="text-[11px] text-slate-500">Same seeds reproduce identical numbers, which shows the comparison is deterministic and not staged.</span>
            </div>
          </Panel>

          {explain && <Panel title="Explanation"><AssistantAnswer answer={explain} /></Panel>}

          <p className="text-[11px] text-slate-600"><span style={{ color: COLOR.BROADCAST }} className="font-bold">A</span> Basic broadcast - <span style={{ color: COLOR.FIXED }} className="font-bold">B</span> Fixed escalation - <span style={{ color: COLOR.ADAPTIVE }} className="font-bold">C</span> Adaptive escalation. Bars and lines use the same colours; lines also differ in dash style.</p>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
            <ChartCard title="Candidates contacted" data={bars.contacted} />
            <ChartCard title="Outreach batches" data={bars.batches} />
            <ChartCard title="Declines" data={bars.declines} />
            <ChartCard title="Unanswered at stop" data={bars.unanswered} />
            <ChartCard title="Mean minutes to target" data={bars.time} unit=" min" />
          </div>

          <Panel title="Volunteers accepted over simulated time (mean across seeds)">
            <div style={{ height: 260 }} role="img" aria-label="Line chart of cumulative accepted volunteers over simulated minutes for each strategy">
              <ResponsiveContainer>
                <LineChart data={series} margin={{ top: 8, right: 16, left: -10, bottom: 4 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e6dfd9" />
                  <XAxis dataKey="minute" tick={{ fontSize: 10 }} label={{ value: 'simulated minutes', position: 'insideBottom', offset: -2, fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} />
                  <Tooltip />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  {ORDER.map((k) => <Line key={k} type="stepAfter" dataKey={`${k}_accepted`} name={`${SHORT[k]}: accepted`} stroke={COLOR[k]} strokeDasharray={DASH[k]} strokeWidth={2} dot={false} />)}
                </LineChart>
              </ResponsiveContainer>
            </div>
          </Panel>

          <Panel title="Alerts issued over simulated time (mean across seeds)">
            <div style={{ height: 220 }} role="img" aria-label="Line chart of cumulative alerts issued over simulated minutes for each strategy">
              <ResponsiveContainer>
                <LineChart data={series} margin={{ top: 8, right: 16, left: -10, bottom: 4 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e6dfd9" />
                  <XAxis dataKey="minute" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} />
                  <Tooltip />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  {ORDER.map((k) => <Line key={k} type="stepAfter" dataKey={`${k}_alerts`} name={`${SHORT[k]}: alerts`} stroke={COLOR[k]} strokeDasharray={DASH[k]} strokeWidth={2} dot={false} />)}
                </LineChart>
              </ResponsiveContainer>
            </div>
          </Panel>

          <Panel title="Every run behind these numbers" bodyClass="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <caption className="sr-only">Per-seed results for each strategy</caption>
                <thead className="bg-slate-50 text-slate-600 text-[10px] uppercase tracking-wider">
                  <tr><th className="py-2 px-4">Seed</th><th className="py-2 px-2">Strategy</th><th className="py-2 px-2">Minutes to target</th><th className="py-2 px-2">Contacted</th>
                    <th className="py-2 px-2">Batches</th><th className="py-2 px-2">Declines</th><th className="py-2 px-2">Unanswered</th><th className="py-2 px-2">Accepted</th><th className="py-2 px-2">Final status</th><th className="py-2 px-2" /></tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {exp.seeds.flatMap((seed) => ORDER.map((k) => {
                    const row = strategies[k].per_seed.find((r) => r.seed === seed);
                    return row && (
                      <tr key={`${seed}-${k}`}>
                        <td className="py-1.5 px-4 tabular-nums">{seed}</td>
                        <td className="py-1.5 px-2 font-semibold" style={{ color: COLOR[k] }}>{SHORT[k]}</td>
                        <td className="py-1.5 px-2 tabular-nums">{row.time_to_target_minutes ?? 'Not reached'}</td>
                        <td className="py-1.5 px-2 tabular-nums">{row.candidates_contacted}</td>
                        <td className="py-1.5 px-2 tabular-nums">{row.outreach_batches}</td>
                        <td className="py-1.5 px-2 tabular-nums">{row.declines}</td>
                        <td className="py-1.5 px-2 tabular-nums">{row.unanswered_alerts}</td>
                        <td className="py-1.5 px-2 tabular-nums">{row.volunteers_accepted}/{row.target_volunteers}</td>
                        <td className="py-1.5 px-2 text-slate-600">{row.final_status.replace(/_/g, ' ').toLowerCase()}</td>
                        <td className="py-1.5 px-2"><Link className="text-red-700 font-semibold hover:underline" to={`/admin-portal/simulator?run=${row.run_id}`}>Open timeline</Link></td>
                      </tr>
                    );
                  }))}
                </tbody>
              </table>
            </div>
          </Panel>
          <p className="text-[11px] text-slate-500">{res.caveat}</p>
        </>
      )}
    </div>
  );
};

export default StrategyComparisonPage;
