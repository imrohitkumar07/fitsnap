/**
 * FitSnap Server - Food Logging Routes
 * Complete food tracking backend with 4 logging methods:
 * 1. Photo Vision (Gemini + ConvNeXt V2 Consensus + Grad-CAM)
 * 2. Barcode Scanner (Open Food Facts + Custom Foods + USDA)
 * 3. Spoken Voice Logging (Gemini Natural Language Speech Parser)
 * 4. Fuzzy Database Search (USDA FNDDS + Curated Indian + User Custom Foods)
 * Plus: Custom Food CRUD, Recipe Builder, Quick Add, and Meal Copy/Move.
 */

import { Router, Response } from 'express';
import prisma from '../lib/prisma.js';
import { authMiddleware, AuthRequest } from '../middleware/auth.js';
import { uploadMemory } from '../middleware/upload.js';
import { analyzeFoodImageWithML } from '../services/mlVisionService.js';
import { groundFoodItems } from '../services/foodMatcher.js';
import { lookupOpenFoodFacts } from '../services/barcodeService.js';
import { parseVoiceTranscript } from '../services/voiceFoodParser.js';
import { foodLogSchema, customFoodSchema, recipeSchema } from '../schemas.js';

const router = Router();

router.use(authMiddleware);

// ─── 1. FOOD SEARCH & AUTOCOMPLETE ──────────────────────────────────────────

// GET /api/food/search?q=...
// Fuzzy search over USDA FNDDS + Curated Indian + User Custom Foods
router.get('/search', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.userId;
    const rawQuery = (req.query.q as string || '').trim();

    if (!rawQuery) {
      // Return popular staple foods by default
      const defaults = await prisma.foodDatabase.findMany({
        where: {
          OR: [
            { source: { startsWith: 'curated' } },
            { name: { in: ['Aloo Paratha (Whole wheat stuffed with spiced potato)', 'Plain Paratha (Tawa paratha, whole wheat with ghee)', 'Bread, paratha', 'Puri (Deep-fried whole wheat flatbread)', 'Milk, whole', 'Egg, whole, raw', 'Oatmeal, cooked', 'Chicken breast, grilled', 'Rice, white, cooked', 'Banana, raw', 'Apple, raw'] } },
          ],
        },
        include: { portions: true },
        take: 20,
        orderBy: [{ source: 'desc' }, { name: 'asc' }],
      });

      return res.json({
        success: true,
        data: defaults.map(formatFoodSearchItem),
      });
    }

    const tokens = rawQuery.toLowerCase().split(/\s+/).filter((t) => t.length > 0);

    // Search user's custom foods
    const customMatches = await prisma.customFood.findMany({
      where: {
        userId,
        OR: tokens.map((token) => ({ name: { contains: token } })),
      },
      take: 10,
    });

    // Search reference database with multi-field matching (name, displayName, aliases, category)
    const rawMatches = await prisma.foodDatabase.findMany({
      where: {
        OR: [
          ...tokens.map((token) => ({ name: { contains: token } })),
          ...tokens.map((token) => ({ displayName: { contains: token } })),
          ...tokens.map((token) => ({ aliases: { contains: token } })),
          ...tokens.map((token) => ({ category: { contains: token } })),
        ],
      },
      include: {
        portions: {
          orderBy: { gramWeight: 'asc' },
        },
      },
      take: 80,
    });

    // Score and rank by relevance to user query
    const qLower = rawQuery.toLowerCase();
    const dbMatches = rawMatches
      .map((item) => {
        let score = 0;
        const dName = (item.displayName || item.name).toLowerCase();
        const rName = item.name.toLowerCase();
        const cat = (item.category || '').toLowerCase();
        const aliases = (item.aliases || '').toLowerCase();

        // Exact match
        if (dName === qLower || rName === qLower) score += 100;
        // Starts with query
        else if (dName.startsWith(qLower) || rName.startsWith(qLower)) score += 60;
        else if (tokens[0] && (dName.startsWith(tokens[0]) || rName.startsWith(tokens[0]))) score += 40;

        // Alias match (Hindi / Hinglish / regional)
        if (aliases.includes(qLower)) score += 50;
        else if (tokens.some((t) => aliases.includes(t))) score += 30;

        // Word boundary match
        if (dName.includes(' ' + qLower) || rName.includes(' ' + qLower)) score += 30;

        // Source priority: Curated Indian > USDA Foundation > USDA SR Legacy > FNDDS
        if (item.source?.startsWith('curated')) score += 35;
        else if (item.source === 'usda_foundation') score += 20;
        else if (item.source === 'usda_sr_legacy') score += 10;

        // Status verified bonus
        if (item.status === 'verified') score += 10;

        // Category match
        if (cat.includes(qLower)) score += 5;

        return { item, score };
      })
      .sort((a, b) => b.score - a.score)
      .map((entry) => entry.item)
      .slice(0, 30);

    const formattedCustom = customMatches.map((c) => ({
      id: c.id,
      fdcId: null,
      name: `${c.name}${c.brand ? ` (${c.brand})` : ''}`,
      category: 'Custom Foods',
      source: 'custom',
      caloriesKcal: c.caloriesKcal,
      proteinG: c.proteinG,
      carbsG: c.carbsG,
      fatG: c.fatG,
      fiberG: c.fiberG || 0,
      sugarG: c.sugarG || 0,
      sodiumMg: c.sodiumMg || 0,
      per100g: {
        calories: c.caloriesKcal,
        protein: c.proteinG,
        carbs: c.carbsG,
        fat: c.fatG,
        fiber: c.fiberG || 0,
        sugar: c.sugarG || 0,
        sodium: c.sodiumMg || 0,
      },
      defaultPortion: { id: 'custom_serving', description: c.servingSize || '1 serving', gramWeight: c.servingG || 100 },
      portions: [
        { id: 'custom_serving', description: c.servingSize || '1 serving', gramWeight: c.servingG || 100 },
        { id: '100g', description: '100g', gramWeight: 100 },
      ],
      portionG: c.servingG || 100,
      portionLabel: c.servingSize || '1 serving',
      calories: Math.round((c.caloriesKcal * (c.servingG || 100)) / 100),
    }));

    return res.json({
      success: true,
      data: [...formattedCustom, ...dbMatches.map(formatFoodSearchItem)],
    });
  } catch (error: any) {
    console.error('Food search error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to search foods.',
    });
  }
});

