import React from 'react';
import { IncomeChart } from './charts/IncomeChart';
import { DeviceTrafficChart } from './charts/DeviceTrafficChart';
import { UserGrowthChart } from './charts/UserGrowthChart';

export const DashboardCharts: React.FC = () => {
  return (
    <div className="mb-8 space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <IncomeChart />
        <DeviceTrafficChart />
      </div>
      <UserGrowthChart />
    </div>
  );
};
