import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import apiClient from '../../api/client';
import StatusBadge from '../../components/StatusBadge';
import BloodGroupBadge from '../../components/BloodGroupBadge';
import {
  PlusCircle,
  Search,
  Building2,
  Calendar,
  Eye,
  HeartHandshake,
  Filter
} from 'lucide-react';

const MyRequestsPage = () => {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

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

  const filtered = requests.filter((r) => {
    const matchesSearch =
      r.reference_number.toLowerCase().includes(search.toLowerCase()) ||
      r.hospital_name.toLowerCase().includes(search.toLowerCase()) ||
      r.blood_group.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter ? r.verification_status === statusFilter : true;
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-3xl border border-slate-200 shadow-xs">
        <div>
          <span className="text-xs font-bold text-red-600 uppercase tracking-wider">
            Request Registry
          </span>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight mt-0.5">
            My Emergency Blood Requests
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Track verification state, matching donor alerts, and fulfillment statuses.
          </p>
        </div>

        <Link
          to="/requester/create-request"
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-red-600 text-white font-bold text-xs hover:bg-red-700 transition shadow-sm shrink-0"
        >
          <PlusCircle className="w-4 h-4" />
          <span>Create Request</span>
        </Link>
      </div>

      {/* Filters and Search */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by reference, hospital, or blood group..."
            className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-300 text-xs focus:border-red-500 outline-hidden bg-white"
          />
        </div>

        <div className="flex items-center gap-2">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2.5 rounded-xl border border-slate-300 text-xs focus:border-red-500 outline-hidden bg-white text-slate-700"
          >
            <option value="">All Verification States</option>
            <option value="PENDING">Pending Verification</option>
            <option value="APPROVED">Approved by Admin</option>
            <option value="REJECTED">Rejected</option>
          </select>
        </div>
      </div>

      {/* Request Cards / Table */}
      {loading ? (
        <div className="py-12 text-center text-slate-400 text-xs">
          Loading blood requests...
        </div>
      ) : filtered.length === 0 ? (
        <div className="p-12 text-center bg-white rounded-3xl border border-slate-200 text-slate-400 text-xs">
          No blood requests found matching your filters.
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {filtered.map((req) => (
            <div
              key={req.id}
              className="p-5 rounded-2xl bg-white border border-slate-200 shadow-2xs hover:shadow-xs transition flex flex-col md:flex-row md:items-center justify-between gap-4"
            >
              <div className="flex items-start gap-4">
                <BloodGroupBadge group={req.blood_group} size="lg" />
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-extrabold text-sm text-slate-900">
                      {req.reference_number}
                    </span>
                    <StatusBadge type="urgency" value={req.urgency} size="xs" />
                    <StatusBadge type="verification" value={req.verification_status} size="xs" />
                  </div>
                  <p className="text-xs text-slate-700 flex items-center gap-1.5 font-medium">
                    <Building2 className="w-3.5 h-3.5 text-slate-400" />
                    <span>{req.hospital_name}</span> &bull;{' '}
                    <span className="text-slate-500">{req.city}</span>
                  </p>
                  <p className="text-[11px] text-slate-500">
                    Units: <strong className="text-slate-800">{req.units_requested}</strong> ({req.component}) &bull;{' '}
                    Submitted: {new Date(req.created_at).toLocaleDateString()}
                  </p>
                </div>
              </div>

              <div className="flex items-center justify-between md:justify-end gap-3 pt-3 md:pt-0 border-t md:border-t-0 border-slate-100">
                <div className="flex items-center gap-2 text-xs">
                  <span className="px-2.5 py-1 rounded-lg bg-slate-100 text-slate-700 font-semibold flex items-center gap-1">
                    <HeartHandshake className="w-3.5 h-3.5 text-red-600" />
                    <span>{req.accepted_responses_count || 0} Accepted</span>
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <Link
                    to={`/requester/requests/${req.id}`}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-semibold text-xs transition"
                  >
                    <Eye className="w-3.5 h-3.5" />
                    <span>Details & Matches</span>
                  </Link>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default MyRequestsPage;