function formatFoodSearchItem(f: any) {
  const portions = (f.portions || []).map((p: any) => ({
    id: p.id,
    description: p.description,
    gramWeight: p.gramWeight,
  }));

  const defaultPortion = portions.length > 0 ? portions[0] : { id: 'default', description: '1 serving (100g)', gramWeight: 100 };
  const displayName = f.displayName || f.name.replace(/,.*$/, '').trim();

  let aliases: string[] = [];
  try {
    if (f.aliases) aliases = JSON.parse(f.aliases);
  } catch {}

  return {
    id: f.id,
    fdcId: f.fdcId,
    name: f.name,
    displayName,
    aliases,
    category: f.category,
    source: f.source,
    sourceId: f.sourceId,
    sourceDate: f.sourceDate,
    status: f.status || 'verified',
    conflictNote: f.conflictNote,
    caloriesKcal: f.caloriesKcal,
    proteinG: f.proteinG,
    carbsG: f.carbsG,
    fatG: f.fatG,
    fiberG: f.fiberG,
    sugarG: f.sugarG,
    sodiumMg: f.sodiumMg,
    per100g: {
      calories: f.caloriesKcal,
      protein: f.proteinG,
      carbs: f.carbsG,
      fat: f.fatG,
      fiber: f.fiberG,
      sugar: f.sugarG,
      sodium: f.sodiumMg,
    },
    defaultPortion,
    portions,
    portionG: defaultPortion.gramWeight,
    portionLabel: defaultPortion.description,
    calories: f.caloriesKcal != null ? Math.round((f.caloriesKcal * defaultPortion.gramWeight) / 100) : null,
  };
}

// ─── 2. PHOTO SCAN & DUAL-MODEL CONSENSUS ───────────────────────────────────

