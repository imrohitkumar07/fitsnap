/**
 * FitSnap - Food Diary Page
 * Displays meals tracked for the selected date grouped by meal type with nutritional breakdown.
 * Integrates with global DateStore, allows editing/deleting meals, copy/move meal, and quick add action.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Plus,
  Trash2,
  UtensilsCrossed,
  Sparkles,
  Calendar,
  ChevronRight,
  Zap,
  Copy,
} from 'lucide-react';
import { useDateStore } from '../store/dateStore';
import { get, post, del } from '../api/client';
import { toast } from '../components/ui/Toast';
import { QuickAddModal } from '../components/food/QuickAddModal';

export const FoodLog: React.FC = () => {
  const navigate = useNavigate();
  const { selectedDate, isToday } = useDateStore();

  const [loading, setLoading] = useState(true);
  const [logs, setLogs] = useState<any[]>([]);
  const [quickAddOpen, setQuickAddOpen] = useState(false);
  const [quickAddMealType, setQuickAddMealType] = useState('snack');
  const [totals, setTotals] = useState<any>({
    calories: 0,
    proteinG: 0,
    carbsG: 0,
    fatG: 0,
    fiberG: 0,
  });

  const fetchFoodLogs = useCallback(async () => {
    setLoading(true);
    try {
      const res = await get(`/food/log?date=${selectedDate}`);
      if (res.data) {
        setLogs(res.data.logs || []);
        setTotals(res.data.totals || { calories: 0, proteinG: 0, carbsG: 0, fatG: 0, fiberG: 0 });
      }
    } catch (err: any) {
      console.error('Failed to fetch food logs:', err);
      toast.error('Failed to load food logs');
    } finally {
      setLoading(false);
    }
  }, [selectedDate]);

  useEffect(() => {
    fetchFoodLogs();
  }, [fetchFoodLogs]);

  const handleDelete = async (id: string) => {
    if (!window.confirm('Delete this logged meal?')) return;
    try {
      await del(`/food/log/${id}`);
      toast.success('Meal deleted.');
      fetchFoodLogs();
      window.dispatchEvent(new Event('fitsnap-meal-logged'));
    } catch {
      toast.error('Failed to delete meal');
    }
  };

  const handleDuplicateMeal = async (logId: string) => {
    try {
      await post('/food/copy-meal', {
        foodLogId: logId,
      });
      toast.success('Meal duplicated!');
      fetchFoodLogs();
      window.dispatchEvent(new Event('fitsnap-meal-logged'));
    } catch {
      toast.error('Failed to copy meal');
    }
  };

  const mealTypes = ['breakfast', 'lunch', 'dinner', 'snack'] as const;

  return (
    <div className="max-w-4xl mx-auto space-y-6 animate-in fade-in duration-200 pb-12">
      
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <span className="text-xs font-semibold uppercase tracking-wider text-[#2F5BFF] font-mono">
            NUTRITION DIARY
          </span>
          <h1 className="text-2xl sm:text-3xl font-bold font-display text-[#0F172A] dark:text-white tracking-tight">
            Daily Food Log
          </h1>
          <p className="text-xs sm:text-sm text-[#475569] dark:text-[#94A3B8] mt-0.5">
            {isToday ? "Review today's tracked meals and macronutrient distributions." : `Showing food entries for ${selectedDate}.`}
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          <button
            onClick={() => {
              setQuickAddMealType('snack');
              setQuickAddOpen(true);
            }}
            className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-full text-xs sm:text-sm font-semibold text-[#2F5BFF] bg-[#2F5BFF]/10 hover:bg-[#2F5BFF]/20 border border-[#2F5BFF]/20 transition-colors"
          >
            <Zap className="w-4 h-4" />
            <span>Quick Add</span>
          </button>

          <button
            onClick={() => navigate('/food/capture')}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full text-xs sm:text-sm font-semibold text-white bg-[#2F5BFF] hover:bg-[#1d41e6] transition-colors shadow-subtle"
          >
            <Plus className="w-4 h-4" strokeWidth={2.5} />
            <span>Log Food</span>
          </button>
        </div>
      </div>

      {/* Daily Totals Banner */}
      <div className="bg-white dark:bg-[#12151D] rounded-card border border-[#0F172A]/[0.08] dark:border-white/10 shadow-subtle p-5 sm:p-6">
        <div className="flex items-baseline justify-between mb-4">
          <span className="text-xs font-semibold uppercase tracking-wider text-[#475569] dark:text-[#94A3B8] font-mono">
            Total Consumed Today
          </span>
          <div className="text-right">
            <span className="text-3xl sm:text-4xl font-bold font-display text-[#0F172A] dark:text-white">
              {totals.calories}
            </span>
            <span className="text-sm text-[#94A3B8] ml-1">kcal</span>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
          <div className="p-3 rounded-xl bg-[#2F5BFF]/10 border border-[#2F5BFF]/20">
            <span className="text-[10px] font-bold text-[#2F5BFF] uppercase block">Protein</span>
            <span className="text-base font-bold text-[#0F172A] dark:text-white mt-0.5 block">{totals.proteinG}g</span>
          </div>

          <div className="p-3 rounded-xl bg-[#10B981]/10 border border-[#10B981]/20">
            <span className="text-[10px] font-bold text-[#10B981] uppercase block">Carbs</span>
            <span className="text-base font-bold text-[#0F172A] dark:text-white mt-0.5 block">{totals.carbsG}g</span>
          </div>

          <div className="p-3 rounded-xl bg-[#F59E0B]/10 border border-[#F59E0B]/20">
            <span className="text-[10px] font-bold text-[#F59E0B] uppercase block">Fat</span>
            <span className="text-base font-bold text-[#0F172A] dark:text-white mt-0.5 block">{totals.fatG}g</span>
          </div>

          <div className="p-3 rounded-xl bg-[#64748B]/10 border border-[#64748B]/20">
            <span className="text-[10px] font-bold text-[#64748B] dark:text-[#94A3B8] uppercase block">Fiber</span>
            <span className="text-base font-bold text-[#0F172A] dark:text-white mt-0.5 block">{totals.fiberG || 0}g</span>
          </div>
        </div>
      </div>

      {/* Meals Grouped by Type */}
      <div className="space-y-4">
        {mealTypes.map((type) => {
          const typeLogs = logs.filter((l) => l.mealType?.toLowerCase() === type);
          const title = type.charAt(0).toUpperCase() + type.slice(1);
          const totalCal = typeLogs.reduce((acc, l) => {
            return acc + (l.items || []).reduce((s: number, i: any) => s + (i.calories || 0), 0);
          }, 0);

          return (
            <div
              key={type}
              className="bg-white dark:bg-[#12151D] rounded-card border border-[#0F172A]/[0.08] dark:border-white/10 shadow-subtle p-5"
            >
              <div className="flex items-center justify-between pb-3 border-b border-[#0F172A]/[0.06] dark:border-white/10">
                <div className="flex items-center gap-2.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#2F5BFF]" />
                  <h3 className="text-base font-bold text-[#0F172A] dark:text-white">
                    {title}
                  </h3>
                </div>

                <div className="flex items-center gap-3">
                  <span className="font-mono text-sm font-bold text-[#0F172A] dark:text-white">
                    {totalCal} kcal
                  </span>
                  <button
                    onClick={() => navigate('/food/capture')}
                    className="p-1 rounded-lg text-[#2F5BFF] hover:bg-[#2F5BFF]/10 transition-colors"
                    title={`Add to ${title}`}
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {typeLogs.length > 0 ? (
                <div className="divide-y divide-[#0F172A]/[0.06] dark:divide-white/10">
                  {typeLogs.map((log) => (
                    <div key={log.id} className="py-3.5 flex items-start justify-between gap-4">
                      <div className="flex items-start gap-3">
                        <img
                          src={log.photoUrl || '/textures/food_bowl_round.png'}
                          alt={title}
                          onError={(e) => {
                            e.currentTarget.src = '/textures/food_bowl_round.png';
                          }}
                          className="w-14 h-14 rounded-xl object-cover border border-[#0F172A]/[0.08] dark:border-white/10 flex-shrink-0"
                        />
                        <div>
                          {(log.items || []).map((item: any, idx: number) => (
                            <div key={idx} className="text-sm font-semibold text-[#0F172A] dark:text-white">
                              {item.name}
                              {item.portionLabel && (
                                <span className="text-xs font-normal text-[#94A3B8] ml-1">
                                  ({item.portionLabel})
                                </span>
                              )}
                            </div>
                          ))}
                          <div className="flex items-center gap-2 mt-1 text-[11px] font-semibold text-[#475569] dark:text-[#94A3B8]">
                            <span className="text-[#2F5BFF]">
                              P: {(log.items || []).reduce((a: number, b: any) => a + (b.proteinG || 0), 0)}g
                            </span>
                            <span>•</span>
                            <span className="text-[#10B981]">
                              C: {(log.items || []).reduce((a: number, b: any) => a + (b.carbsG || 0), 0)}g
                            </span>
                            <span>•</span>
                            <span className="text-[#F59E0B]">
                              F: {(log.items || []).reduce((a: number, b: any) => a + (b.fatG || 0), 0)}g
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <span className="font-mono text-sm font-bold text-[#0F172A] dark:text-white">
                          {(log.items || []).reduce((s: number, i: any) => s + (i.calories || 0), 0)} kcal
                        </span>
                        <button
                          onClick={() => handleDuplicateMeal(log.id)}
                          className="p-1.5 rounded-lg text-[#94A3B8] hover:text-[#2F5BFF] hover:bg-[#2F5BFF]/10 transition-colors"
                          title="Copy / Duplicate meal"
                        >
                          <Copy className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(log.id)}
                          className="p-1.5 rounded-lg text-[#94A3B8] hover:text-[#DC2626] hover:bg-red-50 transition-colors"
                          title="Delete entry"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="py-6 text-center">
                  <p className="text-xs text-[#94A3B8]">
                    No {title.toLowerCase()} recorded for this day.
                  </p>
                  <button
                    onClick={() => navigate('/food/capture')}
                    className="mt-2 text-xs font-semibold text-[#2F5BFF] hover:underline"
                  >
                    + Log {title}
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <QuickAddModal
        isOpen={quickAddOpen}
        defaultMealType={quickAddMealType}
        onClose={() => setQuickAddOpen(false)}
        onSuccess={() => fetchFoodLogs()}
      />
    </div>
  );
};

export default FoodLog;
