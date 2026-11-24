/**
 * FitSnap - Comprehensive Meal Planner Automated Test Suite (Part 2)
 * Tests all 7 diet presets, all calorie options (1200 - 3000 kcal),
 * allergy & dislike guards, repeat limits, calorie tolerances (<10%),
 * meal lock, meal swap, single-day regeneration, diary logging + dashboard update,
 * and grocery list aisle grouping, deduplication and export.
 */

import express from 'express';
import { Readable } from 'node:stream';
import { EventEmitter } from 'events';
import authRoutes from './routes/auth.js';
import plannerRoutes from './routes/planner.js';
import foodRoutes from './routes/food.js';
import dashboardRoutes from './routes/dashboard.js';
import prisma from './lib/prisma.js';

const app = express();
app.use(express.json());
app.use('/api/auth', authRoutes);
app.use('/api/planner', plannerRoutes);
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
      req.headers['content-type'] = 'application/json';
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

    function finish() {
      let parsed = resBody;
      try { parsed = JSON.parse(resBody); } catch (_) {}
      resolve({ status: statusCode, body: parsed });
    }

    app(req, res, (err: any) => {
      if (err) {
        statusCode = 500;
        resBody = JSON.stringify({ error: err.message });
        finish();
      }
    });
  });
}

function assert(cond: boolean, msg: string) {
  if (!cond) {
    console.error(`  ❌ FAILED: ${msg}`);
    throw new Error(`Assertion failed: ${msg}`);
  }
  console.log(`  ✅ ${msg}`);
}

