// ── Nutrition utility functions ──────────────────────────────────
// All calculations use the Mifflin-St Jeor equation and standard
// fitness/nutrition formulas.

export type Gender = 'male' | 'female' | 'other';
export type ActivityLevel = 'sedentary' | 'light' | 'moderate' | 'active' | 'veryActive' | 'very_active';
export type Goal = 'lose' | 'maintain' | 'gain';

/** Activity level multipliers for TDEE calculation */
const ACTIVITY_MULTIPLIERS: Record<string, number> = {
  sedentary: 1.2,     // Little or no exercise
  light: 1.375,       // Light exercise 1-3 days/week
  moderate: 1.55,     // Moderate exercise 3-5 days/week
  active: 1.725,      // Heavy exercise 6-7 days/week
  veryActive: 1.9,    // Very heavy exercise
  very_active: 1.9,
};

/**
 * Calculate Basal Metabolic Rate using the Mifflin-St Jeor equation.
 */
export function calculateBMR(
  weightKg: number,
  heightCm: number,
  age: number,
  gender: Gender
): number {
  const base = 10 * weightKg + 6.25 * heightCm - 5 * age;
  return gender === 'female' ? base - 161 : base + 5;
}

/**
 * Calculate Total Daily Energy Expenditure.
 */
export function calculateTDEE(bmr: number, activityLevel: ActivityLevel): number {
  const mult = ACTIVITY_MULTIPLIERS[activityLevel] || 1.55;
  return Math.round(bmr * mult);
}

/**
 * Adjust TDEE based on user's fitness goal.
 */
export function adjustForGoal(tdee: number, goal: Goal): number {
  switch (goal) {
    case 'lose':
      return Math.round(tdee - 500); // 500 kcal deficit
    case 'gain':
      return Math.round(tdee + 500); // 500 kcal surplus
    case 'maintain':
    default:
      return tdee;
  }
}

/**
 * Calculate default macro and water goals.
 */
export function calculateDefaultGoals(tdeeOrAdjusted: number, goal?: Goal): {
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  waterMl: number;
} {
  const targetCalories = goal ? adjustForGoal(tdeeOrAdjusted, goal) : tdeeOrAdjusted;

  const proteinG = Math.round((targetCalories * 0.3) / 4);
  const carbsG = Math.round((targetCalories * 0.4) / 4);
  const fatG = Math.round((targetCalories * 0.3) / 9);
  const waterMl = Math.max(2000, Math.round(targetCalories / 250) * 250);

  return {
    calories: targetCalories,
    proteinG,
    carbsG,
    fatG,
    waterMl,
  };
}

/**
 * Calculate estimated calories burned for an activity.
 * Formula: MET × weight(kg) × duration(hours)
 */
export function calculateCaloriesBurned(
  met: number,
  weightKg: number,
  durationMin: number
): number {
  return Math.round(met * weightKg * (durationMin / 60));
}
