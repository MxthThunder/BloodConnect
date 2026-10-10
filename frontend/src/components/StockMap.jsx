import React from 'react';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { Building2, Phone, MapPin } from 'lucide-react';

// Fix Leaflet's default marker icon issue with bundlers
const customHospitalIcon = new L.DivIcon({
  className: 'custom-leaflet-marker',
  html: `<div style="background-color: #dc2626; color: white; width: 30px; height: 30px; border-radius: 50%; display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.3); border: 2px solid white; font-weight: bold; font-size: 14px;">+</div>`,
  iconSize: [30, 30],
  iconAnchor: [15, 15],
  popupAnchor: [0, -18],
});

const StockMap = ({ bloodBanks = [], height = '360px' }) => {
  // Center around Chennai, Tamil Nadu
  const defaultCenter = [13.0600, 80.2400];

  return (
    <div style={{ height }} className="w-full rounded-2xl overflow-hidden border border-slate-200 shadow-sm relative z-0">
      <MapContainer
        center={defaultCenter}
        zoom={12}
        scrollWheelZoom={false}
        className="w-full h-full"
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {bloodBanks.map((bank) => (
          <Marker
            key={bank.id}
            position={[bank.latitude || 13.0805, bank.longitude || 80.2785]}
            icon={customHospitalIcon}
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
      </MapContainer>
    </div>
  );
};

export default StockMap;
