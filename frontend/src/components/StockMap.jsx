import React, { useEffect, useMemo } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { Building2, Phone, MapPin, Stethoscope } from 'lucide-react';
import { isInChennaiRegion } from '../constants/regionalHospitals';

// Fix Leaflet's default marker icon issue with bundlers
const customHospitalIcon = new L.DivIcon({
  className: 'custom-leaflet-marker',
  html: `<div style="background-color: #dc2626; color: white; width: 30px; height: 30px; border-radius: 50%; display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.3); border: 2px solid white; font-weight: bold; font-size: 14px;">+</div>`,
  iconSize: [30, 30],
  iconAnchor: [15, 15],
  popupAnchor: [0, -18],
});

// Smaller navy pin for hospitals that BloodConnect does not monitor stock for
const nearbyHospitalIcon = new L.DivIcon({
  className: 'custom-leaflet-marker',
  html: `<div style="background-color: #1f3a5f; color: white; width: 20px; height: 20px; border-radius: 50%; display: flex; align-items: center; justify-content: center; box-shadow: 0 2px 4px rgba(0,0,0,0.35); border: 2px solid white; font-weight: bold; font-size: 11px;">H</div>`,
  iconSize: [20, 20],
  iconAnchor: [10, 10],
  popupAnchor: [0, -12],
});

const NO_HOSPITALS = [];

// Zooms out so every pin, including the hospitals around Chennai, is visible
const FitToPins = ({ points }) => {
  const map = useMap();
  useEffect(() => {
    if (points.length > 1) map.fitBounds(points, { padding: [28, 28], maxZoom: 12 });
  }, [map, points]);
  return null;
};

const StockMap = ({ bloodBanks = [], hospitals = NO_HOSPITALS, height = '360px' }) => {
  // Center around Chennai, Tamil Nadu
  const defaultCenter = [13.0600, 80.2400];

  // Only banks in the Chennai region are drawn, so a stray record elsewhere cannot stretch the map
  const banks = useMemo(
    () => bloodBanks.filter((b) => b.latitude != null && b.longitude != null && isInChennaiRegion(b.latitude, b.longitude)),
    [bloodBanks]
  );
  const points = useMemo(
    () => (hospitals.length ? [...banks.map((b) => [b.latitude, b.longitude]), ...hospitals.map((h) => [h.lat, h.lng])] : []),
    [banks, hospitals]
  );

  return (
    <div className="space-y-2">
      <div style={{ height }} className="w-full rounded-2xl overflow-hidden border border-slate-200 shadow-sm relative z-0">
        <MapContainer
          center={defaultCenter}
          zoom={12}
          zoomSnap={0.5}
          scrollWheelZoom={false}
          className="w-full h-full"
        >
          <FitToPins points={points} />
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          {banks.map((bank) => (
            <Marker
              key={bank.id}
              position={[bank.latitude || 13.0805, bank.longitude || 80.2785]}
              icon={customHospitalIcon}
              title={bank.name}
              zIndexOffset={500}
            >
              <Popup className="blood-bank-popup">
                <div className="p-1 space-y-1 text-slate-800">
                  <h4 className="font-bold text-sm text-red-600 flex items-center gap-1">
                    <Building2 className="w-3.5 h-3.5" />
                    {bank.name}
                  </h4>
                  <p className="text-xs text-slate-600 flex items-center gap-1">
                    <MapPin className="w-3 h-3 text-slate-400" />
                    {bank.locality}, {bank.city}
                  </p>
                  {bank.contact_phone && (
                    <p className="text-xs text-slate-600 flex items-center gap-1">
                      <Phone className="w-3 h-3 text-slate-400" />
                      {bank.contact_phone}
                    </p>
                  )}
                  <div className="pt-1 text-[11px] text-emerald-600 font-semibold">
                    {bank.operating_hours || '24/7 Emergency Blood Desk'}
                  </div>
                </div>
              </Popup>
            </Marker>
          ))}
          {hospitals.map((h) => (
            <Marker key={h.osm} position={[h.lat, h.lng]} icon={nearbyHospitalIcon} title={h.name}>
              <Popup>
                <div className="p-1 space-y-1 text-slate-800">
                  <h4 className="font-bold text-sm text-slate-900 flex items-center gap-1">
                    <Stethoscope className="w-3.5 h-3.5" />
                    {h.name}
                  </h4>
                  <p className="text-xs text-slate-600 flex items-center gap-1">
                    <MapPin className="w-3 h-3 text-slate-400" />
                    {h.area}
                  </p>
                  <p className="text-[11px] text-slate-500">
                    Reference location only: BloodConnect does not monitor this hospital&apos;s blood stock, so call
                    ahead to confirm availability. Position is approximate.
                  </p>
                </div>
              </Popup>
            </Marker>
          ))}
        </MapContainer>
      </div>
      {hospitals.length > 0 && (
        <p className="text-[11px] text-slate-500">
          Red <strong>+</strong>: blood banks whose stock BloodConnect monitors. Navy <strong>H</strong>: other hospitals
          around Chennai, shown for reference. Positions are approximate (OpenStreetMap).
        </p>
      )}
    </div>
  );
};

export default StockMap;
