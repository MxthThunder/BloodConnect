import React, { useEffect, useState } from 'react';
import { MapContainer, TileLayer, CircleMarker, Circle, Popup, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { MapPin } from 'lucide-react';
import { escalationApi } from '../../api/escalation';
import { CHENNAI_MAP_CENTER } from '../../constants/chennaiData';
import { Panel } from './shared';

const STATUS_COLOR = {
  POTENTIAL: '#8b8178', ALERT_SENT: '#2563eb', ALERT_VIEWED: '#0284c7', NO_RESPONSE: '#d97706',
  RESPONSE_DECLINED: '#e11d48', VOLUNTEER_CONFIRMED: '#059669', HOSPITAL_VERIFICATION_PENDING: '#7c3aed',
  DONATION_CONFIRMED: '#047857', NOT_DONATED: '#6b7280', WITHDRAWN: '#9ca3af',
};

const Fit = ({ points }) => {
  const map = useMap();
  useEffect(() => {
    if (points.length > 1) map.fitBounds(points, { padding: [30, 30], maxZoom: 13 });
    else if (points.length === 1) map.setView(points[0], 13);
  }, [map, points]);
  return null;
};

const Tiles = () => (
  <TileLayer attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
);

/* Single emergency: hospital, search stages, rounded candidate positions. */
export const CaseMap = ({ caseId, refreshKey, height = '22rem' }) => {
  const [data, setData] = useState(null);
  useEffect(() => { escalationApi.map(caseId).then(setData).catch(() => setData(null)); }, [caseId, refreshKey]);
  if (!data) return <Panel title="Emergency map" icon={MapPin}><p className="text-xs text-slate-500">Loading map...</p></Panel>;

  const h = data.hospital;
  const pts = data.candidates.map((c) => [c.lat, c.lng]);
  if (h.lat != null) pts.push([h.lat, h.lng]);
  return (
    <Panel title="Emergency map" icon={MapPin} bodyClass="p-3 space-y-2">
      <div style={{ height }} className="rounded-lg overflow-hidden border border-slate-200">
        <MapContainer center={h.lat != null ? [h.lat, h.lng] : CHENNAI_MAP_CENTER} zoom={12} scrollWheelZoom={false} className="w-full h-full">
          <Tiles />
          <Fit points={pts} />
          {h.lat != null && data.stages.filter((s) => s.radius_km).map((s) => (
            <Circle key={s.name} center={[h.lat, h.lng]} radius={s.radius_km * 1000}
              pathOptions={{ color: '#8a2338', weight: 1, dashArray: '4 4', fillOpacity: 0.02 }} />
          ))}
          {data.blood_banks.map((b) => (
            <CircleMarker key={b.name} center={[b.lat, b.lng]} radius={4} pathOptions={{ color: '#6b7280', fillColor: '#d1d5db', fillOpacity: 1, weight: 1 }}>
              <Popup>{b.name} ({b.locality})</Popup>
            </CircleMarker>
          ))}
          {data.candidates.map((c, i) => (
            <CircleMarker key={i} center={[c.lat, c.lng]} radius={6}
              pathOptions={{ color: '#fff', weight: 1.5, fillColor: STATUS_COLOR[c.status] || '#8b8178', fillOpacity: 0.9 }}>
              <Popup><strong>{c.label}</strong><br />{c.status_label}<br /><em>approximate position (rounded to ~1 km)</em></Popup>
            </CircleMarker>
          ))}
          {h.lat != null && (
            <CircleMarker center={[h.lat, h.lng]} radius={10} pathOptions={{ color: '#fff', weight: 2, fillColor: '#8a2338', fillOpacity: 1 }}>
              <Popup><strong>{h.name}</strong><br />{h.approximate ? 'Approximate location' : 'Hospital coordinates'}{h.fictional ? ' - fictional' : ''}</Popup>
            </CircleMarker>
          )}
        </MapContainer>
      </div>
      <ul className="flex flex-wrap gap-x-3 gap-y-1 text-[10px] text-slate-600" aria-label="Map legend">
        <li><span className="inline-block w-2.5 h-2.5 rounded-full align-middle mr-1" style={{ background: '#8a2338' }} />{h.fictional ? 'Fictional hospital' : 'Hospital / request'}</li>
        {['POTENTIAL', 'ALERT_SENT', 'NO_RESPONSE', 'RESPONSE_DECLINED', 'VOLUNTEER_CONFIRMED'].map((s) => (
          <li key={s}><span className="inline-block w-2.5 h-2.5 rounded-full align-middle mr-1" style={{ background: STATUS_COLOR[s] }} />
            {{ POTENTIAL: 'Potential candidate', ALERT_SENT: 'Alert sent', NO_RESPONSE: 'No response (unknown)', RESPONSE_DECLINED: 'Declined', VOLUNTEER_CONFIRMED: 'Volunteer' }[s]}</li>
        ))}
        {data.stages.some((s) => s.radius_km) && <li>Dashed rings: search stages</li>}
      </ul>
      <p className="text-[10px] text-slate-500">
        {h.approximate ? `Request has no coordinates: shown at an ${h.basis}. ` : ''}
        {data.privacy_note} Candidates without reliable coordinates are not plotted
        {data.unplaced_by_locality.length > 0 && `: ${data.unplaced_by_locality.map((u) => `${u.count} in ${u.locality}`).join(', ')}`}.
      </p>
    </Panel>
  );
};

/* All active emergencies. */
export const OverviewMap = ({ markers, height = '20rem' }) => {
  const pts = markers.map((m) => [m.lat, m.lng]);
  return (
    <Panel title="Active emergency locations" icon={MapPin} bodyClass="p-3 space-y-2">
      <div style={{ height }} className="rounded-lg overflow-hidden border border-slate-200">
        <MapContainer center={CHENNAI_MAP_CENTER} zoom={11} scrollWheelZoom={false} className="w-full h-full">
          <Tiles />
          <Fit points={pts} />
          {markers.map((m) => (
            <CircleMarker key={m.case_id} center={[m.lat, m.lng]} radius={m.urgency === 'CRITICAL' ? 11 : 8}
              pathOptions={{ color: '#fff', weight: 2, fillColor: m.fictional ? '#7c3aed' : '#8a2338', fillOpacity: 0.95 }}>
              <Popup><strong>{m.reference}</strong> ({m.blood_group}, {m.urgency})<br />{m.hospital}<br />
                {m.approximate ? <em>approximate position</em> : 'hospital coordinates'}{m.fictional ? ' - fictional' : ''}</Popup>
            </CircleMarker>
          ))}
        </MapContainer>
      </div>
      <p className="text-[10px] text-slate-500">
        Positions come from each request's hospital coordinates; where a request has none, its locality's approximate reference point is used and marked approximate.
        Donor locations are shown only inside an individual emergency, rounded to ~1 km.
      </p>
    </Panel>
  );
};
