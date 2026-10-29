import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { CalendarDays, Check, Clock, MapPin, ShieldCheck, Stethoscope, X } from 'lucide-react';
import { CHENNAI_MAP_CENTER } from '../../constants/chennaiData';

export const fmtDate = (iso) => {
  if (!iso) return '-';
  const d = new Date(`${iso.slice(0, 10)}T00:00:00`);
  return d.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
};

export const fmtTimeOfDay = (hhmm) => {
  if (!hhmm) return '';
  const [h, m] = hhmm.split(':').map(Number);
  const suffix = h >= 12 ? 'PM' : 'AM';
  return `${((h + 11) % 12) + 1}:${String(m).padStart(2, '0')} ${suffix}`;
};

export const fmtDateTime = (iso) => {
  if (!iso) return '-';
  try {
    return new Intl.DateTimeFormat('en-IN', {
      timeZone: 'Asia/Kolkata', day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true,
    }).format(new Date(iso));
  } catch {
    return String(iso);
  }
};

const STATUS_STYLES = {
  SUBMITTED: 'bg-slate-100 text-slate-700 border-slate-300',
  UNDER_REVIEW: 'bg-blue-50 text-blue-800 border-blue-200',
  PARTNER_COORDINATION: 'bg-violet-50 text-violet-800 border-violet-200',
  APPROVED: 'bg-emerald-50 text-emerald-800 border-emerald-300',
  COMPLETED: 'bg-emerald-100 text-emerald-900 border-emerald-400',
  REJECTED: 'bg-rose-50 text-rose-800 border-rose-200',
  CANCELLED: 'bg-slate-200 text-slate-700 border-slate-300',
};

export const CampStatusBadge = ({ status, label }) => (
  <span className={`inline-flex items-center px-2 py-0.5 rounded-md border text-[11px] font-semibold whitespace-nowrap ${STATUS_STYLES[status] || STATUS_STYLES.SUBMITTED}`}>
    {label || status}
  </span>
);

export const PARTNER_STYLES = {
  NOT_CONTACTED: 'bg-slate-100 text-slate-700 border-slate-300',
  CONTACTED: 'bg-amber-50 text-amber-900 border-amber-300',
  CONFIRMED: 'bg-emerald-50 text-emerald-800 border-emerald-300',
  DECLINED: 'bg-rose-50 text-rose-800 border-rose-200',
};

export const PartnerBadge = ({ status, label }) => (
  <span className={`inline-flex items-center px-2 py-0.5 rounded-md border text-[11px] font-semibold ${PARTNER_STYLES[status] || PARTNER_STYLES.NOT_CONTACTED}`}>
    {label || status}
  </span>
);

/** Horizontal tracker: Submitted > Under review > Partner coordination > Approved > Completed. */
export const ProgressTracker = ({ stages = [] }) => (
  <ol className="flex items-start w-full" aria-label="Application progress">
    {stages.map((s, i) => {
      const done = s.state === 'done';
      const current = s.state === 'current';
      const stopped = s.state === 'stopped';
      return (
        <li key={s.status} className="flex-1 min-w-0 relative">
          {i > 0 && (
            <span aria-hidden="true" className={`absolute top-3.5 -left-1/2 w-full h-0.5 ${done || current || stopped ? 'bg-emerald-500' : 'bg-slate-200'}`} />
          )}
          <div className="relative flex flex-col items-center text-center px-1">
            <span
              className={`w-7 h-7 rounded-full border-2 flex items-center justify-center text-[11px] font-bold bg-white ${
                done ? 'border-emerald-500 bg-emerald-500 text-white'
                  : current ? 'border-red-700 text-red-700 ring-4 ring-red-100'
                  : stopped ? 'border-rose-500 text-rose-600 bg-rose-50'
                  : 'border-slate-300 text-slate-400'
              }`}
            >
              {done ? <Check className="w-3.5 h-3.5" aria-hidden="true" /> : stopped ? <X className="w-3.5 h-3.5" aria-hidden="true" /> : i + 1}
            </span>
            <span className={`mt-1.5 text-[10px] sm:text-[11px] leading-tight font-semibold ${current ? 'text-red-700' : stopped ? 'text-rose-700' : done ? 'text-slate-700' : 'text-slate-400'}`}>
              {s.label}
            </span>
            <span className="sr-only">{done ? 'completed' : current ? 'current stage' : stopped ? 'stopped here' : 'not reached'}</span>
          </div>
        </li>
      );
    })}
  </ol>
);

export const CoordinationNotice = ({ children }) => (
  <div role="note" className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-950 flex gap-2.5">
    <Stethoscope className="w-4 h-4 shrink-0 mt-0.5 text-amber-700" aria-hidden="true" />
    <p>{children}</p>
  </div>
);

