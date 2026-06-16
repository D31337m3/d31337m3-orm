/**
 * Auth Controller
 * Register, login, email verification, password reset
 */

import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';
import { body, validationResult } from 'express-validator';
import { v4 as uuidv4 } from 'uuid';
import { logger } from '../services/logger.service';

const router = Router();
const prisma = new PrismaClient();
const JWT_SECRET = process.env.JWT_SECRET!;
const JWT_EXPIRES = process.env.JWT_EXPIRES || '7d';

// ─── Middleware: validate JWT ─────────────────────────────────────────────────
export function requireAuth(req: any, res: Response, next: Function) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  try {
    const payload = jwt.verify(header.slice(7), JWT_SECRET) as any;
    req.userId = payload.userId;
    req.userEmail = payload.email;
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

// ─── POST /api/auth/register ──────────────────────────────────────────────────
router.post('/register',
  body('email').isEmail().normalizeEmail(),
  body('password').isLength({ min: 8 }),
  body('fullName').optional().trim().isLength({ max: 100 }),
  async (req: Request, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const { email, password, fullName } = req.body;

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) return res.status(409).json({ error: 'Email already registered' });

    const passwordHash = await bcrypt.hash(password, 12);
    const verificationToken = uuidv4();

    const user = await prisma.user.create({
      data: { email, passwordHash, fullName, verificationToken },
    });

    // TODO: send verification email
    logger.info(`New user registered: ${email}`);

    const token = jwt.sign({ userId: user.id, email: user.email }, JWT_SECRET, {
      expiresIn: JWT_EXPIRES,
    });

    res.status(201).json({
      token,
      user: { id: user.id, email: user.email, fullName: user.fullName, isVerified: user.isVerified },
    });
  }
);

// ─── POST /api/auth/login ─────────────────────────────────────────────────────
router.post('/login',
  body('email').isEmail().normalizeEmail(),
  body('password').notEmpty(),
  async (req: Request, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const { email, password } = req.body;
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user?.passwordHash) return res.status(401).json({ error: 'Invalid credentials' });

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) return res.status(401).json({ error: 'Invalid credentials' });

    const token = jwt.sign({ userId: user.id, email: user.email }, JWT_SECRET, {
      expiresIn: JWT_EXPIRES,
    });

    res.json({
      token,
      user: { id: user.id, email: user.email, fullName: user.fullName, isVerified: user.isVerified },
    });
  }
);

// ─── GET /api/auth/me ─────────────────────────────────────────────────────────
router.get('/me', requireAuth, async (req: any, res: Response) => {
  const user = await prisma.user.findUnique({
    where: { id: req.userId },
    include: {
      subscriptions: { orderBy: { createdAt: 'desc' }, take: 1 },
    },
  });
  if (!user) return res.status(404).json({ error: 'User not found' });

  res.json({
    id: user.id,
    email: user.email,
    fullName: user.fullName,
    avatarUrl: user.avatarUrl,
    isVerified: user.isVerified,
    subscription: user.subscriptions[0] || null,
  });
});

// ─── POST /api/auth/verify-email ──────────────────────────────────────────────
router.post('/verify-email', async (req: Request, res: Response) => {
  const { token } = req.body;
  const user = await prisma.user.findFirst({ where: { verificationToken: token } });
  if (!user) return res.status(400).json({ error: 'Invalid verification token' });

  await prisma.user.update({
    where: { id: user.id },
    data: { isVerified: true, verificationToken: null },
  });

  res.json({ message: 'Email verified successfully' });
});

// ─── POST /api/auth/forgot-password ──────────────────────────────────────────
router.post('/forgot-password',
  body('email').isEmail().normalizeEmail(),
  async (req: Request, res: Response) => {
    const { email } = req.body;
    const user = await prisma.user.findUnique({ where: { email } });

    // Always return 200 to prevent email enumeration
    if (user) {
      const resetToken = uuidv4();
      const resetTokenExpiry = new Date(Date.now() + 3600000); // 1 hour
      await prisma.user.update({
        where: { id: user.id },
        data: { resetToken, resetTokenExpiry },
      });
      // TODO: send reset email
    }

    res.json({ message: 'If that email exists, a reset link has been sent.' });
  }
);

// ─── POST /api/auth/reset-password ───────────────────────────────────────────
router.post('/reset-password',
  body('token').notEmpty(),
  body('password').isLength({ min: 8 }),
  async (req: Request, res: Response) => {
    const { token, password } = req.body;
    const user = await prisma.user.findFirst({
      where: {
        resetToken: token,
        resetTokenExpiry: { gt: new Date() },
      },
    });

    if (!user) return res.status(400).json({ error: 'Invalid or expired reset token' });

    const passwordHash = await bcrypt.hash(password, 12);
    await prisma.user.update({
      where: { id: user.id },
      data: { passwordHash, resetToken: null, resetTokenExpiry: null },
    });

    res.json({ message: 'Password reset successfully' });
  }
);

export { router as authRouter };
