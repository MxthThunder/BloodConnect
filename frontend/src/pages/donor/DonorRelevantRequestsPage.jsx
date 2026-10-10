import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import apiClient from '../../api/client';
import StatusBadge from '../../components/StatusBadge';
import BloodGroupBadge from '../../components/BloodGroupBadge';
import ClinicalDisclaimer from '../../components/ClinicalDisclaimer';
import { Activity, Building2, Clock, ArrowRight, AlertTriangle } from 'lucide-react';

const DonorRelevantRequestsPage = () => {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchRequests = async () => {
      try {
        const res = await apiClient.get('/donors/relevant-requests/');
        setRequests(res.data || []);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchRequests();
  }, []);

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-xs">
        <span className="text-xs font-bold text-red-600 uppercase tracking-wider">
          Regional Emergency Radar
        </span>
        <h1 className="text-2xl font-black text-slate-900 tracking-tight mt-0.5">
          Relevant Blood Requests
        </h1>
        <p className="text-xs text-slate-500 mt-1">
          Active hospital emergencies matching your red cell compatibility profile in your municipal region.
        </p>
      </div>

      <ClinicalDisclaimer compact={true} />

      {loading ? (
        <div className="py-12 text-center text-slate-400 text-xs">Scanning active hospital requests...</div>
      ) : requests.length === 0 ? (
        <div className="p-12 text-center bg-white rounded-3xl border border-slate-200 text-slate-400 text-xs space-y-2">
          <p className="font-semibold text-slate-700">No active emergency requests in your area right now.</p>
          <p>Thank you for staying on standby. You will receive an immediate in-app notification when a matching case arises.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {requests.map((r) => (
            <div
              key={r.id}
              className="p-6 rounded-3xl bg-white border border-slate-200 shadow-2xs hover:shadow-xs transition flex flex-col sm:flex-row sm:items-center justify-between gap-4"
            >
              <div className="flex items-start gap-4">
                <BloodGroupBadge group={r.blood_group} size="lg" />
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-black text-sm text-slate-900">{r.reference_number}</span>
                    <StatusBadge type="urgency" value={r.urgency} size="xs" />
                  </div>
                  <p className="text-xs text-slate-700 font-semibold flex items-center gap-1.5">
                    <Building2 className="w-3.5 h-3.5 text-slate-400" />
                    <span>{r.hospital_name}</span> &bull;{' '}
                    <span className="text-slate-500">{r.locality || r.city}</span>
                  </p>
                  <p className="text-[11px] text-slate-500">
                    Required: <strong>{r.units_requested} unit(s)</strong> of {r.component}
                  </p>
                </div>
              </div>

              <div className="flex items-center justify-between sm:justify-end gap-3 pt-3 sm:pt-0 border-t sm:border-t-0 border-slate-100">
                <div className="text-xs text-slate-500 flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5" />
                  <span>Required by: {new Date(r.required_by).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                </div>
                <Link
                  to="/donor/notifications"
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-red-600 text-white font-bold text-xs hover:bg-red-700 transition shadow-2xs"
                >
                  <span>View Alert Details</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default DonorRelevantRequestsPage;
