/**
 * FitSnap - Desktop Sidebar Navigation
 * Premium health-tech desktop navigation (Whoop / Linear / Stripe level).
 * Lucide line icons (stroke 1.5), active indicator pill, quick snap CTA, and user profile card.
 */

import React from 'react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  UtensilsCrossed,
  Droplets,
  Calendar,
  Sparkles,
  User,
  Scan,
  Plus,
  LogOut,
  Flame,
  Dumbbell,
  Settings as SettingsIcon,
} from 'lucide-react';
import { useAuthStore } from '../../store/authStore';
import { toast } from '../ui/Toast';

export const Sidebar: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuthStore();

  const handleLogout = () => {
    logout();
    toast.success('Logged out successfully.');
    navigate('/login');
  };

  const navItems = [
    {
      path: '/dashboard',
      label: 'Dashboard',
      icon: LayoutDashboard,
    },
    {
      path: '/food',
      label: 'Food Diary',
      icon: UtensilsCrossed,
    },
    {
      path: '/water',
      label: 'Hydration',
      icon: Droplets,
    },
    {
      path: '/workout',
      label: 'Workouts',
      icon: Dumbbell,
    },
    {
      path: '/history',
      label: 'History & Trends',
      icon: Calendar,
    },
    {
      path: '/insights',
      label: 'AI Coach',
      icon: Sparkles,
    },
    {
      path: '/profile',
      label: 'Profile & Goals',
      icon: User,
    },
    {
      path: '/settings',
      label: 'Settings',
      icon: SettingsIcon,
    },
  ];

  const userName = user?.profile?.name || user?.email?.split('@')[0] || 'Athlete';
  const userInitials = userName
    .split(' ')
    .map((n: string) => n[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  return (
    <aside className="hidden lg:flex flex-col w-64 h-screen sticky top-0 bg-white dark:bg-[#12151D] border-r border-[#0F172A]/[0.08] dark:border-white/10 z-40 select-none">
      
      {/* Brand Header */}
      <div className="h-16 px-6 flex items-center justify-between border-b border-[#0F172A]/[0.08] dark:border-white/10">
        <NavLink to="/dashboard" className="flex items-center gap-2 group">
          <div className="w-8 h-8 rounded-[8px] bg-[#2F5BFF] flex items-center justify-center text-white shadow-subtle group-hover:scale-105 transition-transform">
            <Scan className="w-4 h-4 text-white" strokeWidth={2} />
          </div>
          <span className="text-xl font-bold font-display tracking-tight text-[#0F172A] dark:text-white">
            Fitsnap<span className="text-[#2F5BFF]">.</span>
          </span>
        </NavLink>
      </div>

      {/* Quick Action Button */}
      <div className="p-4 pb-2">
        <button
          onClick={() => navigate('/food/capture')}
          className="w-full py-2.5 px-4 rounded-xl text-sm font-semibold text-white bg-[#2F5BFF] hover:bg-[#1d41e6] transition-colors shadow-subtle flex items-center justify-center gap-2"
        >
          <Plus className="w-4 h-4" strokeWidth={2.5} />
          <span>Snap Meal</span>
        </button>
      </div>

      {/* Navigation Links */}
      <nav className="flex-1 px-3 py-2 space-y-1 overflow-y-auto">
        {navItems.map((item) => {
          const isActive = location.pathname === item.path || (item.path !== '/dashboard' && location.pathname.startsWith(item.path));
          const Icon = item.icon;

          return (
            <NavLink
              key={item.path}
              to={item.path}
              className={`flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all ${
                isActive
                  ? 'bg-[#2F5BFF]/10 text-[#2F5BFF] font-semibold dark:bg-[#2F5BFF]/20'
                  : 'text-[#475569] dark:text-[#94A3B8] hover:bg-[#F7F8FA] dark:hover:bg-white/5 hover:text-[#0F172A] dark:hover:text-white'
              }`}
            >
              <Icon
                className={`w-5 h-5 flex-shrink-0 transition-colors ${
                  isActive ? 'text-[#2F5BFF]' : 'text-[#475569] dark:text-[#94A3B8]'
                }`}
                strokeWidth={1.5}
              />
              <span className="truncate">{item.label}</span>
            </NavLink>
          );
        })}
      </nav>

      {/* Streak Badge Strip */}
      <div className="px-4 py-2">
        <div className="p-3 rounded-xl bg-[#F7F8FA] dark:bg-white/5 border border-[#0F172A]/[0.06] dark:border-white/10 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-[#F59E0B]/10 text-[#F59E0B] flex items-center justify-center">
              <Flame className="w-4 h-4" />
            </div>
            <div>
              <span className="text-xs font-bold text-[#0F172A] dark:text-white block">14 Days</span>
              <span className="text-[10px] text-[#94A3B8]">Current Streak</span>
            </div>
          </div>
          <span className="text-[10px] font-semibold text-[#16A34A] bg-[#16A34A]/10 px-2 py-0.5 rounded-full">
            Active
          </span>
        </div>
      </div>

      {/* User Account Footer Card */}
      <div className="p-3 border-t border-[#0F172A]/[0.08] dark:border-white/10">
        <div className="flex items-center justify-between p-2 rounded-xl hover:bg-[#F7F8FA] dark:hover:bg-white/5 transition-colors">
          <NavLink to="/profile" className="flex items-center gap-3 min-w-0 flex-1">
            <div className="w-9 h-9 rounded-full bg-[#2F5BFF] text-white flex items-center justify-center font-bold text-xs flex-shrink-0 shadow-subtle">
              {userInitials}
            </div>
            <div className="min-w-0 flex-1">
              <span className="text-sm font-semibold text-[#0F172A] dark:text-white block truncate">
                {userName}
              </span>
              <span className="text-[11px] text-[#94A3B8] block truncate">
                {user?.email || 'demo@fitsnap.app'}
              </span>
            </div>
          </NavLink>

          <button
            onClick={handleLogout}
            title="Log out"
            className="p-1.5 rounded-lg text-[#94A3B8] hover:text-[#DC2626] hover:bg-[#DC2626]/10 transition-colors"
          >
            <LogOut className="w-4 h-4" strokeWidth={1.5} />
          </button>
        </div>
      </div>

    </aside>
  );
};
