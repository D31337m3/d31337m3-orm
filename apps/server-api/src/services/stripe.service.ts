/**
 * Stripe Service
 * Handles subscription creation, customer management, webhook verification,
 * and one-off PaymentIntents for add-on purchases.
 */

import Stripe from 'stripe';
import { PrismaClient, SubscriptionTier, SubscriptionInterval } from '@prisma/client';
import { logger } from './logger.service';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2024-06-20',
});

const prisma = new PrismaClient();

// ─── Price ID map — set these in your Stripe dashboard and .env ──────────────
const PRICE_IDS: Record<string, string> = {
  [`${SubscriptionTier.PERSONAL_BASIC}_${SubscriptionInterval.MONTHLY}`]:    process.env.STRIPE_PRICE_PERSONAL_BASIC_MONTHLY!,
  [`${SubscriptionTier.PERSONAL_BASIC}_${SubscriptionInterval.ANNUAL}`]:     process.env.STRIPE_PRICE_PERSONAL_BASIC_ANNUAL!,
  [`${SubscriptionTier.PERSONAL_PREMIUM}_${SubscriptionInterval.MONTHLY}`]:  process.env.STRIPE_PRICE_PERSONAL_PREMIUM_MONTHLY!,
  [`${SubscriptionTier.PERSONAL_PREMIUM}_${SubscriptionInterval.ANNUAL}`]:   process.env.STRIPE_PRICE_PERSONAL_PREMIUM_ANNUAL!,
  [`${SubscriptionTier.BUSINESS_GROWTH}_${SubscriptionInterval.MONTHLY}`]:   process.env.STRIPE_PRICE_BUSINESS_GROWTH_MONTHLY!,
  [`${SubscriptionTier.BUSINESS_GROWTH}_${SubscriptionInterval.ANNUAL}`]:    process.env.STRIPE_PRICE_BUSINESS_GROWTH_ANNUAL!,
  [`${SubscriptionTier.BUSINESS_ENTERPRISE}_${SubscriptionInterval.MONTHLY}`]:process.env.STRIPE_PRICE_BUSINESS_ENTERPRISE_MONTHLY!,
};

/**
 * Get or create a Stripe customer for a given user.
 */
export async function getOrCreateStripeCustomer(userId: string, email: string): Promise<string> {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (user?.stripeCustomerId) return user.stripeCustomerId;

  const customer = await stripe.customers.create({
    email,
    metadata: { d31337_user_id: userId },
  });

  await prisma.user.update({
    where: { id: userId },
    data: { stripeCustomerId: customer.id },
  });

  return customer.id;
}

/**
 * Create a Stripe Checkout Session for subscription signup.
 */
export async function createCheckoutSession(params: {
  userId: string;
  email: string;
  tier: SubscriptionTier;
  interval: SubscriptionInterval;
  successUrl: string;
  cancelUrl: string;
}): Promise<string> {
  const { userId, email, tier, interval, successUrl, cancelUrl } = params;
  const customerId = await getOrCreateStripeCustomer(userId, email);
  const priceId = PRICE_IDS[`${tier}_${interval}`];

  if (!priceId) throw new Error(`No Stripe price configured for ${tier} ${interval}`);

  const session = await stripe.checkout.sessions.create({
    customer: customerId,
    mode: 'subscription',
    payment_method_types: ['card'],
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: successUrl,
    cancel_url: cancelUrl,
    subscription_data: {
      metadata: { d31337_user_id: userId, tier, interval },
    },
  });

  return session.url!;
}

/**
 * Create a PaymentIntent for a one-off add-on purchase.
 */
export async function createAddonPaymentIntent(params: {
  userId: string;
  email: string;
  amountCents: number;
  description: string;
}): Promise<{ clientSecret: string; paymentIntentId: string }> {
  const { userId, email, amountCents, description } = params;
  const customerId = await getOrCreateStripeCustomer(userId, email);

  const intent = await stripe.paymentIntents.create({
    amount: amountCents,
    currency: 'usd',
    customer: customerId,
    description,
    metadata: { d31337_user_id: userId },
    automatic_payment_methods: { enabled: true },
  });

  return { clientSecret: intent.client_secret!, paymentIntentId: intent.id };
}

