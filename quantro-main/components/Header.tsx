import React from 'react';
import { Search, Bell, ChevronDown } from 'lucide-react';
import { motion } from 'framer-motion';
import { QuantroLogo } from './icons/QuantroLogo';
import { TabOption } from '../types';

interface HeaderProps {
  activeTab: TabOption;
  onTabChange: (tab: TabOption) => void;
}

export const Header: React.FC<HeaderProps> = ({ activeTab, onTabChange }) => {
  return (
    <header className="flex flex-col md:flex-row items-center justify-between w-full py-4 px-6 gap-4 md:gap-0">
      <div className="flex items-center gap-2">
        <QuantroLogo className="text-textPrimary w-6 h-6" />
        <span className="font-semibold text-lg tracking-tight">FWCLT Scorer</span>
      </div>

      <div className="flex w-full md:w-auto max-w-xl md:max-w-none justify-center md:justify-center shrink-0">
        <div className="inline-flex bg-white p-1 rounded-xl shadow-sm border border-gray-100/50 overflow-x-auto max-w-full">
          <div className="flex shrink-0">
            {Object.values(TabOption).map((tab) => (
              <button
                key={tab}
                type="button"
                onClick={() => onTabChange(tab)}
                className="relative px-4 sm:px-5 py-1.5 text-sm font-medium rounded-lg transition-colors z-10 whitespace-nowrap"
              >
                {activeTab === tab && (
                  <motion.div
                    layoutId="activeTab"
                    className="absolute inset-0 bg-black rounded-lg"
                    initial={false}
                    transition={{ type: 'spring', stiffness: 300, damping: 30 }}
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

      <div className="flex items-center gap-4">
        <div className="relative group">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4 group-focus-within:text-gray-600" />
          <input
            type="text"
            placeholder="Search Dashboard"
            className="pl-9 pr-4 py-2 bg-white rounded-lg text-sm text-gray-700 w-64 shadow-sm border border-transparent focus:border-gray-200 focus:outline-none transition-all placeholder:text-gray-300"
          />
        </div>

        <button type="button" className="p-2 bg-white rounded-lg shadow-sm text-gray-600 hover:text-gray-900 transition-colors">
          <Bell className="w-4 h-4" />
        </button>

        <div className="flex items-center gap-3 pl-2 border-l border-gray-200/50">
          <div className="relative">
             <img src="https://picsum.photos/64/64" alt="" className="w-9 h-9 rounded-full object-cover border-2 border-white shadow-sm" />
             <div className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-green-500 border-2 border-white rounded-full"></div>
          </div>
          <div className="hidden sm:flex flex-col text-xs">
            <span className="font-semibold text-gray-900">Tuki Joshua</span>
            <span className="text-gray-400">Manager</span>
          </div>
          <button type="button" className="p-1 hover:bg-gray-100 rounded-md transition-colors">
            <ChevronDown className="w-3 h-3 text-gray-400" />
          </button>
        </div>
      </div>
    </header>
  );
};
