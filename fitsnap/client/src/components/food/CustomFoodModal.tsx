/**
 * FitSnap - CustomFoodModal Component
 * Interactive creator for custom foods with visual Nutrition Facts Label preview.
 */

import React, { useState } from 'react';
import { X, Sparkles, Check } from 'lucide-react';
import { post } from '../../api/client';
import { toast } from '../ui/Toast';

interface CustomFoodModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export const CustomFoodModal: React.FC<CustomFoodModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const [name, setName] = useState('');
  const [brand, setBrand] = useState('');
  const [servingSize, setServingSize] = useState('100g');
  const [servingG, setServingG] = useState('100');
  const [caloriesKcal, setCaloriesKcal] = useState('');
  const [proteinG, setProteinG] = useState('');
  const [carbsG, setCarbsG] = useState('');
  const [fatG, setFatG] = useState('');
  const [fiberG, setFiberG] = useState('0');
  const [sugarG, setSugarG] = useState('0');
  const [sodiumMg, setSodiumMg] = useState('0');
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast.error('Food name is required.');
      return;
    }
    if (!caloriesKcal || Number(caloriesKcal) < 0) {
      toast.error('Valid calories value is required.');
      return;
    }

    setIsSubmitting(true);
    try {
      await post('/food/custom', {
        name: name.trim(),
        brand: brand.trim() || undefined,
        servingSize: servingSize.trim() || `${servingG}g`,
        servingG: Number(servingG) || 100,
        caloriesKcal: Number(caloriesKcal),
        proteinG: Number(proteinG) || 0,
        carbsG: Number(carbsG) || 0,
        fatG: Number(fatG) || 0,
        fiberG: Number(fiberG) || 0,
        sugarG: Number(sugarG) || 0,
        sodiumMg: Number(sodiumMg) || 0,
      });

      toast.success(`Custom food "${name}" created!`);
      onSuccess?.();
      onClose();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to create custom food.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="bg-white dark:bg-[#12151D] rounded-2xl max-w-2xl w-full border border-[#0F172A]/[0.08] dark:border-white/10 shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#0F172A]/[0.08] dark:border-white/10 flex-shrink-0">
          <div>
            <h3 className="text-base font-bold text-[#0F172A] dark:text-white">Create Custom Food</h3>
            <p className="text-xs text-[#475569] dark:text-[#94A3B8]">Enter nutrition information from the product label</p>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-[#94A3B8] hover:text-[#0F172A] dark:hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto flex-1 grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Inputs Form */}
          <form onSubmit={handleSubmit} id="custom-food-form" className="space-y-3.5">
            <div>
              <label className="block text-[11px] font-semibold text-[#475569] dark:text-[#94A3B8] uppercase tracking-wider mb-1">
                Food Name *
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Masala Oats, High-Protein Curd"
                className="w-full px-3 py-2 text-sm rounded-xl border border-[#0F172A]/15 dark:border-white/15 bg-transparent text-[#0F172A] dark:text-white focus:outline-none focus:border-[#2F5BFF]"
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-[#475569] dark:text-[#94A3B8] uppercase tracking-wider mb-1">
                Brand (Optional)
              </label>
              <input
                type="text"
                value={brand}
                onChange={(e) => setBrand(e.target.value)}
                placeholder="e.g. Amul, Quaker"
                className="w-full px-3 py-2 text-sm rounded-xl border border-[#0F172A]/15 dark:border-white/15 bg-transparent text-[#0F172A] dark:text-white focus:outline-none focus:border-[#2F5BFF]"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-semibold text-[#475569] dark:text-[#94A3B8] uppercase tracking-wider mb-1">
                  Serving Description
                </label>
                <input
                  type="text"
                  value={servingSize}
                  onChange={(e) => setServingSize(e.target.value)}
                  placeholder="1 scoop, 1 bowl"
                  className="w-full px-3 py-2 text-sm rounded-xl border border-[#0F172A]/15 dark:border-white/15 bg-transparent text-[#0F172A] dark:text-white focus:outline-none focus:border-[#2F5BFF]"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-[#475569] dark:text-[#94A3B8] uppercase tracking-wider mb-1">
                  Serving Weight (g) *
                </label>
                <input
                  type="number"
                  required
                  min="1"
                  value={servingG}
                  onChange={(e) => setServingG(e.target.value)}
                  placeholder="100"
                  className="w-full px-3 py-2 text-sm font-mono rounded-xl border border-[#0F172A]/15 dark:border-white/15 bg-transparent text-[#0F172A] dark:text-white focus:outline-none focus:border-[#2F5BFF]"
                />
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-[#475569] dark:text-[#94A3B8] uppercase tracking-wider mb-1">
                Calories (kcal per serving) *
              </label>
              <input
                type="number"
                required
                min="0"
                value={caloriesKcal}
                onChange={(e) => setCaloriesKcal(e.target.value)}
                placeholder="250"
                className="w-full px-3 py-2 text-sm font-bold font-mono rounded-xl border border-[#0F172A]/15 dark:border-white/15 bg-transparent text-[#0F172A] dark:text-white focus:outline-none focus:border-[#2F5BFF]"
              />
            </div>

            <div className="grid grid-cols-3 gap-2">
              <div>
                <label className="block text-[10px] font-bold text-[#2F5BFF] uppercase mb-1">
                  Protein (g)
                </label>
                <input
                  type="number"
                  step="0.1"
                  min="0"
                  value={proteinG}
                  onChange={(e) => setProteinG(e.target.value)}
                  placeholder="0"
                  className="w-full px-2.5 py-1.5 text-xs font-mono rounded-lg border border-[#0F172A]/15 dark:border-white/15 bg-transparent text-[#0F172A] dark:text-white focus:outline-none focus:border-[#2F5BFF]"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-[#10B981] uppercase mb-1">
                  Carbs (g)
                </label>
                <input
                  type="number"
                  step="0.1"
                  min="0"
                  value={carbsG}
                  onChange={(e) => setCarbsG(e.target.value)}
                  placeholder="0"
                  className="w-full px-2.5 py-1.5 text-xs font-mono rounded-lg border border-[#0F172A]/15 dark:border-white/15 bg-transparent text-[#0F172A] dark:text-white focus:outline-none focus:border-[#10B981]"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-[#F59E0B] uppercase mb-1">
                  Fat (g)
                </label>
                <input
                  type="number"
                  step="0.1"
                  min="0"
                  value={fatG}
                  onChange={(e) => setFatG(e.target.value)}
                  placeholder="0"
                  className="w-full px-2.5 py-1.5 text-xs font-mono rounded-lg border border-[#0F172A]/15 dark:border-white/15 bg-transparent text-[#0F172A] dark:text-white focus:outline-none focus:border-[#F59E0B]"
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2 pt-1">
              <div>
                <label className="block text-[10px] font-semibold text-[#475569] dark:text-[#94A3B8] uppercase mb-1">
                  Fiber (g)
                </label>
                <input
                  type="number"
                  step="0.1"
                  min="0"
                  value={fiberG}
                  onChange={(e) => setFiberG(e.target.value)}
                  placeholder="0"
                  className="w-full px-2 py-1.5 text-xs font-mono rounded-lg border border-[#0F172A]/15 dark:border-white/15 bg-transparent text-[#0F172A] dark:text-white focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-[10px] font-semibold text-[#475569] dark:text-[#94A3B8] uppercase mb-1">
                  Sugar (g)
                </label>
                <input
                  type="number"
                  step="0.1"
                  min="0"
                  value={sugarG}
                  onChange={(e) => setSugarG(e.target.value)}
                  placeholder="0"
                  className="w-full px-2 py-1.5 text-xs font-mono rounded-lg border border-[#0F172A]/15 dark:border-white/15 bg-transparent text-[#0F172A] dark:text-white focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-[10px] font-semibold text-[#475569] dark:text-[#94A3B8] uppercase mb-1">
                  Sodium (mg)
                </label>
                <input
                  type="number"
                  min="0"
                  value={sodiumMg}
                  onChange={(e) => setSodiumMg(e.target.value)}
                  placeholder="0"
                  className="w-full px-2 py-1.5 text-xs font-mono rounded-lg border border-[#0F172A]/15 dark:border-white/15 bg-transparent text-[#0F172A] dark:text-white focus:outline-none"
                />
              </div>
            </div>
          </form>

          {/* FDA / ICMR Style Nutrition Facts Preview */}
          <div className="bg-[#F8FAFC] dark:bg-[#0B0D12] rounded-xl p-5 border-2 border-black/80 dark:border-white/60 font-sans self-start">
            <h4 className="text-xl font-extrabold tracking-tight border-b-8 border-black dark:border-white pb-0.5">
              Nutrition Facts
            </h4>
            <div className="border-b border-black dark:border-white py-1 text-xs">
              <span className="font-semibold">{name || 'Product Name'}</span>
              {brand && <span className="text-[#64748B] ml-1">({brand})</span>}
            </div>
            <div className="border-b-4 border-black dark:border-white py-1 flex justify-between items-baseline text-xs font-bold">
              <span>Serving size</span>
              <span>{servingSize || '100g'} ({servingG || 100}g)</span>
            </div>
            <div className="border-b-4 border-black dark:border-white py-1.5 flex justify-between items-baseline">
              <span className="text-sm font-extrabold">Calories</span>
              <span className="text-2xl font-black font-mono">{caloriesKcal || 0}</span>
            </div>
            <div className="space-y-1 text-xs border-b border-black dark:border-white py-1.5">
              <div className="flex justify-between font-semibold">
                <span>Total Fat {fatG || 0}g</span>
              </div>
              <div className="flex justify-between font-semibold">
                <span>Total Carbohydrate {carbsG || 0}g</span>
              </div>
              <div className="flex justify-between pl-3 text-[#64748B] dark:text-[#94A3B8]">
                <span>Dietary Fiber {fiberG || 0}g</span>
              </div>
              <div className="flex justify-between pl-3 text-[#64748B] dark:text-[#94A3B8]">
                <span>Total Sugars {sugarG || 0}g</span>
              </div>
              <div className="flex justify-between font-semibold">
                <span>Protein {proteinG || 0}g</span>
              </div>
              <div className="flex justify-between text-[#64748B] dark:text-[#94A3B8]">
                <span>Sodium {sodiumMg || 0}mg</span>
              </div>
            </div>
            <p className="text-[10px] text-[#64748B] dark:text-[#94A3B8] pt-2 italic">
              Verified for custom database search & auto-fill.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-[#0F172A]/[0.08] dark:border-white/10 flex items-center justify-end gap-3 flex-shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-[#475569] dark:text-[#94A3B8] hover:text-[#0F172A] dark:hover:text-white"
          >
            Cancel
          </button>
          <button
            form="custom-food-form"
            type="submit"
            disabled={isSubmitting || !name || !caloriesKcal}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full text-xs font-semibold text-white bg-[#2F5BFF] hover:bg-[#1d41e6] disabled:opacity-50 transition-colors shadow-subtle"
          >
            <Check className="w-4 h-4" />
            <span>{isSubmitting ? 'Saving...' : 'Save Custom Food'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
