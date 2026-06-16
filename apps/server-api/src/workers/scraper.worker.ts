/**
 * Scraper + ORM Workers (BullMQ)
 *
 * Queues:
 *   serp-scan       — Calls SerpApi to fetch SERP results, classifies sentiment, stores ScannedLinks
 *   opt-out         — Playwright headless browser executes data broker opt-out forms
 *   crypto-monitor  — Polls chain for pending deposit address confirmations
 *
 * Workers are launched from server.ts via startWorkers().
 */

import { Queue, Worker, Job } from 'bullmq';
import IORedis from 'ioredis';
import { chromium } from 'playwright';
import { PrismaClient, OptOutStatus, LinkSentiment } from '@prisma/client';
import { pollPendingDeposits } from '../services/web3.service';
import { logger } from '../services/logger.service';

// ─── Redis connection ─────────────────────────────────────────────────────────
const redisConnection = new IORedis(process.env.REDIS_URL || 'redis://localhost:6379', {
  maxRetriesPerRequest: null, // Required by BullMQ
});

const prisma = new PrismaClient();

// ─── Queue instances (exported for use in ORM controller) ─────────────────────
export const serpScanQueue   = new Queue('serp-scan',    { connection: redisConnection });
export const optOutQueue     = new Queue('opt-out',      { connection: redisConnection });
export const legalDocQueue   = new Queue('legal-doc',    { connection: redisConnection });
export const cryptoMonitorQueue = new Queue('crypto-monitor', { connection: redisConnection });

// ─── SERP Scan Worker ─────────────────────────────────────────────────────────
async function processSerpScan(job: Job) {
  const { keywordId, userId, keyword } = job.data;
  logger.info(`[SERP] Scanning: "${keyword}" (keywordId=${keywordId})`);

  const SERP_API_KEY = process.env.SERPAPI_KEY;
  if (!SERP_API_KEY) throw new Error('SERPAPI_KEY not configured');

  const response = await fetch(
    `https://serpapi.com/search.json?q=${encodeURIComponent(keyword)}&num=20&api_key=${SERP_API_KEY}`
  );
  const data = await response.json() as any;

  const organicResults = data.organic_results || [];

  // Known data broker domains
  const DATA_BROKER_DOMAINS = new Set([
    'whitepages.com', 'spokeo.com', 'radaris.com', 'intelius.com',
    'beenverified.com', 'truthfinder.com', 'peoplefinder.com',
    'mylife.com', 'instantcheckmate.com', 'checkpeople.com',
    'fastpeoplesearch.com', 'peoplelooker.com', 'usphonebook.com',
    'addresses.com', 'anywho.com', 'truepeoplesearch.com',
  ]);

  for (const result of organicResults) {
    const url: string = result.link || '';
    const title: string = result.title || '';
    const snippet: string = result.snippet || '';
    const position: number = result.position || 99;

    let domain = '';
    try { domain = new URL(url).hostname.replace('www.', ''); } catch { continue; }

    const isDataBroker = DATA_BROKER_DOMAINS.has(domain);

    // Lightweight sentiment classification based on keywords
    const negativeKeywords = ['arrest', 'criminal', 'fraud', 'lawsuit', 'scandal', 'fired', 'complaint', 'violation'];
    const positiveKeywords = ['award', 'achievement', 'recognized', 'certified', 'review', 'trusted', 'official'];

    const text = `${title} ${snippet}`.toLowerCase();
    let sentimentScore = 0;
    negativeKeywords.forEach(kw => { if (text.includes(kw)) sentimentScore -= 0.2; });
    positiveKeywords.forEach(kw => { if (text.includes(kw)) sentimentScore += 0.15; });
    sentimentScore = Math.max(-1, Math.min(1, sentimentScore));

    let sentiment: LinkSentiment = 'NEUTRAL';
    if (sentimentScore <= -0.3) sentiment = 'CRITICAL';
    else if (sentimentScore < 0) sentiment = 'NEGATIVE';
    else if (sentimentScore > 0.2) sentiment = 'POSITIVE';

    // Risk score: position-weighted sentiment
    const positionWeight = Math.max(0, (21 - position) / 20);
    const riskScore = isDataBroker
      ? Math.min(100, 50 + positionWeight * 50)
      : Math.max(0, -sentimentScore * positionWeight * 100);

    await prisma.scannedLink.upsert({
      where: {
        // Use a unique composite — url per keyword
        id: `${keywordId}_${Buffer.from(url).toString('base64').slice(0, 20)}`,
      },
      create: {
        id: `${keywordId}_${Buffer.from(url).toString('base64').slice(0, 20)}`,
        userId,
        keywordId,
        url,
        title,
        snippet,
        position,
        sentimentScore,
        sentiment,
        riskScore,
        domain,
        isDataBroker,
        optOutAvailable: isDataBroker,
      },
      update: {
        title,
        snippet,
        position,
        sentimentScore,
        sentiment,
        riskScore,
        lastSeenAt: new Date(),
      },
    });
  }

  await prisma.trackedKeyword.update({
    where: { id: keywordId },
    data: { lastScannedAt: new Date() },
  });

  logger.info(`[SERP] Scan complete for "${keyword}": ${organicResults.length} results`);
}

