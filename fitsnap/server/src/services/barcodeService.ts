/**
 * FitSnap Server - Barcode Lookup Service
 * Resolves commercial barcode / UPC / EAN numbers against Open Food Facts API
 * with local SQLite caching, Atwater macro validation, and missing field detection.
 * Attribution: Open Food Facts (ODbL)
 */

import prisma from '../lib/prisma.js';

export interface BarcodeProduct {
  barcode: string;
  name: string;
  displayName: string;
  brand: string | null;
  category: string;
  imageUrl: string | null;
  servingSize: string;
  servingG: number;
  caloriesKcal: number | null;
  proteinG: number | null;
  carbsG: number | null;
  fatG: number | null;
  fiberG: number | null;
  sugarG: number | null;
  sodiumMg: number | null;
  source: string;
  status: 'verified' | 'approximate' | 'missing';
  missingFields: string[];
  per100g: {
    calories: number | null;
    protein: number | null;
    carbs: number | null;
    fat: number | null;
    fiber: number | null;
    sugar: number | null;
    sodium: number | null;
  };
  perServing: {
    calories: number | null;
    protein: number | null;
    carbs: number | null;
    fat: number | null;
    fiber: number | null;
    sugar: number | null;
    sodium: number | null;
  };
  portions: Array<{ description: string; gramWeight: number }>;
}

/**
 * Look up barcode in local cache first, then Open Food Facts global database.
 */
