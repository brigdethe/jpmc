import React from 'react';
import { motion } from 'framer-motion';
import { TrendingUp, TrendingDown } from 'lucide-react';
import type { FactorResult } from '../types';

interface FactorBreakdownProps {
  factors: FactorResult[];
}

function tierBadge(tier: string) {
  const map: Record<string, string> = {
    High: 'bg-green-100 text-green-700',
    Baseline: 'bg-yellow-100 text-yellow-700',
    Low: 'bg-red-100 text-red-700',
  };
  return map[tier] || 'bg-gray-100 text-gray-600';
}

const FactorCard: React.FC<{ f: FactorResult; rank: number }> = ({ f, rank }) => (
  <motion.div
    initial={{ opacity: 0, x: rank < 4 ? -10 : 10 }}
    animate={{ opacity: 1, x: 0 }}
    transition={{ delay: rank * 0.05 }}
    className="flex items-start gap-3 p-3 rounded-xl bg-gray-50 hover:bg-gray-100 transition-colors"
  >
    <span className={`mt-0.5 px-2 py-0.5 rounded-md text-[10px] font-bold uppercase ${tierBadge(f.tier)}`}>
      {f.tier}
    </span>
    <div className="flex-1 min-w-0">
      <p className="text-sm font-medium text-gray-800 leading-tight truncate">{f.name}</p>
      <p className="text-[11px] text-gray-400 mt-0.5">
        {f.contribution.toFixed(1)}% contribution &middot; {f.weight_pct.toFixed(1)}% weight
      </p>
    </div>
  </motion.div>
);

export const FactorBreakdown: React.FC<FactorBreakdownProps> = ({ factors }) => {
  const sorted = [...factors].sort((a, b) => b.contribution - a.contribution);
  const top3 = sorted.slice(0, 3);
  const bottom3 = sorted.slice(-3).reverse();

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white rounded-2xl shadow-soft p-5"
      >
        <div className="flex items-center gap-2 mb-4">
          <TrendingUp className="w-4 h-4 text-green-600" />
          <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider">Top Strengths</h3>
        </div>
        <div className="flex flex-col gap-2">
          {top3.map((f, i) => (
            <FactorCard key={f.id} f={f} rank={i} />
          ))}
        </div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="bg-white rounded-2xl shadow-soft p-5"
      >
        <div className="flex items-center gap-2 mb-4">
          <TrendingDown className="w-4 h-4 text-red-500" />
          <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider">Areas to Improve</h3>
        </div>
        <div className="flex flex-col gap-2">
          {bottom3.map((f, i) => (
            <FactorCard key={f.id} f={f} rank={i + 3} />
          ))}
        </div>
      </motion.div>
    </div>
  );
};
