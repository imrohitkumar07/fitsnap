/**
 * FitSnap Server - Authentication Routes
 * Handles user registration, login, token refresh rotation, password recovery, session logout, and audit logging.
 */

import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import prisma from '../lib/prisma.js';
import { JWT_SECRET } from '../config.js';
import { registerSchema, loginSchema } from '../schemas.js';
import { authMiddleware, AuthRequest } from '../middleware/auth.js';

const router = Router();

/**
 * Creates a cryptographically random refresh token and records it in SQLite.
 * Valid for 60 days.
 */
async function createRefreshToken(userId: string): Promise<string> {
  const token = crypto.randomBytes(40).toString('hex');
  const expiresAt = new Date(Date.now() + 60 * 24 * 60 * 60 * 1000); // 60 days
  await prisma.refreshToken.create({
    data: {
      userId,
      token,
      expiresAt,
    },
  });
  return token;
}

/**
 * Records an entry into the audit trail for regulatory and security tracking.
 */
async function recordAuditLog(action: string, userId?: string, ipAddress?: string, details?: any) {
  try {
    await prisma.auditLog.create({
      data: {
        action,
        userId: userId || null,
        ipAddress: ipAddress || null,
        details: details ? JSON.stringify(details) : null,
      },
    });
  } catch (e) {
    console.warn('Failed to persist audit log entry:', e);
  }
}

// POST /api/auth/register
router.post('/register', async (req: Request, res: Response) => {
  try {
    const parsed = registerSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        code: 'VALIDATION_ERROR',
        error: parsed.error.errors[0]?.message || 'Invalid input data',
      });
    }

    const { email, password } = parsed.data;
    const normalizedEmail = email.toLowerCase().trim();

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email: normalizedEmail },
    });

    if (existingUser) {
      return res.status(409).json({
        success: false,
        code: 'EMAIL_EXISTS',
        error: 'An account with this email already exists.',
      });
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    // Create user
    const user = await prisma.user.create({
      data: {
        email: normalizedEmail,
        passwordHash,
      },
      select: {
        id: true,
        email: true,
        createdAt: true,
      },
    });

    // Generate JWT Access Token (30d)
    const token = jwt.sign(
      { userId: user.id, email: user.email },
      JWT_SECRET,
      { expiresIn: '30d' }
    );

    // Generate Refresh Token
    const refreshToken = await createRefreshToken(user.id);

    // Record audit event
    await recordAuditLog('USER_REGISTER', user.id, req.ip, { email: normalizedEmail });

    return res.status(201).json({
      success: true,
      data: {
        user,
        token,
        refreshToken,
        isOnboarded: false,
      },
    });
  } catch (error: any) {
    console.error('Registration error:', error);
    return res.status(500).json({
      success: false,
      code: 'SERVER_ERROR',
      error: 'Registration failed. Please try again.',
    });
  }
});

// POST /api/auth/login
router.post('/login', async (req: Request, res: Response) => {
  try {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        code: 'VALIDATION_ERROR',
        error: parsed.error.errors[0]?.message || 'Invalid credentials format',
      });
    }

    const { email, password } = parsed.data;
    const normalizedEmail = email.toLowerCase().trim();

    // Find user
    const user = await prisma.user.findUnique({
      where: { email: normalizedEmail },
      include: {
        profile: true,
        goals: {
          where: { isActive: true },
          take: 1,
        },
      },
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        code: 'USER_NOT_FOUND',
        error: 'No account found with this email address.',
      });
    }

    // Verify password
    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        code: 'WRONG_PASSWORD',
        error: 'Incorrect password. Please try again.',
      });
    }

    // Generate JWT
    const token = jwt.sign(
      { userId: user.id, email: user.email },
      JWT_SECRET,
      { expiresIn: '30d' }
    );

    // Generate Refresh Token
    const refreshToken = await createRefreshToken(user.id);

    const { passwordHash: _, ...safeUser } = user;

    // Record audit event
    await recordAuditLog('USER_LOGIN', user.id, req.ip, { email: normalizedEmail });

    return res.json({
      success: true,
      data: {
        user: safeUser,
        token,
        refreshToken,
        isOnboarded: !!user.profile,
      },
    });
  } catch (error: any) {
    console.error('Login error:', error);
    return res.status(500).json({
      success: false,
      code: 'SERVER_ERROR',
      error: 'Login failed. Please try again.',
    });
  }
});

