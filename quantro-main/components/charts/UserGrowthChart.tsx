import React, { useMemo } from 'react';
import { motion } from 'framer-motion';
import type { FactorResult } from '../../types';

interface UserGrowthChartProps {
  factors: FactorResult[] | null;
}

const TOTAL_BARS = 65;

export const UserGrowthChart: React.FC<UserGrowthChartProps> = ({ factors }) => {
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug'];

  const { bars, lowPct, highPct, baselinePct, highStartFraction } = useMemo(() => {
    if (!factors || factors.length === 0) {
      // Static placeholder identical to original design
      const staticBars: { height: number; type: string; delay: number }[] = [];
      for (let i = 0; i < 25; i++) staticBars.push({ height: 20 + Math.random() * 40, type: 'low', delay: i * 0.01 });
      for (let i = 0; i < 20; i++) staticBars.push({ height: 40 + Math.random() * 50, type: 'high', delay: 0.25 + i * 0.01 });
      for (let i = 0; i < 20; i++) staticBars.push({ height: 15 + Math.random() * 30, type: 'baseline', delay: 0.45 + i * 0.01 });
      return { bars: staticBars, lowPct: 52, highPct: 18, baselinePct: 30, highStartFraction: 0.38 };
    }

    const total = factors.length;
    const lowFactors = factors.filter((f: FactorResult) => f.tier === 'Low');
    const highFactors = factors.filter((f: FactorResult) => f.tier === 'High');
    const baselineFactors = factors.filter((f: FactorResult) => f.tier === 'Baseline');

    const lowBarsCount = Math.round((lowFactors.length / total) * TOTAL_BARS);
    const highBarsCount = Math.round((highFactors.length / total) * TOTAL_BARS);
    const baselineBarsCount = TOTAL_BARS - lowBarsCount - highBarsCount;

    const makeBars = (
      source: FactorResult[],
      count: number,
      type: string,
      startDelay: number,
      heightBase: number,
      heightRange: number,
    ) => {
      return Array.from({ length: count }).map((_, i) => {
        const factor = source[i % source.length];
        const h = source.length > 0 ? (factor.score_0_20 / 20) * 80 + heightBase * 0.2 : heightBase + Math.random() * heightRange;
        return { height: Math.max(10, Math.min(95, h)), type, delay: startDelay + i * 0.01 };
      });
    };

    const result = [
      ...makeBars(lowFactors, lowBarsCount, 'low', 0, 20, 40),
      ...makeBars(highFactors, highBarsCount, 'high', 0.25, 40, 50),
      ...makeBars(baselineFactors, baselineBarsCount, 'baseline', 0.45, 15, 30),
    ];

    const lPct = Math.round((lowFactors.length / total) * 100);
    const hPct = Math.round((highFactors.length / total) * 100);
    const bPct = 100 - lPct - hPct;
    const hStart = lowBarsCount / TOTAL_BARS;

    return { bars: result, lowPct: lPct, highPct: hPct, baselinePct: bPct, highStartFraction: hStart };
  }, [factors]);

  const getColor = (type: string) => {
    switch (type) {
      case 'low': return '#1F2937';
      case 'high': return '#4ADE80';
      default: return '#D1D5DB';
    }
  };

  const highWidthPct = `${Math.round((highPct / 100) * 27)}%`;

  return (
    <div className="w-full bg-white p-6 pb-2 rounded-3xl shadow-soft relative overflow-hidden">
      {/* Labels Overlay */}
      <div className="absolute top-6 left-6 text-[10px] text-gray-500 leading-tight">
        Low tier<br />
        <span className="font-semibold text-gray-900">{lowPct}%</span>
      </div>
      <div className="absolute top-32 text-[10px] text-green-500 leading-tight" style={{ left: `${highStartFraction * 100 + 2}%` }}>
        High tier<br />
        <span className="font-semibold">{highPct}%</span>
      </div>
      <div className="absolute top-32 text-[10px] text-gray-400 leading-tight" style={{ left: '68%' }}>
        Baseline<br />
        <span className="font-semibold text-gray-500">{baselinePct}%</span>
      </div>

      <div className="h-[200px] w-full flex items-end justify-between gap-[2px] pt-12 relative z-10">
        {bars.map((d: { height: number; type: string; delay: number }, i: number) => (
          <motion.div
            key={i}
            initial={{ height: 0 }}
            animate={{ height: `${d.height}%` }}
            transition={{ duration: 0.5, delay: d.delay, ease: 'easeOut' }}
            className="w-[3px] rounded-t-full hover:opacity-80 transition-opacity cursor-pointer"
            style={{ backgroundColor: getColor(d.type) }}
          />
        ))}
      </div>

      {/* Green glow strip under High tier zone */}
      <div
        className="absolute bottom-10 h-6 bg-green-400 opacity-90 blur-[1px]"
        style={{ left: `${highStartFraction * 100}%`, width: highWidthPct }}
      />

      {/* X Axis */}
      <div className="flex justify-between mt-6 border-t border-transparent pt-2 text-[10px] text-gray-400 font-medium px-2">
        {months.map(m => <span key={m}>{m}</span>)}
      </div>

      <div className="absolute bottom-10 left-0 right-0 h-10 bg-gradient-to-t from-gray-50/50 to-transparent pointer-events-none" />
    </div>
  );
};
