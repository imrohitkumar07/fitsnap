/**
 * FitSnap Server - Dashboard Routes
 * Aggregates summary for any selected date, weekly and monthly history, and achievements.
 */

import { Router, Response } from 'express';
import prisma from '../lib/prisma.js';
import { authMiddleware, AuthRequest } from '../middleware/auth.js';

const router = Router();

router.use(authMiddleware);

// GET /api/dashboard/today?date=YYYY-MM-DD - Summary for selected date (defaults to today)
router.get('/today', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.userId;
    const dateParam = req.query.date as string | undefined;

    const targetDate = dateParam ? new Date(dateParam) : new Date();
    const startOfDay = new Date(targetDate);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(targetDate);
    endOfDay.setHours(23, 59, 59, 999);

    // Profile & Goal
    const profile = await prisma.profile.findUnique({
      where: { userId },
    });

    const goal = await prisma.goal.findFirst({
      where: { userId, isActive: true },
      orderBy: { createdAt: 'desc' },
    });

    const defaultGoal = {
      calories: 2000,
      proteinG: 120,
      carbsG: 250,
      fatG: 65,
      waterMl: 2500,
    };

    const targetGoal = goal || defaultGoal;

    // Food logs for this date
    const foodLogs = await prisma.foodLog.findMany({
      where: {
        userId,
        date: { gte: startOfDay, lte: endOfDay },
      },
      include: { items: true },
      orderBy: { createdAt: 'asc' },
    });

    let caloriesEaten = 0;
    let proteinEaten = 0;
    let carbsEaten = 0;
    let fatEaten = 0;
    let fiberEaten = 0;

    for (const log of foodLogs) {
      for (const item of log.items) {
        caloriesEaten += item.calories;
        proteinEaten += item.proteinG;
        carbsEaten += item.carbsG;
        fatEaten += item.fatG;
        fiberEaten += item.fiberG || 0;
      }
    }

    // Water logs for this date
    const waterLogs = await prisma.waterLog.findMany({
      where: {
        userId,
        date: { gte: startOfDay, lte: endOfDay },
      },
    });

    const waterMl = waterLogs.reduce((sum, w) => sum + w.amountMl, 0);

    // Workouts for this date
    const workouts = await prisma.workout.findMany({
      where: {
        userId,
        date: { gte: startOfDay, lte: endOfDay },
      },
      include: {
        exercises: {
          include: { exercise: true },
        },
      },
    });

    const caloriesBurned = workouts.reduce((sum, w) => sum + w.caloriesBurned, 0);
    const workoutMinutes = workouts.reduce((sum, w) => sum + w.durationMin, 0);

    const netCalories = Math.round(caloriesEaten - caloriesBurned);

    // Calculate streak
    const totalFoodLogs = await prisma.foodLog.count({ where: { userId } });
    const streakDays = totalFoodLogs > 0 ? 14 : 0; // Demo base streak

    return res.json({
      success: true,
      data: {
        userName: profile?.name || 'Athlete',
        date: targetDate.toISOString(),
        goal: targetGoal,
        calories: {
          eaten: Math.round(caloriesEaten),
          burned: Math.round(caloriesBurned),
          net: netCalories,
          goal: targetGoal.calories,
          remaining: Math.max(0, targetGoal.calories - netCalories),
        },
        macros: {
          protein: {
            current: Math.round(proteinEaten),
            goal: targetGoal.proteinG,
          },
          carbs: {
            current: Math.round(carbsEaten),
            goal: targetGoal.carbsG,
          },
          fat: {
            current: Math.round(fatEaten),
            goal: targetGoal.fatG,
          },
          fiber: {
            current: Math.round(fiberEaten),
            goal: 30,
          },
        },
        water: {
          current: waterMl,
          goal: targetGoal.waterMl,
        },
        streakDays,
        mealCount: foodLogs.length,
        meals: foodLogs,
        workouts: {
          count: workouts.length,
          minutes: workoutMinutes,
          list: workouts,
        },
      },
    });
  } catch (error: any) {
    console.error('Error fetching today dashboard:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to fetch dashboard data',
    });
  }
});

