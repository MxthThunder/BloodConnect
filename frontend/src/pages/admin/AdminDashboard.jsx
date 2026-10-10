import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import apiClient from '../../api/client';
import StatusBadge from '../../components/StatusBadge';
import BloodGroupBadge from '../../components/BloodGroupBadge';
import ClinicalDisclaimer from '../../components/ClinicalDisclaimer';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell
} from 'recharts';
import {
  Users,
  ShieldCheck,
  Building2,
  AlertTriangle,
  HeartHandshake,
  FileText,
  Clock,
  ArrowRight,
  ScrollText,
  Activity
} from 'lucide-react';

const AdminDashboard = () => {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const res = await apiClient.get('/dashboard/stats/');
        setStats(res.data);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchStats();
  }, []);

  if (loading) {
    return <div className="py-12 text-center text-slate-400 text-xs">Loading admin platform metrics...</div>;
  }

  const donors = stats?.donors || { total: 0, available: 0, consenting: 0 };
  const requests = stats?.requests || { total: 0, pending_verification: 0, active_approved: 0, fulfilled: 0 };
  const matches = stats?.matches || { total: 0, accepted: 0, declined: 0 };
  const inventory = stats?.inventory || { total_units: 0, stock_by_group: [], low_stock_count: 0, low_stock_items: [] };
  const recentRequests = stats?.recent_requests || [];
  const recentAudits = stats?.recent_audits || [];

  return (
    <div className="space-y-8">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-3xl border border-slate-200 shadow-xs">
        <div>
          <span className="text-xs font-bold text-red-600 uppercase tracking-wider">
            Command & Control Center
          </span>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight mt-0.5">
            Administrator Platform Overview
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Real-time database analytics across regional donor registries, emergency verification queues, and stock reserves.
          </p>
        </div>

        <Link
          to="/admin-portal/verification-queue"
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-red-600 text-white font-bold text-xs hover:bg-red-700 transition shadow-md shadow-red-600/20 shrink-0"
        >
          <ShieldCheck className="w-4 h-4" />
          <span>Verification Queue ({requests.pending_verification})</span>
        </Link>
      </div>

      <ClinicalDisclaimer compact={true} />

      {/* Low Stock Warning Banner if any items are low */}
      {inventory.low_stock_count > 0 && (
        <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 text-amber-950 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="p-2 bg-amber-200 rounded-xl text-amber-800 shrink-0 mt-0.5">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <h4 className="font-bold text-sm">
                Critical Low-Stock Shortage Warnings Detected ({inventory.low_stock_count} Groups)
              </h4>
              <p className="text-xs text-amber-800 mt-0.5">
                Certain blood reserves are at or below safety replenishment thresholds: {inventory.low_stock_items.map(i => `${i.blood_group} (${i.units}u)`).join(', ')}.
              </p>
            </div>
          </div>
          <Link
            to="/admin-portal/low-stock"
            className="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs transition shrink-0"
          >
            Review Deficits
          </Link>
        </div>
      )}

      {/* KPI Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-2xs space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">Registered Donors</span>
            <div className="p-2 rounded-xl bg-slate-100 text-slate-700">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <div className="text-3xl font-black text-slate-900">{donors.total}</div>
          <p className="text-[11px] text-slate-400">
            <strong className="text-emerald-600 font-bold">{donors.available}</strong> currently available
          </p>
        </div>

        <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-2xs space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">Pending Verification</span>
            <div className="p-2 rounded-xl bg-amber-100 text-amber-700">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="text-3xl font-black text-amber-600">{requests.pending_verification}</div>
          <p className="text-[11px] text-slate-400">Requests requiring approval</p>
        </div>

        <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-2xs space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">Active Approved Requests</span>
            <div className="p-2 rounded-xl bg-blue-100 text-blue-700">
              <Activity className="w-4 h-4" />
            </div>
          </div>
          <div className="text-3xl font-black text-blue-600">{requests.active_approved}</div>
          <p className="text-[11px] text-slate-400">Alerts in circulation</p>
        </div>

        <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-2xs space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">Donor Responses</span>
            <div className="p-2 rounded-xl bg-emerald-100 text-emerald-700">
              <HeartHandshake className="w-4 h-4" />
            </div>
          </div>
          <div className="text-3xl font-black text-emerald-600">{matches.accepted}</div>
          <p className="text-[11px] text-slate-400">Accepted volunteer responses</p>
        </div>
      </div>

      {/* Stock Reserves Chart by Blood Group */}
      <div className="bg-white p-6 sm:p-8 rounded-3xl border border-slate-200 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-4">
          <div>
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Building2 className="w-4 h-4 text-red-600" />
              <span>Sample Blood Stock Units by ABO/Rh Blood Group</span>
            </h2>
            <p className="text-xs text-slate-400">
              Aggregate unit counts across monitored hospital blood banks in Bengaluru (Total: {inventory.total_units} units).
            </p>
          </div>
          <Link
            to="/admin-portal/stock"
            className="text-xs font-bold text-red-600 hover:text-red-700 flex items-center gap-1"
          >
            <span>Manage Inventory</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        <div className="h-64 w-full pt-4">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={inventory.stock_by_group} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <XAxis dataKey="blood_group" tick={{ fontSize: 12, fontWeight: 'bold' }} stroke="#64748b" />
              <YAxis tick={{ fontSize: 11 }} stroke="#64748b" />
              <Tooltip
                contentStyle={{ backgroundColor: '#0f172a', color: '#fff', borderRadius: '12px', fontSize: '12px' }}
                formatter={(val) => [`${val} units`, 'Available Units']}
              />
              <Bar dataKey="units" radius={[6, 6, 0, 0]}>
                {inventory.stock_by_group.map((entry, index) => (
                  <Cell
                    key={`cell-${index}`}
                    fill={entry.is_low ? '#f59e0b' : '#dc2626'}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Two Column Grid: Pending Triage & Recent Audits */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Requests */}
        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-sm text-slate-900">Recent Blood Requests</h3>
            <Link to="/admin-portal/requests" className="text-xs font-bold text-red-600">
              All Requests
            </Link>
          </div>

          <div className="divide-y divide-slate-100">
            {recentRequests.map((r) => (
              <div key={r.id} className="py-3 flex items-center justify-between gap-3 text-xs">
                <div className="flex items-center gap-3">
                  <BloodGroupBadge group={r.blood_group} size="sm" />
                  <div>
                    <span className="font-bold text-slate-900">{r.reference_number}</span>
                    <p className="text-[11px] text-slate-500 truncate max-w-[180px]">{r.hospital_name}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <StatusBadge type="verification" value={r.verification_status} size="xs" />
                  <Link
                    to={`/requester/requests/${r.id}`}
                    className="p-1 rounded-md text-slate-400 hover:text-slate-700"
                  >
                    <ArrowRight className="w-3.5 h-3.5" />
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Recent Audit Logs */}
        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-sm text-slate-900 flex items-center gap-1.5">
              <ScrollText className="w-4 h-4 text-slate-500" />
              <span>Recent Security Audit Log</span>
            </h3>
            <Link to="/admin-portal/audit-logs" className="text-xs font-bold text-red-600">
              View Log
            </Link>
          </div>

          <div className="divide-y divide-slate-100">
            {recentAudits.map((a) => (
              <div key={a.id} className="py-3 text-xs space-y-1">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-800">{a.action}</span>
                  <span className="text-[10px] text-slate-400">
                    {new Date(a.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
                <p className="text-[11px] text-slate-500 truncate">{a.details}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;
