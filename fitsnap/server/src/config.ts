/**
 * FitSnap Server - Configuration
 * Loads environment variables from the root .env file.
 */

import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Try loading from project root first, then fallback to server root
const rootEnvPath = path.resolve(__dirname, '../../.env');
const localEnvPath = path.resolve(__dirname, '../.env');

dotenv.config({ path: rootEnvPath });
dotenv.config({ path: localEnvPath });

export const PORT = parseInt(process.env.PORT || '3001', 10);
export const JWT_SECRET = process.env.JWT_SECRET || 'fitsnap-dev-secret-change-in-production';
export const DATABASE_URL = process.env.DATABASE_URL || 'file:./dev.db';
export const ML_SERVICE_URL = process.env.ML_SERVICE_URL || 'http://localhost:8000';
