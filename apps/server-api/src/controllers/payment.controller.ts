/**
 * Payment Controller
 * Routes for Stripe checkout, PayPal, Interac, and Web3 crypto payments.
 * Also handles Stripe + PayPal webhooks.
 */

import { Router, Request, Response } from 'express';
import { body, validationResult } from 'express-validator';
import { PrismaClient, SubscriptionTier, SubscriptionInterval } from '@prisma/client';
import { requireAuth } from './auth.controller';
import {
  createCheckoutSession,
  createAddonPaymentIntent,
  handleStripeWebhook,
} from '../services/stripe.service';
import { provisionDepositAddress, verifyOnChainPayment } from '../services/web3.service';
import { logger } from '../services/logger.service';

const router = Router();
const prisma = new PrismaClient();

// ─── POST /api/payments/stripe/checkout ──────────────────────────────────────
router.post('/stripe/checkout', requireAuth,
  body('tier').isIn(Object.values(SubscriptionTier)),
  body('interval').isIn(Object.values(SubscriptionInterval)),
  async (req: any, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const { tier, interval } = req.body;
    const origin = process.env.CLIENT_ORIGIN || 'http://localhost:5173';

    const url = await createCheckoutSession({
      userId: req.userId,
      email: req.userEmail,
      tier,
      interval,
      successUrl: `${origin}/dashboard?checkout=success`,
      cancelUrl: `${origin}/pricing?checkout=canceled`,
    });

    res.json({ url });
  }
);

// ─── POST /api/payments/stripe/addon ─────────────────────────────────────────
router.post('/stripe/addon', requireAuth,
  body('addOnType').isIn(['EXPEDITED_REMOVAL', 'DEEP_SCAN']),
  async (req: any, res: Response) => {
    const ADD_ON_PRICES: Record<string, number> = {
      EXPEDITED_REMOVAL: 2500,  // $25.00 in cents
      DEEP_SCAN: 3500,           // $35.00 in cents
    };

    const { addOnType } = req.body;
    const amountCents = ADD_ON_PRICES[addOnType];

    const { clientSecret, paymentIntentId } = await createAddonPaymentIntent({
      userId: req.userId,
      email: req.userEmail,
      amountCents,
      description: `D31337m3 Add-On: ${addOnType}`,
    });

    // Pre-create the add-on record
    await prisma.addOnPurchase.create({
      data: {
        userId: req.userId,
        addOnType,
        priceCents: amountCents,
        status: 'pending',
      },
    });

    res.json({ clientSecret, paymentIntentId });
  }
);

// ─── POST /api/payments/stripe/webhook ───────────────────────────────────────
// NOTE: raw body middleware applied in server.ts for this route
router.post('/stripe/webhook', async (req: Request, res: Response) => {
  const sig = req.headers['stripe-signature'];
  if (!sig) return res.status(400).json({ error: 'Missing Stripe-Signature header' });

  try {
    await handleStripeWebhook(req.body as Buffer, sig as string);
    res.json({ received: true });
  } catch (err: any) {
    logger.error(`Stripe webhook error: ${err.message}`);
    res.status(400).json({ error: err.message });
  }
});

// ─── POST /api/payments/crypto/provision ─────────────────────────────────────
router.post('/crypto/provision', requireAuth,
  body('amountUSD').isFloat({ min: 1 }),
  body('chainId').isIn([137, 8453]),
  async (req: any, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const { amountUSD, chainId } = req.body;
    const result = await provisionDepositAddress({
      userId: req.userId,
      amountUSD,
      chainId,
    });

    res.json(result);
  }
);

// ─── POST /api/payments/crypto/verify ────────────────────────────────────────
router.post('/crypto/verify', requireAuth,
  body('invoiceToken').notEmpty(),
  body('txHash').notEmpty(),
  body('chainId').isIn([137, 8453]),
  body('tokenSymbol').isIn(['USDC', 'USDT']),
  async (req: any, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const { invoiceToken, txHash, chainId, tokenSymbol } = req.body;

    const result = await verifyOnChainPayment({ invoiceToken, txHash, chainId, tokenSymbol });
    res.json(result);
  }
);

// ─── POST /api/payments/interac/submit ───────────────────────────────────────
router.post('/interac/submit', requireAuth,
  body('referenceNumber').notEmpty().trim(),
  body('senderName').notEmpty().trim(),
  body('amountCAD').isFloat({ min: 1 }),
  async (req: any, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const { referenceNumber, senderName, amountCAD } = req.body;

    // Create a pending payment record — a background worker will monitor
    // the Interac confirmation inbox and match this reference number
    const payment = await prisma.payment.create({
      data: {
        userId: req.userId,
        provider: 'INTERAC',
        status: 'PENDING',
        amountCents: Math.round(amountCAD * 100),
        currency: 'CAD',
        description: `Interac from ${senderName} — Ref: ${referenceNumber}`,
        interacRefNumber: referenceNumber,
      },
    });

    logger.info(`Interac payment submitted: ref=${referenceNumber} user=${req.userId}`);
    res.json({ paymentId: payment.id, status: 'pending', message: 'We will verify your transfer within 1 business hour.' });
  }
);

// ─── GET /api/payments/history ────────────────────────────────────────────────
router.get('/history', requireAuth, async (req: any, res: Response) => {
  const payments = await prisma.payment.findMany({
    where: { userId: req.userId },
    orderBy: { createdAt: 'desc' },
    take: 50,
  });
  res.json(payments);
});

export { router as paymentRouter };
