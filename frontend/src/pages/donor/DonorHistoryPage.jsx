import React, { useState, useEffect } from 'react';
import apiClient from '../../api/client';
import { History, PlusCircle, CheckCircle2, Building2, Calendar, Award, X } from 'lucide-react';

const DonorHistoryPage = () => {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState({
    donation_date: new Date().toISOString().slice(0, 10),
    facility_name: 'Victoria Hospital Blood Bank',
    units: 1,
    component: 'Whole Blood',
    certificate_ref: '',
    notes: 'Voluntary replacement donation',
  });
  const [submitting, setSubmitting] = useState(false);

  const fetchHistory = async () => {
    try {
      const res = await apiClient.get('/donors/history/');
      setHistory(res.data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHistory();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await apiClient.post('/donors/history/', form);
      setModalOpen(false);
      fetchHistory();
    } catch (err) {
      alert('Failed to log donation record');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-3xl border border-slate-200 shadow-xs">
        <div>
          <span className="text-xs font-bold text-red-600 uppercase tracking-wider">
            Verified Donation Log
          </span>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight mt-0.5">
            Donation History & Certificates
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Track your voluntary donations, units contributed, and blood bank facilities.
          </p>
        </div>

        <button
          onClick={() => setModalOpen(true)}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-red-600 text-white font-bold text-xs hover:bg-red-700 transition shadow-sm shrink-0"
        >
          <PlusCircle className="w-4 h-4" />
          <span>Record New Donation</span>
        </button>
      </div>

      {loading ? (
        <div className="py-12 text-center text-slate-400 text-xs">Loading donation history...</div>
      ) : history.length === 0 ? (
        <div className="p-12 text-center bg-white rounded-3xl border border-slate-200 text-slate-400 text-xs space-y-2">
          <p className="font-semibold text-slate-700">No donations recorded in your account yet.</p>
          <p>Click "Record New Donation" above after donating at an authorized blood bank centre.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {history.map((record) => (
            <div
              key={record.id}
              className="p-5 rounded-2xl bg-white border border-slate-200 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-4"
            >
              <div className="flex items-start gap-3">
                <div className="p-3 rounded-xl bg-red-50 text-red-600 shrink-0">
                  <Award className="w-5 h-5" />
                </div>
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold text-sm text-slate-900">
                      {record.units} unit(s) of {record.component}
                    </h3>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                      Verified
                    </span>
                  </div>
                  <p className="text-xs text-slate-600 flex items-center gap-1.5">
                    <Building2 className="w-3.5 h-3.5 text-slate-400" />
                    <span>{record.facility_name}</span>
                  </p>
                  {record.notes && (
                    <p className="text-[11px] text-slate-500">{record.notes}</p>
                  )}
                </div>
              </div>

              <div className="text-left sm:text-right text-xs text-slate-500 space-y-1 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-100">
                <div className="flex items-center sm:justify-end gap-1 text-slate-700 font-semibold">
                  <Calendar className="w-3.5 h-3.5 text-slate-400" />
                  <span>Donated on {record.donation_date}</span>
                </div>
                {record.certificate_ref && (
                  <p className="text-[11px] text-slate-400">Ref: {record.certificate_ref}</p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Record Donation Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs" onClick={() => setModalOpen(false)} />
          <div className="relative w-full max-w-lg bg-white rounded-3xl p-6 shadow-2xl border border-slate-200 z-10 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="font-black text-base text-slate-900">Record Voluntary Donation</h3>
              <button onClick={() => setModalOpen(false)} className="p-1 text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-700">Donation Date *</label>
                <input
                  type="date"
                  required
                  value={form.donation_date}
                  onChange={(e) => setForm({ ...form, donation_date: e.target.value })}
                  className="mt-1 block w-full px-3 py-2 rounded-xl border border-slate-300 outline-hidden"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700">Hospital / Blood Bank Facility *</label>
                <input
                  type="text"
                  required
                  value={form.facility_name}
                  onChange={(e) => setForm({ ...form, facility_name: e.target.value })}
                  className="mt-1 block w-full px-3 py-2 rounded-xl border border-slate-300 outline-hidden"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700">Units Donated</label>
                  <input
                    type="number"
                    min="1"
                    max="5"
                    required
                    value={form.units}
                    onChange={(e) => setForm({ ...form, units: e.target.value })}
                    className="mt-1 block w-full px-3 py-2 rounded-xl border border-slate-300 outline-hidden"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700">Component</label>
                  <select
                    value={form.component}
                    onChange={(e) => setForm({ ...form, component: e.target.value })}
                    className="mt-1 block w-full px-3 py-2 rounded-xl border border-slate-300 outline-hidden bg-white"
                  >
                    <option value="Whole Blood">Whole Blood</option>
                    <option value="Packed Red Blood Cells">Packed Red Blood Cells</option>
                    <option value="Platelets">Platelets</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700">Certificate Reference Number (Optional)</label>
                <input
                  type="text"
                  value={form.certificate_ref}
                  onChange={(e) => setForm({ ...form, certificate_ref: e.target.value })}
                  placeholder="e.g. CERT-2026-KA-991"
                  className="mt-1 block w-full px-3 py-2 rounded-xl border border-slate-300 outline-hidden"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700">Notes</label>
                <textarea
                  rows={2}
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  className="mt-1 block w-full px-3 py-2 rounded-xl border border-slate-300 outline-hidden"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 rounded-xl bg-red-600 text-white font-bold hover:bg-red-700 transition"
                >
                  {submitting ? 'Saving...' : 'Save Record'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default DonorHistoryPage;
