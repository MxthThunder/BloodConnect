import React, { useEffect, useRef } from 'react';
import { FlaskConical, Loader2 } from 'lucide-react';
import { formatIndianDateTime } from '../../constants/chennaiData';

export const CASE_STATUS = {
  OPEN: { label: 'Open', cls: 'bg-slate-100 text-slate-700 border-slate-300' },
  COLLECTING_RESPONSES: { label: 'Collecting responses', cls: 'bg-blue-50 text-blue-800 border-blue-200' },
  AWAITING_ESCALATION: { label: 'Awaiting escalation approval', cls: 'bg-amber-50 text-amber-900 border-amber-300' },
  VOLUNTEERS_SECURED: { label: 'Volunteer target reached', cls: 'bg-emerald-50 text-emerald-800 border-emerald-300' },
  NEEDS_ADMIN_INTERVENTION: { label: 'Intervention required', cls: 'bg-red-50 text-red-800 border-red-300' },
  RESOLVED: { label: 'Resolved', cls: 'bg-emerald-100 text-emerald-900 border-emerald-300' },
  CANCELLED: { label: 'Cancelled', cls: 'bg-slate-200 text-slate-700 border-slate-300' },
  EXPIRED: { label: 'Expired', cls: 'bg-slate-200 text-slate-700 border-slate-300' },
};

export const CaseStatusBadge = ({ status }) => {
  const s = CASE_STATUS[status] || { label: status, cls: 'bg-slate-100 text-slate-700 border-slate-300' };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-md border text-[11px] font-semibold whitespace-nowrap ${s.cls}`}>
      {s.label}
    </span>
  );
};

const LIFECYCLE = {
  POTENTIAL: 'bg-slate-100 text-slate-700 border-slate-300',
  ALERT_SENT: 'bg-blue-50 text-blue-800 border-blue-200',
  ALERT_VIEWED: 'bg-sky-50 text-sky-800 border-sky-200',
  NO_RESPONSE: 'bg-amber-50 text-amber-900 border-amber-300',
  RESPONSE_DECLINED: 'bg-rose-50 text-rose-800 border-rose-200',
  VOLUNTEER_CONFIRMED: 'bg-emerald-50 text-emerald-800 border-emerald-300',
  HOSPITAL_VERIFICATION_PENDING: 'bg-violet-50 text-violet-800 border-violet-200',
  DONATION_CONFIRMED: 'bg-emerald-100 text-emerald-900 border-emerald-400',
  NOT_DONATED: 'bg-slate-200 text-slate-700 border-slate-300',
  WITHDRAWN: 'bg-slate-100 text-slate-500 border-slate-200',
  EXCLUDED: 'bg-slate-50 text-slate-500 border-slate-200',
};

export const LifecycleBadge = ({ status, label }) => (
  <span className={`inline-flex items-center px-2 py-0.5 rounded-md border text-[11px] font-semibold ${LIFECYCLE[status] || LIFECYCLE.POTENTIAL}`}>
    {label || status}
  </span>
);

export const UrgencyTag = ({ urgency }) => {
  const cls = urgency === 'CRITICAL' ? 'text-red-700 font-bold' : urgency === 'URGENT' ? 'text-amber-800 font-semibold' : 'text-slate-600';
  return <span className={`text-xs ${cls}`}>{urgency}</span>;
};

export const SimBadge = ({ className = '' }) => (
  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md border border-violet-300 bg-violet-50 text-violet-800 text-[11px] font-bold ${className}`}>
    <FlaskConical className="w-3 h-3" aria-hidden="true" /> SIMULATION - FICTIONAL
  </span>
);

export const RealBadge = () => (
  <span className="inline-flex items-center px-2 py-0.5 rounded-md border border-slate-300 bg-white text-slate-700 text-[11px] font-bold">
    LIVE REQUEST
  </span>
);

export const SimulationBanner = ({ children }) => (
  <div role="note" className="rounded-xl border border-violet-300 bg-violet-50 px-4 py-3 text-xs text-violet-900 flex gap-2.5">
    <FlaskConical className="w-4 h-4 shrink-0 mt-0.5" aria-hidden="true" />
    <p>
      <strong>Simulation mode - all data is fictional.</strong>{' '}
      {children || 'Donors, hospitals, responses and any figures shown here are invented for demonstration. No SMS, e-mail, push notification or donor message is ever sent, and no real donor or request record is read or changed.'}
    </p>
  </div>
);

export const Panel = ({ title, icon: Icon, actions, children, className = '', bodyClass = 'p-4' }) => (
  <section className={`bg-white border border-slate-200 rounded-xl ${className}`}>
    {(title || actions) && (
      <header className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 px-4 py-3 border-b border-slate-200">
        <h2 className="flex items-center gap-2 text-xs font-extrabold uppercase tracking-wider text-slate-800">
          {Icon && <Icon className="w-4 h-4 text-red-700" aria-hidden="true" />}
          {title}
        </h2>
        {actions}
      </header>
    )}
    <div className={bodyClass}>{children}</div>
  </section>
);

export const Metric = ({ label, value, hint, tone }) => {
  const color = tone === 'alert' ? 'text-red-700' : tone === 'good' ? 'text-emerald-700' : 'text-slate-900';
  return (
    <div className="px-4 py-3 min-w-[8.5rem]">
      <p className="text-[11px] font-semibold text-slate-500 leading-tight">{label}</p>
      <p className={`text-2xl font-black tabular-nums mt-0.5 ${color}`}>{value}</p>
      {hint && <p className="text-[10px] text-slate-500 leading-tight mt-0.5">{hint}</p>}
    </div>
  );
};

export const Button = ({ children, onClick, disabled, busy, variant = 'secondary', type = 'button', title, className = '' }) => {
  const styles = {
    primary: 'bg-red-700 text-white hover:bg-red-800 border-red-700',
    secondary: 'bg-white text-slate-800 hover:bg-slate-100 border-slate-300',
    danger: 'bg-white text-red-700 hover:bg-red-50 border-red-300',
    quiet: 'bg-transparent text-slate-700 hover:bg-slate-100 border-transparent',
  }[variant];
  return (
    <button
      type={type}
      title={title}
      onClick={onClick}
      disabled={disabled || busy}
      className={`inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-semibold transition disabled:opacity-50 disabled:cursor-not-allowed ${styles} ${className}`}
    >
      {busy && <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden="true" />}
      {children}
    </button>
  );
};

export const Alert = ({ tone = 'error', children }) => {
  const cls = tone === 'error' ? 'bg-red-50 border-red-200 text-red-800'
    : tone === 'warn' ? 'bg-amber-50 border-amber-200 text-amber-900'
    : 'bg-blue-50 border-blue-200 text-blue-900';
  return <div role={tone === 'error' ? 'alert' : 'status'} className={`rounded-lg border px-3 py-2 text-xs ${cls}`}>{children}</div>;
};

export const fmtTime = (value) => formatIndianDateTime(value);
export const fmtClock = (value) => {
  if (!value) return '-';
  try {
    return new Intl.DateTimeFormat('en-IN', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', hour12: true }).format(new Date(value));
  } catch {
    return String(value);
  }
};

export const useInterval = (callback, delay, active = true) => {
  const saved = useRef(callback);
  useEffect(() => { saved.current = callback; }, [callback]);
  useEffect(() => {
    if (!active || !delay) return undefined;
    const id = setInterval(() => saved.current(), delay);
    return () => clearInterval(id);
  }, [delay, active]);
};
