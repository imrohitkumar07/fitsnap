/**
 * FitSnap Server - Food Matching & Grounding Service
 * Grounds AI vision results (Gemini) against the canonical SQLite FoodDatabase
 * using class_map.json and ranked token search.
 * Provides scaled nutrition, "Verified from database" / "AI estimate" badges,
 * and top-3 alternative choices for the user confirmation screen.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import prisma from '../lib/prisma.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Path to processed class_map.json (prefers 272-class ml/class_map.json)
const CLASS_MAP_PATH = path.resolve(__dirname, '../../../data/processed/class_map.json');
const ML_CLASS_MAP_PATH = path.resolve(__dirname, '../../../../ml/class_map.json');

interface ClassMapEntry {
  class_name: string;
  food_id: string;
  fdc_id: string | null;
  display_name: string;
  category: string;
  source: string;
  per_100g: {
    calories_kcal: number;
    protein_g: number;
    carbs_g: number;
    fat_g: number;
    fiber_g: number | null;
    sugar_g: number | null;
    sodium_mg: number | null;
  };
  default_portion: { description: string; gram_weight: number };
  portions: Array<{ description: string; gram_weight: number }>;
}

let classMapCache: Record<string, ClassMapEntry> | null = null;

function loadClassMap(): Record<string, ClassMapEntry> {
  if (classMapCache) return classMapCache;
  try {
    const targetPath = fs.existsSync(ML_CLASS_MAP_PATH) ? ML_CLASS_MAP_PATH : CLASS_MAP_PATH;
    if (fs.existsSync(targetPath)) {
      const raw = fs.readFileSync(targetPath, 'utf-8');
      classMapCache = jsonParseSafe(raw);
    }
  } catch (err) {
    console.warn('Warning: Failed to load class_map.json:', err);
  }
  return classMapCache || {};
}

function jsonParseSafe(str: string) {
  try {
    return JSON.parse(str);
  } catch {
    return {};
  }
}

export interface GroundedFoodItem {
  name: string;
  originalAiName: string;
  portionG: number;
  portionLabel: string;
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  fiberG: number;
  sugarG: number;
  sodiumMg: number;
  confidence: number;
  isAiEstimate: boolean;
  needsConfirmation?: boolean;
  recognitionState?: string;
  embedding?: number[];
  badge: 'Verified from database' | 'AI estimate';
  source: string;
  matchedFoodId?: string;
  modelAgreement?: boolean;
  agreementDetails?: string;
  portions: Array<{ description: string; gramWeight: number }>;
  alternatives: Array<{
    id: string;
    name: string;
    category: string;
    source: string;
    caloriesKcal: number;
    proteinG: number;
    carbsG: number;
    fatG: number;
    portions: Array<{ description: string; gramWeight: number }>;
  }>;
}

/**
 * Normalizes dish names for fuzzy matching
 */
function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[_-]/g, ' ')
    .replace(/[^a-z0-9 ]/g, '')
    .trim();
}

/**
 * Searches the database for alternative options
 */
export async function getAlternativesForFood(foodName: string, excludeId?: string, limit = 3) {
  const norm = normalizeName(foodName);
  const words = norm.split(/\s+/).filter((w) => w.length > 2);

  if (words.length === 0) {
    const fallback = await prisma.foodDatabase.findMany({
      take: limit,
      where: excludeId ? { id: { not: excludeId } } : undefined,
      include: { portions: true },
    });
    return fallback.map((f) => ({
      id: f.id,
      name: f.displayName || f.name,
      category: f.category,
      source: f.source,
      caloriesKcal: f.caloriesKcal ?? 100,
      proteinG: f.proteinG ?? 0,
      carbsG: f.carbsG ?? 0,
      fatG: f.fatG ?? 0,
      portions: f.portions.map((p) => ({ description: p.description, gramWeight: p.gramWeight })),
    }));
  }

  // Find foods containing words
  const results = await prisma.foodDatabase.findMany({
    where: {
      AND: [
        excludeId ? { id: { not: excludeId } } : {},
        {
          OR: words.map((word) => ({
            name: { contains: word },
          })),
        },
      ],
    },
    take: limit,
    include: { portions: true },
    orderBy: [
      { source: 'desc' }, // prioritize curated
    ],
  });

  return results.map((f) => ({
    id: f.id,
    name: f.displayName || f.name,
    category: f.category,
    source: f.source,
    caloriesKcal: f.caloriesKcal ?? 100,
    proteinG: f.proteinG ?? 0,
    carbsG: f.carbsG ?? 0,
    fatG: f.fatG ?? 0,
    portions: f.portions.map((p) => ({ description: p.description, gramWeight: p.gramWeight })),
  }));
}

/**
 * Grounds a single AI-detected food item in the canonical database
 */
