import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, ChevronUp } from 'lucide-react';
import type { FactorResult } from '../types';

interface FactorTableProps {
  factors: FactorResult[];
}

function tierDot(tier: string) {
  if (tier === 'High') return 'bg-green-500';
  if (tier === 'Baseline') return 'bg-yellow-500';
  return 'bg-red-500';
}

function confidenceBadge(c: string) {
  const map: Record<string, string> = {
    high: 'text-green-600',
    medium: 'text-yellow-600',
    low: 'text-red-500',
  };
  return map[c] || 'text-gray-400';
}

export const FactorTable: React.FC<FactorTableProps> = ({ factors }) => {
  const [expanded, setExpanded] = useState(false);

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white rounded-2xl shadow-soft overflow-hidden mb-6"
    >
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-5 py-4 hover:bg-gray-50 transition-colors"
      >
        <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider">
          All 13 Acquisition Factors
        </h3>
        {expanded ? (
          <ChevronUp className="w-4 h-4 text-gray-400" />
        ) : (
          <ChevronDown className="w-4 h-4 text-gray-400" />
        )}
      </button>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-t border-gray-100">
                    <th className="text-left px-5 py-3 text-[10px] font-bold text-gray-400 uppercase tracking-wider">#</th>
                    <th className="text-left px-5 py-3 text-[10px] font-bold text-gray-400 uppercase tracking-wider">Factor</th>
                    <th className="text-center px-3 py-3 text-[10px] font-bold text-gray-400 uppercase tracking-wider">Tier</th>
                    <th className="text-right px-3 py-3 text-[10px] font-bold text-gray-400 uppercase tracking-wider">Weight</th>
                    <th className="text-right px-3 py-3 text-[10px] font-bold text-gray-400 uppercase tracking-wider">Score</th>
                    <th className="text-right px-3 py-3 text-[10px] font-bold text-gray-400 uppercase tracking-wider">Contrib.</th>
                    <th className="text-center px-3 py-3 text-[10px] font-bold text-gray-400 uppercase tracking-wider">Confidence</th>
                  </tr>
                </thead>
                <tbody>
                  {factors.map((f) => (
                    <tr key={f.id} className="border-t border-gray-50 hover:bg-gray-50 transition-colors">
                      <td className="px-5 py-3 text-gray-400 font-mono text-xs">{f.id}</td>
                      <td className="px-5 py-3 text-gray-800 font-medium text-xs max-w-xs">
                        <p className="truncate">{f.name}</p>
                      </td>
                      <td className="px-3 py-3 text-center">
                        <span className="inline-flex items-center gap-1.5">
                          <span className={`w-2 h-2 rounded-full ${tierDot(f.tier)}`} />
                          <span className="text-xs text-gray-600">{f.tier}</span>
                        </span>
                      </td>
                      <td className="px-3 py-3 text-right text-xs text-gray-500">{f.weight_pct.toFixed(1)}%</td>
                      <td className="px-3 py-3 text-right text-xs text-gray-700 font-medium">{f.score_0_20}/20</td>
                      <td className="px-3 py-3 text-right text-xs font-semibold text-gray-800">{f.contribution.toFixed(1)}%</td>
                      <td className={`px-3 py-3 text-center text-[10px] font-bold uppercase ${confidenceBadge(f.confidence)}`}>
                        {f.confidence}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};
