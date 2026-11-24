/**
 * FitSnap - Top Navigation Bar
 * Features interactive date switcher, quick-add water action, theme switcher, and profile dropdown.
 */

import React, { useState, useRef, useEffect } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import {
  ChevronLeft,
  ChevronRight,
  Droplets,
  Sun,
  Moon,
  LogOut,
  User,
  Settings,
  Calendar,
  Sparkles,
} from 'lucide-react';
import { useDateStore } from '../../store/dateStore';
import { useSettingsStore } from '../../store/settingsStore';
import { useAuthStore } from '../../store/authStore';
import { post } from '../../api/client';
import { toast } from '../ui/Toast';

export const TopBar: React.FC = () => {
  const navigate = useNavigate();
  const { selectedDate, isToday, goToPreviousDay, goToNextDay, goToToday } = useDateStore();
  const { darkMode, toggleDarkMode } = useSettingsStore();
  const { user, logout } = useAuthStore();

  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Quick 250ml Water Log
  const handleQuickWater = async () => {
    try {
      await post('/water', { amountMl: 250, source: 'quick' });
      toast.success('+250ml water logged! Stay hydrated 💧');
      // Trigger a soft event so dashboard updates
      window.dispatchEvent(new Event('fitsnap-water-logged'));
    } catch {
      toast.error('Failed to log water');
    }
  };

  // Format date display
  const formatDateDisplay = () => {
    if (isToday) return 'Today';
    const d = new Date(selectedDate);
    return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  };

  const fullDateSubtitle = () => {
    const d = new Date(selectedDate);
    return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  };

  const userName = user?.profile?.name || user?.email?.split('@')[0] || 'Athlete';
  const userInitials = userName
    .split(' ')
    .map((n: string) => n[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  return (
    <header className="sticky top-0 z-30 w-full bg-white/90 dark:bg-[#12151D]/90 backdrop-blur-md border-b border-[#0F172A]/[0.08] dark:border-white/10 px-4 sm:px-6 h-16 flex items-center justify-between">
      
      {/* Left: Date Switcher */}
      <div className="flex items-center gap-2">
        <div className="flex items-center rounded-xl bg-[#F7F8FA] dark:bg-white/5 border border-[#0F172A]/[0.08] dark:border-white/10 p-1 shadow-subtle">
          <button
            onClick={goToPreviousDay}
            className="p-1.5 rounded-lg text-[#475569] dark:text-[#94A3B8] hover:text-[#0F172A] dark:hover:text-white hover:bg-white dark:hover:bg-white/10 transition-colors"
            title="Previous Day"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>

          <div className="px-3 text-center min-w-[130px] sm:min-w-[160px]">
            <span className="text-xs sm:text-sm font-bold text-[#0F172A] dark:text-white block leading-tight">
              {formatDateDisplay()}
            </span>
            <span className="text-[10px] text-[#94A3B8] block leading-tight">
              {fullDateSubtitle()}
            </span>
          </div>

          <button
            onClick={goToNextDay}
            className="p-1.5 rounded-lg text-[#475569] dark:text-[#94A3B8] hover:text-[#0F172A] dark:hover:text-white hover:bg-white dark:hover:bg-white/10 transition-colors"
            title="Next Day"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        {!isToday && (
          <button
            onClick={goToToday}
            className="hidden sm:inline-flex px-2.5 py-1.5 rounded-lg text-xs font-semibold text-[#2F5BFF] bg-[#2F5BFF]/10 hover:bg-[#2F5BFF]/20 transition-colors"
          >
            Today
          </button>
        )}
      </div>

      {/* Right Controls */}
      <div className="flex items-center gap-2.5 sm:gap-3">
        
        {/* Quick Water Button */}
        <button
          onClick={handleQuickWater}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold text-[#0284C7] bg-[#0284C7]/10 hover:bg-[#0284C7]/20 transition-colors border border-[#0284C7]/20"
          title="Quick log 250ml water"
        >
          <Droplets className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">+250ml</span>
        </button>

        {/* Theme Toggle */}
        <button
          onClick={toggleDarkMode}
          className="p-2 rounded-xl text-[#475569] dark:text-[#94A3B8] hover:text-[#0F172A] dark:hover:text-white hover:bg-[#F7F8FA] dark:hover:bg-white/5 transition-colors border border-transparent hover:border-[#0F172A]/[0.08]"
          aria-label="Toggle dark mode"
        >
          {darkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
        </button>

        {/* User Avatar Menu Dropdown */}
        <div className="relative" ref={menuRef}>
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            className="flex items-center gap-2 p-1 rounded-full hover:ring-2 hover:ring-[#2F5BFF]/20 transition-all"
            aria-label="User menu"
          >
            <div className="w-8 h-8 rounded-full bg-[#2F5BFF] text-white flex items-center justify-center font-bold text-xs shadow-subtle">
              {userInitials}
            </div>
          </button>

          {menuOpen && (
            <div className="absolute right-0 mt-2 w-56 rounded-card bg-white dark:bg-[#12151D] border border-[#0F172A]/[0.08] dark:border-white/10 shadow-lifted py-2 z-50 animate-in fade-in zoom-in-95 duration-150">
              <div className="px-4 py-2 border-b border-[#0F172A]/[0.06] dark:border-white/10">
                <span className="text-xs font-bold text-[#0F172A] dark:text-white block truncate">
                  {userName}
                </span>
                <span className="text-[11px] text-[#94A3B8] block truncate">
                  {user?.email || 'demo@fitsnap.app'}
                </span>
              </div>

              <div className="py-1">
                <button
                  onClick={() => { setMenuOpen(false); navigate('/profile'); }}
                  className="w-full text-left px-4 py-2 text-xs font-medium text-[#475569] dark:text-[#94A3B8] hover:bg-[#F7F8FA] dark:hover:bg-white/5 hover:text-[#0F172A] dark:hover:text-white flex items-center gap-2.5"
                >
                  <User className="w-4 h-4 text-[#94A3B8]" />
                  <span>Profile &amp; Goals</span>
                </button>

                <button
                  onClick={() => { setMenuOpen(false); navigate('/insights'); }}
                  className="w-full text-left px-4 py-2 text-xs font-medium text-[#475569] dark:text-[#94A3B8] hover:bg-[#F7F8FA] dark:hover:bg-white/5 hover:text-[#0F172A] dark:hover:text-white flex items-center gap-2.5"
                >
                  <Sparkles className="w-4 h-4 text-[#2F5BFF]" />
                  <span>AI Coach Advice</span>
                </button>

                <button
                  onClick={() => { setMenuOpen(false); navigate('/history'); }}
                  className="w-full text-left px-4 py-2 text-xs font-medium text-[#475569] dark:text-[#94A3B8] hover:bg-[#F7F8FA] dark:hover:bg-white/5 hover:text-[#0F172A] dark:hover:text-white flex items-center gap-2.5"
                >
                  <Calendar className="w-4 h-4 text-[#94A3B8]" />
                  <span>30-Day Trends</span>
                </button>
              </div>

              <div className="pt-1 border-t border-[#0F172A]/[0.06] dark:border-white/10">
                <button
                  onClick={() => {
                    setMenuOpen(false);
                    logout();
                    toast.success('Logged out successfully.');
                    navigate('/login');
                  }}
                  className="w-full text-left px-4 py-2 text-xs font-medium text-[#DC2626] hover:bg-[#DC2626]/10 flex items-center gap-2.5"
                >
                  <LogOut className="w-4 h-4" />
                  <span>Log out</span>
                </button>
              </div>
            </div>
          )}
        </div>

      </div>

    </header>
  );
};