/**
 * Process Stripe webhook events.
 * Must receive raw body (Buffer) and Stripe-Signature header.
 */
export async function handleStripeWebhook(rawBody: Buffer, signature: string): Promise<void> {
  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(
      rawBody,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET!,
    );
  } catch (err: any) {
    logger.warn(`Stripe webhook signature failed: ${err.message}`);
    throw new Error('Invalid webhook signature');
  }

  logger.info(`Stripe event: ${event.type}`);

  switch (event.type) {
    case 'customer.subscription.created':
    case 'customer.subscription.updated': {
      const sub = event.data.object as Stripe.Subscription;
      const userId = sub.metadata.d31337_user_id;
      if (!userId) break;

      await prisma.subscription.upsert({
        where: { stripeSubscriptionId: sub.id },
        create: {
          userId,
          tier: (sub.metadata.tier as SubscriptionTier) || SubscriptionTier.PERSONAL_BASIC,
          status: mapStripeStatus(sub.status),
          interval: (sub.metadata.interval as SubscriptionInterval) || SubscriptionInterval.MONTHLY,
          stripeSubscriptionId: sub.id,
          stripeCurrentPeriodEnd: new Date(sub.current_period_end * 1000),
          currentPeriodStart: new Date(sub.current_period_start * 1000),
          currentPeriodEnd: new Date(sub.current_period_end * 1000),
        },
        update: {
          status: mapStripeStatus(sub.status),
          stripeCurrentPeriodEnd: new Date(sub.current_period_end * 1000),
          currentPeriodEnd: new Date(sub.current_period_end * 1000),
        },
      });
      break;
    }

    case 'customer.subscription.deleted': {
      const sub = event.data.object as Stripe.Subscription;
      await prisma.subscription.updateMany({
        where: { stripeSubscriptionId: sub.id },
        data: { status: 'CANCELED', canceledAt: new Date() },
      });
      break;
    }

    case 'invoice.payment_succeeded': {
      const invoice = event.data.object as Stripe.Invoice;
      if (invoice.subscription && invoice.customer) {
        logger.info(`Payment succeeded for customer ${invoice.customer}`);
        // Record payment
        const user = await prisma.user.findFirst({
          where: { stripeCustomerId: invoice.customer as string },
        });
        if (user) {
          await prisma.payment.create({
            data: {
              userId: user.id,
              provider: 'STRIPE',
              status: 'CONFIRMED',
              amountCents: invoice.amount_paid,
              currency: invoice.currency.toUpperCase(),
              description: `Subscription payment - ${invoice.id}`,
              stripePaymentId: invoice.payment_intent as string,
              confirmedAt: new Date(),
            },
          });
        }
      }
      break;
    }

    case 'invoice.payment_failed': {
      const invoice = event.data.object as Stripe.Invoice;
      logger.warn(`Payment failed for customer ${invoice.customer}`);
      if (invoice.subscription) {
        await prisma.subscription.updateMany({
          where: { stripeSubscriptionId: invoice.subscription as string },
          data: { status: 'PAST_DUE' },
        });
      }
      break;
    }

    default:
      logger.debug(`Unhandled Stripe event: ${event.type}`);
  }
}

function mapStripeStatus(status: Stripe.Subscription.Status): any {
  const map: Record<string, string> = {
    active: 'ACTIVE',
    past_due: 'PAST_DUE',
    canceled: 'CANCELED',
    trialing: 'TRIALING',
    paused: 'PAUSED',
    unpaid: 'PAST_DUE',
    incomplete: 'PAST_DUE',
    incomplete_expired: 'CANCELED',
  };
  return map[status] || 'PAST_DUE';
}
