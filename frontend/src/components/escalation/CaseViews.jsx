import React, { useEffect, useState } from 'react';
import {
  Activity, CheckCircle2, Circle, CircleDot, HelpCircle, Lightbulb, ListChecks, MessageSquareText, Send,
} from 'lucide-react';
import { escalationApi, errorMessage } from '../../api/escalation';
import { Alert, Button, Metric, Panel, fmtClock, fmtTime } from './shared';

/* ---------------------------------------------------------------- metrics */
export const CaseMetrics = ({ c }) => (
  <div className="bg-white border border-slate-200 rounded-xl grid grid-cols-2 sm:flex sm:flex-wrap divide-slate-200 sm:divide-x">
    <Metric label="Potential candidates" value={c.potential_candidates} hint="pass eligibility rules" />
    <Metric label="Outreach attempts" value={c.counts.outreach_attempts} hint={`${c.batches} batch(es)`} />
    <Metric label="Volunteers accepted" value={`${c.counts.accepted_volunteers}/${c.target_volunteers}`} hint="not confirmed units" tone="good" />
    <Metric label="Remaining coordination need" value={c.remaining_coordination_need} hint="volunteers still needed" tone={c.remaining_coordination_need > 0 ? 'alert' : 'good'} />
    <Metric label="Awaiting response" value={c.counts.alerts_awaiting_response} hint="inside response window" />
    <Metric label="Declined" value={c.counts.declined} />
    <Metric label="No response" value={c.counts.no_response} hint="status unknown" />
    <Metric label="Hospital verification" value={c.counts.hospital_verification_pending} hint="pending" />
    <Metric label="Donations confirmed" value={c.counts.donations_confirmed} hint="by hospital" />
  </div>
);

/* ---------------------------------------------------------------- pipeline */
export const Pipeline = ({ steps }) => (
  <ol className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-7 gap-2" aria-label="Outreach pipeline">
    {steps.map((s, i) => {
      const Icon = s.state === 'done' ? CheckCircle2 : s.state === 'current' ? CircleDot : Circle;
      const tone = s.state === 'done' ? 'border-emerald-300 bg-emerald-50/60' : s.state === 'current' ? 'border-red-400 bg-red-50' : 'border-slate-200 bg-white';
      const iconTone = s.state === 'done' ? 'text-emerald-600' : s.state === 'current' ? 'text-red-700' : 'text-slate-400';
      return (
        <li key={s.key} className={`rounded-lg border px-3 py-2 ${tone}`} aria-current={s.state === 'current' ? 'step' : undefined}>
          <div className="flex items-center gap-1.5">
            <Icon className={`w-4 h-4 shrink-0 ${iconTone}`} aria-hidden="true" />
            <span className="text-[11px] font-bold text-slate-800 leading-tight">{i + 1}. {s.label}</span>
          </div>
          <p className="text-[11px] text-slate-600 mt-1 leading-snug">
            <span className="sr-only">{s.state}. </span>{s.detail}
          </p>
        </li>
      );
    })}
  </ol>
);

/* ---------------------------------------------------------------- timeline */
const EVENT_TONE = {
  CANDIDATE_ACCEPTED: 'bg-emerald-500', VOLUNTEERS_SECURED: 'bg-emerald-600', REQUEST_RESOLVED: 'bg-emerald-700',
  CANDIDATE_DECLINED: 'bg-rose-400', REQUEST_CANCELLED: 'bg-slate-600', REQUEST_EXPIRED: 'bg-slate-600',
  ESCALATION_TRIGGERED: 'bg-amber-500', SEARCH_EXPANDED: 'bg-amber-600', AWAITING_ESCALATION: 'bg-amber-500',
  ADMIN_INTERVENTION_REQUIRED: 'bg-red-600', RESPONSE_WINDOW_ELAPSED: 'bg-amber-400',
  BATCH_CREATED: 'bg-blue-500', OUTREACH_INITIATED: 'bg-blue-400', ADMIN_REVIEWED: 'bg-violet-500',
  FULFILMENT_UPDATED: 'bg-violet-500', SIMULATION: 'bg-violet-400', ENGINE_HOLD: 'bg-slate-300',
};

