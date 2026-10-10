import React, { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth, DEMO_CREDENTIALS } from '../context/AuthContext';
import Logo from '../components/Logo';
import { LogIn, Sparkles, AlertCircle, ArrowRight, ShieldCheck, Heart, User } from 'lucide-react';

const LoginPage = () => {
  const [email, setEmail] = useState('');
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
    const res = await login(email, password);
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

  return (
    <div className="min-h-[80vh] flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md space-y-3 text-center">
        <Logo size="lg" className="justify-center" />
        <h2 className="text-2xl font-black text-slate-900 tracking-tight">
          Sign In to BloodConnect
        </h2>
        <p className="text-xs text-slate-500">
          Access your requester dashboard, donor matching alerts, or admin portal
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md space-y-6">
        {/* Examiner Quick-Demo Buttons Card */}
        <div className="p-4 rounded-2xl bg-amber-50/80 border border-amber-200/90 shadow-2xs space-y-3">
          <div className="flex items-center gap-2 text-xs font-bold text-amber-950">
            <Sparkles className="w-4 h-4 text-amber-600" />
            <span>External Examiner 1-Click Demo Login</span>
          </div>
          <p className="text-[11px] text-amber-800 leading-relaxed">
            Click any demo profile to test role-specific workflows without manually typing credentials:
          </p>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => handleDemoClick('admin')}
              disabled={loading}
              className="flex items-center gap-1.5 p-2 rounded-xl bg-white border border-amber-300 text-amber-950 text-xs font-bold hover:bg-amber-100/60 transition shadow-2xs"
            >
              <ShieldCheck className="w-3.5 h-3.5 text-amber-700 shrink-0" />
              <span>Admin (Dr. Ramesh)</span>
            </button>
            <button
              type="button"
              onClick={() => handleDemoClick('requester')}
              disabled={loading}
              className="flex items-center gap-1.5 p-2 rounded-xl bg-white border border-amber-300 text-amber-950 text-xs font-bold hover:bg-amber-100/60 transition shadow-2xs"
            >
              <User className="w-3.5 h-3.5 text-blue-600 shrink-0" />
              <span>Requester (Ananya)</span>
            </button>
            <button
              type="button"
              onClick={() => handleDemoClick('donor_o_neg')}
              disabled={loading}
              className="flex items-center gap-1.5 p-2 rounded-xl bg-white border border-amber-300 text-amber-950 text-xs font-bold hover:bg-amber-100/60 transition shadow-2xs"
            >
              <Heart className="w-3.5 h-3.5 text-red-600 shrink-0" />
              <span>Donor O- (Vikram)</span>
            </button>
            <button
              type="button"
              onClick={() => handleDemoClick('donor_a_pos')}
              disabled={loading}
              className="flex items-center gap-1.5 p-2 rounded-xl bg-white border border-amber-300 text-amber-950 text-xs font-bold hover:bg-amber-100/60 transition shadow-2xs"
            >
              <Heart className="w-3.5 h-3.5 text-red-600 shrink-0" />
              <span>Donor A+ (Rahul)</span>
            </button>
          </div>
        </div>

        {/* Form Container */}
        <div className="bg-white py-8 px-6 shadow-xl shadow-slate-200/50 sm:rounded-3xl sm:px-10 border border-slate-200">
          <form className="space-y-4" onSubmit={handleSubmit}>
            {error && (
              <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-slate-700">
                Email Address
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@example.com"
                className="mt-1 block w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:border-red-500 focus:ring-2 focus:ring-red-200 transition outline-hidden"
              />
            </div>

            <div>
              <div className="flex items-center justify-between">
                <label className="block text-xs font-semibold text-slate-700">
                  Password
                </label>
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

          <div className="mt-6 pt-6 border-t border-slate-100 text-center">
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
