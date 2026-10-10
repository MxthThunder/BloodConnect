import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Logo from '../components/Logo';
import { CHENNAI_LOCALITIES } from '../constants/chennaiData';
import { Heart, User, CheckCircle2, AlertCircle, ArrowRight } from 'lucide-react';

const RegisterPage = () => {
  const [searchParams] = useSearchParams();
  const initialRole = searchParams.get('role') === 'donor' ? 'donor' : 'requester';
  const [role, setRole] = useState(initialRole);

  const [formData, setFormData] = useState({
    email: '',
    password: '',
    first_name: '',
    last_name: '',
    phone: '',
    city: 'Chennai',
    locality: 'Adyar',
    blood_group: 'O+',
    notification_consent: true,
    preferred_contact: 'in_app',
    terms_agreed: true,
  });

  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { register } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (searchParams.get('role')) {
      setRole(searchParams.get('role'));
    }
  }, [searchParams]);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!formData.terms_agreed) {
      setError('You must agree to the data privacy and notification policy.');
      return;
    }

    setLoading(true);
    const payload = {
      ...formData,
      role,
    };

    const res = await register(payload);
    setLoading(false);

    if (res.success) {
      if (role === 'donor') {
        navigate('/donor/dashboard');
      } else {
        navigate('/requester/dashboard');
      }
    } else {
      setError(res.error);
    }
  };

  const bloodGroups = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];

  return (
    <div className="min-h-[85vh] flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-xl text-center space-y-2">
        <Logo size="lg" className="justify-center" />
        <h2 className="text-2xl font-black text-slate-900 tracking-tight">
          Join the BloodConnect Network
        </h2>
        <p className="text-xs text-slate-500">
          Create your account as a blood requester or voluntary emergency donor
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-xl">
        <div className="bg-white py-8 px-6 shadow-xl shadow-slate-200/50 sm:rounded-3xl sm:px-10 border border-slate-200 space-y-6">
          {/* Role Selection Tabs */}
          <div className="grid grid-cols-2 p-1.5 rounded-2xl bg-slate-100 border border-slate-200">
            <button
              type="button"
              onClick={() => setRole('requester')}
              className={`flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-bold transition ${
                role === 'requester'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              <User className="w-4 h-4 text-blue-600" />
              <span>I Need Blood (Requester)</span>
            </button>
            <button
              type="button"
              onClick={() => setRole('donor')}
              className={`flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-bold transition ${
                role === 'donor'
                  ? 'bg-white text-red-600 shadow-sm'
                  : 'text-slate-500 hover:text-red-600'
              }`}
            >
              <Heart className="w-4 h-4 text-red-600" />
              <span>I Want to Donate (Donor)</span>
            </button>
          </div>

          {error && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <form className="space-y-4" onSubmit={handleSubmit}>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700">First Name *</label>
                <input
                  type="text"
                  name="first_name"
                  required
                  value={formData.first_name}
                  onChange={handleChange}
                  className="mt-1 block w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:border-red-500 focus:ring-2 focus:ring-red-200 outline-hidden"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700">Last Name</label>
                <input
                  type="text"
                  name="last_name"
                  value={formData.last_name}
                  onChange={handleChange}
                  className="mt-1 block w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:border-red-500 focus:ring-2 focus:ring-red-200 outline-hidden"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700">Email Address *</label>
                <input
                  type="email"
                  name="email"
                  required
                  value={formData.email}
                  onChange={handleChange}
                  placeholder="name@example.com"
                  className="mt-1 block w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:border-red-500 focus:ring-2 focus:ring-red-200 outline-hidden"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700">Password (min 6 chars) *</label>
                <input
                  type="password"
                  name="password"
                  required
                  minLength={6}
                  value={formData.password}
                  onChange={handleChange}
                  placeholder="••••••••"
                  className="mt-1 block w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:border-red-500 focus:ring-2 focus:ring-red-200 outline-hidden"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700">Phone Number *</label>
                <input
                  type="tel"
                  name="phone"
                  required
                  value={formData.phone}
                  onChange={handleChange}
                  placeholder="+91 98450 00000"
                  className="mt-1 block w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:border-red-500 focus:ring-2 focus:ring-red-200 outline-hidden"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700">City *</label>
                <input
                  type="text"
                  name="city"
                  required
                  readOnly
                  value={formData.city}
                  onChange={handleChange}
                  className="mt-1 block w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm bg-slate-50 focus:border-red-500 outline-hidden"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700">Chennai Locality *</label>
                <select
                  name="locality"
                  required
                  value={formData.locality}
                  onChange={handleChange}
                  className="mt-1 block w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:border-red-500 outline-hidden bg-white"
                >
                  {CHENNAI_LOCALITIES.map((loc) => (
                    <option key={loc} value={loc}>{loc}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Donor Specific Fields */}
            {role === 'donor' && (
              <div className="p-4 rounded-2xl bg-red-50/50 border border-red-100 space-y-4">
                <h4 className="text-xs font-bold text-red-950 uppercase tracking-wider">
                  Donor Profile Attributes
                </h4>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    Select Your Blood Group *
                  </label>
                  <div className="grid grid-cols-4 sm:grid-cols-8 gap-2">
                    {bloodGroups.map((bg) => (
                      <button
                        type="button"
                        key={bg}
                        onClick={() => setFormData({ ...formData, blood_group: bg })}
                        className={`py-2 rounded-xl text-xs font-extrabold border transition ${
                          formData.blood_group === bg
                            ? 'bg-red-600 text-white border-red-600 shadow-sm'
                            : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                        }`}
                      >
                        {bg}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex items-start gap-2 pt-2">
                  <input
                    type="checkbox"
                    id="consent"
                    name="notification_consent"
                    checked={formData.notification_consent}
                    onChange={handleChange}
                    className="mt-0.5 rounded border-slate-300 text-red-600 focus:ring-red-500"
                  />
                  <label htmlFor="consent" className="text-xs text-slate-600">
                    I grant explicit consent to receive verified emergency blood donation alerts matching my blood group in my locality.
                  </label>
                </div>
              </div>
            )}

            <div className="flex items-start gap-2 pt-2">
              <input
                type="checkbox"
                id="terms"
                name="terms_agreed"
                checked={formData.terms_agreed}
                onChange={handleChange}
                className="mt-0.5 rounded border-slate-300 text-red-600 focus:ring-red-500"
              />
              <label htmlFor="terms" className="text-xs text-slate-600">
                I agree to the privacy policy. I understand that BloodConnect coordinates potential donor matching, and that clinical crossmatching and transfusion safety must be conducted by the authorized blood bank.
              </label>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl text-white font-bold text-sm bg-red-600 hover:bg-red-700 focus:ring-2 focus:ring-red-300 transition shadow-md shadow-red-600/20 disabled:opacity-70"
            >
              {loading ? (
                <span>Registering Account...</span>
              ) : (
                <>
                  <span>Complete Registration ({role})</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          <div className="pt-4 border-t border-slate-100 text-center">
            <p className="text-xs text-slate-500">
              Already registered?{' '}
              <Link to="/login" className="font-bold text-red-600 hover:text-red-700">
                Sign in to your account
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RegisterPage;