// POST /api/auth/refresh - Rotate access & refresh tokens
router.post('/refresh', async (req: Request, res: Response) => {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) {
      return res.status(400).json({
        success: false,
        code: 'MISSING_TOKEN',
        error: 'Refresh token is required.',
      });
    }

    const storedToken = await prisma.refreshToken.findUnique({
      where: { token: refreshToken },
      include: {
        user: {
          include: {
            profile: true,
            goals: { where: { isActive: true }, take: 1 },
          },
        },
      },
    });

    if (!storedToken) {
      return res.status(401).json({
        success: false,
        code: 'INVALID_REFRESH_TOKEN',
        error: 'Invalid or revoked refresh token.',
      });
    }

    // Check expiry
    if (new Date() > storedToken.expiresAt) {
      await prisma.refreshToken.delete({ where: { id: storedToken.id } });
      return res.status(401).json({
        success: false,
        code: 'EXPIRED_REFRESH_TOKEN',
        error: 'Refresh token has expired. Please log in again.',
      });
    }

    // Token Rotation: Delete old token and create a brand new one
    await prisma.refreshToken.delete({ where: { id: storedToken.id } });
    const newRefreshToken = await createRefreshToken(storedToken.userId);

    const newAccessToken = jwt.sign(
      { userId: storedToken.user.id, email: storedToken.user.email },
      JWT_SECRET,
      { expiresIn: '30d' }
    );

    const { passwordHash: _, ...safeUser } = storedToken.user;

    return res.json({
      success: true,
      data: {
        token: newAccessToken,
        refreshToken: newRefreshToken,
        user: safeUser,
        isOnboarded: !!storedToken.user.profile,
      },
    });
  } catch (error: any) {
    console.error('Refresh token error:', error);
    return res.status(500).json({
      success: false,
      code: 'SERVER_ERROR',
      error: 'Token refresh failed.',
    });
  }
});

// POST /api/auth/logout - Invalidate refresh token session
router.post('/logout', async (req: Request, res: Response) => {
  try {
    const { refreshToken } = req.body;
    if (refreshToken) {
      await prisma.refreshToken.deleteMany({
        where: { token: refreshToken },
      });
    }
    return res.json({
      success: true,
      message: 'Logged out successfully.',
    });
  } catch (error: any) {
    return res.json({
      success: true,
      message: 'Logged out.',
    });
  }
});

// POST /api/auth/demo - 1-Click instant demo login
router.post('/demo', async (req: Request, res: Response) => {
  try {
    const demoEmail = 'demo@fitsnap.app';
    let demoUser = await prisma.user.findUnique({
      where: { email: demoEmail },
      include: {
        profile: true,
        goals: { where: { isActive: true }, take: 1 },
      },
    });

    if (!demoUser) {
      const salt = await bcrypt.genSalt(10);
      const passwordHash = await bcrypt.hash('password123', salt);

      demoUser = await prisma.user.create({
        data: {
          email: demoEmail,
          passwordHash,
          profile: {
            create: {
              name: 'Alex Johnson',
              age: 28,
              gender: 'male',
              heightCm: 178,
              weightKg: 74.5,
              activityLevel: 'moderate',
              goal: 'maintain',
              bmr: 1720,
              tdee: 2400,
            },
          },
          goals: {
            create: {
              calories: 2400,
              proteinG: 160,
              carbsG: 260,
              fatG: 75,
              fiberG: 32,
              waterMl: 2800,
              isActive: true,
            },
          },
        },
        include: {
          profile: true,
          goals: { where: { isActive: true }, take: 1 },
        },
      });
    }

    const token = jwt.sign(
      { userId: demoUser.id, email: demoUser.email },
      JWT_SECRET,
      { expiresIn: '30d' }
    );
    const refreshToken = await createRefreshToken(demoUser.id);
    const { passwordHash: _, ...safeUser } = demoUser;

    await recordAuditLog('DEMO_LOGIN', demoUser.id, req.ip, { email: demoEmail });

    return res.json({
      success: true,
      data: {
        user: safeUser,
        token,
        refreshToken,
        isOnboarded: true,
      },
    });
  } catch (error: any) {
    console.error('Demo login error:', error);
    return res.status(500).json({
      success: false,
      code: 'SERVER_ERROR',
      error: 'Demo login failed.',
    });
  }
});