export async function lookupOpenFoodFacts(barcode: string): Promise<BarcodeProduct | null> {
  const cleanCode = barcode.trim();
  if (!cleanCode) return null;

  // 1. Check SQLite Cache
  try {
    const cached = await prisma.openFoodFactsCache.findUnique({
      where: { barcode: cleanCode },
    });

    if (cached) {
      const portionG = cached.portionG || 100;
      const factor = portionG / 100.0;
      const missingFields: string[] = cached.missingFields ? JSON.parse(cached.missingFields) : [];

      const per100g = {
        calories: cached.caloriesKcal,
        protein: cached.proteinG,
        carbs: cached.carbsG,
        fat: cached.fatG,
        fiber: cached.fiberG,
        sugar: cached.sugarG,
        sodium: cached.sodiumMg,
      };

      const perServing = {
        calories: cached.caloriesKcal != null ? Math.round(cached.caloriesKcal * factor) : null,
        protein: cached.proteinG != null ? parseFloat((cached.proteinG * factor).toFixed(1)) : null,
        carbs: cached.carbsG != null ? parseFloat((cached.carbsG * factor).toFixed(1)) : null,
        fat: cached.fatG != null ? parseFloat((cached.fatG * factor).toFixed(1)) : null,
        fiber: cached.fiberG != null ? parseFloat((cached.fiberG * factor).toFixed(1)) : null,
        sugar: cached.sugarG != null ? parseFloat((cached.sugarG * factor).toFixed(1)) : null,
        sodium: cached.sodiumMg != null ? Math.round(cached.sodiumMg * factor) : null,
      };

      const portions = [{ description: '100g', gramWeight: 100 }];
      if (portionG !== 100) {
        portions.unshift({
          description: cached.portionLabel || `1 serving (${portionG}g)`,
          gramWeight: portionG,
        });
      }

      return {
        barcode: cleanCode,
        name: cached.name,
        displayName: cached.displayName || cached.name,
        brand: null,
        category: cached.category || 'Packaged Foods',
        imageUrl: null,
        servingSize: cached.portionLabel || `${portionG}g`,
        servingG: portionG,
        caloriesKcal: cached.caloriesKcal,
        proteinG: cached.proteinG,
        carbsG: cached.carbsG,
        fatG: cached.fatG,
        fiberG: cached.fiberG,
        sugarG: cached.sugarG,
        sodiumMg: cached.sodiumMg,
        source: 'Open Food Facts (ODbL)',
        status: (cached.status as any) || 'verified',
        missingFields,
        per100g,
        perServing,
        portions,
      };
    }
  } catch (err) {
    console.warn('Cache lookup error:', err);
  }

  // 2. Fetch from Open Food Facts API
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 6000);

    const url = `https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(cleanCode)}.json`;
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'FitSnap-Nutrition-App - Version 2.0 - Contact: support@fitsnap.app',
      },
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (!response.ok) return null;

    const data: any = await response.json();
    if (data.status !== 1 || !data.product) {
      return null;
    }

    const p = data.product;
    const nut = p.nutriments || {};

    const rawName = p.product_name || p.product_name_en || p.generic_name || `Product ${cleanCode}`;
    const brand = p.brands || p.brand_owner || null;
    const displayName = brand ? `${rawName} (${brand})` : rawName;
    const imageUrl = p.image_front_url || p.image_url || null;
    const category = p.categories?.split(',')[0]?.trim() || 'Packaged Foods';

    // Energy calculation (kcal per 100g)
    let caloriesKcal: number | null = null;
    if (nut['energy-kcal_100g'] !== undefined && nut['energy-kcal_100g'] !== null && nut['energy-kcal_100g'] !== '') {
      caloriesKcal = Math.round(Number(nut['energy-kcal_100g']));
    } else if (nut['energy_100g'] !== undefined && nut['energy_100g'] !== null && nut['energy_100g'] !== '') {
      caloriesKcal = Math.round(Number(nut['energy_100g']) / 4.184);
    }

    const proteinG = nut['proteins_100g'] !== undefined && nut['proteins_100g'] !== null && nut['proteins_100g'] !== ''
      ? Math.round(Number(nut['proteins_100g']) * 10) / 10
      : null;

    const carbsG = nut['carbohydrates_100g'] !== undefined && nut['carbohydrates_100g'] !== null && nut['carbohydrates_100g'] !== ''
      ? Math.round(Number(nut['carbohydrates_100g']) * 10) / 10
      : null;

    const fatG = nut['fat_100g'] !== undefined && nut['fat_100g'] !== null && nut['fat_100g'] !== ''
      ? Math.round(Number(nut['fat_100g']) * 10) / 10
      : null;

    const fiberG = nut['fiber_100g'] !== undefined && nut['fiber_100g'] !== null && nut['fiber_100g'] !== ''
      ? Math.round(Number(nut['fiber_100g']) * 10) / 10
      : null;

    const sugarG = nut['sugars_100g'] !== undefined && nut['sugars_100g'] !== null && nut['sugars_100g'] !== ''
      ? Math.round(Number(nut['sugars_100g']) * 10) / 10
      : null;

    const sodiumMg = nut['sodium_100g'] !== undefined && nut['sodium_100g'] !== null && nut['sodium_100g'] !== ''
      ? Math.round(Number(nut['sodium_100g']) * 1000)
      : null;

    // Detect missing fields
    const missingFields: string[] = [];
    if (caloriesKcal === null) missingFields.push('calories');
    if (proteinG === null) missingFields.push('protein');
    if (carbsG === null) missingFields.push('carbohydrates');
    if (fatG === null) missingFields.push('fat');
    if (fiberG === null) missingFields.push('fiber');
    if (sugarG === null) missingFields.push('sugar');
    if (sodiumMg === null) missingFields.push('sodium');

    // Portion estimation
    const servingG = Number(p.serving_quantity) || 100;
    const servingSize = p.serving_size || `${servingG}g`;
    const factor = servingG / 100.0;

    // Determine verification status
    let status: 'verified' | 'approximate' | 'missing' = 'verified';
    if (missingFields.includes('calories') || missingFields.includes('protein') || missingFields.includes('carbs') || missingFields.includes('fat')) {
      status = 'missing';
    } else {
      // Atwater 8% consistency check
      const atwater = (proteinG || 0) * 4 + (carbsG || 0) * 4 + (fatG || 0) * 9;
      const cal = caloriesKcal || 0;
      if (cal > 0) {
        const diffRatio = Math.abs(cal - atwater) / cal;
        if (diffRatio > 0.12 || missingFields.length >= 2) {
          status = 'approximate';
        }
      }
    }

    const per100g = {
      calories: caloriesKcal,
      protein: proteinG,
      carbs: carbsG,
      fat: fatG,
      fiber: fiberG,
      sugar: sugarG,
      sodium: sodiumMg,
    };

    const perServing = {
      calories: caloriesKcal != null ? Math.round(caloriesKcal * factor) : null,
      protein: proteinG != null ? parseFloat((proteinG * factor).toFixed(1)) : null,
      carbs: carbsG != null ? parseFloat((carbsG * factor).toFixed(1)) : null,
      fat: fatG != null ? parseFloat((fatG * factor).toFixed(1)) : null,
      fiber: fiberG != null ? parseFloat((fiberG * factor).toFixed(1)) : null,
      sugar: sugarG != null ? parseFloat((sugarG * factor).toFixed(1)) : null,
      sodium: sodiumMg != null ? Math.round(sodiumMg * factor) : null,
    };

    const portions = [{ description: '100g', gramWeight: 100 }];
    if (servingG !== 100) {
      portions.unshift({ description: `1 serving (${servingSize})`, gramWeight: servingG });
    }

    // 3. Cache result in SQLite
    try {
      await prisma.openFoodFactsCache.upsert({
        where: { barcode: cleanCode },
        update: {
          name: rawName,
          displayName,
          category,
          caloriesKcal,
          proteinG,
          carbsG,
          fatG,
          fiberG,
          sugarG,
          sodiumMg,
          portionG: servingG,
          portionLabel: servingSize,
          source: 'open_food_facts',
          status,
          missingFields: JSON.stringify(missingFields),
        },
        create: {
          barcode: cleanCode,
          name: rawName,
          displayName,
          category,
          caloriesKcal,
          proteinG,
          carbsG,
          fatG,
          fiberG,
          sugarG,
          sodiumMg,
          portionG: servingG,
          portionLabel: servingSize,
          source: 'open_food_facts',
          status,
          missingFields: JSON.stringify(missingFields),
        },
      });
    } catch (cacheErr) {
      console.warn('Failed to cache Open Food Facts product:', cacheErr);
    }

    return {
      barcode: cleanCode,
      name: rawName,
      displayName,
      brand,
      category,
      imageUrl,
      servingSize,
      servingG,
      caloriesKcal,
      proteinG,
      carbsG,
      fatG,
      fiberG,
      sugarG,
      sodiumMg,
      source: 'Open Food Facts (ODbL)',
      status,
      missingFields,
      per100g,
      perServing,
      portions,
    };
  } catch (err: any) {
    console.warn(`Open Food Facts lookup failed for ${barcode}:`, err.message);
    return null;
  }
}

