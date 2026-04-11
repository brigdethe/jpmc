import React from 'react';
import { motion } from 'framer-motion';
import { ShoppingCart, Pill, Heart, Trees, Bus, School, Building2 } from 'lucide-react';

interface AmenityTableProps {
  summary: Record<string, any>;
}

function icon(key: string) {
  if (key.includes('grocery')) return <ShoppingCart className="w-3.5 h-3.5" />;
  if (key.includes('pharmacy')) return <Pill className="w-3.5 h-3.5" />;
  if (key.includes('health')) return <Heart className="w-3.5 h-3.5" />;
  if (key.includes('park')) return <Trees className="w-3.5 h-3.5" />;
  if (key.includes('bus') || key.includes('transit')) return <Bus className="w-3.5 h-3.5" />;
  if (key.includes('school')) return <School className="w-3.5 h-3.5" />;
  return <Building2 className="w-3.5 h-3.5" />;
}

function formatKey(key: string): string {
  return key
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .replace('Distance Miles', '(mi)')
    .replace('Drive Minutes', '(min)')
    .replace('Nearest ', '')
    .replace('Within 1 Mile', '< 1 mi')
    .replace('Within 3 Miles', '< 3 mi')
    .replace('And Transit Nearby', '& Transit Nearby');
}

function formatValue(key: string, val: any): string {
  if (val === null || val === undefined || val === 'null') return 'Not found nearby';
  if (typeof val === 'number') {
    if (key.includes('miles') || key.includes('distance')) return `${val.toFixed(1)} mi`;
    if (key.includes('minutes') || key.includes('drive')) return `${val.toFixed(0)} min`;
    return val.toString();
  }
  if (typeof val === 'boolean') return val ? 'Yes' : 'No';
  return String(val);
}

export const AmenityTable: React.FC<AmenityTableProps> = ({ summary }) => {
  const entries = Object.entries(summary).filter(([k]) => k !== 'uses_osrm');

  if (entries.length === 0) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white rounded-2xl shadow-soft p-5 mb-6"
    >
      <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-4">
        Amenity Summary
      </h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {entries.map(([key, val]) => (
          <div key={key} className="flex items-center gap-3 p-3 rounded-xl bg-gray-50">
            <span className="text-gray-400">{icon(key)}</span>
            <div className="min-w-0">
              <p className="text-[11px] text-gray-400 truncate">{formatKey(key)}</p>
              <p className="text-sm font-medium text-gray-800">{formatValue(key, val)}</p>
            </div>
          </div>
        ))}
      </div>
    </motion.div>
  );
};
