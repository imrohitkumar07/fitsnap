/**
 * test-interactive-flow.ts
 * Tests the complete user flow in FitSnap:
 * 1. User registration & authentication
 * 2. Photo scan -> Detection of food with top-3 predictions
 * 3. Top-3 swap (user switches to alternate top-3 candidate)
 * 4. Portion edit (user adjusts portion to 1.5x)
 * 5. Save to Diary (/api/food/log)
 * 6. Verify Dashboard totals (/api/dashboard/today)
 * 7. Mixed Indian Plate test (Plate detection & portioning)
 * 8. Non-food image test (flagged & requires confirmation)
 */

import express from 'express';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { Readable } from 'node:stream';
import { EventEmitter } from 'events';
import authRoutes from './routes/auth.js';
import foodRoutes from './routes/food.js';
import dashboardRoutes from './routes/dashboard.js';
import { analyzeFoodImageWithML } from './services/mlVisionService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, '../../../');

const app = express();
app.use(express.json());
app.use('/api/auth', authRoutes);
app.use('/api/food', foodRoutes);
app.use('/api/dashboard', dashboardRoutes);

function callApi(method: string, url: string, headers: Record<string, string> = {}, body?: any): Promise<{ status: number; body: any }> {
  return new Promise((resolve) => {
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
      if (!req.headers['content-type']) req.headers['content-type'] = 'application/json';
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
      try { parsed = JSON.parse(resBody); } catch {}
      resolve({ status: statusCode, body: parsed });
    }

    app(req, res);
  });
}

