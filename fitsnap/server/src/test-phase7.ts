/**
 * FitSnap - Phase 7 Automated Verification Suite
 * Tests Weight Moving Averages, Circumference Measurements, Progress Photos,
 * Caloric Balance Reports, AI Coaching Insights, and Ask FitSnap assistant.
 */

import express from 'express';
import { Readable } from 'node:stream';
import { EventEmitter } from 'events';
import authRoutes from './routes/auth.js';
import weightRoutes from './routes/weight.js';
import dashboardRoutes from './routes/dashboard.js';
import insightsRoutes from './routes/insights.js';
import prisma from './lib/prisma.js';

const app = express();
app.use(express.json());
app.use('/api/auth', authRoutes);
app.use('/api/weight', weightRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/insights', insightsRoutes);

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
  console.log('🧪 Starting Phase 7 Progress, Reports, Insights & Dashboard Verification...\n');

  const testEmail = `test_phase7_${Date.now()}@example.com`;
  const testPassword = 'Password123!';
  let accessToken = '';
  let userId = '';

  try {
    // 1. Setup authenticated user
    console.log('1️⃣ Creating test user session...');
    const regRes = await callApi('POST', '/api/auth/register', {}, { email: testEmail, password: testPassword });
    accessToken = regRes.body.data.token;
    userId = regRes.body.data.user.id;
    console.log('  ✅ Authenticated user created.');

    // 2. Log Weight entries across multiple dates
    console.log('2️⃣ Testing POST /api/weight (Multiple scale readings)...');
    const d1 = new Date();
    d1.setDate(d1.getDate() - 3);
    const d2 = new Date();
    d2.setDate(d2.getDate() - 1);
    const d3 = new Date();

    await callApi('POST', '/api/weight', {
      authorization: `Bearer ${accessToken}`,
      'content-type': 'application/json',
    }, { weightKg: 75.5, date: d1.toISOString() });

    await callApi('POST', '/api/weight', {
      authorization: `Bearer ${accessToken}`,
      'content-type': 'application/json',
    }, { weightKg: 75.0, date: d2.toISOString() });

    await callApi('POST', '/api/weight', {
      authorization: `Bearer ${accessToken}`,
      'content-type': 'application/json',
    }, { weightKg: 74.6, date: d3.toISOString() });
    console.log('  ✅ Logged 3 weight entries (75.5kg -> 75.0kg -> 74.6kg).');

    // 3. Test Weight History and 7-day Moving Average
    console.log('3️⃣ Testing GET /api/weight/history (Moving average & net delta)...');
    const weightRes = await callApi('GET', '/api/weight/history', {
      authorization: `Bearer ${accessToken}`,
    });
    if (weightRes.status !== 200 || !weightRes.body.trend) {
      throw new Error(`Weight history failed: ${JSON.stringify(weightRes.body)}`);
    }
    const { trend, data: weightLogs } = weightRes.body;
    console.log(`  ✅ Weight trend: Start=${trend.startWeightKg}kg, Current=${trend.currentWeightKg}kg, Net Change=${trend.netChangeKg}kg across ${trend.totalEntries} logs.`);
    console.log(`  ✅ Latest 7-day moving average: ${weightLogs[weightLogs.length - 1].movingAverage7d}kg.`);

    // 4. Test Body Measurements
    console.log('4️⃣ Testing POST /api/weight/measurements (Circumferences & Body Fat %)...');
    const measRes = await callApi('POST', '/api/weight/measurements', {
      authorization: `Bearer ${accessToken}`,
      'content-type': 'application/json',
    }, {
      waistCm: 81.5,
      chestCm: 102.0,
      hipsCm: 96.0,
      armsCm: 37.0,
      thighsCm: 56.5,
      bodyFatPct: 15.8,
    });
    if (measRes.status !== 201 || !measRes.body.data?.id) {
      throw new Error(`Measurement log failed: ${JSON.stringify(measRes.body)}`);
    }

    const getMeasRes = await callApi('GET', '/api/weight/measurements', {
      authorization: `Bearer ${accessToken}`,
    });
    if (getMeasRes.status !== 200 || getMeasRes.body.data?.length === 0) {
      throw new Error('Failed to retrieve body measurements.');
    }
    console.log(`  ✅ Body measurements recorded: Waist=${measRes.body.data.waistCm}cm, Chest=${measRes.body.data.chestCm}cm, Body Fat=${measRes.body.data.bodyFatPct}%.`);

    // 5. Test Progress Photos
    console.log('5️⃣ Testing POST /api/weight/photos (Progress Gallery)...');
    const photoRes = await callApi('POST', '/api/weight/photos', {
      authorization: `Bearer ${accessToken}`,
      'content-type': 'application/json',
    }, {
      photoUrl: 'https://fitsnap.app/uploads/progress_front_sample.jpg',
      pose: 'front',
      notes: 'Morning physique check after 4 weeks of consistent nutrition',
    });
    if (photoRes.status !== 201 || !photoRes.body.data?.id) {
      throw new Error(`Photo save failed: ${JSON.stringify(photoRes.body)}`);
    }

    const getPhotosRes = await callApi('GET', '/api/weight/photos', {
      authorization: `Bearer ${accessToken}`,
    });
    if (getPhotosRes.status !== 200 || getPhotosRes.body.data?.length === 0) {
      throw new Error('Failed to retrieve progress photos.');
    }
    console.log(`  ✅ Progress photo recorded: pose="${getPhotosRes.body.data[0].pose}".`);

    // 6. Test GET /api/dashboard/today (Unified Dashboard Aggregator)
    console.log('6️⃣ Testing GET /api/dashboard/today (Net Calorie balance & rings)...');
    const dashRes = await callApi('GET', '/api/dashboard/today', {
      authorization: `Bearer ${accessToken}`,
    });
    if (dashRes.status !== 200 || !dashRes.body.data?.calories) {
      throw new Error(`Dashboard today failed: ${JSON.stringify(dashRes.body)}`);
    }
    const { calories, macros, streakDays } = dashRes.body.data;
    console.log(`  ✅ Dashboard data: Eaten=${calories.eaten} kcal, Burned=${calories.burned} kcal, Net=${calories.net} kcal.`);
    console.log(`  ✅ Macro targets: Protein=${macros.protein.current}/${macros.protein.goal}g, Carbs=${macros.carbs.current}/${macros.carbs.goal}g, Fat=${macros.fat.current}/${macros.fat.goal}g.`);
    console.log(`  ✅ Logging streak: ${streakDays} days.`);

    // 7. Test GET /api/dashboard/weekly (7-Day Caloric Balance for WeeklyBars3D)
    console.log('7️⃣ Testing GET /api/dashboard/weekly (7-Day Bar Chart Data)...');
    const weeklyRes = await callApi('GET', '/api/dashboard/weekly', {
      authorization: `Bearer ${accessToken}`,
    });
    if (weeklyRes.status !== 200 || !Array.isArray(weeklyRes.body.data) || weeklyRes.body.data.length !== 7) {
      throw new Error(`Weekly bars data failed: ${JSON.stringify(weeklyRes.body)}`);
    }
    console.log(`  ✅ 7-day data ready for WeeklyBars3D (${weeklyRes.body.data.map((d: any) => `${d.day}: ${d.calories}kcal`).join(', ')}).`);

    // 8. Test AI Daily Coaching Insight
    console.log('8️⃣ Testing GET /api/insights (Daily AI Coaching Insight)...');
    const insightRes = await callApi('GET', '/api/insights', {
      authorization: `Bearer ${accessToken}`,
    });
    if (insightRes.status !== 200 || !insightRes.body.data?.insight) {
      throw new Error(`Insight failed: ${JSON.stringify(insightRes.body)}`);
    }
    console.log(`  ✅ Daily AI Insight: "${insightRes.body.data.insight.slice(0, 75)}..."`);
    console.log(`  ✅ Suggested meal: "${insightRes.body.data.suggestion.slice(0, 75)}..."`);

    // 9. Test Conversational "Ask FitSnap" AI Assistant
    console.log('9️⃣ Testing POST /api/insights/chat ("Ask FitSnap" Coach Assistant)...');
    const chatRes = await callApi('POST', '/api/insights/chat', {
      authorization: `Bearer ${accessToken}`,
      'content-type': 'application/json',
    }, {
      message: 'What should I eat for dinner to hit my protein goal?',
    });
    if (chatRes.status !== 200 || !chatRes.body.data?.reply) {
      throw new Error(`Chat failed: ${JSON.stringify(chatRes.body)}`);
    }
    console.log(`  ✅ Coach replied: "${chatRes.body.data.reply.slice(0, 90)}..."`);
    if (chatRes.body.data.suggestions?.length > 0) {
      console.log(`  ✅ Suggested dish: "${chatRes.body.data.suggestions[0].dish}" (${chatRes.body.data.suggestions[0].calories} kcal).`);
    }

    // 10. Cleanup test account
    console.log('🔟 Cleaning up test account...');
    await prisma.user.delete({ where: { id: userId } });
    console.log('  ✅ Test account and all metrics deleted.');

    console.log('\n🎉 ALL PHASE 7 VERIFICATION CHECKS PASSED!\n');
  } catch (err: any) {
    console.error('\n❌ Phase 7 Verification failed:', err.message);
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
}

runTests();
