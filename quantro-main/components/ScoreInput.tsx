import React, { useState } from 'react';
import { Search, MapPin, Loader2 } from 'lucide-react';
import { motion } from 'framer-motion';
import type { ScoreRequest } from '../types';

interface ScoreInputProps {
  onScore: (req: ScoreRequest) => void;
  loading: boolean;
  initialAddress?: string;
}

export const ScoreInput: React.FC<ScoreInputProps> = ({ onScore, loading, initialAddress }) => {
  const [address, setAddress] = useState(initialAddress || '');
  const [parcelType, setParcelType] = useState('vacant');
  const [floodZone, setFloodZone] = useState('none');
  const [brownfield, setBrownfield] = useState(false);
  const [channelCity, setChannelCity] = useState(false);
  const [channelFannie, setChannelFannie] = useState(false);
  const [channelInstitution, setChannelInstitution] = useState(false);

  React.useEffect(() => {
    if (initialAddress) setAddress(initialAddress);
  }, [initialAddress]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!address.trim()) return;
    onScore({
      address: address.trim(),
      parcel_type: parcelType,
      flood_zone: floodZone,
      brownfield,
      channel_city: channelCity,
      channel_fannie: channelFannie,
      channel_institution: channelInstitution,
      radius_m: 8000,
    });
  };

  const selectClass =
    'bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-700 focus:outline-none focus:border-gray-400 transition-colors';
  const checkClass = 'w-4 h-4 rounded border-gray-300 text-green-600 focus:ring-green-500';

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white rounded-2xl shadow-soft p-6 mb-6"
    >
      <form onSubmit={handleSubmit}>
        <div className="flex items-center gap-3 mb-5">
          <div className="relative flex-1">
            <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
            <input
              type="text"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="Enter address or lat,lon (e.g. 1234 Main St, Fort Worth, TX)"
              className="w-full pl-10 pr-4 py-3 bg-gray-50 rounded-xl text-sm text-gray-800 border border-gray-200 focus:border-gray-400 focus:outline-none transition-all placeholder:text-gray-400"
            />
          </div>
          <button
            type="submit"
            disabled={loading || !address.trim()}
            className="flex items-center gap-2 px-6 py-3 bg-black text-white rounded-xl text-sm font-semibold hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-sm"
          >
            {loading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Search className="w-4 h-4" />
            )}
            {loading ? 'Scoring...' : 'Score'}
          </button>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Parcel Type</label>
            <select value={parcelType} onChange={(e) => setParcelType(e.target.value)} className={selectClass}>
              <option value="vacant">Vacant Land</option>
              <option value="improved">Improved (Structure)</option>
            </select>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Flood Zone</label>
            <select value={floodZone} onChange={(e) => setFloodZone(e.target.value)} className={selectClass}>
              <option value="none">None</option>
              <option value="500yr">500-Year</option>
              <option value="100yr">100-Year</option>
              <option value="floodway_critical">Critical Floodway</option>
            </select>
          </div>

          <div className="flex items-end gap-2 pb-1">
            <input type="checkbox" checked={brownfield} onChange={(e) => setBrownfield(e.target.checked)} className={checkClass} id="bf" />
            <label htmlFor="bf" className="text-xs text-gray-600 cursor-pointer">Brownfield</label>
          </div>

          <div className="flex items-end gap-2 pb-1">
            <input type="checkbox" checked={channelCity} onChange={(e) => setChannelCity(e.target.checked)} className={checkClass} id="cc" />
            <label htmlFor="cc" className="text-xs text-gray-600 cursor-pointer">City Channel</label>
          </div>

          <div className="flex items-end gap-2 pb-1">
            <input type="checkbox" checked={channelFannie} onChange={(e) => setChannelFannie(e.target.checked)} className={checkClass} id="cf" />
            <label htmlFor="cf" className="text-xs text-gray-600 cursor-pointer">Fannie Mae</label>
          </div>

          <div className="flex items-end gap-2 pb-1">
            <input type="checkbox" checked={channelInstitution} onChange={(e) => setChannelInstitution(e.target.checked)} className={checkClass} id="ci" />
            <label htmlFor="ci" className="text-xs text-gray-600 cursor-pointer">Institution</label>
          </div>
        </div>
      </form>
    </motion.div>
  );
};
