import React from 'react';
import { motion } from 'framer-motion';
import { MapPin, TrendingUp, TrendingDown } from 'lucide-react';
import type { SuggestionTract } from '../types';

interface SuggestionCardProps {
  tract: SuggestionTract;
  index: number;
  onSelect: (tract: SuggestionTract) => void;
}

function scoreBand(score: number) {
  if (score >= 75) return { ring: 'ring-green-100', scoreText: 'text-green-600', dot: 'bg-green-500', gradeBg: 'bg-green-100 text-green-700' };
  if (score >= 50) return { ring: 'ring-amber-100', scoreText: 'text-amber-600', dot: 'bg-amber-500', gradeBg: 'bg-amber-100 text-amber-700' };
  return { ring: 'ring-red-100', scoreText: 'text-red-500', dot: 'bg-red-500', gradeBg: 'bg-red-100 text-red-600' };
}

function fmt(v: number | null, prefix = '$'): string {
  if (v == null) return 'N/A';
  if (v >= 1_000_000) return `${prefix}${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `${prefix}${Math.round(v / 1_000)}k`;
  return `${prefix}${v}`;
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
      className={`bg-white ring-1 ${band.ring} rounded-2xl p-5 cursor-pointer hover:shadow-md transition-all flex flex-col gap-4`}
    >
      {/* Score row */}
      <div className="flex items-center justify-between">
        <div className="flex items-baseline gap-1.5">
          <span className={`text-4xl font-bold tracking-tight ${band.scoreText}`}>
            {Math.round(tract.composite_score)}
          </span>
          <span className="text-sm text-gray-300 font-medium">/ 100</span>
        </div>
        <div className="flex items-center gap-2">
          <span className={`text-[11px] font-bold px-2 py-0.5 rounded-lg ${band.gradeBg}`}>
            Grade {tract.letter_grade}
          </span>
          <span className={`px-2 py-0.5 text-[10px] font-bold rounded-lg ${tract.pass_fail === 'PASS' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'}`}>
            {tract.pass_fail}
          </span>
        </div>
      </div>

      {/* Location */}
      <div className="flex items-start gap-1.5 text-xs text-gray-500">
        <MapPin className="w-3 h-3 shrink-0 mt-0.5" />
        <div className="min-w-0">
          {tract.neighborhood_name ? (
            <span className="leading-snug">{tract.neighborhood_name}</span>
          ) : (
            <span>Tract {tract.GEOID}</span>
          )}
          {tract.approx_lat != null && (
            <span className="block text-[10px] text-gray-300 mt-0.5 font-mono">
              {tract.approx_lat.toFixed(5)}, {tract.approx_lon.toFixed(5)}
            </span>
          )}
        </div>
      </div>

      {/* Key metrics */}
      <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-[11px] text-gray-500">
        <span>Home <span className="font-medium text-gray-700">{fmt(tract.median_home_value)}</span></span>
        <span>Land <span className="font-medium text-gray-700">{fmt(tract.est_land_value)}</span></span>
        {tract.median_income != null && (
          <>
            <span>Income <span className="font-medium text-gray-700">{fmt(tract.median_income)}</span></span>
            <span>Poverty <span className="font-medium text-gray-700">{tract.poverty_pct?.toFixed(1) ?? 'N/A'}%</span></span>
          </>
        )}
      </div>

      {/* Strengths & weaknesses */}
      {(strengths.length > 0 || weaknesses_list.length > 0) && (
        <div className="border-t border-gray-100 pt-3 flex flex-col gap-2">
          {strengths.slice(0, 2).map((s, i) => (
            <div key={i} className="flex items-start gap-1.5">
              <TrendingUp className="w-3 h-3 text-green-500 mt-0.5 shrink-0" />
              <span className="text-[11px] text-gray-600 leading-snug truncate">{s}</span>
            </div>
          ))}
          {weaknesses_list.slice(0, 1).map((w, i) => (
            <div key={i} className="flex items-start gap-1.5">
              <TrendingDown className="w-3 h-3 text-red-400 mt-0.5 shrink-0" />
              <span className="text-[11px] text-gray-400 leading-snug truncate">{w}</span>
            </div>
          ))}
        </div>
      )}

      {/* Designation badges */}
      {(tract.is_qct === 1 || tract.is_oz === 1) && (
        <div className="flex gap-1.5">
          {tract.is_qct === 1 && (
            <span className="px-2 py-0.5 bg-blue-50 text-blue-600 text-[9px] font-bold rounded-md">QCT</span>
          )}
          {tract.is_oz === 1 && (
            <span className="px-2 py-0.5 bg-purple-50 text-purple-600 text-[9px] font-bold rounded-md">OZ</span>
          )}
        </div>
      )}
    </motion.div>
  );
};
