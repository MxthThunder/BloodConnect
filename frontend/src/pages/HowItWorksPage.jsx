import React from 'react';
import { Link } from 'react-router-dom';
import ClinicalDisclaimer from '../components/ClinicalDisclaimer';
import { ShieldCheck, Network, Cpu, ArrowRight, CheckCircle2, AlertTriangle, Send } from 'lucide-react';

const HowItWorksPage = () => {
  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12 space-y-16">
      <div className="text-center space-y-4 max-w-3xl mx-auto">
        <span className="text-xs font-bold text-red-600 uppercase tracking-wider">
          Architecture & Workflow
        </span>
        <h1 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">
          How the BloodConnect Matching Engine Works
        </h1>
        <p className="text-sm sm:text-base text-slate-600">
          A deep dive into our verified alert workflow, biological ABO/Rh rules, and hospital-mediated safety barriers.
        </p>
      </div>

      <ClinicalDisclaimer />

      {/* Workflow Steps Breakdown */}
      <div className="space-y-8">
        <h2 className="text-2xl font-bold text-slate-900">
          The Verified End-to-End Emergency Lifecycle
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="p-6 rounded-2xl bg-white border border-slate-200/80 shadow-xs space-y-4">
            <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-700 font-black flex items-center justify-center text-sm">
              Phase 1
            </div>
            <h3 className="font-bold text-base text-slate-900">Request Intake & Triage</h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              When a patient or relative submits an emergency blood request, it enters a <code>PENDING_VERIFICATION</code> state. The requester submits the hospital name, required blood group, units, contact details, and clinical justification.
            </p>
            <div className="text-[11px] text-blue-700 bg-blue-50 p-2.5 rounded-lg border border-blue-200 font-medium">
              &bull; Zero donor alerts are dispatched prior to administrative verification.
            </div>
          </div>

          <div className="p-6 rounded-2xl bg-white border border-slate-200/80 shadow-xs space-y-4">
            <div className="w-10 h-10 rounded-xl bg-red-100 text-red-700 font-black flex items-center justify-center text-sm">
              Phase 2
            </div>
            <h3 className="font-bold text-base text-slate-900">Admin Verification & Matching</h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              An on-duty hospital or system administrator reviews the emergency request. Approving the request changes status to <code>ACTIVE_ALERTS_SENT</code> and automatically executes the Python matching service in real-time.
            </p>
            <div className="text-[11px] text-red-700 bg-red-50 p-2.5 rounded-lg border border-red-200 font-medium">
              &bull; Uses Haversine distance and red cell compatibility rules.
            </div>
          </div>

          <div className="p-6 rounded-2xl bg-white border border-slate-200/80 shadow-xs space-y-4">
            <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-700 font-black flex items-center justify-center text-sm">
              Phase 3
            </div>
            <h3 className="font-bold text-base text-slate-900">Donor Alert & Response</h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              Matching donors receive an urgent in-app alert with the hospital locality and needed units. When a donor accepts, the request moves to <code>DONOR_RESPONDED</code> and the requester is notified.
            </p>
            <div className="text-[11px] text-emerald-700 bg-emerald-50 p-2.5 rounded-lg border border-emerald-200 font-medium">
              &bull; Request is only marked Fulfilled once transfusion is confirmed.
            </div>
          </div>
        </div>
      </div>

      {/* Matching Rules Specification */}
      <div className="p-8 rounded-3xl bg-white border border-slate-200/80 shadow-sm space-y-6">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-red-100 text-red-700">
            <Cpu className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-slate-900">
              Matching Engine Criteria & Ranking Algorithm
            </h2>
            <p className="text-xs text-slate-500">Transparent mathematical scoring formula</p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
            <h4 className="font-bold text-slate-900 flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              1. Biological Red Cell Compatibility (Base Score)
            </h4>
            <p className="text-slate-600 leading-relaxed">
              Exact blood group match earns <strong>100 points</strong>. Medically compatible alternative groups (such as O- universal donor to an A+ recipient) receive <strong>80 points</strong>.
            </p>
          </div>

          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
            <h4 className="font-bold text-slate-900 flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              2. Proximity Bonus (Haversine Formula)
            </h4>
            <p className="text-slate-600 leading-relaxed">
              Donors within 10 km gain <strong>+15 points</strong>. Donors within 25 km gain <strong>+10 points</strong>. Donors sharing the same municipal locality gain <strong>+5 points</strong>.
            </p>
          </div>

          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
            <h4 className="font-bold text-slate-900 flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              3. Availability & Notification Consent
            </h4>
            <p className="text-slate-600 leading-relaxed">
              Donors marked <code>is_available = False</code> or who have withheld consent are completely excluded from alert generation.
            </p>
          </div>

          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
            <h4 className="font-bold text-slate-900 flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              4. Deduplication Safeguards
            </h4>
            <p className="text-slate-600 leading-relaxed">
              Database unique constraints enforce that no donor receives repetitive duplicate alert instances for the exact same emergency case reference.
            </p>
          </div>
        </div>
      </div>

      {/* CTA Box */}
      <div className="p-8 rounded-2xl bg-slate-900 text-white flex flex-col sm:flex-row items-center justify-between gap-6">
        <div>
          <h3 className="text-lg font-bold text-white">Ready to test the live demonstration?</h3>
          <p className="text-xs text-slate-400 mt-1">Use the Demo Switcher at the top right to switch between roles anytime.</p>
        </div>
        <Link
          to="/login"
          className="px-6 py-3 rounded-xl bg-red-600 text-white text-xs font-bold hover:bg-red-700 transition shrink-0"
        >
          Sign In to Portal
        </Link>
      </div>
    </div>
  );
};

export default HowItWorksPage;
