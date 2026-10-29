import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import apiClient from '../api/client';
import BloodGroupBadge from '../components/BloodGroupBadge';
import ClinicalDisclaimer from '../components/ClinicalDisclaimer';
import StockMap from '../components/StockMap';
import { REGIONAL_HOSPITALS } from '../constants/regionalHospitals';
import { CHENNAI_LOCALITIES } from '../constants/chennaiData';
import {
  Heart,
  Search,
  PlusCircle,
  Building2,
  ShieldCheck,
  Radio,
  ArrowRight,
  AlertCircle,
  Activity,
  MapPin,
  CheckCircle2,
  Sparkles,
  PhoneCall,
  Clock,
  LogIn
} from 'lucide-react';

const LandingPage = () => {
  const [stocks, setStocks] = useState([]);
  const [bloodBanks, setBloodBanks] = useState([]);
  const [selectedGroup, setSelectedGroup] = useState('');
  const [selectedLocality, setSelectedLocality] = useState('');
  const [loading, setLoading] = useState(true);

  // Live simulation interactive widget state
  const [simBloodGroup, setSimBloodGroup] = useState('O+');
  const [simLocality, setSimLocality] = useState('Adyar');

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

  // Compatibility helper for live simulation
  const getCompatibleDonors = (bg) => {
    switch (bg) {
      case 'O-': return ['O-'];
      case 'O+': return ['O-', 'O+'];
      case 'A-': return ['O-', 'A-'];
      case 'A+': return ['O-', 'O+', 'A-', 'A+'];
      case 'B-': return ['O-', 'B-'];
      case 'B+': return ['O-', 'O+', 'B-', 'B+'];
      case 'AB-': return ['O-', 'A-', 'B-', 'AB-'];
      case 'AB+': return ['All 8 ABO/Rh Groups'];
      default: return ['O-', bg];
    }
  };

  const filteredStocks = stocks.filter((s) => {
    const matchesGroup = selectedGroup ? s.blood_group === selectedGroup : true;
    const matchesLocality = selectedLocality
      ? (s.bank_locality === selectedLocality || s.bank_name?.toLowerCase().includes(selectedLocality.toLowerCase()))
      : true;
    return matchesGroup && matchesLocality;
  });

  return (
    <div className="space-y-10 sm:space-y-14 pb-16">
      {/* 1. HERO SECTION */}
      <section className="relative overflow-hidden bg-gradient-to-b from-red-50/70 via-white to-slate-50 py-8 sm:py-12 lg:py-14 border-b border-slate-200/60">
        <div className="max-w-[1650px] mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-10 items-center">
            {/* Left Column: Headlines, Info & CTAs */}
            <div className="lg:col-span-7 space-y-5 text-center lg:text-left">
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-red-100/90 border border-red-200 text-red-900 text-xs font-semibold">
                <span className="w-2 h-2 rounded-full bg-red-600 animate-pulse" />
                <span>Chennai Emergency Blood Coordination Network</span>
                <span className="hidden sm:inline text-red-400">&bull;</span>
                <span className="hidden sm:inline text-red-800 font-medium">24/7 Rapid Response Network</span>
              </div>

              <h1 className="text-3xl sm:text-5xl lg:text-5xl font-black text-slate-900 tracking-tight leading-[1.15]">
                Emergency Blood Donor Matching & <br className="hidden sm:inline" />
                <span className="text-red-600 underline decoration-red-200 underline-offset-8">
                  Availability Monitoring
                </span>
              </h1>

              <p className="text-sm sm:text-base lg:text-lg text-slate-600 max-w-2xl font-normal leading-relaxed">
                BloodConnect helps hospitals and patients find compatible blood donors quickly during emergencies across Chennai's 15 localities, combining verified triaging, algorithmic matching, and regional blood bank stock alerts.
              </p>

              {/* Primary Call to Actions */}
              <div className="pt-2 flex flex-wrap items-center justify-center lg:justify-start gap-3">
                <Link
                  to="/register?role=requester"
                  className="flex items-center gap-2 px-5 py-3 rounded-xl bg-red-600 text-white font-bold text-sm hover:bg-red-700 transition shadow-lg shadow-red-600/25 shrink-0"
                >
                  <PlusCircle className="w-4 h-4" />
                  <span>Request Blood</span>
                </Link>
                <Link
                  to="/register?role=donor"
                  className="flex items-center gap-2 px-5 py-3 rounded-xl bg-slate-900 text-white font-bold text-sm hover:bg-slate-800 transition shadow-lg shadow-slate-900/15 shrink-0"
                >
                  <Heart className="w-4 h-4 text-red-400" />
                  <span>Become a Donor</span>
                </Link>
                <Link
                  to="/login"
                  className="flex items-center gap-2 px-5 py-3 rounded-xl bg-white border border-slate-300 text-slate-800 font-bold text-sm hover:border-red-500 hover:text-red-600 hover:bg-red-50/50 transition shadow-xs shrink-0"
                >
                  <LogIn className="w-4 h-4 text-red-600" />
                  <span>Sign In to Portal</span>
                </Link>
                <a
                  href="#stock-overview"
                  className="flex items-center gap-2 px-4 py-3 rounded-xl bg-slate-100 text-slate-700 font-semibold text-sm hover:bg-slate-200 transition shrink-0"
                >
                  <Search className="w-4 h-4 text-slate-500" />
                  <span>Chennai Blood Stocks</span>
                </a>
              </div>

              {/* Chennai Metric Highlights */}
              <div className="pt-4 border-t border-slate-200/80 grid grid-cols-2 sm:grid-cols-4 gap-3 max-w-2xl mx-auto lg:mx-0 text-center lg:text-left">
                <div className="p-2.5 rounded-xl bg-white/80 border border-slate-100">
                  <div className="text-xl sm:text-2xl font-black text-slate-900">15 Localities</div>
                  <div className="text-[11px] text-slate-500 font-medium">Chennai Coverage</div>
                </div>
                <div className="p-2.5 rounded-xl bg-white/80 border border-slate-100">
                  <div className="text-xl sm:text-2xl font-black text-red-600">&lt; 15 Mins</div>
                  <div className="text-[11px] text-slate-500 font-medium">Matching Latency</div>
                </div>
                <div className="p-2.5 rounded-xl bg-white/80 border border-slate-100">
                  <div className="text-xl sm:text-2xl font-black text-slate-900">8 Banks</div>
                  <div className="text-[11px] text-slate-500 font-medium">Monitored Facilities</div>
                </div>
                <div className="p-2.5 rounded-xl bg-white/80 border border-slate-100">
                  <div className="text-xl sm:text-2xl font-black text-emerald-600">100%</div>
                  <div className="text-[11px] text-slate-500 font-medium">Consent Mediated</div>
                </div>
              </div>
            </div>

            {/* Right Column: Live Matching Simulation & Interactive Preview */}
            <div className="lg:col-span-5">
              <div className="relative rounded-3xl bg-white p-5 sm:p-6 shadow-xl border border-slate-200/90 space-y-4">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <div className="flex items-center gap-2">
                    <div className="p-2 rounded-xl bg-red-100 text-red-600">
                      <Activity className="w-4 h-4" />
                    </div>
                    <div>
                      <h3 className="font-bold text-sm text-slate-900">Live Chennai Triage Simulator</h3>
                      <p className="text-[11px] text-slate-500">Autonomous Triaged Matching</p>
                    </div>
                  </div>
                  <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-emerald-100 text-emerald-800">
                    Engine Active
                  </span>
                </div>

                {/* Interactive Selectors for Examination Demo */}
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                      Target Blood Group
                    </label>
                    <select
                      value={simBloodGroup}
                      onChange={(e) => setSimBloodGroup(e.target.value)}
                      className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 bg-slate-50 font-bold text-slate-800 focus:border-red-500 outline-hidden"
                    >
                      {bloodGroups.map((bg) => (
                        <option key={bg} value={bg}>{bg}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                      Chennai Locality
                    </label>
                    <select
                      value={simLocality}
                      onChange={(e) => setSimLocality(e.target.value)}
                      className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 bg-slate-50 font-bold text-slate-800 focus:border-red-500 outline-hidden"
                    >
                      {CHENNAI_LOCALITIES.map((loc) => (
                        <option key={loc} value={loc}>{loc}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Simulation Output Card */}
                <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80 space-y-2 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500 font-medium">Selected Recipient:</span>
                    <BloodGroupBadge group={simBloodGroup} size="sm" />
                  </div>
                  <div className="flex items-start justify-between gap-2">
                    <span className="text-slate-500 font-medium">Compatible Donors:</span>
                    <span className="font-bold text-slate-800 text-right">
                      {getCompatibleDonors(simBloodGroup).join(', ')}
                    </span>
                  </div>
                  <div className="flex items-center justify-between pt-1 border-t border-slate-200/60">
                    <span className="text-slate-500 font-medium">Target Zone:</span>
                    <span className="font-bold text-slate-900 flex items-center gap-1">
                      <MapPin className="w-3 h-3 text-red-500" />
                      {simLocality}, Chennai
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500 font-medium">Simulated Match Status:</span>
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-100 text-blue-800">
                      Standby Donors Available
                    </span>
                  </div>
                </div>

                <ClinicalDisclaimer compact={true} />

                <div className="pt-1">
                  <Link
                    to="/how-it-works"
                    className="w-full flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs transition"
                  >
                    <span>View Algorithmic Matching Architecture</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 2. HOW IT WORKS SECTION (Four-Step Workflow Closer to Hero) */}
      <section className="max-w-[1650px] mx-auto px-4 sm:px-6 lg:px-8 space-y-6">
        <div className="text-center space-y-2 max-w-3xl mx-auto">
          <span className="text-xs font-bold text-red-600 uppercase tracking-wider">
            Verified Emergency Workflow
          </span>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
            How BloodConnect Operates in Emergencies
          </h2>
          <p className="text-xs sm:text-sm text-slate-600">
            A structured, clinically responsible pathway ensuring speed without compromising verification or transfusion safety.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            {
              step: '01',
              title: 'Request Submission',
              desc: 'Requester submits patient blood group, units, hospital facility, and Chennai locality with case reference.',
              icon: PlusCircle,
            },
            {
              step: '02',
              title: 'Administrator Verification',
              desc: 'Medical administrator verifies hospital admission details before broadcasting, eliminating misinformation.',
              icon: ShieldCheck,
            },
            {
              step: '03',
              title: 'Algorithmic Matching',
              desc: 'Engine matches consented donors based on ABO/Rh compatibility, Chennai locality proximity, and donation rest period.',
              icon: Radio,
            },
            {
              step: '04',
              title: 'Alert & Hospital Intake',
              desc: 'Donors receive instant alerts. Blood bank conducts mandatory biological crossmatching upon donor arrival.',
              icon: Heart,
            },
          ].map((s) => (
            <div
              key={s.step}
              className="p-5 rounded-2xl bg-white border border-slate-200 shadow-2xs hover:shadow-md transition space-y-3 relative"
            >
              <div className="text-3xl font-black text-red-100">{s.step}</div>
              <div className="p-2.5 w-fit rounded-xl bg-red-50 text-red-600">
                <s.icon className="w-4 h-4" />
              </div>
              <h3 className="font-bold text-sm text-slate-900">{s.title}</h3>
              <p className="text-xs text-slate-600 leading-relaxed">{s.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* 3. CORE DESIGN THINKING CONCEPTS */}
      <section className="bg-slate-900 text-white py-12 border-y border-slate-800">
        <div className="max-w-[1650px] mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
          <div className="text-center space-y-2 max-w-2xl mx-auto">
            <span className="text-xs font-bold text-red-400 uppercase tracking-wider">
              System Architecture
            </span>
            <h2 className="text-2xl sm:text-3xl font-black tracking-tight text-white">
              The Three Core Concepts
            </h2>
            <p className="text-xs sm:text-sm text-slate-400">
              Directly addressing the pain points identified in current emergency blood procurement in Chennai.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="p-6 rounded-2xl bg-slate-800/80 border border-slate-700/80 space-y-3">
              <div className="w-10 h-10 rounded-xl bg-red-600/20 text-red-400 border border-red-500/30 flex items-center justify-center">
                <Radio className="w-5 h-5" />
              </div>
              <h3 className="text-base font-bold text-white">
                1. Smart Emergency Donor Matching
              </h3>
              <p className="text-xs text-slate-300 leading-relaxed">
                Rules-based compatibility engine factoring in biological ABO/Rh rules, Chennai locality proximity, and verified donor availability.
              </p>
            </div>

            <div className="p-6 rounded-2xl bg-slate-800/80 border border-slate-700/80 space-y-3">
              <div className="w-10 h-10 rounded-xl bg-amber-600/20 text-amber-400 border border-amber-500/30 flex items-center justify-center">
                <Building2 className="w-5 h-5" />
              </div>
              <h3 className="text-base font-bold text-white">
                2. Real-Time Stock & Shortage Monitoring
              </h3>
              <p className="text-xs text-slate-300 leading-relaxed">
                Continuous inventory tracking across monitored Chennai blood banks with configurable safety thresholds that trigger proactive low-stock alerts.
              </p>
            </div>

            <div className="p-6 rounded-2xl bg-slate-800/80 border border-slate-700/80 space-y-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-600/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <h3 className="text-base font-bold text-white">
                3. Verified Emergency Blood Alert Network
              </h3>
              <p className="text-xs text-slate-300 leading-relaxed">
                Replaces chaotic, unverified social media forwards with verified administrative alerts dispatched directly to nearby consented donors.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* 4. BLOOD GROUP COMPATIBILITY MATRIX */}
      <section className="max-w-[1650px] mx-auto px-4 sm:px-6 lg:px-8 space-y-6">
        <div className="text-center space-y-1">
          <span className="text-xs font-bold text-red-600 uppercase tracking-wider">
            Clinical Reference Standard
          </span>
          <h2 className="text-2xl font-extrabold text-slate-900">
            Red Blood Cell Compatibility Matrix
          </h2>
          <p className="text-xs text-slate-600 max-w-xl mx-auto">
            Biological compatibility rules enforced by the BloodConnect matching engine.
          </p>
        </div>

        <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-2xs">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-100/90 text-slate-700 font-bold uppercase text-[11px] border-b border-slate-200">
              <tr>
                <th className="py-3 px-4">Recipient Blood Group</th>
                <th className="py-3 px-4">Can Receive Red Blood Cells From</th>
                <th className="py-3 px-4">Can Donate Red Blood Cells To</th>
                <th className="py-3 px-4">Clinical Significance</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {[
                { r: 'O-', canReceive: ['O-'], canDonate: ['All Groups (O-, O+, A-, A+, B-, B+, AB-, AB+)'], status: 'Universal Red Cell Donor' },
                { r: 'O+', canReceive: ['O-', 'O+'], canDonate: ['O+', 'A+', 'B+', 'AB+'], status: 'Most Common Blood Group' },
                { r: 'A-', canReceive: ['O-', 'A-'], canDonate: ['A-', 'A+', 'AB-', 'AB+'], status: 'Rare Rh-negative' },
                { r: 'A+', canReceive: ['O-', 'O+', 'A-', 'A+'], canDonate: ['A+', 'AB+'], status: 'High Hospital Demand' },
                { r: 'B-', canReceive: ['O-', 'B-'], canDonate: ['B-', 'B+', 'AB-', 'AB+'], status: 'Rare Rh-negative' },
                { r: 'B+', canReceive: ['O-', 'O+', 'B-', 'B+'], canDonate: ['B+', 'AB+'], status: 'High Regional Demand in TN' },
                { r: 'AB-', canReceive: ['O-', 'A-', 'B-', 'AB-'], canDonate: ['AB-', 'AB+'], status: 'Very Rare Group' },
                { r: 'AB+', canReceive: ['All Groups (O-, O+, A-, A+, B-, B+, AB-, AB+)'], canDonate: ['AB+ only'], status: 'Universal Red Cell Recipient' },
              ].map((row) => (
                <tr key={row.r} className="hover:bg-slate-50/70 transition">
                  <td className="py-2.5 px-4 font-extrabold text-slate-900 flex items-center gap-2">
                    <BloodGroupBadge group={row.r} size="sm" />
                  </td>
                  <td className="py-2.5 px-4 font-semibold text-slate-800">
                    {row.canReceive.join(', ')}
                  </td>
                  <td className="py-2.5 px-4 text-slate-600">
                    {row.canDonate.join(', ')}
                  </td>
                  <td className="py-2.5 px-4">
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

      {/* 5. CHENNAI REGIONAL BLOOD CENTRE STOCK OVERVIEW */}
      <section id="stock-overview" className="max-w-[1650px] mx-auto px-4 sm:px-6 lg:px-8 space-y-6 scroll-mt-24">
        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-emerald-100 text-emerald-900 text-[11px] font-bold mb-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-600 animate-pulse" />
              <span>Chennai Regional Network &bull; Live Inventory</span>
            </div>
            <h2 className="text-2xl font-extrabold text-slate-900">
              Chennai Regional Blood Centre Stock Reserves
            </h2>
            <p className="text-xs text-slate-500">
              Live database queries of blood bank reserves across verified facilities in Chennai, Tamil Nadu.
            </p>
          </div>

          {/* Filters: Locality + Blood Group */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Locality Dropdown with 'All Chennai' */}
            <select
              value={selectedLocality}
              onChange={(e) => setSelectedLocality(e.target.value)}
              className="px-3 py-1.5 rounded-lg text-xs font-bold border border-slate-300 bg-white text-slate-800 focus:border-red-500 outline-hidden"
            >
              <option value="">All Chennai (15 Localities)</option>
              {CHENNAI_LOCALITIES.map((loc) => (
                <option key={loc} value={loc}>{loc}</option>
              ))}
            </select>

            {/* Blood Group Pills */}
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
                className={`px-2 py-1.5 rounded-lg text-xs font-bold transition ${
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
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
          {loading ? (
            <div className="col-span-full py-10 text-center text-slate-400 text-sm">
              Loading Chennai demonstration stock levels...
            </div>
          ) : filteredStocks.length === 0 ? (
            <div className="col-span-full py-10 text-center text-slate-400 text-sm">
              No stock entries found for selected filter criteria.
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
                  <p className="text-xs font-semibold text-slate-800 mt-1 truncate">
                    {stock.bank_name}
                  </p>
                  <p className="text-[11px] text-slate-500 flex items-center gap-1 mt-0.5">
                    <MapPin className="w-3 h-3 text-slate-400" />
                    <span>{stock.bank_locality || 'Chennai'}</span> &bull; <span>{stock.component}</span>
                  </p>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Interactive Map of Chennai Blood Banks */}
        <div className="space-y-2 pt-2">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-sm text-slate-900 flex items-center gap-2">
              <Building2 className="w-4 h-4 text-red-600" />
              <span>Blood Banks and Hospitals In and Around Chennai</span>
            </h3>
            <span className="text-xs text-slate-500">Greater Chennai and surrounding towns</span>
          </div>
          <StockMap bloodBanks={bloodBanks} hospitals={REGIONAL_HOSPITALS} height="440px" />
        </div>
      </section>

      {/* 6. EMERGENCY CTA BANNER */}
      <section className="max-w-[1650px] mx-auto px-4 sm:px-6 lg:px-8">
        <div className="rounded-3xl bg-gradient-to-r from-red-600 via-red-700 to-rose-700 text-white p-6 sm:p-10 shadow-xl shadow-red-600/20 flex flex-col md:flex-row items-center justify-between gap-6 text-center md:text-left">
          <div className="space-y-2 max-w-2xl">
            <h2 className="text-2xl sm:text-3xl font-black">
              Experiencing an Emergency Transfusion Requirement in Chennai?
            </h2>
            <p className="text-xs sm:text-sm text-red-100 leading-relaxed">
              Submit your blood request now to notify verified administrators and trigger rapid matching with local donors across Adyar, Anna Nagar, T. Nagar, Velachery, and surrounding Chennai zones.
            </p>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-3 shrink-0">
            <Link
              to="/register?role=requester"
              className="px-5 py-3 rounded-xl bg-white text-red-700 font-extrabold text-sm hover:bg-red-50 transition shadow-md"
            >
              Submit Emergency Request
            </Link>
            <Link
              to="/login"
              className="px-5 py-3 rounded-xl bg-red-900/40 border border-white/20 text-white font-bold text-sm hover:bg-red-900/60 transition"
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
