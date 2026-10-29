import React, { useState } from 'react';
import { Outlet, Link, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Logo from '../components/Logo';
import { Menu, X, ArrowRight, Heart, ShieldAlert, PhoneCall, Building2, LogOut, LogIn, ShieldCheck } from 'lucide-react';

const PublicLayout = () => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { user, isAuthenticated, logout } = useAuth();
  const location = useLocation();

  const getDashboardPath = () => {
    if (!user) return '/login';
    if (user.role === 'admin') return '/admin-portal/dashboard';
    if (user.role === 'donor') return '/donor/dashboard';
    if (user.role === 'organiser') return '/organiser/dashboard';
    return '/requester/dashboard';
  };

  const navLinks = [
    { label: 'Home', path: '/' },
    { label: 'How It Works', path: '/how-it-works' },
    { label: 'Blood Awareness', path: '/awareness' },
    { label: 'Donation Camps', path: '/camps' },
    { label: 'About BloodConnect', path: '/about' },
    { label: 'Contact & Help', path: '/contact' },
  ];

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-800 antialiased">
      {/* Top emergency notice banner */}
      <div className="bg-gradient-to-r from-red-700 via-red-600 to-rose-700 text-white text-xs py-2 px-4 shadow-xs">
        <div className="max-w-[1650px] mx-auto flex flex-col sm:flex-row items-center justify-between gap-1 text-center sm:text-left">
          <div className="flex items-center gap-2 font-medium">
            <span className="w-2 h-2 rounded-full bg-white animate-ping" />
            <span>Emergency Blood Coordination Network — Chennai, Tamil Nadu</span>
          </div>
          <div className="flex items-center gap-4 text-[11px] opacity-95">
            <span>24/7 Helpline: 9884245552</span>
            <span className="hidden md:inline">| Serving 15+ Major Hospitals Across Chennai</span>
          </div>
        </div>
      </div>

      {/* Main navigation header */}
      <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-slate-200/80 shadow-xs">
        <div className="max-w-[1650px] mx-auto px-4 sm:px-6 lg:px-8 h-18 flex items-center justify-between">
          <Logo size="md" />

          {/* Desktop navigation links */}
          <nav className="hidden lg:flex items-center gap-1">
            {navLinks.map((link) => {
              const active = location.pathname === link.path;
              return (
                <Link
                  key={link.path}
                  to={link.path}
                  className={`px-3.5 py-2 rounded-lg text-sm font-medium transition ${
                    active
                      ? 'text-red-600 bg-red-50/60 font-semibold'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                  }`}
                >
                  {link.label}
                </Link>
              );
            })}
          </nav>

          {/* Right actions */}
          <div className="flex items-center gap-1.5 sm:gap-3 shrink-0">
            {isAuthenticated ? (
              <div className="flex items-center gap-2">
                <Link
                  to={getDashboardPath()}
                  className="inline-flex items-center gap-1.5 px-2.5 sm:px-3.5 py-2 rounded-xl bg-slate-900 text-white text-xs sm:text-sm font-semibold hover:bg-slate-800 transition shadow-sm"
                >
                  <span>Dashboard<span className="hidden sm:inline"> ({user?.role})</span></span>
                  <ArrowRight className="w-3.5 h-3.5 text-red-400" />
                </Link>
                <button
                  type="button"
                  onClick={() => logout()}
                  className="inline-flex items-center gap-1 px-3 py-2 rounded-xl border border-slate-200 text-xs sm:text-sm font-semibold text-slate-700 hover:text-rose-600 hover:bg-rose-50 transition cursor-pointer"
                  title="Sign out of current account"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span className="hidden md:inline">Sign Out</span>
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <Link
                  to="/login"
                  className="inline-flex items-center gap-1.5 px-2.5 sm:px-3.5 py-2 rounded-xl text-xs sm:text-sm font-bold text-slate-700 hover:text-red-600 hover:bg-red-50/50 transition border border-slate-200 sm:border-transparent"
                >
                  <LogIn className="w-3.5 h-3.5 text-red-600" />
                  <span>Sign In</span>
                </Link>
                <Link
                  to="/register"
                  className="inline-flex items-center gap-1.5 px-2.5 sm:px-3.5 py-2 rounded-xl bg-red-600 text-white text-xs sm:text-sm font-semibold hover:bg-red-700 transition shadow-sm shadow-red-600/20"
                >
                  <Heart className="w-3.5 h-3.5 fill-white" />
                  <span><span className="sm:hidden">Join</span><span className="hidden sm:inline">Join Network</span></span>
                </Link>
              </div>
            )}

            {/* Mobile menu button */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="lg:hidden p-1.5 sm:p-2 rounded-lg text-slate-600 hover:bg-slate-100"
              aria-label={mobileMenuOpen ? 'Close menu' : 'Open menu'}
            >
              {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>

        {/* Mobile Navigation Drawer */}
        {mobileMenuOpen && (
          <div className="lg:hidden border-t border-slate-200 bg-white px-4 pt-3 pb-6 space-y-3">
            <div className="space-y-1">
              {navLinks.map((link) => (
                <Link
                  key={link.path}
                  to={link.path}
                  onClick={() => setMobileMenuOpen(false)}
                  className="block px-3 py-2 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50"
                >
                  {link.label}
                </Link>
              ))}
            </div>
            <div className="pt-2 border-t border-slate-100 flex flex-col gap-2">
              {isAuthenticated ? (
                <>
                  <Link
                    to={getDashboardPath()}
                    onClick={() => setMobileMenuOpen(false)}
                    className="w-full text-center py-2.5 rounded-xl bg-slate-900 text-white font-semibold text-sm"
                  >
                    Enter Portal ({user?.role})
                  </Link>
                  <button
                    type="button"
                    onClick={() => {
                      logout();
                      setMobileMenuOpen(false);
                    }}
                    className="w-full text-center py-2 rounded-xl border border-slate-200 text-rose-600 font-semibold text-sm hover:bg-rose-50"
                  >
                    Sign Out
                  </button>
                </>
              ) : (
                <>
                  <Link
                    to="/login"
                    onClick={() => setMobileMenuOpen(false)}
                    className="w-full text-center py-2 rounded-xl border border-slate-200 text-slate-700 font-semibold text-sm"
                  >
                    Sign In to Portal
                  </Link>
                  <Link
                    to="/register"
                    onClick={() => setMobileMenuOpen(false)}
                    className="w-full text-center py-2 rounded-xl bg-red-600 text-white font-semibold text-sm"
                  >
                    Register as Donor or Requester
                  </Link>
                </>
              )}
            </div>
          </div>
        )}
      </header>

      {/* Content */}
      <main className="flex-1">
        <Outlet />
      </main>

      {/* Footer */}
      <footer className="bg-slate-900 text-slate-300 pt-14 pb-8 border-t border-slate-800">
        <div className="max-w-[1650px] mx-auto px-4 sm:px-6 lg:px-8 space-y-10">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            <div className="md:col-span-2 space-y-4">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-red-600 flex items-center justify-center text-white font-black">
                  BC
                </div>
                <span className="text-xl font-extrabold text-white">
                  Blood<span className="text-red-500">Connect</span>
                </span>
              </div>
              <p className="text-sm text-slate-400 max-w-md leading-relaxed">
                Emergency Blood Donor Matching and Real-Time Availability Network (Chennai, Tamil Nadu). A centralized digital health infrastructure connecting voluntary donors, hospitals, and patients during critical medical emergencies.
              </p>
              <div className="text-xs text-slate-400 space-y-1">
                <p><strong>Regional Network:</strong> Greater Chennai Corporation (15 Zones)</p>
                <p><strong>Primary Hub:</strong> Chennai, Tamil Nadu, India</p>
                <p><strong>Clinical Standards:</strong> Verified ABO/Rh Compatibility Protocols</p>
              </div>
            </div>

            <div>
              <h4 className="text-sm font-semibold text-white uppercase tracking-wider mb-4">
                Platform Navigation
              </h4>
              <ul className="space-y-2 text-sm text-slate-400">
                <li><Link to="/" className="hover:text-white transition">Home Overview</Link></li>
                <li><Link to="/how-it-works" className="hover:text-white transition">Matching Flow</Link></li>
                <li><Link to="/awareness" className="hover:text-white transition">Donor Compatibility</Link></li>
                <li><Link to="/about" className="hover:text-white transition">About BloodConnect</Link></li>
                <li><Link to="/contact" className="hover:text-white transition">Hospital Directory</Link></li>
              </ul>
            </div>

            <div>
              <h4 className="text-sm font-semibold text-white uppercase tracking-wider mb-4">
                Emergency Coordination
              </h4>
              <ul className="space-y-2.5 text-xs text-slate-400">
                <li className="flex items-center gap-2 text-slate-300">
                  <PhoneCall className="w-4 h-4 text-red-400 shrink-0" />
                  <span>24/7 Helpline: 9884245552</span>
                </li>
                <li className="flex items-center gap-2 text-slate-300">
                  <Building2 className="w-4 h-4 text-red-400 shrink-0" />
                  <span>Rajiv Gandhi General: +91 44 2530 5000</span>
                </li>
                <li className="flex items-center gap-2 text-slate-300">
                  <Building2 className="w-4 h-4 text-red-400 shrink-0" />
                  <span>Apollo Greams Road: +91 44 2829 0200</span>
                </li>
              </ul>
              <div className="mt-4 p-3 rounded-xl bg-slate-800/90 border border-slate-700/80 text-[11px] text-slate-300 flex items-start gap-2">
                <ShieldCheck className="w-4 h-4 shrink-0 text-emerald-400 mt-0.5" />
                <span>All patient records and blood donation requests undergo clinical verification prior to dispatch.</span>
              </div>
            </div>
          </div>

          <div className="pt-8 border-t border-slate-800/80 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-500">
            <p>&copy; {new Date().getFullYear()} BloodConnect Emergency Donor Network. All rights reserved.</p>
            <div className="flex items-center gap-4">
              <span>ABO/Rh Blood Protocol</span>
              <span>OpenStreetMap Geospatial</span>
              <span>256-Bit SSL Secured</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default PublicLayout;