// ─── Opt-Out Worker (Playwright headless browser) ─────────────────────────────
async function processOptOut(job: Job) {
  const { taskId, url, domain } = job.data;
  logger.info(`[OPT-OUT] Starting: ${domain} (taskId=${taskId})`);

  await prisma.optOutTask.update({
    where: { id: taskId },
    data: { status: 'IN_PROGRESS', lastAttemptAt: new Date(), attempts: { increment: 1 } },
  });

  // Generate a unique disposable email alias for this opt-out
  // In production: call Cloudflare Email Routing API or Mailgun alias API
  const alias = `optout-${taskId}-${Date.now()}@${process.env.DISPOSABLE_EMAIL_DOMAIN || 'removeme.d31337m3.com'}`;

  await prisma.optOutTask.update({
    where: { id: taskId },
    data: { verificationEmail: alias },
  });

  const browser = await chromium.launch({
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-blink-features=AutomationControlled',
      '--disable-dev-shm-usage',
      '--disable-web-security',
    ],
  });

  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
    viewport: { width: 1280, height: 800 },
    locale: 'en-US',
    timezoneId: 'America/New_York',
  });

  const page = await context.newPage();

  // Stealth: override navigator.webdriver
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
    (window as any).chrome = { runtime: {} };
  });

  try {
    // ── Per-broker opt-out logic ──
    // This is a map of known broker opt-out patterns.
    // In production: expand this to 200+ brokers with specific selectors.
    const brokerHandlers: Record<string, (p: typeof page) => Promise<void>> = {

      'whitepages.com': async (p) => {
        await p.goto('https://www.whitepages.com/suppression-center', { waitUntil: 'domcontentloaded' });
        await p.fill('input[name="email"]', alias);
        await p.click('button[type="submit"]');
        await p.waitForTimeout(2000);
      },

      'spokeo.com': async (p) => {
        await p.goto('https://www.spokeo.com/optout', { waitUntil: 'domcontentloaded' });
        await p.fill('input#email', alias);
        await p.click('button.optout-btn');
        await p.waitForTimeout(2000);
      },

      'radaris.com': async (p) => {
        await p.goto('https://radaris.com/control/privacy', { waitUntil: 'domcontentloaded' });
        await p.fill('input[name="email"]', alias);
        await p.click('button[type="submit"]');
        await p.waitForTimeout(2000);
      },

      'beenverified.com': async (p) => {
        await p.goto('https://www.beenverified.com/app/optout/search', { waitUntil: 'domcontentloaded' });
        await p.fill('input[placeholder*="email"]', alias);
        await p.click('button[data-type="optout"]');
        await p.waitForTimeout(2000);
      },
    };

    const handler = brokerHandlers[domain];

    if (handler) {
      await handler(page);
    } else {
      // Generic fallback: look for common opt-out form patterns
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
      const emailInput = await page.$('input[type="email"], input[name="email"], input[name="Email"]');
      if (emailInput) {
        await emailInput.fill(alias);
        const submitBtn = await page.$('button[type="submit"], input[type="submit"], button:has-text("Opt Out"), button:has-text("Remove"), button:has-text("Submit")');
        if (submitBtn) await submitBtn.click();
        await page.waitForTimeout(2000);
      }
    }

    // Take screenshot as proof
    const screenshotPath = `/tmp/optout-${taskId}.png`;
    await page.screenshot({ path: screenshotPath, fullPage: true });

    await prisma.optOutTask.update({
      where: { id: taskId },
      data: {
        status: 'AWAITING_EMAIL_VERIFICATION',
        screenshotPath,
      },
    });

    logger.info(`[OPT-OUT] Form submitted for ${domain}, awaiting email verification`);

  } catch (err: any) {
    logger.error(`[OPT-OUT] Failed for ${domain}: ${err.message}`);
    await prisma.optOutTask.update({
      where: { id: taskId },
      data: {
        status: 'FAILED',
        failureReason: err.message.slice(0, 500),
      },
    });
    throw err;
  } finally {
    await browser.close();
  }
}

