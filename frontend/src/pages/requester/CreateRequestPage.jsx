import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import apiClient from '../../api/client';
import ClinicalDisclaimer from '../../components/ClinicalDisclaimer';
import { PlusCircle, AlertCircle, Building2, Clock, Phone, ArrowRight } from 'lucide-react';

const CreateRequestPage = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Default required_by to 6 hours from now
  const defaultRequiredTime = new Date(Date.now() + 6 * 3600 * 1000).toISOString().slice(0, 16);

  const [form, setForm] = useState({
    patient_case_ref: '',
    blood_group: 'O+',
    component: 'Packed Red Blood Cells',
    units_requested: 2,
    hospital_name: 'Victoria Hospital',
    hospital_address: 'Fort Road, Near City Market, Kalasipalya',
    city: 'Bengaluru',
    locality: 'Fort',
    urgency: 'URGENT',
    required_by: defaultRequiredTime,
    reason: 'Emergency surgery scheduled; standby blood units required for transfusion support.',
    contact_phone: '+91 98450 12345',
    contact_preference: 'phone',
    accuracy_confirmed: true,
  });

  const bloodGroups = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];
  const components = [
    'Whole Blood',
    'Packed Red Blood Cells',
    'Platelets',
    'Fresh Frozen Plasma',
    'Cryoprecipitate',
  ];

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setForm((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!form.accuracy_confirmed) {
      setError('Please confirm that the clinical and hospital details are accurate.');
      return;
    }

    setLoading(true);
    try {
      const payload = {
        ...form,
        units_requested: parseInt(form.units_requested, 10),
        required_by: new Date(form.required_by).toISOString(),
      };
      const res = await apiClient.post('/requests/', payload);
      navigate(`/requester/requests/${res.data.id}`);
    } catch (err) {
      console.error(err);
      let msg = 'Failed to submit request. Please check the fields.';
      if (err.response?.data) {
        const d = err.response.data;
        const first = Object.keys(d)[0];
        msg = `${first}: ${d[first]}`;
      }
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-xs">
        <span className="text-xs font-bold text-red-600 uppercase tracking-wider">
          Emergency Coordination
        </span>
        <h1 className="text-2xl font-black text-slate-900 tracking-tight mt-0.5">
          Submit Emergency Blood Request
        </h1>
        <p className="text-xs text-slate-500 mt-1">
          The request will enter a pending-verification state for review by medical administrators before dispatching alerts to donors.
        </p>
      </div>

      <ClinicalDisclaimer compact={true} />

      {error && (
        <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-start gap-2">
          <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="bg-white p-6 sm:p-8 rounded-3xl border border-slate-200 shadow-sm space-y-6">
        {/* Section 1: Blood Group and Component */}
        <div className="space-y-4">
          <h3 className="text-xs font-extrabold text-slate-900 uppercase tracking-wider border-b border-slate-100 pb-2">
            1. Transfusion Requirement Specification
          </h3>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-2">
              Required Blood Group *
            </label>
            <div className="grid grid-cols-4 sm:grid-cols-8 gap-2">
              {bloodGroups.map((bg) => (
                <button
                  type="button"
                  key={bg}
                  onClick={() => setForm({ ...form, blood_group: bg })}
                  className={`py-2.5 rounded-xl text-xs font-extrabold border transition ${
                    form.blood_group === bg
                      ? 'bg-red-600 text-white border-red-600 shadow-sm'
                      : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  {bg}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700">Blood Component *</label>
              <select
                name="component"
                value={form.component}
                onChange={handleChange}
                className="mt-1 block w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:border-red-500 outline-hidden bg-white"
              >
                {components.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700">Units Requested (1–50) *</label>
              <input
                type="number"
                name="units_requested"
                min="1"
                max="50"
                required
                value={form.units_requested}
                onChange={handleChange}
                className="mt-1 block w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:border-red-500 outline-hidden"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700">Urgency Level *</label>
              <select
                name="urgency"
                value={form.urgency}
                onChange={handleChange}
                className="mt-1 block w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:border-red-500 outline-hidden bg-white"
              >
                <option value="CRITICAL">Critical (Immediate &lt; 2h)</option>
                <option value="URGENT">Urgent (Within 6h)</option>
                <option value="STANDARD">Standard (Within 24h)</option>
              </select>
            </div>
          </div>
        </div>

        {/* Section 2: Hospital & Location */}
        <div className="space-y-4">
          <h3 className="text-xs font-extrabold text-slate-900 uppercase tracking-wider border-b border-slate-100 pb-2">
            2. Treating Hospital Facility Details
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700">Hospital / Facility Name *</label>
              <input
                type="text"
                name="hospital_name"
                required
                value={form.hospital_name}
                onChange={handleChange}
                placeholder="e.g. Victoria Hospital"
                className="mt-1 block w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:border-red-500 outline-hidden"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700">Patient / Case Reference (Anonymized)</label>
              <input
                type="text"
                name="patient_case_ref"
                value={form.patient_case_ref}
                onChange={handleChange}
                placeholder="e.g. BED-ICU-104 or OPD Case Ref"
                className="mt-1 block w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:border-red-500 outline-hidden"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-slate-700">Hospital Address / Street *</label>
              <input
                type="text"
                name="hospital_address"
                required
                value={form.hospital_address}
                onChange={handleChange}
                className="mt-1 block w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:border-red-500 outline-hidden"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700">Locality / Area *</label>
              <input
                type="text"
                name="locality"
                required
                value={form.locality}
                onChange={handleChange}
                placeholder="e.g. Fort, Bengaluru"
                className="mt-1 block w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:border-red-500 outline-hidden"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700">Required By (Date & Time) *</label>
              <input
                type="datetime-local"
                name="required_by"
                required
                value={form.required_by}
                onChange={handleChange}
                className="mt-1 block w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:border-red-500 outline-hidden"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700">Contact Phone Number *</label>
              <input
                type="tel"
                name="contact_phone"
                required
                value={form.contact_phone}
                onChange={handleChange}
                className="mt-1 block w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:border-red-500 outline-hidden"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700">Reason / Clinical Context</label>
            <textarea
              name="reason"
              rows={3}
              value={form.reason}
              onChange={handleChange}
              placeholder="e.g. Emergency surgery, trauma resuscitation, chemotherapy replacement"
              className="mt-1 block w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:border-red-500 outline-hidden"
            />
          </div>
        </div>

        {/* Confirmation check */}
        <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 flex items-start gap-3">
          <input
            type="checkbox"
            id="accuracy"
            name="accuracy_confirmed"
            checked={form.accuracy_confirmed}
            onChange={handleChange}
            className="mt-0.5 rounded border-slate-300 text-red-600 focus:ring-red-500"
          />
          <label htmlFor="accuracy" className="text-xs text-slate-700 leading-relaxed">
            I confirm that this blood request represents a genuine clinical requirement for the treating hospital specified. I understand that an administrator will verify these details before donor alerts are dispatched.
          </label>
        </div>

        <div className="flex justify-end gap-3 pt-2">
          <button
            type="button"
            onClick={() => navigate('/requester/dashboard')}
            className="px-5 py-2.5 rounded-xl border border-slate-300 text-slate-700 text-xs font-semibold hover:bg-slate-50 transition"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={loading}
            className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold text-xs shadow-md shadow-red-600/20 transition disabled:opacity-70"
          >
            {loading ? (
              <span>Submitting Request...</span>
            ) : (
              <>
                <PlusCircle className="w-4 h-4" />
                <span>Submit Blood Request</span>
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
};

export default CreateRequestPage;
