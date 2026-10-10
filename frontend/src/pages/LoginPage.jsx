import React, { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth, DEMO_CREDENTIALS } from '../context/AuthContext';
import Logo from '../components/Logo';
import { LogIn, Sparkles, AlertCircle, ArrowRight, ShieldCheck, Heart, User } from 'lucide-react';

const LoginPage = () => {
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login, quickLogin } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const handleRedirect = (role) => {
    if (location.state?.from) {
      navigate(location.state.from);
      return;
    }
    if (role === 'admin') {
      navigate('/admin-portal/dashboard');
    } else if (role === 'donor') {
      navigate('/donor/dashboard');
    } else {
      navigate('/requester/dashboard');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    const res = await login(identifier, password);
    setLoading(false);
    if (res.success) {
      handleRedirect(res.user.role);
    } else {
      setError(res.error);
    }
  };

  const handleDemoClick = async (key) => {
    setError('');
    setLoading(true);
    const res = await quickLogin(key);
    setLoading(false);
    if (res.success) {
      handleRedirect(res.user.role);
    } else {
      setError(res.error);
    }
  };

  const teamAdmins = [
    { key: 'admin_freddy', label: 'Freddy Matthew R' },
    { key: 'admin_joshua', label: 'Joshua Bennet C' },
    { key: 'admin_boopathi', label: 'Boopathi P R' },
    { key: 'admin_balakumaran', label: 'Balakumaran E' },
    { key: 'admin_abilash', label: 'Abilash Alexander A' },
    { key: 'admin_harisankaran', label: 'Harisankaran J' }
  ];

  return (
    <div className="min-h-[75vh] flex flex-col justify-center py-8 px-4 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-lg space-y-2 text-center">
        <Logo size="lg" className="justify-center" />
        <h2 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
          Sign In to BloodConnect
        </h2>
        <p className="text-xs sm:text-sm text-slate-500">
          Emergency Blood Donor Matching and Blood Availability Monitoring System (Chennai)
        </p>
      </div>

      <div className="mt-6 sm:mx-auto sm:w-full sm:max-w-xl space-y-6">
        {/* Examiner Quick-Demo Buttons Card */}
        <div className="p-4 rounded-2xl bg-amber-50/90 border border-amber-200 shadow-2xs space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs font-bold text-amber-950">
              <Sparkles className="w-4 h-4 text-amber-600" />
              <span>External Examiner 1-Click Demo Logins</span>
            </div>
            <span className="text-[10px] bg-amber-200/80 text-amber-900 font-bold px-2 py-0.5 rounded-full">
              Chennai Prototype
            </span>
          </div>

          <p className="text-[11px] text-amber-900 leading-relaxed">
            Click any team member below to authenticate into the shared administrator interface with full operational privileges:
          </p>

          {/* 6 Team Admin Accounts */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {teamAdmins.map((adm) => (
              <button
                key={adm.key}
                type="button"
                onClick={() => handleDemoClick(adm.key)}
                disabled={loading}
                className="flex items-center gap-1.5 p-2 rounded-xl bg-white border border-amber-300/80 text-amber-950 text-xs font-bold hover:bg-amber-100/70 transition shadow-2xs text-left"
              >
                <ShieldCheck className="w-3.5 h-3.5 text-amber-700 shrink-0" />
                <span className="truncate">{adm.label}</span>
              </button>
            ))}
          </div>

          {/* Requesters & Donors */}
          <div className="pt-2 border-t border-amber-200/70 grid grid-cols-3 gap-2">
            <button
              type="button"
              onClick={() => handleDemoClick('requester')}
              disabled={loading}
              className="flex items-center justify-center gap-1 p-2 rounded-xl bg-white border border-blue-200 text-blue-900 text-xs font-bold hover:bg-blue-50 transition shadow-2xs"
            >
              <User className="w-3.5 h-3.5 text-blue-600 shrink-0" />
              <span>Requester (Ananya)</span>
            </button>
            <button
              type="button"
              onClick={() => handleDemoClick('donor_o_neg')}
              disabled={loading}
              className="flex items-center justify-center gap-1 p-2 rounded-xl bg-white border border-red-200 text-red-900 text-xs font-bold hover:bg-red-50 transition shadow-2xs"
            >
              <Heart className="w-3.5 h-3.5 text-red-600 shrink-0" />
              <span>Donor O- (Vikram)</span>
            </button>
            <button
              type="button"
              onClick={() => handleDemoClick('donor_a_pos')}
              disabled={loading}
              className="flex items-center justify-center gap-1 p-2 rounded-xl bg-white border border-red-200 text-red-900 text-xs font-bold hover:bg-red-50 transition shadow-2xs"
            >
              <Heart className="w-3.5 h-3.5 text-red-600 shrink-0" />
              <span>Donor A+ (Rahul)</span>
            </button>
          </div>
        </div>

        {/* Form Container */}
        <div className="bg-white py-6 px-6 sm:px-8 shadow-xl shadow-slate-200/50 rounded-3xl border border-slate-200">
          <form className="space-y-4" onSubmit={handleSubmit}>
            {error && (
              <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-slate-700">
                Email Address or Username
              </label>
              <input
                type="text"
                required
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                placeholder="e.g. freddy.admin or freddy.admin@bloodconnect.org"
                className="mt-1 block w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:border-red-500 focus:ring-2 focus:ring-red-200 transition outline-hidden"
              />
              <p className="text-[11px] text-slate-400 mt-1">
                Admin usernames: <code>freddy.admin</code>, <code>joshua.admin</code>, <code>boopathi.admin</code>, <code>balakumaran.admin</code>, <code>abilash.admin</code>, <code>harisankaran.admin</code>
              </p>
            </div>

            <div>
              <div className="flex items-center justify-between">
                <label className="block text-xs font-semibold text-slate-700">
                  Password
                </label>
                <span className="text-[11px] text-slate-400">Default: Admin@1234</span>
              </div>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="mt-1 block w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:border-red-500 focus:ring-2 focus:ring-red-200 transition outline-hidden"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl text-white font-bold text-sm bg-red-600 hover:bg-red-700 focus:ring-2 focus:ring-red-300 transition shadow-md shadow-red-600/20 disabled:opacity-70"
            >
              {loading ? (
                <span>Authenticating...</span>
              ) : (
                <>
                  <LogIn className="w-4 h-4" />
                  <span>Sign In</span>
                </>
              )}
            </button>
          </form>

          <div className="mt-4 pt-4 border-t border-slate-100 text-center">
            <p className="text-xs text-slate-500">
              Don't have an account yet?{' '}
              <Link to="/register" className="font-bold text-red-600 hover:text-red-700">
                Register as Requester or Donor
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
