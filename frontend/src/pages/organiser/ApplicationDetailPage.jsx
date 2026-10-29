import React, { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Pencil } from 'lucide-react';
import { campsApi, campError } from '../../api/camps';
import { Alert, Button, Panel } from '../../components/escalation/shared';
import {
  CampStatusBadge, CoordinationNotice, FacilityChips, ProgressTracker, WhenWhere, fmtDateTime,
} from '../../components/camps/shared';

const ApplicationDetailPage = () => {
  const { id } = useParams();
  const [app, setApp] = useState(null);
  const [error, setError] = useState('');
  const [confirming, setConfirming] = useState(false);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    campsApi.application(id)
      .then((d) => { setApp(d); setError(''); })
      .catch((err) => setError(err?.response?.status === 404 ? 'Application not found.' : campError(err).message));
  }, [id]);

  useEffect(() => { load(); }, [load]);

  const cancel = async () => {
    setBusy(true);
    try {
      setApp(await campsApi.cancel(id, reason));
      setConfirming(false);
    } catch (err) {
      setError(campError(err).message);
    } finally {
      setBusy(false);
    }
  };

  if (error && !app) {
    return <div className="space-y-3"><Alert>{error}</Alert><Link to="/organiser/dashboard" className="text-xs font-semibold text-red-700 underline">Back to dashboard</Link></div>;
  }
  if (!app) return <p className="text-xs text-slate-500">Loading...</p>;

  return (
    <div className="space-y-5 max-w-5xl">
      <Link to="/organiser/dashboard" className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-700 hover:text-red-700">
        <ArrowLeft className="w-3.5 h-3.5" aria-hidden="true" /> My applications
      </Link>

      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-black text-slate-900">{app.title}</h1>
          <p className="text-xs text-slate-500">{app.reference_number} &bull; {app.organisation_name} &bull; {app.organisation_type_label}</p>
        </div>
        <CampStatusBadge status={app.status} label={app.status_label} />
      </header>

      {error && <Alert>{error}</Alert>}

      <Panel title="Progress">
        <div className="space-y-3">
          <ProgressTracker stages={app.progress} />
          {app.status === 'REJECTED' && <Alert tone="warn"><strong>Not approved.</strong> {app.rejection_reason}</Alert>}
          {app.status === 'CANCELLED' && <Alert tone="warn"><strong>Cancelled.</strong> {app.cancellation_reason}</Alert>}
          {app.status === 'COMPLETED' && (
            <Alert tone="info">Completed. {app.actual_donors != null ? `${app.actual_donors} donors were recorded.` : 'The donor count has not been recorded.'}</Alert>
          )}
          {app.is_public && (
            <Alert tone="info">
              Your camp is listed publicly with <strong>{app.interest_count}</strong> {app.interest_count === 1 ? 'person' : 'people'} interested.{' '}
              <Link to={`/camps/${app.id}`} className="font-semibold underline">View public page</Link>
            </Alert>
          )}
        </div>
      </Panel>

      <Panel title="Medical partner">
        <p className={`text-sm ${app.medical_support.confirmed ? 'text-emerald-800 font-semibold' : 'text-slate-700'}`}>{app.medical_support.message}</p>
        {app.medical_support.confirmed && app.medical_support.support.length > 0 && (
          <ul className="mt-2 list-disc pl-5 text-xs text-slate-700 space-y-0.5">
            {app.medical_support.support.map((s) => <li key={s.code}>{s.label}</li>)}
          </ul>
        )}
      </Panel>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <Panel title="Camp details">
          <div className="space-y-3">
            <WhenWhere camp={app} />
            <p className="text-xs text-slate-600 whitespace-pre-line">{app.address}</p>
            <p className="text-xs text-slate-700">Expected donors: <strong>{app.expected_donors}</strong></p>
            <FacilityChips facilities={app.facilities} />
          </div>
        </Panel>
        <Panel title="Your contact details (private)">
          <dl className="text-xs text-slate-700 space-y-1">
            <div><dt className="inline font-semibold">Contact: </dt><dd className="inline">{app.contact_name}</dd></div>
            <div><dt className="inline font-semibold">Phone: </dt><dd className="inline">{app.contact_phone}</dd></div>
            {app.contact_email && <div><dt className="inline font-semibold">E-mail: </dt><dd className="inline">{app.contact_email}</dd></div>}
          </dl>
          <p className="text-[11px] text-slate-500 mt-2">These are never shown on the public camp page.</p>
        </Panel>
      </div>

      <Panel title="Timeline">
        <ol className="space-y-3">
          {[...app.events].reverse().map((e) => (
            <li key={e.id} className="text-xs">
              <p className="text-slate-800">{e.message}</p>
              <p className="text-[11px] text-slate-500">{e.actor} &bull; {fmtDateTime(e.created_at)}</p>
            </li>
          ))}
          {app.events.length === 0 && <li className="text-xs text-slate-500">No updates yet.</li>}
        </ol>
      </Panel>

      {(app.can_edit || app.can_cancel) && (
        <div className="flex flex-wrap items-start gap-3">
          {app.can_edit && (
            <Link to={`/organiser/applications/${app.id}/edit`} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-300 text-xs font-semibold text-slate-800 hover:bg-slate-100">
              <Pencil className="w-3.5 h-3.5" aria-hidden="true" /> Edit application
            </Link>
          )}
          {app.can_cancel && !confirming && <Button variant="danger" onClick={() => setConfirming(true)}>Cancel application</Button>}
          {confirming && (
            <div className="w-full max-w-md space-y-2 bg-white border border-rose-200 rounded-xl p-3">
              <label className="block text-xs font-semibold text-slate-700">
                Reason (optional)
                <input value={reason} onChange={(e) => setReason(e.target.value)} className="mt-1 block w-full px-3 py-2 rounded-lg border border-slate-300 text-sm" maxLength={500} />
              </label>
              <div className="flex gap-2">
                <Button variant="danger" busy={busy} onClick={cancel}>Yes, cancel it</Button>
                <Button variant="quiet" onClick={() => setConfirming(false)}>Keep it</Button>
              </div>
            </div>
          )}
        </div>
      )}

      <CoordinationNotice>{app.notice}</CoordinationNotice>
    </div>
  );
};

export default ApplicationDetailPage;
