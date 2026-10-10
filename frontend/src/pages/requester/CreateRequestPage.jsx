import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import apiClient from '../../api/client';
import ClinicalDisclaimer from '../../components/ClinicalDisclaimer';
import { CHENNAI_LOCALITIES, CHENNAI_HOSPITALS } from '../../constants/chennaiData';
import { PlusCircle, AlertCircle, Building2, Clock, Phone, MapPin, ArrowRight } from 'lucide-react';

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
    hospital_name: 'Rajiv Gandhi Govt General Hospital',
    hospital_address: 'EVR Periyar Salai, Park Town, Chennai, Tamil Nadu 600003',
    city: 'Chennai',
    locality: 'Perambur',
    urgency: 'URGENT',
    required_by: defaultRequiredTime,
    reason: 'Emergency surgery scheduled; standby blood units required for transfusion support.',
    contact_phone: '+91 94440 12345',
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

  const handleHospitalSelect = (e) => {
    const selectedName = e.target.value;
    const h = CHENNAI_HOSPITALS.find((item) => item.name === selectedName);
    if (h) {
      setForm((prev) => ({
        ...prev,
        hospital_name: h.name,
        hospital_address: h.address,
        locality: h.locality,
        city: 'Chennai',
      }));
    }
  };

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
    <div className="max-w-4xl mx-auto space-y-5">
      <div className="bg-white p-5 sm:p-6 rounded-2xl border border-slate-200 shadow-2xs">
        <span className="text-xs font-bold text-red-600 uppercase tracking-wider">
          Emergency Coordination &bull; Chennai Hub
        </span>
        <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight mt-0.5">
          Submit Emergency Blood Request
        </h1>
        <p className="text-xs text-slate-500 mt-0.5">
          The request will enter a pending-verification state for review by medical administrators before dispatching alerts to donors across Chennai.
        </p>
      </div>

      <ClinicalDisclaimer compact={true} />

      {error && (
        <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-start gap-2">
          <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="bg-white p-5 sm:p-7 rounded-2xl border border-slate-200 shadow-2xs space-y-6">
        {/* Section 1: Blood Group and Component */}
        <div className="space-y-3.5">
          <h3 className="text-xs font-extrabold text-slate-900 uppercase tracking-wider border-b border-slate-100 pb-2 flex items-center gap-1.5">
            <span className="w-4 h-4 rounded-full bg-red-600 text-white text-[10px] flex items-center justify-center font-bold">1</span>
            Transfusion Requirement Specification
          </h3>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Required Blood Group *
            </label>
            <div className="grid grid-cols-4 sm:grid-cols-8 gap-1.5">
              {bloodGroups.map((bg) => (
                <button
                  type="button"
                  key={bg}
                  onClick={() => setForm({ ...form, blood_group: bg })}
                  className={`py-2 rounded-xl text-xs font-extrabold border transition ${
                    form.blood_group === bg
                      ? 'bg-red-600 text-white border-red-600 shadow-xs'
                      : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  {bg}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
            <div>
              <label className="block text-xs font-semibold text-slate-700">Blood Component *</label>
              <select
                name="component"
                value={form.component}
                onChange={handleChange}
                className="mt-1 block w-full px-3 py-2 rounded-xl border border-slate-300 text-xs sm:text-sm focus:border-red-500 outline-hidden bg-white"
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
                className="mt-1 block w-full px-3 py-2 rounded-xl border border-slate-300 text-xs sm:text-sm focus:border-red-500 outline-hidden"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700">Urgency Level *</label>
              <select
                name="urgency"
                value={form.urgency}
                onChange={handleChange}
                className="mt-1 block w-full px-3 py-2 rounded-xl border border-slate-300 text-xs sm:text-sm focus:border-red-500 outline-hidden bg-white"
              >
                <option value="CRITICAL">Critical (Immediate &lt; 2h)</option>
                <option value="URGENT">Urgent (Within 6h)</option>
                <option value="STANDARD">Standard (Within 24h)</option>
              </select>
            </div>
          </div>
        </div>

        {/* Section 2: Hospital & Location */}
        <div className="space-y-3.5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 border-b border-slate-100 pb-2">
            <h3 className="text-xs font-extrabold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
              <span className="w-4 h-4 rounded-full bg-red-600 text-white text-[10px] flex items-center justify-center font-bold">2</span>
              Chennai Treating Hospital Facility Details
            </h3>
            {/* Quick hospital auto-fill picker */}
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] text-slate-400 font-medium">Quick Select Hospital:</span>
              <select
                onChange={handleHospitalSelect}
                className="text-[11px] font-bold text-red-600 bg-red-50 border border-red-200 rounded-lg px-2 py-1 outline-hidden"
              >
                <option value="">Choose Monitored Facility...</option>
                {CHENNAI_HOSPITALS.map((h) => (
                  <option key={h.name} value={h.name}>{h.name} ({h.locality})</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div>
              <label className="block text-xs font-semibold text-slate-700">Hospital / Facility Name *</label>
              <input
                type="text"
                name="hospital_name"
                required
                value={form.hospital_name}
                onChange={handleChange}
                placeholder="e.g. Rajiv Gandhi Govt General Hospital"
                className="mt-1 block w-full px-3 py-2 rounded-xl border border-slate-300 text-xs sm:text-sm focus:border-red-500 outline-hidden"
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
                className="mt-1 block w-full px-3 py-2 rounded-xl border border-slate-300 text-xs sm:text-sm focus:border-red-500 outline-hidden"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-slate-700">Hospital Address / Street *</label>
              <input
                type="text"
                name="hospital_address"
                required
                value={form.hospital_address}
                onChange={handleChange}
                placeholder="Hospital street and landmark"
                className="mt-1 block w-full px-3 py-2 rounded-xl border border-slate-300 text-xs sm:text-sm focus:border-red-500 outline-hidden"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700">Chennai Locality *</label>
              <select
                name="locality"
                required
                value={form.locality}
                onChange={handleChange}
                className="mt-1 block w-full px-3 py-2 rounded-xl border border-slate-300 text-xs sm:text-sm focus:border-red-500 outline-hidden bg-white"
              >
                {CHENNAI_LOCALITIES.map((loc) => (
                  <option key={loc} value={loc}>{loc}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div>
              <label className="block text-xs font-semibold text-slate-700">Required By (Date & Time, IST) *</label>
              <input
                type="datetime-local"
                name="required_by"
                required
                value={form.required_by}
                onChange={handleChange}
                className="mt-1 block w-full px-3 py-2 rounded-xl border border-slate-300 text-xs sm:text-sm focus:border-red-500 outline-hidden"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700">Contact Phone Number (+91) *</label>
              <input
                type="tel"
                name="contact_phone"
                required
                value={form.contact_phone}
                onChange={handleChange}
                placeholder="+91 94440 12345"
                className="mt-1 block w-full px-3 py-2 rounded-xl border border-slate-300 text-xs sm:text-sm focus:border-red-500 outline-hidden"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700">Reason / Clinical Context</label>
            <textarea
              name="reason"
              rows={2}
              value={form.reason}
              onChange={handleChange}
              placeholder="e.g. Emergency surgery, trauma resuscitation, chemotherapy replacement"
              className="mt-1 block w-full px-3 py-2 rounded-xl border border-slate-300 text-xs sm:text-sm focus:border-red-500 outline-hidden"
            />
          </div>
        </div>

        {/* Confirmation check */}
        <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 flex items-start gap-3">
          <input
            type="checkbox"
            id="accuracy"
            name="accuracy_confirmed"
            checked={form.accuracy_confirmed}
            onChange={handleChange}
            className="mt-0.5 rounded border-slate-300 text-red-600 focus:ring-red-500"
          />
          <label htmlFor="accuracy" className="text-xs text-slate-700 leading-relaxed">
            I confirm that this blood request represents a genuine clinical requirement for the treating hospital specified in Chennai, Tamil Nadu. I understand that an authorized administrator will verify these details before donor alerts are dispatched.
          </label>
        </div>

        <div className="flex justify-end gap-3 pt-1">
          <button
            type="button"
            onClick={() => navigate('/requester/dashboard')}
            className="px-4 py-2 rounded-xl border border-slate-300 text-slate-700 text-xs font-semibold hover:bg-slate-50 transition"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={loading}
            className="flex items-center gap-2 px-5 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold text-xs shadow-md shadow-red-600/20 transition disabled:opacity-70"
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