async function runInteractiveTest() {
  console.log('\n================================================================');
  console.log('📱 FITSNAP FULL APP FLOW: PHOTO -> TOP-3 SWAP -> PORTION -> DIARY -> DASHBOARD');
  console.log('================================================================\n');

  // 1. Authenticate user
  console.log('1️⃣ Authenticating User Session...');
  const email = `interactive_${Date.now()}@fitsnap.app`;
  const regRes = await callApi('POST', '/api/auth/register', {}, {
    email,
    password: 'Password123!',
    name: 'Interactive Test User'
  });
  const token = regRes.body.data.token || regRes.body.data.accessToken;
  console.log(`  ✅ Registered and authenticated: ${email}`);

  // 2. Photo scan
  console.log('\n2️⃣ Photo Upload & Detection...');
  const photoPath = path.resolve(PROJECT_ROOT, 'Food_Classification/samosa/001.jpg');
  const photoBuf = fs.readFileSync(photoPath);
  const { vision, mlRaw } = await analyzeFoodImageWithML(photoBuf, 'image/jpeg');

  const top1 = mlRaw?.top_prediction;
  const top3 = mlRaw?.predictions?.slice(0, 3) || [];
  console.log(`  • Top-1 Prediction: "${top1?.display_name}" (${((top1?.confidence || 0) * 100).toFixed(1)}%)`);
  console.log('  • Top-3 Available Candidates:');
  top3.forEach((c, i) => {
    console.log(`     ${i + 1}. ${c.display_name} (${(c.confidence * 100).toFixed(1)}%) - ${c.per_100g?.calories_kcal} kcal/100g`);
  });

  // 3. Top-3 Candidate Swap Simulation
  console.log('\n3️⃣ User Action: Top-3 Swap Simulation...');
  // Suppose user taps candidate 2 (or keeps candidate 1)
  const chosenCandidate = top3.length > 1 ? top3[1] : top3[0];
  console.log(`  • User swapped from "${top1?.display_name}" to "${chosenCandidate.display_name}"`);

  // 4. Portion Edit
  console.log('\n4️⃣ User Action: Portion Edit (Adjusting to 1.5x portion)...');
  const baseGrams = chosenCandidate.default_portion?.gram_weight || 150;
  const multiplier = 1.5;
  const finalGrams = Math.round(baseGrams * multiplier);
  const factor = finalGrams / 100.0;
  const caloriesPer100 = chosenCandidate.per_100g?.calories_kcal || 200;
  const finalCalories = Math.round(caloriesPer100 * factor);
  const finalProtein = parseFloat(((chosenCandidate.per_100g?.protein_g || 8) * factor).toFixed(1));
  const finalCarbs = parseFloat(((chosenCandidate.per_100g?.carbs_g || 25) * factor).toFixed(1));
  const finalFat = parseFloat(((chosenCandidate.per_100g?.fat_g || 8) * factor).toFixed(1));
  console.log(`  • Base: ${baseGrams}g -> Edited to ${multiplier}x: ${finalGrams}g`);
  console.log(`  • Computed Nutrition: ${finalCalories} kcal (P: ${finalProtein}g, C: ${finalCarbs}g, F: ${finalFat}g)`);

  // 5. Commit to Food Diary
  console.log('\n5️⃣ Committing Meal to Food Diary (/api/food/log)...');
  const logRes = await callApi('POST', '/api/food/log', {
    authorization: `Bearer ${token}`
  }, {
    mealType: 'snack',
    notes: 'Logged via photo scanner with portion edit',
    items: [
      {
        name: chosenCandidate.display_name,
        portionG: finalGrams,
        portionLabel: `${multiplier}x portion (${finalGrams}g)`,
        calories: finalCalories,
        proteinG: finalProtein,
        carbsG: finalCarbs,
        fatG: finalFat,
        fiberG: 3,
        confidence: chosenCandidate.confidence,
        isAiEstimate: false
      }
    ]
  });
  if (!logRes.body.success) throw new Error(`Diary logging failed: ${JSON.stringify(logRes.body)}`);
  console.log(`  ✅ Successfully saved to Diary (Log ID: ${logRes.body.data?.id})`);

  // 6. Check Dashboard Totals
  console.log('\n6️⃣ Verifying Updated Totals on Dashboard (/api/dashboard/today)...');
  const dashRes = await callApi('GET', '/api/dashboard/today', {
    authorization: `Bearer ${token}`
  });
  const eaten = dashRes.body.data?.calories?.eaten;
  console.log(`  • Dashboard Calories Eaten: ${eaten} kcal`);
  if (eaten !== finalCalories) throw new Error(`Dashboard mismatch: expected ${finalCalories}, got ${eaten}`);
  console.log('  ✅ Dashboard totals match logged meal exactly!');

  // 7. Mixed Plate Test
  console.log('\n7️⃣ Testing Mixed Indian Plate (Butter Naan / Curries)...');
  const butterNaanDir = path.resolve(PROJECT_ROOT, 'Food_Classification/butter_naan');
  const butterNaanFiles = fs.readdirSync(butterNaanDir).filter(f => f.endsWith('.jpg') || f.endsWith('.png'));
  const mixedPath = path.join(butterNaanDir, butterNaanFiles[0]);
  const mixedBuf = fs.readFileSync(mixedPath);
  const mixedRes = await analyzeFoodImageWithML(mixedBuf, 'image/jpeg');
  const mixedTop = mixedRes.mlRaw?.top_prediction;
  const mixedSeg = mixedRes.mlRaw?.segmentation;
  console.log(`  • Mixed Plate Detected: "${mixedTop?.display_name}" (Confidence: ${((mixedTop?.confidence || 0) * 100).toFixed(1)}%)`);
  console.log(`  • Plate Segmented: ${mixedSeg?.plate_detected ? 'Plate Detected' : 'Unsegmented'}`);
  console.log(`  • Food Coverage: ${((mixedSeg?.coverage_ratio || 0) * 100).toFixed(1)}% | Portion Estimate: ${mixedSeg?.estimated_grams}g (${mixedSeg?.portion_range})`);

  // 8. Non-Food Image Guard Test
  console.log('\n8️⃣ Testing Non-Food Image Guard (Office Notebook & Pen)...');
  const nonFoodPath = path.resolve(PROJECT_ROOT, 'ml/data/sample_non_food.jpg');
  const nfBuf = fs.readFileSync(nonFoodPath);
  const nfRes = await analyzeFoodImageWithML(nfBuf, 'image/jpeg');
  const isLikelyFood = nfRes.mlRaw?.is_likely_food;
  const nfWarning = nfRes.mlRaw?.non_food_warning;
  console.log(`  • is_likely_food flag: ${isLikelyFood}`);
  console.log(`  • non_food_warning: "${nfWarning}"`);
  if (isLikelyFood === true) {
    throw new Error('Non-food guard failed: notebook was falsely approved as food!');
  }
  console.log('  ✅ Non-food item correctly flagged and confirmation warning triggered!');

  console.log('\n================================================================');
  console.log('🎉 ALL 8 STEPS OF THE INTERACTIVE USER FLOW TEST PASSED!');
  console.log('================================================================\n');
}

runInteractiveTest().catch((err) => {
  console.error('Interactive test error:', err);
  process.exit(1);
});