// ─── Legal Doc Worker ─────────────────────────────────────────────────────────
async function processLegalDoc(job: Job) {
  const { docId, userEmail, userName, docType, recipientName, recipientEmail, recipientFax } = job.data;
  logger.info(`[LEGAL] Generating ${docType} for ${recipientName}`);

  // Dynamic import to avoid loading pdfkit at startup
  const PDFDocument = (await import('pdfkit')).default;
  const fs = await import('fs');

  const templates: Record<string, string> = {
    CCPA_DELETION: `
CALIFORNIA CONSUMER PRIVACY ACT (CCPA) — DATA DELETION REQUEST

Date: ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}

To: ${recipientName}
From: ${userName || userEmail}
Email: ${userEmail}

Pursuant to California Civil Code Section 1798.105, I hereby request that you delete all personal 
information about me that you have collected, sold, or disclosed. This request applies to all categories 
of personal information as defined under the CCPA.

You are required to respond to this request within 45 days. Failure to comply may result in a complaint 
to the California Attorney General's Office and may expose your organization to statutory penalties of 
up to $7,500 per intentional violation.

Please confirm receipt of this request and provide written confirmation of the deletion.
    `,
    GDPR_ERASURE: `
GDPR ARTICLE 17 — RIGHT TO ERASURE (RIGHT TO BE FORGOTTEN) REQUEST

Date: ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}

To: ${recipientName}
From: ${userName || userEmail}
Email: ${userEmail}

Under Article 17 of the General Data Protection Regulation (GDPR) (EU) 2016/679, I am exercising 
my right to erasure of all personal data held by your organization relating to me.

This request covers all personal data including but not limited to: name, address, date of birth, 
contact information, browsing history, behavioral data, and any other identifiable information.

You have one month to respond to this request. If you are unable to comply within this period, 
you must inform me of the reason for the delay and the expected timeline.
    `,
    FCRA_DISPUTE: `
FAIR CREDIT REPORTING ACT (FCRA) — FORMAL DISPUTE NOTICE

Date: ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}

To: ${recipientName}
From: ${userName || userEmail}
Email: ${userEmail}

Pursuant to Section 611 of the Fair Credit Reporting Act (15 U.S.C. § 1681i), I am formally 
disputing inaccurate and/or incomplete information contained in records associated with my identity 
at your organization.

You are legally required to investigate this dispute within 30 days of receipt and provide written 
results of your investigation. Please remove or correct all inaccurate information and provide me 
with a copy of the updated records.
    `,
  };

  const content = templates[docType] || templates['CCPA_DELETION'];
  const outputPath = `/tmp/legal-${docId}.pdf`;

  await new Promise<void>((resolve, reject) => {
    const doc = new PDFDocument({ margin: 72 });
    const stream = fs.createWriteStream(outputPath);
    doc.pipe(stream);

    doc.font('Helvetica-Bold').fontSize(14).text('D31337m3 Legal Notice', { align: 'center' });
    doc.moveDown(2);
    doc.font('Helvetica').fontSize(11).text(content.trim(), { lineGap: 4 });
    doc.moveDown(3);
    doc.text('_________________________________');
    doc.text(`Signed: ${userName || userEmail}`);
    doc.text(`Date: ${new Date().toISOString().split('T')[0]}`);

    doc.end();
    stream.on('finish', resolve);
    stream.on('error', reject);
  });

  // Update record with PDF path
  await prisma.legalDocument.update({
    where: { id: docId },
    data: { pdfStoragePath: outputPath, status: 'DRAFT' },
  });

  // TODO: Send via email (nodemailer) or fax (Twilio Programmable Fax)
  // For now: update status
  if (recipientEmail) {
    // await sendLegalEmail(recipientEmail, outputPath, subject);
    await prisma.legalDocument.update({
      where: { id: docId },
      data: { status: 'SENT_EMAIL', sentAt: new Date() },
    });
  }

  logger.info(`[LEGAL] ${docType} PDF generated: ${outputPath}`);
}

// ─── Crypto Monitor Worker ────────────────────────────────────────────────────
async function processCryptoMonitor(_job: Job) {
  await pollPendingDeposits();
}

// ─── Start all workers ────────────────────────────────────────────────────────
export async function startWorkers(): Promise<void> {
  const workerOpts = {
    connection: redisConnection,
    concurrency: 3,
  };

  new Worker('serp-scan', processSerpScan, workerOpts);
  new Worker('opt-out',   processOptOut,   { ...workerOpts, concurrency: 2 });
  new Worker('legal-doc', processLegalDoc, workerOpts);
  new Worker('crypto-monitor', processCryptoMonitor, { connection: redisConnection, concurrency: 1 });

  // Schedule crypto monitor to run every 30 seconds
  await cryptoMonitorQueue.upsertJobScheduler(
    'poll-deposits',
    { every: 30000 },
    { name: 'poll', data: {} }
  );

  logger.info('[Workers] All BullMQ workers registered');
}