// POST /api/food/analyze - Photo upload and AI vision analysis with database grounding
router.post('/analyze', uploadMemory.single('image'), async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.userId;
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: 'No image file provided. Please capture or upload a food photo.',
      });
    }

    const imageBuffer = req.file.buffer;
    const mimeType = req.file.mimetype;

    // Execute local custom ML pipeline (Custom ResNet Food Classifier + U-Net Segmenter)
    const { vision, mlRaw } = await analyzeFoodImageWithML(imageBuffer, mimeType);

    // Part 4: Learn from Corrections - Check user prototype vector matches
    const userPrototypeMatches: any[] = [];
    const queryEmb = mlRaw?.embedding;

    if (userId && Array.isArray(queryEmb) && queryEmb.length === 512) {
      try {
        const userPrototypes = await prisma.userFoodPrototype.findMany({
          where: { userId },
        });

        // Group embeddings by foodName
        const grouped = new Map<string, number[][]>();
        for (const up of userPrototypes) {
          try {
            const vec = JSON.parse(up.embedding);
            if (Array.isArray(vec) && vec.length === 512) {
              if (!grouped.has(up.foodName)) grouped.set(up.foodName, []);
              grouped.get(up.foodName)!.push(vec);
            }
          } catch {}
        }

        // Compare query vector with prototype groups (requires >= 3 examples, mean cosine >= 0.70)
        for (const [foodName, vectors] of grouped.entries()) {
          if (vectors.length >= 3) {
            let sumSim = 0;
            for (const v of vectors) {
              let dot = 0;
              for (let i = 0; i < 512; i++) dot += queryEmb[i] * v[i];
              sumSim += dot;
            }
            const meanSim = sumSim / vectors.length;
            if (meanSim >= 0.70) {
              userPrototypeMatches.push({
                foodName,
                similarity: Number(meanSim.toFixed(4)),
                sampleCount: vectors.length,
                badge: 'from your earlier photos',
              });
            }
          }
        }

        userPrototypeMatches.sort((a, b) => b.similarity - a.similarity);
      } catch (protoErr) {
        console.warn('Prototype comparison error:', protoErr);
      }
    }

    // Build predictions list with user prototype matches prepended if matched
    let finalPredictions = mlRaw?.predictions ? [...mlRaw.predictions] : [];
    if (userPrototypeMatches.length > 0) {
      const topProto = userPrototypeMatches[0];
      finalPredictions.unshift({
        class_name: topProto.foodName.toLowerCase().replace(/\s+/g, '_'),
        confidence: topProto.similarity,
        display_name: topProto.foodName,
        category: 'Personal Diet',
        source: 'from your earlier photos',
        fromUserPrototypes: true,
        portions: [{ description: '1 serving (150g)', gramWeight: 150 }],
      } as any);
    }

    // Ground food detection against USDA/Indian reference database
    let groundedFoods: any[] = [];
    const isUnknown = mlRaw?.recognition_state === 'unknown';

    if (isUnknown) {
      // Do not silently force an unknown food into a wrong class!
      groundedFoods = (vision.foods || []).map((item) => ({
        ...item,
        embedding: mlRaw?.embedding,
        segmentation: mlRaw?.segmentation,
        qualityChecks: mlRaw?.quality_checks,
        modelAgreement: false,
        recognitionState: 'unknown',
        userPrototypeMatches,
      }));
    } else {
      groundedFoods = await groundFoodItems(vision.foods || []);
      if (mlRaw && mlRaw.top_prediction) {
        groundedFoods = groundedFoods.map((item) => ({
          ...item,
          embedding: mlRaw.embedding,
          segmentation: mlRaw.segmentation,
          qualityChecks: mlRaw.quality_checks,
          modelAgreement: true,
          recognitionState: mlRaw.recognition_state || 'recognised',
          userPrototypeMatches,
        }));
      }
    }

    return res.json({
      success: true,
      data: {
        foods: groundedFoods,
        recognitionState: mlRaw?.recognition_state || (isUnknown ? 'unknown' : 'recognised'),
        stateMessage: mlRaw?.state_message,
        calibratedConfidence: mlRaw?.calibrated_confidence,
        entropy: mlRaw?.entropy,
        prototypeDistance: mlRaw?.prototype_distance,
        closestPrototypeClass: mlRaw?.closest_prototype_class,
        embedding: mlRaw?.embedding,
        userPrototypeMatches,
        isAiEstimate: isUnknown || groundedFoods.some((f) => f.isAiEstimate),
        segmentation: mlRaw?.segmentation,
        qualityChecks: mlRaw?.quality_checks,
        predictions: finalPredictions,
        model: mlRaw?.model || 'custom_resnet_silu_se',
      },
    });
  } catch (error: any) {
    console.error('Food analysis error:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to analyze food image.',
    });
  }
});

// ─── 3. BARCODE SCANNER LOOKUP ──────────────────────────────────────────────

