/**
 * FitSnap - AppLayout Component
 * Wraps all authenticated pages with the responsive desktop sidebar, top bar, and mobile navigation.
 */

import React from 'react';
import { Sidebar } from './Sidebar';
import { TopBar } from './TopBar';
import { BottomNav } from '../ui/BottomNav';

interface AppLayoutProps {
  children: React.ReactNode;
}

export const AppLayout: React.FC<AppLayoutProps> = ({ children }) => {
  return (
    <div className="min-h-screen flex bg-[#F7F8FA] dark:bg-[#0B0D12] text-[#0F172A] dark:text-white antialiased">
      {/* Desktop Left Sidebar */}
      <Sidebar />

      {/* Main Content Viewport */}
      <div className="flex-1 min-w-0 flex flex-col min-h-screen">
        {/* Top Sticky Bar with Date Switcher and Profile Dropdown */}
        <TopBar />

        {/* Page Content Container */}
        <main className="flex-1 w-full max-w-[1200px] mx-auto p-4 sm:p-6 lg:p-8 pb-24 lg:pb-8">
          {children}
        </main>

        {/* Mobile Persistent Bottom Tab Bar */}
        <BottomNav />
      </div>
    </div>
  );
};

export default AppLayout;
