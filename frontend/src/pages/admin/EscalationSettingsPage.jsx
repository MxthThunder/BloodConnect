import React, { useEffect, useState } from 'react';
import { Plus, RotateCcw, Save, Settings2, Trash2 } from 'lucide-react';
import { escalationApi, errorMessage } from '../../api/escalation';
import { Alert, Button, Panel, fmtTime } from '../../components/escalation/shared';

const URGENCIES = ['CRITICAL', 'URGENT', 'STANDARD'];
const WEIGHT_LABELS = {
  proximity: 'Proximity to the request',
  group_match: 'Blood-group criteria match',
  verified_profile: 'Profile verified by blood bank',
  availability_freshness: 'Freshness of declared availability',
};

const inputCls = 'w-full text-xs border border-slate-300 rounded-lg px-2.5 py-1.5 bg-white';
const Field = ({ id, label, hint, children }) => (
  <div>
    <label htmlFor={id} className="block text-[11px] font-semibold text-slate-700 mb-1">{label}</label>
    {children}
    {hint && <p className="text-[10px] text-slate-500 mt-1 leading-snug">{hint}</p>}
  </div>
);

const EscalationSettingsPage = () => {
  const [data, setData] = useState(null);
  const [cfg, setCfg] = useState(null);
  const [busy, setBusy] = useState(null);
  const [error, setError] = useState('');
  const [note, setNote] = useState('');

  const load = async () => {
    try { const d = await escalationApi.policy(); setData(d); setCfg(d.config); }
    catch (err) { setError(errorMessage(err)); }
  };
  useEffect(() => { load(); }, []);

  const set = (key, value) => setCfg((c) => ({ ...c, [key]: value }));
  const setNested = (key, sub, value) => setCfg((c) => ({ ...c, [key]: { ...c[key], [sub]: value } }));
  const setStage = (i, patch) => setCfg((c) => ({ ...c, stages: c.stages.map((s, j) => (j === i ? { ...s, ...patch } : s)) }));

  const addStage = () => setCfg((c) => {
    const finite = c.stages.map((s) => Number(s.radius_km)).filter((r) => r > 0);
    const widest = finite.length ? Math.max(...finite) : 10;
    // only the last stage may be unlimited, so give the old last stage a radius if it had none
    const stages = c.stages.map((s, i) => (i === c.stages.length - 1 && s.radius_km == null ? { ...s, radius_km: widest + 10 } : s));
    return { ...c, stages: [...stages, { name: `Stage ${stages.length + 1}`, radius_km: null, fallback_scope: 'CITY', max_batch_size: 20 }] };
  });

  const save = async () => {
    setBusy('save'); setError(''); setNote('');
    try { const r = await escalationApi.savePolicy(cfg); setCfg(r.config); setNote('Policy saved. It applies to live emergencies from their next evaluation and to new simulations.'); await load(); }
    catch (err) { setError(errorMessage(err)); }
    finally { setBusy(null); }
  };
  const reset = async () => {
    if (!window.confirm('Reset every escalation setting to its default?')) return;
    setBusy('reset'); setError(''); setNote('');
    try { const r = await escalationApi.resetPolicy(); setCfg(r.config); setNote('Policy reset to defaults.'); await load(); }
    catch (err) { setError(errorMessage(err)); }
    finally { setBusy(null); }
  };

  if (!cfg) return <div className="p-8 text-xs text-slate-500">{error ? <Alert>{error}</Alert> : 'Loading settings...'}</div>;
  const weightTotal = Object.values(cfg.weights).reduce((a, b) => a + Number(b || 0), 0);

  return (
    <div className="space-y-5 max-w-6xl">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[11px] font-bold text-red-700 uppercase tracking-wider">Admin settings</p>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">Escalation policy</h1>
          <p className="text-xs text-slate-600 mt-1 max-w-3xl">Every threshold the escalation engine uses is configured here. Changes are validated, written to the audit log and used by the engine on its next evaluation.
            {data?.updated_at && ` Last saved ${fmtTime(data.updated_at)}${data.updated_by ? ` by ${data.updated_by}` : ''}.`}</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={reset} busy={busy === 'reset'}><RotateCcw className="w-3.5 h-3.5" aria-hidden="true" /> Reset to defaults</Button>
          <Button variant="primary" onClick={save} busy={busy === 'save'}><Save className="w-3.5 h-3.5" aria-hidden="true" /> Save policy</Button>
        </div>
      </div>
      {error && <Alert>{error}</Alert>}
      {note && <Alert tone="info">{note}</Alert>}

      <Panel title="Coordination target and response model" icon={Settings2}>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Field id="p-vpu" label="Volunteers needed per unit" hint="Target volunteers = units requested x this. A buffer, because hospital screening may defer some. Volunteers are not blood units.">
            <input id="p-vpu" type="number" min="1" max="10" className={inputCls} value={cfg.volunteers_per_unit} onChange={(e) => set('volunteers_per_unit', e.target.value)} />
          </Field>
          <Field id="p-rate" label="Assumed acceptance rate per alert (0-1)" hint="Prior belief used to size the first batch. Replaced by observed outcomes as responses arrive.">
            <input id="p-rate" type="number" step="0.05" min="0.02" max="1" className={inputCls} value={cfg.assumed_response_rate} onChange={(e) => set('assumed_response_rate', e.target.value)} />
          </Field>
          <Field id="p-pw" label="Prior weight (virtual alerts)" hint="How strongly the assumed rate resists early evidence. 0 = use observations only.">
            <input id="p-pw" type="number" min="0" max="100" className={inputCls} value={cfg.prior_weight} onChange={(e) => set('prior_weight', e.target.value)} />
          </Field>
          <Field id="p-mb" label="Maximum batches per emergency" hint="Past this the engine asks an administrator to approve more.">
            <input id="p-mb" type="number" min="1" max="50" className={inputCls} value={cfg.max_batches} onChange={(e) => set('max_batches', e.target.value)} />
          </Field>
          <Field id="p-grace" label="Expiry grace (minutes after required time)" hint="After this the request expires and all outreach stops.">
            <input id="p-grace" type="number" min="0" className={inputCls} value={cfg.expiry_grace_minutes} onChange={(e) => set('expiry_grace_minutes', e.target.value)} />
          </Field>
          <Field id="p-fixed" label="Fixed strategy interval (minutes)" hint="Used only by the baseline fixed-escalation strategy in simulations.">
            <input id="p-fixed" type="number" min="1" className={inputCls} value={cfg.fixed_interval_minutes} onChange={(e) => set('fixed_interval_minutes', e.target.value)} />
          </Field>
          <Field id="p-tick" label="Simulator step (simulated minutes)">
            <input id="p-tick" type="number" min="1" max="30" className={inputCls} value={cfg.sim_tick_minutes} onChange={(e) => set('sim_tick_minutes', e.target.value)} />
          </Field>
          <div className="space-y-2 pt-5">
            <label className="flex items-start gap-2 text-xs text-slate-700"><input type="checkbox" className="mt-0.5" checked={cfg.auto_escalate} onChange={(e) => set('auto_escalate', e.target.checked)} />
              <span>Escalate automatically<span className="block text-[10px] text-slate-500">Off: widening the search waits for an administrator to approve.</span></span></label>
            <label className="flex items-start gap-2 text-xs text-slate-700"><input type="checkbox" className="mt-0.5" checked={cfg.allow_reminders} onChange={(e) => set('allow_reminders', e.target.checked)} />
              <span>Allow one reminder<span className="block text-[10px] text-slate-500">Donors who never answered may be alerted again in a later stage.</span></span></label>
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 mt-5">
          <fieldset>
            <legend className="text-[11px] font-bold text-slate-800 mb-2">Response window (minutes before "no response - status unknown")</legend>
            <div className="grid grid-cols-3 gap-2">
              {URGENCIES.map((u) => <Field key={u} id={`w-${u}`} label={u}><input id={`w-${u}`} type="number" min="1" className={inputCls} value={cfg.response_wait_minutes[u]} onChange={(e) => setNested('response_wait_minutes', u, e.target.value)} /></Field>)}
            </div>
          </fieldset>
          <fieldset>
            <legend className="text-[11px] font-bold text-slate-800 mb-2">Minimum gap between batches (minutes)</legend>
            <div className="grid grid-cols-3 gap-2">
              {URGENCIES.map((u) => <Field key={u} id={`g-${u}`} label={u}><input id={`g-${u}`} type="number" min="0" className={inputCls} value={cfg.min_batch_gap_minutes[u]} onChange={(e) => setNested('min_batch_gap_minutes', u, e.target.value)} /></Field>)}
            </div>
          </fieldset>
        </div>
      </Panel>

      <Panel title="Search stages (each includes the stages inside it)" bodyClass="p-0"
        actions={<Button onClick={addStage}
          disabled={cfg.stages.length >= 8}><Plus className="w-3.5 h-3.5" aria-hidden="true" /> Add stage</Button>}>
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <caption className="sr-only">Configurable search stages</caption>
            <thead className="bg-slate-50 text-slate-600 text-[10px] uppercase tracking-wider">
              <tr><th className="py-2 px-4">Name</th><th className="py-2 px-2">Radius (km)</th><th className="py-2 px-2">When distance is unknown, match by</th><th className="py-2 px-2">Max alerts per batch</th><th className="py-2 px-2"><span className="sr-only">Remove</span></th></tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {cfg.stages.map((s, i) => (
                <tr key={i}>
                  <td className="py-2 px-4"><input aria-label={`Stage ${i + 1} name`} className={inputCls} value={s.name} onChange={(e) => setStage(i, { name: e.target.value })} /></td>
                  <td className="py-2 px-2 w-36"><input aria-label={`Stage ${i + 1} radius in km`} className={inputCls} type="number" min="0.5" step="0.5" placeholder="no limit" value={s.radius_km ?? ''}
                    onChange={(e) => setStage(i, { radius_km: e.target.value === '' ? null : e.target.value })} /></td>
                  <td className="py-2 px-2 w-44"><select aria-label={`Stage ${i + 1} fallback`} className={inputCls} value={s.fallback_scope} onChange={(e) => setStage(i, { fallback_scope: e.target.value })}>
                    <option value="LOCALITY">Same locality only</option><option value="CITY">Same city</option></select></td>
                  <td className="py-2 px-2 w-36"><input aria-label={`Stage ${i + 1} max batch size`} className={inputCls} type="number" min="1" value={s.max_batch_size} onChange={(e) => setStage(i, { max_batch_size: e.target.value })} /></td>
                  <td className="py-2 px-2 text-right"><Button variant="quiet" disabled={cfg.stages.length <= 1} onClick={() => setCfg((c) => ({ ...c, stages: c.stages.filter((_, j) => j !== i) }))} title="Remove stage"><Trash2 className="w-3.5 h-3.5" aria-hidden="true" /><span className="sr-only">Remove stage {i + 1}</span></Button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="px-4 py-2.5 text-[10px] text-slate-500 border-t border-slate-100">
          Radii must not decrease, and only the last stage may have no limit. Distances come only from real coordinates; a donor without coordinates is placed by locality or city, never by an invented distance.
        </p>
      </Panel>

      <Panel title="Candidate prioritisation weights">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Object.keys(WEIGHT_LABELS).map((k) => (
            <Field key={k} id={`wt-${k}`} label={WEIGHT_LABELS[k]}>
              <input id={`wt-${k}`} type="number" min="0" max="100" className={inputCls} value={cfg.weights[k]} onChange={(e) => setNested('weights', k, e.target.value)} />
            </Field>
          ))}
        </div>
        <p className="text-[11px] text-slate-600 mt-3">
          Total weight {weightTotal} = 100% of a candidate's score; each criterion contributes its share. A donor's past response behaviour is deliberately not a criterion, and blood-group matching is a matching rule, not a transfusion-compatibility decision.
        </p>
      </Panel>
    </div>
  );
};

export default EscalationSettingsPage;