export const Timeline = ({ events, simStart, maxHeight = '28rem' }) => {
  if (!events?.length) return <p className="text-xs text-slate-500">No events recorded yet.</p>;
  const rows = [...events].reverse();
  return (
    <ol className="space-y-0 overflow-y-auto pr-1" style={{ maxHeight }} aria-label="Event timeline, newest first">
      {rows.map((e) => {
        const rel = simStart ? Math.round((new Date(e.time) - new Date(simStart)) / 60000) : null;
        return (
          <li key={e.id} className="relative pl-5 pb-3 border-l border-slate-200 ml-1.5">
            <span className={`absolute -left-[5px] top-1 w-2.5 h-2.5 rounded-full ${EVENT_TONE[e.type] || 'bg-slate-400'}`} aria-hidden="true" />
            <div className="flex flex-wrap items-baseline gap-x-2">
              <span className="text-[11px] font-bold text-slate-800">{e.type_label}</span>
              <time className="text-[10px] text-slate-500 tabular-nums" dateTime={e.time}>
                {rel !== null ? `T+${rel} min (${fmtClock(e.time)})` : fmtTime(e.time)}
              </time>
              {e.actor && <span className="text-[10px] text-violet-700">by {e.actor}</span>}
            </div>
            <p className="text-xs text-slate-600 leading-snug mt-0.5">{e.message}</p>
          </li>
        );
      })}
    </ol>
  );
};

/* ---------------------------------------------------------------- required action panel */
export const RecommendationPanel = ({ c, busy, onAction }) => {
  const last = c.last_decision;
  return (
    <Panel title="Required action" icon={ListChecks}>
      <div className="space-y-3">
        {last?.reason && (
          <div className="rounded-lg bg-slate-50 border border-slate-200 px-3 py-2">
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Why the request is in this state</p>
            <p className="text-xs text-slate-800 mt-0.5">{last.reason}</p>
          </div>
        )}
        <ul className="space-y-2">
          {c.recommendations.map((r) => (
            <li key={r.code} className="flex items-start justify-between gap-3 rounded-lg border border-slate-200 px-3 py-2">
              <div className="min-w-0">
                <p className={`text-xs font-bold ${r.severity === 'high' ? 'text-red-700' : 'text-slate-900'}`}>{r.title}</p>
                <p className="text-[11px] text-slate-600 mt-0.5 leading-snug">{r.reason}</p>
              </div>
              {r.action && r.action !== 'fulfilment' && !c.is_terminal && (
                <Button variant={r.severity === 'high' ? 'primary' : 'secondary'} busy={busy === r.action} onClick={() => onAction(r.action)}>
                  {{ evaluate: 'Run engine now', escalate: 'Approve', review: 'Mark reviewed', resolve: 'Resolve...' }[r.action] || 'Do it'}
                </Button>
              )}
            </li>
          ))}
        </ul>
        {c.unknowns?.length > 0 && (
          <details className="text-xs">
            <summary className="cursor-pointer font-semibold text-slate-700 flex items-center gap-1.5">
              <HelpCircle className="w-3.5 h-3.5 inline" aria-hidden="true" /> Unknown / unconfirmed ({c.unknowns.length})
            </summary>
            <ul className="list-disc pl-5 mt-1.5 space-y-1 text-slate-600">
              {c.unknowns.map((u) => <li key={u}>{u}</li>)}
            </ul>
          </details>
        )}
      </div>
    </Panel>
  );
};

/* ---------------------------------------------------------------- decision support */
const Section = ({ title, items, tone }) => !items?.length ? null : (
  <div>
    <p className={`text-[10px] font-bold uppercase tracking-wider ${tone}`}>{title}</p>
    <ul className="list-disc pl-4 mt-1 space-y-1 text-xs text-slate-700">
      {items.map((t, i) => <li key={i}>{t}</li>)}
    </ul>
  </div>
);

