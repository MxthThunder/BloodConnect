import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import apiClient from '../../api/client';
import StatusBadge from '../../components/StatusBadge';
import BloodGroupBadge from '../../components/BloodGroupBadge';
import { CHENNAI_LOCALITIES, formatIndianDate } from '../../constants/chennaiData';
import {
  FileText,
  Search,
  CheckCircle2,
  RefreshCw,
  Eye,
  Building2,
  Calendar,
  XCircle,
  Users
} from 'lucide-react';

const RequestManagementPage = () => {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [localityFilter, setLocalityFilter] = useState('');

  const fetchRequests = async () => {
    setLoading(true);
    try {
      const res = await apiClient.get('/requests/');
      setRequests(res.data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRequests();
  }, []);

  const handleFulfill = async (id) => {
    if (!window.confirm('Mark this emergency request as fulfilled?')) return;
    try {
      await apiClient.post(`/requests/${id}/fulfill/`, {
        notes: 'Transfusion completed via authorized hospital blood bank.',
      });
      fetchRequests();
    } catch (err) {
      alert('Failed to mark fulfilled');
    }
  };

  const handleRematch = async (id) => {
    try {
      const res = await apiClient.post(`/requests/${id}/rematch/`);
      alert(res.data.message || 'Matching rerun complete');
      fetchRequests();
    } catch (err) {
      alert('Failed to rematch');
    }
  };

  const filtered = requests.filter((r) => {
    const matchesSearch =
      r.reference_number.toLowerCase().includes(search.toLowerCase()) ||
      r.hospital_name.toLowerCase().includes(search.toLowerCase()) ||
      r.locality?.toLowerCase().includes(search.toLowerCase()) ||
      r.requester_name?.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter ? r.request_status === statusFilter : true;
    const matchesLocality = localityFilter ? (r.locality === localityFilter || r.hospital_name?.toLowerCase().includes(localityFilter.toLowerCase())) : true;
    return matchesSearch && matchesStatus && matchesLocality;
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-3xl border border-slate-200 shadow-xs">
        <div>
          <span className="text-xs font-bold text-red-600 uppercase tracking-wider">
            Platform Operations &bull; Chennai Hub
          </span>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight mt-0.5">
            Emergency Request Management
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Manage complete emergency lifecycle across Chennai hospitals and 15 monitored localities.
          </p>
        </div>

        <button
          onClick={fetchRequests}
          className="flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 transition"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>Refresh</span>
        </button>
      </div>

      {/* Filters and Search */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by case ref, hospital, locality, requester..."
            className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-300 text-xs focus:border-red-500 outline-hidden bg-white"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Locality Filter */}
          <select
            value={localityFilter}
            onChange={(e) => setLocalityFilter(e.target.value)}
            className="px-3 py-2.5 rounded-xl border border-slate-300 text-xs focus:border-red-500 outline-hidden bg-white text-slate-700"
          >
            <option value="">All Chennai Localities</option>
            {CHENNAI_LOCALITIES.map((loc) => (
              <option key={loc} value={loc}>{loc}</option>
            ))}
          </select>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2.5 rounded-xl border border-slate-300 text-xs focus:border-red-500 outline-hidden bg-white text-slate-700"
          >
            <option value="">All Workflow States</option>
            <option value="PENDING_VERIFICATION">Pending Verification</option>
            <option value="ACTIVE_ALERTS_SENT">Alerts Dispatched</option>
            <option value="DONOR_RESPONDED">Donor Responded</option>
            <option value="FULFILLED">Fulfilled</option>
            <option value="CANCELLED">Cancelled</option>
          </select>
        </div>
      </div>

      {/* Requests Table */}
      {loading ? (
        <div className="py-12 text-center text-slate-400 text-xs">Loading requests...</div>
      ) : filtered.length === 0 ? (
        <div className="p-12 text-center bg-white rounded-3xl border border-slate-200 text-slate-400 text-xs">
          No blood requests found matching your filter criteria.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-3xl border border-slate-200 bg-white shadow-xs">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-600 font-bold uppercase text-[11px] border-b border-slate-200">
              <tr>
                <th className="py-3.5 px-4">Case Ref</th>
                <th className="py-3.5 px-4">Group</th>
                <th className="py-3.5 px-4">Hospital & Locality</th>
                <th className="py-3.5 px-4">Units</th>
                <th className="py-3.5 px-4">Urgency</th>
                <th className="py-3.5 px-4">Status</th>
                <th className="py-3.5 px-4">Responses</th>
                <th className="py-3.5 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map((r) => (
                <tr key={r.id} className="hover:bg-slate-50/70 transition">
                  <td className="py-3 px-4 font-black text-slate-900 whitespace-nowrap">
                    {r.reference_number}
                  </td>
                  <td className="py-3 px-4">
                    <BloodGroupBadge group={r.blood_group} size="sm" />
                  </td>
                  <td className="py-3 px-4">
                    <div className="font-semibold text-slate-800">{r.hospital_name}</div>
                    <div className="text-[11px] text-slate-400">{r.city}</div>
                  </td>
                  <td className="py-3 px-4 font-bold text-slate-800">
                    {r.units_requested} u
                  </td>
                  <td className="py-3 px-4">
                    <StatusBadge type="urgency" value={r.urgency} size="xs" />
                  </td>
                  <td className="py-3 px-4">
                    <StatusBadge type="request_status" value={r.request_status} size="xs" />
                  </td>
                  <td className="py-3 px-4">
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700">
                      {r.accepted_responses_count || 0} / {r.responses_count || 0}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-right space-x-1 whitespace-nowrap">
                    <Link
                      to={`/requester/requests/${r.id}`}
                      className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 inline-block"
                      title="Inspect Details"
                    >
                      <Eye className="w-3.5 h-3.5" />
                    </Link>
                    {r.verification_status === 'APPROVED' && (
                      <button
                        onClick={() => handleRematch(r.id)}
                        className="p-1.5 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-700 inline-block"
                        title="Rerun Donor Matching"
                      >
                        <RefreshCw className="w-3.5 h-3.5" />
                      </button>
                    )}
                    {r.request_status !== 'FULFILLED' && r.verification_status === 'APPROVED' && (
                      <button
                        onClick={() => handleFulfill(r.id)}
                        className="p-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-700 inline-block"
                        title="Mark Request Fulfilled"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                      </button>
                    )}
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

export default RequestManagementPage;
