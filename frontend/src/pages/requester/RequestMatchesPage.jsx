import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import apiClient from '../../api/client';
import StatusBadge from '../../components/StatusBadge';
import BloodGroupBadge from '../../components/BloodGroupBadge';
import ClinicalDisclaimer from '../../components/ClinicalDisclaimer';
import {
  Users,
  ArrowLeft,
  HeartHandshake,
  MapPin,
  Clock,
  ShieldCheck,
  CheckCircle2,
  Sparkles,
  Phone
} from 'lucide-react';

const RequestMatchesPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [matches, setMatches] = useState([]);
  const [request, setRequest] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [reqRes, matchRes] = await Promise.all([
          apiClient.get(`/requests/${id}/`),
          apiClient.get(`/matching/request/${id}/`),
        ]);
        setRequest(reqRes.data);
        setMatches(matchRes.data || []);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [id]);

  if (loading) {
    return <div className="py-12 text-center text-slate-400 text-xs">Computing matching potential donors...</div>;
  }

  const acceptedCount = matches.filter((m) => m.alert_status === 'ACCEPTED').length;

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <button
          onClick={() => navigate(`/requester/requests/${id}`)}
          className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-900 transition"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Request Details</span>
        </button>

        <span className="text-xs text-slate-500">
          Case: <strong className="text-slate-800">{request?.reference_number}</strong>
        </span>
      </div>

      <ClinicalDisclaimer compact={true} />

      {/* Header Overview Card */}
      <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <span className="text-xs font-bold text-red-600 uppercase tracking-wider">
            Autonomous Matching Engine
          </span>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight mt-0.5">
            Potential Donor Matches ({matches.length})
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Donors matched by ABO/Rh compatibility, availability, and geographic proximity to {request?.hospital_name}.
          </p>
        </div>

        <div className="p-3 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center gap-2 shrink-0">
          <HeartHandshake className="w-4 h-4 text-emerald-600 shrink-0" />
          <span><strong>{acceptedCount}</strong> Donor(s) have accepted this alert</span>
        </div>
      </div>

      {/* Matches List */}
      {matches.length === 0 ? (
        <div className="p-12 text-center bg-white rounded-3xl border border-slate-200 text-slate-400 text-xs space-y-2">
          <p className="font-semibold text-slate-700">No matching donors identified yet.</p>
          <p>
            Once an administrator verifies and approves your emergency request, the matching engine runs automatically to discover consenting, compatible donors.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {matches.map((match) => (
            <div
              key={match.id}
              className={`p-6 rounded-3xl bg-white border transition shadow-2xs space-y-4 ${
                match.alert_status === 'ACCEPTED'
                  ? 'border-emerald-300 ring-2 ring-emerald-100 bg-emerald-50/20'
                  : 'border-slate-200 hover:border-slate-300'
              }`}
            >
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                <div className="flex items-start gap-3">
                  <BloodGroupBadge group={match.donor_details?.blood_group} size="lg" />
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <h3 className="font-extrabold text-sm text-slate-900">
                        {match.donor_details?.display_name || `Donor #${match.donor}`}
                      </h3>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-100 text-red-700">
                        Score: {match.compatibility_score}%
                      </span>
                    </div>

                    <p className="text-xs text-slate-600 flex items-center gap-1.5">
                      <MapPin className="w-3.5 h-3.5 text-slate-400" />
                      <span>{match.donor_details?.locality || 'Bengaluru'}, {match.donor_details?.city}</span>
                      {match.distance_km && (
                        <span className="text-slate-500">&bull; ~{match.distance_km} km away</span>
                      )}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <StatusBadge type="alert_response" value={match.alert_status} size="sm" />
                </div>
              </div>

              {/* Match Explanation */}
              <div className="p-3 rounded-xl bg-slate-50 text-[11px] text-slate-600 space-y-1 border border-slate-100">
                <span className="font-bold text-slate-700 uppercase tracking-wider text-[10px]">
                  Matching Rationale & Compatibility Notes:
                </span>
                <p className="leading-relaxed">{match.match_explanation}</p>
              </div>

              {/* Donor Response Message if Accepted */}
              {match.donor_response_message && (
                <div className="p-3.5 rounded-xl bg-emerald-50/80 border border-emerald-200 text-xs text-emerald-950 space-y-1">
                  <span className="font-bold flex items-center gap-1 text-emerald-800">
                    <HeartHandshake className="w-3.5 h-3.5" />
                    Donor Response Statement:
                  </span>
                  <p className="italic">"{match.donor_response_message}"</p>
                  <p className="text-[10px] text-emerald-700 pt-0.5">
                    Responded: {new Date(match.responded_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
              )}

              {/* Privacy Notice on Donor Contact */}
              <div className="text-[11px] text-slate-400 flex items-center justify-between border-t border-slate-100 pt-3">
                <span>Contact Method: {match.donor_details?.contact_phone || 'Hospital Coordination Desk'}</span>
                <span>Consent Status: Verified Active</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default RequestMatchesPage;
