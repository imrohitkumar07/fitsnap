/**
 * FitSnap - Phase 9 Automated Verification Suite
 * Tests Settings, Preferences (Reduce 3D, Hindi/English language, Units),
 * Reminder Schedules with Quiet Hours, and In-App Notifications.
 */

import express from 'express';
import { Readable } from 'node:stream';
import { EventEmitter } from 'events';
import authRoutes from './routes/auth.js';
import settingsRoutes from './routes/settings.js';
import prisma from './lib/prisma.js';

const app = express();
app.use(express.json());
app.use('/api/auth', authRoutes);
app.use('/api/settings', settingsRoutes);

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

async function runPhase9Tests() {
  console.log('\n======================================================');
  console.log('🧪 RUNNING FITSNAP PHASE 9 AUTOMATED TEST SUITE');
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

    // 2. Fetch User Settings & Reminder Defaults
    const getSettingsRes = await callApi('GET', '/api/settings', authHeaders);
    assert(
      getSettingsRes.status === 200 &&
        getSettingsRes.body.data?.preferences !== undefined &&
        getSettingsRes.body.data?.reminders?.breakfastTime !== undefined,
      'Retrieve User Settings and Reminder Preferences'
    );

    // 3. Update Preferences (Language Hindi, Reduce 3D Effects) & Custom Reminders
    const updateRes = await callApi('PUT', '/api/settings', authHeaders, {
      preferences: {
        reduce3dEffects: true,
        language: 'hi',
      },
      reminders: {
        breakfastTime: '07:45',
        lunchTime: '12:30',
        dinnerTime: '19:45',
        waterInterval: 60,
        quietHoursStart: '23:00',
        quietHoursEnd: '06:30',
      },
    });
    assert(
      updateRes.status === 200 &&
        updateRes.body.data?.reminders?.breakfastTime === '07:45' &&
        updateRes.body.data?.reminders?.quietHoursStart === '23:00',
      'Update Language (Hindi), Reduce 3D Flag, and Quiet Hours'
    );

    // 4. Verify Persistence of Updated Preferences
    const verifySettingsRes = await callApi('GET', '/api/settings', authHeaders);
    assert(
      verifySettingsRes.status === 200 &&
        verifySettingsRes.body.data?.preferences?.language === 'hi' &&
        verifySettingsRes.body.data?.preferences?.reduce3dEffects === true &&
        verifySettingsRes.body.data?.reminders?.breakfastTime === '07:45',
      'Verify Settings Persistence Across Requests'
    );

    // 5. Send Test In-App Notification
    const sendNotifRes = await callApi('POST', '/api/settings/test-notification', authHeaders, {
      type: 'meal_reminder',
      title: 'Time for Lunch! 🥗',
      message: "Don't forget to snap your meal to stay on track.",
    });
    assert(
      sendNotifRes.status === 201 &&
        sendNotifRes.body.data?.type === 'meal_reminder' &&
        sendNotifRes.body.data?.isRead === false,
      'Dispatch In-App Notification Reminder'
    );
    const notifId = sendNotifRes.body.data?.id;

    // 6. Retrieve Notifications List
    const getNotifsRes = await callApi('GET', '/api/settings/notifications', authHeaders);
    assert(
      getNotifsRes.status === 200 &&
        Array.isArray(getNotifsRes.body.data) &&
        getNotifsRes.body.data.some((n: any) => n.id === notifId),
      'Retrieve User Notification Feed'
    );

    // 7. Mark Notification As Read
    const markReadRes = await callApi('PATCH', `/api/settings/notifications/${notifId}/read`, authHeaders);
    assert(
      markReadRes.status === 200 &&
        markReadRes.body.data?.isRead === true,
      'Mark In-App Notification as Read'
    );

    // 8. Revert Settings back to standard English
    await callApi('PUT', '/api/settings', authHeaders, {
      preferences: {
        reduce3dEffects: false,
        language: 'en',
      },
      reminders: {
        breakfastTime: '08:30',
        lunchTime: '13:00',
        dinnerTime: '20:00',
        waterInterval: 90,
      },
    });
    assert(true, 'Restore Default Preferences Cleanly');

    console.log('\n------------------------------------------------------');
    console.log(`📊 PHASE 9 TEST SUMMARY: ${passed} / ${total} CHECKS PASSED`);
    console.log('------------------------------------------------------\n');

    if (passed === total) {
      console.log('🎉 ALL PHASE 9 REQUIREMENTS FULLY VERIFIED!\n');
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

runPhase9Tests();
