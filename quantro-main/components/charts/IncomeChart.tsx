import React from 'react';
import { motion } from 'framer-motion';
import type { FactorResult } from '../../types';

interface IncomeChartProps {
  factors: FactorResult[] | null;
}

export const IncomeChart: React.FC<IncomeChartProps> = ({ factors }) => {
    let bars: { height: number; isHighlight: boolean; label: string; contribution: number }[];

    if (factors && factors.length > 0) {
        const topFactor = factors.reduce((a: FactorResult, b: FactorResult) => (b.contribution > a.contribution ? b : a));
        bars = factors.map((f: FactorResult) => ({
            height: (f.score_0_20 / 20) * 100,
            isHighlight: f.id === topFactor.id,
            label: f.name,
            contribution: f.contribution,
        }));
    } else {
        bars = Array.from({ length: 13 }).map((_, i) => ({
            height: 40,
            isHighlight: i === 3,
            label: '',
            contribution: 0,
        }));
    }

    const tooltipCn =
        'absolute bottom-full left-1/2 z-50 mb-2 max-w-[min(240px,calc(100vw-48px))] w-max -translate-x-1/2 rounded-md bg-gray-900 px-2 py-1.5 text-left text-[9px] font-medium leading-snug text-white shadow-lg opacity-0 transition-opacity duration-150 pointer-events-none [overflow-wrap:anywhere] break-words group-hover:opacity-100 sm:max-w-xs';

    const highlightPersistentCn =
        'absolute bottom-full left-1/2 z-40 mb-2 max-w-[min(200px,calc(100vw-48px))] w-max -translate-x-1/2 whitespace-nowrap rounded-md bg-black px-2 py-1 text-center text-[10px] font-medium leading-tight text-white shadow-lg transition-opacity duration-150 group-hover:opacity-0 sm:max-w-xs';

    return (
        <div className="relative flex h-[260px] flex-col justify-between overflow-visible rounded-3xl bg-white p-6 shadow-soft">
            <div className="mb-6 flex flex-shrink-0 items-center justify-between">
                <h3 className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Factor Scores</h3>
                <div className="flex gap-2">
                    <button type="button" className="rounded-md p-1.5 text-gray-400 transition-colors hover:bg-gray-100"><span className="-mt-2 block text-lg leading-none">...</span></button>
                    <button type="button" className="rounded-md p-1.5 text-gray-400 transition-colors hover:bg-gray-100">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="7" y1="17" x2="17" y2="7"></line><polyline points="7 7 17 7 17 17"></polyline></svg>
                    </button>
                </div>
            </div>

            <div className="relative flex min-h-0 flex-1 items-end justify-between gap-[3px] overflow-visible">
                {bars.map((bar, i) => {
                    const pct = Math.max(bar.height, 1);
                    return (
                        <div key={i} className="group relative flex h-full min-w-0 flex-1 flex-col justify-end">
                            <div className="relative w-full overflow-visible" style={{ height: `${pct}%`, minHeight: 4 }}>
                                <motion.div
                                    initial={{ height: 0 }}
                                    animate={{ height: '100%' }}
                                    transition={{ duration: 0.5, delay: i * 0.04 }}
                                    className={`absolute bottom-0 left-0 right-0 rounded-md transition-colors duration-300 ${
                                        bar.isHighlight ? 'bg-black' : 'bg-gray-300 group-hover:bg-gray-400'
                                    }`}
                                />

                                {bar.isHighlight && bar.label && (
                                    <motion.div
                                        initial={{ opacity: 0, y: 10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        transition={{ delay: 0.8 }}
                                        className={highlightPersistentCn}
                                    >
                                        {bar.contribution.toFixed(1)} pts
                                        <div className="absolute left-1/2 top-full -translate-x-1/2 border-4 border-transparent border-t-black"></div>
                                    </motion.div>
                                )}

                                {bar.label && (
                                    <div className={tooltipCn}>
                                        <span className="block">{bar.label}</span>
                                        <span className="mt-1 block border-t border-white/15 pt-1 text-[8px] font-normal text-white/90">
                                            {bar.contribution.toFixed(1)} pts contribution
                                        </span>
                                    </div>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};
