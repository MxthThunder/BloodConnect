import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import apiClient from '../../api/client';
import StatusBadge from '../../components/StatusBadge';
import BloodGroupBadge from '../../components/BloodGroupBadge';
import ClinicalDisclaimer from '../../components/ClinicalDisclaimer';
import {
  Heart,
  Bell,
  CheckCircle2,
  XCircle,
  ToggleLeft,
  ToggleRight,
  History,
  Activity,
  ArrowRight,
  ShieldCheck,
  Building2,
  Clock
} from 'lucide-react';

const DonorDashboard = () => {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [toggling, setToggling] = useState(false);

  const fetchDashboard = async () => {
    try {
      const res = await apiClient.get('/dashboard/stats/');
      setStats(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboard();
  }, []);

  const handleToggleAvailability = async () => {
    setToggling(true);
    try {
      await apiClient.post('/donors/toggle-availability/');
      fetchDashboard();
    } catch (err) {
      console.error(err);
    } finally {
      setToggling(false);
    }
  };

  if (loading) {
    return <div className="py-12 text-center text-slate-400 text-xs">Loading donor dashboard...</div>;
  }

  const profile = stats?.profile;
  const alerts = stats?.alerts || { total: 0, pending_review: 0, accepted: 0, declined: 0 };
  const donations = stats?.donations || { total_recorded: 0, last_donation: null };
  const recentAlerts = stats?.recent_alerts || [];

  return (
    <div className="space-y-8">
      {/* Top Banner with Instant Availability Switch */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-3xl border border-slate-200 shadow-xs">
        <div className="flex items-center gap-4">
          <BloodGroupBadge group={profile?.blood_group || 'O+'} size="xl" />
          <div>
            <span className="text-xs font-bold text-red-600 uppercase tracking-wider">
              Emergency Donor Standby Desk
            </span>
            <h1 className="text-2xl font-black text-slate-900 tracking-tight mt-0.5">
              Volunteer Donor Portal
            </h1>
            <p className="text-xs text-slate-500">
              Locality: <strong className="text-slate-800">{profile?.locality ? `${profile.locality}, Chennai` : 'Chennai'}</strong> &bull; Profile: {profile?.completion_percentage || 100}% Complete
            </p>
          </div>
        </div>

        {/* Quick Availability Toggle Button */}
        <div className="flex items-center gap-3 bg-slate-50 p-2.5 rounded-2xl border border-slate-200 shrink-0">
          <div className="text-right">
            <div className="text-xs font-bold text-slate-900">
              {profile?.is_available ? 'Available for Alerts' : 'Unavailable'}
            </div>
            <div className="text-[10px] text-slate-400">
              {profile?.is_available ? 'Active in emergency pool' : 'Hidden from match engine'}
            </div>
          </div>
          <button
            onClick={handleToggleAvailability}
            disabled={toggling}
            className={`p-1 rounded-xl transition ${
              profile?.is_available ? 'text-emerald-600' : 'text-slate-400'
            }`}
            title="Toggle your availability state"
          >
            {profile?.is_available ? (
              <ToggleRight className="w-9 h-9" />
            ) : (
              <ToggleLeft className="w-9 h-9" />
            )}
          </button>
        </div>
      </div>

      <ClinicalDisclaimer compact={true} />

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-2xs space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">Total Alerts Received</span>
            <div className="p-2 rounded-xl bg-red-100 text-red-700">
              <Bell className="w-4 h-4" />
            </div>
          </div>
          <div className="text-3xl font-black text-slate-900">{alerts.total}</div>
          <p className="text-[11px] text-slate-400">Emergency broadcast invitations</p>
        </div>

        <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-2xs space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">Pending Response</span>
            <div className="p-2 rounded-xl bg-amber-100 text-amber-700">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="text-3xl font-black text-amber-600">{alerts.pending_review}</div>
          <p className="text-[11px] text-slate-400">Requires your review</p>
        </div>

        <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-2xs space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">Accepted by You</span>
            <div className="p-2 rounded-xl bg-emerald-100 text-emerald-700">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <div className="text-3xl font-black text-emerald-600">{alerts.accepted}</div>
          <p className="text-[11px] text-slate-400">Willing donations confirmed</p>
        </div>

        <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-2xs space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">Recorded Donations</span>
            <div className="p-2 rounded-xl bg-blue-100 text-blue-700">
              <History className="w-4 h-4" />
            </div>
          </div>
          <div className="text-3xl font-black text-blue-600">{donations.total_recorded}</div>
          <p className="text-[11px] text-slate-400">Historical hospital intakes</p>
        </div>
      </div>

      {/* Active Alerts for this Donor */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-xs p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-slate-900">
              Recent Emergency Alerts Dispatched to You
            </h2>
            <p className="text-xs text-slate-400">
              Click any alert to inspect hospital case requirements and respond with your ETA.
            </p>
          </div>
          <Link
            to="/donor/notifications"
            className="text-xs font-bold text-red-600 hover:text-red-700 flex items-center gap-1"
          >
            <span>All Alerts</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        {recentAlerts.length === 0 ? (
          <div className="p-8 text-center text-slate-400 text-xs">
            No emergency alerts have been dispatched to your profile yet.
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {recentAlerts.map((alt) => (
              <div
                key={alt.id}
                className="py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-slate-50/50 rounded-xl px-2 transition"
              >
                <div className="flex items-start sm:items-center gap-3">
                  <BloodGroupBadge group={alt.blood_group} size="md" />
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-extrabold text-sm text-slate-900">
                        {alt.request_ref}
                      </span>
                      <StatusBadge type="urgency" value={alt.urgency} size="xs" />
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-red-100 text-red-700">
                        Match Score: {alt.score}%
                      </span>
                    </div>
                    <p className="text-xs text-slate-600 flex items-center gap-1 mt-0.5">
                      <Building2 className="w-3.5 h-3.5 text-slate-400" />
                      <span>{alt.hospital}</span>
                    </p>
                  </div>
                </div>

                <div className="flex items-center justify-between sm:justify-end gap-3">
                  <StatusBadge type="alert_response" value={alt.alert_status} size="xs" />
                  <Link
                    to={`/donor/alerts/${alt.id}`}
                    className="px-3.5 py-1.5 rounded-xl bg-red-600 text-white font-bold text-xs hover:bg-red-700 transition shadow-2xs"
                  >
                    Respond
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

export default DonorDashboard;
