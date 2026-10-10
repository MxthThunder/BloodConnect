import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import apiClient from '../../api/client';
import StatusBadge from '../../components/StatusBadge';
import BloodGroupBadge from '../../components/BloodGroupBadge';
import ClinicalDisclaimer from '../../components/ClinicalDisclaimer';
import {
  Building2,
  Clock,
  Phone,
  ShieldCheck,
  HeartHandshake,
  Users,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  ArrowLeft,
  Share2
} from 'lucide-react';

const RequestDetailPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [request, setRequest] = useState(null);
  const [loading, setLoading] = useState(true);
  const [cancelling, setCancelling] = useState(false);

  const fetchRequest = async () => {
    try {
      const res = await apiClient.get(`/requests/${id}/`);
      setRequest(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRequest();
  }, [id]);

  const handleCancel = async () => {
    if (!window.confirm('Are you sure you want to cancel this emergency request?')) return;
    setCancelling(true);
    try {
      await apiClient.post(`/requests/${id}/cancel/`);
      fetchRequest();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to cancel request');
    } finally {
      setCancelling(false);
    }
  };

  if (loading) {
    return <div className="py-12 text-center text-slate-400 text-xs">Loading request details...</div>;
  }

  if (!request) {
    return (
      <div className="p-8 text-center bg-white rounded-3xl border border-slate-200 text-slate-500 text-xs">
        Request not found or unauthorized.
      </div>
    );
  }

  // Visual Timeline Stepper Steps
  const steps = [
    { label: 'Submitted', done: true },
    { label: 'Admin Verified', done: request.verification_status === 'APPROVED' },
    { label: 'Alerts Dispatched', done: ['ACTIVE_ALERTS_SENT', 'DONOR_RESPONDED', 'FULFILLED'].includes(request.request_status) },
    { label: 'Donor Responded', done: ['DONOR_RESPONDED', 'FULFILLED'].includes(request.request_status) },
    { label: 'Transfusion Fulfilled', done: request.request_status === 'FULFILLED' },
  ];

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <button
          onClick={() => navigate('/requester/my-requests')}
          className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-900 transition"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Requests</span>
        </button>

        <Link
          to={`/requester/requests/${request.id}/matches`}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-red-600 text-white font-bold text-xs hover:bg-red-700 transition shadow-sm shadow-red-600/20"
        >
          <Users className="w-4 h-4" />
          <span>View Matching Donors ({request.responses_count || 0})</span>
        </Link>
      </div>

      <ClinicalDisclaimer compact={true} />

      {/* Main Status Header Card */}
      <div className="bg-white p-6 sm:p-8 rounded-3xl border border-slate-200 shadow-sm space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 border-b border-slate-100 pb-6">
          <div className="flex items-start gap-4">
            <BloodGroupBadge group={request.blood_group} size="xl" />
            <div className="space-y-1">
              <span className="text-[11px] font-bold text-red-600 uppercase tracking-wider">
                Emergency Case Reference
              </span>
              <h1 className="text-2xl font-black text-slate-900">
                {request.reference_number}
              </h1>
              <p className="text-xs text-slate-600">
                Required: <strong className="text-slate-900">{request.units_requested} unit(s)</strong> of {request.component}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap sm:flex-col sm:items-end gap-2">
            <StatusBadge type="urgency" value={request.urgency} size="sm" />
            <StatusBadge type="verification" value={request.verification_status} size="sm" />
            <StatusBadge type="request_status" value={request.request_status} size="sm" />
          </div>
        </div>

        {/* Visual Lifecycle Progress Bar */}
        <div className="space-y-2">
          <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
            Verification & Dispatch Lifecycle
          </h3>
          <div className="grid grid-cols-5 gap-2 pt-2">
            {steps.map((st, i) => (
              <div key={i} className="text-center space-y-1.5">
                <div
                  className={`h-2 rounded-full transition-all ${
                    st.done ? 'bg-emerald-500' : 'bg-slate-200'
                  }`}
                />
                <span className={`text-[10px] block font-semibold truncate ${
                  st.done ? 'text-slate-800' : 'text-slate-400'
                }`}>
                  {st.label}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Request Details Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs pt-4 border-t border-slate-100">
          <div className="p-4 rounded-2xl bg-slate-50 space-y-2">
            <span className="font-bold text-slate-500 uppercase text-[10px]">Hospital Facility</span>
            <div className="font-bold text-sm text-slate-900 flex items-center gap-1.5">
              <Building2 className="w-4 h-4 text-slate-400" />
              <span>{request.hospital_name}</span>
            </div>
            <p className="text-slate-600">{request.hospital_address}, {request.city}</p>
            {request.patient_case_ref && (
              <p className="text-slate-500 text-[11px]">Bed / Case ID: {request.patient_case_ref}</p>
            )}
          </div>

          <div className="p-4 rounded-2xl bg-slate-50 space-y-2">
            <span className="font-bold text-slate-500 uppercase text-[10px]">Timeline & Coordination</span>
            <div className="font-bold text-sm text-slate-900 flex items-center gap-1.5">
              <Clock className="w-4 h-4 text-slate-400" />
              <span>Required by: {new Date(request.required_by).toLocaleString()}</span>
            </div>
            <p className="text-slate-600 flex items-center gap-1.5">
              <Phone className="w-3.5 h-3.5 text-slate-400" />
              <span>Contact: {request.contact_phone}</span>
            </p>
            <p className="text-slate-500 text-[11px]">Preference: {request.contact_preference}</p>
          </div>
        </div>

        {/* Clinical Rationale & Admin Notes */}
        {request.reason && (
          <div className="p-4 rounded-2xl bg-slate-50 text-xs space-y-1">
            <span className="font-bold text-slate-500 uppercase text-[10px]">Clinical Justification</span>
            <p className="text-slate-700 leading-relaxed">{request.reason}</p>
          </div>
        )}

        {request.verification_notes && (
          <div className="p-4 rounded-2xl bg-blue-50/60 border border-blue-200 text-xs space-y-1">
            <span className="font-bold text-blue-900 uppercase text-[10px]">Administrator Verification Notes</span>
            <p className="text-blue-800 leading-relaxed">{request.verification_notes}</p>
            {request.verified_by_name && (
              <p className="text-[10px] text-blue-600 pt-1">Verified by {request.verified_by_name}</p>
            )}
          </div>
        )}

        {/* Cancellation Action */}
        {!['FULFILLED', 'CLOSED', 'CANCELLED'].includes(request.request_status) && (
          <div className="pt-4 border-t border-slate-100 flex justify-end">
            <button
              onClick={handleCancel}
              disabled={cancelling}
              className="text-xs text-rose-600 hover:text-rose-700 font-semibold transition disabled:opacity-60"
            >
              Cancel this request
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default RequestDetailPage;
