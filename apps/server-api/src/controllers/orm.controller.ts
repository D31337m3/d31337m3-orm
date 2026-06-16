/**
 * ORM Controller
 * Endpoints for SERP scanning, opt-out task management,
 * legal document generation, and add-on execution.
 */

import { Router, Response } from 'express';
import { body, param, validationResult } from 'express-validator';
import { PrismaClient, OptOutStatus } from '@prisma/client';
import { requireAuth } from './auth.controller';
import { serpScanQueue, optOutQueue, legalDocQueue } from '../workers/scraper.worker';
import { logger } from '../services/logger.service';

const router = Router();
const prisma = new PrismaClient();

// ─── GET /api/orm/keywords ────────────────────────────────────────────────────
router.get('/keywords', requireAuth, async (req: any, res: Response) => {
  const keywords = await prisma.trackedKeyword.findMany({
    where: { userId: req.userId },
    include: {
      scannedLinks: {
        orderBy: { riskScore: 'desc' },
        take: 5,
      },
    },
  });
  res.json(keywords);
});

// ─── POST /api/orm/keywords ───────────────────────────────────────────────────
router.post('/keywords', requireAuth,
  body('keyword').trim().isLength({ min: 2, max: 200 }),
  body('searchEngine').optional().isIn(['google', 'bing', 'yahoo']),
  body('scanFrequency').optional().isIn(['daily', 'weekly', 'monthly']),
  async (req: any, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    // Check keyword limit per tier
    const sub = await prisma.subscription.findFirst({
      where: { userId: req.userId, status: 'ACTIVE' },
    });
    const keywordLimits: Record<string, number> = {
      PERSONAL_BASIC: 1,
      PERSONAL_PREMIUM: 3,
      BUSINESS_GROWTH: 3,
      BUSINESS_ENTERPRISE: 999,
    };
    const limit = keywordLimits[sub?.tier || 'PERSONAL_BASIC'];
    const existing = await prisma.trackedKeyword.count({ where: { userId: req.userId } });
    if (existing >= limit) {
      return res.status(403).json({ error: `Your plan allows ${limit} tracked keyword(s). Upgrade to add more.` });
    }

    const { keyword, searchEngine = 'google', scanFrequency = 'weekly' } = req.body;

    const kw = await prisma.trackedKeyword.create({
      data: { userId: req.userId, keyword, searchEngine, scanFrequency },
    });

    // Immediately queue a SERP scan
    await serpScanQueue.add('scan', { keywordId: kw.id, userId: req.userId, keyword }, {
      attempts: 3,
      backoff: { type: 'exponential', delay: 5000 },
    });

    res.status(201).json(kw);
  }
);

// ─── DELETE /api/orm/keywords/:id ────────────────────────────────────────────
router.delete('/keywords/:id', requireAuth,
  param('id').notEmpty(),
  async (req: any, res: Response) => {
    await prisma.trackedKeyword.deleteMany({
      where: { id: req.params.id, userId: req.userId },
    });
    res.json({ success: true });
  }
);

// ─── GET /api/orm/scanned-links ───────────────────────────────────────────────
router.get('/scanned-links', requireAuth, async (req: any, res: Response) => {
  const { sentiment, isDataBroker, page = '1' } = req.query;
  const pageSize = 20;
  const skip = (parseInt(page as string) - 1) * pageSize;

  const where: any = { userId: req.userId };
  if (sentiment) where.sentiment = sentiment;
  if (isDataBroker !== undefined) where.isDataBroker = isDataBroker === 'true';

  const [links, total] = await Promise.all([
    prisma.scannedLink.findMany({
      where,
      orderBy: [{ riskScore: 'desc' }, { position: 'asc' }],
      skip,
      take: pageSize,
      include: { optOutTask: true },
    }),
    prisma.scannedLink.count({ where }),
  ]);

  res.json({ links, total, page: parseInt(page as string), pageSize });
});

// ─── POST /api/orm/opt-out ────────────────────────────────────────────────────
router.post('/opt-out', requireAuth,
  body('scannedLinkId').notEmpty(),
  async (req: any, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const { scannedLinkId, isExpedited = false } = req.body;

    const link = await prisma.scannedLink.findFirst({
      where: { id: scannedLinkId, userId: req.userId },
    });
    if (!link) return res.status(404).json({ error: 'Link not found' });
    if (!link.isDataBroker) return res.status(400).json({ error: 'Link is not a data broker' });

    const existing = await prisma.optOutTask.findUnique({
      where: { scannedLinkId },
    });
    if (existing) return res.status(409).json({ error: 'Opt-out task already exists', task: existing });

    const task = await prisma.optOutTask.create({
      data: {
        userId: req.userId,
        scannedLinkId,
        brokerName: link.domain,
        brokerUrl: link.url,
        priority: isExpedited ? 1 : 5,
        isExpedited,
      },
    });

    // Enqueue the Playwright worker
    const job = await optOutQueue.add('opt-out', { taskId: task.id, url: link.url, domain: link.domain }, {
      priority: isExpedited ? 1 : 5,
      attempts: 5,
      backoff: { type: 'exponential', delay: 10000 },
    });

    await prisma.optOutTask.update({
      where: { id: task.id },
      data: { workerJobId: job.id?.toString() },
    });

    res.status(201).json(task);
  }
);

