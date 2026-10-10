import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import apiClient from '../../api/client';
import StatusBadge from '../../components/StatusBadge';
import BloodGroupBadge from '../../components/BloodGroupBadge';
import ClinicalDisclaimer from '../../components/ClinicalDisclaimer';
import {
  PlusCircle,
  FileText,
  Clock,
  HeartHandshake,
  CheckCircle2,
  ArrowRight,
  AlertTriangle,
  Building2,
  Eye
} from 'lucide-react';

const RequesterDashboard = () => {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchDashboard = async () => {
      try {
        const res = await apiClient.get('/dashboard/stats/');
        setStats(res.data);
      } catch (err) {
        console.error('Error fetching requester dashboard', err);
      } finally {
        setLoading(false);
      }
    };
    fetchDashboard();
  }, []);

  if (loading) {
    return (
      <div className="py-12 text-center text-slate-400 text-sm">
        Loading requester dashboard metrics...
      </div>
    );
  }

  const reqStats = stats?.requests || { total: 0, pending: 0, approved: 0, responses_received: 0 };
  const recentRequests = stats?.recent_requests || [];

  return (
    <div className="space-y-8">
      {/* Top Banner with Quick Action */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-3xl border border-slate-200 shadow-xs">
        <div>
          <span className="text-xs font-bold text-red-600 uppercase tracking-wider">
            Requester Emergency Portal
          </span>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight mt-0.5">
            Emergency Blood Coordination
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Track verification progress, review matching donors, and monitor live responses.
          </p>
        </div>

        <Link
          to="/requester/create-request"
          className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-2xl bg-red-600 text-white font-bold text-xs hover:bg-red-700 transition shadow-md shadow-red-600/20 shrink-0"
        >
          <PlusCircle className="w-4 h-4" />
          <span>New Emergency Request</span>
        </Link>
      </div>

      <ClinicalDisclaimer compact={true} />

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-2xs space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">Total Submitted</span>
            <div className="p-2 rounded-xl bg-slate-100 text-slate-700">
              <FileText className="w-4 h-4" />
            </div>
          </div>
          <div className="text-3xl font-black text-slate-900">{reqStats.total}</div>
          <p className="text-[11px] text-slate-400">All-time blood requests</p>
        </div>

        <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-2xs space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">Pending Verification</span>
            <div className="p-2 rounded-xl bg-amber-100 text-amber-700">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="text-3xl font-black text-amber-600">{reqStats.pending}</div>
          <p className="text-[11px] text-slate-400">Under admin clinical review</p>
        </div>

        <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-2xs space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">Approved & Active</span>
            <div className="p-2 rounded-xl bg-blue-100 text-blue-700">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <div className="text-3xl font-black text-blue-600">{reqStats.approved}</div>
          <p className="text-[11px] text-slate-400">Alerts dispatched to donors</p>
        </div>

        <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-2xs space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">Donor Responses</span>
            <div className="p-2 rounded-xl bg-emerald-100 text-emerald-700">
              <HeartHandshake className="w-4 h-4" />
            </div>
          </div>
          <div className="text-3xl font-black text-emerald-600">{reqStats.responses_received}</div>
          <p className="text-[11px] text-slate-400">Donors accepting alerts</p>
        </div>
      </div>

      {/* Recent Requests Section */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-xs p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold text-slate-900">
            Recent Blood Requests
          </h2>
          <Link
            to="/requester/my-requests"
            className="text-xs font-bold text-red-600 hover:text-red-700 flex items-center gap-1"
          >
            <span>View All</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        {recentRequests.length === 0 ? (
          <div className="p-8 text-center text-slate-400 text-xs">
            No blood requests created yet. Click "New Emergency Request" above to initiate one.
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {recentRequests.map((r) => (
              <div
                key={r.id}
                className="py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-slate-50/50 rounded-xl px-2 transition"
              >
                <div className="flex items-start sm:items-center gap-3">
                  <BloodGroupBadge group={r.blood_group} size="md" />
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-extrabold text-sm text-slate-900">
                        {r.reference_number}
                      </span>
                      <StatusBadge type="urgency" value={r.urgency} size="xs" />
                    </div>
                    <p className="text-xs text-slate-600 flex items-center gap-1 mt-0.5">
                      <Building2 className="w-3.5 h-3.5 text-slate-400" />
                      <span>{r.hospital_name}</span> &bull;{' '}
                      <span className="font-semibold">{r.units_requested} unit(s)</span>
                    </p>
                  </div>
                </div>

                <div className="flex items-center justify-between sm:justify-end gap-3">
                  <div className="text-left sm:text-right">
                    <StatusBadge type="verification" value={r.verification_status} size="xs" />
                  </div>
                  <Link
                    to={`/requester/requests/${r.id}`}
                    className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 transition"
                    title="View Request Details"
                  >
                    <Eye className="w-4 h-4" />
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default RequesterDashboard;
