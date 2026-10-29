import React, { useCallback, useEffect, useState } from 'react';
import { ChevronDown, ChevronRight, Users } from 'lucide-react';
import { escalationApi, errorMessage } from '../../api/escalation';
import BloodGroupBadge from '../BloodGroupBadge';
import { Alert, Button, LifecycleBadge, Panel } from './shared';

const TABS = [
  { key: 'all', label: 'Considered' },
  { key: 'contacted', label: 'Alerted' },
  { key: 'eligible', label: 'Next in line' },
  { key: 'excluded', label: 'Excluded' },
];

const FULFILMENT_OPTIONS = [
  { value: 'NONE', label: 'Volunteer confirmed (accepted)' },
  { value: 'VERIFICATION_PENDING', label: 'Hospital verification pending' },
  { value: 'DONATION_CONFIRMED', label: 'Donation outcome confirmed' },
  { value: 'NOT_DONATED', label: 'Did not donate / deferred' },
];

const Breakdown = ({ row }) => (
  <div className="grid gap-3 2xl:grid-cols-2 text-xs">
    <div>
      <p className="font-bold text-slate-800 mb-1">Why this candidate appears</p>
      <p className="text-slate-700 leading-snug">{row.explanation || row.exclusion_label || 'No explanation recorded.'}</p>
      {row.unknown_fields?.length > 0 && <p className="mt-1.5 text-amber-800">Unknown: {row.unknown_fields.join(', ')}</p>}
    </div>
    <div>
      <p className="font-bold text-slate-800 mb-1">Prioritisation criteria</p>
      <table className="w-full text-[11px]">
        <caption className="sr-only">Score breakdown for {row.display_name}</caption>
        <tbody>
          {row.breakdown?.map((b) => (
            <tr key={b.key} className="border-b border-slate-100">
              <th scope="row" className="py-1 pr-2 text-left font-medium text-slate-700">{b.label}</th>
              <td className="py-1 pr-2 tabular-nums whitespace-nowrap">{b.points}/{b.max}</td>
              <td className="py-1 text-slate-500">{b.detail}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  </div>
);

const CandidateTable = ({ caseId, isTerminal, refreshKey, onChanged, actionsEnabled = true, pageSize = 10 }) => {
  const [tab, setTab] = useState('all');
  const [page, setPage] = useState(1);
  const [data, setData] = useState(null);
  const [open, setOpen] = useState({});
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(null);

  const load = useCallback(async () => {
    try {
      setData(await escalationApi.candidates(caseId, { view: tab, page, page_size: pageSize }));
      setError('');
    } catch (err) { setError(errorMessage(err)); }
  }, [caseId, tab, page, pageSize]);

  useEffect(() => { load(); }, [load, refreshKey]);
  useEffect(() => { setPage(1); }, [tab, caseId]);

  const act = async (key, fn) => {
    setBusy(key); setError('');
    try { await fn(); onChanged?.(); await load(); }
    catch (err) { setError(errorMessage(err)); }
    finally { setBusy(null); }
  };

  const rows = data?.results || [];
  return (
    <Panel title="Candidates and outreach status" icon={Users} bodyClass="p-0"
      actions={(
        <div role="tablist" aria-label="Candidate view" className="flex gap-1">
          {TABS.map((t) => (
            <button key={t.key} role="tab" aria-selected={tab === t.key} type="button" onClick={() => setTab(t.key)}
              className={`px-2.5 py-1 rounded-md text-[11px] font-semibold border ${tab === t.key ? 'bg-red-700 text-white border-red-700' : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100'}`}>
              {t.label}
            </button>
          ))}
        </div>
      )}>
      {error && <div className="p-3"><Alert>{error}</Alert></div>}
      <div className="overflow-x-auto">
        <table className="w-full text-xs text-left">
          <caption className="sr-only">Candidates with their prioritisation and response status</caption>
          <thead className="bg-slate-50 text-slate-600 text-[10px] uppercase tracking-wider">
            <tr>
              <th className="py-2 px-3 w-6"><span className="sr-only">Details</span></th>
              <th className="py-2 px-2">Candidate</th>
              <th className="py-2 px-2">Group</th>
              <th className="py-2 px-2">Locality</th>
              <th className="py-2 px-2">Distance</th>
              <th className="py-2 px-2">Declared availability</th>
              <th className="py-2 px-2">Search stage</th>
              <th className="py-2 px-2">Status</th>
              <th className="py-2 px-2 text-right">Score</th>
              <th className="py-2 px-2 text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {!data && <tr><td colSpan={10} className="p-6 text-center text-slate-500">Loading candidates...</td></tr>}
            {data && rows.length === 0 && <tr><td colSpan={10} className="p-6 text-center text-slate-500">No candidates in this view.</td></tr>}
            {rows.map((r) => {
              const k = r.candidate_key;
              const isOpen = !!open[k];
              const canRespond = actionsEnabled && !isTerminal && r.attempt_id && ['ALERT_SENT', 'ALERT_VIEWED', 'NO_RESPONSE'].includes(r.status);
              const accepted = r.status === 'VOLUNTEER_CONFIRMED' || r.status === 'HOSPITAL_VERIFICATION_PENDING'
                || r.status === 'DONATION_CONFIRMED' || r.status === 'NOT_DONATED';
              return (
                <React.Fragment key={k}>
                  <tr className="hover:bg-slate-50/70">
                    <td className="px-3">
                      <button type="button" aria-expanded={isOpen} aria-label={`${isOpen ? 'Hide' : 'Show'} reasoning for ${r.display_name}`}
                        onClick={() => setOpen((o) => ({ ...o, [k]: !o[k] }))} className="p-0.5 text-slate-500 hover:text-slate-900">
                        {isOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                      </button>
                    </td>
                    <td className="py-2 px-2 font-semibold text-slate-900 whitespace-nowrap">
                      {r.display_name}{r.is_simulation && <span className="ml-1 text-[10px] text-violet-700">(fictional)</span>}
                    </td>
                    <td className="py-2 px-2"><BloodGroupBadge group={r.blood_group} size="sm" /></td>
                    <td className="py-2 px-2 text-slate-700">{r.locality}</td>
                    <td className="py-2 px-2 tabular-nums">{r.distance_km != null ? `~${r.distance_km} km` : <span className="text-amber-800">Unknown</span>}</td>
                    <td className="py-2 px-2 text-slate-700">{r.availability}</td>
                    <td className="py-2 px-2 text-slate-600">{r.search_stage.replace(/^Stage \d - /, 'S' + (r.search_stage.match(/\d/)?.[0] || '') + ' ')}</td>
                    <td className="py-2 px-2">
                      {r.exclusion_code && !r.contacted
                        ? <span className="text-[11px] text-slate-600">{r.exclusion_label}</span>
                        : <LifecycleBadge status={r.status} label={r.status_label} />}
                    </td>
                    <td className="py-2 px-2 text-right tabular-nums font-semibold">{r.score}%</td>
                    <td className="py-2 px-2 text-right whitespace-nowrap">
                      {canRespond && (
                        <span className="inline-flex gap-1">
                          <Button busy={busy === `a${r.attempt_id}`} onClick={() => act(`a${r.attempt_id}`, () => escalationApi.respond(r.attempt_id, 'ACCEPTED'))}
                            title={r.is_simulation ? 'Simulate this candidate accepting' : 'Record an acceptance received outside the app (for example by phone)'}>
                            Accept
                          </Button>
                          <Button busy={busy === `d${r.attempt_id}`} onClick={() => act(`d${r.attempt_id}`, () => escalationApi.respond(r.attempt_id, 'DECLINED'))}
                            title={r.is_simulation ? 'Simulate this candidate declining' : 'Record a decline received outside the app'}>
                            Decline
                          </Button>
                        </span>
                      )}
                      {actionsEnabled && !isTerminal && accepted && (
                        <select aria-label={`Hospital verification for ${r.display_name}`} value={r.fulfilment || 'NONE'} disabled={busy === `f${r.attempt_id}`}
                          onChange={(e) => act(`f${r.attempt_id}`, () => escalationApi.fulfilment(r.attempt_id, e.target.value))}
                          className="text-[11px] border border-slate-300 rounded-md px-1.5 py-1 bg-white max-w-[12rem]">
                          {FULFILMENT_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                        </select>
                      )}
                    </td>
                  </tr>
                  {isOpen && <tr className="bg-slate-50"><td colSpan={10} className="px-6 py-3"><Breakdown row={r} /></td></tr>}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
      {data && (
        <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 border-t border-slate-200 text-[11px] text-slate-600">
          <span>
            {data.count} candidate(s) - {data.summary?.origin_basis}.
            {Object.keys(data.summary?.excluded_counts || {}).length > 0 && ` Excluded: ${Object.entries(data.summary.excluded_counts).map(([k, v]) => `${v} ${k.toLowerCase().replace(/_/g, ' ')}`).join(', ')}.`}
          </span>
          <span className="inline-flex items-center gap-2">
            <Button disabled={data.page <= 1} onClick={() => setPage((p) => p - 1)}>Previous</Button>
            <span>Page {data.page} of {data.num_pages}</span>
            <Button disabled={data.page >= data.num_pages} onClick={() => setPage((p) => p + 1)}>Next</Button>
          </span>
        </div>
      )}
    </Panel>
  );
};

export default CandidateTable;