// GET /api/food/barcode/:code
router.get('/barcode/:code', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.userId;
    const barcode = String(req.params.code || '').trim();

    if (!barcode) {
      return res.status(400).json({
        success: false,
        error: 'Barcode parameter is required.',
      });
    }

    // 1. Check user's custom foods
    const customFood = await prisma.customFood.findFirst({
      where: { userId, barcode },
    });

    if (customFood) {
      return res.json({
        success: true,
        source: 'User Custom Foods',
        data: {
          id: customFood.id,
          barcode: customFood.barcode,
          name: customFood.name,
          displayName: customFood.name,
          brand: customFood.brand,
          servingSize: customFood.servingSize,
          servingG: customFood.servingG,
          caloriesKcal: customFood.caloriesKcal,
          proteinG: customFood.proteinG,
          carbsG: customFood.carbsG,
          fatG: customFood.fatG,
          fiberG: customFood.fiberG || 0,
          sugarG: customFood.sugarG || 0,
          sodiumMg: customFood.sodiumMg || 0,
          status: 'verified',
          missingFields: [],
          portions: [
            { description: customFood.servingSize || '1 serving', gramWeight: customFood.servingG || 100 },
            { description: '100g', gramWeight: 100 },
          ],
        },
      });
    }

    // 2. Query Open Food Facts global database with SQLite cache & missing-fields audit
    const offProduct = await lookupOpenFoodFacts(barcode);
    if (offProduct) {
      return res.json({
        success: true,
        source: 'Open Food Facts (ODbL)',
        data: offProduct,
      });
    }

    return res.status(404).json({
      success: false,
      error: `No product found for barcode ${barcode}. You can create a custom food item with this barcode.`,
    });
  } catch (error: any) {
    console.error('Barcode lookup error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to look up barcode.',
    });
  }
});

// ─── 4. VOICE LOGGING PARSER ────────────────────────────────────────────────

// POST /api/food/voice
router.post('/voice', async (req: AuthRequest, res: Response) => {
  try {
    const { transcript } = req.body;
    if (!transcript || typeof transcript !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'Spoken transcript text is required.',
      });
    }

    const parsedItems = await parseVoiceTranscript(transcript);

    return res.json({
      success: true,
      data: {
        transcript,
        items: parsedItems,
        totalCalories: parsedItems.reduce((acc, it) => acc + (it.calories || 0), 0),
      },
    });
  } catch (error: any) {
    console.error('Voice parsing error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to parse voice food description.',
    });
  }
});

// ─── 5. FOOD LOG CRUD ───────────────────────────────────────────────────────

// POST /api/food/log - Save logged meal with multiple items
router.post('/log', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.userId;
    const parsed = foodLogSchema.safeParse(req.body);

    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        error: parsed.error.errors[0]?.message || 'Invalid food log data',
      });
    }

    const { mealType, photoUrl, date, notes, items, embedding: logEmbedding } = parsed.data;
    const logDate = date ? new Date(date) : new Date();

    const foodLog = await prisma.foodLog.create({
      data: {
        userId,
        mealType,
        photoUrl,
        notes,
        date: logDate,
        items: {
          create: items.map((item: any) => ({
            name: item.name,
            portionG: Number(item.portionG) || 100,
            portionLabel: item.portionLabel || `${item.portionG || 100}g`,
            calories: Number(item.calories) || 0,
            proteinG: Number(item.proteinG) || 0,
            carbsG: Number(item.carbsG) || 0,
            fatG: Number(item.fatG) || 0,
            fiberG: Number(item.fiberG) || 0,
            sugarG: Number(item.sugarG) || 0,
            sodiumMg: Number(item.sodiumMg) || 0,
            confidence: Number(item.confidence) || 1.0,
            isAiEstimate: item.isAiEstimate ?? false,
            badge: item.badge || 'chosen by you',
            source: item.source || 'Database',
          })),
        },
      },
      include: {
        items: true,
      },
    });

    // Part 4: Learn from Corrections - Store prototype embedding without retraining
    for (const item of items) {
      const emb = (item as any).embedding || logEmbedding;
      if (Array.isArray(emb) && emb.length === 512 && item.name && item.name !== 'Food Not Recognised') {
        try {
          const cleanName = item.name.replace(/\s*\(.*\)$/, '').trim();
          await prisma.userFoodPrototype.create({
            data: {
              userId,
              foodName: cleanName,
              embedding: JSON.stringify(emb),
            },
          });
        } catch (protoErr) {
          console.warn('Failed to save UserFoodPrototype:', protoErr);
        }
      }
    }

    return res.status(201).json({
      success: true,
      data: foodLog,
    });
  } catch (error: any) {
    console.error('Error saving food log:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to save food log',
    });
  }
});

