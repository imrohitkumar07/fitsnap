/**
 * FitSnap Server - Settings & Notification Routes
 * Manages user preferences (language: en/hi, units, reduce3dEffects),
 * scheduled meal & hydration reminder settings, quiet hours, and in-app notifications.
 */

import { Router, Response } from 'express';
import prisma from '../lib/prisma.js';
import { authMiddleware, AuthRequest } from '../middleware/auth.js';

const router = Router();

router.use(authMiddleware);

// GET /api/settings - Fetch user settings & reminder preferences
router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.userId;

    const [profile, reminders] = await Promise.all([
      prisma.profile.findUnique({
        where: { userId },
        select: {
          reduce3dEffects: true,
          language: true,
          dietPreset: true,
        },
      }),
      prisma.reminderSetting.findUnique({
        where: { userId },
      }),
    ]);

    // Default reminder values if not yet customized
    const defaultReminders = {
      breakfastTime: '08:30',
      lunchTime: '13:00',
      dinnerTime: '20:00',
      waterInterval: 90,
      workoutPrompt: true,
      quietHoursStart: '22:00',
      quietHoursEnd: '07:00',
    };

    return res.json({
      success: true,
      data: {
        preferences: {
          reduce3dEffects: profile?.reduce3dEffects ?? false,
          language: profile?.language ?? 'en',
          units: 'metric', // default metric
        },
        reminders: reminders || defaultReminders,
      },
    });
  } catch (error: any) {
    console.error('Error fetching settings:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to fetch settings.',
    });
  }
});

// PUT /api/settings - Update preferences and reminder schedules
router.put('/', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.userId;
    const { preferences, reminders } = req.body;

    // Update profile preferences if supplied
    if (preferences) {
      const updateData: any = {};
      if (typeof preferences.reduce3dEffects === 'boolean') {
        updateData.reduce3dEffects = preferences.reduce3dEffects;
      }
      if (preferences.language && ['en', 'hi'].includes(preferences.language)) {
        updateData.language = preferences.language;
      }

      if (Object.keys(updateData).length > 0) {
        await prisma.profile.update({
          where: { userId },
          data: updateData,
        });
      }
    }

    // Upsert reminder settings if supplied
    let updatedReminders = null;
    if (reminders) {
      updatedReminders = await prisma.reminderSetting.upsert({
        where: { userId },
        update: {
          breakfastTime: reminders.breakfastTime || undefined,
          lunchTime: reminders.lunchTime || undefined,
          dinnerTime: reminders.dinnerTime || undefined,
          waterInterval: typeof reminders.waterInterval === 'number' ? reminders.waterInterval : undefined,
          workoutPrompt: typeof reminders.workoutPrompt === 'boolean' ? reminders.workoutPrompt : undefined,
          quietHoursStart: reminders.quietHoursStart || undefined,
          quietHoursEnd: reminders.quietHoursEnd || undefined,
        },
        create: {
          userId,
          breakfastTime: reminders.breakfastTime || '08:30',
          lunchTime: reminders.lunchTime || '13:00',
          dinnerTime: reminders.dinnerTime || '20:00',
          waterInterval: typeof reminders.waterInterval === 'number' ? reminders.waterInterval : 90,
          workoutPrompt: reminders.workoutPrompt ?? true,
          quietHoursStart: reminders.quietHoursStart || '22:00',
          quietHoursEnd: reminders.quietHoursEnd || '07:00',
        },
      });
    }

    return res.json({
      success: true,
      message: 'Settings updated successfully.',
      data: {
        preferences,
        reminders: updatedReminders,
      },
    });
  } catch (error: any) {
    console.error('Error updating settings:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to update settings.',
    });
  }
});

// GET /api/settings/notifications - List in-app notifications
router.get('/notifications', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.userId;

    const notifications = await prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });

    return res.json({
      success: true,
      data: notifications,
    });
  } catch (error: any) {
    console.error('Error fetching notifications:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to fetch notifications.',
    });
  }
});

// PATCH /api/settings/notifications/:id/read - Mark notification as read
router.patch('/notifications/:id/read', async (req: AuthRequest, res: Response) => {
  try {
    const id = req.params.id as string;
    const updated = await prisma.notification.update({
      where: { id },
      data: { isRead: true },
    });

    return res.json({
      success: true,
      data: updated,
    });
  } catch (error: any) {
    return res.status(500).json({
      success: false,
      error: 'Failed to mark notification as read.',
    });
  }
});

// POST /api/settings/test-notification - Trigger test in-app alert
router.post('/test-notification', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.userId;
    const { type = 'meal_reminder', title, message } = req.body;

    const notif = await prisma.notification.create({
      data: {
        userId,
        type,
        title: title || 'Time for Lunch! 🥗',
        message: message || "Don't forget to snap your meal to stay on track with your macros.",
      },
    });

    return res.status(201).json({
      success: true,
      data: notif,
    });
  } catch (error: any) {
    console.error('Error sending test notification:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to trigger test notification.',
    });
  }
});

// GET /api/settings/prototypes - List learned prototype foods for this user
router.get('/prototypes', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.userId;
    const protos = await prisma.userFoodPrototype.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });

    const summaryMap = new Map<string, { foodName: string; sampleCount: number; lastLearnedAt: Date }>();
    for (const p of protos) {
      if (!summaryMap.has(p.foodName)) {
        summaryMap.set(p.foodName, {
          foodName: p.foodName,
          sampleCount: 1,
          lastLearnedAt: p.createdAt,
        });
      } else {
        const existing = summaryMap.get(p.foodName)!;
        existing.sampleCount += 1;
      }
    }

    return res.json({
      success: true,
      data: Array.from(summaryMap.values()),
    });
  } catch (err: any) {
    console.error('Error fetching prototypes:', err);
    return res.status(500).json({ success: false, error: 'Failed to fetch learned prototypes' });
  }
});

// DELETE /api/settings/prototypes/:foodName - Delete stored prototypes for a food
router.delete('/prototypes/:foodName', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.userId;
    const foodName = decodeURIComponent(String(req.params.foodName));

    await prisma.userFoodPrototype.deleteMany({
      where: { userId, foodName },
    });

    return res.json({
      success: true,
      message: `Deleted prototypes for "${foodName}"`,
    });
  } catch (err: any) {
    console.error('Error deleting prototype:', err);
    return res.status(500).json({ success: false, error: 'Failed to delete prototype' });
  }
});

// PUT /api/settings/prototypes/:foodName - Rename stored prototypes
router.put('/prototypes/:foodName', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.userId;
    const foodName = decodeURIComponent(String(req.params.foodName));
    const { newName } = req.body;

    if (!newName || typeof newName !== 'string') {
      return res.status(400).json({ success: false, error: 'Valid newName is required' });
    }

    await prisma.userFoodPrototype.updateMany({
      where: { userId, foodName },
      data: { foodName: newName.trim() },
    });

    return res.json({
      success: true,
      message: `Renamed prototypes from "${foodName}" to "${newName.trim()}"`,
    });
  } catch (err: any) {
    console.error('Error renaming prototype:', err);
    return res.status(500).json({ success: false, error: 'Failed to rename prototype' });
  }
});

export default router;
