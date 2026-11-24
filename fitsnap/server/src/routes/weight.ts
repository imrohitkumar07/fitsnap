/**
 * FitSnap Server - Weight & Body Progress Routes
 * Weight tracking history, 7-day moving average trend projections,
 * body measurements (waist, chest, hips, arms, body fat %), and progress photo records.
 */

import { Router, Response } from 'express';
import prisma from '../lib/prisma.js';
import { authMiddleware, AuthRequest } from '../middleware/auth.js';
import { weightLogSchema } from '../schemas.js';

const router = Router();

router.use(authMiddleware);

// POST /api/weight - Log weight
router.post('/', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.userId;
    const parsed = weightLogSchema.safeParse(req.body);

    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        error: parsed.error.errors[0]?.message || 'Invalid weight value',
      });
    }

    const { weightKg, date } = parsed.data;

    // Create weight log
    const log = await prisma.weightLog.create({
      data: {
        userId,
        weightKg,
        date: date ? new Date(date) : new Date(),
      },
    });

    // Also update current profile weight
    await prisma.profile.updateMany({
      where: { userId },
      data: { weightKg },
    });

    return res.status(201).json({
      success: true,
      data: log,
    });
  } catch (error: any) {
    console.error('Error logging weight:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to log weight',
    });
  }
});

// GET /api/weight/history - Weight history with 7-day moving average trend
router.get('/history', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.userId;

    const logs = await prisma.weightLog.findMany({
      where: { userId },
      orderBy: { date: 'asc' },
      take: 90,
    });

    if (logs.length === 0) {
      return res.json({
        success: true,
        data: [],
        trend: null,
      });
    }

    // Compute 7-day moving average
    const logsWithMA = logs.map((log, index) => {
      const windowStart = Math.max(0, index - 6);
      const windowLogs = logs.slice(windowStart, index + 1);
      const sum = windowLogs.reduce((acc, curr) => acc + curr.weightKg, 0);
      const movingAvg = Math.round((sum / windowLogs.length) * 10) / 10;
      return {
        ...log,
        movingAverage7d: movingAvg,
      };
    });

    const startWeight = logs[0].weightKg;
    const currentWeight = logs[logs.length - 1].weightKg;
    const netChangeKg = Math.round((currentWeight - startWeight) * 10) / 10;

    return res.json({
      success: true,
      data: logsWithMA,
      trend: {
        startWeightKg: startWeight,
        currentWeightKg: currentWeight,
        netChangeKg,
        totalEntries: logs.length,
      },
    });
  } catch (error: any) {
    console.error('Error fetching weight history:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to fetch weight history',
    });
  }
});

// ─── Body Measurements ───────────────────────────────────────────────────────

// POST /api/weight/measurements - Log body circumference & body fat %
router.post('/measurements', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.userId;
    const { waistCm, chestCm, hipsCm, armsCm, thighsCm, bodyFatPct, date } = req.body;

    const log = await prisma.measurementLog.create({
      data: {
        userId,
        waistCm: waistCm ? Number(waistCm) : null,
        chestCm: chestCm ? Number(chestCm) : null,
        hipsCm: hipsCm ? Number(hipsCm) : null,
        armsCm: armsCm ? Number(armsCm) : null,
        thighsCm: thighsCm ? Number(thighsCm) : null,
        bodyFatPct: bodyFatPct ? Number(bodyFatPct) : null,
        date: date ? new Date(date) : new Date(),
      },
    });

    return res.status(201).json({
      success: true,
      data: log,
    });
  } catch (error: any) {
    console.error('Error logging measurements:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to record measurements.',
    });
  }
});

// GET /api/weight/measurements - Fetch body measurement history
router.get('/measurements', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.userId;
    const measurements = await prisma.measurementLog.findMany({
      where: { userId },
      orderBy: { date: 'desc' },
      take: 30,
    });

    return res.json({
      success: true,
      data: measurements,
    });
  } catch (error: any) {
    console.error('Error fetching measurements:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to fetch measurements.',
    });
  }
});

// ─── Progress Photos ────────────────────────────────────────────────────────

// POST /api/weight/photos - Record progress photo
router.post('/photos', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.userId;
    const { photoUrl, pose = 'front', notes, date } = req.body;

    if (!photoUrl) {
      return res.status(400).json({ success: false, error: 'Photo URL is required.' });
    }

    const photo = await prisma.progressPhoto.create({
      data: {
        userId,
        photoUrl,
        pose,
        notes,
        date: date ? new Date(date) : new Date(),
      },
    });

    return res.status(201).json({
      success: true,
      data: photo,
    });
  } catch (error: any) {
    console.error('Error saving progress photo:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to save progress photo.',
    });
  }
});

// GET /api/weight/photos - List progress photos
router.get('/photos', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.userId;
    const photos = await prisma.progressPhoto.findMany({
      where: { userId },
      orderBy: { date: 'desc' },
    });

    return res.json({
      success: true,
      data: photos,
    });
  } catch (error: any) {
    console.error('Error fetching progress photos:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to fetch progress photos.',
    });
  }
});

export default router;
