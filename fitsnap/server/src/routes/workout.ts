/**
 * FitSnap Server - Workout Routes
 * Exercise library, workout logging, MET calculation, and history.
 */

import { Router, Response } from 'express';
import prisma from '../lib/prisma.js';
import { authMiddleware, AuthRequest } from '../middleware/auth.js';
import { workoutSchema } from '../schemas.js';
import { calculateCaloriesBurned } from '../services/nutritionCalc.js';

const router = Router();

router.use(authMiddleware);

// GET /api/workouts/exercises - List exercise library (with category filter)
router.get('/exercises', async (req: AuthRequest, res: Response) => {
  try {
    const category = req.query.category as string | undefined;

    const where: any = {};
    if (category && category !== 'all') {
      where.category = category;
    }

    const exercises = await prisma.exerciseLibrary.findMany({
      where,
      orderBy: [{ isCustom: 'asc' }, { name: 'asc' }],
    });

    return res.json({
      success: true,
      data: exercises,
    });
  } catch (error: any) {
    console.error('Error fetching exercises:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to fetch exercise library',
    });
  }
});

// POST /api/workouts/exercises - Add custom exercise
router.post('/exercises', async (req: AuthRequest, res: Response) => {
  try {
    const { name, category, muscleGroup, metValue, icon3d } = req.body;

    if (!name || !category) {
      return res.status(400).json({
        success: false,
        error: 'Exercise name and category are required',
      });
    }

    const exercise = await prisma.exerciseLibrary.create({
      data: {
        name,
        category,
        muscleGroup: muscleGroup || 'full',
        metValue: metValue ? Number(metValue) : 4.0,
        icon3d: icon3d || 'dumbbell',
        isCustom: true,
      },
    });

    return res.status(201).json({
      success: true,
      data: exercise,
    });
  } catch (error: any) {
    console.error('Error creating custom exercise:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to create exercise',
    });
  }
});

// POST /api/workouts - Log a workout
router.post('/', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.userId;
    const parsed = workoutSchema.safeParse(req.body);

    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        error: parsed.error.errors[0]?.message || 'Invalid workout data',
      });
    }

    const { type, name, durationMin, caloriesBurned, templateId, date, exercises } = parsed.data;

    // Fetch user weight to calculate calories if not provided
    let calculatedCalories = caloriesBurned;
    if (!calculatedCalories || calculatedCalories <= 0) {
      const profile = await prisma.profile.findUnique({
        where: { userId },
      });
      const weightKg = profile?.weightKg || 70;
      // Base MET per type
      const defaultMets: Record<string, number> = {
        strength: 5.0,
        cardio: 7.5,
        yoga: 3.0,
        sports: 6.5,
      };
      const met = defaultMets[type] || 5.0;
      calculatedCalories = calculateCaloriesBurned(met, weightKg, durationMin);
    }

    const workout = await prisma.workout.create({
      data: {
        userId,
        type,
        name: name || `${type.charAt(0).toUpperCase() + type.slice(1)} Session`,
        durationMin,
        caloriesBurned: Math.round(calculatedCalories),
        templateId,
        date: date ? new Date(date) : new Date(),
        exercises: {
          create: (exercises || []).map((ex: any, idx: number) => ({
            exerciseId: ex.exerciseId,
            sets: ex.sets,
            reps: ex.reps,
            weightKg: ex.weightKg,
            distanceKm: ex.distanceKm,
            durationMin: ex.durationMin,
            order: ex.order ?? idx,
          })),
        },
      },
      include: {
        exercises: {
          include: {
            exercise: true,
          },
        },
      },
    });

    return res.status(201).json({
      success: true,
      data: workout,
    });
  } catch (error: any) {
    console.error('Error logging workout:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to log workout',
    });
  }
});

// GET /api/workouts?date=YYYY-MM-DD - Get workouts for date
router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.userId;
    const dateParam = req.query.date as string | undefined;

    const targetDate = dateParam ? new Date(dateParam) : new Date();
    const startOfDay = new Date(targetDate);
    startOfDay.setHours(0, 0, 0, 0);

    const endOfDay = new Date(targetDate);
    endOfDay.setHours(23, 59, 59, 999);

    const workouts = await prisma.workout.findMany({
      where: {
        userId,
        date: {
          gte: startOfDay,
          lte: endOfDay,
        },
      },
      include: {
        exercises: {
          include: {
            exercise: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    const totalBurned = workouts.reduce((sum, w) => sum + w.caloriesBurned, 0);
    const totalMinutes = workouts.reduce((sum, w) => sum + w.durationMin, 0);

    return res.json({
      success: true,
      data: {
        workouts,
        totalBurned: Math.round(totalBurned),
        totalMinutes,
      },
    });
  } catch (error: any) {
    console.error('Error fetching workouts:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to fetch workouts',
    });
  }
});

// GET /api/workouts/history - Workout history and Personal Records
router.get('/history', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.userId;

    const allWorkouts = await prisma.workout.findMany({
      where: { userId },
      include: {
        exercises: {
          include: {
            exercise: true,
          },
        },
      },
      orderBy: { date: 'desc' },
      take: 50,
    });

    // Calculate Personal Records: max weight per exercise
    const prMap = new Map<string, { exerciseName: string; weightKg: number; date: Date }>();

    for (const w of allWorkouts) {
      for (const ex of w.exercises) {
        if (ex.weightKg && ex.weightKg > 0) {
          const current = prMap.get(ex.exerciseId);
          if (!current || ex.weightKg > current.weightKg) {
            prMap.set(ex.exerciseId, {
              exerciseName: ex.exercise.name,
              weightKg: ex.weightKg,
              date: w.date,
            });
          }
        }
      }
    }

    return res.json({
      success: true,
      data: {
        history: allWorkouts,
        personalRecords: Array.from(prMap.values()),
      },
    });
  } catch (error: any) {
    console.error('Error fetching workout history:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to fetch workout history',
    });
  }
});

