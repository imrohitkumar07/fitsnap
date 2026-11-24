/**
 * FitSnap Server - Zod Validation Schemas
 * Comprehensive validation across Auth, Profile, Nutrition, Workouts, and Social.
 */

import { z } from 'zod';

export const registerSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  name: z.string().optional(),
});

export const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
});

export const profileSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100),
  age: z.number().int().min(13, 'Must be at least 13').max(120),
  gender: z.enum(['male', 'female', 'other']),
  heightCm: z.number().min(50, 'Height too small').max(300),
  weightKg: z.number().min(20, 'Weight too small').max(500),
  activityLevel: z.enum(['sedentary', 'light', 'moderate', 'active', 'veryActive', 'very_active']),
  goal: z.enum(['lose', 'maintain', 'gain']),
  weeklyRateKg: z.number().min(0.1).max(1.5).default(0.5).optional(),
  dietPreset: z.enum(['balanced', 'high_protein', 'low_carb', 'keto', 'vegetarian', 'vegan', 'indian_veg']).default('balanced').optional(),
  allergies: z.array(z.string()).optional(),
  dislikes: z.array(z.string()).optional(),
  reduce3dEffects: z.boolean().optional(),
  language: z.enum(['en', 'hi']).optional(),
});

export const goalSchema = z.object({
  calories: z.number().int().min(500).max(10000),
  proteinG: z.number().int().min(0).max(1000),
  carbsG: z.number().int().min(0).max(2000),
  fatG: z.number().int().min(0).max(1000),
  fiberG: z.number().int().min(0).max(200).default(30).optional(),
  waterMl: z.number().int().min(0).max(20000).default(2500).optional(),
  dayOfWeek: z.number().int().min(0).max(6).nullable().optional(),
});

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
  confidence: z.number().min(0).max(1).default(0.9),
  isAiEstimate: z.boolean().default(false),
  badge: z.string().nullable().optional(),
  source: z.string().nullable().optional(),
  embedding: z.array(z.number()).nullable().optional(),
});

export const foodLogSchema = z.object({
  mealType: z.enum(['breakfast', 'lunch', 'dinner', 'snack', 'custom']),
  photoUrl: z.string().optional().nullable(),
  date: z.string().optional(),
  notes: z.string().optional().nullable(),
  items: z.array(foodItemSchema).min(1, 'At least one food item required'),
  embedding: z.array(z.number()).nullable().optional(),
});

export const customFoodSchema = z.object({
  barcode: z.string().optional().nullable(),
  name: z.string().min(1, 'Food name is required'),
  brand: z.string().optional().nullable(),
  servingSize: z.string().default('100g'),
  servingG: z.number().min(1).default(100),
  caloriesKcal: z.number().min(0),
  proteinG: z.number().min(0),
  carbsG: z.number().min(0),
  fatG: z.number().min(0),
  fiberG: z.number().min(0).optional().nullable(),
  sugarG: z.number().min(0).optional().nullable(),
  sodiumMg: z.number().min(0).optional().nullable(),
});

export const recipeSchema = z.object({
  name: z.string().min(1, 'Recipe name is required'),
  description: z.string().optional().nullable(),
  servings: z.number().int().min(1).default(1),
  totalTimeMin: z.number().int().min(1).default(30),
  sourceUrl: z.string().url().optional().nullable(),
  ingredients: z.array(
    z.object({
      name: z.string().min(1),
      amountG: z.number().min(0.1),
      unitLabel: z.string().default('g'),
      calories: z.number().min(0),
      proteinG: z.number().min(0),
      carbsG: z.number().min(0),
      fatG: z.number().min(0),
    })
  ).min(1, 'At least one ingredient is required'),
});

export const workoutLogSchema = z.object({
  type: z.enum(['strength', 'cardio', 'yoga', 'sports']),
  name: z.string().optional().nullable(),
  durationMin: z.number().int().min(1),
  caloriesBurned: z.number().min(0).optional(),
  metValue: z.number().min(1).optional(),
  templateId: z.string().optional().nullable(),
  date: z.string().optional(),
  exercises: z.array(
    z.object({
      exerciseId: z.string(),
      sets: z.number().int().min(1).optional(),
      reps: z.number().int().min(1).optional(),
      weightKg: z.number().min(0).optional(),
      distanceKm: z.number().min(0).optional(),
      durationMin: z.number().int().min(1).optional(),
      order: z.number().int().optional(),
    })
  ).optional().default([]),
});

export const workoutSchema = workoutLogSchema;

export const waterLogSchema = z.object({
  amountMl: z.number().positive('Water amount must be positive'),
  source: z.string().optional(),
  date: z.string().optional(),
});

export const weightLogSchema = z.object({
  weightKg: z.number().positive('Weight must be positive').max(500),
  date: z.string().optional(),
});

export const visionFoodItemSchema = z.object({
  name: z.string(),
  portionG: z.number(),
  portionLabel: z.string(),
  calories: z.number(),
  proteinG: z.number(),
  carbsG: z.number(),
  fatG: z.number(),
  fiberG: z.number().optional().default(0),
  sugarG: z.number().optional().default(0),
  sodiumMg: z.number().optional().default(0),
  confidence: z.number().optional().default(0.9),
  isAiEstimate: z.boolean().optional().default(true),
});

export const visionResponseSchema = z.object({
  foods: z.array(visionFoodItemSchema),
  totalCalories: z.number(),
  mealTypeSuggestion: z.string().default('snack'),
  healthScore: z.number().optional().default(75),
  insights: z.array(z.string()).optional().default([]),
});

export const postSchema = z.object({
  board: z.enum(['general', 'weight_loss', 'recipes', 'indian_diet', 'workouts']).default('general'),
  content: z.string().min(1, 'Post content is required').max(2000),
  photoUrl: z.string().url().optional().nullable(),
});

export const commentSchema = z.object({
  content: z.string().min(1, 'Comment cannot be empty').max(500),
});
