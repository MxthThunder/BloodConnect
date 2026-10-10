import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth, DEMO_CREDENTIALS } from '../context/AuthContext';
import { Users, Check, Sparkles, ChevronDown, ShieldAlert } from 'lucide-react';

const DemoSwitcher = () => {
  const { user, quickLogin, isAuthenticated, logout } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [loadingKey, setLoadingKey] = useState(null);
  const navigate = useNavigate();

  const handleSwitch = async (key) => {
    setLoadingKey(key);
    const res = await quickLogin(key);
    setLoadingKey(null);
    setIsOpen(false);
    if (res.success) {
      if (res.user.role === 'admin') {
        navigate('/admin-portal/dashboard');
      } else if (res.user.role === 'donor') {
        navigate('/donor/dashboard');
      } else {
        navigate('/requester/dashboard');
      }
    }
  };

  return (
    <div className="relative inline-block text-left">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-amber-50 text-amber-900 border border-amber-300 hover:bg-amber-100 transition shadow-2xs"
        title="Switch user role for college evaluation demonstration"
      >
        <Sparkles className="w-3.5 h-3.5 text-amber-600" />
        <span className="hidden sm:inline">Demo Switcher:</span>
        <span className="font-bold underline decoration-amber-400">
          {user ? `${user.role.toUpperCase()}` : 'Select Role'}
        </span>
        <ChevronDown className="w-3 h-3 text-amber-700" />
      </button>

      {isOpen && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setIsOpen(false)}
          />
          <div className="absolute right-0 mt-2 w-72 rounded-xl bg-white shadow-xl border border-slate-200 z-50 p-2 space-y-1">
            <div className="px-3 py-2 border-b border-slate-100">
              <p className="text-xs font-bold text-slate-900 flex items-center gap-1">
                <Users className="w-3.5 h-3.5 text-red-600" />
                Examiner Demo Accounts
              </p>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Switch role instantly to test the complete workflow:
              </p>
            </div>

            {Object.entries(DEMO_CREDENTIALS).map(([key, cred]) => {
              const isCurrent = user?.email === cred.email;
              return (
                <button
                  key={key}
                  onClick={() => handleSwitch(key)}
                  disabled={loadingKey === key}
                  className={`w-full text-left px-3 py-2 rounded-lg text-xs flex items-center justify-between transition ${
                    isCurrent
                      ? 'bg-red-50 text-red-900 font-semibold border border-red-200'
                      : 'hover:bg-slate-50 text-slate-700'
                  }`}
                >
                  <div>
                    <div className="flex items-center gap-1.5">
                      <span className="font-bold">{cred.badge}</span>
                      <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-100 text-slate-600 uppercase">
                        {cred.role}
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-500 truncate max-w-[180px]">
                      {cred.name}
                    </div>
                  </div>
                  {isCurrent && <Check className="w-4 h-4 text-red-600 shrink-0" />}
                </button>
              );
            })}

            {isAuthenticated && (
              <div className="pt-1 border-t border-slate-100">
                <button
                  onClick={() => {
                    logout();
                    setIsOpen(false);
                    navigate('/login');
                  }}
                  className="w-full text-left px-3 py-1.5 text-xs text-rose-600 hover:bg-rose-50 rounded-lg font-medium transition"
                >
                  Sign Out of Current Session
                </button>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
};

export default DemoSwitcher;
