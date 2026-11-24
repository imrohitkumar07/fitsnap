/**
 * FitSnap - Shared Zod Validation Schemas
 * Used for request validation on both client and server.
 */

import { z } from 'zod';

// ─── Auth Schemas ────────────────────────────────────────────

export const registerSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  name: z.string().min(1, 'Name is required').max(100),
});

export const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
});

// ─── Profile & Goal Schemas ─────────────────────────────────

export const profileSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100),
  age: z.number().int().min(13, 'Must be at least 13').max(120),
  gender: z.enum(['male', 'female', 'other']),
  heightCm: z.number().min(50, 'Height too small').max(300),
  weightKg: z.number().min(20, 'Weight too small').max(500),
  activityLevel: z.enum(['sedentary', 'light', 'moderate', 'active', 'veryActive']),
  goal: z.enum(['lose', 'maintain', 'gain']),
});

export const goalSchema = z.object({
  calories: z.number().int().min(500).max(10000),
  proteinG: z.number().int().min(0).max(1000),
  carbsG: z.number().int().min(0).max(2000),
  fatG: z.number().int().min(0).max(1000),
  waterMl: z.number().int().min(0).max(20000),
});

// ─── Food Schemas ───────────────────────────────────────────

export const foodItemSchema = z.object({
  name: z.string().min(1, 'Food name is required'),
  portionG: z.number().min(0),
  portionLabel: z.string().nullable().optional(),
  calories: z.number().min(0),
  proteinG: z.number().min(0),
  carbsG: z.number().min(0),
  fatG: z.number().min(0),
  fiberG: z.number().min(0).default(0),
  sugarG: z.number().min(0).default(0),
  sodiumMg: z.number().min(0).default(0),
  confidence: z.number().min(0).max(1).default(0),
  isAiEstimate: z.boolean().default(true),
});

export const foodLogSchema = z.object({
  mealType: z.enum(['breakfast', 'lunch', 'dinner', 'snack']),
  photoUrl: z.string().nullable().optional(),
  date: z.string().optional(), // ISO date string
  items: z.array(foodItemSchema).min(1, 'At least one food item required'),
});

export const geminiResponseSchema = z.object({
  foods: z.array(
    z.object({
      name: z.string(),
      portionG: z.number(),
      portionLabel: z.string().nullable().optional(),
      calories: z.number(),
      proteinG: z.number(),
      carbsG: z.number(),
      fatG: z.number(),
      fiberG: z.number().default(0),
      sugarG: z.number().default(0),
      sodiumMg: z.number().default(0),
      confidence: z.number().min(0).max(1),
    })
  ),
});

// ─── Water Schema ───────────────────────────────────────────

export const waterLogSchema = z.object({
  amountMl: z.number().int().min(1, 'Amount must be positive').max(10000),
  source: z.enum(['manual', 'photo']).default('manual'),
  date: z.string().optional(), // ISO date string
});

// ─── Workout Schemas ────────────────────────────────────────

export const workoutExerciseSchema = z.object({
  exerciseId: z.string().min(1),
  sets: z.number().int().min(0).nullable().optional(),
  reps: z.number().int().min(0).nullable().optional(),
  weightKg: z.number().min(0).nullable().optional(),
  distanceKm: z.number().min(0).nullable().optional(),
  durationMin: z.number().int().min(0).nullable().optional(),
  order: z.number().int().min(0).default(0),
});

export const workoutSchema = z.object({
  type: z.enum(['strength', 'cardio', 'yoga', 'sports']),
  name: z.string().nullable().optional(),
  durationMin: z.number().int().min(1, 'Duration must be at least 1 minute'),
  templateId: z.string().nullable().optional(),
  date: z.string().optional(), // ISO date string
  exercises: z.array(workoutExerciseSchema).min(1, 'At least one exercise required'),
});

// ─── Weight Schema ──────────────────────────────────────────

export const weightLogSchema = z.object({
  weightKg: z.number().min(20, 'Weight too small').max(500),
  date: z.string().optional(), // ISO date string
});

// ─── Inferred Types ─────────────────────────────────────────

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type ProfileInput = z.infer<typeof profileSchema>;
export type GoalInput = z.infer<typeof goalSchema>;
export type FoodItemInput = z.infer<typeof foodItemSchema>;
export type FoodLogInput = z.infer<typeof foodLogSchema>;
export type GeminiResponseInput = z.infer<typeof geminiResponseSchema>;
export type WaterLogInput = z.infer<typeof waterLogSchema>;
export type WorkoutExerciseInput = z.infer<typeof workoutExerciseSchema>;
export type WorkoutInput = z.infer<typeof workoutSchema>;
export type WeightLogInput = z.infer<typeof weightLogSchema>;