// ─── 6. USER FOOD PROTOTYPES (CORRECTION LEARNING) ──────────────────────────

// GET /api/food/prototypes - List learned prototype foods for this user
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

// DELETE /api/food/prototypes/:foodName - Delete stored prototypes for a food
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

// PUT /api/food/prototypes/:foodName - Rename stored prototypes
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

// GET /api/food/log?date=YYYY-MM-DD - Get meals for a specific date
router.get('/log', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.userId;
    const dateParam = req.query.date as string | undefined;

    const targetDate = dateParam ? new Date(dateParam) : new Date();
    const startOfDay = new Date(targetDate);
    startOfDay.setHours(0, 0, 0, 0);

    const endOfDay = new Date(targetDate);
    endOfDay.setHours(23, 59, 59, 999);

    const logs = await prisma.foodLog.findMany({
      where: {
        userId,
        date: {
          gte: startOfDay,
          lte: endOfDay,
        },
      },
      include: {
        items: true,
      },
      orderBy: { createdAt: 'asc' },
    });

    let totalCalories = 0;
    let totalProtein = 0;
    let totalCarbs = 0;
    let totalFat = 0;
    let totalFiber = 0;

    for (const log of logs) {
      for (const item of log.items) {
        totalCalories += item.calories;
        totalProtein += item.proteinG;
        totalCarbs += item.carbsG;
        totalFat += item.fatG;
        totalFiber += item.fiberG || 0;
      }
    }

    return res.json({
      success: true,
      data: {
        logs,
        totals: {
          calories: Math.round(totalCalories),
          proteinG: Math.round(totalProtein),
          carbsG: Math.round(totalCarbs),
          fatG: Math.round(totalFat),
          fiberG: Math.round(totalFiber),
        },
      },
    });
  } catch (error: any) {
    console.error('Error fetching food logs:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to fetch food logs',
    });
  }
});

// PUT /api/food/log/:id - Edit an existing meal
router.put('/log/:id', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.userId;
    const id = req.params.id as string;
    const { mealType, items } = req.body;

    const existing = await prisma.foodLog.findFirst({
      where: { id, userId },
      include: { items: true },
    });

    if (!existing) {
      return res.status(404).json({
        success: false,
        error: 'Meal not found.',
      });
    }

    if (mealType) {
      await prisma.foodLog.update({
        where: { id },
        data: { mealType },
      });
    }

    if (items && Array.isArray(items)) {
      await prisma.foodItem.deleteMany({
        where: { foodLogId: id },
      });

      await prisma.foodItem.createMany({
        data: items.map((item: any) => ({
          foodLogId: id,
          name: item.name,
          portionG: Number(item.portionG) || 100,
          portionLabel: item.portionLabel || `${item.portionG || 100}g`,
          calories: Number(item.calories) || 0,
          proteinG: Number(item.proteinG) || 0,
          carbsG: Number(item.carbsG) || 0,
          fatG: Number(item.fatG) || 0,
          fiberG: Number(item.fiberG) || 0,
        })),
      });
    }

    const updated = await prisma.foodLog.findUnique({
      where: { id },
      include: { items: true },
    });

    return res.json({
      success: true,
      data: updated,
    });
  } catch (error: any) {
    console.error('Error updating food log:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to update food log.',
    });
  }
});

// DELETE /api/food/log/:id - Delete a meal
router.delete('/log/:id', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.userId;
    const id = req.params.id as string;

    const log = await prisma.foodLog.findFirst({
      where: { id, userId },
    });

    if (!log) {
      return res.status(404).json({
        success: false,
        error: 'Food log not found',
      });
    }

    await prisma.foodLog.delete({
      where: { id },
    });

    return res.json({
      success: true,
      message: 'Meal deleted successfully',
      deletedId: id,
    });
  } catch (error: any) {
    console.error('Error deleting food log:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to delete food log',
    });
  }
});

// ─── 6. QUICK ADD CALORIES & COPY/MOVE MEAL ─────────────────────────────────

