import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import apiClient from '../../api/client';
import StatusBadge from '../../components/StatusBadge';
import BloodGroupBadge from '../../components/BloodGroupBadge';
import ClinicalDisclaimer from '../../components/ClinicalDisclaimer';
import {
  ShieldCheck,
  CheckCircle2,
  XCircle,
  Building2,
  Clock,
  Phone,
  AlertTriangle,
  ArrowRight,
  Eye,
  X,
  Radio
} from 'lucide-react';

const VerificationQueuePage = () => {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedReq, setSelectedReq] = useState(null);
  const [notes, setNotes] = useState('Verified admission with hospital on-duty resident. Genuine clinical emergency.');
  const [actionLoading, setActionLoading] = useState(false);
  const [actionResult, setActionResult] = useState(null);

  const fetchQueue = async () => {
    try {
      const res = await apiClient.get('/requests/?verification=PENDING');
      setRequests(res.data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchQueue();
  }, []);

  const handleVerify = async (actionDecision) => {
    setActionLoading(true);
    setActionResult(null);
    try {
      const res = await apiClient.post(`/requests/${selectedReq.id}/verify/`, {
        action: actionDecision,
        notes,
      });
      setActionResult({
        type: 'success',
        text: res.data.message || `Request successfully ${actionDecision.toLowerCase()}ed.`,
      });
      fetchQueue();
      setTimeout(() => {
        if (actionDecision === 'APPROVE') {
          setSelectedReq(null);
          setActionResult(null);
        }
      }, 2500);
    } catch (err) {
      setActionResult({
        type: 'error',
        text: err.response?.data?.error || 'Verification action failed',
      });
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <span className="text-xs font-bold text-red-600 uppercase tracking-wider">
            Clinical Gatekeeper Triage
          </span>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight mt-0.5">
            Emergency Request Verification Queue
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Requests must be approved by an administrator before donor matching alerts are dispatched to the network.
          </p>
        </div>

        <div className="px-3.5 py-1.5 rounded-xl bg-amber-100 text-amber-900 text-xs font-bold shrink-0 flex items-center gap-1.5">
          <Clock className="w-4 h-4 text-amber-700" />
          <span>{requests.length} Cases Awaiting Approval</span>
        </div>
      </div>

      <ClinicalDisclaimer compact={true} />

      {loading ? (
        <div className="py-12 text-center text-slate-400 text-xs">Loading pending verification queue...</div>
      ) : requests.length === 0 ? (
        <div className="p-12 text-center bg-white rounded-3xl border border-slate-200 text-slate-400 text-xs space-y-2">
          <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto" />
          <p className="font-bold text-sm text-slate-700">All emergency requests are verified!</p>
          <p>No pending cases currently in the queue. New patient submissions will appear here instantly.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {requests.map((req) => (
            <div
              key={req.id}
              className="p-6 rounded-3xl bg-white border border-slate-200 shadow-2xs hover:shadow-xs transition space-y-4"
            >
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                <div className="flex items-start gap-4">
                  <BloodGroupBadge group={req.blood_group} size="lg" />
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <h3 className="font-extrabold text-base text-slate-900">
                        {req.reference_number}
                      </h3>
                      <StatusBadge type="urgency" value={req.urgency} size="xs" />
                    </div>
                    <p className="text-xs text-slate-700 font-semibold flex items-center gap-1.5">
                      <Building2 className="w-3.5 h-3.5 text-slate-400" />
                      <span>{req.hospital_name}</span> &bull;{' '}
                      <span className="text-slate-500">{req.city}</span>
                    </p>
                    <p className="text-[11px] text-slate-500">
                      Required: <strong className="text-slate-800">{req.units_requested} unit(s)</strong> of {req.component}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      setSelectedReq(req);
                      setActionResult(null);
                    }}
                    className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold text-xs shadow-md shadow-red-600/20 transition"
                  >
                    <ShieldCheck className="w-4 h-4" />
                    <span>Review & Verify</span>
                  </button>
                </div>
              </div>

              <div className="p-3.5 rounded-2xl bg-slate-50 text-xs flex flex-wrap items-center justify-between gap-2 border border-slate-100 text-slate-500">
                <span>Submitted by: <strong>{req.requester_name || 'Requester'}</strong></span>
                <span>Required By: <strong>{new Date(req.required_by).toLocaleString()}</strong></span>
                <span>Current State: <strong className="text-amber-600">PENDING_VERIFICATION</strong></span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Review & Approve Modal */}
      {selectedReq && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs" onClick={() => setSelectedReq(null)} />
          <div className="relative w-full max-w-xl bg-white rounded-3xl p-6 sm:p-8 shadow-2xl border border-slate-200 z-10 space-y-6">
            <div className="flex items-start justify-between border-b border-slate-100 pb-4">
              <div>
                <span className="text-[10px] font-bold text-red-600 uppercase tracking-wider">
                  Admin Verification Protocol
                </span>
                <h3 className="font-black text-xl text-slate-900">
                  Verify {selectedReq.reference_number}
                </h3>
                <p className="text-xs text-slate-500">
                  {selectedReq.hospital_name} &bull; {selectedReq.units_requested} unit(s) of {selectedReq.blood_group}
                </p>
              </div>
              <button
                onClick={() => setSelectedReq(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {actionResult && (
              <div
                className={`p-4 rounded-2xl text-xs font-semibold flex items-center gap-2 ${
                  actionResult.type === 'success'
                    ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                    : 'bg-rose-50 text-rose-800 border border-rose-200'
                }`}
              >
                {actionResult.type === 'success' ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                ) : (
                  <XCircle className="w-4 h-4 text-rose-600 shrink-0" />
                )}
                <span>{actionResult.text}</span>
              </div>
            )}

            <div className="space-y-4 text-xs">
              <div className="p-3.5 rounded-2xl bg-amber-50 text-amber-900 border border-amber-200 space-y-1">
                <span className="font-bold flex items-center gap-1 text-amber-800">
                  <AlertTriangle className="w-3.5 h-3.5" />
                  Critical Verification Warning:
                </span>
                <p className="leading-relaxed">
                  Approving this request will immediately execute the Python matching engine and generate simulated in-app alerts to all matching, consenting donors registered in Bengaluru.
                </p>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Administrator Audit Notes / Hospital Clearance Check *
                </label>
                <textarea
                  rows={3}
                  required
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Record verification confirmation note with hospital desk..."
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 outline-hidden focus:border-red-500"
                />
              </div>

              <div className="flex flex-col sm:flex-row gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => handleVerify('APPROVE')}
                  disabled={actionLoading}
                  className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-md shadow-emerald-600/20 transition disabled:opacity-60"
                >
                  <Radio className="w-4 h-4" />
                  <span>Approve & Dispatch Matching Alerts</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleVerify('REJECT')}
                  disabled={actionLoading}
                  className="px-5 py-3 rounded-xl bg-rose-100 hover:bg-rose-200 text-rose-800 font-bold text-xs transition disabled:opacity-60"
                >
                  Reject Request
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default VerificationQueuePage;