// GET /api/auth/me - Validate token and retrieve current user + profile + goal
router.get('/me', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.userId;

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        createdAt: true,
        profile: true,
        goals: {
          where: { isActive: true },
          take: 1,
        },
      },
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        code: 'USER_NOT_FOUND',
        error: 'User not found.',
      });
    }

    return res.json({
      success: true,
      data: {
        user: {
          id: user.id,
          email: user.email,
          createdAt: user.createdAt,
          profile: user.profile,
          goal: user.goals[0] || null,
        },
        isOnboarded: !!user.profile,
      },
    });
  } catch (error: any) {
    console.error('Auth /me error:', error);
    return res.status(500).json({
      success: false,
      code: 'SERVER_ERROR',
      error: 'Failed to retrieve current user session.',
    });
  }
});

// POST /api/auth/forgot-password - Simulated password recovery
router.post('/forgot-password', async (req: Request, res: Response) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({
        success: false,
        error: 'Email is required.',
      });
    }

    const normalizedEmail = email.toLowerCase().trim();
    const user = await prisma.user.findUnique({
      where: { email: normalizedEmail },
    });

    if (!user) {
      return res.json({
        success: true,
        message: 'If an account exists with this email, password reset instructions have been sent.',
      });
    }

    await recordAuditLog('FORGOT_PASSWORD_REQUEST', user.id, req.ip, { email: normalizedEmail });

    return res.json({
      success: true,
      message: `Password reset instructions have been sent to ${normalizedEmail}. For demo purposes, you can use the instant demo button or reset password directly.`,
    });
  } catch (error: any) {
    console.error('Forgot password error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to process password reset request.',
    });
  }
});

// POST /api/auth/reset-password
router.post('/reset-password', async (req: Request, res: Response) => {
  try {
    const { email, newPassword } = req.body;
    if (!email || !newPassword || newPassword.length < 6) {
      return res.status(400).json({
        success: false,
        error: 'Please provide a valid email and new password (minimum 6 characters).',
      });
    }

    const normalizedEmail = email.toLowerCase().trim();
    const user = await prisma.user.findUnique({
      where: { email: normalizedEmail },
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'No account found with this email.',
      });
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(newPassword, salt);

    await prisma.user.update({
      where: { id: user.id },
      data: { passwordHash },
    });

    await recordAuditLog('PASSWORD_RESET', user.id, req.ip, { email: normalizedEmail });

    return res.json({
      success: true,
      message: 'Password reset successfully. You can now log in with your new password.',
    });
  } catch (error: any) {
    console.error('Reset password error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to reset password.',
    });
  }
});

// POST /api/auth/change-password (Authenticated)
router.post('/change-password', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.userId;
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword || newPassword.length < 6) {
      return res.status(400).json({
        success: false,
        error: 'New password must be at least 6 characters.',
      });
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found.',
      });
    }

    const isMatch = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!isMatch) {
      return res.status(400).json({
        success: false,
        error: 'Current password is incorrect.',
      });
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(newPassword, salt);

    await prisma.user.update({
      where: { id: userId },
      data: { passwordHash },
    });

    await recordAuditLog('PASSWORD_CHANGED', userId, req.ip);

    return res.json({
      success: true,
      message: 'Password updated successfully.',
    });
  } catch (error: any) {
    console.error('Change password error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to update password.',
    });
  }
});

// DELETE /api/auth/account (GDPR / Privacy Compliance)
router.delete('/account', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.userId;

    await recordAuditLog('DELETE_ACCOUNT', userId, req.ip);

    // Delete user (cascade removes profile, goals, foodLogs, waterLogs, workouts, weightLogs, etc.)
    await prisma.user.delete({
      where: { id: userId },
    });

    return res.json({
      success: true,
      message: 'Your account and all associated data have been permanently deleted.',
    });
  } catch (error: any) {
    console.error('Delete account error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to delete account.',
    });
  }
});

export default router;
