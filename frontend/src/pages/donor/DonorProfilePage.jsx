import React, { useState, useEffect } from 'react';
import apiClient from '../../api/client';
import BloodGroupBadge from '../../components/BloodGroupBadge';
import ClinicalDisclaimer from '../../components/ClinicalDisclaimer';
import { CHENNAI_LOCALITIES } from '../../constants/chennaiData';
import { User, Heart, MapPin, Bell, CheckCircle2, AlertCircle, ShieldCheck } from 'lucide-react';

const DonorProfilePage = () => {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  const bloodGroups = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];

  const fetchProfile = async () => {
    try {
      const res = await apiClient.get('/donors/profile/');
      setProfile(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProfile();
  }, []);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setProfile((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    setSaved(false);
    try {
      await apiClient.put('/donors/profile/', profile);
      setSaved(true);
      fetchProfile();
    } catch (err) {
      setError('Failed to update donor profile settings.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="py-12 text-center text-slate-400 text-xs">Loading donor profile...</div>;
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-xs">
        <span className="text-xs font-bold text-red-600 uppercase tracking-wider">
          Donor Identity & Availability
        </span>
        <h1 className="text-2xl font-black text-slate-900 tracking-tight mt-0.5">
          Donor Profile Settings
        </h1>
        <p className="text-xs text-slate-500 mt-1">
          Control your matching parameters, locality boundaries, and emergency notification preferences.
        </p>
      </div>

      <ClinicalDisclaimer compact={true} />

      <div className="bg-white p-6 sm:p-8 rounded-3xl border border-slate-200 shadow-sm space-y-6">
        {saved && (
          <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>Donor settings saved successfully.</span>
          </div>
        )}

        {error && (
          <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Blood group selection */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
              Blood Group (ABO / Rh System) *
            </label>
            <div className="grid grid-cols-4 sm:grid-cols-8 gap-2">
              {bloodGroups.map((bg) => (
                <button
                  type="button"
                  key={bg}
                  onClick={() => setProfile({ ...profile, blood_group: bg })}
                  className={`py-2.5 rounded-xl text-xs font-extrabold border transition ${
                    profile?.blood_group === bg
                      ? 'bg-red-600 text-white border-red-600 shadow-sm'
                      : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  {bg}
                </button>
              ))}
            </div>
          </div>

          {/* Location details */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700">City *</label>
              <input
                type="text"
                name="city"
                required
                readOnly
                value={profile?.city || 'Chennai'}
                className="mt-1 block w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm bg-slate-50 focus:border-red-500 outline-hidden"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700">Chennai Locality *</label>
              <select
                name="locality"
                required
                value={profile?.locality || 'Adyar'}
                onChange={handleChange}
                className="mt-1 block w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:border-red-500 outline-hidden bg-white"
              >
                {CHENNAI_LOCALITIES.map((loc) => (
                  <option key={loc} value={loc}>{loc}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Availability switch */}
          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 flex items-center justify-between">
            <div>
              <h4 className="font-bold text-xs text-slate-900">Current Availability State</h4>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Turn off when traveling, feeling unwell, or temporarily deferred from donating.
              </p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                name="is_available"
                checked={!!profile?.is_available}
                onChange={handleChange}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-slate-300 peer-focus:outline-hidden rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600"></div>
            </label>
          </div>

          {/* Consent switch */}
          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 flex items-center justify-between">
            <div>
              <h4 className="font-bold text-xs text-slate-900">Emergency Broadcast Consent</h4>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Explicit permission to receive urgent alerts when an administrator approves a matching blood request.
              </p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                name="notification_consent"
                checked={!!profile?.notification_consent}
                onChange={handleChange}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-slate-300 peer-focus:outline-hidden rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-red-600"></div>
            </label>
          </div>

          {/* Preferred contact */}
          <div>
            <label className="block text-xs font-semibold text-slate-700">Preferred Contact Channel</label>
            <select
              name="preferred_contact"
              value={profile?.preferred_contact || 'in_app'}
              onChange={handleChange}
              className="mt-1 block w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:border-red-500 outline-hidden bg-white"
            >
              <option value="in_app">In-App Emergency Alerts</option>
              <option value="phone">Phone Call (Hospital Coordinator)</option>
              <option value="sms">Simulated SMS</option>
              <option value="email">Email Notification</option>
            </select>
          </div>

          <div className="pt-2">
            <button
              type="submit"
              disabled={saving}
              className="w-full py-3 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold text-xs shadow-md shadow-red-600/20 transition disabled:opacity-70"
            >
              {saving ? 'Updating...' : 'Save Donor Settings'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default DonorProfilePage;