// Templates CRUD
router.post('/templates', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.userId;
    const { name, type, exercises } = req.body;

    if (!name || !type || !exercises) {
      return res.status(400).json({
        success: false,
        error: 'Name, type, and exercises are required',
      });
    }

    const template = await prisma.workoutTemplate.create({
      data: {
        userId,
        name,
        type,
        exercises: JSON.stringify(exercises),
      },
    });

    return res.status(201).json({
      success: true,
      data: template,
    });
  } catch (error: any) {
    console.error('Error creating template:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to create template',
    });
  }
});

router.get('/templates', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.userId;
    const templates = await prisma.workoutTemplate.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });

    const parsedTemplates = templates.map((t) => ({
      ...t,
      exercises: JSON.parse(t.exercises),
    }));

    return res.json({
      success: true,
      data: parsedTemplates,
    });
  } catch (error: any) {
    console.error('Error fetching templates:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to fetch templates',
    });
  }
});

// ─── Prebuilt & Custom Training Programs ─────────────────────────────────────

const PREBUILT_PROGRAMS = [
  {
    id: 'prog_ppl',
    name: 'Push Pull Legs (PPL)',
    description: 'Classic 3-to-6 day targeted hypertrophy routine separating pushing, pulling, and lower body.',
    daysPerWeek: 6,
    difficulty: 'Intermediate',
    schedule: [
      { day: 'Day 1: Push', exercises: ['Barbell Bench Press', 'Incline Dumbbell Press', 'Overhead Shoulder Press', 'Tricep Rope Pushdown'] },
      { day: 'Day 2: Pull', exercises: ['Barbell Bent-Over Row', 'Lat Pulldown', 'Barbell Bicep Curl', 'Hammer Curls'] },
      { day: 'Day 3: Legs', exercises: ['Barbell Squat', 'Romanian Deadlift', 'Leg Press', 'Walking Lunges'] },
    ],
  },
  {
    id: 'prog_fullbody',
    name: 'Full-Body Functional Strength (3-Day Split)',
    description: 'High-frequency total body training maximizing compound lifts and core stability for sustainable fat loss.',
    daysPerWeek: 3,
    difficulty: 'Beginner to Intermediate',
    schedule: [
      { day: 'Monday (Heavy Squat & Press)', exercises: ['Barbell Squat', 'Barbell Bench Press', 'Barbell Bent-Over Row', 'Plank'] },
      { day: 'Wednesday (Deadlift & Shoulders)', exercises: ['Conventional Deadlift', 'Overhead Shoulder Press', 'Push-Ups', 'Hanging Leg Raise'] },
      { day: 'Friday (Hypertrophy & Mobility)', exercises: ['Leg Press', 'Dumbbell Chest Fly', 'Lat Pulldown', 'Dips'] },
    ],
  },
  {
    id: 'prog_cardio',
    name: 'Cardio & Fat Loss Conditioning',
    description: 'Structured aerobic and anaerobic threshold training utilizing MET-driven intervals and endurance pacing.',
    daysPerWeek: 5,
    difficulty: 'All Levels',
    schedule: [
      { day: 'Tuesday: Aerobic Base Run', exercises: ['Treadmill Jogging'] },
      { day: 'Thursday: HIIT Sprints & Jump Rope', exercises: ['HIIT Circuit', 'Jump Rope'] },
      { day: 'Saturday: Low-Impact Cycling', exercises: ['Outdoor Cycling'] },
    ],
  },
];

// GET /api/workouts/programs
router.get('/programs', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.userId;
    const userPrograms = await prisma.workoutProgram.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });

    const parsedUserPrograms = userPrograms.map((p) => ({
      ...p,
      schedule: JSON.parse(p.schedule || '[]'),
    }));

    return res.json({
      success: true,
      data: {
        prebuilt: PREBUILT_PROGRAMS,
        userPrograms: parsedUserPrograms,
      },
    });
  } catch (error: any) {
    console.error('Error fetching programs:', error);
    return res.status(500).json({ success: false, error: 'Failed to fetch workout programs.' });
  }
});

// POST /api/workouts/programs - Save custom workout program
router.post('/programs', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.userId;
    const { name, description, schedule } = req.body;

    if (!name || !schedule) {
      return res.status(400).json({ success: false, error: 'Program name and schedule are required.' });
    }

    const program = await prisma.workoutProgram.create({
      data: {
        userId,
        name: name.trim(),
        description: description?.trim() || null,
        schedule: typeof schedule === 'string' ? schedule : JSON.stringify(schedule),
      },
    });

    return res.status(201).json({
      success: true,
      data: {
        ...program,
        schedule: JSON.parse(program.schedule),
      },
    });
  } catch (error: any) {
    console.error('Error creating program:', error);
    return res.status(500).json({ success: false, error: 'Failed to save workout program.' });
  }
});

export default router;
