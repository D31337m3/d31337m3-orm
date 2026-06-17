/**
 * Engagement Worker (BullMQ)
 * Runs periodically to send retention/engagement emails to users,
 * reminding them to check their dashboard and see the value being generated.
 */

import { Queue, Worker, Job } from 'bullmq';
import IORedis from 'ioredis';
import { PrismaClient } from '@prisma/client';
import { logger } from '../services/logger.service';

const redisConnection = new IORedis(process.env.REDIS_URL || 'redis://localhost:6379', {
  maxRetriesPerRequest: null,
});

const prisma = new PrismaClient();
export const engagementQueue = new Queue('engagement-emails', { connection: redisConnection });

async function processEngagementEmails(_job: Job) {
  logger.info('[ENGAGEMENT] Starting daily retention email sweep...');

  // Find users with active subscriptions
  const activeUsers = await prisma.user.findMany({
    where: {
      subscriptions: { some: { status: 'ACTIVE' } }
    },
    include: {
      optOutTasks: { where: { status: 'COMPLETED' }, orderBy: { completedAt: 'desc' }, take: 5 }
    }
  });

  for (const user of activeUsers) {
    const recentRemovals = user.optOutTasks.length;
    
    // Simulate sending an email (Integrate SendGrid/Mailgun here in production)
    logger.info(`[EMAIL OUTBOUND] To: ${user.email}`);
    logger.info(`[EMAIL SUBJECT] D31337m3: Your weekly privacy report is ready.`);
    logger.info(`[EMAIL BODY] Hi ${user.fullName || 'there'},\n\nOur automated engines are working 24/7 to protect your digital footprint.\nWe have successfully removed or initiated removal for ${recentRemovals} records this week.\n\nNote: Please allow 3-7 days for search engine caches (Google, Bing) to drop the URLs completely after our successful opt-outs.\n\nLog in to your dashboard to view the full proof of removal and risk profile updates: https://d31337m3.com/dashboard\n\nStay secure,\nThe D31337m3 Engine`);
  }

  logger.info(`[ENGAGEMENT] Sweep complete. Processed ${activeUsers.length} users.`);
}

// Export initialization function to be called in server.ts
export async function startEngagementWorker() {
  new Worker('engagement-emails', processEngagementEmails, { connection: redisConnection });

  // Schedule to run daily at 9:00 AM UTC
  await engagementQueue.upsertJobScheduler(
    'daily-retention-email',
    { pattern: '0 9 * * *' }, 
    { name: 'send', data: {} }
  );
  
  logger.info('[Workers] Engagement email worker registered');
}
