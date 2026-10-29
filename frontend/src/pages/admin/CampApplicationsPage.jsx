import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { CalendarDays, Search } from 'lucide-react';
import { campsApi, campError } from '../../api/camps';
import { Alert, Panel } from '../../components/escalation/shared';
import { CampStatusBadge, PartnerBadge, fmtDate } from '../../components/camps/shared';

const STATUS_ORDER = [
  ['SUBMITTED', 'Submitted'], ['UNDER_REVIEW', 'Under review'], ['PARTNER_COORDINATION', 'Partner coordination'],
  ['APPROVED', 'Approved'], ['COMPLETED', 'Completed'], ['REJECTED', 'Not approved'], ['CANCELLED', 'Cancelled'],
];

const CampApplicationsPage = () => {
  const [status, setStatus] = useState('');
  const [q, setQ] = useState('');
  const [data, setData] = useState({ results: [], status_counts: {} });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const id = setTimeout(() => {
      setLoading(true);
      campsApi.applications({ status: status || undefined, q: q || undefined })
        .then((d) => { setData(d); setError(''); })
        .catch((err) => setError(campError(err, 'Could not load applications.').message))
        .finally(() => setLoading(false));
    }, q ? 250 : 0);
    return () => clearTimeout(id);
  }, [status, q]);

  const counts = data.status_counts || {};
  const total = Object.values(counts).reduce((a, b) => a + b, 0);

  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-xl font-black text-slate-900">Donation camp applications</h1>
        <p className="text-xs text-slate-600 mt-1">
          Review applications, coordinate a qualified medical partner, and approve. A camp cannot be approved or listed publicly until a partner has confirmed.
        </p>
      </header>

      {error && <Alert>{error}</Alert>}

      <div className="flex flex-wrap gap-2" role="group" aria-label="Filter by status">
        <button type="button" onClick={() => setStatus('')} className={`px-3 py-1.5 rounded-lg border text-xs font-semibold ${status === '' ? 'bg-red-700 text-white border-red-700' : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100'}`}>
          All ({total})
        </button>
        {STATUS_ORDER.map(([value, label]) => (
          <button
            key={value} type="button" onClick={() => setStatus(value)}
            className={`px-3 py-1.5 rounded-lg border text-xs font-semibold ${status === value ? 'bg-red-700 text-white border-red-700' : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100'}`}
          >
            {label} ({counts[value] || 0})
          </button>
        ))}
      </div>

      <label className="relative block max-w-md">
        <span className="sr-only">Search applications</span>
        <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" aria-hidden="true" />
        <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search title, organisation, reference, locality" className="block w-full pl-9 pr-3 py-2 rounded-lg border border-slate-300 text-sm" />
      </label>

      <Panel title="Applications" icon={CalendarDays} bodyClass="p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <caption className="sr-only">Camp applications</caption>
            <thead className="bg-slate-50 text-slate-600">
              <tr>
                <th scope="col" className="px-4 py-2.5 font-semibold">Camp</th>
                <th scope="col" className="px-4 py-2.5 font-semibold">Locality</th>
                <th scope="col" className="px-4 py-2.5 font-semibold">Date</th>
                <th scope="col" className="px-4 py-2.5 font-semibold">Status</th>
                <th scope="col" className="px-4 py-2.5 font-semibold">Medical partner</th>
                <th scope="col" className="px-4 py-2.5 font-semibold text-right">Interested</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {loading && <tr><td colSpan={6} className="px-4 py-6 text-slate-500">Loading...</td></tr>}
              {!loading && data.results.length === 0 && <tr><td colSpan={6} className="px-4 py-8 text-center text-slate-500">No applications match.</td></tr>}
              {data.results.map((a) => (
                <tr key={a.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3">
                    <Link to={`/admin-portal/camps/${a.id}`} className="font-bold text-slate-900 hover:text-red-700">{a.title}</Link>
                    <p className="text-[11px] text-slate-500">{a.reference_number} &bull; {a.organisation_name}</p>
                  </td>
                  <td className="px-4 py-3 text-slate-700">{a.locality}</td>
                  <td className="px-4 py-3 text-slate-700 whitespace-nowrap">{fmtDate(a.camp_date)}</td>
                  <td className="px-4 py-3"><CampStatusBadge status={a.status} label={a.status_label} /></td>
                  <td className="px-4 py-3">
                    <PartnerBadge status={a.partner_status} label={a.partner_status_label} />
                    {a.partner_name && <p className="text-[11px] text-slate-500 mt-0.5">{a.partner_name}</p>}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">{a.interest_count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
    </div>
  );
};

export default CampApplicationsPage;
