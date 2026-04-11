import React from 'react';
import { motion } from 'framer-motion';
import { MapPin, DollarSign, TrendingUp, TrendingDown, ExternalLink } from 'lucide-react';
import type { SuggestionTract } from '../types';

interface SuggestionCardProps {
  tract: SuggestionTract;
  index: number;
  onSelect: (tract: SuggestionTract) => void;
}

function scoreBand(score: number) {
  if (score >= 75) return { bg: 'bg-green-50 ring-green-200', text: 'text-green-700', dot: 'bg-green-500' };
  if (score >= 50) return { bg: 'bg-yellow-50 ring-yellow-200', text: 'text-yellow-700', dot: 'bg-yellow-500' };
  return { bg: 'bg-red-50 ring-red-200', text: 'text-red-700', dot: 'bg-red-500' };
}

function fmt(v: number | null, prefix = '$'): string {
  if (v == null) return 'N/A';
  return `${prefix}${v.toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
}

export const SuggestionCard: React.FC<SuggestionCardProps> = ({ tract, index, onSelect }) => {
  const band = scoreBand(tract.composite_score);
  const strengths = tract.top_strengths?.split('; ').filter(Boolean) || [];
  const weaknesses_list = tract.weaknesses?.split('; ').filter(Boolean) || [];

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.06 }}
      onClick={() => onSelect(tract)}
      className={`relative ${band.bg} ring-1 rounded-2xl p-5 cursor-pointer hover:shadow-md transition-all group`}
    >
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className={`w-3 h-3 rounded-full ${band.dot}`} />
          <span className={`text-2xl font-bold ${band.text}`}>
            {Math.round(tract.composite_score)}
          </span>
          <span className={`text-xs font-bold ${band.text}`}>/ 100</span>
        </div>
        <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase ${band.text} ${band.bg}`}>
          {tract.letter_grade}
        </span>
      </div>

      <div className="flex items-center gap-1.5 text-xs text-gray-500 mb-3">
        <MapPin className="w-3 h-3" />
        <span className="truncate">Tract {tract.GEOID}</span>
        {tract.approx_lat && (
          <span className="text-gray-300 ml-1">
            ({tract.approx_lat.toFixed(3)}, {tract.approx_lon.toFixed(3)})
          </span>
        )}
      </div>

      <div className="grid grid-cols-2 gap-2 text-xs mb-3">
        <div className="flex items-center gap-1.5 text-gray-600">
          <DollarSign className="w-3 h-3 text-gray-400" />
          <span>Home: {fmt(tract.median_home_value)}</span>
        </div>
        <div className="flex items-center gap-1.5 text-gray-600">
          <DollarSign className="w-3 h-3 text-gray-400" />
          <span>Land: {fmt(tract.est_land_value)}</span>
        </div>
        {tract.median_income != null && (
          <div className="text-gray-500 col-span-2">
            Income: {fmt(tract.median_income)} &middot; Poverty: {tract.poverty_pct?.toFixed(1) ?? 'N/A'}%
          </div>
        )}
      </div>

      {strengths.length > 0 && (
        <div className="mb-2">
          <div className="flex items-center gap-1 text-[10px] font-bold text-green-600 uppercase mb-1">
            <TrendingUp className="w-3 h-3" /> Strengths
          </div>
          {strengths.map((s, i) => (
            <p key={i} className="text-[11px] text-gray-600 leading-snug truncate">{s}</p>
          ))}
        </div>
      )}

      {weaknesses_list.length > 0 && (
        <div>
          <div className="flex items-center gap-1 text-[10px] font-bold text-red-500 uppercase mb-1">
            <TrendingDown className="w-3 h-3" /> Needs Improvement
          </div>
          {weaknesses_list.map((w, i) => (
            <p key={i} className="text-[11px] text-gray-500 leading-snug truncate">{w}</p>
          ))}
        </div>
      )}

      <div className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity">
        <ExternalLink className="w-3.5 h-3.5 text-gray-400" />
      </div>

      <div className="flex flex-wrap gap-1.5 mt-3">
        {tract.is_qct === 1 && (
          <span className="px-1.5 py-0.5 bg-blue-100 text-blue-700 text-[9px] font-bold rounded">QCT</span>
        )}
        {tract.is_oz === 1 && (
          <span className="px-1.5 py-0.5 bg-purple-100 text-purple-700 text-[9px] font-bold rounded">OZ</span>
        )}
        <span className={`px-1.5 py-0.5 text-[9px] font-bold rounded ${tract.pass_fail === 'PASS' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
          {tract.pass_fail}
        </span>
      </div>
    </motion.div>
  );
};
