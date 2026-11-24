/**
 * FitSnap - TabBar UI Component
 * Horizontal scrolling glassmorphism pill tabs.
 */

import React from 'react';
import { motion } from 'framer-motion';

export interface TabItem {
  id: string;
  label: string;
  badge?: number | string;
}

interface TabBarProps {
  tabs: TabItem[];
  activeTab: string;
  onChange: (id: string) => void;
  className?: string;
}

export const TabBar: React.FC<TabBarProps> = ({
  tabs,
  activeTab,
  onChange,
  className = '',
}) => {
  return (
    <div className={`flex items-center space-x-2 overflow-x-auto no-scrollbar py-1 ${className}`}>
      {tabs.map((tab) => {
        const isActive = activeTab === tab.id;
        return (
          <button
            key={tab.id}
            onClick={() => onChange(tab.id)}
            className={`relative flex items-center gap-1.5 px-4 py-2 rounded-2xl text-xs font-semibold whitespace-nowrap transition-all duration-200 select-none ${
              isActive
                ? 'text-white'
                : 'text-slate-400 hover:text-white bg-white/[0.04] hover:bg-white/[0.08]'
            }`}
          >
            {isActive && (
              <motion.div
                layoutId="activeTabBarIndicator"
                className="absolute inset-0 bg-brand-500/30 border border-brand-400/40 rounded-2xl shadow-glow"
                transition={{ type: 'spring', stiffness: 400, damping: 30 }}
              />
            )}
            <span className="relative z-10">{tab.label}</span>
            {tab.badge !== undefined && (
              <span className={`relative z-10 text-[10px] px-1.5 py-0.5 rounded-full ${
                isActive ? 'bg-brand-500 text-white' : 'bg-white/10 text-slate-300'
              }`}>
                {tab.badge}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
};

export default TabBar;
