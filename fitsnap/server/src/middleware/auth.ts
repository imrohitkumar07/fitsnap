/**
 * FitSnap Server - JWT Authentication Middleware
 * Extracts user ID from Bearer token and attaches to req.user.
 */

import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { JWT_SECRET } from '../config.js';

/** Extend Express Request to include user payload */
export interface AuthRequest extends Request {
  user?: {
    userId: string;
    email: string;
  };
}

interface JwtPayload {
  userId: string;
  email: string;
  iat?: number;
  exp?: number;
}

/**
 * Middleware that verifies JWT tokens from the Authorization header.
 * Rejects requests without valid Bearer tokens.
 */
export const authMiddleware = (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): void => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({
        success: false,
        error: 'Authentication required. Please provide a valid token.',
      });
      return;
    }

    const token = authHeader.split(' ')[1];

    if (!token) {
      res.status(401).json({
        success: false,
        error: 'Invalid token format.',
      });
      return;
    }

    const decoded = jwt.verify(token, JWT_SECRET) as JwtPayload;

    req.user = {
      userId: decoded.userId,
      email: decoded.email,
    };

    next();
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      res.status(401).json({
        success: false,
        error: 'Token has expired. Please log in again.',
      });
      return;
    }

    if (error instanceof jwt.JsonWebTokenError) {
      res.status(401).json({
        success: false,
        error: 'Invalid token.',
      });
      return;
    }

    res.status(500).json({
      success: false,
      error: 'Authentication failed.',
    });
  }
};
