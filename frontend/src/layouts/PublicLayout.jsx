import React, { useState } from 'react';
import { Outlet, Link, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Logo from '../components/Logo';
import DemoSwitcher from '../components/DemoSwitcher';
import { Menu, X, ArrowRight, Heart, ShieldAlert, PhoneCall, Building2 } from 'lucide-react';

const PublicLayout = () => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { user, isAuthenticated } = useAuth();
  const location = useLocation();

  const getDashboardPath = () => {
    if (!user) return '/login';
    if (user.role === 'admin') return '/admin-portal/dashboard';
    if (user.role === 'donor') return '/donor/dashboard';
    return '/requester/dashboard';
  };

  const navLinks = [
    { label: 'Home', path: '/' },
    { label: 'How It Works', path: '/how-it-works' },
    { label: 'Blood Awareness', path: '/awareness' },
    { label: 'About Project', path: '/about' },
    { label: 'Contact & Help', path: '/contact' },
  ];

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-800 antialiased">
      {/* Top emergency notice banner */}
      <div className="bg-gradient-to-r from-red-700 via-red-600 to-rose-700 text-white text-xs py-2 px-4">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-1 text-center sm:text-left">
          <div className="flex items-center gap-2 font-medium">
            <span className="w-2 h-2 rounded-full bg-white animate-ping" />
            <span>Emergency Blood Coordination Network — Bengaluru Academic Prototype</span>
          </div>
          <div className="flex items-center gap-4 text-[11px] opacity-90">
            <span>24/7 Helpline: 108 / +91 80 2670 1150</span>
            <span className="hidden md:inline">| College Design Thinking Project</span>
          </div>
        </div>
      </div>

      {/* Main navigation header */}
      <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-slate-200/80 shadow-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-18 flex items-center justify-between">
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
          <div className="flex items-center gap-3">
            {/* Quick Demo Switcher */}
            <DemoSwitcher />

            {isAuthenticated ? (
              <Link
                to={getDashboardPath()}
                className="hidden sm:inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-900 text-white text-sm font-semibold hover:bg-slate-800 transition shadow-sm"
              >
                <span>Dashboard ({user.role})</span>
                <ArrowRight className="w-4 h-4 text-red-400" />
              </Link>
            ) : (
              <div className="hidden sm:flex items-center gap-2">
                <Link
                  to="/login"
                  className="px-3.5 py-2 rounded-xl text-sm font-semibold text-slate-700 hover:text-slate-900 hover:bg-slate-100 transition"
                >
                  Sign In
                </Link>
                <Link
                  to="/register"
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-red-600 text-white text-sm font-semibold hover:bg-red-700 transition shadow-sm shadow-red-600/20"
                >
                  <Heart className="w-4 h-4 fill-white" />
                  <span>Join Network</span>
                </Link>
              </div>
            )}

            {/* Mobile menu button */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="lg:hidden p-2 rounded-lg text-slate-600 hover:bg-slate-100"
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
                <Link
                  to={getDashboardPath()}
                  onClick={() => setMobileMenuOpen(false)}
                  className="w-full text-center py-2.5 rounded-xl bg-slate-900 text-white font-semibold text-sm"
                >
                  Enter Portal ({user.role})
                </Link>
              ) : (
                <>
                  <Link
                    to="/login"
                    onClick={() => setMobileMenuOpen(false)}
                    className="w-full text-center py-2 rounded-xl border border-slate-200 text-slate-700 font-semibold text-sm"
                  >
                    Sign In
                  </Link>
                  <Link
                    to="/register"
                    onClick={() => setMobileMenuOpen(false)}
                    className="w-full text-center py-2 rounded-xl bg-red-600 text-white font-semibold text-sm"
                  >
                    Register
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
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-10">
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
                Emergency Blood Donor Matching and Monitoring System. A centralized digital platform developed as a Design Thinking engineering project to alleviate critical blood shortages through verified alerts and donor coordination.
              </p>
              <div className="text-xs text-slate-500 space-y-1">
                <p><strong>Design Thinking Team:</strong> CS Engineering Students (Batch 2026)</p>
                <p><strong>Evaluation Scope:</strong> Academic prototype with synthetic verified records.</p>
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
                <li><Link to="/about" className="hover:text-white transition">Design Thinking Research</Link></li>
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
                  <span>Karnataka Blood Helpline: 104 / 108</span>
                </li>
                <li className="flex items-center gap-2 text-slate-300">
                  <Building2 className="w-4 h-4 text-red-400 shrink-0" />
                  <span>Victoria Hospital: +91 80 2670 1150</span>
                </li>
                <li className="flex items-center gap-2 text-slate-300">
                  <Building2 className="w-4 h-4 text-red-400 shrink-0" />
                  <span>Manipal Central Bank: +91 80 2502 4444</span>
                </li>
              </ul>
              <div className="mt-4 p-3 rounded-lg bg-slate-800/80 border border-slate-700/60 text-[11px] text-amber-300 flex items-start gap-2">
                <ShieldAlert className="w-4 h-4 shrink-0 text-amber-400 mt-0.5" />
                <span>All sample records in this prototype are demonstration data for faculty assessment.</span>
              </div>
            </div>
          </div>

          <div className="pt-8 border-t border-slate-800/80 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-500">
            <p>&copy; {new Date().getFullYear()} BloodConnect Project Team. Built for Design Thinking Evaluation.</p>
            <div className="flex items-center gap-4">
              <span>ABO/Rh Blood Matching Protocol</span>
              <span>OpenStreetMap Integration</span>
              <span>Django REST + React</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default PublicLayout;
