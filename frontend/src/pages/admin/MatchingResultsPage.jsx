import React, { useState, useEffect } from 'react';
import apiClient from '../../api/client';
import StatusBadge from '../../components/StatusBadge';
import BloodGroupBadge from '../../components/BloodGroupBadge';
import ClinicalDisclaimer from '../../components/ClinicalDisclaimer';
import { Network, Search, HeartHandshake, MapPin, Clock, RefreshCw } from 'lucide-react';

const MatchingResultsPage = () => {
  const [matches, setMatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  const fetchMatches = async () => {
    setLoading(true);
    try {
      const res = await apiClient.get('/matching/all-matches/');
      setMatches(res.data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMatches();
  }, []);

  const filtered = matches.filter((m) => {
    const matchesSearch =
      m.request_reference.toLowerCase().includes(search.toLowerCase()) ||
      m.donor_details?.display_name?.toLowerCase().includes(search.toLowerCase()) ||
      m.donor_details?.city?.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter ? m.alert_status === statusFilter : true;
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-3xl border border-slate-200 shadow-xs">
        <div>
          <span className="text-xs font-bold text-red-600 uppercase tracking-wider">
            Matching Intelligence
          </span>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight mt-0.5">
            Algorithmic Matching Results & Live Responses
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Global view of all triaged donor matches, calculated compatibility scores, and alert statuses.
          </p>
        </div>

        <button
          onClick={fetchMatches}
          className="flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 transition"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>Refresh</span>
        </button>
      </div>

      <ClinicalDisclaimer compact={true} />

      {/* Filters and Search */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by case ref, donor name, locality..."
            className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-300 text-xs focus:border-red-500 outline-hidden bg-white"
          />
        </div>

        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-3 py-2.5 rounded-xl border border-slate-300 text-xs focus:border-red-500 outline-hidden bg-white text-slate-700"
        >
          <option value="">All Alert Statuses</option>
          <option value="DISPATCHED">Alert Dispatched</option>
          <option value="VIEWED">Viewed by Donor</option>
          <option value="ACCEPTED">Accepted by Donor</option>
          <option value="DECLINED">Declined by Donor</option>
        </select>
      </div>

      {/* Table */}
      {loading ? (
        <div className="py-12 text-center text-slate-400 text-xs">Loading matching records...</div>
      ) : filtered.length === 0 ? (
        <div className="p-12 text-center bg-white rounded-3xl border border-slate-200 text-slate-400 text-xs">
          No matching records found.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-3xl border border-slate-200 bg-white shadow-xs">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-600 font-bold uppercase text-[11px] border-b border-slate-200">
              <tr>
                <th className="py-3.5 px-4">Case Ref</th>
                <th className="py-3.5 px-4">Donor Match</th>
                <th className="py-3.5 px-4">Donor Group</th>
                <th className="py-3.5 px-4">Score</th>
                <th className="py-3.5 px-4">Proximity</th>
                <th className="py-3.5 px-4">Alert Status</th>
                <th className="py-3.5 px-4">Donor Response Note</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map((m) => (
                <tr key={m.id} className="hover:bg-slate-50/70 transition">
                  <td className="py-3 px-4 font-black text-slate-900">
                    {m.request_reference}
                  </td>
                  <td className="py-3 px-4 font-bold text-slate-800">
                    {m.donor_details?.display_name || `Donor #${m.donor}`}
                  </td>
                  <td className="py-3 px-4">
                    <BloodGroupBadge group={m.donor_details?.blood_group} size="sm" />
                  </td>
                  <td className="py-3 px-4">
                    <span className="px-2 py-0.5 rounded-md font-extrabold text-[11px] bg-red-100 text-red-700">
                      {m.compatibility_score}%
                    </span>
                  </td>
                  <td className="py-3 px-4 text-slate-600">
                    {m.distance_km ? `~${m.distance_km} km` : m.donor_details?.locality || 'Bengaluru'}
                  </td>
                  <td className="py-3 px-4">
                    <StatusBadge type="alert_response" value={m.alert_status} size="xs" />
                  </td>
                  <td className="py-3 px-4 text-slate-600 italic truncate max-w-xs">
                    {m.donor_response_message || '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default MatchingResultsPage;
