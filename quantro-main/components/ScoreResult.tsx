import React from 'react';
import { motion } from 'framer-motion';
import { CheckCircle2, XCircle, AlertTriangle } from 'lucide-react';
import type { ScoreResponse } from '../types';

interface ScoreResultProps {
  data: ScoreResponse;
}

function scoreColor(score: number): { bg: string; text: string; ring: string; label: string } {
  if (score >= 75) return { bg: 'bg-green-50', text: 'text-green-700', ring: 'ring-green-300', label: 'High Opportunity' };
  if (score >= 50) return { bg: 'bg-yellow-50', text: 'text-yellow-700', ring: 'ring-yellow-300', label: 'Baseline' };
  return { bg: 'bg-red-50', text: 'text-red-700', ring: 'ring-red-300', label: 'Low Opportunity' };
}

export const ScoreResult: React.FC<ScoreResultProps> = ({ data }) => {
  const colors = scoreColor(data.composite_score);

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ type: 'spring', stiffness: 200, damping: 20 }}
      className={`${colors.bg} rounded-2xl shadow-soft p-6 mb-6 ring-1 ${colors.ring}`}
    >
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center gap-5">
          <div className={`relative w-24 h-24 flex items-center justify-center rounded-full ring-4 ${colors.ring} bg-white shadow-md`}>
            <span className={`text-3xl font-bold ${colors.text}`}>
              {Math.round(data.composite_score)}
            </span>
            <span className={`absolute -bottom-1 text-[10px] font-bold ${colors.text} uppercase`}>/ 100</span>
          </div>

          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className={`text-2xl font-bold ${colors.text}`}>
                Grade {data.letter_grade}
              </span>
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${colors.bg} ${colors.text} ring-1 ${colors.ring}`}>
                {data.opportunity_label}
              </span>
            </div>
            <p className="text-sm text-gray-500 max-w-md truncate">{data.address}</p>
            <p className="text-xs text-gray-400 mt-0.5">Census Tract: {data.tract_geoid}</p>
          </div>
        </div>

        <div className="flex flex-col items-end gap-2">
          <div className="flex items-center gap-2">
            {data.pass_fail ? (
              <span className="flex items-center gap-1 text-sm font-medium text-green-700">
                <CheckCircle2 className="w-4 h-4" /> PASS
              </span>
            ) : (
              <span className="flex items-center gap-1 text-sm font-medium text-red-700">
                <XCircle className="w-4 h-4" /> FAIL
              </span>
            )}
          </div>

          {data.hard_excluded && (
            <span className="flex items-center gap-1 text-xs text-red-600">
              <AlertTriangle className="w-3 h-3" /> {data.exclusion_reason}
            </span>
          )}

          {data.channel_bonus > 0 && (
            <span className="text-xs text-green-600">
              +{data.channel_bonus.toFixed(1)}% channel bonus applied
            </span>
          )}

          {data.errors.length > 0 && (
            <span className="text-[10px] text-yellow-600">
              {data.errors.length} data warning(s)
            </span>
          )}
        </div>
      </div>
    </motion.div>
  );
};
