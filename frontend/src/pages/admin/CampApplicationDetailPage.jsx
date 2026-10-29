import React, { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { campsApi, campError } from '../../api/camps';
import { Alert, Button, Panel } from '../../components/escalation/shared';
import {
  CampStatusBadge, CoordinationNotice, FacilityChips, PartnerBadge, ProgressTracker, WhenWhere, fmtDateTime,
} from '../../components/camps/shared';

const field = 'mt-1 block w-full px-3 py-2 rounded-lg border border-slate-300 text-sm bg-white';
const todayIso = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const PartnerForm = ({ app, options, onSave, busy }) => {
  const [form, setForm] = useState({
    partner_status: app.partner_status === 'NOT_CONTACTED' ? 'CONTACTED' : app.partner_status,
    partner_id: app.partner_id || '', partner_name: app.partner_id ? '' : app.partner_name || '',
    partner_support: app.partner_support || [], partner_notes: app.partner_notes || '',
  });
  const toggle = (v) => setForm((f) => ({ ...f, partner_support: f.partner_support.includes(v) ? f.partner_support.filter((x) => x !== v) : [...f.partner_support, v] }));
  const submit = (e) => {
    e.preventDefault();
    onSave({ ...form, partner_id: form.partner_id ? Number(form.partner_id) : null });
  };
  return (
    <form onSubmit={submit} className="space-y-3">
      <label className="block text-xs font-semibold text-slate-700">
        Partner status
        <select className={field} value={form.partner_status} onChange={(e) => setForm({ ...form, partner_status: e.target.value })}>
          {options.partner_statuses.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
        </select>
      </label>
      <label className="block text-xs font-semibold text-slate-700">
        Blood bank
        <select className={field} value={form.partner_id} onChange={(e) => setForm({ ...form, partner_id: e.target.value })}>
          <option value="">Not a listed blood bank</option>
          {options.blood_banks.map((b) => <option key={b.id} value={b.id}>{b.name} ({b.locality})</option>)}
        </select>
      </label>
      {!form.partner_id && (
        <label className="block text-xs font-semibold text-slate-700">
          Authorised medical team (name)
          <input className={field} value={form.partner_name} onChange={(e) => setForm({ ...form, partner_name: e.target.value })} maxLength={200} />
        </label>
      )}
      <fieldset>
        <legend className="text-xs font-semibold text-slate-700">Support the partner has confirmed</legend>
        <div className="mt-1 space-y-1">
          {options.support_types.map((s) => (
            <label key={s.value} className="flex items-center gap-2 text-xs text-slate-800">
              <input type="checkbox" checked={form.partner_support.includes(s.value)} onChange={() => toggle(s.value)} className="rounded border-slate-300" />
              {s.label}
            </label>
          ))}
        </div>
      </fieldset>
      <label className="block text-xs font-semibold text-slate-700">
        Internal notes about the partner
        <textarea className={field} rows={2} value={form.partner_notes} onChange={(e) => setForm({ ...form, partner_notes: e.target.value })} maxLength={2000} />
      </label>
      <Button type="submit" variant="primary" busy={busy}>Save partner update</Button>
    </form>
  );
};

const CampApplicationDetailPage = () => {
  const { id } = useParams();
  const [app, setApp] = useState(null);
  const [options, setOptions] = useState(null);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [busy, setBusy] = useState('');
  const [reason, setReason] = useState('');
  const [rejecting, setRejecting] = useState(false);
  const [note, setNote] = useState({ message: '', visible: false });
  const [done, setDone] = useState({ actual_donors: '', notes: '' });

  const load = useCallback(() => {
    campsApi.application(id).then((d) => { setApp(d); setError(''); })
      .catch((err) => setError(err?.response?.status === 404 ? 'Application not found.' : campError(err).message));
  }, [id]);

  useEffect(() => { load(); campsApi.options().then(setOptions).catch(() => {}); }, [load]);

  const run = async (label, fn, success) => {
    setBusy(label);
    setError('');
    setInfo('');
    try {
      setApp(await fn());
      setInfo(success);
      return true;
    } catch (err) {
      setError(campError(err).message);
      return false;
    } finally {
      setBusy('');
    }
  };

  if (error && !app) return <div className="space-y-3"><Alert>{error}</Alert><Link to="/admin-portal/camps" className="text-xs font-semibold text-red-700 underline">Back to applications</Link></div>;
  if (!app || !options) return <p className="text-xs text-slate-500">Loading...</p>;

  const inPartnerStage = ['UNDER_REVIEW', 'PARTNER_COORDINATION'].includes(app.status);
  const canReject = ['SUBMITTED', 'UNDER_REVIEW', 'PARTNER_COORDINATION'].includes(app.status);
  const campDay = app.camp_date <= todayIso();

  return (
    <div className="space-y-5 max-w-6xl">
      <Link to="/admin-portal/camps" className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-700 hover:text-red-700">
        <ArrowLeft className="w-3.5 h-3.5" aria-hidden="true" /> All applications
      </Link>
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-black text-slate-900">{app.title}</h1>
          <p className="text-xs text-slate-500">{app.reference_number} &bull; {app.organisation_name} &bull; {app.organisation_type_label}</p>
        </div>
        <div className="flex items-center gap-2">
          <PartnerBadge status={app.partner_status} label={app.partner_status_label} />
          <CampStatusBadge status={app.status} label={app.status_label} />
        </div>
      </header>

      {error && <Alert>{error}</Alert>}
      {info && <Alert tone="info">{info}</Alert>}

      <Panel title="Progress"><ProgressTracker stages={app.progress} /></Panel>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">
        <div className="lg:col-span-3 space-y-5">
          <Panel title="Camp details">
            <div className="space-y-3">
              <WhenWhere camp={app} />
              <p className="text-xs text-slate-600 whitespace-pre-line">{app.address}</p>
              <p className="text-xs text-slate-700">Expected donors: <strong>{app.expected_donors}</strong></p>
              <FacilityChips facilities={app.facilities} />
              {app.facilities_notes && <p className="text-xs text-slate-600">{app.facilities_notes}</p>}
              {app.description && <p className="text-xs text-slate-700 whitespace-pre-line">{app.description}</p>}
              {app.registration_info && <p className="text-xs text-slate-600"><strong>Public registration info:</strong> {app.registration_info}</p>}
            </div>
          </Panel>
          <Panel title="Organiser (private)">
            <dl className="text-xs text-slate-700 space-y-1">
              <div><dt className="inline font-semibold">Account: </dt><dd className="inline">{app.organiser.name} ({app.organiser.email})</dd></div>
              <div><dt className="inline font-semibold">Contact: </dt><dd className="inline">{app.contact_name}, {app.contact_phone}{app.contact_email ? `, ${app.contact_email}` : ''}</dd></div>
              <div><dt className="inline font-semibold">Interest registered: </dt><dd className="inline">{app.interest_count}</dd></div>
            </dl>
          </Panel>
          <Panel title="Timeline (including internal entries)">
            <ol className="space-y-3">
              {[...app.events].reverse().map((e) => (
                <li key={e.id} className="text-xs">
                  <p className="text-slate-800">
                    {e.internal && <span className="mr-1.5 px-1.5 py-0.5 rounded bg-slate-200 text-slate-700 text-[10px] font-bold">INTERNAL</span>}
                    {e.message}
                  </p>
                  <p className="text-[11px] text-slate-500">{e.actor} &bull; {fmtDateTime(e.created_at)}</p>
                </li>
              ))}
            </ol>
          </Panel>
        </div>

        <aside className="lg:col-span-2 space-y-5">
          {app.status === 'SUBMITTED' && (
            <Panel title="Next step">
              <p className="text-xs text-slate-600 mb-3">Start the review to let the organiser know you have picked this up.</p>
              <Button variant="primary" busy={busy === 'review'} onClick={() => run('review', () => campsApi.action(id, 'start_review'), 'Review started. The organiser has been notified.')}>Start review</Button>
            </Panel>
          )}

          {inPartnerStage && (
            <Panel title="Medical partner coordination">
              <p className="text-xs text-slate-600 mb-3">Record your contact with a blood bank or authorised medical team. The camp can only be approved after a partner has <strong>confirmed</strong>.</p>
              <PartnerForm key={`${app.partner_status}-${app.partner_id}-${app.updated_at}`} app={app} options={options} busy={busy === 'partner'}
                onSave={(body) => run('partner', () => campsApi.action(id, 'partner', body), 'Partner update saved.')} />
            </Panel>
          )}

          {app.status === 'PARTNER_COORDINATION' && (
            <Panel title="Approval">
              {app.approval_blockers.length > 0 ? (
                <div className="space-y-2">
                  <Alert tone="warn">Cannot approve yet:</Alert>
                  <ul className="list-disc pl-5 text-xs text-slate-700 space-y-0.5">{app.approval_blockers.map((b) => <li key={b}>{b}</li>)}</ul>
                </div>
              ) : <p className="text-xs text-emerald-800">{app.partner_name} has confirmed. Approving lists the camp publicly.</p>}
              <div className="mt-3">
                <Button variant="primary" disabled={app.approval_blockers.length > 0} busy={busy === 'approve'}
                  onClick={() => run('approve', () => campsApi.action(id, 'approve'), 'Camp approved and listed publicly.')}>Approve camp</Button>
              </div>
            </Panel>
          )}

          {app.status === 'APPROVED' && (
            <Panel title="Completion">
              <p className="text-xs text-slate-600 mb-3">{campDay ? 'Record the outcome once the camp has taken place. Leave the count blank if it is unknown.' : 'Available on the day of the camp.'}</p>
              <div className="space-y-2">
                <label className="block text-xs font-semibold text-slate-700">Donors who attended (if known)
                  <input type="number" min="0" className={field} value={done.actual_donors} disabled={!campDay} onChange={(e) => setDone({ ...done, actual_donors: e.target.value })} />
                </label>
                <label className="block text-xs font-semibold text-slate-700">Notes
                  <textarea rows={2} className={field} value={done.notes} disabled={!campDay} onChange={(e) => setDone({ ...done, notes: e.target.value })} />
                </label>
                <Button variant="primary" disabled={!campDay} busy={busy === 'complete'}
                  onClick={() => run('complete', () => campsApi.action(id, 'complete', done), 'Camp marked completed.')}>Mark completed</Button>
              </div>
            </Panel>
          )}

          {(canReject || app.status === 'APPROVED') && (
            <Panel title={app.status === 'APPROVED' ? 'Cancel this camp' : 'Decline this application'}>
              {!rejecting ? (
                <Button variant="danger" onClick={() => setRejecting(true)}>{app.status === 'APPROVED' ? 'Cancel camp' : 'Decline application'}</Button>
              ) : (
                <div className="space-y-2">
                  <label className="block text-xs font-semibold text-slate-700">Reason (the organiser will see this)
                    <textarea rows={2} className={field} value={reason} onChange={(e) => setReason(e.target.value)} maxLength={500} />
                  </label>
                  <div className="flex gap-2">
                    <Button variant="danger" busy={busy === 'reject'} disabled={!reason.trim()}
                      onClick={async () => {
                        const ok = await run('reject', () => (app.status === 'APPROVED' ? campsApi.cancel(id, reason) : campsApi.action(id, 'reject', { reason })),
                          app.status === 'APPROVED' ? 'Camp cancelled. The organiser and interested people were notified.' : 'Application declined. The organiser has been notified.');
                        if (ok) { setRejecting(false); setReason(''); }
                      }}>Confirm</Button>
                    <Button variant="quiet" onClick={() => setRejecting(false)}>Back</Button>
                  </div>
                </div>
              )}
            </Panel>
          )}

          <Panel title="Add a note">
            <div className="space-y-2">
              <textarea rows={2} className={field} value={note.message} onChange={(e) => setNote({ ...note, message: e.target.value })} maxLength={500} aria-label="Note" />
              <label className="flex items-center gap-2 text-xs text-slate-700">
                <input type="checkbox" checked={note.visible} onChange={(e) => setNote({ ...note, visible: e.target.checked })} className="rounded border-slate-300" />
                Share with the organiser (they will be notified)
              </label>
              <Button busy={busy === 'note'} disabled={!note.message.trim()}
                onClick={async () => {
                  const ok = await run('note', () => campsApi.action(id, 'note', { message: note.message, visible_to_organiser: note.visible }), 'Note added.');
                  if (ok) setNote({ message: '', visible: false });
                }}>Add note</Button>
            </div>
            {app.admin_notes && <pre className="mt-3 whitespace-pre-wrap text-[11px] text-slate-600 bg-slate-50 border border-slate-200 rounded-lg p-2">{app.admin_notes}</pre>}
          </Panel>
        </aside>
      </div>
      <CoordinationNotice>{app.notice}</CoordinationNotice>
    </div>
  );
};

export default CampApplicationDetailPage;
