import React from 'react';
import { IncomeChart } from './charts/IncomeChart';
import { DeviceTrafficChart } from './charts/DeviceTrafficChart';
import { UserGrowthChart } from './charts/UserGrowthChart';
import type { ScoreResponse } from '../types';

interface DashboardChartsProps {
  scoreData: ScoreResponse | null;
}

export const DashboardCharts: React.FC<DashboardChartsProps> = ({ scoreData }) => {
  if (!scoreData) {
    return (
      <div className="mb-8 flex flex-col items-center justify-center h-[200px] bg-white rounded-3xl shadow-soft text-gray-400">
        <svg className="w-10 h-10 mb-3 text-gray-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
        <p className="text-sm font-medium">No property scored</p>
        <p className="text-xs text-gray-300 mt-1">Score a property first to see charts</p>
      </div>
    );
  }

  const factors = scoreData.factors;
  const compositeScore = scoreData.composite_score;

  return (
    <div className="mb-8 space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <IncomeChart factors={factors} />
        <DeviceTrafficChart factors={factors} compositeScore={compositeScore} />
      </div>
      <UserGrowthChart factors={factors} />
    </div>
  );
};
