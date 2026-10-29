import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import apiClient from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import StatusBadge from '../../components/StatusBadge';
import BloodGroupBadge from '../../components/BloodGroupBadge';
import ClinicalDisclaimer from '../../components/ClinicalDisclaimer';
import { formatIndianDate, formatIndianDateTime } from '../../constants/chennaiData';
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
  Activity,
  MapPin,
  CheckCircle2,
  Sparkles,
  RefreshCw,
  Filter
} from 'lucide-react';

const AdminDashboard = () => {
  const { user } = useAuth();
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [reqFilter, setReqFilter] = useState('ALL');
  const [activeTab, setActiveTab] = useState('RESPONSES'); // RESPONSES or AUDIT

  const fetchStats = async () => {
    setLoading(true);
    try {
      const res = await apiClient.get('/dashboard/stats/');
      setStats(res.data);
    } catch (err) {
      console.error('Failed to load admin stats', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, []);

  if (loading && !stats) {
    return (
      <div className="py-16 text-center text-slate-400 text-xs flex flex-col items-center justify-center gap-2">
        <RefreshCw className="w-5 h-5 animate-spin text-red-600" />
        <span>Loading Chennai administration metrics from database...</span>
      </div>
    );
  }

  const donors = stats?.donors || { total: 0, available: 0, consenting: 0, by_locality: [] };
  const requests = stats?.requests || { total: 0, pending_verification: 0, active_approved: 0, fulfilled: 0, with_responses: 0 };
  const matches = stats?.matches || { total: 0, accepted: 0, declined: 0 };
  const inventory = stats?.inventory || { total_units: 0, stock_by_group: [], low_stock_count: 0, low_stock_items: [] };
  const recentRequests = stats?.recent_requests || [];
  const recentDonorResponses = stats?.recent_donor_responses || [];
  const recentAudits = stats?.recent_audits || [];

  const filteredRequests = recentRequests.filter((r) => {
    if (reqFilter === 'ALL') return true;
    if (reqFilter === 'PENDING') return r.verification_status === 'PENDING';
    if (reqFilter === 'ACTIVE') return r.request_status === 'ACTIVE_ALERTS_SENT' || r.request_status === 'DONOR_RESPONDED';
    if (reqFilter === 'FULFILLED') return r.request_status === 'FULFILLED';
    return true;
  });

  return (
    <div className="space-y-5">
      {/* 1. Header Banner */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-white p-5 sm:p-6 rounded-2xl border border-slate-200 shadow-2xs">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-900 text-[11px] font-bold">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-pulse" />
              Live Operations Active
            </span>
            <span className="text-[11px] bg-slate-100 text-slate-700 font-semibold px-2 py-0.5 rounded-md">
              Chennai Regional Command Center
            </span>
          </div>

          <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight mt-1">
            Administrator Command & Control Portal
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Logged in Administrator: <strong className="text-slate-800">{user?.first_name ? `${user.first_name} ${user.last_name || ''}`.trim() : user?.username}</strong> &bull; Regional Operations: Chennai, Tamil Nadu (Asia/Kolkata)
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <button
            onClick={fetchStats}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 text-slate-700 text-xs font-semibold hover:bg-slate-50 transition"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Refresh Metrics</span>
          </button>
          <Link
            to="/admin-portal/verification-queue"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-red-600 text-white font-bold text-xs hover:bg-red-700 transition shadow-sm shadow-red-600/20"
          >
            <ShieldCheck className="w-4 h-4" />
            <span>Verification Queue ({requests.pending_verification})</span>
          </Link>
        </div>
      </div>

      <ClinicalDisclaimer compact={true} />

      {/* 2. Low-Stock Alert Warning Banner */}
      {inventory.low_stock_count > 0 && (
        <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-amber-950 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-2xs">
          <div className="flex items-start gap-3">
            <div className="p-2 bg-amber-200 rounded-lg text-amber-800 shrink-0 mt-0.5">
              <AlertTriangle className="w-4 h-4" />
            </div>
            <div>
              <h4 className="font-bold text-xs sm:text-sm">
                Proactive Low-Stock Warnings in Chennai Regional Blood Banks ({inventory.low_stock_count} Shortages)
              </h4>
              <p className="text-[11px] sm:text-xs text-amber-800 mt-0.5">
                Reserve levels below configured safety thresholds: {inventory.low_stock_items.map(i => `${i.blood_group} (${i.units} units)`).join(', ')}. Target voluntary donors in affected localities.
              </p>
            </div>
          </div>
          <Link
            to="/admin-portal/low-stock"
            className="px-3.5 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs transition shrink-0 text-center"
          >
            Review Shortages
          </Link>
        </div>
      )}

      {/* 3. Responsive KPI Stats Cards (6 Columns on Large Screens) */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {/* Total Donors */}
        <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-2xs space-y-1">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-[11px] font-semibold">Registered Donors</span>
            <Users className="w-3.5 h-3.5 text-slate-400" />
          </div>
          <div className="text-2xl font-black text-slate-900">{donors.total}</div>
          <p className="text-[10px] text-slate-500 truncate">
            <strong className="text-emerald-600 font-bold">{donors.available}</strong> available now
          </p>
        </div>

        {/* Pending Verification */}
        <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-2xs space-y-1">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-[11px] font-semibold">Pending Triage</span>
            <Clock className="w-3.5 h-3.5 text-amber-500" />
          </div>
          <div className="text-2xl font-black text-amber-600">{requests.pending_verification}</div>
          <p className="text-[10px] text-slate-500 truncate">Hospital submissions</p>
        </div>

        {/* Active Approved */}
        <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-2xs space-y-1">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-[11px] font-semibold">Active Alerts</span>
            <Activity className="w-3.5 h-3.5 text-blue-500" />
          </div>
          <div className="text-2xl font-black text-blue-600">{requests.active_approved}</div>
          <p className="text-[10px] text-slate-500 truncate">In donor circulation</p>
        </div>

        {/* Donor Responses */}
        <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-2xs space-y-1">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-[11px] font-semibold">Accepted Donors</span>
            <HeartHandshake className="w-3.5 h-3.5 text-emerald-500" />
          </div>
          <div className="text-2xl font-black text-emerald-600">{matches.accepted}</div>
          <p className="text-[10px] text-slate-500 truncate">
            Across {requests.with_responses} requests
          </p>
        </div>

        {/* Fulfilled */}
        <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-2xs space-y-1">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-[11px] font-semibold">Fulfilled</span>
            <CheckCircle2 className="w-3.5 h-3.5 text-indigo-500" />
          </div>
          <div className="text-2xl font-black text-indigo-600">{requests.fulfilled}</div>
          <p className="text-[10px] text-slate-500 truncate">Transfusions cleared</p>
        </div>

        {/* Total Stock Reserves */}
        <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-2xs space-y-1">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-[11px] font-semibold">Stock Reserves</span>
            <Building2 className="w-3.5 h-3.5 text-red-500" />
          </div>
          <div className="text-2xl font-black text-slate-900">{inventory.total_units} <span className="text-xs font-normal text-slate-500">units</span></div>
          <p className="text-[10px] text-slate-500 truncate">
            {inventory.low_stock_count > 0 ? (
              <span className="text-amber-600 font-bold">{inventory.low_stock_count} low-stock alerts</span>
            ) : (
              <span className="text-emerald-600 font-medium">All levels safe</span>
            )}
          </p>
        </div>
      </div>

      {/* 4. Balanced Visualizations Grid (2 Columns) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Chart 1: Blood Group Reserves */}
        <div className="lg:col-span-7 bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs space-y-3">
          <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
            <div>
              <h2 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                <Building2 className="w-4 h-4 text-red-600" />
                <span>Chennai Blood Stock Reserves by ABO/Rh Group</span>
              </h2>
              <p className="text-[11px] text-slate-400">
                Aggregate unit reserves across 8 monitored hospital blood centres in Chennai (Total: {inventory.total_units} units)
              </p>
            </div>
            <Link
              to="/admin-portal/stock"
              className="text-xs font-bold text-red-600 hover:text-red-700 flex items-center gap-0.5"
            >
              <span>Manage</span>
              <ArrowRight className="w-3 h-3" />
            </Link>
          </div>

          <div className="h-56 w-full pt-1">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={inventory.stock_by_group} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <XAxis dataKey="blood_group" tick={{ fontSize: 11, fontWeight: 'bold' }} stroke="#64748b" />
                <YAxis tick={{ fontSize: 11 }} stroke="#64748b" />
                <Tooltip
                  contentStyle={{ backgroundColor: '#0f172a', color: '#fff', borderRadius: '10px', fontSize: '12px' }}
                  formatter={(val) => [`${val} units`, 'Available Units']}
                />
                <Bar dataKey="units" radius={[5, 5, 0, 0]}>
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

        {/* Chart 2: Chennai Locality Distribution */}
        <div className="lg:col-span-5 bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs space-y-3">
          <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
            <div>
              <h2 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                <MapPin className="w-4 h-4 text-emerald-600" />
                <span>Donor Distribution Across Chennai Localities</span>
              </h2>
              <p className="text-[11px] text-slate-400">
                Registered standby voluntary donors mapped across Chennai zones
              </p>
            </div>
            <Link
              to="/admin-portal/donors"
              className="text-xs font-bold text-red-600 hover:text-red-700 flex items-center gap-0.5"
            >
              <span>Registry</span>
              <ArrowRight className="w-3 h-3" />
            </Link>
          </div>

          <div className="h-56 w-full pt-1">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={donors.by_locality || []}
                layout="vertical"
                margin={{ top: 5, right: 15, left: 30, bottom: 0 }}
              >
                <XAxis type="number" tick={{ fontSize: 10 }} stroke="#64748b" />
                <YAxis
                  dataKey="locality"
                  type="category"
                  tick={{ fontSize: 10, fontWeight: 'bold' }}
                  stroke="#64748b"
                  width={70}
                />
                <Tooltip
                  contentStyle={{ backgroundColor: '#0f172a', color: '#fff', borderRadius: '10px', fontSize: '12px' }}
                  formatter={(val) => [`${val} Donors`, 'Registered Donors']}
                />
                <Bar dataKey="count" fill="#0284c7" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* 5. Two-Column Operational Queues: Recent Requests & Responses / Audits */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Left Column: Recent Requests with Filter Pills */}
        <div className="lg:col-span-7 bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-2.5">
            <div className="flex items-center gap-2">
              <FileText className="w-4 h-4 text-red-600" />
              <h3 className="font-bold text-sm text-slate-900">Recent Chennai Blood Requests</h3>
            </div>

            {/* Quick Status Filters */}
            <div className="flex items-center gap-1 text-[11px]">
              {['ALL', 'PENDING', 'ACTIVE', 'FULFILLED'].map((tab) => (
                <button
                  key={tab}
                  onClick={() => setReqFilter(tab)}
                  className={`px-2 py-0.5 rounded-md font-bold transition ${
                    reqFilter === tab
                      ? 'bg-slate-900 text-white'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {tab}
                </button>
              ))}
            </div>
          </div>

          <div className="divide-y divide-slate-100">
            {filteredRequests.length === 0 ? (
              <div className="py-8 text-center text-xs text-slate-400">
                No blood requests matching selected filter.
              </div>
            ) : (
              filteredRequests.map((r) => (
                <div key={r.id} className="py-2.5 flex items-center justify-between gap-3 text-xs">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <BloodGroupBadge group={r.blood_group} size="sm" />
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-900">{r.reference_number}</span>
                        <span className="text-[10px] text-slate-400 font-medium">
                          {formatIndianDate(r.created_at)}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-600 truncate max-w-[260px]">
                        {r.hospital_name} &bull; <span className="text-slate-400">{r.locality || 'Chennai'}</span>
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <StatusBadge type="request" value={r.request_status} size="xs" />
                    <Link
                      to={`/requester/requests/${r.id}`}
                      className="p-1 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-50 transition"
                      title="View request details"
                    >
                      <ArrowRight className="w-3.5 h-3.5" />
                    </Link>
                  </div>
                </div>
              ))
            )}
          </div>

          <div className="pt-2 text-right">
            <Link to="/admin-portal/requests" className="text-xs font-bold text-red-600 hover:text-red-700">
              View All Chennai Requests &rarr;
            </Link>
          </div>
        </div>

        {/* Right Column: Tab Switcher (Donor Responses vs Security Audits) */}
        <div className="lg:col-span-5 bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs space-y-3">
          <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setActiveTab('RESPONSES')}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition ${
                  activeTab === 'RESPONSES'
                    ? 'bg-red-50 text-red-700 border border-red-200'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                Recent Responses ({recentDonorResponses.length})
              </button>
              <button
                onClick={() => setActiveTab('AUDIT')}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition ${
                  activeTab === 'AUDIT'
                    ? 'bg-red-50 text-red-700 border border-red-200'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                Audit Log ({recentAudits.length})
              </button>
            </div>

            {activeTab === 'RESPONSES' ? (
              <span className="text-[10px] text-emerald-600 font-bold">Simulated Alerts</span>
            ) : (
              <Link to="/admin-portal/audit-logs" className="text-xs font-bold text-red-600">
                Full Log
              </Link>
            )}
          </div>

          {activeTab === 'RESPONSES' ? (
            <div className="divide-y divide-slate-100">
              {recentDonorResponses.length === 0 ? (
                <div className="py-8 text-center text-xs text-slate-400">
                  No volunteer donor responses recorded yet.
                </div>
              ) : (
                recentDonorResponses.map((res) => (
                  <div key={res.id} className="py-2.5 text-xs space-y-1">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5 font-bold text-slate-900">
                        <span className="text-emerald-700">{res.donor_name}</span>
                        <span className="text-[10px] px-1.5 py-0.2 rounded bg-emerald-100 text-emerald-800 uppercase">
                          {res.status}
                        </span>
                      </div>
                      <span className="text-[10px] text-slate-400">
                        {formatIndianDateTime(res.responded_at)}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-600 italic">
                      "{res.message || 'Can donate immediately upon arrival.'}"
                    </p>
                    <p className="text-[10px] text-slate-400 flex items-center gap-1">
                      <MapPin className="w-2.5 h-2.5" />
                      <span>{res.hospital_name} ({res.locality})</span> &bull; <span>Ref: {res.request_ref}</span>
                    </p>
                  </div>
                ))
              )}
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {recentAudits.map((a) => (
                <div key={a.id} className="py-2.5 text-xs space-y-0.5">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-800">{a.action}</span>
                    <span className="text-[10px] text-slate-400">
                      {formatIndianDateTime(a.created_at)}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 truncate">{a.details}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;
