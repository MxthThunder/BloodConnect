import React from 'react';
import { Link } from 'react-router-dom';
import { Users, Lightbulb, Target, Cpu, CheckCircle2, Shield, Heart, Activity, Building2, MapPin, Lock } from 'lucide-react';

const AboutPage = () => {
  const teamMembers = [
    { name: 'Freddy Matthew R', role: 'Lead System Architect & Backend Engineering', focus: 'Distributed triage systems, secure API gateways, and concurrency control.' },
    { name: 'Joshua Bennet C', role: 'Head of Product & Frontend Engineering', focus: 'Emergency response UX design, accessible interfaces, and real-time state sync.' },
    { name: 'Boopathi P R', role: 'Database & Matching Engine Architect', focus: 'ABO/Rh compatibility algorithms, geospatial proximity indexing, and deduplication.' },
    { name: 'Balakumaran E', role: 'Clinical Operations & Verification Lead', focus: 'Hospital integration protocols, blood bank inventory schemas, and clinical safeguards.' },
    { name: 'Abilash Alexander A', role: 'Quality Assurance & Reliability Lead', focus: 'Automated testing suites, performance benchmarks, and end-to-end load resilience.' },
    { name: 'Harisankaran J', role: 'Operations & Community Outreach Lead', focus: 'Voluntary donor engagement, regional healthcare workflows, and regulatory compliance.' },
  ];

  const corePillars = [
    {
      title: 'Real-Time Rapid Matching',
      summary: 'Algorithmically matches compatible ABO/Rh donors located in the same Chennai zone within 15 minutes of hospital triage approval.',
      icon: Activity,
    },
    {
      title: 'Centralized Stock Reserves',
      summary: 'Monitors real-time unit counts across 8 major Chennai blood centres to prevent blind searches and hospital-to-hospital phone tag.',
      icon: Building2,
    },
    {
      title: 'Administrator Verification',
      summary: 'Eliminates fake or panic social media forwards by requiring administrative validation before emergency alerts are dispatched.',
      icon: Shield,
    },
    {
      title: 'Patient & Donor Privacy',
      summary: 'Enforces strict data privacy where contact details are guarded through in-app mediation and authorized clinical coordinators.',
      icon: Lock,
    },
  ];

  const designStages = [
    {
      stage: '1. Empathize',
      summary: 'Interviewed hospital blood bank officers, patient families, and regular donors. Identified extreme panic during emergency off-hour shortages.',
    },
    {
      stage: '2. Define',
      summary: 'Problem Statement: "People often face difficulties finding compatible blood donors quickly during medical emergencies due to limited availability, delayed communication, and fragmented contacts."',
    },
    {
      stage: '3. Ideate',
      summary: 'Engineered a centralized digital triage model: replacing chaotic forwards with administrator-verified alerts dispatched algorithmically.',
    },
    {
      stage: '4. Deploy',
      summary: 'Implemented a high-performance stack using React, Vite, Django REST, and OpenStreetMap, featuring live stock alerts and verification workflows.',
    },
    {
      stage: '5. Validate',
      summary: 'Benchmarked role permissions, zero-inventory safeguards, donor consent controls, and emergency response latency under automated unit tests.',
    },
  ];

  return (
    <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-12">
      {/* Page Header */}
      <div className="text-center space-y-4 max-w-3xl mx-auto">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-red-100 text-red-800 text-xs font-semibold">
          <Heart className="w-3.5 h-3.5 text-red-600 fill-red-600" />
          <span>Emergency Healthcare Infrastructure &bull; Chennai</span>
        </div>
        <h1 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">
          About BloodConnect & Our Mission
        </h1>
        <p className="text-sm sm:text-base text-slate-600 leading-relaxed">
          BloodConnect was founded to eliminate fatal delays in emergency blood procurement across Chennai through algorithmic matching, real-time hospital inventory tracking, and verified rapid dispatch.
        </p>
      </div>

      {/* Validated Problem Statement Box */}
      <div className="p-8 rounded-3xl bg-white border border-slate-200/80 shadow-sm space-y-4">
        <div className="flex items-center gap-3 text-red-600">
          <Target className="w-6 h-6 shrink-0" />
          <h2 className="text-lg font-bold text-slate-900">
            The Healthcare Challenge We Address
          </h2>
        </div>
        <blockquote className="p-4 rounded-2xl bg-red-50/60 border-l-4 border-red-600 text-slate-800 text-sm sm:text-base font-medium italic leading-relaxed">
          "People often face difficulties finding compatible blood donors quickly during medical emergencies due to limited availability, delayed communication, rare blood group shortages, and dependence on personal contacts or scattered information."
        </blockquote>
        <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
          Traditional procurement relies heavily on scattered WhatsApp forwards and passive phone registries that produce immense panic and low response rates. BloodConnect bridges this gap through a unified triage pipeline where emergency requests are validated by hospital coordinators before reaching nearby compatible donors.
        </p>
      </div>

      {/* 4 Architectural Pillars */}
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">
            Core Operational Pillars
          </h2>
          <p className="text-xs sm:text-sm text-slate-500">
            Engineered for zero-delay response, clinical compatibility, and data integrity.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {corePillars.map((pillar, i) => {
            const Icon = pillar.icon;
            return (
              <div key={i} className="p-6 rounded-2xl bg-white border border-slate-200/80 shadow-2xs space-y-3">
                <div className="w-10 h-10 rounded-xl bg-red-50 text-red-600 flex items-center justify-center">
                  <Icon className="w-5 h-5" />
                </div>
                <h3 className="font-bold text-sm text-slate-900">{pillar.title}</h3>
                <p className="text-xs text-slate-600 leading-relaxed">{pillar.summary}</p>
              </div>
            );
          })}
        </div>
      </div>

      {/* User-Centric Methodology */}
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">
            System Design & Engineering Methodology
          </h2>
          <p className="text-xs sm:text-sm text-slate-500">
            Rigorous user-centric engineering from clinical stakeholder interviews to active system deployment.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          {designStages.map((d, i) => (
            <div key={i} className="p-5 rounded-2xl bg-white border border-slate-200/80 shadow-2xs space-y-2">
              <span className="text-xs font-bold text-red-600">{d.stage}</span>
              <p className="text-xs text-slate-600 leading-relaxed">{d.summary}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Technology & Standards Stack */}
      <div className="p-8 rounded-3xl bg-slate-900 text-white space-y-6">
        <div>
          <h2 className="text-2xl font-bold text-white flex items-center gap-2">
            <Cpu className="w-6 h-6 text-red-400" />
            <span>Healthcare Technology & Compliance Infrastructure</span>
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Standardized protocols ensuring high availability, zero latency, and clinical precision.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="p-4 rounded-xl bg-slate-800/80 border border-slate-700 space-y-1.5">
            <h4 className="text-xs font-bold text-red-400 uppercase tracking-wider">Clinical Standards</h4>
            <p className="text-sm font-bold text-white">ABO & Rh(D) Compatibility</p>
            <p className="text-xs text-slate-400">Biological rules strictly enforced by the automated matching engine.</p>
          </div>
          <div className="p-4 rounded-xl bg-slate-800/80 border border-slate-700 space-y-1.5">
            <h4 className="text-xs font-bold text-red-400 uppercase tracking-wider">Geospatial Engine</h4>
            <p className="text-sm font-bold text-white">OpenStreetMap & Leaflet</p>
            <p className="text-xs text-slate-400">Zone-based locality clustering across all 15 Greater Chennai zones.</p>
          </div>
          <div className="p-4 rounded-xl bg-slate-800/80 border border-slate-700 space-y-1.5">
            <h4 className="text-xs font-bold text-red-400 uppercase tracking-wider">Backend Platform</h4>
            <p className="text-sm font-bold text-white">Django REST Framework</p>
            <p className="text-xs text-slate-400">High-concurrency transactional database handling real-time blood stock locks.</p>
          </div>
          <div className="p-4 rounded-xl bg-slate-800/80 border border-slate-700 space-y-1.5">
            <h4 className="text-xs font-bold text-red-400 uppercase tracking-wider">Data Protection</h4>
            <p className="text-sm font-bold text-white">Encrypted Patient Privacy</p>
            <p className="text-xs text-slate-400">Consent-mediated alerts with zero public harvesting of phone numbers.</p>
          </div>
        </div>
      </div>

      {/* Leadership & Engineering Team */}
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <Users className="w-5 h-5 text-red-600" />
            <span>Platform Leadership & Engineering Team</span>
          </h2>
          <p className="text-xs sm:text-sm text-slate-500">
            Dedicated engineering team focused on healthcare technology and rapid emergency coordination.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {teamMembers.map((member, i) => (
            <div key={i} className="p-5 rounded-2xl bg-white border border-slate-200 shadow-2xs space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-red-600 uppercase">Core Team</span>
                <span className="text-[10px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded-md font-semibold flex items-center gap-1">
                  <MapPin className="w-2.5 h-2.5" />
                  <span>Chennai, TN</span>
                </span>
              </div>
              <h3 className="font-bold text-base text-slate-900">{member.name}</h3>
              <p className="text-xs font-semibold text-slate-700">{member.role}</p>
              <p className="text-xs text-slate-500 leading-relaxed pt-1 border-t border-slate-100">
                {member.focus}
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default AboutPage;
