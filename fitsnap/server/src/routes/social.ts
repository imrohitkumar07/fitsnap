/**
 * FitSnap Server - Social, Community & Moderation Routes
 * Handles community boards (weight_loss, recipes, indian_diet, workouts),
 * comments, likes, friendship streaks, challenges, and admin post moderation.
 */

import { Router, Response } from 'express';
import prisma from '../lib/prisma.js';
import { authMiddleware, AuthRequest } from '../middleware/auth.js';

const router = Router();

router.use(authMiddleware);

// ─── Community Posts & Feed ──────────────────────────────────────────────────

// GET /api/social/posts - Fetch posts (filtered by board)
router.get('/posts', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.userId;
    const board = req.query.board as string | undefined;

    const where: any = { isHidden: false };
    if (board && board !== 'all') {
      where.board = board;
    }

    const posts = await prisma.post.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 50,
      include: {
        user: {
          select: {
            id: true,
            email: true,
            profile: { select: { name: true } },
          },
        },
        likes: {
          select: { userId: true },
        },
        comments: {
          orderBy: { createdAt: 'asc' },
          include: {
            user: {
              select: {
                id: true,
                profile: { select: { name: true } },
              },
            },
          },
        },
      },
    });

    const formattedPosts = posts.map((p) => {
      const isLikedByMe = p.likes.some((l) => l.userId === userId);
      return {
        id: p.id,
        board: p.board,
        content: p.content,
        photoUrl: p.photoUrl,
        createdAt: p.createdAt,
        author: {
          id: p.user.id,
          name: p.user.profile?.name || p.user.email.split('@')[0],
        },
        likeCount: p.likes.length,
        isLikedByMe,
        commentCount: p.comments.length,
        comments: p.comments.map((c) => ({
          id: c.id,
          content: c.content,
          createdAt: c.createdAt,
          authorName: c.user.profile?.name || 'Athlete',
          authorId: c.user.id,
        })),
      };
    });

    return res.json({
      success: true,
      data: formattedPosts,
    });
  } catch (error: any) {
    console.error('Error fetching social posts:', error);
    return res.status(500).json({ success: false, error: 'Failed to fetch community feed.' });
  }
});

// POST /api/social/posts - Create new post
router.post('/posts', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.userId;
    const { board = 'weight_loss', content, photoUrl } = req.body;

    if (!content || !content.trim()) {
      return res.status(400).json({ success: false, error: 'Post content cannot be empty.' });
    }

    const validBoards = ['weight_loss', 'recipes', 'indian_diet', 'workouts', 'general'];
    const assignedBoard = validBoards.includes(board) ? board : 'general';

    const post = await prisma.post.create({
      data: {
        userId,
        board: assignedBoard,
        content: content.trim(),
        photoUrl: photoUrl || null,
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            profile: { select: { name: true } },
          },
        },
      },
    });

    return res.status(201).json({
      success: true,
      data: {
        id: post.id,
        board: post.board,
        content: post.content,
        photoUrl: post.photoUrl,
        createdAt: post.createdAt,
        author: {
          id: post.user.id,
          name: post.user.profile?.name || post.user.email.split('@')[0],
        },
        likeCount: 0,
        isLikedByMe: false,
        commentCount: 0,
        comments: [],
      },
    });
  } catch (error: any) {
    console.error('Error creating post:', error);
    return res.status(500).json({ success: false, error: 'Failed to publish post.' });
  }
});

// POST /api/social/posts/:id/comments - Add comment
router.post('/posts/:id/comments', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.userId;
    const postId = req.params.id as string;
    const { content } = req.body;

    if (!content || !content.trim()) {
      return res.status(400).json({ success: false, error: 'Comment content cannot be empty.' });
    }

    const comment = await prisma.comment.create({
      data: {
        postId,
        userId,
        content: content.trim(),
      },
      include: {
        user: {
          select: {
            id: true,
            profile: { select: { name: true } },
          },
        },
      },
    });

    return res.status(201).json({
      success: true,
      data: {
        id: comment.id,
        content: comment.content,
        createdAt: comment.createdAt,
        authorName: comment.user.profile?.name || 'Athlete',
        authorId: comment.user.id,
      },
    });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: 'Failed to post comment.' });
  }
});

// POST /api/social/posts/:id/like - Toggle like
router.post('/posts/:id/like', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.userId;
    const postId = req.params.id as string;

    const existingLike = await prisma.like.findUnique({
      where: {
        postId_userId: { postId, userId },
      },
    });

    let liked = false;
    if (existingLike) {
      await prisma.like.delete({
        where: { id: existingLike.id },
      });
      liked = false;
    } else {
      await prisma.like.create({
        data: { postId, userId },
      });
      liked = true;
    }

    const totalLikes = await prisma.like.count({ where: { postId } });

    return res.json({
      success: true,
      data: {
        liked,
        likeCount: totalLikes,
      },
    });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: 'Failed to update like.' });
  }
});

// ─── Friends & Activity ──────────────────────────────────────────────────────

// GET /api/social/friends - List user friends
router.get('/friends', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.userId;

    const friends = await prisma.friend.findMany({
      where: {
        OR: [
          { userId, status: 'accepted' },
          { friendId: userId, status: 'accepted' },
        ],
      },
      include: {
        user: { select: { id: true, email: true, profile: { select: { name: true } } } },
        friend: { select: { id: true, email: true, profile: { select: { name: true } } } },
      },
    });

    const friendProfiles = friends.map((f) => {
      const isInitiator = f.userId === userId;
      const otherUser = isInitiator ? f.friend : f.user;
      return {
        friendshipId: f.id,
        id: otherUser.id,
        name: otherUser.profile?.name || otherUser.email.split('@')[0],
        email: otherUser.email,
        status: f.status,
      };
    });

    return res.json({ success: true, data: friendProfiles });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: 'Failed to load friends.' });
  }
});

