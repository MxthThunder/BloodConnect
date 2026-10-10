import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth, DEMO_CREDENTIALS } from '../context/AuthContext';
import { Users, Check, Sparkles, ChevronDown, ShieldCheck, Heart, User, LogOut } from 'lucide-react';

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

  const adminKeys = [
    'admin_freddy',
    'admin_joshua',
    'admin_boopathi',
    'admin_balakumaran',
    'admin_abilash',
    'admin_harisankaran'
  ];

  const otherKeys = ['requester', 'donor_o_neg', 'donor_a_pos'];

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
          <div className="absolute right-0 mt-2 w-80 max-h-[85vh] overflow-y-auto rounded-2xl bg-white shadow-2xl border border-slate-200 z-50 p-2 space-y-2">
            <div className="px-3 py-2 border-b border-slate-100 bg-slate-50/50 rounded-xl">
              <p className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5 text-red-600" />
                Examiner & Team Demo Switcher
              </p>
              <p className="text-[11px] text-slate-500 mt-0.5">
                1-click switch between the 6 team administrators, requesters, and donors:
              </p>
            </div>

            {/* Team Administrators Section */}
            <div>
              <p className="px-2 py-1 text-[10px] font-bold text-red-700 uppercase tracking-wider flex items-center gap-1">
                <ShieldCheck className="w-3 h-3" />
                Team Administrators (All 6 Accounts)
              </p>
              <div className="space-y-1 mt-1">
                {adminKeys.map((key) => {
                  const cred = DEMO_CREDENTIALS[key];
                  if (!cred) return null;
                  const isCurrent = user?.email === cred.email;
                  return (
                    <button
                      key={key}
                      onClick={() => handleSwitch(key)}
                      disabled={loadingKey === key}
                      className={`w-full text-left px-2.5 py-1.5 rounded-lg text-xs flex items-center justify-between transition ${
                        isCurrent
                          ? 'bg-red-50 text-red-900 font-semibold border border-red-200'
                          : 'hover:bg-slate-50 text-slate-700'
                      }`}
                    >
                      <div className="min-w-0 pr-2">
                        <div className="font-bold text-slate-900 truncate">
                          {cred.name}
                        </div>
                        <div className="text-[11px] text-slate-500 truncate">
                          {cred.username} &bull; {cred.email}
                        </div>
                      </div>
                      {isCurrent ? (
                        <Check className="w-4 h-4 text-red-600 shrink-0" />
                      ) : (
                        <span className="text-[9px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 font-semibold uppercase">
                          Admin
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Other Demo Profiles Section */}
            <div className="pt-2 border-t border-slate-100">
              <p className="px-2 py-1 text-[10px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1">
                <Heart className="w-3 h-3 text-rose-500" />
                Requester & Donors (Chennai)
              </p>
              <div className="space-y-1 mt-1">
                {otherKeys.map((key) => {
                  const cred = DEMO_CREDENTIALS[key];
                  if (!cred) return null;
                  const isCurrent = user?.email === cred.email;
                  return (
                    <button
                      key={key}
                      onClick={() => handleSwitch(key)}
                      disabled={loadingKey === key}
                      className={`w-full text-left px-2.5 py-1.5 rounded-lg text-xs flex items-center justify-between transition ${
                        isCurrent
                          ? 'bg-red-50 text-red-900 font-semibold border border-red-200'
                          : 'hover:bg-slate-50 text-slate-700'
                      }`}
                    >
                      <div className="min-w-0 pr-2">
                        <div className="font-bold text-slate-900 truncate">
                          {cred.badge}
                        </div>
                        <div className="text-[11px] text-slate-500 truncate">
                          {cred.name}
                        </div>
                      </div>
                      {isCurrent ? (
                        <Check className="w-4 h-4 text-red-600 shrink-0" />
                      ) : (
                        <span className="text-[9px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 font-semibold uppercase">
                          {cred.role}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {isAuthenticated && (
              <div className="pt-2 border-t border-slate-100">
                <button
                  onClick={() => {
                    logout();
                    setIsOpen(false);
                    navigate('/login');
                  }}
                  className="w-full flex items-center gap-1.5 px-3 py-1.5 text-xs text-rose-600 hover:bg-rose-50 rounded-lg font-medium transition"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>Sign Out of Current Session</span>
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
