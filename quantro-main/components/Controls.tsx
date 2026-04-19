import React from 'react';
import { TabOption } from '../types';
import { motion } from 'framer-motion';

interface ControlsProps {
  activeTab: TabOption;
  onTabChange: (tab: TabOption) => void;
}

export const Controls: React.FC<ControlsProps> = ({ activeTab, onTabChange }) => {
  return (
    <div className="flex flex-col gap-6 mb-8">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="flex items-baseline gap-3">
          <h1 className="text-2xl font-medium text-textPrimary">Acquisition Scorer</h1>
          <div className="flex items-center gap-2 text-xs text-textTertiary">
            <span className="w-2 h-2 bg-green-400 rounded-full"></span>
            <span>FWCLT</span>
            <span className="text-gray-300">/</span>
            <span className="font-medium text-gray-500">Fort Worth, TX</span>
          </div>
        </div>

        <div className="flex bg-white p-1 rounded-xl shadow-sm">
          {Object.values(TabOption).map((tab) => (
            <button
              key={tab}
              onClick={() => onTabChange(tab)}
              className="relative px-5 py-1.5 text-sm font-medium rounded-lg transition-colors z-10"
            >
              {activeTab === tab && (
                <motion.div
                  layoutId="activeTab"
                  className="absolute inset-0 bg-black rounded-lg"
                  initial={false}
                  transition={{ type: "spring", stiffness: 300, damping: 30 }}
                />
              )}
              <span className={`relative z-20 ${activeTab === tab ? 'text-white' : 'text-gray-500 hover:text-gray-700'}`}>
                {tab}
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};
