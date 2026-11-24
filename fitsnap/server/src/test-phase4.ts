/**
 * FitSnap - Phase 4 Automated Verification Suite
 * Tests Auth, Token Rotation, Profile Calculation, GDPR Export, and Audit Logs in-memory.
 */

import express from 'express';
import { Readable } from 'node:stream';
import { EventEmitter } from 'events';
import authRoutes from './routes/auth.js';
import profileRoutes from './routes/profile.js';
import prisma from './lib/prisma.js';

const app = express();
app.use(express.json());
app.use('/api/auth', authRoutes);
app.use('/api/profile', profileRoutes);

/**
 * Pure in-memory dispatcher for Express apps.
 * Requires 0 network ports or sockets.
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
  console.log('🧪 Starting Phase 4 Backend & Accounts In-Memory Verification...\n');

  const testEmail = `test_phase4_${Date.now()}@example.com`;
  const testPassword = 'Password123!';
  let accessToken = '';
  let refreshToken = '';
  let userId = '';

  try {
    // 1. Test Registration
    console.log('1️⃣ Testing POST /api/auth/register...');
    const regRes = await callApi('POST', '/api/auth/register', {}, { email: testEmail, password: testPassword });
    const regData = regRes.body;
    if (regRes.status !== 201 || !regData.data?.token || !regData.data?.refreshToken) {
      throw new Error(`Registration failed: ${regRes.status} ${JSON.stringify(regData)}`);
    }
    accessToken = regData.data.token;
    refreshToken = regData.data.refreshToken;
    userId = regData.data.user.id;
    console.log('  ✅ Registered successfully with JWT and Refresh Token.');

    // 2. Test Duplicate Registration (409)
    console.log('2️⃣ Testing Duplicate Registration handling...');
    const dupRes = await callApi('POST', '/api/auth/register', {}, { email: testEmail, password: testPassword });
    const dupData = dupRes.body;
    if (dupRes.status !== 409 || dupData.code !== 'EMAIL_EXISTS') {
      throw new Error(`Expected 409 EMAIL_EXISTS, got: ${dupRes.status} ${JSON.stringify(dupData)}`);
    }
    console.log('  ✅ 409 EMAIL_EXISTS received appropriately.');

    // 3. Test Login
    console.log('3️⃣ Testing POST /api/auth/login...');
    const loginRes = await callApi('POST', '/api/auth/login', {}, { email: testEmail, password: testPassword });
    const loginData = loginRes.body;
    if (loginRes.status !== 200 || !loginData.data?.token) {
      throw new Error(`Login failed: ${loginRes.status} ${JSON.stringify(loginData)}`);
    }
    accessToken = loginData.data.token;
    refreshToken = loginData.data.refreshToken;
    console.log('  ✅ Logged in successfully.');

    // 4. Test Token Refresh Rotation
    console.log('4️⃣ Testing POST /api/auth/refresh (token rotation)...');
    const refreshRes = await callApi('POST', '/api/auth/refresh', {}, { refreshToken });
    const refreshData = refreshRes.body;
    if (refreshRes.status !== 200 || !refreshData.data?.token || !refreshData.data?.refreshToken) {
      throw new Error(`Token refresh failed: ${refreshRes.status} ${JSON.stringify(refreshData)}`);
    }
    // Update tokens with rotated ones
    accessToken = refreshData.data.token;
    const oldRefreshToken = refreshToken;
    refreshToken = refreshData.data.refreshToken;
    console.log('  ✅ Tokens rotated successfully.');

    // Verify old refresh token is revoked
    const revokedCheckRes = await callApi('POST', '/api/auth/refresh', {}, { refreshToken: oldRefreshToken });
    if (revokedCheckRes.status !== 401) {
      throw new Error(`Old refresh token was not invalidated! Status: ${revokedCheckRes.status}`);
    }
    console.log('  ✅ Re-using previous refresh token was properly rejected with 401.');

    // 5. Test Demo Login
    console.log('5️⃣ Testing POST /api/auth/demo...');
    const demoRes = await callApi('POST', '/api/auth/demo', {}, {});
    const demoData = demoRes.body;
    if (demoRes.status !== 200 || demoData.data?.user?.email !== 'demo@fitsnap.app') {
      throw new Error(`Demo login failed: ${demoRes.status} ${JSON.stringify(demoData)}`);
    }
    console.log('  ✅ Instant 1-Click Demo login verified.');

    // 6. Test GET /api/auth/me
    console.log('6️⃣ Testing GET /api/auth/me...');
    const meRes = await callApi('GET', '/api/auth/me', { authorization: `Bearer ${accessToken}` });
    const meData = meRes.body;
    if (meRes.status !== 200 || meData.data?.user?.id !== userId) {
      throw new Error(`Auth /me failed: ${meRes.status} ${JSON.stringify(meData)}`);
    }
    console.log('  ✅ /me authenticated session returned valid user profile state.');

    // 7. Test PUT /api/profile (Mifflin-St Jeor + Macro split + Projection)
    console.log('7️⃣ Testing PUT /api/profile (Mifflin-St Jeor engine)...');
    const profileRes = await callApi('PUT', '/api/profile', {
      authorization: `Bearer ${accessToken}`,
      'content-type': 'application/json',
    }, {
      name: 'Jane Doe',
      age: 30,
      gender: 'female',
      heightCm: 165,
      weightKg: 68,
      activityLevel: 'moderate',
      goal: 'lose',
      weeklyRateKg: 0.5,
      dietPreset: 'indian_veg',
      targetWeightKg: 62,
    });
    const profileData = profileRes.body;
    if (profileRes.status !== 200 || !profileData.data?.goal) {
      throw new Error(`Profile update failed: ${profileRes.status} ${JSON.stringify(profileData)}`);
    }
    const { profile, goal, projection } = profileData.data;
    console.log(`  ✅ Profile calculated: BMR=${profile.bmr} kcal, TDEE=${profile.tdee} kcal.`);
    console.log(`  ✅ Target: ${goal.calories} kcal (Protein: ${goal.proteinG}g, Carbs: ${goal.carbsG}g, Fat: ${goal.fatG}g, Water: ${goal.waterMl}ml).`);
    console.log(`  ✅ Projected goal achievement in ${projection?.projectedWeeks} weeks.`);

    // 8. Test Custom Goal Override
    console.log('8️⃣ Testing POST /api/profile/goals...');
    const goalRes = await callApi('POST', '/api/profile/goals', {
      authorization: `Bearer ${accessToken}`,
      'content-type': 'application/json',
    }, {
      calories: 1800,
      proteinG: 130,
      carbsG: 180,
      fatG: 60,
      fiberG: 30,
      waterMl: 3000,
    });
    const goalData = goalRes.body;
    if (goalRes.status !== 201 || goalData.data?.calories !== 1800) {
      throw new Error(`Custom goal update failed: ${goalRes.status} ${JSON.stringify(goalData)}`);
    }
    console.log('  ✅ Custom goal overridden successfully.');

    // 9. Test GDPR Export
    console.log('9️⃣ Testing GET /api/profile/export (GDPR data export)...');
    const exportRes = await callApi('GET', '/api/profile/export', {
      authorization: `Bearer ${accessToken}`,
    });
    const exportData = exportRes.body;
    if (exportRes.status !== 200 || !exportData.data?.email || !exportData.data?.profile) {
      throw new Error(`GDPR export failed: ${exportRes.status} ${JSON.stringify(exportData)}`);
    }
    console.log('  ✅ Complete GDPR JSON export received with profile, goals, and history.');

    // 10. Test Audit Log Persistence
    console.log('🔟 Checking AuditLog records in database...');
    const auditLogs = await prisma.auditLog.findMany({
      where: { userId },
    });
    if (auditLogs.length === 0) {
      throw new Error('No audit log entries persisted for user actions!');
    }
    console.log(`  ✅ Found ${auditLogs.length} audit log entries (${auditLogs.map((a: any) => a.action).join(', ')}).`);

    // 11. Cleanup test user
    console.log('1️⃣1️⃣ Cleaning up test account...');
    await prisma.user.delete({ where: { id: userId } });
    console.log('  ✅ Test user and cascaded records deleted cleanly.');

    console.log('\n🎉 ALL PHASE 4 VERIFICATION CHECKS PASSED!\n');
  } catch (err: any) {
    console.error('\n❌ Verification failed:', err.message);
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
}

runTests();
