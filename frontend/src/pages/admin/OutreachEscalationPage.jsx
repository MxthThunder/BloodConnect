import React, { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Activity, CheckCircle2, Eye, Play, ShieldAlert, XCircle } from 'lucide-react';
import { escalationApi, errorMessage } from '../../api/escalation';
import BloodGroupBadge from '../../components/BloodGroupBadge';
import ClinicalDisclaimer from '../../components/ClinicalDisclaimer';
import CandidateTable from '../../components/escalation/CandidateTable';
import {
  AssistantPanel, CaseMetrics, DecisionLog, Pipeline, RecommendationPanel, Timeline,
} from '../../components/escalation/CaseViews';
import { CaseMap } from '../../components/escalation/EscalationMap';
import {
  Alert, Button, CaseStatusBadge, Panel, RealBadge, SimBadge, SimulationBanner, UrgencyTag, fmtTime, useInterval,
} from '../../components/escalation/shared';

const ConfirmBox = ({ title, label, required, danger, busy, onConfirm, onClose }) => {
  const [text, setText] = useState('');
  return (
    <form className="rounded-xl border border-slate-300 bg-white p-4 space-y-2" onSubmit={(e) => { e.preventDefault(); onConfirm(text); }}>
      <p className="text-xs font-bold text-slate-900">{title}</p>
      <label className="block text-[11px] text-slate-600" htmlFor="confirm-text">{label}</label>
      <textarea id="confirm-text" rows={2} value={text} onChange={(e) => setText(e.target.value)} required={required}
        className="w-full text-xs px-3 py-2 rounded-lg border border-slate-300" />
      <div className="flex gap-2">
        <Button type="submit" variant={danger ? 'danger' : 'primary'} busy={busy}>Confirm</Button>
        <Button onClick={onClose}>Back</Button>
      </div>
    </form>
  );
};