// POST /api/food/quick-add - Instant caloric entry without ingredients
router.post('/quick-add', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.userId;
    const { mealType = 'snack', calories, proteinG = 0, carbsG = 0, fatG = 0, name = 'Quick Add', date } = req.body;

    if (!calories || Number(calories) <= 0) {
      return res.status(400).json({
        success: false,
        error: 'Calories amount must be greater than 0.',
      });
    }

    const foodLog = await prisma.foodLog.create({
      data: {
        userId,
        mealType,
        date: date ? new Date(date) : new Date(),
        items: {
          create: [
            {
              name,
              portionG: 100,
              portionLabel: 'Quick Entry',
              calories: Math.round(Number(calories)),
              proteinG: Number(proteinG) || 0,
              carbsG: Number(carbsG) || 0,
              fatG: Number(fatG) || 0,
              confidence: 1.0,
              isAiEstimate: false,
            },
          ],
        },
      },
      include: { items: true },
    });

    return res.status(201).json({
      success: true,
      data: foodLog,
    });
  } catch (error: any) {
    console.error('Quick add error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to record quick calories.',
    });
  }
});

// POST /api/food/copy-meal - Copy or move meal to another meal type or date
router.post('/copy-meal', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.userId;
    const { foodLogId, targetMealType, targetDate, move = false } = req.body;

    const sourceMeal = await prisma.foodLog.findFirst({
      where: { id: foodLogId, userId },
      include: { items: true },
    });

    if (!sourceMeal) {
      return res.status(404).json({
        success: false,
        error: 'Source meal not found.',
      });
    }

    const newLog = await prisma.foodLog.create({
      data: {
        userId,
        mealType: targetMealType || sourceMeal.mealType,
        date: targetDate ? new Date(targetDate) : sourceMeal.date,
        photoUrl: sourceMeal.photoUrl,
        notes: sourceMeal.notes,
        items: {
          create: sourceMeal.items.map((it) => ({
            name: it.name,
            portionG: it.portionG,
            portionLabel: it.portionLabel,
            calories: it.calories,
            proteinG: it.proteinG,
            carbsG: it.carbsG,
            fatG: it.fatG,
            fiberG: it.fiberG,
            sugarG: it.sugarG,
            sodiumMg: it.sodiumMg,
            confidence: it.confidence,
            isAiEstimate: it.isAiEstimate,
          })),
        },
      },
      include: { items: true },
    });

    if (move) {
      await prisma.foodLog.delete({ where: { id: foodLogId } });
    }

    return res.status(201).json({
      success: true,
      message: move ? 'Meal moved successfully' : 'Meal copied successfully',
      data: newLog,
    });
  } catch (error: any) {
    console.error('Copy/move meal error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to copy/move meal.',
    });
  }
});

// ─── 7. CUSTOM FOODS CRUD ───────────────────────────────────────────────────

// GET /api/food/custom - List user's custom created foods
router.get('/custom', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.userId;
    const customFoods = await prisma.customFood.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });

    return res.json({
      success: true,
      data: customFoods,
    });
  } catch (error: any) {
    console.error('Fetch custom foods error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to fetch custom foods.',
    });
  }
});

// POST /api/food/custom - Create a custom food item with nutrition facts label
router.post('/custom', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.userId;
    const parsed = customFoodSchema.safeParse(req.body);

    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        error: parsed.error.errors[0]?.message || 'Invalid custom food data.',
      });
    }

    const { barcode, name, brand, servingSize, servingG, caloriesKcal, proteinG, carbsG, fatG, fiberG, sugarG, sodiumMg } = parsed.data;

    const customFood = await prisma.customFood.create({
      data: {
        userId,
        barcode: barcode?.trim() || null,
        name: name.trim(),
        brand: brand?.trim() || null,
        servingSize,
        servingG,
        caloriesKcal,
        proteinG,
        carbsG,
        fatG,
        fiberG: fiberG ?? 0,
        sugarG: sugarG ?? 0,
        sodiumMg: sodiumMg ?? 0,
      },
    });

    return res.status(201).json({
      success: true,
      data: customFood,
    });
  } catch (error: any) {
    console.error('Create custom food error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to save custom food.',
    });
  }
});

// DELETE /api/food/custom/:id - Delete a custom food
router.delete('/custom/:id', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.userId;
    const id = req.params.id as string;

    const existing = await prisma.customFood.findFirst({
      where: { id, userId },
    });

    if (!existing) {
      return res.status(404).json({
        success: false,
        error: 'Custom food not found.',
      });
    }

    await prisma.customFood.delete({ where: { id } });

    return res.json({
      success: true,
      message: 'Custom food deleted.',
    });
  } catch (error: any) {
    console.error('Delete custom food error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to delete custom food.',
    });
  }
});

