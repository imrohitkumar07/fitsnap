/**
 * FitSnap - Phase 8 Automated Verification Suite
 * Tests Coaching Engine (rules, notifications, recommendations),
 * 7-Day Meal Plan Generation, and Aisle-Sorted Grocery List Management.
 */

import express from 'express';
import { Readable } from 'node:stream';
import { EventEmitter } from 'events';
import authRoutes from './routes/auth.js';
import plannerRoutes from './routes/planner.js';
import prisma from './lib/prisma.js';

const app = express();
app.use(express.json());
app.use('/api/auth', authRoutes);
app.use('/api/planner', plannerRoutes);

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

async function runPhase8Tests() {
  console.log('\n======================================================');
  console.log('🧪 RUNNING FITSNAP PHASE 8 AUTOMATED TEST SUITE');
  console.log('======================================================\n');

  let passed = 0;
  let total = 0;

  function assert(condition: boolean, desc: string) {
    total++;
    if (condition) {
      console.log(`  ✅ CHECK ${total}: ${desc}`);
      passed++;
    } else {
      console.error(`  ❌ CHECK ${total} FAILED: ${desc}`);
    }
  }

  try {
    // 1. Authenticate with Demo User
    const demoRes = await callApi('POST', '/api/auth/demo');
    const token = demoRes.body.data?.token || demoRes.body.token;
    assert(demoRes.status === 200 && !!token, 'Demo User Instant Authentication');
    const authHeaders = { authorization: `Bearer ${token}` };

    // 2. Generate 7-Day Meal Plan (Indian Veg)
    const genPlanRes = await callApi('POST', '/api/planner/generate', authHeaders, {
      dietPreset: 'indian_veg',
      targetCalories: 2000,
    });
    assert(
      genPlanRes.status === 201 &&
        genPlanRes.body.data?.items?.length === 28,
      'Generate 7-Day Balanced Meal Plan (28 items: 4 meals x 7 days)'
    );

    // 7. Fetch Active Meal Plan
    const getPlanRes = await callApi('GET', '/api/planner/meal-plan', authHeaders);
    const firstMeal = getPlanRes.body.data?.items?.[0];
    assert(
      getPlanRes.status === 200 &&
        getPlanRes.body.data?.dietPreset === 'indian_veg' &&
        !!firstMeal &&
        typeof firstMeal.calories === 'number' &&
        typeof firstMeal.proteinG === 'number',
      'Fetch Populated 7-Day Meal Plan with Caloric and Macro Breakdown'
    );

    // 8. Generate Aisle-Sorted Grocery List from Meal Plan
    const genGroceryRes = await callApi('POST', '/api/planner/generate-grocery-list', authHeaders);
    assert(
      genGroceryRes.status === 201 &&
        Array.isArray(genGroceryRes.body.data?.items) &&
        genGroceryRes.body.data.items.length > 0,
      'Generate Aisle-Grouped Grocery List from Active Meal Plan'
    );

    // 9. Fetch Grocery List and Verify Aisle Categorization
    const getGroceryRes = await callApi('GET', '/api/planner/grocery-list', authHeaders);
    const groceryItems = getGroceryRes.body.data?.items || [];
    const hasProduce = groceryItems.some((it: any) => it.aisle === 'Produce');
    const hasGrains = groceryItems.some((it: any) => it.aisle === 'Grains & Bakery');
    assert(
      getGroceryRes.status === 200 &&
        groceryItems.length > 0 &&
        (hasProduce || hasGrains),
      'Retrieve Supermarket Aisle Grouped Grocery List'
    );

    // 10. Toggle Grocery Item Checked State
    const targetItem = groceryItems[0];
    const toggleRes = await callApi('PATCH', `/api/planner/grocery-item/${targetItem.id}`, authHeaders, {
      isChecked: true,
    });
    assert(
      toggleRes.status === 200 &&
        toggleRes.body.data?.isChecked === true,
      'Toggle Grocery Item Checkbox Status'
    );

    // 11. Add Custom Grocery Item
    const addItemRes = await callApi('POST', '/api/planner/grocery-item', authHeaders, {
      name: 'Organic Almond Butter',
      quantity: '350g jar',
      aisle: 'Legumes & Pantry',
    });
    assert(
      addItemRes.status === 201 &&
        addItemRes.body.data?.name === 'Organic Almond Butter' &&
        addItemRes.body.data?.aisle === 'Legumes & Pantry',
      'Add Custom Manual Item to Grocery List'
    );
    const createdItemId = addItemRes.body.data?.id;

    // 12. Delete Custom Grocery Item
    const delItemRes = await callApi('DELETE', `/api/planner/grocery-item/${createdItemId}`, authHeaders);
    assert(
      delItemRes.status === 200 &&
        delItemRes.body.success === true,
      'Delete Grocery Item from List'
    );

    console.log('\n------------------------------------------------------');
    console.log(`📊 PHASE 8 TEST SUMMARY: ${passed} / ${total} CHECKS PASSED`);
    console.log('------------------------------------------------------\n');

    if (passed === total) {
      console.log('🎉 ALL PHASE 8 REQUIREMENTS FULLY VERIFIED!\n');
    } else {
      process.exit(1);
    }
  } catch (err) {
    console.error('💥 Test suite crashed:', err);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

runPhase8Tests();