export const FacilityChips = ({ facilities = [], limit }) => {
  const shown = limit ? facilities.slice(0, limit) : facilities;
  const rest = facilities.length - shown.length;
  return (
    <div className="flex flex-wrap gap-1.5">
      {shown.map((f) => (
        <span key={f.code} className="px-2 py-0.5 rounded-md bg-slate-100 border border-slate-200 text-[11px] text-slate-700">{f.label}</span>
      ))}
      {rest > 0 && <span className="px-2 py-0.5 rounded-md text-[11px] text-slate-500">+{rest} more</span>}
    </div>
  );
};

export const MedicalSupportLine = ({ support }) => {
  if (!support?.confirmed) return null;
  return (
    <p className="flex items-start gap-1.5 text-xs text-emerald-800">
      <ShieldCheck className="w-3.5 h-3.5 mt-0.5 shrink-0" aria-hidden="true" />
      <span>
        Medical support confirmed by <strong>{support.partner}</strong>
        {support.support?.length ? ` (${support.support.map((s) => s.label.toLowerCase()).join(', ')})` : ''}
      </span>
    </p>
  );
};

export const WhenWhere = ({ camp }) => (
  <div className="space-y-1 text-xs text-slate-700">
    <p className="flex items-center gap-1.5"><CalendarDays className="w-3.5 h-3.5 text-red-700" aria-hidden="true" />{fmtDate(camp.camp_date)}</p>
    <p className="flex items-center gap-1.5"><Clock className="w-3.5 h-3.5 text-red-700" aria-hidden="true" />{fmtTimeOfDay(camp.start_time)} - {fmtTimeOfDay(camp.end_time)}</p>
    <p className="flex items-start gap-1.5"><MapPin className="w-3.5 h-3.5 text-red-700 mt-0.5 shrink-0" aria-hidden="true" /><span>{camp.venue_name}, {camp.locality}</span></p>
  </div>
);

const campIcon = (active) => new L.DivIcon({
  className: 'camp-marker',
  html: `<div style="background:${active ? '#5c1625' : '#8a2338'};color:#fff;width:${active ? 34 : 28}px;height:${active ? 34 : 28}px;border-radius:50% 50% 50% 0;transform:rotate(-45deg);display:flex;align-items:center;justify-content:center;border:2px solid #fff;box-shadow:0 3px 6px rgba(0,0,0,.35)"><span style="transform:rotate(45deg);font-weight:800;font-size:13px;line-height:1">+</span></div>`,
  iconSize: [30, 30],
  iconAnchor: [15, 30],
  popupAnchor: [0, -28],
});

const FitBounds = ({ camps }) => {
  const map = useMap();
  useEffect(() => {
    const points = camps.filter((c) => c.latitude != null).map((c) => [c.latitude, c.longitude]);
    if (points.length > 1) map.fitBounds(points, { padding: [36, 36], maxZoom: 13 });
    else if (points.length === 1) map.setView(points[0], 13);
    else map.setView(CHENNAI_MAP_CENTER, 11);
  }, [camps, map]);
  return null;
};

/** Camps on a map. Points are approximate when the organiser gave no exact coordinates (stated in the popup). */
export const CampMap = ({ camps = [], base = '/camps', activeId, onSelect, height = '420px' }) => {
  const plotted = camps.filter((c) => c.latitude != null);
  return (
    <div style={{ height }} className="w-full rounded-2xl overflow-hidden border border-slate-200 relative z-0" role="region" aria-label="Map of donation camps">
      <MapContainer center={CHENNAI_MAP_CENTER} zoom={11} scrollWheelZoom={false} className="w-full h-full">
        <TileLayer attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
        <FitBounds camps={plotted} />
        {plotted.map((c) => (
          <Marker
            key={c.id}
            position={[c.latitude, c.longitude]}
            icon={campIcon(c.id === activeId)}
            eventHandlers={onSelect ? { click: () => onSelect(c.id) } : undefined}
          >
            <Popup>
              <div className="space-y-1 text-slate-800 min-w-[11rem]">
                <p className="font-bold text-sm text-red-800">{c.title}</p>
                <p className="text-xs">{c.organisation_name}</p>
                <p className="text-xs">{fmtDate(c.camp_date)}, {fmtTimeOfDay(c.start_time)}</p>
                <p className="text-xs">{c.venue_name}, {c.locality}</p>
                {c.location_approximate && <p className="text-[10px] text-slate-500">Approximate position (centre of {c.locality}).</p>}
                <Link to={`${base}/${c.id}`} className="inline-block text-xs font-semibold text-red-700 underline">View details</Link>
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
};

export const useMediaQuery = (query) => {
  const [matches, setMatches] = useState(() => (typeof window !== 'undefined' ? window.matchMedia(query).matches : false));
  useEffect(() => {
    const mq = window.matchMedia(query);
    const handler = (e) => setMatches(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, [query]);
  return matches;
};

export const FieldError = ({ errors }) => (errors?.length ? <p role="alert" className="mt-1 text-[11px] text-rose-700">{[].concat(errors).join(' ')}</p> : null);
