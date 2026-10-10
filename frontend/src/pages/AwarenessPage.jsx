import React from 'react';
import { Link } from 'react-router-dom';
import { Heart, CheckCircle2, XCircle, Info, ShieldAlert, Award } from 'lucide-react';

const AwarenessPage = () => {
  const myths = [
    {
      myth: 'Donating blood makes you physically weak or permanently drains your energy.',
      fact: 'The human body naturally replenishes the lost plasma volume within 24 to 48 hours, and red blood cells are fully regenerated within a few weeks.',
    },
    {
      myth: 'You cannot donate if you have taken common vaccinations or antibiotics previously.',
      fact: 'Most routine vaccinations only require a short deferral period of 14 to 28 days. Blood bank doctors evaluate individual medical clearance on-site.',
    },
    {
      myth: 'Rare blood groups (like O- or AB-) are rarely needed.',
      fact: 'O- is the universal red cell donor utilized in trauma care emergencies when patient blood grouping is undetermined. It is constantly in critical deficit.',
    },
    {
      myth: 'Donation requires fasting beforehand.',
      fact: 'Donors should never fast before donating. You should eat a healthy meal and drink abundant water 2-3 hours prior to donation.',
    },
  ];

  const eligibility = [
    'Age between 18 and 65 years.',
    'Weight greater than or equal to 45 kg (50 kg for platelet apheresis).',
    'Hemoglobin level greater than or equal to 12.5 g/dL.',
    'At least 90 days (3 months) since previous whole blood donation (for males), and 120 days for females.',
    'Normal pulse rate (60–100 bpm) and blood pressure within clinical parameters.',
    'Free from active systemic infections, fever, cold, or untreated cardiac conditions.',
  ];

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12 space-y-16">
      <div className="text-center space-y-4 max-w-3xl mx-auto">
        <span className="text-xs font-bold text-red-600 uppercase tracking-wider">
          Educational Resources
        </span>
        <h1 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">
          Blood Donation Awareness & Guidelines
        </h1>
        <p className="text-sm sm:text-base text-slate-600">
          Understanding voluntary donation criteria, clinical benefits, and breaking common misconceptions.
        </p>
      </div>

      {/* Hero Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="p-6 rounded-2xl bg-white border border-slate-200/80 shadow-xs space-y-2">
          <div className="text-3xl font-black text-red-600">1 Unit</div>
          <h3 className="font-bold text-slate-900 text-sm">Saves Up to 3 Lives</h3>
          <p className="text-xs text-slate-500 leading-relaxed">
            One whole blood unit can be separated into Packed Red Blood Cells, Fresh Frozen Plasma, and Platelet Concentrates.
          </p>
        </div>

        <div className="p-6 rounded-2xl bg-white border border-slate-200/80 shadow-xs space-y-2">
          <div className="text-3xl font-black text-slate-900">350 - 450 mL</div>
          <h3 className="font-bold text-slate-900 text-sm">Standard Donation Volume</h3>
          <p className="text-xs text-slate-500 leading-relaxed">
            Accounts for less than 8% of an average adult's total blood volume and is safely regenerated rapidly.
          </p>
        </div>

        <div className="p-6 rounded-2xl bg-white border border-slate-200/80 shadow-xs space-y-2">
          <div className="text-3xl font-black text-emerald-600">90 Days</div>
          <h3 className="font-bold text-slate-900 text-sm">Safe Donation Interval</h3>
          <p className="text-xs text-slate-500 leading-relaxed">
            Ensures iron stores and red cell counts return to baseline before the next voluntary donation drive.
          </p>
        </div>
      </div>

      {/* Eligibility Checklist */}
      <div className="p-8 rounded-3xl bg-white border border-slate-200/80 shadow-sm space-y-6">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-emerald-100 text-emerald-700">
            <Award className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-slate-900">
              General Donor Eligibility Criteria
            </h2>
            <p className="text-xs text-slate-500">Standard National Blood Transfusion Council (NBTC) norms</p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {eligibility.map((item, i) => (
            <div key={i} className="flex items-start gap-2.5 p-3.5 rounded-xl bg-slate-50 border border-slate-100 text-xs">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              <span className="text-slate-700 leading-relaxed">{item}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Myths vs Facts */}
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">
            Myths vs. Medical Facts
          </h2>
          <p className="text-xs sm:text-sm text-slate-500">
            Dispelling fears through evidence-based medical realities.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {myths.map((m, i) => (
            <div key={i} className="p-6 rounded-2xl bg-white border border-slate-200/80 shadow-xs space-y-3">
              <div className="flex items-start gap-2 text-rose-700 text-xs font-semibold">
                <XCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>Myth: {m.myth}</span>
              </div>
              <div className="flex items-start gap-2 text-emerald-800 text-xs font-medium pl-2 border-l-2 border-emerald-500">
                <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-emerald-600" />
                <span>Fact: {m.fact}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* CTA */}
      <div className="p-8 rounded-3xl bg-red-600 text-white flex flex-col sm:flex-row items-center justify-between gap-6 text-center sm:text-left">
        <div className="space-y-2">
          <h3 className="text-2xl font-bold">Be Ready When an Emergency Strikes</h3>
          <p className="text-xs text-red-100">
            Register on BloodConnect today so that verified hospital emergencies can reach you when your blood group is needed.
          </p>
        </div>
        <Link
          to="/register?role=donor"
          className="px-6 py-3 rounded-xl bg-white text-red-700 font-bold text-xs hover:bg-red-50 transition shadow-md shrink-0"
        >
          Register as Donor
        </Link>
      </div>
    </div>
  );
};

export default AwarenessPage;