// ─── GET /api/orm/opt-out-tasks ───────────────────────────────────────────────
router.get('/opt-out-tasks', requireAuth, async (req: any, res: Response) => {
  const tasks = await prisma.optOutTask.findMany({
    where: { userId: req.userId },
    orderBy: [{ priority: 'asc' }, { createdAt: 'desc' }],
    include: { scannedLink: { select: { url: true, title: true } } },
  });
  res.json(tasks);
});

// ─── POST /api/orm/legal-doc ──────────────────────────────────────────────────
router.post('/legal-doc', requireAuth,
  body('docType').isIn(['CCPA_DELETION', 'GDPR_ERASURE', 'FCRA_DISPUTE']),
  body('recipientName').notEmpty().trim(),
  body('recipientEmail').optional().isEmail(),
  body('recipientFax').optional().trim(),
  async (req: any, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const { docType, recipientName, recipientEmail, recipientFax } = req.body;

    const user = await prisma.user.findUnique({ where: { id: req.userId } });
    if (!user) return res.status(404).json({ error: 'User not found' });

    const subjects: Record<string, string> = {
      CCPA_DELETION: `CCPA Data Deletion Request — ${user.email}`,
      GDPR_ERASURE: `GDPR Article 17 Right to Erasure Request — ${user.email}`,
      FCRA_DISPUTE: `FCRA Dispute Notice — ${user.email}`,
    };

    const doc = await prisma.legalDocument.create({
      data: {
        userId: req.userId,
        docType,
        recipientName,
        recipientEmail,
        recipientFax,
        subject: subjects[docType],
      },
    });

    // Queue PDF generation + sending
    await legalDocQueue.add('generate-and-send', {
      docId: doc.id,
      userId: req.userId,
      userEmail: user.email,
      userName: user.fullName,
      docType,
      recipientName,
      recipientEmail,
      recipientFax,
    }, { attempts: 3, backoff: { type: 'fixed', delay: 5000 } });

    res.status(201).json(doc);
  }
);

// ─── GET /api/orm/legal-docs ──────────────────────────────────────────────────
router.get('/legal-docs', requireAuth, async (req: any, res: Response) => {
  const docs = await prisma.legalDocument.findMany({
    where: { userId: req.userId },
    orderBy: { createdAt: 'desc' },
  });
  res.json(docs);
});

// ─── GET /api/orm/dashboard-summary ──────────────────────────────────────────
router.get('/dashboard-summary', requireAuth, async (req: any, res: Response) => {
  const [
    totalLinks,
    negativeLinks,
    dataBrokerLinks,
    completedOptOuts,
    pendingOptOuts,
    legalDocsSent,
  ] = await Promise.all([
    prisma.scannedLink.count({ where: { userId: req.userId } }),
    prisma.scannedLink.count({ where: { userId: req.userId, sentiment: 'NEGATIVE' } }),
    prisma.scannedLink.count({ where: { userId: req.userId, isDataBroker: true } }),
    prisma.optOutTask.count({ where: { userId: req.userId, status: 'COMPLETED' } }),
    prisma.optOutTask.count({ where: { userId: req.userId, status: { in: ['QUEUED', 'IN_PROGRESS'] } } }),
    prisma.legalDocument.count({ where: { userId: req.userId, status: { in: ['SENT_EMAIL', 'SENT_FAX'] } } }),
  ]);

  // Compute Visibility Risk Index: weighted sum of (position_weight × |sentiment|) for top-10 negative links
  const topNegative = await prisma.scannedLink.findMany({
    where: { userId: req.userId, sentiment: 'NEGATIVE' },
    orderBy: { position: 'asc' },
    take: 10,
    select: { position: true, riskScore: true },
  });

  const visibilityRiskIndex = topNegative.reduce((acc, link) => {
    const positionWeight = Math.max(0, (11 - link.position) / 10); // rank 1 = weight 1.0
    return acc + positionWeight * link.riskScore;
  }, 0);

  res.json({
    totalLinks,
    negativeLinks,
    dataBrokerLinks,
    completedOptOuts,
    pendingOptOuts,
    legalDocsSent,
    visibilityRiskIndex: Math.min(100, Math.round(visibilityRiskIndex)),
  });
});

export { router as ormRouter };
