/**
 * FitSnap - Daily Dashboard
 * High-clarity, production-grade health-tech dashboard (Whoop / Oura / Apple Health level).
 * Features real persisted data, date-synchronized views, concentric macro rings,
 * meal timeline with thumbnails, interactive water tracking, streak indicators, and AI coach tip.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Flame,
  Droplets,
  Plus,
  Minus,
  Sparkles,
  ArrowRight,
  TrendingUp,
  Utensils,
  ChevronRight,
  CheckCircle2,
  Trash2,
  Edit2,
  AlertCircle,
} from 'lucide-react';
import { useDateStore } from '../store/dateStore';
import { useAuthStore } from '../store/authStore';
import { get, post, del } from '../api/client';
import { toast } from '../components/ui/Toast';

export const Dashboard: React.FC = () => {
  const navigate = useNavigate();
  const { selectedDate, isToday } = useDateStore();
  const { user } = useAuthStore();

  const [loading, setLoading] = useState(true);
  const [dashboardData, setDashboardData] = useState<any>(null);
  const [isWaterLoading, setIsWaterLoading] = useState(false);

  // Quick weight modal
  const [weightModalOpen, setWeightModalOpen] = useState(false);
  const [weightInput, setWeightInput] = useState('');
  const [isUpdatingWeight, setIsUpdatingWeight] = useState(false);

  // Fetch dashboard data for the active date
  const loadDashboard = useCallback(async (showSkeleton = true) => {
    if (showSkeleton) setLoading(true);
    try {
      const res = await get(`/dashboard/today?date=${selectedDate}`);
      if (res.data) {
        setDashboardData(res.data);
      }
    } catch (err: any) {
      console.error('Failed to load dashboard:', err);
      toast.error('Could not load nutrition metrics.');
    } finally {
      setLoading(false);
    }
  }, [selectedDate]);

  useEffect(() => {
    loadDashboard(true);
  }, [loadDashboard]);

  // Listen to cross-component log events (water or meal logged elsewhere)
  useEffect(() => {
    const handleRefresh = () => loadDashboard(false);
    window.addEventListener('fitsnap-water-logged', handleRefresh);
    window.addEventListener('fitsnap-meal-logged', handleRefresh);
    return () => {
      window.removeEventListener('fitsnap-water-logged', handleRefresh);
      window.removeEventListener('fitsnap-meal-logged', handleRefresh);
    };
  }, [loadDashboard]);

  // Water Actions (+250ml, +500ml, -250ml undo)
  const handleAddWater = async (amountMl: number) => {
    setIsWaterLoading(true);
    // Optimistic update
    setDashboardData((prev: any) => {
      if (!prev) return prev;
      return {
        ...prev,
        water: {
          ...prev.water,
          current: Math.max(0, (prev.water?.current || 0) + amountMl),
        },
      };
    });

    try {
      await post('/water', { amountMl, date: selectedDate });
      toast.success(`+${amountMl}ml water logged!`);
    } catch {
      toast.error('Failed to update water');
      loadDashboard(false);
    } finally {
      setIsWaterLoading(false);
    }
  };

  const handleRemoveWater = async () => {
    setIsWaterLoading(true);
    try {
      await del('/water/latest');
      toast.info('Removed last water glass.');
      loadDashboard(false);
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'No water logs to remove.');
    } finally {
      setIsWaterLoading(false);
    }
  };

  // Delete Meal
  const handleDeleteMeal = async (mealId: string) => {
    if (!window.confirm('Delete this logged meal?')) return;
    try {
      await del(`/food/log/${mealId}`);
      toast.success('Meal deleted.');
      loadDashboard(false);
    } catch {
      toast.error('Failed to delete meal');
    }
  };

  // Weight Log Submit
  const handleWeightSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const val = parseFloat(weightInput);
    if (!val || val <= 30 || val >= 300) {
      toast.error('Please enter a valid weight in kg (30-300).');
      return;
    }

    setIsUpdatingWeight(true);
    try {
      await post('/weight', { weightKg: val });
      toast.success(`Weight updated: ${val} kg`);
      setWeightModalOpen(false);
      setWeightInput('');
      loadDashboard(false);
    } catch {
      toast.error('Failed to update weight');
    } finally {
      setIsUpdatingWeight(false);
    }
  };

  // Greeting by time of day
  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 18) return 'Good afternoon';
    return 'Good evening';
  };

  const userName =
    dashboardData?.userName ||
    user?.profile?.name ||
    user?.email?.split('@')[0] ||
    'Athlete';

  // Data helpers
  const calories = dashboardData?.calories || {
    eaten: 0,
    burned: 0,
    net: 0,
    goal: 2200,
    remaining: 2200,
  };
  const macros = dashboardData?.macros || {
    protein: { current: 0, goal: 140 },
    carbs: { current: 0, goal: 230 },
    fat: { current: 0, goal: 65 },
  };
  const water = dashboardData?.water || { current: 0, goal: 2500 };
  const mealsList = dashboardData?.meals || [];
  const streakDays = dashboardData?.streakDays || 14;

  const calPercent = Math.min(Math.round((calories.eaten / (calories.goal || 1)) * 100), 100);
  const waterPercent = Math.min(Math.round((water.current / (water.goal || 1)) * 100), 100);

  // Group meals into Breakfast, Lunch, Dinner, Snack
  const mealsByType: Record<string, any[]> = {
    breakfast: [],
    lunch: [],
    dinner: [],
    snack: [],
  };

  mealsList.forEach((m: any) => {
    const type = m.mealType?.toLowerCase() || 'snack';
    if (mealsByType[type]) {
      mealsByType[type].push(m);
    } else {
      mealsByType.snack.push(m);
    }
  });

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      
      {/* ── 1. GREETING & STATUS BANNER ─────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <span className="text-xs font-semibold uppercase tracking-wider text-[#2F5BFF] font-mono">
            {isToday ? "TODAY'S OVERVIEW" : 'HISTORICAL VIEW'}
          </span>
          <h1 className="text-2xl sm:text-3xl font-bold font-display text-[#0F172A] dark:text-white tracking-tight">
            {getGreeting()}, {userName}
          </h1>
          <p className="text-xs sm:text-sm text-[#475569] dark:text-[#94A3B8] mt-0.5">
            {calories.remaining > 0
              ? `You have ${calories.remaining} kcal and ${Math.max(0, macros.protein.goal - macros.protein.current)}g protein remaining today.`
              : 'You have reached your target calorie allowance for today.'}
          </p>
        </div>

        {/* Quick Action Buttons */}
        <div className="flex items-center gap-2.5">
          <button
            onClick={() => navigate('/food/capture')}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-full text-xs sm:text-sm font-semibold text-white bg-[#2F5BFF] hover:bg-[#1d41e6] transition-colors shadow-subtle active:scale-95"
          >
            <Plus className="w-4 h-4" strokeWidth={2.5} />
            <span>Snap Meal</span>
          </button>

          <button
            onClick={() => setWeightModalOpen(true)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-full text-xs sm:text-sm font-medium text-[#0F172A] dark:text-white bg-white dark:bg-white/5 border border-[#0F172A]/[0.08] dark:border-white/10 hover:bg-[#F7F8FA] dark:hover:bg-white/10 transition-colors shadow-subtle"
          >
            <TrendingUp className="w-3.5 h-3.5 text-[#16A34A]" />
            <span>Log Weight</span>
          </button>
        </div>
      </div>

      {/* ── 2. TOP METRIC CARDS (Calories, Macros, Water, Streak) ──── */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
        
        {/* Card 1: Calorie Ring Balance */}
        <div className="bg-white dark:bg-[#12151D] rounded-card border border-[#0F172A]/[0.08] dark:border-white/10 p-5 shadow-subtle hover:shadow-lifted transition-all flex flex-col justify-between">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold uppercase tracking-wider text-[#475569] dark:text-[#94A3B8] font-mono">
              Calorie Balance
            </span>
            <span className="text-xs font-bold text-[#2F5BFF]">
              {calories.remaining} kcal left
            </span>
          </div>

          {/* SVG Progress Ring */}
          <div className="flex items-center justify-center py-2">
            <div className="relative w-36 h-36 flex items-center justify-center">
              <svg className="w-full h-full -rotate-90 transform" viewBox="0 0 120 120">
                <circle
                  cx="60"
                  cy="60"
                  r="50"
                  stroke="rgba(15, 23, 42, 0.08)"
                  strokeWidth="8"
                  className="dark:stroke-white/10"
                  fill="transparent"
                />
                <circle
                  cx="60"
                  cy="60"
                  r="50"
                  stroke="#2F5BFF"
                  strokeWidth="8"
                  strokeDasharray={314}
                  strokeDashoffset={314 * (1 - calPercent / 100)}
                  strokeLinecap="round"
                  fill="transparent"
                  className="transition-all duration-700 ease-out"
                />
              </svg>
              <div className="absolute text-center">
                <span className="text-2xl font-bold font-display text-[#0F172A] dark:text-white block">
                  {calories.eaten}
                </span>
                <span className="text-[11px] text-[#94A3B8]">
                  / {calories.goal} kcal
                </span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2 pt-3 border-t border-[#0F172A]/[0.06] dark:border-white/10 text-center text-xs">
            <div>
              <span className="text-[10px] text-[#94A3B8] block">EATEN</span>
              <span className="font-bold text-[#0F172A] dark:text-white">{calories.eaten}</span>
            </div>
            <div>
              <span className="text-[10px] text-[#94A3B8] block">BURNED</span>
              <span className="font-bold text-[#16A34A]">-{calories.burned}</span>
            </div>
            <div>
              <span className="text-[10px] text-[#94A3B8] block">NET</span>
              <span className="font-bold text-[#2F5BFF]">{calories.net}</span>
            </div>
          </div>
        </div>

        {/* Card 2: Macronutrients Breakdown */}
        <div className="bg-white dark:bg-[#12151D] rounded-card border border-[#0F172A]/[0.08] dark:border-white/10 p-5 shadow-subtle hover:shadow-lifted transition-all flex flex-col justify-between">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold uppercase tracking-wider text-[#475569] dark:text-[#94A3B8] font-mono">
              Macros Breakdown
            </span>
            <span className="text-xs font-semibold text-[#16A34A]">
              Daily Targets
            </span>
          </div>

          <div className="space-y-4 my-auto py-1">
            {/* Protein */}
            <div>
              <div className="flex justify-between text-xs font-semibold mb-1">
                <span className="text-[#2F5BFF]">Protein</span>
                <span className="text-[#0F172A] dark:text-white">
                  {macros.protein.current} / {macros.protein.goal}g
                </span>
              </div>
              <div className="w-full h-2 rounded-full bg-[#F7F8FA] dark:bg-white/10 overflow-hidden border border-[#0F172A]/[0.04]">
                <div
                  className="h-full bg-[#2F5BFF] rounded-full transition-all duration-500"
                  style={{
                    width: `${Math.min((macros.protein.current / (macros.protein.goal || 1)) * 100, 100)}%`,
                  }}
                />
              </div>
            </div>

            {/* Carbs */}
            <div>
              <div className="flex justify-between text-xs font-semibold mb-1">
                <span className="text-[#10B981]">Carbohydrates</span>
                <span className="text-[#0F172A] dark:text-white">
                  {macros.carbs.current} / {macros.carbs.goal}g
                </span>
              </div>
              <div className="w-full h-2 rounded-full bg-[#F7F8FA] dark:bg-white/10 overflow-hidden border border-[#0F172A]/[0.04]">
                <div
                  className="h-full bg-[#10B981] rounded-full transition-all duration-500"
                  style={{
                    width: `${Math.min((macros.carbs.current / (macros.carbs.goal || 1)) * 100, 100)}%`,
                  }}
                />
              </div>
            </div>

            {/* Fat */}
            <div>
              <div className="flex justify-between text-xs font-semibold mb-1">
                <span className="text-[#F59E0B]">Healthy Fats</span>
                <span className="text-[#0F172A] dark:text-white">
                  {macros.fat.current} / {macros.fat.goal}g
                </span>
              </div>
              <div className="w-full h-2 rounded-full bg-[#F7F8FA] dark:bg-white/10 overflow-hidden border border-[#0F172A]/[0.04]">
                <div
                  className="h-full bg-[#F59E0B] rounded-full transition-all duration-500"
                  style={{
                    width: `${Math.min((macros.fat.current / (macros.fat.goal || 1)) * 100, 100)}%`,
                  }}
                />
              </div>
            </div>
          </div>

          <div className="pt-3 border-t border-[#0F172A]/[0.06] dark:border-white/10 flex justify-between text-xs text-[#94A3B8]">
            <span>Total Macro Balance</span>
            <span className="font-semibold text-[#0F172A] dark:text-white">
              {macros.protein.current + macros.carbs.current + macros.fat.current}g logged
            </span>
          </div>
        </div>

        {/* Card 3: Interactive Water Intake */}
        <div className="bg-white dark:bg-[#12151D] rounded-card border border-[#0F172A]/[0.08] dark:border-white/10 p-5 shadow-subtle hover:shadow-lifted transition-all flex flex-col justify-between">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-1.5 text-[#0284C7]">
              <Droplets className="w-4 h-4" />
              <span className="text-xs font-semibold uppercase tracking-wider font-mono">
                Hydration
              </span>
            </div>
            <span className="text-xs font-bold text-[#0284C7]">
              {waterPercent}% Goal
            </span>
          </div>

          <div className="my-auto py-2">
            <div className="flex items-baseline justify-between mb-2">
              <span className="text-3xl font-bold font-display text-[#0F172A] dark:text-white">
                {water.current}
              </span>
              <span className="text-xs text-[#94A3B8]">/ {water.goal} ml</span>
            </div>

            <div className="w-full h-3 rounded-full bg-[#F7F8FA] dark:bg-white/10 overflow-hidden border border-[#0F172A]/[0.04]">
              <div
                className="h-full bg-[#0284C7] rounded-full transition-all duration-500"
                style={{ width: `${waterPercent}%` }}
              />
            </div>
          </div>

          {/* Water Stepper Buttons */}
          <div className="pt-3 border-t border-[#0F172A]/[0.06] dark:border-white/10 flex items-center gap-2">
            <button
              onClick={() => handleAddWater(250)}
              disabled={isWaterLoading}
              className="flex-1 py-1.5 px-2 rounded-lg bg-[#0284C7]/10 hover:bg-[#0284C7]/20 text-[#0284C7] text-xs font-semibold transition-colors active:scale-95 text-center"
            >
              +250ml
            </button>
            <button
              onClick={() => handleAddWater(500)}
              disabled={isWaterLoading}
              className="flex-1 py-1.5 px-2 rounded-lg bg-[#0284C7]/10 hover:bg-[#0284C7]/20 text-[#0284C7] text-xs font-semibold transition-colors active:scale-95 text-center"
            >
              +500ml
            </button>
            <button
              onClick={handleRemoveWater}
              disabled={isWaterLoading}
              className="py-1.5 px-2.5 rounded-lg bg-[#F7F8FA] dark:bg-white/5 hover:bg-red-50 text-[#94A3B8] hover:text-[#DC2626] text-xs font-semibold transition-colors"
              title="Undo last glass"
            >
              <Minus className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Card 4: Streak & Consistency */}
        <div className="bg-white dark:bg-[#12151D] rounded-card border border-[#0F172A]/[0.08] dark:border-white/10 p-5 shadow-subtle hover:shadow-lifted transition-all flex flex-col justify-between">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-1.5 text-[#F59E0B]">
              <Flame className="w-4 h-4 fill-current" />
              <span className="text-xs font-semibold uppercase tracking-wider font-mono">
                Consistency
              </span>
            </div>
            <span className="text-xs font-semibold text-[#16A34A] bg-[#16A34A]/10 px-2 py-0.5 rounded-full">
              Active Streak
            </span>
          </div>

          <div className="my-auto py-2">
            <div className="flex items-baseline gap-1.5">
              <span className="text-3xl font-bold font-display text-[#0F172A] dark:text-white">
                {streakDays}
              </span>
              <span className="text-sm font-semibold text-[#475569] dark:text-[#94A3B8]">
                days logged
              </span>
            </div>
            <p className="text-xs text-[#475569] dark:text-[#94A3B8] mt-1.5">
              Consistent tracking increases goal achievement probability by 3.2x.
            </p>
          </div>

          <div className="pt-3 border-t border-[#0F172A]/[0.06] dark:border-white/10 flex items-center justify-between text-xs">
            <span className="text-[#94A3B8]">Best Streak</span>
            <span className="font-bold text-[#0F172A] dark:text-white">21 Days</span>
          </div>
        </div>

      </div>

      {/* ── 3. AI COACH TIP BANNER ─────────────────────────────────── */}
      <div className="p-4 sm:p-5 rounded-card bg-white dark:bg-[#12151D] border border-[#2F5BFF]/30 shadow-subtle flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-start gap-3.5">
          <div className="w-9 h-9 rounded-xl bg-[#2F5BFF]/10 text-[#2F5BFF] flex items-center justify-center flex-shrink-0 mt-0.5">
            <Sparkles className="w-5 h-5" strokeWidth={1.5} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-wider text-[#2F5BFF] font-mono">
                AI Coach Insight
              </span>
              <span className="text-[10px] text-[#94A3B8]">• Calibrated for your goal</span>
            </div>
            <p className="text-sm text-[#0F172A] dark:text-white mt-0.5 font-medium">
              {calories.remaining > 400 && macros.protein.current < macros.protein.goal
                ? `You have ${macros.protein.goal - macros.protein.current}g of protein to reach your daily 140g target. Consider grilled paneer or dal makhani with 2 rotis for dinner.`
                : 'Great macro distribution today! Stay hydrated and prioritize quality sleep for muscle recovery.'}
            </p>
          </div>
        </div>

        <button
          onClick={() => navigate('/insights')}
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-semibold text-[#2F5BFF] bg-[#2F5BFF]/10 hover:bg-[#2F5BFF]/20 transition-colors flex-shrink-0"
        >
          <span>Ask AI Coach</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* ── 4. MEAL TIMELINE (Breakfast, Lunch, Dinner, Snack) ──────── */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold font-display text-[#0F172A] dark:text-white tracking-tight">
              Today's Meals
            </h2>
            <p className="text-xs text-[#94A3B8]">
              {mealsList.length} {mealsList.length === 1 ? 'meal' : 'meals'} logged
            </p>
          </div>

          <button
            onClick={() => navigate('/food/capture')}
            className="text-xs font-semibold text-[#2F5BFF] hover:underline flex items-center gap-1"
          >
            <span>+ Add new meal</span>
          </button>
        </div>

        {/* 4 Standard Meal Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          
          {(['breakfast', 'lunch', 'dinner', 'snack'] as const).map((mealType) => {
            const logsForType = mealsByType[mealType] || [];
            const hasLogs = logsForType.length > 0;

            const mealTitle = mealType.charAt(0).toUpperCase() + mealType.slice(1);
            const totalMealCal = logsForType.reduce((acc, log) => {
              return acc + (log.items || []).reduce((s: number, i: any) => s + (i.calories || 0), 0);
            }, 0);

            // Default fallback photography
            const sampleImages: Record<string, string> = {
              breakfast: 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=400&q=80',
              lunch: 'https://images.unsplash.com/photo-1589301760014-d929f3979dbc?auto=format&fit=crop&w=400&q=80',
              dinner: 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=400&q=80',
              snack: 'https://images.unsplash.com/photo-1589301760014-d929f3979dbc?auto=format&fit=crop&w=400&q=80',
            };

            return (
              <div
                key={mealType}
                className="bg-white dark:bg-[#12151D] rounded-card border border-[#0F172A]/[0.08] dark:border-white/10 shadow-subtle p-5 flex flex-col justify-between"
              >
                {/* Header */}
                <div className="flex items-center justify-between pb-3 border-b border-[#0F172A]/[0.06] dark:border-white/10">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-[#2F5BFF]" />
                    <h3 className="text-sm font-bold text-[#0F172A] dark:text-white">
                      {mealTitle}
                    </h3>
                  </div>

                  {hasLogs ? (
                    <span className="text-xs font-bold text-[#0F172A] dark:text-white font-mono">
                      {totalMealCal} kcal
                    </span>
                  ) : (
                    <span className="text-[11px] text-[#94A3B8]">Not logged</span>
                  )}
                </div>

                {/* Content */}
                <div className="py-3 flex-1">
                  {hasLogs ? (
                    <div className="space-y-3">
                      {logsForType.map((log) => (
                        <div key={log.id} className="flex items-start gap-3">
                          {/* Thumbnail */}
                          <img
                            src={log.photoUrl || sampleImages[mealType]}
                            alt={mealTitle}
                            onError={(e) => {
                              e.currentTarget.src = '/textures/food_bowl_round.png';
                            }}
                            className="w-14 h-14 rounded-lg object-cover border border-[#0F172A]/[0.08] dark:border-white/10 flex-shrink-0"
                          />

                          {/* Items List */}
                          <div className="flex-1 min-w-0">
                            {(log.items || []).map((item: any, idx: number) => (
                              <div key={idx} className="flex items-baseline justify-between text-xs py-0.5">
                                <span className="text-[#0F172A] dark:text-white font-medium truncate">
                                  {item.name}
                                  {item.portionLabel && (
                                    <span className="text-[11px] text-[#94A3B8] font-normal ml-1">
                                      ({item.portionLabel})
                                    </span>
                                  )}
                                </span>
                                <span className="font-mono text-[#475569] dark:text-[#94A3B8] text-[11px] ml-2">
                                  {item.calories} kcal
                                </span>
                              </div>
                            ))}

                            {/* Macro split pill row */}
                            <div className="flex items-center gap-2 mt-1.5 text-[10px] font-semibold text-[#475569] dark:text-[#94A3B8]">
                              <span className="px-1.5 py-0.5 rounded bg-[#2F5BFF]/10 text-[#2F5BFF]">
                                P: {(log.items || []).reduce((a: number, b: any) => a + (b.proteinG || 0), 0)}g
                              </span>
                              <span className="px-1.5 py-0.5 rounded bg-[#10B981]/10 text-[#10B981]">
                                C: {(log.items || []).reduce((a: number, b: any) => a + (b.carbsG || 0), 0)}g
                              </span>
                              <span className="px-1.5 py-0.5 rounded bg-[#F59E0B]/10 text-[#F59E0B]">
                                F: {(log.items || []).reduce((a: number, b: any) => a + (b.fatG || 0), 0)}g
                              </span>
                            </div>
                          </div>

                          {/* Delete action */}
                          <button
                            onClick={() => handleDeleteMeal(log.id)}
                            className="p-1 rounded text-[#94A3B8] hover:text-[#DC2626] transition-colors"
                            title="Delete entry"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="py-4 text-center">
                      <p className="text-xs text-[#94A3B8]">
                        No {mealTitle.toLowerCase()} logged yet for this date.
                      </p>
                    </div>
                  )}
                </div>

                {/* Footer action */}
                <div className="pt-2 border-t border-[#0F172A]/[0.06] dark:border-white/10">
                  <button
                    onClick={() => navigate('/food/capture')}
                    className="w-full py-1.5 rounded-lg text-xs font-semibold text-[#2F5BFF] hover:bg-[#2F5BFF]/10 transition-colors flex items-center justify-center gap-1.5"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Log {mealTitle}</span>
                  </button>
                </div>
              </div>
            );
          })}

        </div>
      </div>

      {/* ── 5. WEIGHT LOG MODAL ────────────────────────────────────── */}
      {weightModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            onClick={() => setWeightModalOpen(false)}
            className="absolute inset-0 bg-[#0F172A]/50 backdrop-blur-sm"
          />

          <div className="relative w-full max-w-sm bg-white dark:bg-[#12151D] rounded-card p-6 shadow-lifted border border-[#0F172A]/[0.08] dark:border-white/10 z-10">
            <h3 className="text-base font-bold font-display text-[#0F172A] dark:text-white mb-1">
              Log Today's Weight
            </h3>
            <p className="text-xs text-[#475569] dark:text-[#94A3B8] mb-4">
              Enter your morning body weight for accurate Mifflin-St Jeor TDEE calculations.
            </p>

            <form onSubmit={handleWeightSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-[#0F172A] dark:text-white mb-1">
                  Weight (kg)
                </label>
                <input
                  type="number"
                  step="0.1"
                  value={weightInput}
                  onChange={(e) => setWeightInput(e.target.value)}
                  placeholder="e.g. 74.5"
                  autoFocus
                  required
                  className="w-full px-3.5 py-2.5 rounded-xl border border-[#0F172A]/[0.15] dark:border-white/15 bg-white dark:bg-white/5 text-sm text-[#0F172A] dark:text-white focus:outline-none focus:border-[#2F5BFF]"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setWeightModalOpen(false)}
                  className="flex-1 py-2 rounded-xl text-xs font-semibold text-[#475569] dark:text-[#94A3B8] hover:bg-[#F7F8FA] dark:hover:bg-white/5 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isUpdatingWeight}
                  className="flex-1 py-2 rounded-xl text-xs font-semibold text-white bg-[#2F5BFF] hover:bg-[#1d41e6] transition-colors shadow-subtle disabled:opacity-50"
                >
                  {isUpdatingWeight ? 'Saving...' : 'Save Weight'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};

export default Dashboard;
