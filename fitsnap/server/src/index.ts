/**
 * FitSnap Server - Express Application Entry Point
 * Configures middleware, API routes, static file serving, and error handling.
 */

import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { PORT } from './config.js';
import { errorHandler } from './middleware/errorHandler.js';

// Route imports
import authRoutes from './routes/auth.js';
import profileRoutes from './routes/profile.js';
import foodRoutes from './routes/food.js';
import waterRoutes from './routes/water.js';
import workoutRoutes from './routes/workout.js';
import weightRoutes from './routes/weight.js';
import insightsRoutes from './routes/insights.js';
import dashboardRoutes from './routes/dashboard.js';
import plannerRoutes from './routes/planner.js';
import settingsRoutes from './routes/settings.js';
import socialRoutes from './routes/social.js';
import prisma from './lib/prisma.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// Middleware
app.use(
  cors({
    origin: ['http://localhost:5173', 'http://127.0.0.1:5173', 'http://localhost:3000'],
    credentials: true,
  })
);

app.use(express.json({ limit: '15mb' }));
app.use(express.urlencoded({ extended: true, limit: '15mb' }));

// Serve uploaded images statically
app.use('/uploads', express.static(path.resolve(__dirname, '../uploads')));

// Health check probe
app.get('/api/health', async (_req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return res.json({
      status: 'ok',
      app: 'FitSnap API',
      database: 'connected',
      uptimeSec: Math.floor(process.uptime()),
      memoryUsageMb: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    return res.status(503).json({
      status: 'degraded',
      app: 'FitSnap API',
      database: 'disconnected',
      error: error.message,
      timestamp: new Date().toISOString(),
    });
  }
});

// Mount API routes
app.use('/api/auth', authRoutes);
app.use('/api/profile', profileRoutes);
app.use('/api/food', foodRoutes);
app.use('/api/foods', foodRoutes);
app.use('/api/water', waterRoutes);
app.use('/api/workouts', workoutRoutes);
app.use('/api/weight', weightRoutes);
app.use('/api/insights', insightsRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/planner', plannerRoutes);
app.use('/api/api/planner', plannerRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/social', socialRoutes);

// Global error handler
app.use(errorHandler);

// Start server
app.listen(PORT, () => {
  console.log(`\n🚀 FitSnap API server running at: http://localhost:${PORT}`);
  console.log(`📡 Health check: http://localhost:${PORT}/api/health\n`);
});

export default app;
