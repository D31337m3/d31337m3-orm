# System Architecture

## Overview

The D31337m3 platform is structured as a monolithic microservices monorepo. It ensures strict separation of concerns between the client-side SPA and the backend API while sharing a unified build and deployment context.

## 1. Frontend Architecture (`apps/client-spa`)

- **Framework:** React 19 written in TypeScript.
- **Bundler:** Vite.
- **Routing:** React Router v6+.
- **State Management:** 
  - Server State: TanStack Query (React Query) for caching, refetching, and synchronization.
  - Global State: Zustand for lightweight local state (auth, UI toggles).
- **Styling:** Tailwind CSS with utility-first classes, heavily utilizing `class-variance-authority` and `clsx` for component variants.
- **Animations:** Framer Motion powers complex interactive elements like the Network Graph and the Live Scanner mock.
- **Web3 Integration:** Uses `ethers.js` and `@web3-onboard` for wallet connections and native crypto payment interactions.

## 2. Backend Architecture (`apps/server-api`)

- **Framework:** Express.js in a Node.js runtime.
- **Database:** PostgreSQL. All access is strictly managed via Prisma ORM for type safety.
- **Queueing / Background Jobs:** Redis + BullMQ. Critical for handling long-running, error-prone tasks like headless scraping and email verification polling.

### Background Workers

Background workers are essential to the ORM platform. They are defined in `workers/scraper.worker.ts` and handle:

1. **SERP Scan Worker (`serp-scan`):**
   - Ingests keywords.
   - Calls SerpApi to fetch top Google/Bing results.
   - Classifies domain risk and applies sentiment analysis.
   - Saves results to `ScannedLink`.

2. **Opt-Out Worker (`opt-out`):**
   - Uses Playwright in stealth mode to navigate to data broker domains.
   - Submits opt-out forms using dynamically generated throwaway email addresses.
   - Takes proof-of-submission screenshots.

3. **Legal Document Worker (`legal-doc`):**
   - Generates customized PDF documents using `pdfkit`.
   - Queues them for delivery via Email/Fax based on the broker's compliance requirements.

4. **Crypto Monitor Worker (`crypto-monitor`):**
   - Polling agent that checks Alchemy/QuickNode endpoints for incoming USDC/USDT transfers to provisioned ephemeral addresses.

## 3. Data Model

The Prisma schema defines several core entities:
- **User:** Authentication and profile data.
- **Subscription:** Billing tier and recurring status.
- **TrackedKeyword:** The search terms the system is monitoring.
- **ScannedLink:** Individual search results tied to a keyword, enriched with sentiment and risk data.
- **OptOutTask:** State machine for the removal process of a specific data broker link.
- **LegalDocument:** Record of generated and dispatched compliance requests.
- **Payment & DepositAddress:** Financial records and ephemeral Web3 wallets.
