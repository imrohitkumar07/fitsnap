/**
 * FitSnap Server - Coaching Insights Route
 * Generates daily rule-based sports nutrition advice and interactive coach Q&A.
 * 100% Offline (Zero LLM / Zero Cloud AI).
 */

import { Router, Response } from 'express';
import prisma from '../lib/prisma.js';
import { authMiddleware, AuthRequest } from '../middleware/auth.js';
import { generateInsight, askCoachQuestion, generateWeeklyMealPlan } from '../services/coachingEngine.js';

const router = Router();

router.use(authMiddleware);

// Helper to calculate daily summary
async function getDailySummary(userId: string) {
  const profile = await prisma.profile.findUnique({
    where: { userId },
  });

  const goal = await prisma.goal.findFirst({
    where: { userId, isActive: true },
    orderBy: { createdAt: 'desc' },
  });

  const today = new Date();
  const startOfDay = new Date(today);
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date(today);
  endOfDay.setHours(23, 59, 59, 999);

  const foodLogs = await prisma.foodLog.findMany({
    where: {
      userId,
      date: { gte: startOfDay, lte: endOfDay },
    },
    include: { items: true },
  });

  const waterLogs = await prisma.waterLog.findMany({
    where: {
      userId,
      date: { gte: startOfDay, lte: endOfDay },
    },
  });

  let calories = 0;
  let protein = 0;
  let carbs = 0;
  let fat = 0;
  const meals: string[] = [];

  for (const log of foodLogs) {
    for (const item of log.items) {
      calories += item.calories;
      protein += item.proteinG;
      carbs += item.carbsG;
      fat += item.fatG;
      meals.push(item.name);
    }
  }

  const water = waterLogs.reduce((sum, w) => sum + w.amountMl, 0);

  const calorieGoal = goal?.calories || 2000;
  const proteinGoal = goal?.proteinG || 120;
  const carbsGoal = goal?.carbsG || 250;
  const fatGoal = goal?.fatG || 65;
  const waterGoal = goal?.waterMl || 2500;

  return {
    userName: profile?.name || 'Athlete',
    caloriesConsumed: Math.round(calories),
    calorieGoal,
    caloriesRemaining: Math.max(0, calorieGoal - Math.round(calories)),
    proteinConsumed: Math.round(protein),
    proteinGoal,
    proteinRemaining: Math.max(0, proteinGoal - Math.round(protein)),
    carbsConsumed: Math.round(carbs),
    carbsGoal,
    carbsRemaining: Math.max(0, carbsGoal - Math.round(carbs)),
    fatConsumed: Math.round(fat),
    fatGoal,
    fatRemaining: Math.max(0, fatGoal - Math.round(fat)),
    waterConsumed: water,
    waterGoal,
    waterRemaining: Math.max(0, waterGoal - water),
    meals: meals.slice(0, 10),
    goal: profile?.goal || 'maintain',
  };
}

// GET /api/insights - Generate AI insight for today
router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.userId;
    const summary = await getDailySummary(userId);
    const insight = await generateInsight(summary);

    return res.json({
      success: true,
      data: {
        ...insight,
        summary,
      },
    });
  } catch (error: any) {
    console.error('Error generating AI insight:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to generate insight',
    });
  }
});

// POST /api/insights/chat - Interactive AI Coach Advice
router.post('/chat', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.userId;
    const { message } = req.body;

    if (!message) {
      return res.status(400).json({
        success: false,
        error: 'Message is required.',
      });
    }

    const summary = await getDailySummary(userId);
    const result = await askCoachQuestion(message, summary);

    return res.json({
      success: true,
      data: {
        reply: result.reply,
        suggestions: result.suggestions,
        summary,
      },
    });
  } catch (error: any) {
    console.error('Error handling AI coach chat:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to process AI coach request.',
    });
  }
});

// GET /api/insights/meal-plan - 7-Day Combinatorial Meal Planner
router.get('/meal-plan', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.userId;
    const summary = await getDailySummary(userId);
    const plan = generateWeeklyMealPlan(summary.calorieGoal, true);

    return res.json({
      success: true,
      data: {
        targetCalories: summary.calorieGoal,
        plan,
      },
    });
  } catch (error: any) {
    console.error('Error generating meal plan:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to generate weekly meal plan.',
    });
  }
});

export default router;
