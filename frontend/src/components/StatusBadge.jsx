import React from 'react';
import { 
  CheckCircle2, 
  Clock, 
  AlertTriangle, 
  XCircle, 
  Radio, 
  HeartHandshake, 
  UserCheck, 
  ShieldCheck,
  Send
} from 'lucide-react';

const StatusBadge = ({ type, value, size = 'sm' }) => {
  if (!value) return null;

  const sizeClasses = {
    xs: 'px-2 py-0.5 text-[11px] gap-1',
    sm: 'px-2.5 py-1 text-xs gap-1.5',
    md: 'px-3 py-1.5 text-sm gap-2',
  };

  let config = {
    label: value,
    bg: 'bg-slate-100 text-slate-700 border-slate-200',
    icon: null,
  };

  switch (type) {
    case 'urgency':
      if (value === 'CRITICAL') {
        config = {
          label: 'Critical (<2h)',
          bg: 'bg-red-50 text-red-700 border-red-300 font-bold animate-pulse',
          icon: <AlertTriangle className="w-3.5 h-3.5 text-red-600" />,
        };
      } else if (value === 'URGENT') {
        config = {
          label: 'Urgent (<6h)',
          bg: 'bg-amber-50 text-amber-800 border-amber-300 font-semibold',
          icon: <Clock className="w-3.5 h-3.5 text-amber-600" />,
        };
      } else {
        config = {
          label: 'Standard (<24h)',
          bg: 'bg-blue-50 text-blue-700 border-blue-200 font-medium',
          icon: <Clock className="w-3.5 h-3.5 text-blue-500" />,
        };
      }
      break;

    case 'verification':
      if (value === 'APPROVED') {
        config = {
          label: 'Verified by Admin',
          bg: 'bg-emerald-50 text-emerald-700 border-emerald-300 font-semibold',
          icon: <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />,
        };
      } else if (value === 'REJECTED') {
        config = {
          label: 'Rejected',
          bg: 'bg-rose-50 text-rose-700 border-rose-200',
          icon: <XCircle className="w-3.5 h-3.5 text-rose-600" />,
        };
      } else {
        config = {
          label: 'Pending Verification',
          bg: 'bg-amber-50 text-amber-800 border-amber-300',
          icon: <Clock className="w-3.5 h-3.5 text-amber-600" />,
        };
      }
      break;

    case 'request_status':
      if (value === 'FULFILLED') {
        config = {
          label: 'Fulfilled',
          bg: 'bg-emerald-50 text-emerald-800 border-emerald-300 font-semibold',
          icon: <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />,
        };
      } else if (value === 'DONOR_RESPONDED') {
        config = {
          label: 'Donor Accepted',
          bg: 'bg-indigo-50 text-indigo-700 border-indigo-200 font-semibold',
          icon: <HeartHandshake className="w-3.5 h-3.5 text-indigo-600" />,
        };
      } else if (value === 'ACTIVE_ALERTS_SENT') {
        config = {
          label: 'Alerts Dispatched',
          bg: 'bg-blue-50 text-blue-700 border-blue-300',
          icon: <Send className="w-3.5 h-3.5 text-blue-600" />,
        };
      } else if (value === 'CANCELLED' || value === 'CLOSED') {
        config = {
          label: value,
          bg: 'bg-slate-100 text-slate-600 border-slate-300',
          icon: <XCircle className="w-3.5 h-3.5 text-slate-500" />,
        };
      } else {
        config = {
          label: 'Pending Verification',
          bg: 'bg-amber-50 text-amber-800 border-amber-300',
          icon: <Clock className="w-3.5 h-3.5 text-amber-600" />,
        };
      }
      break;

    case 'alert_response':
      if (value === 'ACCEPTED') {
        config = {
          label: 'Accepted',
          bg: 'bg-emerald-50 text-emerald-700 border-emerald-300 font-semibold',
          icon: <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />,
        };
      } else if (value === 'DECLINED') {
        config = {
          label: 'Declined',
          bg: 'bg-slate-100 text-slate-600 border-slate-200',
          icon: <XCircle className="w-3.5 h-3.5 text-slate-500" />,
        };
      } else if (value === 'VIEWED') {
        config = {
          label: 'Viewed',
          bg: 'bg-sky-50 text-sky-700 border-sky-200',
          icon: <Clock className="w-3.5 h-3.5 text-sky-600" />,
        };
      } else {
        config = {
          label: 'Alert Dispatched',
          bg: 'bg-amber-50 text-amber-700 border-amber-200',
          icon: <Radio className="w-3.5 h-3.5 text-amber-600 animate-pulse" />,
        };
      }
      break;

    case 'availability':
      if (value === true || value === 'true' || value === 'Available') {
        config = {
          label: 'Available for Donation',
          bg: 'bg-emerald-50 text-emerald-700 border-emerald-200 font-medium',
          icon: <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping mr-0.5 inline-block" />,
        };
      } else {
        config = {
          label: 'Temporarily Unavailable',
          bg: 'bg-slate-100 text-slate-600 border-slate-200',
          icon: <span className="w-2 h-2 rounded-full bg-slate-400 mr-0.5 inline-block" />,
        };
      }
      break;

    default:
      config = {
        label: String(value),
        bg: 'bg-slate-100 text-slate-700 border-slate-200',
        icon: null,
      };
  }

  return (
    <span className={`inline-flex items-center rounded-full border shadow-2xs font-medium whitespace-nowrap ${sizeClasses[size]} ${config.bg}`}>
      {config.icon}
      <span>{config.label}</span>
    </span>
  );
};

export default StatusBadge;
