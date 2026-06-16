# D31337m3 ORM Platform

Automated Online Reputation Management (ORM) and PII/Data Broker removal system. D31337m3 programmatically monitors Search Engine Result Pages (SERPs) and utilizes headless browser automation to remove personal information from over 200+ data brokers.

## 🚀 Features

- **SERP Analytics:** Automated scanning of Google, Bing, and Yahoo for brand/individual keywords.
- **Sentiment Classification:** Algorithmic scoring of search results to calculate a Visibility Risk Index.
- **Headless Opt-Out Engine:** Playwright-based worker pool that navigates data broker sites, solves CAPTCHAs, and submits removal forms.
- **Legal Document Automation:** Generates and dispatches CCPA, GDPR, and FCRA dispute notices.
- **Crypto Payments:** Accepts USDC/USDT directly on Polygon and Base networks.

## 🏗️ Architecture

The platform is a modern monolithic microservices monorepo:

- **Frontend:** React 19 SPA (Vite, Tailwind, Framer Motion, Zustand, TanStack Query).
- **Backend:** Node.js/Express API with TypeScript.
- **Database:** PostgreSQL managed via Prisma ORM.
- **Task Queue:** BullMQ backed by Redis for web scraping and legal dispatch workflows.

### Project Structure

```text
d31337m3-monorepo/
├── apps/
│   ├── client-spa/          # React Frontend
│   │   ├── src/
│   │   │   ├── components/  # Reusable UI components
│   │   │   ├── hooks/       # Custom React hooks (e.g., useWeb3Payment)
│   │   │   └── pages/       # Route-level components
│   └── server-api/          # Node.js API Backend
│       ├── prisma/          # Database schema and migrations
│       └── src/
│           ├── controllers/ # Express route handlers
│           ├── services/    # Business logic (Stripe, Web3, Logger)
│           └── workers/     # BullMQ background processors
├── docs/                    # Technical documentation
├── package.json             # Monorepo configuration
└── tsconfig.json            # Base TypeScript configuration
```

## 🛠️ Quick Start

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Configure Environment:**
   Set up your `.env` files for `apps/server-api` (needs PostgreSQL, Redis, Stripe, SerpApi keys) and `apps/client-spa`.

3. **Database Migration:**
   ```bash
   npm run db:push -w apps/server-api
   ```

4. **Run Development Servers:**
   ```bash
   npm run dev
   ```

## 📖 Documentation

See the `docs/` directory for detailed architecture and deployment guides:
- [API Documentation](docs/API.md)
- [Architecture & Design](docs/ARCHITECTURE.md)
- [Deployment Guide](docs/DEPLOYMENT.md)

## ⚖️ Legal Disclaimer

This software automates interactions with third-party websites. Users are responsible for ensuring their use complies with the Terms of Service of target platforms and applicable regional laws (CCPA, GDPR, FCRA).