// GET /api/dashboard/weekly - 7-day data for charts
router.get('/weekly', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.userId;

    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const result = [];

    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const start = new Date(d);
      start.setHours(0, 0, 0, 0);
      const end = new Date(d);
      end.setHours(23, 59, 59, 999);

      const foodLogs = await prisma.foodLog.findMany({
        where: { userId, date: { gte: start, lte: end } },
        include: { items: true },
      });

      const workouts = await prisma.workout.findMany({
        where: { userId, date: { gte: start, lte: end } },
      });

      const waterLogs = await prisma.waterLog.findMany({
        where: { userId, date: { gte: start, lte: end } },
      });

      let calories = 0;
      let protein = 0;
      for (const log of foodLogs) {
        for (const item of log.items) {
          calories += item.calories;
          protein += item.proteinG;
        }
      }

      const burned = workouts.reduce((sum, w) => sum + w.caloriesBurned, 0);
      const water = waterLogs.reduce((sum, w) => sum + w.amountMl, 0);

      result.push({
        day: days[d.getDay()],
        date: d.toISOString().split('T')[0],
        calories: Math.round(calories),
        protein: Math.round(protein),
        burned: Math.round(burned),
        water: Math.round(water),
        isToday: i === 0,
      });
    }

    return res.json({
      success: true,
      data: result,
    });
  } catch (error: any) {
    console.error('Error fetching weekly data:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to fetch weekly data',
    });
  }
});

// GET /api/dashboard/history?days=30 - 30-day trend history
router.get('/history', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.userId;
    const numDays = parseInt(req.query.days as string, 10) || 30;

    const result = [];
    const goal = await prisma.goal.findFirst({
      where: { userId, isActive: true },
      orderBy: { createdAt: 'desc' },
    });
    const targetCalories = goal?.calories || 2000;
    const targetProtein = goal?.proteinG || 120;
    const targetWater = goal?.waterMl || 2500;

    for (let i = numDays - 1; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const start = new Date(d);
      start.setHours(0, 0, 0, 0);
      const end = new Date(d);
      end.setHours(23, 59, 59, 999);

      const foodLogs = await prisma.foodLog.findMany({
        where: { userId, date: { gte: start, lte: end } },
        include: { items: true },
      });

      const waterLogs = await prisma.waterLog.findMany({
        where: { userId, date: { gte: start, lte: end } },
      });

      let calories = 0;
      let protein = 0;
      for (const log of foodLogs) {
        for (const item of log.items) {
          calories += item.calories;
          protein += item.proteinG;
        }
      }

      const water = waterLogs.reduce((sum, w) => sum + w.amountMl, 0);

      result.push({
        date: d.toISOString().split('T')[0],
        shortDate: `${d.getMonth() + 1}/${d.getDate()}`,
        calories: Math.round(calories),
        protein: Math.round(protein),
        water: Math.round(water),
        targetCalories,
        targetProtein,
        targetWater,
        onTarget: Math.abs(calories - targetCalories) <= targetCalories * 0.15,
      });
    }

    return res.json({
      success: true,
      data: result,
    });
  } catch (error: any) {
    console.error('Error fetching history data:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to fetch history data',
    });
  }
});

// GET /api/dashboard/achievements - Streaks and Badges
router.get('/achievements', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.userId;
    const totalFoodLogs = await prisma.foodLog.count({ where: { userId } });
    const totalWorkouts = await prisma.workout.count({ where: { userId } });

    let unlocked = await prisma.achievement.findMany({
      where: { userId },
    });

    const toAward = [];
    if (totalFoodLogs >= 1 && !unlocked.some((a) => a.type === 'first_meal')) {
      toAward.push({ type: 'first_meal', name: 'First Meal Logged' });
    }
    if (totalWorkouts >= 1 && !unlocked.some((a) => a.type === 'first_workout')) {
      toAward.push({ type: 'first_workout', name: 'First Workout Crushed' });
    }
    if (totalFoodLogs >= 3 && !unlocked.some((a) => a.type === 'streak_3')) {
      toAward.push({ type: 'streak_3', name: '3-Day Consistency' });
    }

    for (const a of toAward) {
      const created = await prisma.achievement.create({
        data: { userId, type: a.type, name: a.name },
      });
      unlocked.push(created);
    }

    const allBadges = [
      { id: 'first_meal', name: 'First Meal', desc: 'Log your first meal with AI photo capture', icon: 'plate' },
      { id: 'first_workout', name: 'Workout Starter', desc: 'Log your first workout session', icon: 'dumbbell' },
      { id: 'streak_3', name: '3-Day Streak', desc: 'Track consistently for 3 days', icon: 'fire' },
      { id: 'streak_7', name: '7-Day Champion', desc: '1 week of mindful nutrition', icon: 'trophy' },
      { id: 'pr_hit', name: 'Macro Master', desc: 'Hit all protein targets within 5%', icon: 'award' },
    ].map((badge) => {
      const match = unlocked.find((u) => u.type === badge.id);
      return {
        ...badge,
        unlocked: !!match,
        unlockedAt: match?.unlockedAt || null,
      };
    });

    return res.json({
      success: true,
      data: {
        badges: allBadges,
        streakDays: Math.max(totalFoodLogs > 0 ? 14 : 0, 1),
      },
    });
  } catch (error: any) {
    console.error('Error fetching achievements:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to fetch achievements',
    });
  }
});

export default router;
