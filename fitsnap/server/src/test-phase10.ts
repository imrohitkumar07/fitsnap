/**
 * FitSnap - Phase 10 Automated Verification Suite
 * Tests Social Feed, Board Filtering, Likes, Comments, Friends, Challenges,
 * and Admin Content Moderation with Audit Logs.
 */

import express from 'express';
import { Readable } from 'node:stream';
import { EventEmitter } from 'events';
import authRoutes from './routes/auth.js';
import socialRoutes from './routes/social.js';
import prisma from './lib/prisma.js';

const app = express();
app.use(express.json());
app.use('/api/auth', authRoutes);
app.use('/api/social', socialRoutes);

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

async function runPhase10Tests() {
  console.log('\n======================================================');
  console.log('🧪 RUNNING FITSNAP PHASE 10 AUTOMATED TEST SUITE');
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

    // 2. Publish New Community Post
    const postRes = await callApi('POST', '/api/social/posts', authHeaders, {
      board: 'weight_loss',
      content: 'Down 3.5 kg this month following the high protein Indian plan! Consistency is key.',
    });
    assert(
      postRes.status === 201 &&
        postRes.body.data?.board === 'weight_loss' &&
        !!postRes.body.data?.id,
      'Create New Community Forum Post'
    );
    const createdPostId = postRes.body.data?.id;

    // 3. Fetch Posts by Board Filter
    const feedRes = await callApi('GET', '/api/social/posts?board=weight_loss', authHeaders);
    assert(
      feedRes.status === 200 &&
        Array.isArray(feedRes.body.data) &&
        feedRes.body.data.some((p: any) => p.id === createdPostId),
      'Retrieve Filtered Board Feed (weight_loss)'
    );

    // 4. Toggle Like on Post
    const likeRes = await callApi('POST', `/api/social/posts/${createdPostId}/like`, authHeaders);
    assert(
      likeRes.status === 200 &&
        likeRes.body.data?.liked === true &&
        likeRes.body.data?.likeCount >= 1,
      'Toggle Like Reaction on Post'
    );

    // 5. Add Comment to Post
    const commentRes = await callApi('POST', `/api/social/posts/${createdPostId}/comments`, authHeaders, {
      content: 'Massive congratulations! What was your staple dinner recipe?',
    });
    assert(
      commentRes.status === 201 &&
        commentRes.body.data?.content.includes('staple dinner'),
      'Publish Comment on Community Post'
    );

    // 6. Verify Comment in Post Feed
    const updatedPostRes = await callApi('GET', '/api/social/posts?board=weight_loss', authHeaders);
    const targetPost = updatedPostRes.body.data?.find((p: any) => p.id === createdPostId);
    assert(
      targetPost &&
        targetPost.commentCount >= 1 &&
        targetPost.comments.length >= 1,
      'Verify Comment Thread Integration'
    );

    // 7. Fetch Community Challenges
    const chalRes = await callApi('GET', '/api/social/challenges', authHeaders);
    assert(
      chalRes.status === 200 &&
        Array.isArray(chalRes.body.data) &&
        chalRes.body.data.length > 0,
      'Retrieve Active Community Challenges'
    );
    const challengeId = chalRes.body.data[0].id;

    // 8. Join Community Challenge
    const joinChalRes = await callApi('POST', `/api/social/challenges/${challengeId}/join`, authHeaders);
    assert(
      joinChalRes.status === 200 &&
        joinChalRes.body.success === true,
      'Join Group Fitness Challenge'
    );

    // 9. Create a second test user to test friend request
    const secondUserEmail = `buddy_${Date.now()}@fitsnap.app`;
    const regRes = await callApi('POST', '/api/auth/register', {}, {
      email: secondUserEmail,
      password: 'password123',
      name: 'Priya Sharma',
    });
    assert(regRes.status === 201, 'Create Second Athlete User for Social Testing');

    // 10. Send Friend Request
    const friendReqRes = await callApi('POST', '/api/social/friends/request', authHeaders, {
      email: secondUserEmail,
    });
    assert(
      friendReqRes.status === 201 &&
        friendReqRes.body.data?.status === 'pending',
      'Send Friend Request to Athlete'
    );
    const friendshipId = friendReqRes.body.data?.id;

    // 11. Accept Friend Request
    const acceptFriendRes = await callApi('POST', `/api/social/friends/${friendshipId}/accept`, authHeaders);
    assert(
      acceptFriendRes.status === 200 &&
        acceptFriendRes.body.data?.status === 'accepted',
      'Accept Friend Connection'
    );

    // 12. Admin Moderation: Hide Inappropriate/Flagged Post
    const hideRes = await callApi('PATCH', `/api/social/admin/posts/${createdPostId}/hide`, authHeaders, {
      reason: 'Spam moderation test',
    });
    assert(
      hideRes.status === 200 &&
        hideRes.body.data?.isHidden === true,
      'Admin Moderation: Hide Flagged Post'
    );

    // 13. Verify Post is Filtered Out of Community Feed
    const afterHideFeedRes = await callApi('GET', '/api/social/posts', authHeaders);
    const isStillPresent = afterHideFeedRes.body.data?.some((p: any) => p.id === createdPostId);
    assert(
      !isStillPresent,
      'Verify Moderated Post Is Hidden from Public Feed'
    );

    // 14. Verify Admin Audit Log Entry
    const auditRes = await callApi('GET', '/api/social/admin/audit-logs', authHeaders);
    const hasAdminHideLog = auditRes.body.data?.some((l: any) => l.action === 'ADMIN_HIDE_POST');
    assert(
      auditRes.status === 200 && hasAdminHideLog,
      'Admin Moderation Audit Trail Record'
    );

    console.log('\n------------------------------------------------------');
    console.log(`📊 PHASE 10 TEST SUMMARY: ${passed} / ${total} CHECKS PASSED`);
    console.log('------------------------------------------------------\n');

    if (passed === total) {
      console.log('🎉 ALL PHASE 10 REQUIREMENTS FULLY VERIFIED!\n');
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

runPhase10Tests();
