import React, { useState } from 'react';
import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Logo from '../components/Logo';
import DemoSwitcher from '../components/DemoSwitcher';
import NotificationDropdown from '../components/NotificationDropdown';
import {
  LayoutDashboard,
  PlusCircle,
  FileText,
  User,
  Heart,
  Bell,
  History,
  ShieldCheck,
  Building2,
  Users,
  AlertTriangle,
  ScrollText,
  Network,
  LogOut,
  Menu,
  X,
  ChevronRight,
  Activity
} from 'lucide-react';

const DashboardLayout = () => {
  const { user, role, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  // Build role-specific sidebar navigation links
  const getNavSections = () => {
    if (role === 'admin') {
      return [
        {
          title: 'Emergency Operations',
          items: [
            { label: 'Admin Overview', path: '/admin-portal/dashboard', icon: LayoutDashboard },
            { label: 'Verification Queue', path: '/admin-portal/verification-queue', icon: ShieldCheck, badge: 'Urgent' },
            { label: 'All Requests', path: '/admin-portal/requests', icon: FileText },
            { label: 'Matching Engine', path: '/admin-portal/matching', icon: Network },
          ]
        },
        {
          title: 'Inventory & Network',
          items: [
            { label: 'Blood Bank Stock', path: '/admin-portal/stock', icon: Building2 },
            { label: 'Low-Stock Alerts', path: '/admin-portal/low-stock', icon: AlertTriangle, badgeColor: 'red' },
            { label: 'Donor Registry', path: '/admin-portal/donors', icon: Heart },
            { label: 'User Management', path: '/admin-portal/users', icon: Users },
          ]
        },
        {
          title: 'Governance',
          items: [
            { label: 'Platform Alerts', path: '/admin-portal/notifications', icon: Bell },
            { label: 'Audit Log & Reports', path: '/admin-portal/audit-logs', icon: ScrollText },
          ]
        }
      ];
    }

    if (role === 'donor') {
      return [
        {
          title: 'Donor Portal',
          items: [
            { label: 'Donor Dashboard', path: '/donor/dashboard', icon: LayoutDashboard },
            { label: 'Emergency Alerts', path: '/donor/notifications', icon: Bell },
            { label: 'Relevant Requests', path: '/donor/requests', icon: Activity },
            { label: 'Donation History', path: '/donor/history', icon: History },
            { label: 'Profile & Availability', path: '/donor/profile', icon: User },
          ]
        }
      ];
    }

    // Requester
    return [
      {
        title: 'Requester Portal',
        items: [
          { label: 'Requester Dashboard', path: '/requester/dashboard', icon: LayoutDashboard },
          { label: 'Create Blood Request', path: '/requester/create-request', icon: PlusCircle, highlight: true },
          { label: 'My Blood Requests', path: '/requester/my-requests', icon: FileText },
          { label: 'In-App Notifications', path: '/requester/notifications', icon: Bell },
          { label: 'Account Profile', path: '/requester/profile', icon: User },
        ]
      }
    ];
  };

  const navSections = getNavSections();

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col md:flex-row antialiased text-slate-800">
      {/* Sidebar for Desktop */}
      <aside className="hidden md:flex flex-col w-64 bg-slate-900 text-slate-300 border-r border-slate-800 shrink-0">
        <div className="p-5 border-b border-slate-800/80 flex items-center justify-between">
          <Logo size="sm" to="/" className="text-white" />
        </div>

        {/* User Card */}
        <div className="p-4 mx-3 my-3 rounded-xl bg-slate-800/60 border border-slate-700/50 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-red-600 flex items-center justify-center font-bold text-white text-sm shrink-0 shadow-xs">
            {user?.first_name?.[0] || user?.email?.[0]?.toUpperCase() || 'U'}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-bold text-white truncate">
              {user?.get_full_name || user?.first_name || user?.email?.split('@')[0]}
            </p>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span className={`inline-block w-2 h-2 rounded-full ${role === 'admin' ? 'bg-amber-400' : role === 'donor' ? 'bg-emerald-400' : 'bg-blue-400'}`} />
              <span className="text-[11px] text-slate-400 font-semibold uppercase tracking-wider">
                {role}
              </span>
            </div>
          </div>
        </div>

        {/* Navigation Sections */}
        <div className="flex-1 overflow-y-auto px-3 py-2 space-y-6">
          {navSections.map((sec, idx) => (
            <div key={idx} className="space-y-1">
              <p className="px-3 text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">
                {sec.title}
              </p>
              {sec.items.map((item) => {
                const active = location.pathname === item.path;
                const Icon = item.icon;
                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    className={`flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-medium transition ${
                      active
                        ? 'bg-red-600 text-white font-semibold shadow-sm shadow-red-600/30'
                        : item.highlight
                        ? 'text-red-400 hover:text-white hover:bg-slate-800/80 font-semibold'
                        : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <Icon className={`w-4 h-4 ${active ? 'text-white' : item.highlight ? 'text-red-400' : 'text-slate-400'}`} />
                      <span>{item.label}</span>
                    </div>
                    {item.badge && (
                      <span className="px-1.5 py-0.5 text-[9px] font-bold rounded-md bg-amber-500/20 text-amber-300 border border-amber-500/30">
                        {item.badge}
                      </span>
                    )}
                  </Link>
                );
              })}
            </div>
          ))}
        </div>

        {/* Footer logout */}
        <div className="p-3 border-t border-slate-800/80 space-y-1">
          <Link
            to="/"
            className="flex items-center gap-2 px-3 py-2 text-xs text-slate-400 hover:text-slate-200 rounded-lg hover:bg-slate-800/50 transition"
          >
            <span>Public Site Overview</span>
            <ChevronRight className="w-3.5 h-3.5 ml-auto" />
          </Link>
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-2 px-3 py-2 text-xs text-rose-400 hover:text-rose-300 rounded-lg hover:bg-rose-950/30 transition font-medium"
          >
            <LogOut className="w-4 h-4" />
            <span>Sign Out</span>
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top bar */}
        <header className="sticky top-0 z-20 h-16 bg-white border-b border-slate-200 px-4 sm:px-6 flex items-center justify-between shadow-2xs">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setMobileSidebarOpen(true)}
              className="md:hidden p-2 rounded-lg text-slate-600 hover:bg-slate-100"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div className="hidden sm:block">
              <span className="text-xs text-slate-600 font-semibold uppercase tracking-wider">
                Portal &bull; {role?.toUpperCase()}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Demo Switcher for Examiners */}
            <DemoSwitcher />

            {/* Notifications */}
            <NotificationDropdown />

            {/* User Profile Avatar */}
            <div className="flex items-center gap-2 pl-2 border-l border-slate-200">
              <div className="w-8 h-8 rounded-lg bg-red-100 text-red-700 font-extrabold flex items-center justify-center text-xs">
                {user?.first_name?.[0] || 'U'}
              </div>
              <div className="hidden lg:block text-left">
                <p className="text-xs font-bold text-slate-800 leading-none">
                  {user?.first_name || user?.email?.split('@')[0]}
                </p>
                <p className="text-[10px] text-slate-400 mt-0.5 leading-none">
                  {user?.city || 'Bengaluru'}
                </p>
              </div>
            </div>
          </div>
        </header>

        {/* Page body */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto w-full space-y-6">
          <Outlet />
        </main>
      </div>

      {/* Mobile Sidebar Modal */}
      {mobileSidebarOpen && (
        <div className="fixed inset-0 z-50 flex md:hidden">
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs" onClick={() => setMobileSidebarOpen(false)} />
          <div className="relative w-72 bg-slate-900 text-slate-300 flex flex-col p-4 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <Logo size="sm" to="/" className="text-white" />
              <button onClick={() => setMobileSidebarOpen(false)} className="p-1 text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-4">
              {navSections.map((sec, idx) => (
                <div key={idx} className="space-y-1">
                  <p className="px-2 text-[10px] font-bold text-slate-500 uppercase">{sec.title}</p>
                  {sec.items.map((item) => (
                    <Link
                      key={item.path}
                      to={item.path}
                      onClick={() => setMobileSidebarOpen(false)}
                      className="flex items-center gap-2 px-3 py-2 text-xs rounded-lg text-slate-300 hover:bg-slate-800"
                    >
                      <item.icon className="w-4 h-4 text-slate-400" />
                      <span>{item.label}</span>
                    </Link>
                  ))}
                </div>
              ))}
            </div>

            <div className="pt-3 border-t border-slate-800">
              <button onClick={handleLogout} className="flex items-center gap-2 text-xs text-rose-400 w-full px-2 py-2">
                <LogOut className="w-4 h-4" />
                <span>Sign Out</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DashboardLayout;
