import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import apiClient from '../api/client';
import BloodGroupBadge from '../components/BloodGroupBadge';
import ClinicalDisclaimer from '../components/ClinicalDisclaimer';
import StockMap from '../components/StockMap';
import {
  Heart,
  Search,
  PlusCircle,
  Building2,
  ShieldCheck,
  Clock,
  Radio,
  ArrowRight,
  AlertCircle,
  CheckCircle2,
  Activity,
  Users
} from 'lucide-react';

const LandingPage = () => {
  const [stocks, setStocks] = useState([]);
  const [bloodBanks, setBloodBanks] = useState([]);
  const [selectedGroup, setSelectedGroup] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [stockRes, bankRes] = await Promise.all([
          apiClient.get('/bloodbank/stock/'),
          apiClient.get('/bloodbank/banks/'),
        ]);
        setStocks(stockRes.data || []);
        setBloodBanks(bankRes.data || []);
      } catch (err) {
        console.error('Error loading landing page inventory data', err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const bloodGroups = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];

  const filteredStocks = selectedGroup
    ? stocks.filter((s) => s.blood_group === selectedGroup)
    : stocks;

  return (
    <div className="space-y-16 sm:space-y-24 pb-20">
      {/* 1. HERO SECTION */}
      <section className="relative overflow-hidden bg-gradient-to-b from-red-50/70 via-white to-slate-50 pt-16 pb-20 sm:pt-24 sm:pb-28 border-b border-slate-200/60">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
            <div className="lg:col-span-7 space-y-6 text-center lg:text-left">
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-red-100/80 border border-red-200 text-red-800 text-xs font-semibold">
                <span className="w-2 h-2 rounded-full bg-red-600 animate-pulse" />
                <span>Verified Emergency Blood Alert Network</span>
              </div>

              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black text-slate-900 tracking-tight leading-[1.1]">
                Find Blood. <br className="hidden sm:inline" />
                <span className="text-red-600 underline decoration-red-200 underline-offset-8">
                  Connect Lives.
                </span>
              </h1>

              <p className="text-lg sm:text-xl text-slate-600 max-w-2xl font-normal leading-relaxed">
                BloodConnect helps connect urgent blood requests with potential donors and supports better visibility into blood availability during critical medical emergencies.
              </p>

              {/* Primary Call to Actions */}
              <div className="pt-2 flex flex-wrap items-center justify-center lg:justify-start gap-4">
                <Link
                  to="/register?role=requester"
                  className="flex items-center gap-2 px-6 py-3.5 rounded-xl bg-red-600 text-white font-bold text-sm sm:text-base hover:bg-red-700 transition shadow-lg shadow-red-600/25"
                >
                  <PlusCircle className="w-5 h-5" />
                  <span>Request Blood</span>
                </Link>
                <Link
                  to="/register?role=donor"
                  className="flex items-center gap-2 px-6 py-3.5 rounded-xl bg-slate-900 text-white font-bold text-sm sm:text-base hover:bg-slate-800 transition shadow-lg shadow-slate-900/15"
                >
                  <Heart className="w-5 h-5 text-red-400" />
                  <span>Become a Donor</span>
                </Link>
                <a
                  href="#stock-overview"
                  className="flex items-center gap-2 px-5 py-3.5 rounded-xl bg-white border border-slate-300 text-slate-700 font-semibold text-sm sm:text-base hover:bg-slate-50 transition"
                >
                  <Search className="w-4 h-4 text-slate-500" />
                  <span>Find Donors & Stocks</span>
                </a>
              </div>

              {/* Verified Trust Stats */}
              <div className="pt-6 border-t border-slate-200/80 grid grid-cols-3 gap-4 max-w-md mx-auto lg:mx-0 text-center lg:text-left">
                <div>
                  <div className="text-2xl font-black text-slate-900">8 Groups</div>
                  <div className="text-xs text-slate-500 font-medium">ABO/Rh Compatibility</div>
                </div>
                <div>
                  <div className="text-2xl font-black text-red-600">&lt; 15 Mins</div>
                  <div className="text-xs text-slate-500 font-medium">Matching Latency</div>
                </div>
                <div>
                  <div className="text-2xl font-black text-slate-900">100%</div>
                  <div className="text-xs text-slate-500 font-medium">Consent-Mediated</div>
                </div>
              </div>
            </div>

            {/* Hero Quick Card */}
            <div className="lg:col-span-5">
              <div className="relative rounded-3xl bg-white p-6 sm:p-8 shadow-2xl border border-slate-200/80 space-y-6">
                <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                  <div className="flex items-center gap-2.5">
                    <div className="p-2.5 rounded-xl bg-red-100 text-red-600">
                      <Activity className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="font-bold text-sm text-slate-900">Live Matching Simulation</h3>
                      <p className="text-[11px] text-slate-500">Autonomous Triaged Matching</p>
                    </div>
                  </div>
                  <span className="px-2.5 py-1 text-[11px] font-bold rounded-full bg-emerald-100 text-emerald-800">
                    System Active
                  </span>
                </div>

                <div className="space-y-3 text-xs">
                  <div className="p-3 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-between">
                    <span className="text-slate-500">Universal Red Cell Donor</span>
                    <BloodGroupBadge group="O-" size="sm" />
                  </div>
                  <div className="p-3 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-between">
                    <span className="text-slate-500">Universal Plasma Donor</span>
                    <BloodGroupBadge group="AB+" size="sm" />
                  </div>
                  <div className="p-3 rounded-xl bg-red-50/60 border border-red-100 flex items-center justify-between">
                    <span className="text-red-900 font-medium">Emergency Stock Shortage Tracking</span>
                    <span className="font-bold text-red-600">3 Threshold Alarms</span>
                  </div>
                </div>

                <ClinicalDisclaimer compact={true} />

                <Link
                  to="/how-it-works"
                  className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs transition"
                >
                  <span>Explore Technical Workflow Diagram</span>
                  <ArrowRight className="w-4 h-4" />
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 2. HOW IT WORKS SECTION */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
        <div className="text-center space-y-3 max-w-3xl mx-auto">
          <span className="text-xs font-bold text-red-600 uppercase tracking-wider">
            Clear Four-Step Process
          </span>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">
            How BloodConnect Operates in Emergencies
          </h2>
          <p className="text-sm sm:text-base text-slate-600">
            A structured, medically responsible pathway that safeguards donor privacy while prioritizing life-saving speed.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          {[
            {
              step: '01',
              title: 'Request Submission',
              desc: 'Requester specifies blood group, hospital facility, units, and urgency level with patient verification token.',
              icon: PlusCircle,
            },
            {
              step: '02',
              title: 'Admin Verification',
              desc: 'Medical administrator verifies hospital admission details before broadcasting to prevent fraudulent alerts.',
              icon: ShieldCheck,
            },
            {
              step: '03',
              title: 'Algorithmic Matching',
              desc: 'Backend matching engine ranks consented donors based on ABO/Rh compatibility, locality, and availability.',
              icon: Radio,
            },
            {
              step: '04',
              title: 'Alert & Hospital Intake',
              desc: 'Donors receive instant alerts to accept or decline. Blood bank conducts mandatory crossmatching upon arrival.',
              icon: Heart,
            },
          ].map((s) => (
            <div
              key={s.step}
              className="p-6 rounded-2xl bg-white border border-slate-200/80 shadow-xs hover:shadow-md transition space-y-4 relative"
            >
              <div className="text-4xl font-black text-red-100">{s.step}</div>
              <div className="p-3 w-fit rounded-xl bg-red-50 text-red-600">
                <s.icon className="w-5 h-5" />
              </div>
              <h3 className="font-bold text-base text-slate-900">{s.title}</h3>
              <p className="text-xs text-slate-600 leading-relaxed">{s.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* 3. CORE FEATURES */}
      <section className="bg-slate-900 text-white py-20 border-y border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
          <div className="text-center space-y-3 max-w-2xl mx-auto">
            <span className="text-xs font-bold text-red-400 uppercase tracking-wider">
              System Capabilities
            </span>
            <h2 className="text-3xl sm:text-4xl font-black tracking-tight text-white">
              The Three Core Concepts
            </h2>
            <p className="text-sm text-slate-400">
              Built to address the identified pain points in conventional, fragmented blood finding methods.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="p-8 rounded-2xl bg-slate-800/80 border border-slate-700/80 space-y-4">
              <div className="w-12 h-12 rounded-xl bg-red-600/20 text-red-400 border border-red-500/30 flex items-center justify-center">
                <Radio className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-white">
                1. Smart Emergency Donor Matching
              </h3>
              <p className="text-xs text-slate-300 leading-relaxed">
                Rules-based compatibility engine factoring in ABO/Rh criteria, geographical proximity, recent donation dates, and verified availability.
              </p>
            </div>

            <div className="p-8 rounded-2xl bg-slate-800/80 border border-slate-700/80 space-y-4">
              <div className="w-12 h-12 rounded-xl bg-amber-600/20 text-amber-400 border border-amber-500/30 flex items-center justify-center">
                <Building2 className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-white">
                2. Real-Time Stock & Shortage Monitoring
              </h3>
              <p className="text-xs text-slate-300 leading-relaxed">
                Continuous inventory tracking across regional blood banks. Configurable safety thresholds automatically raise low-stock alerts before exhaustion occurs.
              </p>
            </div>

            <div className="p-8 rounded-2xl bg-slate-800/80 border border-slate-700/80 space-y-4">
              <div className="w-12 h-12 rounded-xl bg-emerald-600/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center">
                <ShieldCheck className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-white">
                3. Verified Emergency Blood Alert Network
              </h3>
              <p className="text-xs text-slate-300 leading-relaxed">
                Eliminates panic-induced social media broadcast noise. Every emergency alert is administrator-vetted and delivered only to willing donors.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* 4. BLOOD GROUP COMPATIBILITY MATRIX */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
        <div className="text-center space-y-2">
          <span className="text-xs font-bold text-red-600 uppercase tracking-wider">
            Clinical Reference Guide
          </span>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900">
            Red Blood Cell Compatibility Matrix
          </h2>
          <p className="text-xs sm:text-sm text-slate-600 max-w-xl mx-auto">
            Understanding biological matching compatibility rules applied in the BloodConnect matching service.
          </p>
        </div>

        <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-xs">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-100/80 text-slate-700 font-bold uppercase text-[11px] border-b border-slate-200">
              <tr>
                <th className="py-3.5 px-4">Recipient Blood Group</th>
                <th className="py-3.5 px-4">Can Receive Red Blood Cells From</th>
                <th className="py-3.5 px-4">Can Donate Red Blood Cells To</th>
                <th className="py-3.5 px-4">Special Medical Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {[
                { r: 'O-', canReceive: ['O-'], canDonate: ['All Groups (O-, O+, A-, A+, B-, B+, AB-, AB+)'], status: 'Universal Red Cell Donor' },
                { r: 'O+', canReceive: ['O-', 'O+'], canDonate: ['O+', 'A+', 'B+', 'AB+'], status: 'Most Common Blood Group' },
                { r: 'A-', canReceive: ['O-', 'A-'], canDonate: ['A-', 'A+', 'AB-', 'AB+'], status: 'Rare Rh-negative' },
                { r: 'A+', canReceive: ['O-', 'O+', 'A-', 'A+'], canDonate: ['A+', 'AB+'], status: 'High Hospital Demand' },
                { r: 'B-', canReceive: ['O-', 'B-'], canDonate: ['B-', 'B+', 'AB-', 'AB+'], status: 'Rare Rh-negative' },
                { r: 'B+', canReceive: ['O-', 'O+', 'B-', 'B+'], canDonate: ['B+', 'AB+'], status: 'High Regional Demand' },
                { r: 'AB-', canReceive: ['O-', 'A-', 'B-', 'AB-'], canDonate: ['AB-', 'AB+'], status: 'Very Rare Blood Group' },
                { r: 'AB+', canReceive: ['All Groups (O-, O+, A-, A+, B-, B+, AB-, AB+)'], canDonate: ['AB+ only'], status: 'Universal Red Cell Recipient' },
              ].map((row) => (
                <tr key={row.r} className="hover:bg-slate-50/70 transition">
                  <td className="py-3 px-4 font-extrabold text-slate-900 flex items-center gap-2">
                    <BloodGroupBadge group={row.r} size="sm" />
                  </td>
                  <td className="py-3 px-4 font-semibold text-slate-800">
                    {row.canReceive.join(', ')}
                  </td>
                  <td className="py-3 px-4 text-slate-600">
                    {row.canDonate.join(', ')}
                  </td>
                  <td className="py-3 px-4">
                    <span className="px-2 py-0.5 rounded-md text-[11px] font-semibold bg-slate-100 text-slate-700">
                      {row.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* 5. SAMPLE STOCK OVERVIEW (Clearly marked demonstration data) */}
      <section id="stock-overview" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8 scroll-mt-24">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-amber-100 text-amber-900 text-[11px] font-bold mb-2">
              <AlertCircle className="w-3.5 h-3.5 text-amber-600" />
              <span>Sample Data — Academic Demonstration Only</span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900">
              Regional Blood Centre Stock Overview
            </h2>
            <p className="text-xs sm:text-sm text-slate-500">
              Live database queries of sample blood bank inventories across monitored facilities in Bengaluru.
            </p>
          </div>

          {/* Blood group filter pills */}
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              onClick={() => setSelectedGroup('')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                selectedGroup === ''
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
              }`}
            >
              All Groups
            </button>
            {bloodGroups.map((bg) => (
              <button
                key={bg}
                onClick={() => setSelectedGroup(bg)}
                className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition ${
                  selectedGroup === bg
                    ? 'bg-red-600 text-white shadow-xs'
                    : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                {bg}
              </button>
            ))}
          </div>
        </div>

        {/* Stock Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {loading ? (
            <div className="col-span-full py-12 text-center text-slate-400 text-sm">
              Loading demonstration stock levels...
            </div>
          ) : filteredStocks.length === 0 ? (
            <div className="col-span-full py-12 text-center text-slate-400 text-sm">
              No stock entries found for selected filter.
            </div>
          ) : (
            filteredStocks.slice(0, 8).map((stock) => (
              <div
                key={stock.id}
                className={`p-4 rounded-xl border transition bg-white shadow-2xs ${
                  stock.is_low_stock
                    ? 'border-red-300 bg-red-50/20'
                    : 'border-slate-200 hover:border-slate-300'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <BloodGroupBadge group={stock.blood_group} size="md" />
                  {stock.is_low_stock ? (
                    <span className="px-2 py-0.5 rounded-md bg-red-100 text-red-700 text-[10px] font-bold">
                      Low Stock Warning
                    </span>
                  ) : (
                    <span className="px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800 text-[10px] font-medium">
                      Available
                    </span>
                  )}
                </div>

                <div className="mt-3">
                  <div className="text-2xl font-black text-slate-900">
                    {stock.units_available}{' '}
                    <span className="text-xs font-normal text-slate-500">units</span>
                  </div>
                  <p className="text-xs font-semibold text-slate-700 mt-1 truncate">
                    {stock.bank_name}
                  </p>
                  <p className="text-[11px] text-slate-400">{stock.component}</p>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Interactive OpenStreetMap */}
        <div className="space-y-3 pt-4">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-sm text-slate-900 flex items-center gap-2">
              <Building2 className="w-4 h-4 text-red-600" />
              <span>Monitored Blood Bank Centers Map (Bengaluru)</span>
            </h3>
            <span className="text-xs text-slate-400">Powered by OpenStreetMap & Leaflet</span>
          </div>
          <StockMap bloodBanks={bloodBanks} height="340px" />
        </div>
      </section>

      {/* 6. EMERGENCY CTA BANNER */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="rounded-3xl bg-gradient-to-r from-red-600 via-red-700 to-rose-700 text-white p-8 sm:p-12 shadow-xl shadow-red-600/20 flex flex-col md:flex-row items-center justify-between gap-8 text-center md:text-left">
          <div className="space-y-3 max-w-xl">
            <h2 className="text-2xl sm:text-3xl font-black">
              Experiencing an Emergency Transfusion Requirement?
            </h2>
            <p className="text-xs sm:text-sm text-red-100 leading-relaxed">
              Submit your blood request to notify verified administrators and trigger rapid matching with local donors.
            </p>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-3 shrink-0">
            <Link
              to="/register?role=requester"
              className="px-6 py-3 rounded-xl bg-white text-red-700 font-extrabold text-sm hover:bg-red-50 transition shadow-md"
            >
              Submit Emergency Request
            </Link>
            <Link
              to="/login"
              className="px-6 py-3 rounded-xl bg-red-900/40 border border-white/20 text-white font-bold text-sm hover:bg-red-900/60 transition"
            >
              Portal Login
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
};

export default LandingPage;
