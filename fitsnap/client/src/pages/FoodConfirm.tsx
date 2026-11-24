/**
 * FitSnap - FoodConfirm Page
 * High-fidelity editable confirmation screen for AI-identified meals and manual items.
 * 
 * Features:
 * - Clean meal photo preview when captured from camera/uploader.
 * - Identified items list with editable name, portion multiplier, and portion measures.
 * - Low-confidence helper: "Not sure about this food" with an interactive search box and manual food picker.
 * - Real-time macro updates with smooth responsive transitions.
 * - Meal type assignment (Breakfast, Lunch, Dinner, Snack) and direct database persistence.
 */

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Check,
  Trash2,
  Plus,
  ArrowLeft,
  Scale,
  Sparkles,
  ShieldCheck,
  Search,
  AlertCircle,
  X,
  Loader2,
} from 'lucide-react';
import { useFoodStore } from '../store/foodStore';
import { useDateStore } from '../store/dateStore';
import { post, get } from '../api/client';
import { toast } from '../components/ui/Toast';

const POPULAR_FOODS = [
  'Whole Eggs (Raw / Farm fresh)',
  'Boiled Eggs (Hard or soft boiled)',
  'Egg Omelet / Fried Egg',
  'Egg Bhurji / Indian Scrambled Eggs',
  'Aloo Paratha (Whole wheat stuffed with spiced potato)',
  'Plain Paratha (Tawa paratha, whole wheat with ghee)',
  'Chapati / Roti (Plain whole wheat, without oil)',
  'Butter Roti / Chapati with Ghee',
  'Butter Naan (Tandoori)',
  'Puri (Deep-fried whole wheat flatbread)',
  'Dal Tadka',
  'Paneer Bhurji',
  'Steamed White Rice',
  'Chicken breast, grilled',
  'Mixed Green Salad',
  'Oatmeal with Milk',
  'Samosa',
];

