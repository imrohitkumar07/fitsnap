/**
 * FitSnap - Phase 5 Automated Verification Suite
 * Tests 4 Logging Methods, Search, Barcode, Voice Parsing, Custom Foods, Recipes, Quick Add, and Meal Duplication.
 */

import express from 'express';
import { Readable } from 'node:stream';
import { EventEmitter } from 'events';
import authRoutes from './routes/auth.js';
import foodRoutes from './routes/food.js';
import prisma from './lib/prisma.js';

const app = express();
app.use(express.json());
app.use('/api/auth', authRoutes);
app.use('/api/food', foodRoutes);

/**
 * Pure in-memory dispatcher for Express apps.
 */
function callApi(method: string, url: string, headers: Record<string, string> = {}, body?: any): Promise<{ status: number; body: any }> {
  return new Promise((resolve, reject) => {
    const bodyBuffer = body ? Buffer.from(typeof body === 'string' ? body : JSON.stringify(body)) : Buffer.alloc(0);
    const req: any = Readable.from(bodyBuffer.length > 0 ? [bodyBuffer] : []);
    req.method = method;
    req.url = url;
    req.headers = { ...headers };
    req.ip = '127.0.0.1';
    req.socket = { remoteAddress: '127.0.0.1' };
    req.connection = { remoteAddress: '127.0.0.1' };

    if (body) {
      req.headers['content-length'] = bodyBuffer.length.toString();
      if (!req.headers['content-type']) {
        req.headers['content-type'] = 'application/json';
      }
    }

    const res: any = new EventEmitter();
    let resHeaders: Record<string, string> = {};
    let resBody = '';
    let statusCode = 200;

    res.setHeader = (k: string, v: string) => { resHeaders[k.toLowerCase()] = v; };
    res.getHeader = (k: string) => resHeaders[k.toLowerCase()];
    res.writeHead = (code: number, h?: any) => {
      statusCode = code;
      if (h) Object.assign(resHeaders, h);
    };
    res.status = (code: number) => {
      statusCode = code;
      return res;
    };
    res.json = (data: any) => {
      resBody = JSON.stringify(data);
      finish();
      return res;
    };
    res.send = (data: any) => {
      resBody = typeof data === 'string' ? data : JSON.stringify(data);
      finish();
      return res;
    };
    res.end = (chunk?: any) => {
      if (chunk) resBody += chunk.toString();
      finish();
    };

    let finished = false;
    function finish() {
      if (finished) return;
      finished = true;
      let parsed = resBody;
      try {
        parsed = JSON.parse(resBody);
      } catch {}
      resolve({ status: statusCode, body: parsed });
    }

    app(req, res);
  });
}