const OutreachEscalationPage = () => {
  const { caseId } = useParams();
  const navigate = useNavigate();
  const [cases, setCases] = useState([]);
  const [c, setC] = useState(null);
  const [events, setEvents] = useState([]);
  const [refreshKey, setRefreshKey] = useState(0);
  const [busy, setBusy] = useState(null);
  const [error, setError] = useState('');
  const [note, setNote] = useState('');
  const [dialog, setDialog] = useState(null);

  // Case selector: live emergencies first, then fictional simulation cases.
  useEffect(() => {
    escalationApi.cases({ page_size: 100 }).then((d) => {
      setCases(d.results);
      if (!caseId && d.results.length) {
        const first = d.results.find((x) => !x.is_terminal && !x.is_simulation) || d.results[0];
        navigate(`/admin-portal/outreach/${first.id}`, { replace: true });
      }
    }).catch((err) => setError(errorMessage(err)));
  }, [caseId, navigate]);

  const load = useCallback(async (evaluate = false) => {
    if (!caseId) return;
    try {
      const [detail, tl] = await Promise.all([
        evaluate ? escalationApi.evaluate(caseId) : escalationApi.caseDetail(caseId),
        escalationApi.timeline(caseId),
      ]);
      setC(detail); setEvents(tl.results); setRefreshKey((k) => k + 1); setError('');
    } catch (err) { setError(errorMessage(err)); }
  }, [caseId]);

  useEffect(() => { setC(null); setDialog(null); setNote(''); load(false); }, [caseId, load]);

  // Time-based decisions (response windows, expiry) need a clock: evaluate while an administrator is watching.
  useInterval(() => load(true), 15000, !!c && !c.is_terminal && !c.is_simulation);

  const act = async (key, fn, ok) => {
    setBusy(key); setError(''); setNote('');
    try {
      const res = await fn();
      if (res?.evaluation) setNote(res.evaluation.reason || `Engine result: ${res.evaluation.action}`);
      else if (ok) setNote(ok);
      setDialog(null);
      await load(false);
    } catch (err) { setError(errorMessage(err)); }
    finally { setBusy(null); }
  };

  const onAction = (action) => {
    if (action === 'evaluate') return act('evaluate', () => escalationApi.evaluate(caseId));
    if (action === 'escalate') return act('escalate', () => escalationApi.escalate(caseId));
    if (action === 'review') return act('review', () => escalationApi.review(caseId, 'Reviewed from the outreach console.'), 'Review recorded.');
    if (action === 'resolve') return setDialog('resolve');
    return null;
  };

  if (!caseId && cases.length === 0) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-black text-slate-900">Outreach and Escalation</h1>
        {error && <Alert>{error}</Alert>}
        <Panel><p className="text-xs text-slate-600">No emergencies are under coordination yet. Create one in the <Link className="text-red-700 font-semibold underline" to="/admin-portal/command-center">Command Center</Link> or run the <Link className="text-violet-700 font-semibold underline" to="/admin-portal/simulator">Emergency Simulator</Link>.</p></Panel>
      </div>
    );
  }
  if (!c) return <div className="p-8 text-xs text-slate-500">{error ? <Alert>{error}</Alert> : 'Loading emergency...'}</div>;

  return (
    <div className="space-y-5">
      <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-bold text-red-700 uppercase tracking-wider">Outreach and escalation</p>
          <div className="flex flex-wrap items-center gap-2 mt-0.5">
            <h1 className="text-2xl font-black text-slate-900 tracking-tight">{c.reference}</h1>
            <BloodGroupBadge group={c.blood_group} size="md" />
            {c.is_simulation ? <SimBadge /> : <RealBadge />}
            <CaseStatusBadge status={c.status} />
          </div>
          <p className="text-xs text-slate-600 mt-1">
            {c.units_requested} unit(s) at <strong>{c.hospital_name}</strong>, {c.locality}, {c.city} - <UrgencyTag urgency={c.urgency} /> - needed by {fmtTime(c.required_by)}
            {' '}(engine stops at {fmtTime(c.expires_at)}) - search stage: <strong>{c.current_stage.name}</strong>
          </p>
        </div>
        <div className="flex flex-col items-start lg:items-end gap-2">
          <label className="text-[11px] text-slate-600 flex items-center gap-2">
            Emergency
            <select value={caseId} onChange={(e) => navigate(`/admin-portal/outreach/${e.target.value}`)}
              className="text-xs border border-slate-300 rounded-lg px-2 py-1.5 bg-white max-w-[16rem]">
              {cases.map((x) => <option key={x.id} value={x.id}>{x.reference} - {x.hospital_name} ({x.status_label}){x.is_simulation ? ' [simulation]' : ''}</option>)}
            </select>
          </label>
          {!c.is_terminal && (
            <div className="flex flex-wrap gap-2">
              <Button variant="primary" busy={busy === 'evaluate'} onClick={() => onAction('evaluate')}><Play className="w-3.5 h-3.5" aria-hidden="true" /> Run engine now</Button>
              <Button busy={busy === 'escalate'} onClick={() => onAction('escalate')} title="Approve the next batch or search expansion. Also bypasses the batch limit once.">
                <ShieldAlert className="w-3.5 h-3.5" aria-hidden="true" /> Approve next batch
              </Button>
              <Button busy={busy === 'review'} onClick={() => onAction('review')}><Eye className="w-3.5 h-3.5" aria-hidden="true" /> Mark reviewed</Button>
              <Button onClick={() => setDialog('resolve')}><CheckCircle2 className="w-3.5 h-3.5" aria-hidden="true" /> Resolve</Button>
              <Button variant="danger" onClick={() => setDialog('cancel')}><XCircle className="w-3.5 h-3.5" aria-hidden="true" /> Cancel request</Button>
            </div>
          )}
        </div>
      </div>

      {c.is_simulation ? <SimulationBanner /> : <ClinicalDisclaimer compact />}
      {error && <Alert>{error}</Alert>}
      {note && <Alert tone="info">{note}</Alert>}
      {c.is_terminal && <Alert tone="warn">This request is {c.status_label.toLowerCase()}: {c.closure_reason} No further outreach or escalation will be generated.</Alert>}
      {dialog === 'resolve' && (
        <ConfirmBox title="Resolve this emergency" required busy={busy === 'resolve'}
          label="Resolution note (for example, who at the hospital confirmed the requirement is met). Accepting volunteers alone is not a reason to resolve."
          onClose={() => setDialog(null)} onConfirm={(t) => act('resolve', () => escalationApi.resolve(caseId, t), 'Emergency resolved.')} />
      )}
      {dialog === 'cancel' && (
        <ConfirmBox title="Cancel this request" danger busy={busy === 'cancel'} label="Reason (optional). Pending alerts are withdrawn and no further outreach is generated."
          onClose={() => setDialog(null)} onConfirm={(t) => act('cancel', () => escalationApi.cancel(caseId, t), 'Request cancelled; outreach stopped.')} />
      )}

      <CaseMetrics c={c} />
      <Panel title="Outreach pipeline" icon={Activity}><Pipeline steps={c.pipeline} /></Panel>

      <div className="grid gap-5 xl:grid-cols-5">
        <div className="xl:col-span-3 space-y-5 min-w-0">
          <RecommendationPanel c={c} busy={busy} onAction={onAction} />
          <CandidateTable caseId={caseId} isTerminal={c.is_terminal} refreshKey={refreshKey} onChanged={() => load(false)} />
          <DecisionLog events={events} />
        </div>
        <div className="xl:col-span-2 space-y-5 min-w-0">
          <Panel title="Live event timeline" icon={Activity}>
            <Timeline events={events} simStart={c.simulation?.sim_start} />
          </Panel>
          <CaseMap caseId={caseId} refreshKey={refreshKey} />
          <AssistantPanel caseId={caseId} refreshKey={refreshKey} />
        </div>
      </div>
    </div>
  );
};

export default OutreachEscalationPage;