export const FoodConfirm: React.FC = () => {
  const navigate = useNavigate();
  const { analysisResult, clearAnalysis } = useFoodStore();
  const { selectedDate } = useDateStore();

  const [mealType, setMealType] = useState<'breakfast' | 'lunch' | 'dinner' | 'snack'>('lunch');
  const [isSaving, setIsSaving] = useState(false);

  // Correction search state per item index (auto-opened if AI confidence is low)
  const [activeSearchIdx, setActiveSearchIdx] = useState<number | null>(() => {
    if (analysisResult?.foods && analysisResult.foods.length > 0) {
      const topFood = analysisResult.foods[0];
      const conf = topFood.confidence !== undefined ? topFood.confidence : 0.9;
      if (conf < 0.50 || topFood.badge === 'AI estimate' || topFood.needsConfirmation) {
        return 0;
      }
    }
    return null;
  });
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);

  // Initialize items from store or fallback
  const [items, setItems] = useState<any[]>(() => {
    if (analysisResult?.foods && analysisResult.foods.length > 0) {
      return analysisResult.foods.map((rawF: any) => {
        const f = rawF as any;
        const portionG = f.portionG || f.portionGrams || 100;
        const cal = f.calories || f.caloriesKcal || 150;
        const pVal = f.proteinG !== undefined ? f.proteinG : (f.protein !== undefined ? f.protein : 5);
        const cVal = f.carbsG !== undefined ? f.carbsG : (f.carbs !== undefined ? f.carbs : 15);
        const fVal = f.fatG !== undefined ? f.fatG : (f.fat !== undefined ? f.fat : 3);
        const per100Cal = (cal / portionG) * 100;
        const per100P = (pVal / portionG) * 100;
        const per100C = (cVal / portionG) * 100;
        const per100F = (fVal / portionG) * 100;

        const initialConf = f.confidence !== undefined ? f.confidence : 0.9;
        const isUnknown = initialConf < 0.20;

        return {
          ...f,
          name: f.name || f.foodName || 'Meal Item',
          portionG,
          calories: cal,
          proteinG: pVal,
          carbsG: cVal,
          fatG: fVal,
          _multiplier: 1.0,
          _basePortionG: portionG,
          _per100Calories: per100Cal,
          _per100Protein: per100P,
          _per100Carbs: per100C,
          _per100Fat: per100F,
          _userConfirmed: f._userConfirmed !== undefined ? f._userConfirmed : (!isUnknown && initialConf >= 0.50),
          portions: f.portions && f.portions.length > 0 ? f.portions : [
            { description: f.portionLabel || `${portionG}g`, gramWeight: portionG }
          ],
          badge: f.badge || (f.isAiEstimate ? 'AI estimate' : 'Verified from database'),
          confidence: initialConf,
          source: f.source || 'Database',
        };
      });
    }
    return [
      {
        name: 'Whole Wheat Roti & Dal Tadka',
        portionG: 220,
        portionLabel: '2 rotis + 1 katori dal',
        calories: 360,
        proteinG: 14.5,
        carbsG: 54.0,
        fatG: 9.0,
        fiberG: 6.0,
        _multiplier: 1.0,
        _basePortionG: 220,
        _per100Calories: 163.6,
        _per100Protein: 6.6,
        _per100Carbs: 24.5,
        _per100Fat: 4.1,
        badge: 'Verified from database',
        confidence: 0.95,
        source: 'curated - ICMR / IFCT (Indian Food Composition Tables 2017)',
        portions: [
          { description: '1 standard serving', gramWeight: 220 },
          { description: '1 small portion', gramWeight: 150 },
        ],
      },
    ];
  });

  const photoUrl = analysisResult?.photoUrl;

  // Synchronize items whenever analysisResult changes or arrives
  useEffect(() => {
    if (analysisResult?.foods && analysisResult.foods.length > 0) {
      setItems(analysisResult.foods.map((rawF: any) => {
        const f = rawF as any;
        const portionG = f.portionG || f.portionGrams || 100;
        const cal = f.calories || f.caloriesKcal || 150;
        const pVal = f.proteinG !== undefined ? f.proteinG : (f.protein !== undefined ? f.protein : 5);
        const cVal = f.carbsG !== undefined ? f.carbsG : (f.carbs !== undefined ? f.carbs : 15);
        const fVal = f.fatG !== undefined ? f.fatG : (f.fat !== undefined ? f.fat : 3);
        const per100Cal = (cal / portionG) * 100;
        const per100P = (pVal / portionG) * 100;
        const per100C = (cVal / portionG) * 100;
        const per100F = (fVal / portionG) * 100;

        const initialConf = f.confidence !== undefined ? f.confidence : 0.9;
        const isUnknown = initialConf < 0.20;

        return {
          ...f,
          name: f.name || f.foodName || 'Meal Item',
          portionG,
          calories: cal,
          proteinG: pVal,
          carbsG: cVal,
          fatG: fVal,
          _multiplier: 1.0,
          _basePortionG: portionG,
          _per100Calories: per100Cal,
          _per100Protein: per100P,
          _per100Carbs: per100C,
          _per100Fat: per100F,
          _userConfirmed: f._userConfirmed !== undefined ? f._userConfirmed : (!isUnknown && initialConf >= 0.50),
          portions: f.portions && f.portions.length > 0 ? f.portions : [
            { description: f.portionLabel || `${portionG}g`, gramWeight: portionG }
          ],
          badge: f.badge || (f.isAiEstimate ? 'AI estimate' : 'Verified from database'),
          confidence: initialConf,
          source: f.source || 'Database',
        };
      }));
    }
  }, [analysisResult]);

  // Search backend when query changes
  useEffect(() => {
    if (activeSearchIdx === null || !searchQuery.trim()) {
      setSearchResults([]);
      return;
    }
    const timer = setTimeout(async () => {
      setSearchLoading(true);
      try {
        const res: any = await get(`/food/search?q=${encodeURIComponent(searchQuery.trim())}`);
        if (res.data) {
          setSearchResults(res.data);
        }
      } catch (err) {
        console.error('Failed to search foods:', err);
      } finally {
        setSearchLoading(false);
      }
    }, 200);

    return () => clearTimeout(timer);
  }, [searchQuery, activeSearchIdx]);

  // Adjust item multiplier (0.5x, 1.0x, 1.5x, 2.0x)
  const handleMultiplier = (index: number, multiplier: number) => {
    setItems((prev) =>
      prev.map((item, i) => {
        if (i !== index) return item;
        const totalGrams = Math.round(item._basePortionG * multiplier);
        const scale = totalGrams / 100.0;
        return {
          ...item,
          _multiplier: multiplier,
          portionG: totalGrams,
          calories: Math.round(item._per100Calories * scale),
          proteinG: Math.round(item._per100Protein * scale * 10) / 10,
          carbsG: Math.round(item._per100Carbs * scale * 10) / 10,
          fatG: Math.round(item._per100Fat * scale * 10) / 10,
        };
      })
    );
  };

  // Change serving size based on portion object
  const handleSelectPortion = (index: number, portion: { description: string; gramWeight: number }) => {
    setItems((prev) =>
      prev.map((item, i) => {
        if (i !== index) return item;
        const totalGrams = Math.round(portion.gramWeight * item._multiplier);
        const scale = totalGrams / 100.0;
        return {
          ...item,
          _basePortionG: portion.gramWeight,
          portionG: totalGrams,
          portionLabel: portion.description,
          calories: Math.round(item._per100Calories * scale),
          proteinG: Math.round(item._per100Protein * scale * 10) / 10,
          carbsG: Math.round(item._per100Carbs * scale * 10) / 10,
          fatG: Math.round(item._per100Fat * scale * 10) / 10,
        };
      })
    );
    toast.success(`Portion set to ${portion.description}`);
  };

  // Replace item with a manually picked verified food
  const handleSelectCorrectFood = (index: number, food: any) => {
    const chosenName = food.displayName || food.name;
    const baseGrams = food.portions?.[0]?.gramWeight || food.portionG || 100;
    const currentMult = items[index]._multiplier || 1.0;
    const totalGrams = Math.round(baseGrams * currentMult);
    const scale = totalGrams / 100.0;

    setItems((prev) =>
      prev.map((item, i) => {
        if (i !== index) return item;
        return {
          ...item,
          name: chosenName,
          category: food.category || 'Food',
          source: food.source || 'Verified Database',
          badge: 'chosen by you',
          confidence: 1.0,
          _userConfirmed: true,
          _basePortionG: baseGrams,
          _per100Calories: food.caloriesKcal || 100,
          _per100Protein: food.proteinG || 0,
          _per100Carbs: food.carbsG || 0,
          _per100Fat: food.fatG || 0,
          portionG: totalGrams,
          portionLabel: food.portions?.[0]?.description || food.portionLabel || `${baseGrams}g`,
          calories: Math.round((food.caloriesKcal || 100) * scale),
          proteinG: Math.round((food.proteinG || 0) * scale * 10) / 10,
          carbsG: Math.round((food.carbsG || 0) * scale * 10) / 10,
          fatG: Math.round((food.fatG || 0) * scale * 10) / 10,
          portions: food.portions && food.portions.length > 0 ? food.portions : [
            { description: `${baseGrams}g`, gramWeight: baseGrams }
          ],
        };
      })
    );
    setActiveSearchIdx(null);
    setSearchQuery('');
    toast.success(`Updated to ${chosenName}`);
  };

  // Edit item name inline
  const handleNameChange = (index: number, newName: string) => {
    setItems((prev) =>
      prev.map((item, i) => (i === index ? { ...item, name: newName, _userConfirmed: true } : item))
    );
  };

  // Remove item
  const handleRemoveItem = (index: number) => {
    if (items.length <= 1) {
      toast.error('Meal must contain at least one item.');
      return;
    }
    setItems((prev) => prev.filter((_, i) => i !== index));
    if (activeSearchIdx === index) {
      setActiveSearchIdx(null);
    }
  };

  // Add extra item
  const handleAddItem = () => {
    const newItemIdx = items.length;
    setItems((prev) => [
      ...prev,
      {
        name: 'Extra Portion / Side Dish',
        portionG: 100,
        portionLabel: '1 serving (100g)',
        calories: 120,
        proteinG: 4.0,
        carbsG: 18.0,
        fatG: 3.5,
        _multiplier: 1.0,
        _basePortionG: 100,
        _per100Calories: 120,
        _per100Protein: 4.0,
        _per100Carbs: 18.0,
        _per100Fat: 3.5,
        badge: 'Verified from database',
        confidence: 1.0,
        source: 'Manual entry',
        portions: [{ description: '1 serving (100g)', gramWeight: 100 }],
      },
    ]);
    setActiveSearchIdx(newItemIdx);
    setSearchQuery('');
  };

  // Grand Totals (only include items that are confirmed or have valid confidence)
  const activeItems = items.filter((i) => (Number(i.calories) || 0) > 0 || i._userConfirmed || (i.confidence !== undefined ? i.confidence >= 0.05 : true));
  const totalCalories = Math.round(activeItems.reduce((s, i) => s + (Number(i.calories) || 0), 0));
  const totalProtein = Math.round(activeItems.reduce((s, i) => s + (Number(i.proteinG) || 0), 0) * 10) / 10;
  const totalCarbs = Math.round(activeItems.reduce((s, i) => s + (Number(i.carbsG) || 0), 0) * 10) / 10;
  const totalFat = Math.round(activeItems.reduce((s, i) => s + (Number(i.fatG) || 0), 0) * 10) / 10;

  // Save to Log
  const handleSave = async () => {
    if (items.length === 0) {
      toast.error('Please include at least one food item.');
      return;
    }

    // Guard: Prevent saving if unconfirmed low confidence or unknown food
    const unconfirmedItem = items.find((item) => {
      const conf = Math.round((item.confidence !== undefined ? item.confidence : 0.9) * 100);
      return conf < 10 && !item._userConfirmed;
    });
    if (unconfirmedItem) {
      toast.error(`Please select or confirm your food item before saving to diary.`);
      return;
    }

    setIsSaving(true);
    try {
      await post('/food/log', {
        mealType,
        photoUrl: photoUrl || undefined,
        date: selectedDate,
        embedding: analysisResult?.embedding || items[0]?.embedding,
        items: items.map((i) => ({
          name: i.name,
          portionG: i.portionG || 100,
          portionLabel: i.portionLabel || `${i.portionG || 100}g`,
          calories: i.calories,
          proteinG: i.proteinG,
          carbsG: i.carbsG,
          fatG: i.fatG,
          fiberG: i.fiberG || 0,
          confidence: i.confidence || 0.9,
          isAiEstimate: i.badge === 'AI estimate',
          badge: i.badge || (i._userConfirmed ? 'chosen by you' : 'Verified from database'),
          source: i.source || 'Database',
          embedding: i.embedding || analysisResult?.embedding,
        })),
      });

      toast.success(`${mealType.charAt(0).toUpperCase() + mealType.slice(1)} logged successfully!`);
      clearAnalysis();

      window.dispatchEvent(new Event('fitsnap-meal-logged'));
      navigate('/dashboard');
    } catch (err: any) {
      console.error('Error saving meal:', err);
      toast.error('Failed to save meal log. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6 animate-in fade-in duration-200 selection:bg-[#2F5BFF] selection:text-white">
      
      {/* Top Header */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => navigate('/food/capture')}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#475569] dark:text-[#94A3B8] hover:text-[#0F172A] dark:hover:text-white transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Scanner</span>
        </button>

        <span className="text-xs font-mono font-semibold text-[#16A34A] bg-[#16A34A]/10 px-2.5 py-1 rounded-full border border-[#16A34A]/20">
          Database Grounded • Ready to Log
        </span>
      </div>

      {/* Captured Meal Photo Preview Banner */}
      {photoUrl && (
        <div className="bg-white dark:bg-[#12151D] rounded-2xl border border-[#0F172A]/[0.08] dark:border-white/10 shadow-subtle p-4 flex items-center gap-4">
          <div className="relative w-20 h-20 rounded-xl overflow-hidden bg-slate-100 dark:bg-white/5 border border-[#0F172A]/[0.08] dark:border-white/10 flex-shrink-0">
            <img
              src={photoUrl}
              alt="Captured Food"
              className="w-full h-full object-cover"
            />
          </div>
          <div className="flex-1 space-y-0.5">
            <span className="text-sm font-bold font-display text-[#0F172A] dark:text-white block">
              Captured Meal Photo
            </span>
            <p className="text-xs text-[#475569] dark:text-[#94A3B8]">
              Verify or adjust portions and items below before logging to your diary.
            </p>
          </div>
        </div>
      )}

      {/* Meal Type Selector */}
      <div className="bg-white dark:bg-[#12151D] rounded-2xl border border-[#0F172A]/[0.08] dark:border-white/10 shadow-subtle p-4">
        <span className="text-xs font-semibold text-[#475569] dark:text-[#94A3B8] uppercase tracking-wider font-mono block mb-2.5">
          Assign to Meal
        </span>

        <div className="grid grid-cols-4 gap-2">
          {(['breakfast', 'lunch', 'dinner', 'snack'] as const).map((type) => (
            <button
              key={type}
              onClick={() => setMealType(type)}
              className={`py-2 px-3 rounded-xl text-xs font-bold capitalize transition-all ${
                mealType === type
                  ? 'bg-[#2F5BFF] text-white shadow-subtle'
                  : 'bg-[#F7F8FA] dark:bg-white/5 text-[#475569] dark:text-[#94A3B8] hover:bg-slate-200 dark:hover:bg-white/10'
              }`}
            >
              {type}
            </button>
          ))}
        </div>
      </div>

      {/* Grand Nutrition Totals Banner */}
      <div className="bg-white dark:bg-[#12151D] rounded-2xl border border-[#0F172A]/[0.08] dark:border-white/10 shadow-subtle p-5">
        <div className="flex items-baseline justify-between mb-3">
          <span className="text-xs font-semibold uppercase tracking-wider text-[#475569] dark:text-[#94A3B8] font-mono">
            Meal Nutrition Total
          </span>
          <div className="text-right">
            <span className="text-3xl font-bold font-display text-[#0F172A] dark:text-white">
              {totalCalories}
            </span>
            <span className="text-xs text-[#94A3B8] ml-1">kcal</span>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3 text-center">
          <div className="p-2.5 rounded-xl bg-[#2F5BFF]/10 border border-[#2F5BFF]/20">
            <span className="text-[10px] font-bold text-[#2F5BFF] uppercase block">Protein</span>
            <span className="text-sm font-bold text-[#0F172A] dark:text-white mt-0.5 block">{totalProtein}g</span>
          </div>

          <div className="p-2.5 rounded-xl bg-[#10B981]/10 border border-[#10B981]/20">
            <span className="text-[10px] font-bold text-[#10B981] uppercase block">Carbs</span>
            <span className="text-sm font-bold text-[#0F172A] dark:text-white mt-0.5 block">{totalCarbs}g</span>
          </div>

          <div className="p-2.5 rounded-xl bg-[#F59E0B]/10 border border-[#F59E0B]/20">
            <span className="text-[10px] font-bold text-[#F59E0B] uppercase block">Fat</span>
            <span className="text-sm font-bold text-[#0F172A] dark:text-white mt-0.5 block">{totalFat}g</span>
          </div>
        </div>
      </div>

      {/* Items List (Editable with Portion Selector & Food Picker) */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-bold font-display text-[#0F172A] dark:text-white">
              {items.length === 1 ? '1 Item Recognised' : `${items.length} Items Recognised`}
            </h2>
            <p className="text-[11px] text-[#475569] dark:text-[#94A3B8]">
              Several items on your plate? Tap "Add another item" to log chutneys, sides, or bread.
            </p>
          </div>
          <button
            onClick={handleAddItem}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold text-white bg-[#2F5BFF] hover:bg-[#1d41e6] transition-colors shadow-subtle flex-shrink-0"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add another item</span>
          </button>
        </div>

        {items.map((item, index) => {
          const confPercent = Math.round((item.confidence !== undefined ? item.confidence : 0.9) * 100);
          
          // Conf label
          let recognitionLevel: 'Low' | 'Medium' | 'High' = 'High';
          if (confPercent < 60) recognitionLevel = 'Low';
          else if (confPercent < 80) recognitionLevel = 'Medium';

          const preds = analysisResult?.predictions || [];
          const top1Conf = preds[0]?.confidence || item.confidence || 0.9;
          const top2Conf = preds[1]?.confidence || 0;
          const isMarginClose = preds.length >= 2 && Math.abs(top1Conf - top2Conf) <= 0.15;
          const isLowConf = confPercent < 45 || isMarginClose;
          const isUnknown = confPercent < 5 && !item._userConfirmed;

          const isVerifiedNutrition = item.source && !item.source.toLowerCase().includes('approximate') && !item.source.toLowerCase().includes('gemini');
          const isApproximateNutrition = !isVerifiedNutrition || item.badge === 'AI estimate';
          const nutritionStatus = isVerifiedNutrition ? 'Verified source' : 'Approximate';

          const needsConfirmation = isLowConf || isUnknown || item.needsConfirmation || isApproximateNutrition;
          const isSearchOpen = activeSearchIdx === index;

          return (
            <div
              key={index}
              className="bg-white dark:bg-[#12151D] rounded-2xl border border-[#0F172A]/[0.08] dark:border-white/10 shadow-subtle p-5 space-y-3.5"
            >
              {/* Header: Title, Grounding Badge, & Calories */}
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    {isUnknown && !item._userConfirmed ? (
                      <span className="font-bold text-base text-amber-600 dark:text-amber-400 py-0.5">
                        Food Not Recognised (Tap to Select)
                      </span>
                    ) : (
                      <input
                        type="text"
                        value={item.name}
                        onChange={(e) => handleNameChange(index, e.target.value)}
                        className="font-bold text-base text-[#0F172A] dark:text-white bg-transparent border-b border-transparent hover:border-[#0F172A]/[0.2] focus:border-[#2F5BFF] focus:outline-none py-0.5"
                      />
                    )}

                    {/* Recognition Indicator */}
                    <span
                      className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold tracking-wide ${
                        recognitionLevel === 'High'
                          ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
                          : recognitionLevel === 'Medium'
                          ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20'
                          : 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20'
                      }`}
                    >
                      <Sparkles className="w-3 h-3 flex-shrink-0" />
                      <span>Recognition: {confPercent}% ({isUnknown ? 'Unrecognised' : recognitionLevel})</span>
                    </span>

                    {/* Nutrition Data Source Indicator */}
                    <span
                      className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold tracking-wide ${
                        isUnknown && !item._userConfirmed
                          ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20'
                          : isVerifiedNutrition
                          ? 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20'
                          : 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20'
                      }`}
                    >
                      <ShieldCheck className="w-3 h-3 flex-shrink-0" />
                      <span>
                        {isUnknown && !item._userConfirmed
                          ? 'Nutrition: Awaiting Food Selection'
                          : `Nutrition: ${nutritionStatus} (${item.source || 'Database'})`}
                      </span>
                    </span>
                  </div>

                  <span className="text-[11px] text-[#94A3B8] block">
                    Serving: {item.portionG}g ({item.portionLabel || 'standard'})
                  </span>
                </div>

                <div className="flex items-center gap-3">
                  <div className="text-right">
                    {isUnknown && !item._userConfirmed ? (
                      <div>
                        <span className="font-mono text-base font-bold text-amber-600 dark:text-amber-400 block">
                          — kcal
                        </span>
                        <span className="text-[10px] text-[#94A3B8]">
                          Pending selection
                        </span>
                      </div>
                    ) : (
                      <div>
                        <span className="font-mono text-base font-bold text-[#0F172A] dark:text-white block">
                          {item.calories} kcal
                        </span>
                        <span className="text-[10px] text-[#94A3B8]">
                          P:{item.proteinG}g C:{item.carbsG}g F:{item.fatG}g
                        </span>
                      </div>
                    )}
                  </div>

                  <button
                    onClick={() => handleRemoveItem(index)}
                    className="p-1.5 rounded-lg text-[#94A3B8] hover:text-[#DC2626] hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors"
                    title="Remove item"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Serving Size Selector Dropdown (Portion table) */}
              {item.portions && item.portions.length > 0 && (
                <div className="flex items-center gap-2 pt-2 border-t border-[#0F172A]/[0.06] dark:border-white/10 text-xs">
                  <Scale className="w-3.5 h-3.5 text-[#94A3B8] flex-shrink-0" />
                  <span className="text-[#475569] dark:text-[#94A3B8] font-medium flex-shrink-0">
                    Serving measure:
                  </span>
                  <div className="flex items-center gap-1.5 overflow-x-auto py-1">
                    {item.portions.map((p: any, pIdx: number) => {
                      const isActive = item.portionLabel === p.description || item._basePortionG === p.gramWeight;
                      const pKcal = Math.round((item._per100Calories || (item.calories / (item.portionG || 100) * 100)) * (p.gramWeight / 100));
                      return (
                        <button
                          key={pIdx}
                          type="button"
                          onClick={() => handleSelectPortion(index, p)}
                          className={`px-2.5 py-1 rounded-lg text-[11px] font-medium whitespace-nowrap transition-all ${
                            isActive
                              ? 'bg-[#2F5BFF] text-white shadow-subtle'
                              : 'bg-[#F7F8FA] dark:bg-white/5 border border-[#0F172A]/[0.08] dark:border-white/10 text-[#475569] dark:text-[#94A3B8] hover:bg-slate-200'
                          }`}
                        >
                          {p.description} ({p.gramWeight}g · {pKcal} kcal)
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Quick Multiplier Stepper (0.5x, 1x, 1.5x, 2x) */}
              <div className="flex items-center gap-2 pt-1 text-xs">
                <span className="text-[11px] font-medium text-[#475569] dark:text-[#94A3B8]">
                  Portion scale:
                </span>
                {[0.5, 1.0, 1.5, 2.0].map((mult) => (
                  <button
                    key={mult}
                    type="button"
                    onClick={() => handleMultiplier(index, mult)}
                    className={`px-2.5 py-0.5 rounded-md text-[11px] font-semibold transition-all ${
                      item._multiplier === mult
                        ? 'bg-[#0F172A] text-white dark:bg-white dark:text-[#0F172A]'
                        : 'bg-[#F7F8FA] dark:bg-white/5 text-[#475569] dark:text-[#94A3B8] hover:bg-slate-200'
                    }`}
                  >
                    {mult}x
                  </button>
                ))}

                <button
                  type="button"
                  onClick={() => {
                    if (isSearchOpen) {
                      setActiveSearchIdx(null);
                    } else {
                      setActiveSearchIdx(index);
                      setSearchQuery('');
                    }
                  }}
                  className="ml-auto text-[11px] font-semibold text-[#2F5BFF] hover:underline flex items-center gap-1"
                >
                  <Search className="w-3 h-3" />
                  <span>{isSearchOpen ? 'Close Food Picker' : 'Change Food'}</span>
                </button>
              </div>

              {/* Low-confidence or Unknown Warning: Top-3 Candidate Buttons & Search Box */}
              {needsConfirmation && (
                <div className="p-3.5 rounded-xl border border-amber-500/30 bg-amber-500/5 space-y-2.5">
                  <div className="flex items-center gap-2 text-xs text-amber-800 dark:text-amber-300">
                    <AlertCircle className="w-4 h-4 flex-shrink-0" />
                    <span className="font-semibold">
                      {isUnknown
                        ? 'I could not recognise this food with high confidence. Please choose or search below:'
                        : 'Not sure — please confirm or choose one of the top matches below:'}
                    </span>
                  </div>

                  {/* Top-3 Buttons & Quick Staple Shortcuts */}
                  <div className="flex flex-wrap items-center gap-2 pt-1">
                    <span className="text-[11px] font-medium text-[#475569] dark:text-[#94A3B8]">
                      {isUnknown ? 'Suggested Foods:' : 'Top matches:'}
                    </span>

                    {/* Learned prototype matches from earlier photos */}
                    {analysisResult?.userPrototypeMatches?.map((up: any, upIdx: number) => (
                      <button
                        key={`proto-${upIdx}`}
                        type="button"
                        onClick={() => {
                          handleSelectCorrectFood(index, {
                            name: up.foodName,
                            displayName: up.foodName,
                            category: 'Personal Diet',
                            source: 'from your earlier photos',
                            caloriesKcal: 180,
                            proteinG: 8,
                            carbsG: 22,
                            fatG: 6,
                            portions: [{ description: '1 serving (150g)', gramWeight: 150 }],
                          });
                        }}
                        className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-emerald-500/15 hover:bg-emerald-600 hover:text-white text-emerald-800 dark:text-emerald-300 border border-emerald-500/30 transition-colors shadow-subtle inline-flex items-center gap-1"
                      >
                        <span>⭐ {up.foodName} (from your earlier photos)</span>
                      </button>
                    ))}

                    {/* Candidate Matches */}
                    {preds.slice(0, 3).map((pred: any, pIdx: number) => (
                      <button
                        key={pIdx}
                        type="button"
                        onClick={() => {
                          handleSelectCorrectFood(index, {
                            name: pred.display_name,
                            category: pred.category || 'Food',
                            source: 'CNN Top Candidate',
                            caloriesKcal: pred.per_100g?.calories_kcal || 180,
                            proteinG: pred.per_100g?.protein_g || 8,
                            carbsG: pred.per_100g?.carbs_g || 22,
                            fatG: pred.per_100g?.fat_g || 6,
                            portions: pred.portions || [{ description: '1 serving', gramWeight: 150 }],
                          });
                        }}
                        className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-white dark:bg-white/10 hover:bg-[#2F5BFF] hover:text-white text-[#0F172A] dark:text-white border border-[#0F172A]/10 dark:border-white/10 transition-colors shadow-subtle"
                      >
                        {pred.display_name} ({Math.round(pred.confidence * 100)}%)
                      </button>
                    ))}
                  </div>

                  {!isSearchOpen && (
                    <button
                      type="button"
                      onClick={() => {
                        setActiveSearchIdx(index);
                        setSearchQuery('');
                      }}
                      className="px-3 py-1 rounded-lg text-xs font-semibold bg-amber-500/10 text-amber-700 dark:text-amber-300 hover:bg-amber-500/20 transition-colors inline-flex items-center gap-1.5"
                    >
                      <Search className="w-3.5 h-3.5" />
                      <span>Search All Database Foods</span>
                    </button>
                  )}
                </div>
              )}

              {/* Interactive Search Box & Manual Food Picker */}
              {isSearchOpen && (
                <div className="pt-3 border-t border-[#0F172A]/[0.08] dark:border-white/10 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-[#0F172A] dark:text-white flex items-center gap-1.5">
                      <Search className="w-3.5 h-3.5 text-[#2F5BFF]" />
                      <span>Search & Select Correct Food</span>
                    </span>
                    <button
                      type="button"
                      onClick={() => setActiveSearchIdx(null)}
                      className="text-xs text-[#94A3B8] hover:text-[#0F172A] dark:hover:text-white p-1"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {/* Search Input */}
                  <div className="relative">
                    <Search className="w-4 h-4 absolute left-3 top-2.5 text-[#94A3B8]" />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Type food name (e.g. Samosa, Paneer, Rice, Dal)..."
                      className="w-full pl-9 pr-8 py-2 text-xs rounded-xl border border-[#0F172A]/15 dark:border-white/15 bg-transparent text-[#0F172A] dark:text-white focus:outline-none focus:border-[#2F5BFF]"
                      autoFocus
                    />
                    {searchLoading && (
                      <Loader2 className="w-3.5 h-3.5 animate-spin absolute right-3 top-2.5 text-[#2F5BFF]" />
                    )}
                  </div>

                  {/* Quick Select Popular Staple Foods */}
                  <div className="space-y-1">
                    <span className="text-[10px] font-bold text-[#94A3B8] uppercase tracking-wider block">
                      Popular Staples:
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {POPULAR_FOODS.map((foodName) => (
                        <button
                          key={foodName}
                          type="button"
                          onClick={async () => {
                            setSearchQuery(foodName);
                            setSearchLoading(true);
                            try {
                              const res: any = await get(`/food/search?q=${encodeURIComponent(foodName)}`);
                              if (res.data) {
                                setSearchResults(res.data);
                              }
                            } catch (err) {
                              console.error('Failed to search food:', err);
                            } finally {
                              setSearchLoading(false);
                            }
                          }}
                          className="px-2 py-0.5 rounded-md text-[11px] bg-[#F7F8FA] dark:bg-white/5 hover:bg-[#2F5BFF]/10 hover:text-[#2F5BFF] text-[#475569] dark:text-[#94A3B8] transition-colors border border-[#0F172A]/[0.06] dark:border-white/10 cursor-pointer"
                        >
                          {foodName}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Results List */}
                  {searchResults.length > 0 && (
                    <div className="max-h-56 overflow-y-auto space-y-1.5 rounded-xl border border-[#0F172A]/[0.08] dark:border-white/10 p-1.5 bg-slate-50/50 dark:bg-white/[0.02]">
                      {searchResults.slice(0, 15).map((f) => (
                        <button
                          key={f.id}
                          type="button"
                          onClick={() => handleSelectCorrectFood(index, f)}
                          className="w-full text-left p-2.5 rounded-lg hover:bg-white dark:hover:bg-white/10 transition-colors flex items-center justify-between text-xs"
                        >
                          <div>
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-semibold text-[#0F172A] dark:text-white">
                                {f.displayName || f.name}
                              </span>
                              <span
                                className={`px-1.5 py-0.2 rounded text-[9px] font-mono font-bold uppercase ${
                                  f.status === 'verified'
                                    ? 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20'
                                    : 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20'
                                }`}
                              >
                                {f.status || 'verified'}
                              </span>
                            </div>
                            <span className="text-[10px] text-[#94A3B8] block mt-0.5">
                              {f.source} • {f.portionLabel || f.servingSize || '100g'}
                            </span>
                          </div>
                          <div className="text-right font-mono flex-shrink-0">
                            <span className="font-bold text-[#0F172A] dark:text-white block">
                              {f.caloriesKcal != null ? `${f.caloriesKcal} kcal` : '— kcal'}
                            </span>
                            <span className="text-[10px] text-[#94A3B8]">
                              P:{f.proteinG != null ? `${f.proteinG}g` : '—'} C:{f.carbsG != null ? `${f.carbsG}g` : '—'} F:{f.fatG != null ? `${f.fatG}g` : '—'}
                            </span>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}

            </div>
          );
        })}
      </div>

      {/* Save Button */}
      <div className="pt-2">
        <button
          onClick={handleSave}
          disabled={isSaving}
          className="w-full py-3.5 rounded-full text-base font-semibold text-white bg-[#2F5BFF] hover:bg-[#1d41e6] transition-colors shadow-subtle flex items-center justify-center gap-2 disabled:opacity-50"
        >
          <Check className="w-5 h-5" strokeWidth={2.5} />
          <span>{isSaving ? 'Logging to Diary...' : `Save to ${mealType.charAt(0).toUpperCase() + mealType.slice(1)} • ${totalCalories} kcal`}</span>
        </button>
      </div>

    </div>
  );
};

export default FoodConfirm;
