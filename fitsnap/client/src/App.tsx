/**
 * FitSnap - Main React Router & Application Hub
 * Manages protected routes, public redirects, layout encapsulation, and theme initialization.
 */

import React, { useEffect } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from './store/authStore';
import { useSettingsStore } from './store/settingsStore';
import { FitSnapToaster } from './components/ui/Toast';
import { AppLayout } from './components/layout/AppLayout';

// Public Pages
import Login from './pages/Login';
import Register from './pages/Register';
import Onboarding from './pages/Onboarding';

// Authenticated Pages
import Dashboard from './pages/Dashboard';
import FoodLog from './pages/FoodLog';
import FoodCapture from './pages/FoodCapture';
import FoodConfirm from './pages/FoodConfirm';
import WaterTracker from './pages/WaterTracker';
import History from './pages/History';
import AIInsights from './pages/AIInsights';
import Profile from './pages/Profile';
import Settings from './pages/Settings';
import WorkoutLog from './pages/WorkoutLog';
import WorkoutSession from './pages/WorkoutSession';
import ExerciseLibrary from './pages/ExerciseLibrary';

/**
 * Protected Route wrapper:
 * Redirects logged-out users to /login, and wraps authenticated pages inside AppLayout.
 */
const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated, token } = useAuthStore();
  const hasToken = isAuthenticated || !!token || !!localStorage.getItem('fitsnap_token');

  if (!hasToken) {
    return <Navigate to="/login" replace />;
  }

  return <AppLayout>{children}</AppLayout>;
};

/**
 * Public-only Route wrapper:
 * Prevents logged-in users from getting stuck on login/register pages.
 */
const PublicOnlyRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated, token } = useAuthStore();
  const hasToken = isAuthenticated || !!token || !!localStorage.getItem('fitsnap_token');

  if (hasToken) {
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
};

export const App: React.FC = () => {
  const { loadUser } = useAuthStore();
  const { darkMode } = useSettingsStore();

  useEffect(() => {
    loadUser();
  }, [loadUser]);

  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [darkMode]);

  return (
    <div className="min-h-screen bg-transparent text-[#0F172A] dark:text-white font-sans selection:bg-[#2F5BFF] selection:text-white">
      {/* Toast notifications */}
      <FitSnapToaster />

      {/* Main router views */}
      <main className="w-full">
        <Routes>
          {/* Public Auth Routes (Logged-in users skip to /dashboard) */}
          <Route
            path="/login"
            element={
              <PublicOnlyRoute>
                <Login />
              </PublicOnlyRoute>
            }
          />
          <Route
            path="/register"
            element={
              <PublicOnlyRoute>
                <Register />
              </PublicOnlyRoute>
            }
          />

          {/* Onboarding */}
          <Route
            path="/onboarding"
            element={
              <ProtectedRoute>
                <Onboarding />
              </ProtectedRoute>
            }
          />

          {/* Primary Dashboard */}
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute>
                <Dashboard />
              </ProtectedRoute>
            }
          />

          {/* Food Tracking Flow */}
          <Route
            path="/food"
            element={
              <ProtectedRoute>
                <FoodLog />
              </ProtectedRoute>
            }
          />
          <Route
            path="/food/capture"
            element={
              <ProtectedRoute>
                <FoodCapture />
              </ProtectedRoute>
            }
          />
          <Route
            path="/food/confirm"
            element={
              <ProtectedRoute>
                <FoodConfirm />
              </ProtectedRoute>
            }
          />

          {/* Hydration Tracker */}
          <Route
            path="/water"
            element={
              <ProtectedRoute>
                <WaterTracker />
              </ProtectedRoute>
            }
          />

          {/* Meal Planner & Grocery List (Removed) */}
          <Route path="/planner" element={<Navigate to="/dashboard" replace />} />
          <Route path="/grocery" element={<Navigate to="/dashboard" replace />} />

          {/* History & Longitudinal Trends */}
          <Route
            path="/history"
            element={
              <ProtectedRoute>
                <History />
              </ProtectedRoute>
            }
          />

          {/* AI Coach */}
          <Route
            path="/insights"
            element={
              <ProtectedRoute>
                <AIInsights />
              </ProtectedRoute>
            }
          />
          <Route
            path="/coach"
            element={
              <ProtectedRoute>
                <AIInsights />
              </ProtectedRoute>
            }
          />

          {/* Workout Tracking Flow */}
          <Route
            path="/workout"
            element={
              <ProtectedRoute>
                <WorkoutLog />
              </ProtectedRoute>
            }
          />
          <Route
            path="/workout/session"
            element={
              <ProtectedRoute>
                <WorkoutSession />
              </ProtectedRoute>
            }
          />
          <Route
            path="/workout/exercises"
            element={
              <ProtectedRoute>
                <ExerciseLibrary />
              </ProtectedRoute>
            }
          />

          {/* Social & Community (Deprecated / Redirected) */}
          <Route path="/community" element={<Navigate to="/dashboard" replace />} />

          {/* Profile & Settings */}
          <Route
            path="/profile"
            element={
              <ProtectedRoute>
                <Profile />
              </ProtectedRoute>
            }
          />
          <Route
            path="/settings"
            element={
              <ProtectedRoute>
                <Settings />
              </ProtectedRoute>
            }
          />

          {/* Default Route */}
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </main>
    </div>
  );
};

export default App;
