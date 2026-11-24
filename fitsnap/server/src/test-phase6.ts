/**
 * FitSnap - Phase 6 Automated Verification Suite
 * Tests Hydration Tracking, Water Undo, Exercise Library, MET Calories, Workout Logging, PR Tracking, and Routines.
 */

import express from 'express';
import { Readable } from 'node:stream';
import { EventEmitter } from 'events';
import authRoutes from './routes/auth.js';
import waterRoutes from './routes/water.js';
import workoutRoutes from './routes/workout.js';
import prisma from './lib/prisma.js';

const app = express();
app.use(express.json());
app.use('/api/auth', authRoutes);
app.use('/api/water', waterRoutes);
app.use('/api/workouts', workoutRoutes);

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
  console.log('🧪 Starting Phase 6 Water, Exercise & Activity Verification...\n');

  const testEmail = `test_phase6_${Date.now()}@example.com`;
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

    // 2. Test Water Quick Add (+250ml & +500ml)
    console.log('2️⃣ Testing POST /api/water (Quick Add 250ml & 500ml)...');
    const w1 = await callApi('POST', '/api/water', {
      authorization: `Bearer ${accessToken}`,
      'content-type': 'application/json',
    }, { amountMl: 250, source: 'quick' });
    if (w1.status !== 201) throw new Error('Failed to log 250ml water');

    const w2 = await callApi('POST', '/api/water', {
      authorization: `Bearer ${accessToken}`,
      'content-type': 'application/json',
    }, { amountMl: 500, source: 'bottle' });
    if (w2.status !== 201) throw new Error('Failed to log 500ml water');
    console.log('  ✅ Logged 250ml and 500ml water entries.');

    // 3. Test Water Retrieval
    console.log('3️⃣ Testing GET /api/water (Hydration summary)...');
    const waterGet = await callApi('GET', '/api/water', {
      authorization: `Bearer ${accessToken}`,
    });
    if (waterGet.status !== 200 || waterGet.body.data?.totalMl !== 750) {
      throw new Error(`Expected totalMl 750, got: ${waterGet.body.data?.totalMl}`);
    }
    console.log(`  ✅ Daily water total verified: ${waterGet.body.data.totalMl} ml across ${waterGet.body.data.logs.length} entries.`);

    // 4. Test Undo Last Water Glass
    console.log('4️⃣ Testing DELETE /api/water/latest (Undo last entry)...');
    const undoRes = await callApi('DELETE', '/api/water/latest', {
      authorization: `Bearer ${accessToken}`,
    });
    if (undoRes.status !== 200 || undoRes.body.amountMl !== 500) {
      throw new Error(`Undo failed: ${JSON.stringify(undoRes.body)}`);
    }

    const waterCheck = await callApi('GET', '/api/water', {
      authorization: `Bearer ${accessToken}`,
    });
    if (waterCheck.body.data?.totalMl !== 250) {
      throw new Error(`Expected 250ml remaining after undo, got: ${waterCheck.body.data?.totalMl}`);
    }
    console.log('  ✅ Successfully removed latest 500ml entry (remaining: 250ml).');

    // 5. Test Exercise Library Retrieval
    console.log('5️⃣ Testing GET /api/workouts/exercises (40+ Seeded Movements)...');
    const exRes = await callApi('GET', '/api/workouts/exercises', {
      authorization: `Bearer ${accessToken}`,
    });
    if (exRes.status !== 200 || !Array.isArray(exRes.body.data) || exRes.body.data.length < 30) {
      throw new Error(`Expected 30+ exercises, got: ${exRes.body.data?.length}`);
    }
    const benchPress = exRes.body.data.find((e: any) => e.name === 'Barbell Bench Press');
    console.log(`  ✅ Loaded ${exRes.body.data.length} exercises. Found "${benchPress?.name}" (Category: ${benchPress?.category}, MET: ${benchPress?.metValue}).`);

    // 6. Test Logging a Workout with MET-calculated Calories & PRs
    console.log('6️⃣ Testing POST /api/workouts (Strength session with sets/reps/weight)...');
    const squatEx = exRes.body.data.find((e: any) => e.name === 'Barbell Squat') || exRes.body.data[0];
    const benchEx = exRes.body.data.find((e: any) => e.name === 'Barbell Bench Press') || exRes.body.data[1];

    const workoutRes = await callApi('POST', '/api/workouts', {
      authorization: `Bearer ${accessToken}`,
      'content-type': 'application/json',
    }, {
      type: 'strength',
      name: 'Push & Squat Heavy Session',
      durationMin: 50,
      exercises: [
        {
          exerciseId: squatEx.id,
          sets: 4,
          reps: 8,
          weightKg: 100,
        },
        {
          exerciseId: benchEx.id,
          sets: 3,
          reps: 10,
          weightKg: 85,
        },
      ],
    });
    if (workoutRes.status !== 201 || !workoutRes.body.data?.id) {
      throw new Error(`Workout logging failed: ${JSON.stringify(workoutRes.body)}`);
    }
    const loggedWorkout = workoutRes.body.data;
    console.log(`  ✅ Workout logged: "${loggedWorkout.name}" (Burned: ${loggedWorkout.caloriesBurned} kcal, Duration: ${loggedWorkout.durationMin} mins).`);

    // 7. Test Workout History and Personal Records
    console.log('7️⃣ Testing GET /api/workouts/history (PR calculations)...');
    const historyRes = await callApi('GET', '/api/workouts/history', {
      authorization: `Bearer ${accessToken}`,
    });
    if (historyRes.status !== 200 || !historyRes.body.data?.personalRecords) {
      throw new Error(`History fetch failed: ${JSON.stringify(historyRes.body)}`);
    }
    const prs = historyRes.body.data.personalRecords;
    console.log(`  ✅ Personal Records calculated: ${prs.map((p: any) => `${p.exerciseName}: ${p.weightKg}kg`).join(', ')}.`);

    // 8. Test Prebuilt Training Programs (PPL, Full-Body, Cardio)
    console.log('8️⃣ Testing GET /api/workouts/programs (Prebuilt routines)...');
    const progRes = await callApi('GET', '/api/workouts/programs', {
      authorization: `Bearer ${accessToken}`,
    });
    if (progRes.status !== 200 || !progRes.body.data?.prebuilt || progRes.body.data.prebuilt.length < 3) {
      throw new Error(`Prebuilt programs missing: ${JSON.stringify(progRes.body)}`);
    }
    const programs = progRes.body.data.prebuilt;
    console.log(`  ✅ Found ${programs.length} prebuilt routines: ${programs.map((p: any) => p.name).join(', ')}.`);

    // 9. Cleanup test account
    console.log('9️⃣ Cleaning up test account...');
    await prisma.user.delete({ where: { id: userId } });
    console.log('  ✅ Test account and workout records deleted.');

    console.log('\n🎉 ALL PHASE 6 VERIFICATION CHECKS PASSED!\n');
  } catch (err: any) {
    console.error('\n❌ Phase 6 Verification failed:', err.message);
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
}

runTests();