// POST /api/social/friends/request - Send friend request by email
router.post('/friends/request', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.userId;
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ success: false, error: 'Friend email is required.' });
    }

    const targetUser = await prisma.user.findUnique({
      where: { email: email.toLowerCase().trim() },
    });

    if (!targetUser) {
      return res.status(404).json({ success: false, error: 'User with this email not found.' });
    }

    if (targetUser.id === userId) {
      return res.status(400).json({ success: false, error: 'You cannot add yourself as friend.' });
    }

    const existing = await prisma.friend.findFirst({
      where: {
        OR: [
          { userId, friendId: targetUser.id },
          { userId: targetUser.id, friendId: userId },
        ],
      },
    });

    if (existing) {
      return res.status(400).json({ success: false, error: `Friendship already exists (Status: ${existing.status}).` });
    }

    const friendship = await prisma.friend.create({
      data: {
        userId,
        friendId: targetUser.id,
        status: 'pending',
      },
    });

    return res.status(201).json({ success: true, data: friendship });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: 'Failed to send friend request.' });
  }
});

// POST /api/social/friends/:id/accept - Accept request
router.post('/friends/:id/accept', async (req: AuthRequest, res: Response) => {
  try {
    const friendshipId = req.params.id as string;
    const updated = await prisma.friend.update({
      where: { id: friendshipId },
      data: { status: 'accepted' },
    });

    return res.json({ success: true, data: updated });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: 'Failed to accept friend request.' });
  }
});

// ─── Challenges Leaderboard ──────────────────────────────────────────────────

// GET /api/social/challenges - List active challenges
router.get('/challenges', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.userId;

    let challenges = await prisma.challenge.findMany({
      include: {
        members: {
          include: {
            user: { select: { id: true, profile: { select: { name: true } }, email: true } },
          },
          orderBy: { progress: 'desc' },
          take: 10,
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Auto-seed prebuilt challenges if none exist
    if (challenges.length === 0) {
      const now = new Date();
      const end = new Date(now.getTime() + 14 * 86400000);

      const seeded = await prisma.challenge.create({
        data: {
          title: '7-Day Clean Food Logging Streak',
          description: 'Log all 3 daily meals consistently for 7 straight days to boost metabolic adherence.',
          type: 'logging_streak',
          target: 7,
          startDate: now,
          endDate: end,
          members: {
            create: {
              userId,
              progress: 4,
            },
          },
        },
        include: {
          members: {
            include: {
              user: { select: { id: true, profile: { select: { name: true } }, email: true } },
            },
          },
        },
      });
      challenges = [seeded];
    }

    const formatted = challenges.map((c) => ({
      id: c.id,
      title: c.title,
      description: c.description,
      type: c.type,
      target: c.target,
      memberCount: c.members.length,
      isJoined: c.members.some((m) => m.userId === userId),
      leaderboard: c.members.map((m, idx) => ({
        rank: idx + 1,
        userId: m.userId,
        name: m.user.profile?.name || m.user.email.split('@')[0],
        progress: m.progress,
        hasWon: m.hasWon,
      })),
    }));

    return res.json({ success: true, data: formatted });
  } catch (error: any) {
    console.error('Error fetching challenges:', error);
    return res.status(500).json({ success: false, error: 'Failed to fetch challenges.' });
  }
});

// POST /api/social/challenges/:id/join - Join challenge
router.post('/challenges/:id/join', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.userId;
    const challengeId = req.params.id as string;

    const member = await prisma.challengeMember.upsert({
      where: {
        challengeId_userId: { challengeId, userId },
      },
      update: {},
      create: {
        challengeId,
        userId,
        progress: 0,
      },
    });

    return res.json({ success: true, data: member });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: 'Failed to join challenge.' });
  }
});

// ─── Admin Moderation Pass ───────────────────────────────────────────────────

// PATCH /api/social/admin/posts/:id/hide - Moderate / Hide flagged post
router.patch('/admin/posts/:id/hide', async (req: AuthRequest, res: Response) => {
  try {
    const adminUserId = req.user!.userId;
    const postId = req.params.id as string;
    const { reason = 'Content policy violation' } = req.body;

    const post = await prisma.post.update({
      where: { id: postId },
      data: { isHidden: true },
    });

    // Record audit event
    await prisma.auditLog.create({
      data: {
        userId: adminUserId,
        action: 'ADMIN_HIDE_POST',
        details: JSON.stringify({ postId, reason }),
        ipAddress: req.ip || '127.0.0.1',
      },
    });

    return res.json({
      success: true,
      message: 'Post successfully hidden by administrator.',
      data: post,
    });
  } catch (error: any) {
    console.error('Error in post moderation:', error);
    return res.status(500).json({ success: false, error: 'Failed to hide post.' });
  }
});

// GET /api/social/admin/audit-logs - View moderation log
router.get('/admin/audit-logs', async (_req: AuthRequest, res: Response) => {
  try {
    const logs = await prisma.auditLog.findMany({
      orderBy: { createdAt: 'desc' },
      take: 20,
    });

    return res.json({ success: true, data: logs });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: 'Failed to load audit logs.' });
  }
});

export default router;