// ─── 8. RECIPES BUILDER CRUD ────────────────────────────────────────────────

// GET /api/food/recipes - List all user recipes with per-serving nutrition
router.get('/recipes', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.userId;
    const recipes = await prisma.recipe.findMany({
      where: { userId },
      include: { ingredients: true },
      orderBy: { createdAt: 'desc' },
    });

    const formatted = recipes.map((r) => {
      let totalCal = 0, totalP = 0, totalC = 0, totalF = 0;
      for (const ing of r.ingredients) {
        totalCal += ing.calories;
        totalP += ing.proteinG;
        totalC += ing.carbsG;
        totalF += ing.fatG;
      }
      const servings = Math.max(1, r.servings);
      return {
        ...r,
        totalNutrition: {
          calories: Math.round(totalCal),
          proteinG: Math.round(totalP),
          carbsG: Math.round(totalC),
          fatG: Math.round(totalF),
        },
        perServingNutrition: {
          calories: Math.round(totalCal / servings),
          proteinG: Math.round((totalP / servings) * 10) / 10,
          carbsG: Math.round((totalC / servings) * 10) / 10,
          fatG: Math.round((totalF / servings) * 10) / 10,
        },
      };
    });

    return res.json({
      success: true,
      data: formatted,
    });
  } catch (error: any) {
    console.error('Fetch recipes error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to fetch recipes.',
    });
  }
});

// POST /api/food/recipe - Create a recipe with auto per-serving calculation
router.post('/recipe', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.userId;
    const parsed = recipeSchema.safeParse(req.body);

    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        error: parsed.error.errors[0]?.message || 'Invalid recipe data.',
      });
    }

    const { name, description, servings, totalTimeMin, sourceUrl, ingredients } = parsed.data;

    const recipe = await prisma.recipe.create({
      data: {
        userId,
        name,
        description,
        servings,
        totalTimeMin,
        sourceUrl,
        ingredients: {
          create: ingredients.map((ing) => ({
            name: ing.name,
            amountG: ing.amountG,
            unitLabel: ing.unitLabel,
            calories: ing.calories,
            proteinG: ing.proteinG,
            carbsG: ing.carbsG,
            fatG: ing.fatG,
          })),
        },
      },
      include: { ingredients: true },
    });

    return res.status(201).json({
      success: true,
      data: recipe,
    });
  } catch (error: any) {
    console.error('Create recipe error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to create recipe.',
    });
  }
});

// DELETE /api/food/recipe/:id - Delete a recipe
router.delete('/recipe/:id', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.userId;
    const id = req.params.id as string;

    const existing = await prisma.recipe.findFirst({
      where: { id, userId },
    });

    if (!existing) {
      return res.status(404).json({
        success: false,
        error: 'Recipe not found.',
      });
    }

    await prisma.recipe.delete({ where: { id } });

    return res.json({
      success: true,
      message: 'Recipe deleted.',
    });
  } catch (error: any) {
    console.error('Delete recipe error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to delete recipe.',
    });
  }
});

// ─── 9. FAVORITE FOODS ──────────────────────────────────────────────────────

// GET /api/food/favorites
router.get('/favorites', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.userId;
    const favorites = await prisma.favoriteFood.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
    return res.json({ success: true, data: favorites });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: 'Failed to fetch favorites.' });
  }
});

// POST /api/food/favorites - Toggle favorite food
router.post('/favorites', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.userId;
    const { foodName, foodId, source = 'database' } = req.body;

    if (!foodName) {
      return res.status(400).json({ success: false, error: 'foodName is required' });
    }

    const existing = await prisma.favoriteFood.findFirst({
      where: { userId, foodName },
    });

    if (existing) {
      await prisma.favoriteFood.delete({ where: { id: existing.id } });
      return res.json({ success: true, action: 'removed', isFavorite: false });
    }

    const created = await prisma.favoriteFood.create({
      data: { userId, foodName, foodId, source },
    });

    return res.status(201).json({ success: true, action: 'added', isFavorite: true, data: created });
  } catch (error: any) {
    console.error('Toggle favorite error:', error);
    return res.status(500).json({ success: false, error: 'Failed to toggle favorite.' });
  }
});

export default router;
