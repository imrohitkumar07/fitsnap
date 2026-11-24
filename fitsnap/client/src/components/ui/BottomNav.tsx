/**
 * FitSnap - Mobile Bottom Navigation Bar
 * Conforms to modern health-tech design: 44px+ touch targets, Lucide line icons (stroke 1.5), active indicator.
 */

import React, { useState, useEffect } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  UtensilsCrossed,
  Droplets,
  Sparkles,
  User,
} from 'lucide-react';

export const BottomNav: React.FC = () => {
  const location = useLocation();
  const [isVisible, setIsVisible] = useState(true);

  // Auto-hide when keyboard pops up on mobile
  useEffect(() => {
    const originalHeight = window.innerHeight;
    const handleResize = () => {
      if (window.innerHeight < originalHeight - 150) {
        setIsVisible(false);
      } else {
        setIsVisible(true);
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Hide on public and onboarding routes
  const hideOnPaths = ['/login', '/register', '/onboarding'];
  if (hideOnPaths.includes(location.pathname) || !isVisible) {
    return null;
  }

  const navItems = [
    {
      path: '/dashboard',
      label: 'Home',
      icon: LayoutDashboard,
    },
    {
      path: '/food',
      label: 'Food',
      icon: UtensilsCrossed,
    },
    {
      path: '/water',
      label: 'Water',
      icon: Droplets,
    },
    {
      path: '/insights',
      label: 'Coach',
      icon: Sparkles,
    },
    {
      path: '/profile',
      label: 'Profile',
      icon: User,
    },
  ];

  return (
    <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-40 px-3 pb-3 pt-1 pointer-events-none">
      <div className="max-w-md mx-auto pointer-events-auto">
        <div className="flex items-center justify-around rounded-2xl bg-white/95 dark:bg-[#12151D]/95 backdrop-blur-xl border border-[#0F172A]/[0.08] dark:border-white/10 px-2 py-1.5 shadow-[0_8px_24px_rgba(15,23,42,0.12)]">
          {navItems.map((item) => {
            const isActive =
              location.pathname === item.path ||
              (item.path !== '/dashboard' && location.pathname.startsWith(item.path));
            const Icon = item.icon;

            return (
              <NavLink
                key={item.path}
                to={item.path}
                className={`relative flex flex-col items-center justify-center min-w-[56px] min-h-[44px] py-1 px-2 rounded-xl transition-all ${
                  isActive
                    ? 'text-[#2F5BFF] font-semibold'
                    : 'text-[#94A3B8] hover:text-[#475569] dark:hover:text-white'
                }`}
              >
                <div className={`p-1 rounded-lg ${isActive ? 'bg-[#2F5BFF]/10' : ''}`}>
                  <Icon className="w-5 h-5" strokeWidth={isActive ? 2 : 1.5} />
                </div>
                <span className="text-[10px] mt-0.5 tracking-tight font-medium">
                  {item.label}
                </span>
              </NavLink>
            );
          })}
        </div>
      </div>
    </nav>
  );
};
