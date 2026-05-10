import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { X, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { listCached } from '../lib/cache';
import type { ScoreResponse } from '../types';

interface ComparePanelProps {
  current: ScoreResponse;
  onClose: () => void;
}

function fmt(v: number | null, prefix = '$'): string {
  if (v == null) return 'N/A';
  if (v >= 1_000_000) return `${prefix}${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `${prefix}${Math.round(v / 1_000)}k`;
  return `${prefix}${v}`;
}

function scoreColor(s: number) {
  if (s >= 75) return 'text-green-600';
  if (s >= 50) return 'text-amber-600';
  return 'text-red-500';
}

type Dir = 'left' | 'right' | 'tie';

function WinBadge({ dir, side }: { dir: Dir; side: 'left' | 'right' }) {
  if (dir === 'tie') return <Minus className="w-3 h-3 text-gray-300" />;
  const wins = dir === side;
  return wins
    ? <TrendingUp className="w-3 h-3 text-green-500" />
    : <TrendingDown className="w-3 h-3 text-red-400" />;
}

function cmp(a: number | null, b: number | null, lowerBetter = false): Dir {
  if (a == null || b == null) return 'tie';
  if (a === b) return 'tie';
  const leftWins = lowerBetter ? a < b : a > b;
  return leftWins ? 'left' : 'right';
}

function gradeNum(g: string): number {
  return { A: 4, B: 3, C: 2, D: 1 }[g] ?? 0;
}

interface MetricRowProps {
  label: string;
  left: string;
  right: string | null;
  dir: Dir;
}

const MetricRow: React.FC<MetricRowProps> = ({ label, left, right, dir }) => (
  <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 py-1.5 border-b border-gray-50 last:border-0">
    <div className="flex items-center justify-between gap-1">
      <span className={`text-xs font-medium ${dir === 'left' ? 'text-gray-900' : 'text-gray-500'}`}>{left}</span>
      <WinBadge dir={dir} side="left" />
    </div>
    <span className="text-[9px] text-gray-300 text-center w-20 shrink-0">{label}</span>
    <div className="flex items-center justify-between gap-1">
      <WinBadge dir={dir} side="right" />
      <span className={`text-xs font-medium text-right ${dir === 'right' ? 'text-gray-900' : 'text-gray-500'}`}>
        {right ?? '—'}
      </span>
    </div>
  </div>
);

export const ComparePanel: React.FC<ComparePanelProps> = ({ current, onClose }) => {
  const [history, setHistory] = useState<ScoreResponse[]>([]);
  const [selected, setSelected] = useState<ScoreResponse | null>(null);

  useEffect(() => {
    const all = listCached()
      .map(e => e.data)
      .filter(d => d.address !== current.address || d.tract_geoid !== current.tract_geoid);
    setHistory(all);
    if (all.length > 0) setSelected(all[0]);
  }, [current]);

  const L = current;
  const R = selected;

  const tierCounts = (d: ScoreResponse) => ({
    high: d.factors.filter(f => f.tier === 'High').length,
    baseline: d.factors.filter(f => f.tier === 'Baseline').length,
    low: d.factors.filter(f => f.tier === 'Low').length,
  });

  const lTiers = tierCounts(L);
  const rTiers = R ? tierCounts(R) : null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 12 }}
      className="bg-white rounded-2xl shadow-soft mb-6 overflow-hidden"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
        <div>
          <h2 className="text-sm font-semibold text-gray-800">Property Comparison</h2>
          <p className="text-[11px] text-gray-400 mt-0.5">Side-by-side view of scored properties</p>
        </div>
        <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors text-gray-400">
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Property selector */}
      <div className="px-5 py-3 bg-gray-50 border-b border-gray-100 flex items-center gap-3">
        <span className="text-[11px] text-gray-500 shrink-0">Compare with:</span>
        {history.length === 0 ? (
          <span className="text-[11px] text-gray-400 italic">
            No other scored properties yet — score another property to compare.
          </span>
        ) : (
          <select
            className="flex-1 text-xs border border-gray-200 rounded-lg px-3 py-1.5 bg-white text-gray-700 focus:outline-none focus:ring-1 focus:ring-gray-300"
            value={selected?.address ?? ''}
            onChange={e => {
              const match = history.find(h => h.address === e.target.value);
              setSelected(match ?? null);
            }}
          >
            {history.map((h, i) => (
              <option key={i} value={h.address}>
                {h.address} — {Math.round(h.composite_score)}/100
              </option>
            ))}
          </select>
        )}
      </div>

      {/* Comparison grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-gray-100">
        {/* Column headers */}
        {[L, R].map((prop, col) => (
          <div key={col} className="p-5">
            {prop == null ? (
              <div className="flex items-center justify-center h-32 text-gray-300 text-sm">
                Select a property above
              </div>
            ) : (
              <>
                {/* Score */}
                <div className="mb-4">
                  <div className={`text-4xl font-bold tracking-tight ${scoreColor(prop.composite_score)}`}>
                    {Math.round(prop.composite_score)}
                    <span className="text-lg text-gray-300 font-normal ml-1">/ 100</span>
                  </div>
                  <div className="text-xs text-gray-500 mt-1">
                    Grade {prop.letter_grade} · {prop.opportunity_label}
                  </div>
                  <div className="text-[11px] text-gray-400 mt-0.5 truncate">{prop.address}</div>
                  <div className="text-[10px] text-gray-300">Tract {prop.tract_geoid}</div>
                  <span className={`inline-block mt-1.5 px-2 py-0.5 text-[10px] font-bold rounded-md ${
                    prop.pass_fail ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'
                  }`}>
                    {prop.pass_fail ? 'PASS' : 'FAIL'}
                  </span>
                </div>

                {/* Factor tiers */}
                <div className="mb-4">
                  <p className="text-[9px] font-bold text-gray-400 uppercase tracking-wider mb-2">Factor Tiers</p>
                  <div className="flex gap-3 text-xs">
                    <span className="flex items-center gap-1 text-green-600 font-medium">
                      <span className="w-2 h-2 rounded-full bg-green-400" />
                      High: {prop.factors.filter(f => f.tier === 'High').length}
                    </span>
                    <span className="flex items-center gap-1 text-amber-600 font-medium">
                      <span className="w-2 h-2 rounded-full bg-amber-400" />
                      Baseline: {prop.factors.filter(f => f.tier === 'Baseline').length}
                    </span>
                    <span className="flex items-center gap-1 text-red-500 font-medium">
                      <span className="w-2 h-2 rounded-full bg-red-400" />
                      Low: {prop.factors.filter(f => f.tier === 'Low').length}
                    </span>
                  </div>
                </div>

                {/* Top factors */}
                <div>
                  <p className="text-[9px] font-bold text-gray-400 uppercase tracking-wider mb-2">Top Strengths</p>
                  {[...prop.factors]
                    .sort((a, b) => b.contribution - a.contribution)
                    .slice(0, 3)
                    .map(f => (
                      <div key={f.id} className="flex items-center gap-2 mb-1">
                        <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${
                          f.tier === 'High' ? 'bg-green-100 text-green-700'
                          : f.tier === 'Baseline' ? 'bg-amber-100 text-amber-700'
                          : 'bg-red-100 text-red-600'
                        }`}>{f.tier}</span>
                        <span className="text-[11px] text-gray-600 truncate">{f.name}</span>
                      </div>
                    ))}
                </div>
              </>
            )}
          </div>
        ))}
      </div>

      {/* Head-to-head metric rows — only when both properties loaded */}
      {R && (
        <div className="px-5 py-4 border-t border-gray-100">
          <p className="text-[9px] font-bold text-gray-400 uppercase tracking-wider mb-3">Head-to-Head</p>
          <MetricRow
            label="Composite Score"
            left={`${Math.round(L.composite_score)}/100`}
            right={`${Math.round(R.composite_score)}/100`}
            dir={cmp(L.composite_score, R.composite_score)}
          />
          <MetricRow
            label="Grade"
            left={`Grade ${L.letter_grade}`}
            right={`Grade ${R.letter_grade}`}
            dir={cmp(gradeNum(L.letter_grade), gradeNum(R.letter_grade))}
          />
          <MetricRow
            label="High-tier Factors"
            left={`${lTiers.high} of 13`}
            right={rTiers ? `${rTiers.high} of 13` : null}
            dir={cmp(lTiers.high, rTiers?.high ?? null)}
          />
          <MetricRow
            label="Low-tier Factors"
            left={`${lTiers.low} of 13`}
            right={rTiers ? `${rTiers.low} of 13` : null}
            dir={cmp(lTiers.low, rTiers?.low ?? null, true)}
          />
          <MetricRow
            label="Median Home Value"
            left={fmt(L.tract_data?.['median_home_value'] ?? null)}
            right={fmt(R.tract_data?.['median_home_value'] ?? null)}
            dir={cmp(
              L.tract_data?.['median_home_value'] ?? null,
              R.tract_data?.['median_home_value'] ?? null,
              true,
            )}
          />
          <MetricRow
            label="Median Income"
            left={fmt(L.tract_data?.['median_income'] ?? null)}
            right={fmt(R.tract_data?.['median_income'] ?? null)}
            dir={cmp(L.tract_data?.['median_income'] ?? null, R.tract_data?.['median_income'] ?? null)}
          />
          <MetricRow
            label="Poverty Rate"
            left={L.tract_data?.['poverty_pct'] != null ? `${Number(L.tract_data['poverty_pct']).toFixed(1)}%` : 'N/A'}
            right={R.tract_data?.['poverty_pct'] != null ? `${Number(R.tract_data['poverty_pct']).toFixed(1)}%` : 'N/A'}
            dir={cmp(
              L.tract_data?.['poverty_pct'] ?? null,
              R.tract_data?.['poverty_pct'] ?? null,
              true,
            )}
          />
        </div>
      )}
    </motion.div>
  );
};