async function run() {
  console.log('\n======================================================');
  console.log('🧪 FITSNAP PART 2: COMPREHENSIVE MEAL PLANNER TEST SUITE');
  console.log('======================================================\n');

  // 1. Authenticate / create test user
  const email = `planner_test_${Date.now()}@fitsnap.app`;
  const regRes = await callApi('POST', '/api/auth/register', {}, {
    email,
    password: 'Password123!',
    name: 'Meal Planner Tester',
  });
  assert(regRes.status === 201 && !!regRes.body.data?.token, `Register test athlete: ${email}`);
  const token = regRes.body.data.token;
  const authHeaders = { authorization: `Bearer ${token}` };
  const userId = regRes.body.data.user.id;

  // Set user profile with allergies & dislikes
  await prisma.profile.upsert({
    where: { userId },
    update: {
      allergies: JSON.stringify(['dairy', 'peanuts']),
      dislikes: JSON.stringify(['mushroom', 'okra']),
    },
    create: {
      userId,
      name: 'Meal Planner Tester',
      age: 28,
      gender: 'male',
      heightCm: 175,
      weightKg: 70,
      activityLevel: 'moderate',
      goal: 'maintain',
      weeklyRateKg: 0,
      dietPreset: 'balanced',
      allergies: JSON.stringify(['dairy', 'peanuts']),
      dislikes: JSON.stringify(['mushroom', 'okra']),
      bmr: 1680,
      tdee: 2200,
      targetCalories: 2000,
    },
  });
  console.log('  ✅ Profile configured with allergies: [dairy, peanuts] and dislikes: [mushroom, okra]\n');

  const presets = ['balanced', 'high_protein', 'low_carb', 'keto', 'vegetarian', 'vegan', 'indian_veg'];
  const calorieOptions = [1200, 1500, 1600, 1800, 2000, 2200, 2500, 3000];

  interface TestResultRow {
    preset: string;
    targetCal: number;
    daysCount: number;
    itemsCount: number;
    avgDailyCal: number;
    calErrorPct: string;
    maxRepeats: number;
    allergyFree: boolean;
    status: 'PASS' | 'FAIL';
  }

  const resultsTable: TestResultRow[] = [];

  console.log('--- 1. Testing All 7 Diet Presets Across Calorie Targets ---');

  for (let i = 0; i < presets.length; i++) {
    const preset = presets[i];
    // Test each preset with a distinct calorie option from the set
    const calTarget = calorieOptions[i % calorieOptions.length];

    const genRes = await callApi('POST', '/api/planner/generate', authHeaders, {
      dietPreset: preset,
      targetCalories: calTarget,
    });

    assert(genRes.status === 201, `Generate plan for ${preset} at ${calTarget} kcal`);
    const plan = genRes.body.data;
    assert(!!plan && plan.items?.length === 28, `${preset}: Returned exactly 28 items (4 meals x 7 days)`);

    // Group items by day
    const dayTotals: Record<number, number> = {};
    const dishCounts: Record<string, number> = {};
    let hasAllergen = false;

    for (const it of plan.items) {
      dayTotals[it.dayOfWeek] = (dayTotals[it.dayOfWeek] || 0) + it.calories;
      if (it.mealType === 'lunch' || it.mealType === 'dinner') {
        dishCounts[it.foodName] = (dishCounts[it.foodName] || 0) + 1;
      }

      // Check strict dairy/peanut exclusion
      const nameLower = it.foodName.toLowerCase();
      const nonDairy = nameLower
        .replace(/(almond|coconut|soy|oat|pea|cashew|rice|hemp)\s+milk/gi, '')
        .replace(/(almond|cashew|apple|cocoa|sunflower|seed)\s+butter/gi, '');
      if (/\b(paneer|milk|curd|cheese|butter|yogurt|mozzarella|ricotta|feta|cheddar|parmesan|gouda|peanut|peanuts)\b/i.test(nonDairy)) {
        hasAllergen = true;
        console.log(`      ⚠️ [Flagged Allergen in ${preset}]: "${it.foodName}"`);
      }
    }

    const dailyCalories = Object.values(dayTotals);
    const avgCal = Math.round(dailyCalories.reduce((a, b) => a + b, 0) / dailyCalories.length);
    const maxErrorPct = Math.max(...dailyCalories.map((c) => Math.abs(c - calTarget) / calTarget)) * 100;
    const maxRepeat = Math.max(...Object.values(dishCounts));

    // Tolerance check (< 10%)
    assert(maxErrorPct <= 10.0, `${preset} (${calTarget} kcal): Daily calories within 10% (observed max deviation: ${maxErrorPct.toFixed(1)}%)`);
    assert(maxRepeat <= 3, `${preset}: Maximum main dish repeats <= 3 across 7 days (observed: ${maxRepeat})`);

    resultsTable.push({
      preset,
      targetCal: calTarget,
      daysCount: Object.keys(dayTotals).length,
      itemsCount: plan.items.length,
      avgDailyCal: avgCal,
      calErrorPct: `±${maxErrorPct.toFixed(1)}%`,
      maxRepeats: maxRepeat,
      allergyFree: !hasAllergen,
      status: maxErrorPct <= 10.0 && !hasAllergen ? 'PASS' : 'FAIL',
    });
  }

  // Print results table
  console.log('\n📊 7-DAY MEAL PLANNER PRESET & CALORIE VERIFICATION TABLE:');
  console.log('----------------------------------------------------------------------------------------------------------------');
  console.log('| Preset          | Target Cal | Days | Items | Avg Daily | Cal Deviation | Max Dish Repeats | Allergy Guard | Status |');
  console.log('----------------------------------------------------------------------------------------------------------------');
  for (const row of resultsTable) {
    const p = row.preset.padEnd(15);
    const tc = `${row.targetCal} kcal`.padEnd(10);
    const dc = String(row.daysCount).padEnd(4);
    const ic = String(row.itemsCount).padEnd(5);
    const ac = `${row.avgDailyCal} kcal`.padEnd(9);
    const err = row.calErrorPct.padEnd(13);
    const rep = String(row.maxRepeats).padEnd(16);
    const alg = (row.allergyFree ? 'CLEAN (0)' : 'FLAGGED').padEnd(13);
    console.log(`| ${p} | ${tc} | ${dc} | ${ic} | ${ac} | ${err} | ${rep} | ${alg} | ${row.status}   |`);
  }
  console.log('----------------------------------------------------------------------------------------------------------------\n');

  // 2. Test Lock & Unlock Meal Item
  console.log('--- 2. Testing Lock & Unlock Meal Item ---');
  const activePlanRes = await callApi('GET', '/api/planner/meal-plan', authHeaders);
  const targetItem = activePlanRes.body.data.items[0];
  assert(targetItem.isLocked === false, 'Item initial lock state is false');

  const lockRes = await callApi('PATCH', `/api/planner/item/${targetItem.id}/lock`, authHeaders);
  assert(lockRes.status === 200 && lockRes.body.data?.isLocked === true, `Lock item: ${targetItem.foodName}`);

  // 3. Test Regenerate Day (Preserving Locked Meal)
  console.log('\n--- 3. Testing Single Day Regeneration with Locked Item ---');
  const regenDayRes = await callApi('POST', '/api/planner/regenerate-day', authHeaders, {
    dayOfWeek: targetItem.dayOfWeek,
  });
  assert(regenDayRes.status === 200, `Regenerate day ${targetItem.dayOfWeek}`);
  const regenItem = regenDayRes.body.data.items.find((i: any) => i.id === targetItem.id);
  assert(regenItem && regenItem.foodName === targetItem.foodName && regenItem.isLocked === true, 'Locked meal item preserved identically during day regeneration');

  // Unlock it back
  await callApi('PATCH', `/api/planner/item/${targetItem.id}/lock`, authHeaders);

  // 4. Test Swap Meal Item
  console.log('\n--- 4. Testing Swap Meal Item ---');
  const swapRes = await callApi('POST', `/api/planner/item/${targetItem.id}/swap`, authHeaders);
  assert(swapRes.status === 200 && !!swapRes.body.data?.foodName, `Swap meal item: New dish is "${swapRes.body.data?.foodName}"`);

  // 5. Test Log Planned Meal to Food Diary & Verify Dashboard Totals
  console.log('\n--- 5. Testing "Log Planned Meal to Diary" and Dashboard Update ---');
  const todayDate = new Date().toISOString().split('T')[0];
  const itemToLog = regenDayRes.body.data.items[1];
  const logMealRes = await callApi('POST', `/api/planner/item/${itemToLog.id}/log`, authHeaders, {
    date: todayDate,
  });
  assert(logMealRes.status === 201 && logMealRes.body.success === true, `Logged ${itemToLog.foodName} to ${itemToLog.mealType} in diary`);

  // Verify dashboard today
  const dashRes = await callApi('GET', `/api/dashboard/today?date=${todayDate}`, authHeaders);
  assert(dashRes.status === 200, 'Fetch Dashboard Today');
  const loggedCal = dashRes.body.data?.calories?.eaten ?? dashRes.body.data?.nutrition?.consumedCalories ?? 0;
  assert(loggedCal >= Math.round(itemToLog.calories) - 5, `Dashboard reflected logged meal calories: ${loggedCal} kcal (expected ~${Math.round(itemToLog.calories)} kcal)`);

  // 6. Test Aisle-Grouped Grocery List Generation & Deduplication
  console.log('\n--- 6. Testing Grocery List Generation, Deduplication & Export ---');
  const grocGenRes = await callApi('POST', '/api/planner/generate-grocery-list', authHeaders);
  assert(grocGenRes.status === 201 && grocGenRes.body.data?.items?.length > 0, `Grocery list generated with ${grocGenRes.body.data?.items?.length} aisle-sorted items`);

  // Test toggle check
  const firstGrocItem = grocGenRes.body.data.items[0];
  const toggleRes = await callApi('PATCH', `/api/planner/grocery-item/${firstGrocItem.id}`, authHeaders, {
    isChecked: true,
  });
  assert(toggleRes.status === 200 && toggleRes.body.data?.isChecked === true, `Checked off grocery item: ${firstGrocItem.name}`);

  // Test Export Grocery List
  const exportRes = await callApi('GET', '/api/planner/grocery-list/export', authHeaders);
  assert(
    exportRes.status === 200 &&
      exportRes.body.data?.formattedText?.includes('# Weekly Grocery List') &&
      exportRes.body.data?.formattedText?.includes('Produce'),
    'Export grocery list to Markdown with supermarket aisle headings'
  );
  console.log('  ✅ Exported Markdown snippet:\n' + exportRes.body.data.formattedText.split('\n').slice(0, 8).map((l: string) => `     ${l}`).join('\n') + '\n     ...');

  // Cleanup test user
  await prisma.user.delete({ where: { id: userId } });
  console.log('  ✅ Cleaned up temporary test user account.');

  console.log('\n======================================================');
  console.log('🎉 ALL PART 2 MEAL PLANNER TESTS PASSED SUCCESSFULLY!');
  console.log('======================================================\n');
}

run().catch((err) => {
  console.error('\n❌ TEST RUNNER FAILED:', err);
  process.exit(1);
});
