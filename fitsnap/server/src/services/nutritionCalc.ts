/**
 * FitSnap Server - Nutrition & Metabolic Calculation Engine
 * Implements clinical Mifflin-St Jeor equations, safe calorie limits,
 * diet presets (including Indian Vegetarian), macro splits, and goal projections.
 */

import type { ActivityLevel, GoalType, Gender } from '../types.js';

export type DietPreset =
  | 'balanced'
  | 'high_protein'
  | 'low_carb'
  | 'keto'
  | 'vegetarian'
  | 'vegan'
  | 'indian_veg';

/** Activity level multipliers for TDEE calculation */
const ACTIVITY_MULTIPLIERS: Record<string, number> = {
  sedentary: 1.2,
  light: 1.375,
  moderate: 1.55,
  active: 1.725,
  veryActive: 1.9,
  very_active: 1.9,
};

/** Clinical safe minimum daily caloric thresholds */
export const MIN_CALORIES_MALE = 1500;
export const MIN_CALORIES_FEMALE = 1200;

/** Diet preset macro calorie distributions [Protein %, Carbs %, Fat %] */
export const DIET_PRESET_RATIOS: Record<DietPreset, { protein: number; carbs: number; fat: number }> = {
  balanced: { protein: 0.25, carbs: 0.45, fat: 0.30 },
  high_protein: { protein: 0.35, carbs: 0.35, fat: 0.30 },
  low_carb: { protein: 0.30, carbs: 0.20, fat: 0.50 },
  keto: { protein: 0.25, carbs: 0.05, fat: 0.70 },
  vegetarian: { protein: 0.25, carbs: 0.50, fat: 0.25 },
  vegan: { protein: 0.20, carbs: 0.55, fat: 0.25 },
  indian_veg: { protein: 0.20, carbs: 0.55, fat: 0.25 }, // Lentils, legumes, paneer, roti, curd
};

/**
 * Calculate Basal Metabolic Rate using the clinical Mifflin-St Jeor equation.
 * Male:   BMR = 10 × weight(kg) + 6.25 × height(cm) − 5 × age + 5
 * Female: BMR = 10 × weight(kg) + 6.25 × height(cm) − 5 × age − 161
 */
export function calculateBMR(
  weightKg: number,
  heightCm: number,
  age: number,
  gender: Gender
): number {
  const base = 10 * weightKg + 6.25 * heightCm - 5 * age;
  return Math.round(gender === 'male' ? base + 5 : base - 161);
}

/**
 * Calculate Total Daily Energy Expenditure from BMR and physical activity factor.
 */
export function calculateTDEE(bmr: number, activityLevel: ActivityLevel | string): number {
  const multiplier = ACTIVITY_MULTIPLIERS[activityLevel] || 1.375;
  return Math.round(bmr * multiplier);
}

/**
 * Calculates target calories based on weekly rate of weight change with clinical safety rails.
 * 1 kg of fat ≈ 7,700 kcal -> 0.25kg/wk = 275 kcal/day, 0.50kg/wk = 550 kcal/day, 1.0kg/wk = 1100 kcal/day.
 */
export function calculateTargetCalories(
  tdee: number,
  goal: GoalType,
  gender: Gender = 'male',
  weeklyRateKg: number = 0.5
): { targetCalories: number; isSafetyClamped: boolean; safetyNotice?: string } {
  const dailyDelta = Math.round((weeklyRateKg * 7700) / 7);
  let rawTarget = tdee;

  if (goal === 'lose') {
    rawTarget = tdee - dailyDelta;
  } else if (goal === 'gain') {
    rawTarget = tdee + dailyDelta;
  }

  const minSafe = gender === 'female' ? MIN_CALORIES_FEMALE : MIN_CALORIES_MALE;
  let isSafetyClamped = false;
  let safetyNotice: string | undefined;

  if (goal === 'lose' && rawTarget < minSafe) {
    rawTarget = minSafe;
    isSafetyClamped = true;
    safetyNotice = `For metabolic safety, FitSnap has clamped your daily goal to the minimum clinical threshold of ${minSafe} kcal/day.`;
  }

  return { targetCalories: Math.round(rawTarget), isSafetyClamped, safetyNotice };
}

/**
 * Computes exact macro gram targets and hydration volume according to diet preset and weight.
 * 1g Protein = 4 kcal, 1g Carbs = 4 kcal, 1g Fat = 9 kcal.
 * Water: 35ml per kg of body weight, capped at minimum 2,000ml.
 */
export function calculateMacrosAndWater(
  calories: number,
  dietPreset: DietPreset = 'balanced',
  weightKg: number = 70
): {
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  fiberG: number;
  waterMl: number;
} {
  const ratios = DIET_PRESET_RATIOS[dietPreset] || DIET_PRESET_RATIOS.balanced;

  const proteinG = Math.round((calories * ratios.protein) / 4);
  const carbsG = Math.round((calories * ratios.carbs) / 4);
  const fatG = Math.round((calories * ratios.fat) / 9);
  const fiberG = Math.max(25, Math.round((calories / 1000) * 14)); // 14g per 1000 kcal USDA recommendation
  const waterMl = Math.max(2000, Math.round(weightKg * 35));

  return {
    calories,
    proteinG,
    carbsG,
    fatG,
    fiberG,
    waterMl,
  };
}

/**
 * Predicts estimated goal achievement date based on weekly rate of progress.
 */
export function projectGoalDate(
  currentWeightKg: number,
  targetWeightKg: number,
  weeklyRateKg: number = 0.5
): { projectedWeeks: number; projectedDate: Date } {
  const delta = Math.abs(currentWeightKg - targetWeightKg);
  const rate = Math.max(0.1, weeklyRateKg);
  const projectedWeeks = Math.round((delta / rate) * 10) / 10;
  const projectedDate = new Date(Date.now() + projectedWeeks * 7 * 86400000);
  return { projectedWeeks, projectedDate };
}

/**
 * Exercise calories via Metabolic Equivalent of Task (MET) formula:
 * Calories = MET × weightKg × (durationMin / 60)
 */
export function calculateCaloriesBurned(
  metValue: number,
  weightKg: number,
  durationMin: number
): number {
  const durationHours = durationMin / 60.0;
  return Math.round(metValue * weightKg * durationHours);
}
