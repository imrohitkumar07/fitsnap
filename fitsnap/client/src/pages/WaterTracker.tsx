/**
 * FitSnap - WaterTracker Page
 * Clean, production hydration tracking: add/remove glasses, custom volume logging,
 * daily goal progress, animated 3D water glass, and persisted logs per date.
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  Droplets,
  Plus,
  Minus,
  RotateCcw,
  Clock,
  Trash2,
  CheckCircle2,
} from 'lucide-react';
import { useDateStore } from '../store/dateStore';
import { get, post, del } from '../api/client';
import { toast } from '../components/ui/Toast';
import SceneWrapper from '../components/three/SceneWrapper';
import { WaterGlass3D } from '../components/three/WaterGlass3D';

export const WaterTracker: React.FC = () => {
  const { selectedDate, isToday } = useDateStore();

  const [loading, setLoading] = useState(true);
  const [totalMl, setTotalMl] = useState(0);
  const [goalMl, setGoalMl] = useState(2500);
  const [logs, setLogs] = useState<any[]>([]);
  const [customModalOpen, setCustomModalOpen] = useState(false);
  const [customInput, setCustomInput] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchWater = useCallback(async () => {
    setLoading(true);
    try {
      const [waterRes, profileRes] = await Promise.all([
        get(`/water?date=${selectedDate}`),
        get('/profile'),
      ]);

      if (waterRes.data) {
        setTotalMl(waterRes.data.totalMl || 0);
        setLogs(waterRes.data.logs || []);
      }
      if (profileRes.data?.goal?.waterMl) {
        setGoalMl(profileRes.data.goal.waterMl);
      }
    } catch (err) {
      console.error('Failed to load water:', err);
      toast.error('Failed to load water logs');
    } finally {
      setLoading(false);
    }
  }, [selectedDate]);

  useEffect(() => {
    fetchWater();
  }, [fetchWater]);

  // Quick Add Water
  const handleAddWater = async (amount: number) => {
    setIsSubmitting(true);
    // Optimistic update
    setTotalMl((prev) => prev + amount);

    try {
      const res = await post('/water', { amountMl: amount, date: selectedDate });
      if (res.data) {
        setLogs((prev) => [res.data, ...prev]);
      }
      toast.success(`+${amount}ml water logged!`);
      window.dispatchEvent(new Event('fitsnap-water-logged'));
    } catch {
      toast.error('Failed to log water');
      fetchWater();
    } finally {
      setIsSubmitting(false);
    }
  };

  // Remove Last Glass
  const handleRemoveLatest = async () => {
    setIsSubmitting(true);
    try {
      await del('/water/latest');
      toast.info('Removed last water entry.');
      fetchWater();
      window.dispatchEvent(new Event('fitsnap-water-logged'));
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'No water entries to remove.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Custom Amount Submit
  const handleCustomSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const val = parseInt(customInput, 10);
    if (!val || val <= 0 || val > 3000) {
      toast.error('Please enter a valid amount in ml (1-3000).');
      return;
    }
    handleAddWater(val);
    setCustomModalOpen(false);
    setCustomInput('');
  };

  const progressPercent = Math.min(Math.round((totalMl / (goalMl || 1)) * 100), 100);
  const remainingMl = Math.max(0, goalMl - totalMl);

  return (
    <div className="max-w-3xl mx-auto space-y-6 animate-in fade-in duration-200 pb-12">
      
      {/* Top Header */}
      <div>
        <span className="text-xs font-semibold uppercase tracking-wider text-[#0284C7] font-mono">
          HYDRATION TRACKER
        </span>
        <h1 className="text-2xl sm:text-3xl font-bold font-display text-[#0F172A] dark:text-white tracking-tight">
          Water Intake
        </h1>
        <p className="text-xs sm:text-sm text-[#475569] dark:text-[#94A3B8] mt-0.5">
          {isToday ? 'Maintain metabolic efficiency and cognitive alertness with consistent hydration.' : `Hydration logs for ${selectedDate}.`}
        </p>
      </div>

      {/* Main Hydration Card with 3D Water Glass */}
      <div className="bg-white dark:bg-[#12151D] rounded-card border border-[#0F172A]/[0.08] dark:border-white/10 shadow-subtle p-6 sm:p-8 space-y-6">
        
        <div className="flex flex-col sm:flex-row items-center justify-between gap-6">
          <div className="space-y-2 text-center sm:text-left flex-1">
            <span className="text-xs font-semibold text-[#475569] dark:text-[#94A3B8] uppercase tracking-wider font-mono">
              Daily Target: {goalMl} ml
            </span>
            <div className="flex items-baseline justify-center sm:justify-start gap-2">
              <span className="text-4xl sm:text-5xl font-bold font-display text-[#0F172A] dark:text-white">
                {totalMl}
              </span>
              <span className="text-base text-[#94A3B8]">/ {goalMl} ml</span>
            </div>

            <div className="flex items-center justify-center sm:justify-start gap-2 pt-1">
              <span className="text-sm font-bold text-[#0284C7] bg-[#0284C7]/10 px-3 py-1 rounded-full">
                {progressPercent}% Complete
              </span>
              {remainingMl > 0 ? (
                <span className="text-xs text-[#94A3B8]">
                  ({remainingMl} ml left)
                </span>
              ) : (
                <span className="text-xs font-semibold text-[#16A34A] flex items-center gap-1">
                  <CheckCircle2 className="w-4 h-4" /> Goal Reached!
                </span>
              )}
            </div>
          </div>

          {/* Procedural 3D Water Glass */}
          <div className="w-40 h-52 relative flex-shrink-0">
            <SceneWrapper height="208px" fallbackIcon="water">
              <WaterGlass3D currentMl={totalMl} goalMl={goalMl} isPouring={isSubmitting} />
            </SceneWrapper>
          </div>
        </div>

        {/* Large Visual Progress Bar */}
        <div className="w-full h-3 rounded-full bg-[#F7F8FA] dark:bg-white/10 overflow-hidden border border-[#0F172A]/[0.04]">
          <div
            className="h-full bg-gradient-to-r from-[#38BDF8] to-[#0284C7] rounded-full transition-all duration-500"
            style={{ width: `${progressPercent}%` }}
          />
        </div>

        {/* Quick Stepper Buttons */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
          <button
            onClick={() => handleAddWater(250)}
            disabled={isSubmitting}
            className="py-3 px-4 rounded-xl bg-[#0284C7]/10 hover:bg-[#0284C7]/20 text-[#0284C7] text-sm font-semibold transition-all flex items-center justify-center gap-2 active:scale-95"
          >
            <Plus className="w-4 h-4" />
            <span>+250 ml (1 glass)</span>
          </button>

          <button
            onClick={() => handleAddWater(500)}
            disabled={isSubmitting}
            className="py-3 px-4 rounded-xl bg-[#0284C7]/10 hover:bg-[#0284C7]/20 text-[#0284C7] text-sm font-semibold transition-all flex items-center justify-center gap-2 active:scale-95"
          >
            <Plus className="w-4 h-4" />
            <span>+500 ml (1 bottle)</span>
          </button>

          <button
            onClick={() => setCustomModalOpen(true)}
            className="py-3 px-4 rounded-xl bg-[#F7F8FA] dark:bg-white/5 hover:bg-slate-200 dark:hover:bg-white/10 text-[#0F172A] dark:text-white text-sm font-semibold transition-all flex items-center justify-center gap-1.5"
          >
            <span>Custom ml</span>
          </button>

          <button
            onClick={handleRemoveLatest}
            disabled={isSubmitting || totalMl === 0}
            className="py-3 px-4 rounded-xl bg-red-50 dark:bg-red-500/10 hover:bg-red-100 dark:hover:bg-red-500/20 text-[#DC2626] text-sm font-semibold transition-all flex items-center justify-center gap-1.5 disabled:opacity-40"
          >
            <Minus className="w-4 h-4" />
            <span>Remove Last Glass</span>
          </button>
        </div>

      </div>

      {/* Today's Water Logs Timeline */}
      <div className="bg-white dark:bg-[#12151D] rounded-card border border-[#0F172A]/[0.08] dark:border-white/10 shadow-subtle p-6 space-y-4">
        <h2 className="text-base font-bold font-display text-[#0F172A] dark:text-white">
          Logged Intake Today ({logs.length} entries)
        </h2>

        {logs.length > 0 ? (
          <div className="divide-y divide-[#0F172A]/[0.06] dark:divide-white/10">
            {logs.map((log) => {
              const timeStr = new Date(log.date || log.createdAt).toLocaleTimeString([], {
                hour: '2-digit',
                minute: '2-digit',
              });
              return (
                <div key={log.id} className="py-3 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-[#0284C7]/10 text-[#0284C7] flex items-center justify-center">
                      <Droplets className="w-4 h-4" />
                    </div>
                    <div>
                      <span className="text-sm font-bold text-[#0F172A] dark:text-white block">
                        +{log.amountMl} ml
                      </span>
                      <span className="text-[11px] text-[#94A3B8]">
                        {log.source === 'quick' ? 'Quick top bar action' : 'Manual entry'}
                      </span>
                    </div>
                  </div>

                  <span className="font-mono text-xs text-[#94A3B8]">{timeStr}</span>
                </div>
              );
            })}
          </div>
        ) : (
          <p className="text-xs text-[#94A3B8] py-4 text-center">
            No water logged yet for this date. Click +250ml or +500ml above to get started!
          </p>
        )}
      </div>

      {/* Custom Amount Modal */}
      {customModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            onClick={() => setCustomModalOpen(false)}
            className="absolute inset-0 bg-[#0F172A]/50 backdrop-blur-sm"
          />

          <div className="relative w-full max-w-sm bg-white dark:bg-[#12151D] rounded-card p-6 shadow-lifted border border-[#0F172A]/[0.08] dark:border-white/10 z-10">
            <h3 className="text-base font-bold font-display text-[#0F172A] dark:text-white mb-1">
              Log Custom Water Amount
            </h3>
            <p className="text-xs text-[#475569] dark:text-[#94A3B8] mb-4">
              Enter volume in milliliters (ml).
            </p>

            <form onSubmit={handleCustomSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-[#0F172A] dark:text-white mb-1">
                  Volume (ml)
                </label>
                <input
                  type="number"
                  step="50"
                  value={customInput}
                  onChange={(e) => setCustomInput(e.target.value)}
                  placeholder="e.g. 350"
                  autoFocus
                  required
                  className="w-full px-3.5 py-2.5 rounded-xl border border-[#0F172A]/[0.15] dark:border-white/15 bg-white dark:bg-white/5 text-sm text-[#0F172A] dark:text-white focus:outline-none focus:border-[#2F5BFF]"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setCustomModalOpen(false)}
                  className="flex-1 py-2 rounded-xl text-xs font-semibold text-[#475569] dark:text-[#94A3B8] hover:bg-[#F7F8FA] dark:hover:bg-white/5 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2 rounded-xl text-xs font-semibold text-white bg-[#0284C7] hover:bg-[#0369a1] transition-colors shadow-subtle"
                >
                  Log Water
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};

export default WaterTracker;
