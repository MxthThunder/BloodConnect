import React from 'react';
import { ShieldAlert } from 'lucide-react';

const ClinicalDisclaimer = ({ compact = false, className = '' }) => {
  if (compact) {
    return (
      <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg bg-amber-50 border border-amber-200 text-amber-800 text-xs ${className}`}>
        <ShieldAlert className="w-4 h-4 text-amber-600 shrink-0" />
        <span>
          <strong>Clinical Safety Notice:</strong> Potential donor matching only. Transfusion compatibility, antibody screening, and final suitability must be confirmed by the authorized blood bank.
        </span>
      </div>
    );
  }

  return (
    <div className={`p-4 rounded-xl bg-amber-50/80 border border-amber-200 text-amber-900 shadow-sm ${className}`}>
      <div className="flex items-start gap-3">
        <div className="p-2 bg-amber-100 rounded-lg text-amber-700 shrink-0 mt-0.5">
          <ShieldAlert className="w-5 h-5" />
        </div>
        <div className="space-y-1 text-xs sm:text-sm">
          <h4 className="font-semibold text-amber-950">
            Clinical Safety & Transfusion Compatibility Notice
          </h4>
          <p className="text-amber-800 leading-relaxed">
            BloodConnect operates as a rapid identification and communication platform for potential voluntary donors. ABO/Rh compatibility rules alone do not guarantee transfusion safety. All actual blood donations, component separation, infectious disease testing, antibody screening, and crossmatching must be conducted by qualified blood bank medical personnel prior to any clinical administration.
          </p>
        </div>
      </div>
    </div>
  );
};

export default ClinicalDisclaimer;
