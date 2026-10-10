import React from 'react';
import { Link } from 'react-router-dom';
import { Users, Lightbulb, Target, Cpu, CheckCircle2, FileSpreadsheet, Shield } from 'lucide-react';

const AboutPage = () => {
  const teamMembers = [
    { name: 'Freddy Matthew R', username: 'freddy.admin', email: 'freddy.admin@bloodconnect.org', role: 'Full-Stack Architecture & Backend Lead' },
    { name: 'Joshua Bennet C', username: 'joshua.admin', email: 'joshua.admin@bloodconnect.org', role: 'UI/UX Design & Frontend Engineering' },
    { name: 'Boopathi P R', username: 'boopathi.admin', email: 'boopathi.admin@bloodconnect.org', role: 'Database & Matching Engine Architect' },
    { name: 'Balakumaran E', username: 'balakumaran.admin', email: 'balakumaran.admin@bloodconnect.org', role: 'Clinical Data Modeling & Verification Lead' },
    { name: 'Abilash Alexander A', username: 'abilash.admin', email: 'abilash.admin@bloodconnect.org', role: 'Quality Assurance & Automated Testing' },
    { name: 'Harisankaran J', username: 'harisankaran.admin', email: 'harisankaran.admin@bloodconnect.org', role: 'Design Thinking Research & Documentation' },
  ];

  const designThinkingStages = [
    {
      stage: '1. Empathize',
      summary: 'Interviewed hospital blood bank officers, patients families, and regular donors. Identified extreme panic during emergency off-hour shortages.',
    },
    {
      stage: '2. Define',
      summary: 'Problem Statement: "People often face difficulties finding compatible blood donors quickly during medical emergencies due to limited availability, delayed communication, rare blood group shortages, and dependence on scattered contacts."',
    },
    {
      stage: '3. Ideate',
      summary: 'Brainstormed centralized triage model: replacing spam WhatsApp forwards with an administrator-verified alert network that matches compatible donors algorithmically.',
    },
    {
      stage: '4. Prototype',
      summary: 'Implemented BloodConnect using React, Vite, Django REST Framework, SQLite, and OpenStreetMap. Built live verification, matching, and stock tracking.',
    },
    {
      stage: '5. Test',
      summary: 'Validated role permissions, negative inventory barriers, donor consent controls, and emergency response latency under automated unit test suites.',
    },
  ];

  return (
    <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-12">
      {/* Page Header */}
      <div className="text-center space-y-4 max-w-3xl mx-auto">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-red-100 text-red-800 text-xs font-semibold">
          <Lightbulb className="w-3.5 h-3.5" />
          <span>College Design Thinking Capstone 2026</span>
        </div>
        <h1 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">
          About BloodConnect & Project Genesis
        </h1>
        <p className="text-sm sm:text-base text-slate-600 leading-relaxed">
          Developed by a team of six Computer Science engineering students as a Design Thinking project evaluated by an external academic examiner.
        </p>
      </div>

      {/* Problem Statement Box */}
      <div className="p-8 rounded-3xl bg-white border border-slate-200/80 shadow-sm space-y-4">
        <div className="flex items-center gap-3 text-red-600">
          <Target className="w-6 h-6 shrink-0" />
          <h2 className="text-lg font-bold text-slate-900">
            Validated Problem Statement
          </h2>
        </div>
        <blockquote className="p-4 rounded-2xl bg-red-50/60 border-l-4 border-red-600 text-slate-800 text-sm sm:text-base font-medium italic leading-relaxed">
          "People often face difficulties finding compatible blood donors quickly during medical emergencies due to limited availability, delayed communication, rare blood group shortages, and dependence on personal contacts or scattered information."
        </blockquote>
        <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
          Our user research identified that existing systems rely either on fragmented phone trees or passive, out-of-date static registers. BloodConnect bridges this gap through a unified triage system where emergency alerts are administrator-verified before hitting donors.
        </p>
      </div>

      {/* Design Thinking Methodology */}
      <div className="space-y-6">
        <div className="text-center sm:text-left">
          <h2 className="text-2xl font-bold text-slate-900">
            Five-Stage Design Thinking Framework
          </h2>
          <p className="text-xs sm:text-sm text-slate-500">
            Rigorous user-centric engineering from field interviews to runnable prototype.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          {designThinkingStages.map((d, i) => (
            <div key={i} className="p-5 rounded-2xl bg-white border border-slate-200/80 shadow-2xs space-y-2">
              <span className="text-xs font-bold text-red-600">{d.stage}</span>
              <p className="text-xs text-slate-600 leading-relaxed">{d.summary}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Bill of Materials (BOM) */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
              <FileSpreadsheet className="w-5 h-5 text-red-600" />
              <span>Bill of Materials (BOM)</span>
            </h2>
            <p className="text-xs text-slate-500">
              Hardware, software frameworks, database, and infrastructure costing summary.
            </p>
          </div>
        </div>

        <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-xs">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-700 font-bold uppercase text-[11px] border-b border-slate-200">
              <tr>
                <th className="py-3 px-4">Category</th>
                <th className="py-3 px-4">Item Specification</th>
                <th className="py-3 px-4">Acquisition Type</th>
                <th className="py-3 px-4">Cost (INR)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              <tr>
                <td className="py-3 px-4 font-semibold text-slate-900">Hardware</td>
                <td className="py-3 px-4 text-slate-700">Development Workstation (Intel i5/i7, 16GB RAM, Windows 11)</td>
                <td className="py-3 px-4 text-slate-600">Existing Student Resource</td>
                <td className="py-3 px-4 font-bold text-emerald-700">₹0.00 (Existing)</td>
              </tr>
              <tr>
                <td className="py-3 px-4 font-semibold text-slate-900">Frontend Stack</td>
                <td className="py-3 px-4 text-slate-700">React 19, Vite, Tailwind CSS v4, Lucide Icons, Recharts</td>
                <td className="py-3 px-4 text-slate-600">Open-Source (MIT)</td>
                <td className="py-3 px-4 font-bold text-emerald-700">₹0.00 (FOSS)</td>
              </tr>
              <tr>
                <td className="py-3 px-4 font-semibold text-slate-900">Backend Stack</td>
                <td className="py-3 px-4 text-slate-700">Python 3.13, Django 6.1, Django REST Framework, Cors Headers</td>
                <td className="py-3 px-4 text-slate-600">Open-Source (BSD)</td>
                <td className="py-3 px-4 font-bold text-emerald-700">₹0.00 (FOSS)</td>
              </tr>
              <tr>
                <td className="py-3 px-4 font-semibold text-slate-900">Database Engine</td>
                <td className="py-3 px-4 text-slate-700">SQLite (Local prototype) / PostgreSQL ready</td>
                <td className="py-3 px-4 text-slate-600">Public Domain / FOSS</td>
                <td className="py-3 px-4 font-bold text-emerald-700">₹0.00 (FOSS)</td>
              </tr>
              <tr>
                <td className="py-3 px-4 font-semibold text-slate-900">Geospatial Mapping</td>
                <td className="py-3 px-4 text-slate-700">OpenStreetMap with Leaflet (Zero paid API keys)</td>
                <td className="py-3 px-4 text-slate-600">Open-Source ODbL</td>
                <td className="py-3 px-4 font-bold text-emerald-700">₹0.00 (Zero API Fee)</td>
              </tr>
              <tr className="bg-slate-50/80 font-bold">
                <td colSpan="3" className="py-3 px-4 text-slate-900 text-right">Total Prototype Expenditure:</td>
                <td className="py-3 px-4 text-emerald-700">₹0.00</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Project Team Members */}
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <Users className="w-5 h-5 text-red-600" />
            <span>Project Engineering Team</span>
          </h2>
          <p className="text-xs sm:text-sm text-slate-500">
            Six Computer Science Engineering Students &bull; Final Semester Capstone Project
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {teamMembers.map((member, i) => (
            <div key={i} className="p-5 rounded-2xl bg-white border border-slate-200 shadow-2xs space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-red-600 uppercase">Team Member {i + 1}</span>
                <span className="text-[10px] font-mono bg-red-50 text-red-700 px-2 py-0.5 rounded-md font-bold">
                  {member.username}
                </span>
              </div>
              <h3 className="font-bold text-sm text-slate-900">{member.name}</h3>
              <p className="text-xs text-slate-600">{member.role}</p>
              <p className="text-[11px] text-slate-400 font-mono pt-1 border-t border-slate-100">{member.email}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default AboutPage;