export async function groundFoodItem(aiItem: any): Promise<GroundedFoodItem> {
  const rawName = aiItem.name || 'Unknown Food';
  const portionG = Number(aiItem.portionG) || 100;
  const initialConfidence = Number(aiItem.confidence) || 0.8;
  const classMap = loadClassMap();

  const normName = normalizeName(rawName);

  // 1. Direct or fuzzy lookup in class_map.json
  let mappedClass: ClassMapEntry | null = null;

  for (const [clsKey, entry] of Object.entries(classMap)) {
    const normKey = normalizeName(clsKey);
    const normDisplay = normalizeName(entry.display_name);

    if (normName === normKey || normName === normDisplay || normName.includes(normKey) || normKey.includes(normName)) {
      mappedClass = entry;
      break;
    }
  }

  // 2. If matched via class map, ground immediately
  if (mappedClass) {
    const scale = portionG / 100.0;
    const per100 = mappedClass.per_100g;
    const portions = mappedClass.portions.map((p) => ({
      description: p.description,
      gramWeight: p.gram_weight,
    }));

    const alternatives = await getAlternativesForFood(mappedClass.display_name, mappedClass.food_id, 3);

    return {
      name: mappedClass.display_name,
      originalAiName: rawName,
      portionG,
      portionLabel: aiItem.portionLabel || mappedClass.default_portion?.description || `${portionG}g`,
      calories: Math.round(per100.calories_kcal * scale * 10) / 10,
      proteinG: Math.round(per100.protein_g * scale * 10) / 10,
      carbsG: Math.round(per100.carbs_g * scale * 10) / 10,
      fatG: Math.round(per100.fat_g * scale * 10) / 10,
      fiberG: per100.fiber_g != null ? Math.round(per100.fiber_g * scale * 10) / 10 : 0,
      sugarG: per100.sugar_g != null ? Math.round(per100.sugar_g * scale * 10) / 10 : 0,
      sodiumMg: per100.sodium_mg != null ? Math.round(per100.sodium_mg * scale * 10) / 10 : 0,
      confidence: initialConfidence,
      isAiEstimate: initialConfidence < 0.70,
      needsConfirmation: initialConfidence < 0.70,
      badge: initialConfidence >= 0.70 ? 'Verified from database' : 'AI estimate',
      source: mappedClass.source,
      matchedFoodId: mappedClass.food_id,
      portions,
      alternatives,
    };
  }

  // 3. Database search in FoodDatabase
  const words = normName.split(/\s+/).filter((w) => w.length > 2);
  let dbFood = null;

  if (words.length > 0) {
    dbFood = await prisma.foodDatabase.findFirst({
      where: {
        OR: words.map((w) => ({ name: { contains: w } })),
      },
      include: { portions: true },
      orderBy: [
        { source: 'desc' }, // curated first
      ],
    });
  }

  // If matched in database
  if (dbFood) {
    const scale = portionG / 100.0;
    const portions = dbFood.portions.map((p) => ({
      description: p.description,
      gramWeight: p.gramWeight,
    }));
    const alternatives = await getAlternativesForFood(dbFood.name, dbFood.id, 3);
    const calPer100 = dbFood.caloriesKcal ?? 100;
    const protPer100 = dbFood.proteinG ?? 0;
    const carbPer100 = dbFood.carbsG ?? 0;
    const fatPer100 = dbFood.fatG ?? 0;

    return {
      name: dbFood.displayName || dbFood.name,
      originalAiName: rawName,
      portionG,
      portionLabel: aiItem.portionLabel || (portions[0] ? portions[0].description : `${portionG}g`),
      calories: Math.round(calPer100 * scale * 10) / 10,
      proteinG: Math.round(protPer100 * scale * 10) / 10,
      carbsG: Math.round(carbPer100 * scale * 10) / 10,
      fatG: Math.round(fatPer100 * scale * 10) / 10,
      fiberG: dbFood.fiberG != null ? Math.round(dbFood.fiberG * scale * 10) / 10 : 0,
      sugarG: dbFood.sugarG != null ? Math.round(dbFood.sugarG * scale * 10) / 10 : 0,
      sodiumMg: dbFood.sodiumMg != null ? Math.round(dbFood.sodiumMg * scale * 10) / 10 : 0,
      confidence: initialConfidence,
      isAiEstimate: initialConfidence < 0.70,
      needsConfirmation: initialConfidence < 0.70,
      badge: initialConfidence >= 0.70 ? 'Verified from database' : 'AI estimate',
      source: dbFood.source,
      matchedFoodId: dbFood.id,
      portions,
      alternatives,
    };
  }

  // 4. Fallback to AI estimate if no database match
  const alternatives = await getAlternativesForFood(rawName, undefined, 3);
  return {
    name: rawName,
    originalAiName: rawName,
    portionG,
    portionLabel: aiItem.portionLabel || `${portionG}g`,
    calories: Number(aiItem.calories) || 0,
    proteinG: Number(aiItem.proteinG) || 0,
    carbsG: Number(aiItem.carbsG) || 0,
    fatG: Number(aiItem.fatG) || 0,
    fiberG: Number(aiItem.fiberG) || 0,
    sugarG: Number(aiItem.sugarG) || 0,
    sodiumMg: Number(aiItem.sodiumMg) || 0,
    confidence: initialConfidence,
    isAiEstimate: true,
    badge: 'AI estimate',
    source: 'Gemini AI Vision',
    portions: [
      { description: '1 serving (100g)', gramWeight: 100 },
      { description: '1 standard portion', gramWeight: portionG },
    ],
    alternatives,
  };
}

/**
 * Grounds an array of foods detected by AI
 */
export async function groundFoodItems(aiFoods: any[]): Promise<GroundedFoodItem[]> {
  const grounded: GroundedFoodItem[] = [];
  for (const item of aiFoods) {
    grounded.push(await groundFoodItem(item));
  }
  return grounded;
}
