import React, { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Plus, RefreshCw, Radio, ArrowRight, FlaskConical } from 'lucide-react';
import apiClient from '../../api/client';
import { escalationApi, errorMessage } from '../../api/escalation';
import BloodGroupBadge from '../../components/BloodGroupBadge';
import ClinicalDisclaimer from '../../components/ClinicalDisclaimer';
import { OverviewMap } from '../../components/escalation/EscalationMap';
import {
  Alert, Button, CaseStatusBadge, Metric, Panel, RealBadge, SimBadge, UrgencyTag, fmtTime, useInterval,
} from '../../components/escalation/shared';
import { CHENNAI_HOSPITALS, CHENNAI_LOCALITIES } from '../../constants/chennaiData';

const BLOOD_GROUPS = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];
const COMPONENTS = ['Whole Blood', 'Packed Red Blood Cells', 'Platelets', 'Fresh Frozen Plasma', 'Cryoprecipitate'];
const URGENCY_HOURS = { CRITICAL: 2, URGENT: 6, STANDARD: 24 };

const NewEmergencyForm = ({ onCreated, onCancel }) => {
  const [form, setForm] = useState({
    blood_group: 'O+', component: 'Whole Blood', units_requested: 2, hospital: CHENNAI_HOSPITALS[3].name,
    locality: CHENNAI_HOSPITALS[3].locality, urgency: 'CRITICAL', contact_phone: '+91 94440 10001', reason: '',
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const pickHospital = (e) => {
    const h = CHENNAI_HOSPITALS.find((x) => x.name === e.target.value);
    setForm((f) => ({ ...f, hospital: e.target.value, locality: h ? h.locality : f.locality }));
  };

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true); setError('');
    const h = CHENNAI_HOSPITALS.find((x) => x.name === form.hospital);
    try {
      const res = await escalationApi.createEmergency({
        blood_group: form.blood_group, component: form.component, units_requested: Number(form.units_requested),
        hospital_name: form.hospital, hospital_address: h ? h.address : `${form.hospital}, ${form.locality}, Chennai`,
        city: 'Chennai', locality: form.locality, hospital_lat: h?.lat ?? null, hospital_lng: h?.lng ?? null,
        urgency: form.urgency, required_by: new Date(Date.now() + URGENCY_HOURS[form.urgency] * 3600 * 1000).toISOString(),
        contact_phone: form.contact_phone, contact_preference: 'hospital_desk', reason: form.reason,
      });
      onCreated(res.case);
    } catch (err) {
      setError(errorMessage(err));
    } finally { setBusy(false); }
  };

  const field = 'w-full px-3 py-2 rounded-lg border border-slate-300 bg-white text-xs';
  const label = 'block text-[11px] font-semibold text-slate-700 mb-1';
  return (
    <Panel title="New emergency request" icon={Plus}>
      <form onSubmit={submit} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div><label className={label} htmlFor="ne-bg">Blood group</label>
          <select id="ne-bg" className={field} value={form.blood_group} onChange={set('blood_group')}>{BLOOD_GROUPS.map((g) => <option key={g}>{g}</option>)}</select></div>
        <div><label className={label} htmlFor="ne-comp">Component</label>
          <select id="ne-comp" className={field} value={form.component} onChange={set('component')}>{COMPONENTS.map((g) => <option key={g}>{g}</option>)}</select></div>
        <div><label className={label} htmlFor="ne-units">Units needed</label>
          <input id="ne-units" type="number" min="1" max="50" className={field} value={form.units_requested} onChange={set('units_requested')} required /></div>
        <div><label className={label} htmlFor="ne-urg">Urgency (sets the required time)</label>
          <select id="ne-urg" className={field} value={form.urgency} onChange={set('urgency')}>
            <option value="CRITICAL">Critical - within 2 hours</option><option value="URGENT">Urgent - within 6 hours</option><option value="STANDARD">Standard - within 24 hours</option>
          </select></div>
        <div className="sm:col-span-2"><label className={label} htmlFor="ne-hosp">Hospital / collection location</label>
          <select id="ne-hosp" className={field} value={form.hospital} onChange={pickHospital}>{CHENNAI_HOSPITALS.map((h) => <option key={h.name}>{h.name}</option>)}</select></div>
        <div><label className={label} htmlFor="ne-loc">Locality</label>
          <select id="ne-loc" className={field} value={form.locality} onChange={set('locality')}>{CHENNAI_LOCALITIES.map((l) => <option key={l}>{l}</option>)}</select></div>
        <div><label className={label} htmlFor="ne-phone">Hospital desk contact</label>
          <input id="ne-phone" className={field} value={form.contact_phone} onChange={set('contact_phone')} required /></div>
        <div className="sm:col-span-2 lg:col-span-4"><label className={label} htmlFor="ne-reason">Clinical context (optional, no patient identifiers)</label>
          <input id="ne-reason" className={field} value={form.reason} onChange={set('reason')} maxLength={200} /></div>
        {error && <div className="sm:col-span-2 lg:col-span-4"><Alert>{error}</Alert></div>}
        <div className="sm:col-span-2 lg:col-span-4 flex items-center gap-2">
          <Button type="submit" variant="primary" busy={busy}>Create, verify and start coordination</Button>
          <Button onClick={onCancel}>Cancel</Button>
          <span className="text-[11px] text-slate-500">Creating as an administrator marks the request verified and immediately ranks and alerts the first batch.</span>
        </div>
      </form>
    </Panel>
  );
};

