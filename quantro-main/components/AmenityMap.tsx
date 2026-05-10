import React, { useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMapEvents, useMap } from 'react-leaflet';
import L from 'leaflet';
import { motion } from 'framer-motion';
import type { AmenityPoint } from '../types';

interface AmenityMapProps {
  center: [number, number];
  amenities: AmenityPoint[];
  onMapClick?: (lat: number, lon: number) => void;
  spread?: boolean;
  address?: string;
}

function makeSvgIcon(paths: string, bg: string, size = 30): L.DivIcon {
  const half = size / 2;
  return L.divIcon({
    className: '',
    html: `<div style="
      background:${bg};
      width:${size}px;height:${size}px;
      border-radius:8px;
      display:flex;align-items:center;justify-content:center;
      box-shadow:0 2px 6px rgba(0,0,0,0.28);
      border:2px solid rgba(255,255,255,0.95);
    "><svg width="15" height="15" viewBox="0 0 24 24" fill="none"
      stroke="white" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
      ${paths}
    </svg></div>`,
    iconSize: [size, size],
    iconAnchor: [half, half],
    popupAnchor: [0, -half - 4],
  });
}

// SVG path strings (Lucide-style, 24×24 viewBox)
const SVG = {
  home: `<path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/>
         <polyline points="9 22 9 12 15 12 15 22"/>`,

  cart: `<circle cx="9" cy="21" r="1"/>
         <circle cx="20" cy="21" r="1"/>
         <path d="M1 1h4l2.68 13.39a2 2 0 001.98 1.61h9.72a2 2 0 001.98-1.61L23 6H6"/>`,

  pill: `<path d="M10.5 20.5l10-10a4.95 4.95 0 00-7-7l-10 10a4.95 4.95 0 007 7z"/>
         <line x1="8.5" y1="8.5" x2="15.5" y2="15.5"/>`,

  hospital: `<rect x="3" y="3" width="18" height="18" rx="2"/>
             <line x1="12" y1="8" x2="12" y2="16"/>
             <line x1="8" y1="12" x2="16" y2="12"/>`,

  tree: `<path d="M12 22V13"/>
         <path d="M12 13C8.5 13 4 10 4 6a8 8 0 0116 0c0 4-4.5 7-8 7z"/>`,

  school: `<path d="M22 10v6M2 10l10-5 10 5-10 5z"/>
           <path d="M6 12v5c3 3 9 3 12 0v-5"/>`,

  bus: `<rect x="3" y="3" width="18" height="15" rx="2"/>
        <line x1="3" y1="9" x2="21" y2="9"/>
        <line x1="9" y1="3" x2="9" y2="9"/>
        <line x1="15" y1="3" x2="15" y2="9"/>
        <circle cx="7.5" cy="19.5" r="1.5"/>
        <circle cx="16.5" cy="19.5" r="1.5"/>`,

  utensils: `<line x1="18" y1="2" x2="18" y2="22"/>
             <path d="M14 2v4a4 4 0 008 0V2"/>
             <line x1="6" y1="2" x2="6" y2="8"/>
             <line x1="3" y1="5" x2="9" y2="5"/>
             <line x1="6" y1="8" x2="6" y2="22"/>`,

  pin: `<path d="M21 10c0 7-9 13-9 13S3 17 3 10a9 9 0 0118 0z"/>
        <circle cx="12" cy="10" r="3"/>`,
};

const PROPERTY_ICON = makeSvgIcon(SVG.home, '#111827', 34);

function amenityIcon(kind: string): L.DivIcon {
  const k = kind.toLowerCase();
  if (k.includes('grocery') || k === 'supermarket' || k.includes('convenience') || k.includes('food_store'))
    return makeSvgIcon(SVG.cart, '#15803d');
  if (k.includes('pharmacy') || k.includes('chemist') || k.includes('drug'))
    return makeSvgIcon(SVG.pill, '#6d28d9');
  if (k.includes('hospital') || k.includes('clinic') || k.includes('doctor') || k.includes('health') || k.includes('medical'))
    return makeSvgIcon(SVG.hospital, '#b91c1c');
  if (k.includes('park') || k === 'recreation_ground' || k.includes('garden') || k.includes('nature'))
    return makeSvgIcon(SVG.tree, '#166534');
  if (k.includes('school') || k.includes('college') || k.includes('university') || k.includes('education'))
    return makeSvgIcon(SVG.school, '#b45309');
  if (k.includes('bus') || k.includes('transit') || k.includes('stop') || k.includes('station') || k.includes('subway'))
    return makeSvgIcon(SVG.bus, '#1d4ed8');
  if (k.includes('restaurant') || k.includes('cafe') || k.includes('food') || k.includes('dining'))
    return makeSvgIcon(SVG.utensils, '#c2410c');
  return makeSvgIcon(SVG.pin, '#4b5563');
}

const ClickHandler: React.FC<{ onClick?: (lat: number, lon: number) => void }> = ({ onClick }) => {
  useMapEvents({
    click(e) { onClick?.(e.latlng.lat, e.latlng.lng); },
  });
  return null;
};

function MapResizeOnMount() {
  const map = useMap();
  useEffect(() => {
    const t = requestAnimationFrame(() => { map.invalidateSize(); });
    const id = window.setTimeout(() => map.invalidateSize(), 320);
    return () => { cancelAnimationFrame(t); window.clearTimeout(id); };
  }, [map]);
  return null;
}

export const AmenityMap: React.FC<AmenityMapProps> = ({ center, amenities, onMapClick, spread = false, address }) => {
  const mapBlock = (
    <MapContainer center={center} zoom={13} scrollWheelZoom style={{ height: '100%', width: '100%' }}>
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <MapResizeOnMount />
      <ClickHandler onClick={onMapClick} />

      <Marker position={center} icon={PROPERTY_ICON}>
        <Popup>
          <strong>Property Location</strong><br />
          {address ? (
            <span>{address}</span>
          ) : (
            <span style={{ fontFamily: 'monospace', fontSize: 11 }}>
              {center[0].toFixed(5)}, {center[1].toFixed(5)}
            </span>
          )}
        </Popup>
      </Marker>

      {amenities.map((a, i) => (
        <Marker key={`${a.lat}-${a.lon}-${i}`} position={[a.lat, a.lon]} icon={amenityIcon(a.kind)}>
          <Popup>
            <strong>{a.name || a.kind}</strong><br />
            <span style={{ color: '#6b7280', fontSize: 11 }}>{a.kind.replace(/_/g, ' ')}</span>
            {a.distance_miles != null && <><br />{a.distance_miles.toFixed(1)} mi</>}
            {a.drive_minutes != null && <> &middot; {a.drive_minutes.toFixed(0)} min drive</>}
          </Popup>
        </Marker>
      ))}
    </MapContainer>
  );

  const viewportClass = spread
    ? 'min-h-[min(82svh,880px)] h-[76svh] max-h-[900px]'
    : 'h-[320px] sm:h-[360px]';

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="mb-6 overflow-hidden rounded-2xl bg-white shadow-soft"
    >
      <h3 className="border-b border-gray-100 px-5 pb-2 pt-4 text-xs font-bold uppercase tracking-wider text-gray-400">
        Amenity Map
      </h3>
      <div className={`min-h-0 w-full ${viewportClass}`}>{mapBlock}</div>
    </motion.div>
  );
};
