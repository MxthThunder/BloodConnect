import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { CalendarDays, PlusCircle } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { campsApi, campError } from '../../api/camps';
import { Alert, Metric, Panel } from '../../components/escalation/shared';
import { CampStatusBadge, CoordinationNotice, ProgressTracker, WhenWhere } from '../../components/camps/shared';

const NEXT_STEP = {
  SUBMITTED: 'Waiting for BloodConnect to start the review.',
  UNDER_REVIEW: 'BloodConnect is reviewing your application.',
  PARTNER_COORDINATION: 'We are arranging a qualified medical partner. No support is confirmed yet.',
  APPROVED: 'Approved and listed publicly. People can now register interest.',
  COMPLETED: 'Completed. Thank you for organising this camp.',
  REJECTED: 'Not approved. Open the application to see why.',
  CANCELLED: 'Cancelled.',
};

const OrganiserDashboard = () => {
  const { user } = useAuth();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  useEffect(() => {
    campsApi.applications()
      .then((d) => setRows(d.results))
      .catch((err) => setError(campError(err, 'Could not load your applications.').message))
      .finally(() => setLoading(false));
    campsApi.options().then((o) => setNotice(o.notice)).catch(() => {});
  }, []);

  const count = (...statuses) => rows.filter((r) => statuses.includes(r.status)).length;

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-black text-slate-900">Camp organiser portal</h1>
          <p className="text-xs text-slate-600 mt-1">Welcome{user?.first_name ? `, ${user.first_name}` : ''}. Apply to hold a camp and follow every stage here.</p>
        </div>
        <Link to="/organiser/apply" className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-red-700 text-white text-xs font-semibold hover:bg-red-800">
          <PlusCircle className="w-4 h-4" aria-hidden="true" /> Apply to hold a camp
        </Link>
      </header>

      {error && <Alert>{error}</Alert>}

      <div className="bg-white border border-slate-200 rounded-xl flex flex-wrap divide-x divide-slate-200 overflow-hidden">
        <Metric label="Applications" value={rows.length} />
        <Metric label="In progress" value={count('SUBMITTED', 'UNDER_REVIEW', 'PARTNER_COORDINATION')} />
        <Metric label="Approved camps" value={count('APPROVED')} tone="good" />
        <Metric label="Completed" value={count('COMPLETED')} />
      </div>

      <Panel title="My applications" icon={CalendarDays} bodyClass="p-0">
        {loading && <p className="p-4 text-xs text-slate-500">Loading...</p>}
        {!loading && rows.length === 0 && (
          <div className="p-8 text-center space-y-2">
            <p className="text-sm font-semibold text-slate-800">You have not applied yet</p>
            <p className="text-xs text-slate-500">Colleges, companies, NGOs and community groups can apply to hold a blood donation camp.</p>
            <Link to="/organiser/apply" className="inline-block text-xs font-semibold text-red-700 underline">Start an application</Link>
          </div>
        )}
        <ul className="divide-y divide-slate-200">
          {rows.map((a) => (
            <li key={a.id} className="p-4 space-y-3">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <Link to={`/organiser/applications/${a.id}`} className="text-sm font-extrabold text-slate-900 hover:text-red-700">{a.title}</Link>
                  <p className="text-[11px] text-slate-500">{a.reference_number} &bull; {a.organisation_name}</p>
                </div>
                <CampStatusBadge status={a.status} label={a.status_label} />
              </div>
              <WhenWhere camp={a} />
              {!['REJECTED', 'CANCELLED'].includes(a.status) && <ProgressTracker stages={a.progress} />}
              <p className="text-xs text-slate-600">{NEXT_STEP[a.status]}</p>
            </li>
          ))}
        </ul>
      </Panel>

      {notice && <CoordinationNotice>{notice}</CoordinationNotice>}
    </div>
  );
};

export default OrganiserDashboard;
