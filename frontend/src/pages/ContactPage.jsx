import React, { useState } from 'react';
import { Phone, Mail, MapPin, Building2, Send, CheckCircle2 } from 'lucide-react';

const ContactPage = () => {
  const [submitted, setSubmitted] = useState(false);
  const [form, setForm] = useState({ name: '', email: '', subject: '', message: '' });

  const handleSubmit = (e) => {
    e.preventDefault();
    setSubmitted(true);
  };

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12 space-y-16">
      <div className="text-center space-y-4 max-w-3xl mx-auto">
        <span className="text-xs font-bold text-red-600 uppercase tracking-wider">
          Support & Coordination
        </span>
        <h1 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">
          Hospital & Help Coordination Desk
        </h1>
        <p className="text-sm sm:text-base text-slate-600">
          Get in touch with the student project team or access emergency regional blood bank directories.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Contact Info & Hotlines */}
        <div className="lg:col-span-5 space-y-6">
          <div className="p-6 rounded-3xl bg-white border border-slate-200/80 shadow-xs space-y-4">
            <h3 className="font-bold text-base text-slate-900">
              Government Emergency Hotlines
            </h3>
            <div className="space-y-3 text-xs">
              <div className="flex items-start gap-3 p-3 rounded-xl bg-red-50 border border-red-100">
                <Phone className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                <div>
                  <div className="font-bold text-red-950">National Blood Helpline</div>
                  <div className="text-red-700">Toll-Free: 104 / 108 (24x7 Ambulance & Emergency)</div>
                </div>
              </div>
              <div className="flex items-start gap-3 p-3 rounded-xl bg-slate-50 border border-slate-200">
                <Building2 className="w-4 h-4 text-slate-600 shrink-0 mt-0.5" />
                <div>
                  <div className="font-bold text-slate-900">Rajiv Gandhi Govt General Hospital Blood Centre</div>
                  <div className="text-slate-600">+91 44 2530 5000 &bull; Park Town, Chennai</div>
                </div>
              </div>
              <div className="flex items-start gap-3 p-3 rounded-xl bg-slate-50 border border-slate-200">
                <Building2 className="w-4 h-4 text-slate-600 shrink-0 mt-0.5" />
                <div>
                  <div className="font-bold text-slate-900">Apollo Hospitals Regional Blood Bank</div>
                  <div className="text-slate-600">+91 44 2829 0200 &bull; Greams Road, Nungambakkam, Chennai</div>
                </div>
              </div>
              <div className="flex items-start gap-3 p-3 rounded-xl bg-slate-50 border border-slate-200">
                <Building2 className="w-4 h-4 text-slate-600 shrink-0 mt-0.5" />
                <div>
                  <div className="font-bold text-slate-900">Fortis Malar Hospital Blood Centre</div>
                  <div className="text-slate-600">+91 44 4289 2222 &bull; Gandhi Nagar, Adyar, Chennai</div>
                </div>
              </div>
            </div>
          </div>

          <div className="p-6 rounded-3xl bg-slate-900 text-white space-y-3 text-xs">
            <h3 className="font-bold text-sm text-white">Academic Capstone Inquiry</h3>
            <p className="text-slate-400 leading-relaxed">
              For evaluation queries by examiners, feedback on design thinking artifacts, or architecture reviews:
            </p>
            <div className="flex items-center gap-2 text-slate-300">
              <Mail className="w-4 h-4 text-red-400" />
              <span>team@bloodconnect.org</span>
            </div>
          </div>
        </div>

        {/* Message Form */}
        <div className="lg:col-span-7 bg-white p-6 sm:p-8 rounded-3xl border border-slate-200 shadow-sm">
          {submitted ? (
            <div className="p-8 text-center space-y-3">
              <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-slate-900">Inquiry Received</h3>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                Thank you for reaching out. In our prototype simulation, student coordinators monitor all messages logged in the database.
              </p>
              <button
                onClick={() => setSubmitted(false)}
                className="px-4 py-2 text-xs font-semibold rounded-xl bg-slate-100 text-slate-700 hover:bg-slate-200"
              >
                Send Another Message
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <h3 className="font-bold text-base text-slate-900">
                Send an Inquiry or Feedback
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700">Your Name</label>
                  <input
                    type="text"
                    required
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    className="mt-1 block w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:border-red-500 outline-hidden"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700">Your Email</label>
                  <input
                    type="email"
                    required
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                    className="mt-1 block w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:border-red-500 outline-hidden"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700">Subject</label>
                <input
                  type="text"
                  required
                  value={form.subject}
                  onChange={(e) => setForm({ ...form, subject: e.target.value })}
                  placeholder="e.g. Hospital Integration / Design Feedback"
                  className="mt-1 block w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:border-red-500 outline-hidden"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700">Message</label>
                <textarea
                  rows={4}
                  required
                  value={form.message}
                  onChange={(e) => setForm({ ...form, message: e.target.value })}
                  className="mt-1 block w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:border-red-500 outline-hidden"
                />
              </div>

              <button
                type="submit"
                className="flex items-center justify-center gap-2 w-full py-3 rounded-xl bg-red-600 text-white font-bold text-xs hover:bg-red-700 transition shadow-sm"
              >
                <Send className="w-3.5 h-3.5" />
                <span>Submit Inquiry</span>
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};

export default ContactPage;