const CommandCenterPage = () => {
  const navigate = useNavigate();
  const [overview, setOverview] = useState(null);
  const [unmanaged, setUnmanaged] = useState([]);
  const [showSim, setShowSim] = useState(false);
  const [auto, setAuto] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [busy, setBusy] = useState(null);
  const [error, setError] = useState('');
  const [note, setNote] = useState('');

  const load = useCallback(async () => {
    try {
      const data = await escalationApi.overview(showSim);
      setOverview(data);
      const known = new Set([...data.cases, ...data.recently_closed].map((c) => c.blood_request_id).filter(Boolean));
      const reqs = await apiClient.get('/requests/', { params: { verification: 'APPROVED' } });
      const list = Array.isArray(reqs.data) ? reqs.data : reqs.data.results || [];
      setUnmanaged(list.filter((r) => !known.has(r.id) && ['ACTIVE_ALERTS_SENT', 'DONOR_RESPONDED', 'MATCHING'].includes(r.request_status)));
      setError('');
    } catch (err) { setError(errorMessage(err, 'Could not load the command center.')); }
  }, [showSim]);

  useEffect(() => { load(); }, [load]);

  // Without a background worker the page asks the engine to re-evaluate open emergencies.
  const tick = useCallback(async () => {
    try { await escalationApi.evaluateActive(); } catch { /* shown on next load if persistent */ }
    await load();
  }, [load]);
  useInterval(tick, 30000, auto);

  const run = async (key, fn, okMsg) => {
    setBusy(key); setError(''); setNote('');
    try { await fn(); if (okMsg) setNote(okMsg); await load(); }
    catch (err) { setError(errorMessage(err)); }
    finally { setBusy(null); }
  };

  const k = overview?.kpis;
  return (
    <div className="space-y-5">
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-3">
        <div>
          <p className="text-[11px] font-bold text-red-700 uppercase tracking-wider">Emergency operations</p>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">Emergency Command Center</h1>
          <p className="text-xs text-slate-600 mt-1 max-w-3xl">
            Live emergencies under adaptive escalation. The engine ranks candidates, alerts them in batches, tracks every response and widens the search only when the recorded state calls for it.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <label className="flex items-center gap-1.5 text-[11px] text-slate-700">
            <input type="checkbox" checked={showSim} onChange={(e) => setShowSim(e.target.checked)} /> Include fictional simulations
          </label>
          <label className="flex items-center gap-1.5 text-[11px] text-slate-700">
            <input type="checkbox" checked={auto} onChange={(e) => setAuto(e.target.checked)} /> Auto-evaluate every 30 s
          </label>
          <Button busy={busy === 'eval'} onClick={() => run('eval', escalationApi.evaluateActive, 'Engine evaluated every open emergency.')}>
            <RefreshCw className="w-3.5 h-3.5" aria-hidden="true" /> Evaluate all now
          </Button>
          <Button variant="primary" onClick={() => setShowForm((s) => !s)}><Plus className="w-3.5 h-3.5" aria-hidden="true" /> New emergency</Button>
        </div>
      </div>

      <ClinicalDisclaimer compact />
      {error && <Alert>{error}</Alert>}
      {note && <Alert tone="info">{note}</Alert>}
      {showForm && <NewEmergencyForm onCancel={() => setShowForm(false)} onCreated={(c) => navigate(`/admin-portal/outreach/${c.id}`)} />}

      {k && (
        <div className="bg-white border border-slate-200 rounded-xl grid grid-cols-2 sm:flex sm:flex-wrap sm:divide-x divide-slate-200">
          <Metric label="Active emergencies" value={k.active_emergencies} />
          <Metric label="Need your attention" value={k.needs_intervention} hint="intervention or approval" tone={k.needs_intervention ? 'alert' : undefined} />
          <Metric label="Volunteers accepted" value={k.accepted_volunteers} hint="not confirmed units" />
          <Metric label="Remaining coordination need" value={k.remaining_coordination_need} hint="volunteers still needed" />
          <Metric label="Alerts awaiting response" value={k.alerts_awaiting_response} />
        </div>
      )}

      <Panel title="Active emergencies" icon={Radio} bodyClass="p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <caption className="sr-only">Active emergencies with outreach and response counts</caption>
            <thead className="bg-slate-50 text-slate-600 text-[10px] uppercase tracking-wider">
              <tr>
                <th className="py-2 px-3">Request</th><th className="py-2 px-2">Group</th><th className="py-2 px-2">Units</th>
                <th className="py-2 px-2">Hospital / location</th><th className="py-2 px-2">Urgency</th><th className="py-2 px-2">Created</th>
                <th className="py-2 px-2">Status</th><th className="py-2 px-2 text-right">Potential candidates</th>
                <th className="py-2 px-2 text-right">Outreach attempts</th><th className="py-2 px-2 text-right">Volunteers accepted</th>
                <th className="py-2 px-2 text-right">Remaining need</th><th className="py-2 px-2"><span className="sr-only">Open</span></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {!overview && <tr><td colSpan={12} className="p-8 text-center text-slate-500">Loading...</td></tr>}
              {overview && overview.cases.length === 0 && (
                <tr><td colSpan={12} className="p-8 text-center text-slate-500">
                  No emergencies are under coordination. Create one above, approve a request in the Verification Queue, or try the Emergency Simulator.
                </td></tr>
              )}
              {overview?.cases.map((c) => (
                <tr key={c.id} className="hover:bg-slate-50/70">
                  <td className="py-2.5 px-3 font-bold text-slate-900 whitespace-nowrap">
                    {c.reference} <span className="ml-1 align-middle">{c.is_simulation ? <SimBadge /> : <RealBadge />}</span>
                  </td>
                  <td className="py-2.5 px-2"><BloodGroupBadge group={c.blood_group} size="sm" /></td>
                  <td className="py-2.5 px-2 tabular-nums">{c.units_requested}</td>
                  <td className="py-2.5 px-2"><div className="font-medium text-slate-800">{c.hospital_name}</div><div className="text-[11px] text-slate-500">{c.locality}, {c.city}</div></td>
                  <td className="py-2.5 px-2"><UrgencyTag urgency={c.urgency} /></td>
                  <td className="py-2.5 px-2 text-slate-600 whitespace-nowrap">{fmtTime(c.created_at)}</td>
                  <td className="py-2.5 px-2"><CaseStatusBadge status={c.status} /><div className="text-[10px] text-slate-500 mt-0.5">{c.current_stage.name}</div></td>
                  <td className="py-2.5 px-2 text-right tabular-nums">{c.potential_candidates}</td>
                  <td className="py-2.5 px-2 text-right tabular-nums">{c.counts.outreach_attempts}</td>
                  <td className="py-2.5 px-2 text-right tabular-nums">{c.counts.accepted_volunteers} <span className="text-slate-400">/ {c.target_volunteers}</span></td>
                  <td className={`py-2.5 px-2 text-right tabular-nums font-bold ${c.remaining_coordination_need ? 'text-red-700' : 'text-emerald-700'}`}>{c.remaining_coordination_need}</td>
                  <td className="py-2.5 px-2 text-right">
                    <Link to={`/admin-portal/outreach/${c.id}`} className="inline-flex items-center gap-1 text-[11px] font-semibold text-red-700 hover:underline">
                      Open <ArrowRight className="w-3 h-3" aria-hidden="true" />
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="px-4 py-2 text-[10px] text-slate-500 border-t border-slate-100">
          "Volunteers accepted" counts people who said yes. It is not a count of confirmed donations or blood units: donor eligibility and transfusion compatibility are decided by qualified blood-bank staff. "Remaining need" = target volunteers (units x volunteers per unit) minus accepted volunteers.
        </p>
      </Panel>

      {unmanaged.length > 0 && (
        <Panel title={`Approved requests not yet under the escalation engine (${unmanaged.length})`} bodyClass="p-0">
          <ul className="divide-y divide-slate-100">
            {unmanaged.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 text-xs">
                <span><strong>{r.reference_number}</strong> - {r.units_requested} unit(s) {r.blood_group} at {r.hospital_name}, {r.locality}
                  <span className="text-slate-500"> (already alerted before the engine existed; those alerts are imported, never repeated)</span></span>
                <Button busy={busy === `s${r.id}`} onClick={() => run(`s${r.id}`, () => escalationApi.startCase(r.id), `Coordination started for ${r.reference_number}.`)}>
                  Start coordination
                </Button>
              </li>
            ))}
          </ul>
        </Panel>
      )}

      <div className="grid gap-5 lg:grid-cols-3">
        <div className="lg:col-span-2">{overview && <OverviewMap markers={overview.markers} />}</div>
        <Panel title="Recently closed" bodyClass="p-0">
          {overview?.recently_closed.length ? (
            <ul className="divide-y divide-slate-100">
              {overview.recently_closed.map((c) => (
                <li key={c.id} className="px-4 py-2.5 text-xs">
                  <Link to={`/admin-portal/outreach/${c.id}`} className="font-bold text-slate-900 hover:underline">{c.reference}</Link>
                  <span className="ml-2"><CaseStatusBadge status={c.status} /></span>
                  <p className="text-[11px] text-slate-500 mt-0.5">{c.closure_reason}</p>
                </li>
              ))}
            </ul>
          ) : <p className="p-4 text-xs text-slate-500">Nothing closed yet.</p>}
          <div className="p-3 border-t border-slate-100">
            <Link to="/admin-portal/simulator" className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-violet-700 hover:underline">
              <FlaskConical className="w-3.5 h-3.5" aria-hidden="true" /> Open the Emergency Simulator
            </Link>
          </div>
        </Panel>
      </div>
    </div>
  );
};

export default CommandCenterPage;
