/**
 * FitSnap Server - Global Error Handler Middleware
 * Catches all unhandled errors and formats them consistently.
 * Provides special formatting for Zod validation errors.
 */

import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';

/**
 * Global error handling middleware.
 * Must be registered AFTER all routes.
 */
export const errorHandler = (
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction
): void => {
  console.error('🚨 Error:', err.message);

  // Handle Zod validation errors with detailed field messages
  if (err instanceof ZodError) {
    const fieldErrors = err.errors.map((e) => ({
      field: e.path.join('.'),
      message: e.message,
    }));

    res.status(400).json({
      success: false,
      error: 'Validation failed',
      details: fieldErrors,
    });
    return;
  }

  // Handle known HTTP errors with status codes
  if ('statusCode' in err && typeof (err as any).statusCode === 'number') {
    res.status((err as any).statusCode).json({
      success: false,
      error: err.message,
    });
    return;
  }

  // Default 500 error
  res.status(500).json({
    success: false,
    error:
      process.env.NODE_ENV === 'production'
        ? 'Internal server error'
        : err.message || 'Internal server error',
  });
};
