/**
 * FitSnap Server - Core TypeScript Interfaces
 */

export interface User {
  id: string;
  email: string;
  createdAt: Date;
  updatedAt: Date;
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
  createdAt: Date;
  updatedAt: Date;
}

export type ActivityLevel = 'sedentary' | 'light' | 'moderate' | 'active' | 'veryActive' | 'very_active';
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
  createdAt: Date;
}

export interface FoodItem {
  id?: string;
  name: string;
  portionG: number;
  portionLabel?: string | null;
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  fiberG: number;
  sugarG: number;
  sodiumMg: number;
  confidence: number;
  isAiEstimate: boolean;
}

export interface MLVisionResponse {
  foods: FoodItem[];
}

export interface InsightResponse {
  insight: string;
  suggestion: string;
}

export type WorkoutCategory = 'strength' | 'cardio' | 'yoga' | 'sports';
export type WorkoutType = WorkoutCategory;