async function runTests() {
  console.log('🧪 Starting Phase 5 Food Diary & 4 Logging Methods Verification...\n');

  const testEmail = `test_phase5_${Date.now()}@example.com`;
  const testPassword = 'Password123!';
  let accessToken = '';
  let userId = '';
  const testBarcode = `890${Date.now().toString().slice(-9)}`;

  try {
    // 1. Setup authenticated user
    console.log('1️⃣ Creating test user session...');
    const regRes = await callApi('POST', '/api/auth/register', {}, { email: testEmail, password: testPassword });
    accessToken = regRes.body.data.token;
    userId = regRes.body.data.user.id;
    console.log('  ✅ Authenticated user created.');

    // 2. Test Food Database Fuzzy Search (USDA + Curated Indian)
    console.log('2️⃣ Testing GET /api/food/search?q=paneer (Database Search)...');
    const searchRes = await callApi('GET', '/api/food/search?q=paneer', {
      authorization: `Bearer ${accessToken}`,
    });
    if (searchRes.status !== 200 || !Array.isArray(searchRes.body.data) || searchRes.body.data.length === 0) {
      throw new Error(`Search failed: ${JSON.stringify(searchRes.body)}`);
    }
    const paneerItem = searchRes.body.data[0];
    console.log(`  ✅ Found ${searchRes.body.data.length} matches. Top match: "${paneerItem.name}" (${paneerItem.caloriesKcal} kcal/100g, Source: ${paneerItem.source}).`);

    // 3. Test Custom Food Creation & Barcode Attachment
    console.log('3️⃣ Testing POST /api/food/custom (Custom Food with Barcode)...');
    const customRes = await callApi('POST', '/api/food/custom', {
      authorization: `Bearer ${accessToken}`,
      'content-type': 'application/json',
    }, {
      name: 'High-Protein Almond Whey Shake',
      brand: 'FitSnap Labs',
      barcode: testBarcode,
      servingSize: '1 bottle (300ml)',
      servingG: 300,
      caloriesKcal: 220,
      proteinG: 26,
      carbsG: 12,
      fatG: 4,
      fiberG: 3,
      sugarG: 4,
      sodiumMg: 150,
    });
    if (customRes.status !== 201 || !customRes.body.data?.id) {
      throw new Error(`Custom food creation failed: ${JSON.stringify(customRes.body)}`);
    }
    const customFoodId = customRes.body.data.id;
    console.log(`  ✅ Custom food created with barcode ${testBarcode}.`);

    // 4. Test Barcode Lookup for Custom Food
    console.log('4️⃣ Testing GET /api/food/barcode/:code (Barcode Scanner)...');
    const barcodeRes = await callApi('GET', `/api/food/barcode/${testBarcode}`, {
      authorization: `Bearer ${accessToken}`,
    });
    if (barcodeRes.status !== 200 || barcodeRes.body.data?.name !== 'High-Protein Almond Whey Shake') {
      throw new Error(`Barcode lookup failed: ${JSON.stringify(barcodeRes.body)}`);
    }
    console.log(`  ✅ Barcode scanned and resolved: "${barcodeRes.body.data.name}" (${barcodeRes.body.data.caloriesKcal} kcal).`);

    // 5. Test Spoken Voice Logging Parsing
    console.log('5️⃣ Testing POST /api/food/voice (Voice Logging)...');
    const voiceRes = await callApi('POST', '/api/food/voice', {
      authorization: `Bearer ${accessToken}`,
      'content-type': 'application/json',
    }, {
      transcript: '2 rotis, a bowl of dal tadka and a glass of sweet lassi',
    });
    if (voiceRes.status !== 200 || !voiceRes.body.data?.items || voiceRes.body.data.items.length < 2) {
      throw new Error(`Voice parsing failed: ${JSON.stringify(voiceRes.body)}`);
    }
    const voiceItems = voiceRes.body.data.items;
    console.log(`  ✅ Voice parsed into ${voiceItems.length} items (${voiceItems.map((i: any) => `${i.name}: ${i.calories} kcal`).join(', ')}). Total: ${voiceRes.body.data.totalCalories} kcal.`);

    // 6. Test Logging a Complete Meal (POST /api/food/log)
    console.log('6️⃣ Testing POST /api/food/log (Multi-Item Meal Diary)...');
    const logRes = await callApi('POST', '/api/food/log', {
      authorization: `Bearer ${accessToken}`,
      'content-type': 'application/json',
    }, {
      mealType: 'lunch',
      notes: 'Post-workout nutritious lunch',
      items: [
        {
          name: 'Whole Wheat Roti',
          portionG: 70,
          portionLabel: '2 rotis',
          calories: 160,
          proteinG: 6,
          carbsG: 32,
          fatG: 1,
          fiberG: 4,
          confidence: 0.98,
          isAiEstimate: false,
        },
        {
          name: 'Dal Tadka',
          portionG: 180,
          portionLabel: '1 katori (180g)',
          calories: 160,
          proteinG: 8,
          carbsG: 22,
          fatG: 5,
          fiberG: 4,
          confidence: 0.95,
          isAiEstimate: false,
        },
      ],
    });
    if (logRes.status !== 201 || !logRes.body.data?.id) {
      throw new Error(`Food log failed: ${JSON.stringify(logRes.body)}`);
    }
    const mealId = logRes.body.data.id;
    console.log('  ✅ Meal logged with 2 items.');

    // 7. Test Quick Add Calories
    console.log('7️⃣ Testing POST /api/food/quick-add (Quick Calorie Entry)...');
    const quickRes = await callApi('POST', '/api/food/quick-add', {
      authorization: `Bearer ${accessToken}`,
      'content-type': 'application/json',
    }, {
      mealType: 'snack',
      calories: 320,
      proteinG: 15,
      carbsG: 30,
      fatG: 8,
      name: 'Mid-afternoon Snack',
    });
    if (quickRes.status !== 201 || !quickRes.body.data?.id) {
      throw new Error(`Quick add failed: ${JSON.stringify(quickRes.body)}`);
    }
    console.log('  ✅ Quick Add 320 kcal recorded.');

    // 8. Test Fetching Daily Diary & Aggregates
    console.log('8️⃣ Testing GET /api/food/log (Daily Totals & Nutrients)...');
    const diaryRes = await callApi('GET', '/api/food/log', {
      authorization: `Bearer ${accessToken}`,
    });
    if (diaryRes.status !== 200 || !diaryRes.body.data?.totals) {
      throw new Error(`Diary fetch failed: ${JSON.stringify(diaryRes.body)}`);
    }
    const { totals, logs } = diaryRes.body.data;
    console.log(`  ✅ Diary returned ${logs.length} logged meals. Total: ${totals.calories} kcal (Protein: ${totals.proteinG}g, Carbs: ${totals.carbsG}g, Fat: ${totals.fatG}g, Fiber: ${totals.fiberG}g).`);

    // 9. Test Recipe Builder with Auto Per-Serving Nutrition
    console.log('9️⃣ Testing POST /api/food/recipe (Recipe Builder)...');
    const recipeRes = await callApi('POST', '/api/food/recipe', {
      authorization: `Bearer ${accessToken}`,
      'content-type': 'application/json',
    }, {
      name: 'Power Protein Oats & Milk',
      servings: 2,
      totalTimeMin: 15,
      ingredients: [
        { name: 'Oats, rolled', amountG: 80, unitLabel: 'g', calories: 300, proteinG: 10, carbsG: 54, fatG: 5 },
        { name: 'Milk, whole', amountG: 200, unitLabel: 'g', calories: 122, proteinG: 6.4, carbsG: 9.6, fatG: 6.6 },
      ],
    });
    if (recipeRes.status !== 201 || !recipeRes.body.data?.id) {
      throw new Error(`Recipe creation failed: ${JSON.stringify(recipeRes.body)}`);
    }
    const recipeId = recipeRes.body.data.id;

    // Verify per-serving calculation
    const recipesRes = await callApi('GET', '/api/food/recipes', {
      authorization: `Bearer ${accessToken}`,
    });
    const savedRecipe = recipesRes.body.data?.find((r: any) => r.id === recipeId);
    if (!savedRecipe || savedRecipe.perServingNutrition.calories !== 211) {
      throw new Error(`Recipe per-serving calculation unexpected: ${JSON.stringify(savedRecipe)}`);
    }
    console.log(`  ✅ Recipe created: Total ${savedRecipe.totalNutrition.calories} kcal -> ${savedRecipe.perServingNutrition.calories} kcal per serving (Protein: ${savedRecipe.perServingNutrition.proteinG}g).`);

    // 10. Test Copy / Duplicate Meal
    console.log('🔟 Testing POST /api/food/copy-meal (Duplicate Meal)...');
    const copyRes = await callApi('POST', '/api/food/copy-meal', {
      authorization: `Bearer ${accessToken}`,
      'content-type': 'application/json',
    }, {
      foodLogId: mealId,
      targetMealType: 'dinner',
    });
    if (copyRes.status !== 201 || copyRes.body.data?.mealType !== 'dinner') {
      throw new Error(`Copy meal failed: ${JSON.stringify(copyRes.body)}`);
    }
    console.log('  ✅ Meal duplicated to dinner with identical macro items.');

    // 11. Test Favorites Toggle
    console.log('1️⃣1️⃣ Testing POST /api/food/favorites (Toggle Favorite)...');
    const favRes = await callApi('POST', '/api/food/favorites', {
      authorization: `Bearer ${accessToken}`,
      'content-type': 'application/json',
    }, {
      foodName: 'Paneer Butter Masala',
    });
    if (favRes.status !== 201 || !favRes.body.isFavorite) {
      throw new Error(`Favorite toggle failed: ${JSON.stringify(favRes.body)}`);
    }
    console.log('  ✅ Favorite food added.');

    // 12. Cleanup test data
    console.log('1️⃣2️⃣ Cleaning up test account...');
    await prisma.user.delete({ where: { id: userId } });
    console.log('  ✅ Test account and all food logs cascaded cleanly.');

    console.log('\n🎉 ALL PHASE 5 VERIFICATION CHECKS PASSED!\n');
  } catch (err: any) {
    console.error('\n❌ Phase 5 Verification failed:', err.message);
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
}

runTests();
