#!/bin/bash
set -e

# ==============================================================================
# D31337m3 Local Development Bootstrap Script
# Preps the environment, installs dependencies, spins up Postgres/Redis, 
# migrates the DB, and starts the full monorepo stack.
# ==============================================================================

echo "🚀 Bootstrapping D31337m3 Local Environment..."

# 1. Check prerequisites
command -v node >/dev/null 2>&1 || { echo >&2 "❌ Node.js is required but not installed. Aborting."; exit 1; }
command -v npm >/dev/null 2>&1 || { echo >&2 "❌ npm is required but not installed. Aborting."; exit 1; }
command -v docker >/dev/null 2>&1 || { echo >&2 "❌ Docker is required for Redis/Postgres. Aborting."; exit 1; }

# 2. Setup Database and Redis via Docker
echo "📦 Starting PostgreSQL and Redis containers..."
# Clean up existing containers if they exist to ensure a fresh start
docker rm -f d31337-postgres d31337-redis 2>/dev/null || true

# Spin up Postgres and Redis
docker run --name d31337-postgres -e POSTGRES_USER=postgres -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=d31337m3 -p 5432:5432 -d postgres:15-alpine
docker run --name d31337-redis -p 6379:6379 -d redis:7-alpine

echo "⏳ Waiting for PostgreSQL to initialize..."
sleep 5 # Give Postgres a moment to accept connections

# 3. Configure Environment Variables
echo "⚙️  Configuring environment variables..."

# Server API .env
cat <<EOF > apps/server-api/.env
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/d31337m3?schema=public"
REDIS_URL="redis://localhost:6379"
PORT=4000
JWT_SECRET="local-dev-super-secret-key-31337"
STRIPE_SECRET_KEY="sk_test_placeholder"
STRIPE_WEBHOOK_SECRET="whsec_placeholder"
SERPAPI_KEY="test_key_placeholder"
CLIENT_ORIGIN="http://localhost:5173"

# Placeholder prices so the backend doesn't crash on start
STRIPE_PRICE_PERSONAL_BASIC_MONTHLY="price_test_1"
STRIPE_PRICE_PERSONAL_BASIC_ANNUAL="price_test_2"
STRIPE_PRICE_PERSONAL_PREMIUM_MONTHLY="price_test_3"
STRIPE_PRICE_PERSONAL_PREMIUM_ANNUAL="price_test_4"
STRIPE_PRICE_BUSINESS_GROWTH_MONTHLY="price_test_5"
STRIPE_PRICE_BUSINESS_GROWTH_ANNUAL="price_test_6"
STRIPE_PRICE_BUSINESS_ENTERPRISE_MONTHLY="price_test_7"
EOF

# Client SPA .env
cat <<EOF > apps/client-spa/.env
VITE_API_URL="http://localhost:4000"
EOF

# 4. Install Dependencies
echo "📥 Installing NPM dependencies across the monorepo..."
npm install

# 5. Database Schema Push & Generate
echo "🗄️  Pushing Prisma Schema to database and generating client..."
npm run db:push -w apps/server-api
npm run db:generate -w apps/server-api

# 6. Start Development Servers
echo "============================================================"
echo "🔥 Setup complete! Starting React SPA and Node.js API..."
echo "👉 Frontend will be available at: http://localhost:5173"
echo "👉 Backend API will be available at: http://localhost:4000"
echo "============================================================"

npm run dev
