import { useAuth } from '../../context/AuthContext';
import apiClient from '../../api/client';
import { CHENNAI_LOCALITIES } from '../../constants/chennaiData';
import { User, Phone, MapPin, Mail, CheckCircle2, AlertCircle } from 'lucide-react';

const RequesterProfilePage = () => {
  const { user, refreshUser } = useAuth();
  const [form, setForm] = useState({
    first_name: user?.first_name || '',
    last_name: user?.last_name || '',
    phone: user?.phone || '',
    city: user?.city || 'Chennai',
    locality: user?.locality || 'T. Nagar',
  });
  const [loading, setLoading] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSaved(false);
    try {
      await apiClient.put('/auth/profile/', form);
      await refreshUser();
      setSaved(true);
    } catch (err) {
      setError('Failed to update profile settings.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-xs">
        <span className="text-xs font-bold text-red-600 uppercase tracking-wider">
          Account Preferences
        </span>
        <h1 className="text-2xl font-black text-slate-900 tracking-tight mt-0.5">
          Requester Profile & Contacts
        </h1>
        <p className="text-xs text-slate-500 mt-1">
          Keep your phone number and locality updated to facilitate smooth hospital coordination.
        </p>
      </div>

      <div className="bg-white p-6 sm:p-8 rounded-3xl border border-slate-200 shadow-sm space-y-6">
        {saved && (
          <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>Profile settings saved successfully.</span>
          </div>
        )}

        {error && (
          <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700">First Name</label>
              <input
                type="text"
                required
                value={form.first_name}
                onChange={(e) => setForm({ ...form, first_name: e.target.value })}
                className="mt-1 block w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:border-red-500 outline-hidden"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700">Last Name</label>
              <input
                type="text"
                value={form.last_name}
                onChange={(e) => setForm({ ...form, last_name: e.target.value })}
                className="mt-1 block w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:border-red-500 outline-hidden"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700">Email Address (Read-only)</label>
            <input
              type="email"
              disabled
              value={user?.email || ''}
              className="mt-1 block w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-slate-100 text-sm text-slate-500 outline-hidden cursor-not-allowed"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700">Contact Phone Number</label>
            <input
              type="tel"
              required
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
              className="mt-1 block w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:border-red-500 outline-hidden"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700">City</label>
              <input
                type="text"
                required
                readOnly
                value={form.city}
                className="mt-1 block w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm bg-slate-50 focus:border-red-500 outline-hidden"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700">Chennai Locality</label>
              <select
                name="locality"
                required
                value={form.locality}
                onChange={(e) => setForm({ ...form, locality: e.target.value })}
                className="mt-1 block w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:border-red-500 outline-hidden bg-white"
              >
                {CHENNAI_LOCALITIES.map((loc) => (
                  <option key={loc} value={loc}>{loc}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="pt-2">
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold text-xs shadow-md shadow-red-600/20 transition disabled:opacity-70"
            >
              {loading ? 'Saving...' : 'Update Account Details'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default RequesterProfilePage;
