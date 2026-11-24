/**
 * FitSnap Server - Profile Routes
 * Handles user profile onboarding, clinical Mifflin-St Jeor TDEE calculations,
 * macro splits, goal date projections, GDPR data export, and account deletion.
 */

import { Router, Response } from 'express';
import prisma from '../lib/prisma.js';
import { authMiddleware, AuthRequest } from '../middleware/auth.js';
import { profileSchema, goalSchema } from '../schemas.js';
import {
  calculateBMR,
  calculateTDEE,
  calculateTargetCalories,
  calculateMacrosAndWater,
  projectGoalDate,
  DietPreset,
} from '../services/nutritionCalc.js';
import type { Gender, ActivityLevel, GoalType } from '../types.js';

const router = Router();

// Apply authentication to all profile routes
router.use(authMiddleware);

// GET /api/profile - Fetch user profile, active goal, and latest metrics
router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.userId;

    const profile = await prisma.profile.findUnique({
      where: { userId },
    });

    const activeGoal = await prisma.goal.findFirst({
      where: { userId, isActive: true },
      orderBy: { createdAt: 'desc' },
    });

    const latestWeight = await prisma.weightLog.findFirst({
      where: { userId },
      orderBy: { date: 'desc' },
    });

    return res.json({
      success: true,
      data: {
        profile,
        goal: activeGoal,
        latestWeightKg: latestWeight?.weightKg || profile?.weightKg,
      },
    });
  } catch (error: any) {
    console.error('Error fetching profile:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to fetch profile',
    });
  }
});

// PUT /api/profile - Create or update profile with clinical Mifflin-St Jeor calculations
router.put('/', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.userId;
    const parsed = profileSchema.safeParse(req.body);

    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        error: parsed.error.errors[0]?.message || 'Invalid profile data',
      });
    }

    const {
      name,
      age,
      gender,
      heightCm,
      weightKg,
      activityLevel,
      goal,
      weeklyRateKg = 0.5,
      dietPreset = 'balanced',
      allergies = [],
      dislikes = [],
      reduce3dEffects = false,
      language = 'en',
    } = parsed.data;

    // 1. Clinical BMR & TDEE calculation
    const bmr = calculateBMR(weightKg, heightCm, age, gender as Gender);
    const tdee = calculateTDEE(bmr, activityLevel as ActivityLevel);

    // 2. Safe daily target calories
    const targetCalObj = calculateTargetCalories(
      tdee,
      goal as GoalType,
      gender as Gender,
      weeklyRateKg
    );

    // 3. Macro grams & hydration calculation
    const macros = calculateMacrosAndWater(
      targetCalObj.targetCalories,
      dietPreset as DietPreset,
      weightKg
    );

    // 4. Upsert Profile
    const updatedProfile = await prisma.profile.upsert({
      where: { userId },
      update: {
        name,
        age,
        gender,
        heightCm,
        weightKg,
        activityLevel,
        goal,
        bmr,
        tdee,
        allergies: JSON.stringify(allergies),
        dislikes: JSON.stringify(dislikes),
        reduce3dEffects,
        language,
      },
      create: {
        userId,
        name,
        age,
        gender,
        heightCm,
        weightKg,
        activityLevel,
        goal,
        bmr,
        tdee,
        allergies: JSON.stringify(allergies),
        dislikes: JSON.stringify(dislikes),
        reduce3dEffects,
        language,
      },
    });

    // 5. Update or create active Goal
    await prisma.goal.updateMany({
      where: { userId, isActive: true },
      data: { isActive: false },
    });

    const newGoal = await prisma.goal.create({
      data: {
        userId,
        calories: targetCalObj.targetCalories,
        proteinG: macros.proteinG,
        carbsG: macros.carbsG,
        fatG: macros.fatG,
        fiberG: macros.fiberG,
        waterMl: macros.waterMl,
        isActive: true,
      },
    });

    // 6. Record weight in WeightLog
    await prisma.weightLog.create({
      data: {
        userId,
        weightKg,
        date: new Date(),
      },
    });

    // 7. Calculate goal projection date if target weight was specified in request
    let projection = null;
    const targetWeightKg = (req.body as any).targetWeightKg;
    if (typeof targetWeightKg === 'number' && targetWeightKg > 0) {
      projection = projectGoalDate(weightKg, targetWeightKg, weeklyRateKg);
    }

    return res.json({
      success: true,
      data: {
        profile: updatedProfile,
        goal: newGoal,
        projection,
        safetyNotice: targetCalObj.safetyNotice,
      },
    });
  } catch (error: any) {
    console.error('Error updating profile:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to update profile',
    });
  }
});

// POST /api/profile/goals - Set customized macro and calorie targets
router.post('/goals', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.userId;
    const parsed = goalSchema.safeParse(req.body);

    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        error: parsed.error.errors[0]?.message || 'Invalid goal data',
      });
    }

    const { calories, proteinG, carbsG, fatG, fiberG = 30, waterMl = 2500, dayOfWeek = null } = parsed.data;

    // Deactivate previous active goal
    await prisma.goal.updateMany({
      where: { userId, isActive: true },
      data: { isActive: false },
    });

    // Create new active goal
    const newGoal = await prisma.goal.create({
      data: {
        userId,
        calories,
        proteinG,
        carbsG,
        fatG,
        fiberG,
        waterMl,
        dayOfWeek,
        isActive: true,
      },
    });

    return res.status(201).json({
      success: true,
      data: newGoal,
    });
  } catch (error: any) {
    console.error('Error updating goals:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to update goals',
    });
  }
});

// GET /api/profile/export - Full GDPR Data Export
router.get('/export', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.userId;

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        role: true,
        createdAt: true,
        profile: true,
        goals: true,
        foodLogs: {
          include: { items: true },
          orderBy: { date: 'desc' },
        },
        customFoods: true,
        favoriteFoods: true,
        recipes: {
          include: { ingredients: true },
        },
        waterLogs: {
          orderBy: { date: 'desc' },
        },
        workouts: {
          include: { exercises: true },
          orderBy: { date: 'desc' },
        },
        weightLogs: {
          orderBy: { date: 'desc' },
        },
        measurementLogs: {
          orderBy: { date: 'desc' },
        },
        mealPlans: true,
        groceryLists: {
          include: { items: true },
        },
      },
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found',
      });
    }

    return res.json({
      success: true,
      exportedAt: new Date().toISOString(),
      appName: 'FitSnap',
      format: 'JSON (GDPR Compliant)',
      data: user,
    });
  } catch (error: any) {
    console.error('Data export error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to export user data',
    });
  }
});

// DELETE /api/profile/account - Delete user account and associated personal data
router.delete('/account', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.userId;

    await prisma.user.delete({
      where: { id: userId },
    });

    return res.json({
      success: true,
      message: 'Account and associated records successfully erased.',
    });
  } catch (error: any) {
    console.error('Delete account error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to delete account',
    });
  }
});

export default router;
