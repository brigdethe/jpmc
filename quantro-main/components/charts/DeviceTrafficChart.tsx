import React from 'react';
import { motion } from 'framer-motion';
import type { FactorResult } from '../../types';

interface DeviceTrafficChartProps {
  factors: FactorResult[] | null;
  compositeScore: number | null;
}

export const DeviceTrafficChart: React.FC<DeviceTrafficChartProps> = ({ factors, compositeScore }) => {
    // SVG Geometry
    const radius = 80;
    const stroke = 18;
    const normalizedRadius = radius - stroke * 0.5;
    const circumference = normalizedRadius * 2 * Math.PI;
    const arcLength = circumference / 2;

    // Compute tier distribution from real factors, or fall back to static defaults
    const total = factors ? factors.length : 0;
    const highCount = factors ? factors.filter((f: FactorResult) => f.tier === 'High').length : 0;
    const baselineCount = factors ? factors.filter((f: FactorResult) => f.tier === 'Baseline').length : 0;
    const lowCount = factors ? factors.filter((f: FactorResult) => f.tier === 'Low').length : 0;

    const lowPct = total > 0 ? lowCount / total : 0.25;
    const highPct = total > 0 ? highCount / total : 0.45;

    // Low segment starts at left (0 deg rotation), high segment starts after low
    const lowDegrees = lowPct * 180;

    const centerText = compositeScore !== null ? Math.round(compositeScore).toString() : '—';
    const centerSub = compositeScore !== null ? '/ 100' : 'No data';

    return (
        <div className="bg-white p-6 rounded-3xl shadow-soft h-[260px] flex flex-col justify-between relative overflow-hidden">
            {/* Header */}
            <div className="flex justify-between items-center">
                <h3 className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Acquisition Score</h3>
                <div className="flex gap-2">
                    <button className="p-1.5 rounded-md hover:bg-gray-100 transition-colors text-gray-400"><span className="text-lg leading-none -mt-2 block">...</span></button>
                    <button className="p-1.5 rounded-md hover:bg-gray-100 transition-colors text-gray-400">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="7" y1="17" x2="17" y2="7"></line><polyline points="7 7 17 7 17 17"></polyline></svg>
                    </button>
                </div>
            </div>

            {/* Gauge */}
            <div className="flex-1 flex items-center justify-center relative mt-4">
                <div className="relative w-[220px] h-[110px] overflow-hidden">
                    <svg width="220" height="220" viewBox="0 0 220 220" className="rotate-[180deg]">
                        {/* Track Background (Baseline tier) */}
                        <circle
                            cx="110"
                            cy="110"
                            r={normalizedRadius}
                            fill="transparent"
                            stroke="#E5E7EB"
                            strokeWidth={stroke}
                            strokeLinecap="round"
                            style={{ strokeDasharray: circumference, strokeDashoffset: circumference * 0.5 }}
                            className="opacity-50"
                        />

                        {/* Low Tier Segment (Black) */}
                        <motion.circle
                            initial={{ strokeDashoffset: circumference }}
                            animate={{ strokeDashoffset: circumference - (arcLength * lowPct) }}
                            transition={{ duration: 1, ease: "easeOut" }}
                            cx="110"
                            cy="110"
                            r={normalizedRadius}
                            fill="transparent"
                            stroke="#000000"
                            strokeWidth={stroke}
                            strokeLinecap="round"
                            style={{ strokeDasharray: circumference }}
                            transform="rotate(0, 110, 110)"
                        />

                        {/* High Tier Segment (Green) — starts after the Low segment */}
                        <motion.circle
                            initial={{ strokeDashoffset: circumference }}
                            animate={{ strokeDashoffset: circumference - (arcLength * highPct) }}
                            transition={{ duration: 1.2, delay: 0.2, ease: "easeOut" }}
                            cx="110"
                            cy="110"
                            r={normalizedRadius}
                            fill="transparent"
                            stroke="#4ADE80"
                            strokeWidth={stroke}
                            strokeLinecap="round"
                            style={{ strokeDasharray: circumference }}
                            transform={`rotate(${lowDegrees}, 110, 110)`}
                        />
                    </svg>

                    {/* Center text */}
                    <div className="absolute bottom-0 left-0 w-full text-center pb-2">
                        <div className="text-3xl font-bold text-gray-900">{centerText}</div>
                        <div className="text-xs text-gray-400 font-medium">{centerSub}</div>
                    </div>
                </div>
            </div>

            {/* Legend */}
            <div className="flex justify-center gap-4 text-[10px] font-medium text-gray-500 mt-2">
                <div className="flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-gray-300"></span>
                    Baseline ({baselineCount})
                </div>
                <div className="flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-green-400"></span>
                    High ({highCount})
                </div>
                <div className="flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-black"></span>
                    Low ({lowCount})
                </div>
            </div>
        </div>
    );
}