export const AssistantAnswer = ({ answer }) => (
  <div className="space-y-3">
    <p className="text-sm font-semibold text-slate-900">{answer.headline}</p>
    <Section title="Known facts (from recorded data)" items={answer.known_facts} tone="text-emerald-700" />
    <Section title="Unknown or unconfirmed" items={answer.unknowns} tone="text-amber-700" />
    <Section title="Rules applied" items={answer.rules_applied} tone="text-blue-700" />
    <Section title="Suggestions" items={answer.suggestions} tone="text-violet-700" />
    <p className="text-[10px] text-slate-500 border-t border-slate-100 pt-2">{answer.generated_by}. {answer.disclaimer}</p>
  </div>
);

export const AssistantPanel = ({ caseId, refreshKey }) => {
  const [questions, setQuestions] = useState([]);
  const [answer, setAnswer] = useState(null);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [lastBody, setLastBody] = useState(null);

  useEffect(() => { escalationApi.questions().then((d) => setQuestions(d.questions)).catch(() => {}); }, []);

  const ask = async (body) => {
    setBusy(true); setError(''); setLastBody(body);
    try { setAnswer(await escalationApi.ask(caseId, body)); }
    catch (err) { setError(errorMessage(err)); }
    finally { setBusy(false); }
  };

  // Keep an open answer in step with the latest backend state.
  useEffect(() => { if (lastBody && refreshKey) ask(lastBody); /* eslint-disable-next-line */ }, [refreshKey]);
  useEffect(() => { setAnswer(null); setLastBody(null); }, [caseId]);

  return (
    <Panel title="Decision support" icon={MessageSquareText}>
      <p className="text-[11px] text-slate-500 mb-3">
        Answers are generated by rules from this request's recorded state. No external AI service is used, and nothing here is a medical judgement.
      </p>
      <div className="flex flex-wrap gap-1.5 mb-3">
        {questions.filter((q) => q.key !== 'strategy_comparison' || true).map((q) => (
          <button key={q.key} type="button" onClick={() => ask({ intent: q.key })}
            className="text-[11px] px-2 py-1 rounded-md border border-slate-300 bg-white hover:bg-slate-100 text-left">
            {q.label}
          </button>
        ))}
      </div>
      <form className="flex gap-2 mb-3" onSubmit={(e) => { e.preventDefault(); if (text.trim()) ask({ question: text.trim() }); }}>
        <label className="sr-only" htmlFor="assistant-question">Ask about this request</label>
        <input id="assistant-question" value={text} onChange={(e) => setText(e.target.value)} placeholder="Ask about this request..."
          className="flex-1 min-w-0 px-3 py-1.5 text-xs rounded-lg border border-slate-300 bg-white" />
        <Button type="submit" variant="primary" busy={busy}><Send className="w-3.5 h-3.5" aria-hidden="true" /> Ask</Button>
      </form>
      {error && <Alert>{error}</Alert>}
      {answer ? <AssistantAnswer answer={answer} /> : (
        <p className="text-xs text-slate-500 flex items-center gap-1.5"><Lightbulb className="w-3.5 h-3.5" aria-hidden="true" /> Pick a question to see an explanation built from live data.</p>
      )}
    </Panel>
  );
};

export const DecisionLog = ({ events }) => {
  const decisions = (events || []).filter((e) => ['BATCH_CREATED', 'ESCALATION_TRIGGERED', 'SEARCH_EXPANDED', 'ENGINE_HOLD', 'AWAITING_ESCALATION',
    'ADMIN_INTERVENTION_REQUIRED', 'VOLUNTEERS_SECURED', 'NEED_REOPENED', 'RESPONSE_WINDOW_ELAPSED'].includes(e.type));
  return (
    <Panel title="Escalation decisions" icon={Activity}>
      {decisions.length === 0 ? <p className="text-xs text-slate-500">No decisions yet.</p> : (
        <ul className="space-y-2 max-h-72 overflow-y-auto">
          {[...decisions].reverse().map((e) => (
            <li key={e.id} className="text-xs border-l-2 border-red-300 pl-2">
              <span className="font-bold text-slate-800">{e.type_label}</span>
              <span className="text-slate-500"> - {e.message}</span>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
};
