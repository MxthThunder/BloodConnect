import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import apiClient from '../../api/client';
import StatusBadge from '../../components/StatusBadge';
import BloodGroupBadge from '../../components/BloodGroupBadge';
import ClinicalDisclaimer from '../../components/ClinicalDisclaimer';
import {
  Building2,
  Clock,
  HeartHandshake,
  CheckCircle2,
  XCircle,
  ArrowLeft,
  AlertTriangle,
  Send,
  MapPin
} from 'lucide-react';

const DonorAlertDetailPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [match, setMatch] = useState(null);
  const [loading, setLoading] = useState(true);
  const [responseMsg, setResponseMsg] = useState('I am available and will reach the hospital blood bank shortly.');
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState(null);

  const fetchAlert = async () => {
    try {
      const res = await apiClient.get(`/matching/donor-alerts/${id}/`);
      setMatch(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAlert();
  }, [id]);

  const handleRespond = async (statusDecision) => {
    setSubmitting(true);
    setFeedback(null);
    try {
      const res = await apiClient.post(`/matching/donor-alerts/${id}/respond/`, {
        response: statusDecision,
        message: responseMsg,
      });
      setFeedback({
        type: 'success',
        text: `You have successfully ${statusDecision.toLowerCase()} this emergency alert.`,
      });
      fetchAlert();
    } catch (err) {
      setFeedback({
        type: 'error',
        text: err.response?.data?.error || 'Failed to submit response',
      });
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return <div className="py-12 text-center text-slate-400 text-xs">Loading alert details...</div>;
  }

  if (!match) {
    return (
      <div className="p-8 text-center bg-white rounded-3xl border border-slate-200 text-slate-400 text-xs">
        Emergency alert not found or unauthorized.
      </div>
    );
  }

  const req = match.request_details;

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <button
        onClick={() => navigate('/donor/dashboard')}
        className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-900 transition"
      >
        <ArrowLeft className="w-4 h-4" />
        <span>Back to Donor Dashboard</span>
      </button>

      <ClinicalDisclaimer compact={true} />

      {/* Alert Header Card */}
      <div className="bg-white p-6 sm:p-8 rounded-3xl border border-slate-200 shadow-sm space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 border-b border-slate-100 pb-6">
          <div className="flex items-start gap-4">
            <BloodGroupBadge group={req?.blood_group || match.donor_details?.blood_group} size="xl" />
            <div className="space-y-1">
              <span className="text-[11px] font-bold text-red-600 uppercase tracking-wider">
                Emergency Blood Alert
              </span>
              <h1 className="text-2xl font-black text-slate-900">
                {match.request_reference}
              </h1>
              <p className="text-xs text-slate-600">
                Hospital Requirement: <strong className="text-slate-900">{req?.units_requested} unit(s)</strong> of {req?.component}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap sm:flex-col sm:items-end gap-2">
            <StatusBadge type="urgency" value={req?.urgency} size="sm" />
            <StatusBadge type="alert_response" value={match.alert_status} size="sm" />
            <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-red-100 text-red-700">
              Match Score: {match.compatibility_score}%
            </span>
          </div>
        </div>

        {/* Facility Information */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
          <div className="p-4 rounded-2xl bg-slate-50 space-y-2">
            <span className="font-bold text-slate-500 uppercase text-[10px]">Treating Hospital</span>
            <div className="font-bold text-sm text-slate-900 flex items-center gap-1.5">
              <Building2 className="w-4 h-4 text-slate-400" />
              <span>{req?.hospital_name}</span>
            </div>
            <p className="text-slate-600 flex items-center gap-1">
              <MapPin className="w-3.5 h-3.5 text-slate-400" />
              <span>{req?.locality || req?.city}</span>
              {match.distance_km && <span className="text-slate-400">(&sim;{match.distance_km} km away)</span>}
            </p>
          </div>

          <div className="p-4 rounded-2xl bg-slate-50 space-y-2">
            <span className="font-bold text-slate-500 uppercase text-[10px]">Timeline & Case Info</span>
            <div className="font-bold text-sm text-slate-900 flex items-center gap-1.5">
              <Clock className="w-4 h-4 text-slate-400" />
              <span>Required by: {new Date(req?.required_by).toLocaleString()}</span>
            </div>
            <p className="text-slate-600">Verification: Approved by Medical Administrator</p>
          </div>
        </div>

        {/* Matching Rationale */}
        <div className="p-4 rounded-2xl bg-slate-50 text-xs space-y-1">
          <span className="font-bold text-slate-700 uppercase tracking-wider text-[10px]">
            Clinical Matching Rationale:
          </span>
          <p className="text-slate-600 leading-relaxed">{match.match_explanation}</p>
        </div>

        {/* Feedback Alert */}
        {feedback && (
          <div
            className={`p-4 rounded-2xl text-xs font-semibold flex items-center gap-2 ${
              feedback.type === 'success'
                ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                : 'bg-rose-50 text-rose-800 border border-rose-200'
            }`}
          >
            {feedback.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            ) : (
              <XCircle className="w-4 h-4 text-rose-600" />
            )}
            <span>{feedback.text}</span>
          </div>
        )}

        {/* Response Action Form */}
        <div className="p-6 rounded-2xl bg-red-50/50 border border-red-100 space-y-4">
          <h3 className="font-bold text-sm text-slate-900 flex items-center gap-2">
            <HeartHandshake className="w-4 h-4 text-red-600" />
            <span>Respond to Emergency Alert</span>
          </h3>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Your Message or Estimated Time of Arrival (ETA) to the Hospital:
            </label>
            <input
              type="text"
              value={responseMsg}
              onChange={(e) => setResponseMsg(e.target.value)}
              placeholder="e.g. Can reach Victoria Hospital Blood Bank in 30 minutes"
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs focus:border-red-500 outline-hidden bg-white"
            />
          </div>

          <div className="flex flex-col sm:flex-row gap-3 pt-2">
            <button
              onClick={() => handleRespond('ACCEPTED')}
              disabled={submitting}
              className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-md shadow-emerald-600/20 transition disabled:opacity-60"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>Accept Alert & Standby to Donate</span>
            </button>

            <button
              onClick={() => handleRespond('DECLINED')}
              disabled={submitting}
              className="px-6 py-3 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold text-xs transition disabled:opacity-60"
            >
              <XCircle className="w-4 h-4 inline-block mr-1" />
              <span>Decline Alert</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DonorAlertDetailPage;
