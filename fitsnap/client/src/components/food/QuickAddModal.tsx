/**
 * FitSnap - QuickAddModal Component
 * Allows rapid entry of calories and macros without specifying ingredient details.
 */

import React, { useState } from 'react';
import { X, Zap, Check } from 'lucide-react';
import { post } from '../../api/client';
import { toast } from '../ui/Toast';
import { useDateStore } from '../../store/dateStore';

interface QuickAddModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  defaultMealType?: string;
}

export const QuickAddModal: React.FC<QuickAddModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  defaultMealType = 'snack',
}) => {
  const { selectedDate } = useDateStore();
  const [mealType, setMealType] = useState(defaultMealType);
  const [name, setName] = useState('Quick Calories');
  const [calories, setCalories] = useState('');
  const [proteinG, setProteinG] = useState('');
  const [carbsG, setCarbsG] = useState('');
  const [fatG, setFatG] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const calNum = Number(calories);
    if (!calNum || calNum <= 0) {
      toast.error('Please enter a valid calorie amount.');
      return;
    }

    setIsSubmitting(true);
    try {
      await post('/food/quick-add', {
        mealType,
        name: name.trim() || 'Quick Calories',
        calories: calNum,
        proteinG: Number(proteinG) || 0,
        carbsG: Number(carbsG) || 0,
        fatG: Number(fatG) || 0,
        date: selectedDate,
      });

      toast.success(`Logged ${calNum} kcal to ${mealType}`);
      window.dispatchEvent(new Event('fitsnap-meal-logged'));
      onSuccess?.();
      onClose();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to record quick calories.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="bg-white dark:bg-[#12151D] rounded-2xl max-w-md w-full border border-[#0F172A]/[0.08] dark:border-white/10 shadow-xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#0F172A]/[0.08] dark:border-white/10">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-[#2F5BFF]/10 text-[#2F5BFF] flex items-center justify-center">
              <Zap className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-bold text-[#0F172A] dark:text-white">Quick Add Calories</h3>
              <p className="text-xs text-[#475569] dark:text-[#94A3B8]">Fast manual calorie entry</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-[#94A3B8] hover:text-[#0F172A] dark:hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-[#475569] dark:text-[#94A3B8] uppercase tracking-wider mb-1.5">
              Meal Type
            </label>
            <div className="grid grid-cols-4 gap-2">
              {(['breakfast', 'lunch', 'dinner', 'snack'] as const).map((m) => (
                <button
                  type="button"
                  key={m}
                  onClick={() => setMealType(m)}
                  className={`py-2 text-xs font-semibold rounded-lg capitalize border transition-all ${
                    mealType === m
                      ? 'bg-[#2F5BFF] text-white border-[#2F5BFF]'
                      : 'border-[#0F172A]/10 dark:border-white/10 text-[#475569] dark:text-[#94A3B8] hover:border-[#2F5BFF]/50'
                  }`}
                >
                  {m}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#475569] dark:text-[#94A3B8] uppercase tracking-wider mb-1.5">
              Description (Optional)
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Quick Snack, Afternoon Coffee"
              className="w-full px-3.5 py-2 text-sm rounded-xl border border-[#0F172A]/15 dark:border-white/15 bg-transparent text-[#0F172A] dark:text-white focus:outline-none focus:border-[#2F5BFF]"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#475569] dark:text-[#94A3B8] uppercase tracking-wider mb-1.5">
              Calories (kcal) *
            </label>
            <input
              type="number"
              min="1"
              max="5000"
              required
              value={calories}
              onChange={(e) => setCalories(e.target.value)}
              placeholder="350"
              className="w-full px-3.5 py-2.5 text-lg font-bold font-mono rounded-xl border border-[#0F172A]/15 dark:border-white/15 bg-transparent text-[#0F172A] dark:text-white focus:outline-none focus:border-[#2F5BFF]"
            />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-[11px] font-semibold text-[#2F5BFF] uppercase mb-1">
                Protein (g)
              </label>
              <input
                type="number"
                min="0"
                value={proteinG}
                onChange={(e) => setProteinG(e.target.value)}
                placeholder="0"
                className="w-full px-3 py-1.5 text-sm font-semibold rounded-lg border border-[#0F172A]/15 dark:border-white/15 bg-transparent text-[#0F172A] dark:text-white focus:outline-none focus:border-[#2F5BFF]"
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-[#10B981] uppercase mb-1">
                Carbs (g)
              </label>
              <input
                type="number"
                min="0"
                value={carbsG}
                onChange={(e) => setCarbsG(e.target.value)}
                placeholder="0"
                className="w-full px-3 py-1.5 text-sm font-semibold rounded-lg border border-[#0F172A]/15 dark:border-white/15 bg-transparent text-[#0F172A] dark:text-white focus:outline-none focus:border-[#10B981]"
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-[#F59E0B] uppercase mb-1">
                Fat (g)
              </label>
              <input
                type="number"
                min="0"
                value={fatG}
                onChange={(e) => setFatG(e.target.value)}
                placeholder="0"
                className="w-full px-3 py-1.5 text-sm font-semibold rounded-lg border border-[#0F172A]/15 dark:border-white/15 bg-transparent text-[#0F172A] dark:text-white focus:outline-none focus:border-[#F59E0B]"
              />
            </div>
          </div>

          <div className="pt-2 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-[#475569] dark:text-[#94A3B8] hover:text-[#0F172A] dark:hover:text-white"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !calories}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full text-xs font-semibold text-white bg-[#2F5BFF] hover:bg-[#1d41e6] disabled:opacity-50 transition-colors shadow-subtle"
            >
              <Check className="w-4 h-4" />
              <span>{isSubmitting ? 'Logging...' : 'Log Calories'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
