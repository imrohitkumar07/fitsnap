/**
 * FitSnap - Shared TypeScript Interfaces
 * Used by both client and server for consistent type safety.
 */

// ─── Auth & Profile ──────────────────────────────────────────

export interface User {
  id: string;
  email: string;
  createdAt: string;
  updatedAt: string;
  profile?: Profile | null;
  goals?: Goal[];
}

export interface Profile {
  id: string;
  userId: string;
  name: string;
  age: number;
  gender: 'male' | 'female' | 'other';
  heightCm: number;
  weightKg: number;
  activityLevel: ActivityLevel;
  goal: GoalType;
  bmr: number;
  tdee: number;
  createdAt: string;
  updatedAt: string;
}

export type ActivityLevel = 'sedentary' | 'light' | 'moderate' | 'active' | 'veryActive';
export type GoalType = 'lose' | 'maintain' | 'gain';
export type Gender = 'male' | 'female' | 'other';

export interface Goal {
  id: string;
  userId: string;
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  waterMl: number;
  isActive: boolean;
  createdAt: string;
}

// ─── Food Logging ────────────────────────────────────────────

export type MealType = 'breakfast' | 'lunch' | 'dinner' | 'snack';

export interface FoodLog {
  id: string;
  userId: string;
  mealType: MealType;
  photoUrl?: string | null;
  date: string;
  items: FoodItem[];
  createdAt: string;
}

export interface FoodItem {
  id?: string;
  foodLogId?: string;
  name: string;
  portionG: number;
  portionLabel?: string | null;
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  fiberG: number;
  sugarG?: number;
  sodiumMg?: number;
  confidence: number;
  isAiEstimate?: boolean;
  badge?: string;
  source?: string;
  portions?: Array<{ description: string; gramWeight: number }>;
  createdAt?: string;
}

/** Shape returned by the Gemini Vision food-analysis endpoint */
export interface GeminiVisionResponse {
  foods: FoodItem[];
}

// ─── Water ───────────────────────────────────────────────────

export interface WaterLog {
  id: string;
  userId: string;
  amountMl: number;
  source: 'manual' | 'photo';
  date: string;
  createdAt: string;
}

// ─── Workouts ────────────────────────────────────────────────

export interface Workout {
  id: string;
  userId: string;
  type: WorkoutCategory;
  name?: string | null;
  durationMin: number;
  caloriesBurned: number;
  templateId?: string | null;
  date: string;
  exercises: WorkoutExercise[];
  createdAt: string;
}

export type WorkoutCategory = 'strength' | 'cardio' | 'yoga' | 'sports';
export type WorkoutType = WorkoutCategory;

export interface WorkoutExercise {
  id?: string;
  workoutId?: string;
  exerciseId: string;
  exercise?: ExerciseLibraryItem;
  sets?: number | null;
  reps?: number | null;
  weightKg?: number | null;
  distanceKm?: number | null;
  durationMin?: number | null;
  order: number;
}

export interface ExerciseLibraryItem {
  id: string;
  name: string;
  category: WorkoutCategory;
  muscleGroup?: string | null;
  metValue: number;
  icon3d?: string | null;
  isCustom: boolean;
}

export interface WorkoutTemplate {
  id: string;
  userId: string;
  name: string;
  type: string;
  exercises: string; // JSON string: [{exerciseId, sets, reps, weightKg}]
  createdAt: string;
}

// ─── Weight & Achievements ──────────────────────────────────

export interface WeightLog {
  id: string;
  userId: string;
  weightKg: number;
  date: string;
}

export type AchievementType =
  | 'streak_3'
  | 'streak_7'
  | 'streak_30'
  | 'first_meal'
  | 'first_workout'
  | 'pr_hit';

export interface Achievement {
  id: string;
  userId: string;
  type: AchievementType;
  name: string;
  unlockedAt: string;
}

// ─── Dashboard & Insights ───────────────────────────────────

export interface DashboardSummary {
  today: {
    calories: { consumed: number; goal: number; remaining: number };
    protein: { consumed: number; goal: number };
    carbs: { consumed: number; goal: number };
    fat: { consumed: number; goal: number };
    water: { consumed: number; goal: number };
    workoutCalories: number;
  };
  recentMeals: FoodLog[];
  recentWorkouts: Workout[];
  weightTrend: WeightLog[];
  achievements: Achievement[];
  streak: number;
}

export interface WeeklyData {
  date: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  water: number;
  workoutCalories: number;
}

// ─── Auth Requests ──────────────────────────────────────────

export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  email: string;
  password: string;
  name: string;
}

export interface OnboardingData {
  name: string;
  age: number;
  gender: Gender;
  heightCm: number;
  weightKg: number;
  activityLevel: ActivityLevel;
  goal: GoalType;
}

// ─── API Response Wrapper ───────────────────────────────────

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}

// ─── Auth Response Types ────────────────────────────────────

export interface AuthResponse {
  token: string;
  user: Pick<User, 'id' | 'email'> & {
    profile: Profile | null;
  };
}

export interface InsightResponse {
  insight: string;
  suggestion: string;
}
