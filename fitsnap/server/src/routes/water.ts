/**
 * FitSnap Server - Water Tracking Routes
 * Quick-add water, undo/remove last glass, and fetch daily logs.
 */

import { Router, Response } from 'express';
import prisma from '../lib/prisma.js';
import { authMiddleware, AuthRequest } from '../middleware/auth.js';
import { waterLogSchema } from '../schemas.js';

const router = Router();

router.use(authMiddleware);

// POST /api/water & POST /api/water/log - Log water intake
const handleLogWater = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.userId;
    const parsed = waterLogSchema.safeParse(req.body);

    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        error: parsed.error.errors[0]?.message || 'Invalid water data',
      });
    }

    const { amountMl, source, date } = parsed.data;

    const log = await prisma.waterLog.create({
      data: {
        userId,
        amountMl,
        source: source || 'manual',
        date: date ? new Date(date) : new Date(),
      },
    });

    return res.status(201).json({
      success: true,
      data: log,
    });
  } catch (error: any) {
    console.error('Error logging water:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to log water',
    });
  }
};

router.post('/', handleLogWater);
router.post('/log', handleLogWater);

// DELETE /api/water/latest - Remove/undo the most recent water log for today
router.delete('/latest', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.userId;

    const today = new Date();
    const startOfDay = new Date(today);
    startOfDay.setHours(0, 0, 0, 0);

    const latest = await prisma.waterLog.findFirst({
      where: {
        userId,
        date: { gte: startOfDay },
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!latest) {
      return res.status(404).json({
        success: false,
        error: 'No water logs found for today to remove.',
      });
    }

    await prisma.waterLog.delete({
      where: { id: latest.id },
    });

    return res.json({
      success: true,
      message: `Removed ${latest.amountMl}ml water log.`,
      removedId: latest.id,
      amountMl: latest.amountMl,
    });
  } catch (error: any) {
    console.error('Error removing latest water log:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to remove water log.',
    });
  }
});

// GET /api/water & GET /api/water/today - Get water logs for date
const handleGetWater = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.userId;
    const dateParam = req.query.date as string | undefined;

    const targetDate = dateParam ? new Date(dateParam) : new Date();
    const startOfDay = new Date(targetDate);
    startOfDay.setHours(0, 0, 0, 0);

    const endOfDay = new Date(targetDate);
    endOfDay.setHours(23, 59, 59, 999);

    const logs = await prisma.waterLog.findMany({
      where: {
        userId,
        date: {
          gte: startOfDay,
          lte: endOfDay,
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    const totalMl = logs.reduce((sum, item) => sum + item.amountMl, 0);

    return res.json({
      success: true,
      data: {
        logs,
        totalMl,
      },
    });
  } catch (error: any) {
    console.error('Error fetching water logs:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to fetch water logs',
    });
  }
};

router.get('/', handleGetWater);
router.get('/today', handleGetWater);

export default router;
