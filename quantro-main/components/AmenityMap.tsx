import React, { useCallback } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import { motion } from 'framer-motion';
import type { AmenityPoint } from '../types';

interface AmenityMapProps {
  center: [number, number];
  amenities: AmenityPoint[];
  onMapClick?: (lat: number, lon: number) => void;
}

const PROPERTY_ICON = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-red.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

const AMENITY_ICON = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-blue.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [20, 33],
  iconAnchor: [10, 33],
  popupAnchor: [1, -28],
  shadowSize: [33, 33],
});

function kindColor(kind: string): string {
  if (kind.includes('grocery') || kind === 'supermarket') return '#22c55e';
  if (kind.includes('pharmacy')) return '#8b5cf6';
  if (kind.includes('hospital') || kind.includes('clinic') || kind.includes('doctor')) return '#ef4444';
  if (kind.includes('park') || kind === 'recreation_ground') return '#16a34a';
  if (kind.includes('school')) return '#f59e0b';
  if (kind.includes('bus') || kind.includes('transit')) return '#3b82f6';
  return '#6b7280';
}

const ClickHandler: React.FC<{ onClick?: (lat: number, lon: number) => void }> = ({ onClick }) => {
  useMapEvents({
    click(e) {
      onClick?.(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
};

export const AmenityMap: React.FC<AmenityMapProps> = ({ center, amenities, onMapClick }) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white rounded-2xl shadow-soft overflow-hidden mb-6"
    >
      <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider px-5 pt-4 pb-2">
        Amenity Map
      </h3>
      <div style={{ height: 420 }}>
        <MapContainer
          center={center}
          zoom={13}
          scrollWheelZoom={true}
          style={{ height: '100%', width: '100%' }}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <ClickHandler onClick={onMapClick} />

          <Marker position={center} icon={PROPERTY_ICON}>
            <Popup>
              <strong>Property Location</strong>
              <br />
              {center[0].toFixed(5)}, {center[1].toFixed(5)}
            </Popup>
          </Marker>

          {amenities.map((a, i) => (
            <Marker
              key={`${a.lat}-${a.lon}-${i}`}
              position={[a.lat, a.lon]}
              icon={AMENITY_ICON}
            >
              <Popup>
                <strong>{a.name || a.kind}</strong>
                <br />
                <span style={{ color: kindColor(a.kind) }}>{a.kind}</span>
                {a.distance_miles != null && (
                  <>
                    <br />
                    {a.distance_miles.toFixed(1)} mi
                  </>
                )}
                {a.drive_minutes != null && (
                  <>
                    {' '}
                    &middot; {a.drive_minutes.toFixed(0)} min drive
                  </>
                )}
              </Popup>
            </Marker>
          ))}
        </MapContainer>
      </div>
    </motion.div>
  );
};
