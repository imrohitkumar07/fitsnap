/**
 * FitSnap - RecipeBuilderModal Component
 * Interactive Recipe Builder with multi-ingredient composition and per-serving nutrition calculations.
 */

import React, { useState } from 'react';
import { X, Plus, Trash2, Check, ChefHat, Search } from 'lucide-react';
import { post, get } from '../../api/client';
import { toast } from '../ui/Toast';

interface IngredientRow {
  name: string;
  amountG: number;
  unitLabel: string;
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
}

interface RecipeBuilderModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export const RecipeBuilderModal: React.FC<RecipeBuilderModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [servings, setServings] = useState(2);
  const [totalTimeMin, setTotalTimeMin] = useState(30);
  const [ingredients, setIngredients] = useState<IngredientRow[]>([
    { name: 'Oats, rolled', amountG: 80, unitLabel: 'g', calories: 300, proteinG: 10, carbsG: 54, fatG: 5 },
    { name: 'Milk, whole', amountG: 200, unitLabel: 'ml/g', calories: 122, proteinG: 6.4, carbsG: 9.6, fatG: 6.6 },
  ]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Quick ingredient search
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  if (!isOpen) return null;

  const handleSearch = async (q: string) => {
    setSearchQuery(q);
    if (!q.trim() || q.trim().length < 2) {
      setSearchResults([]);
      return;
    }
    setIsSearching(true);
    try {
      const res = await get(`/food/search?q=${encodeURIComponent(q)}`);
      setSearchResults(res.data || []);
    } catch {
      // ignore
    } finally {
      setIsSearching(false);
    }
  };

  const addIngredientFromDb = (item: any) => {
    const gramWeight = item.defaultPortion?.gramWeight || 100;
    const per100Cal = item.per100g?.calories || item.caloriesKcal || 100;
    const per100P = item.per100g?.protein || item.proteinG || 0;
    const per100C = item.per100g?.carbs || item.carbsG || 0;
    const per100F = item.per100g?.fat || item.fatG || 0;

    const newRow: IngredientRow = {
      name: item.name,
      amountG: gramWeight,
      unitLabel: 'g',
      calories: Math.round((per100Cal * gramWeight) / 100),
      proteinG: Math.round(((per100P * gramWeight) / 100) * 10) / 10,
      carbsG: Math.round(((per100C * gramWeight) / 100) * 10) / 10,
      fatG: Math.round(((per100F * gramWeight) / 100) * 10) / 10,
    };

    setIngredients([...ingredients, newRow]);
    setSearchQuery('');
    setSearchResults([]);
  };

  const updateIngredientAmount = (index: number, newAmountG: number) => {
    setIngredients((prev) =>
      prev.map((ing, i) => {
        if (i !== index) return ing;
        const ratio = newAmountG / (ing.amountG || 1);
        return {
          ...ing,
          amountG: newAmountG,
          calories: Math.round(ing.calories * ratio),
          proteinG: Math.round(ing.proteinG * ratio * 10) / 10,
          carbsG: Math.round(ing.carbsG * ratio * 10) / 10,
          fatG: Math.round(ing.fatG * ratio * 10) / 10,
        };
      })
    );
  };

  const removeIngredient = (index: number) => {
    setIngredients(ingredients.filter((_, i) => i !== index));
  };

  // Calculations
  const totalCalories = ingredients.reduce((sum, ing) => sum + ing.calories, 0);
  const totalProtein = ingredients.reduce((sum, ing) => sum + ing.proteinG, 0);
  const totalCarbs = ingredients.reduce((sum, ing) => sum + ing.carbsG, 0);
  const totalFat = ingredients.reduce((sum, ing) => sum + ing.fatG, 0);

  const safeServings = Math.max(1, servings);
  const perServingCal = Math.round(totalCalories / safeServings);
  const perServingP = Math.round((totalProtein / safeServings) * 10) / 10;
  const perServingC = Math.round((totalCarbs / safeServings) * 10) / 10;
  const perServingF = Math.round((totalFat / safeServings) * 10) / 10;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast.error('Recipe name is required.');
      return;
    }
    if (ingredients.length === 0) {
      toast.error('At least one ingredient is required.');
      return;
    }

    setIsSubmitting(true);
    try {
      await post('/food/recipe', {
        name: name.trim(),
        description: description.trim() || undefined,
        servings: safeServings,
        totalTimeMin,
        ingredients,
      });

      toast.success(`Recipe "${name}" saved!`);
      onSuccess?.();
      onClose();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to save recipe.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="bg-white dark:bg-[#12151D] rounded-2xl max-w-2xl w-full border border-[#0F172A]/[0.08] dark:border-white/10 shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#0F172A]/[0.08] dark:border-white/10 flex-shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-[#10B981]/10 text-[#10B981] flex items-center justify-center">
              <ChefHat className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-bold text-[#0F172A] dark:text-white">Recipe Builder</h3>
              <p className="text-xs text-[#475569] dark:text-[#94A3B8]">Compute auto per-serving nutrition from ingredients</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-[#94A3B8] hover:text-[#0F172A] dark:hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto flex-1 space-y-5">
          {/* Recipe Meta */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="sm:col-span-2">
              <label className="block text-[11px] font-semibold text-[#475569] dark:text-[#94A3B8] uppercase mb-1">
                Recipe Name *
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Protein Oatmeal Bowl, Dal Palak"
                className="w-full px-3 py-2 text-sm rounded-xl border border-[#0F172A]/15 dark:border-white/15 bg-transparent text-[#0F172A] dark:text-white focus:outline-none focus:border-[#2F5BFF]"
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-[#475569] dark:text-[#94A3B8] uppercase mb-1">
                Servings
              </label>
              <input
                type="number"
                min="1"
                max="50"
                value={servings}
                onChange={(e) => setServings(Number(e.target.value) || 1)}
                className="w-full px-3 py-2 text-sm font-mono rounded-xl border border-[#0F172A]/15 dark:border-white/15 bg-transparent text-[#0F172A] dark:text-white focus:outline-none focus:border-[#2F5BFF]"
              />
            </div>
          </div>

          {/* Add Ingredient Autocomplete */}
          <div className="relative">
            <label className="block text-[11px] font-semibold text-[#475569] dark:text-[#94A3B8] uppercase mb-1">
              Add Ingredient from Database
            </label>
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-2.5 text-[#94A3B8]" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => handleSearch(e.target.value)}
                placeholder="Search food (e.g. rice, paneer, olive oil)..."
                className="w-full pl-9 pr-3.5 py-2 text-sm rounded-xl border border-[#0F172A]/15 dark:border-white/15 bg-transparent text-[#0F172A] dark:text-white focus:outline-none focus:border-[#2F5BFF]"
              />
            </div>

            {/* Dropdown results */}
            {searchResults.length > 0 && (
              <div className="absolute left-0 right-0 top-full mt-1 bg-white dark:bg-[#12151D] border border-[#0F172A]/15 dark:border-white/15 rounded-xl shadow-lg max-h-48 overflow-y-auto z-20">
                {searchResults.map((r) => (
                  <button
                    key={r.id}
                    type="button"
                    onClick={() => addIngredientFromDb(r)}
                    className="w-full text-left px-3.5 py-2 hover:bg-[#2F5BFF]/10 flex items-center justify-between text-xs border-b border-[#0F172A]/5 dark:border-white/5 last:border-0"
                  >
                    <div>
                      <span className="font-semibold text-[#0F172A] dark:text-white">{r.name}</span>
                      <span className="text-[#94A3B8] ml-2 font-mono">{r.caloriesKcal} kcal/100g</span>
                    </div>
                    <span className="text-[#2F5BFF] font-semibold">+ Add</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Ingredients Table */}
          <div className="space-y-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-[#475569] dark:text-[#94A3B8]">
              Ingredients ({ingredients.length})
            </span>
            <div className="border border-[#0F172A]/10 dark:border-white/10 rounded-xl overflow-hidden divide-y divide-[#0F172A]/5 dark:divide-white/5">
              {ingredients.map((ing, idx) => (
                <div key={idx} className="p-3 flex items-center justify-between gap-3 text-xs">
                  <div className="flex-1 min-w-0">
                    <span className="font-semibold text-[#0F172A] dark:text-white truncate block">{ing.name}</span>
                    <span className="text-[#94A3B8] font-mono">
                      {ing.calories} kcal • P: {ing.proteinG}g C: {ing.carbsG}g F: {ing.fatG}g
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min="1"
                      value={ing.amountG}
                      onChange={(e) => updateIngredientAmount(idx, Number(e.target.value) || 1)}
                      className="w-16 px-2 py-1 text-xs font-mono rounded border border-[#0F172A]/15 dark:border-white/15 bg-transparent text-right"
                    />
                    <span className="text-[#94A3B8]">g</span>
                    <button
                      type="button"
                      onClick={() => removeIngredient(idx)}
                      className="p-1 text-[#94A3B8] hover:text-[#DC2626] transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Per Serving Nutrition Summary */}
          <div className="p-4 rounded-xl bg-[#2F5BFF]/5 border border-[#2F5BFF]/15 flex items-center justify-between">
            <div>
              <span className="text-[11px] font-bold text-[#2F5BFF] uppercase tracking-wider block">
                Per Serving ({safeServings} {safeServings === 1 ? 'serving' : 'servings'})
              </span>
              <div className="flex items-baseline gap-2 mt-0.5">
                <span className="text-2xl font-bold font-mono text-[#0F172A] dark:text-white">
                  {perServingCal}
                </span>
                <span className="text-xs text-[#94A3B8]">kcal</span>
              </div>
            </div>

            <div className="flex items-center gap-3 text-xs font-semibold">
              <span className="text-[#2F5BFF]">P: {perServingP}g</span>
              <span className="text-[#10B981]">C: {perServingC}g</span>
              <span className="text-[#F59E0B]">F: {perServingF}g</span>
            </div>
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
            onClick={handleSubmit}
            disabled={isSubmitting || !name || ingredients.length === 0}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full text-xs font-semibold text-white bg-[#2F5BFF] hover:bg-[#1d41e6] disabled:opacity-50 transition-colors shadow-subtle"
          >
            <Check className="w-4 h-4" />
            <span>{isSubmitting ? 'Saving...' : 'Save Recipe'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
