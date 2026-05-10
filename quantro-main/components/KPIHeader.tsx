import React from 'react';
import { motion } from 'framer-motion';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import type { ScoreResponse } from '../types';

interface KPIHeaderProps {
  data: ScoreResponse;
  fromCache?: boolean;
  onRefresh?: () => void;
}

export const KPIHeader: React.FC<KPIHeaderProps> = ({ data, fromCache = false, onRefresh }) => {
  const rounded = Math.round(data.composite_score);

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ type: 'spring', stiffness: 200, damping: 20 }}
      className="flex flex-col gap-1 mb-6"
    >
      <div className="min-w-0">
        <div className="flex items-center gap-3 mb-1">
          <h3 className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">{data.opportunity_label}</h3>
          {fromCache && (
            <span className="flex items-center gap-1.5 text-[10px] font-medium text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">
              Cached
              {onRefresh && (
                <button
                  onClick={onRefresh}
                  className="text-gray-400 hover:text-gray-700 transition-colors"
                  title="Re-score from live data"
                >
                  <RefreshCw className="w-3 h-3" />
                </button>
              )}
            </span>
          )}
        </div>

        <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-2 min-w-0">
          <div className="min-w-0 shrink-0">
            <div className="text-5xl sm:text-6xl md:text-7xl font-semibold tracking-tight text-gray-800 leading-none flex items-baseline gap-2 sm:gap-3 flex-wrap">
              <span>{rounded}</span>
              <span className="text-3xl sm:text-4xl md:text-5xl font-semibold text-gray-400 tracking-tight">/ 100</span>
            </div>
          </div>
          <div className="flex flex-col gap-0.5 items-end text-right min-w-0 max-w-full sm:max-w-md lg:max-w-lg">
            <p className="text-sm font-medium text-gray-600">Grade {data.letter_grade}</p>
            <p className="text-sm text-gray-500 truncate w-full text-right">{data.address}</p>
            <p className="text-xs text-gray-400">Census Tract: {data.tract_geoid}</p>
            {data.hard_excluded && (
              <span className="flex items-center justify-end gap-1 text-xs text-red-600">
                <AlertTriangle className="w-3 h-3 shrink-0" /> {data.exclusion_reason}
              </span>
            )}
            {data.channel_bonus > 0 && (
              <span className="text-xs text-green-600">+{data.channel_bonus.toFixed(1)}% channel bonus applied</span>
            )}
            {data.errors.length > 0 && (
              <span className="text-[10px] text-yellow-600">{data.errors.length} data warning(s)</span>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
};