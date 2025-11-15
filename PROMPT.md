# PROJECT BRIEF: SEO-PPC Optimization Platform (Advergent)

You are tasked with building **Advergent**, a full SaaS platform that helps digital marketing agencies optimize their clients' Google Ads spend by identifying overlap with organic search rankings and delivering AI-powered recommendations.

---

## PRODUCT OVERVIEW

**Core Value Proposition**  
Automatically detect when agencies are paying for Google Ads clicks they could capture organically and surface AI recommendations that consider competitive dynamics, SERP features, conversion quality, and user intent.

**Target Customer**  
Digital marketing agencies (10–50+ active clients) such as Overdose Digital, Rise Interactive, etc.

**Key Differentiators**
- AI-powered recommendations (actionable, not just reports)
- Agency-focused portfolio management (multi-client view)
- Competitive intelligence (auction insights, alerts)
- Continuous monitoring (daily sync + alerts)

**Pricing**
- Starter – $299/mo (5 clients)
- Growth – $699/mo (15 clients)
- Agency – $1,499/mo (40 clients)

---

## TECH STACK

### Frontend
- **Framework**: React 18+ with Vite 5+
- **Language**: TypeScript 5+
- **Styling**: TailwindCSS 3+
- **UI Kit**: shadcn/ui
- **State**: TanStack Query v5
- **Routing**: React Router v6
- **Forms**: React Hook Form + Zod
- **Charts**: Recharts
- **Dates**: date-fns
- **Logging**: Pino browser logger with backend transport

### Backend
- **Runtime**: Node.js 20+
- **Framework**: Express.js (TypeScript)
- **Auth**: JWT (access 15m + refresh 7d) stored in HTTP-only cookies, session table
- **Validation**: Zod schemas everywhere
- **Logging**: Pino (pino-http + pino-pretty in dev)
- **Security**: AES-256-GCM encryption (KMS managed keys), bcrypt (12 rounds)

### Database
- **Primary**: Supabase Postgres 15 (managed) with Timescale extension enabled
- **Access**: `pg` Pool connecting over SSL
- **Migrations**: node-pg-migrate
- **Schema**: see “Complete Database Schema” section

### Job Queue & Cache
- **Queue**: BullMQ
- **Redis**: Upstash Redis (serverless) for queues + leader election
- **Purpose**: Scheduled syncs, AI analysis, email jobs

### External APIs
- **AI**: Anthropic Claude Sonnet 4
- **Google Ads**: google-ads-api
- **Search Console**: googleapis (webmasters)
- **OAuth**: Google OAuth 2.0

### Infrastructure
- **App Hosting**: Render
  - Web Service → Express API (apps/api)
  - Background Worker → BullMQ workers + scheduler
  - Render Cron (optional) for backups/cleanup
- **Database**: Supabase (managed Postgres + Timescale)
- **Redis**: Upstash Redis
- **Storage**: Render Disk (temp) / Supabase Storage initially; S3 later
- **Monitoring**: Pino logs piped to Render logs + Logtail (optional)
- **Email**: Resend

---

## PROJECT STRUCTURE

Create the following structure (Turborepo optional but recommended):

```
/
├── apps/
│   ├── web/
│   │   ├── src/
│   │   │   ├── components/
│   │   │   │   ├── ui/
│   │   │   │   ├── auth/
│   │   │   │   ├── onboarding/
│   │   │   │   ├── dashboard/
│   │   │   │   ├── clients/
│   │   │   │   ├── recommendations/
│   │   │   │   └── competitors/
│   │   │   ├── pages/
│   │   │   │   ├── Login.tsx
│   │   │   │   ├── Signup.tsx
│   │   │   │   ├── Dashboard.tsx
│   │   │   │   ├── Onboarding.tsx
│   │   │   │   ├── ClientDetail.tsx
│   │   │   │   ├── Recommendations.tsx
│   │   │   │   └── Competitors.tsx
│   │   │   ├── hooks/
│   │   │   │   ├── useAuth.ts
│   │   │   │   ├── useClient.ts
│   │   │   │   └── useRecommendations.ts
│   │   │   ├── lib/
│   │   │   │   ├── api.ts
│   │   │   │   ├── auth.ts
│   │   │   │   ├── logger.ts
│   │   │   │   └── utils.ts
│   │   │   ├── types/
│   │   │   │   ├── index.ts
│   │   │   │   ├── auth.types.ts
│   │   │   │   └── client.types.ts
│   │   │   ├── App.tsx
│   │   │   ├── main.tsx
│   │   │   └── index.css
│   │   ├── public/
│   │   ├── index.html
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   ├── tsconfig.node.json
│   │   ├── vite.config.ts
│   │   ├── tailwind.config.js
│   │   ├── postcss.config.js
│   │   └── .env.example
│   │
│   └── api/
│       ├── src/
│       │   ├── routes/ (auth/agencies/clients/competitors/etc.)
│       │   ├── services/
│       │   │   ├── auth.service.ts
│       │   │   ├── password.service.ts
│       │   │   ├── encryption.service.ts
│       │   │   ├── google-ads.service.ts
│       │   │   ├── google-ads.service.mock.ts
│       │       ├── search-console.service.ts
│       │       ├── search-console.service.mock.ts
│       │       ├── query-matcher.service.ts
│       │       ├── ai-analyzer.service.ts
│       │       ├── competitor.service.ts
│       │       └── recommendation.service.ts
│       │   ├── workers/
│       │   │   ├── scheduler.ts
│       │   │   ├── sync.worker.ts
│       │   │   ├── analysis.worker.ts
│       │   │   └── competitor.worker.ts
│       │   ├── db/
│       │   │   ├── index.ts
│       │   │   ├── migrations/
│       │   │   └── seeds/
│       │   ├── middleware/
│       │   │   ├── auth.middleware.ts
│       │   │   ├── error.middleware.ts
│       │   │   ├── logger.middleware.ts
│       │   │   └── validation.middleware.ts
│       │   ├── utils/
│       │   │   ├── logger.ts
│       │   │   └── errors.ts
│       │   ├── config/
│       │   ├── types/
│       │   └── server.ts
│       ├── fixtures/
│       │   ├── google-ads-sample.json
│       │   └── search-console-sample.json
│       ├── package.json
│       ├── tsconfig.json
│       └── .env.example
│
├── packages/
│   └── shared/
│       ├── src/
│       │   ├── types/
│       │   └── utils/
│       ├── package.json
│       └── tsconfig.json
│
├── docker-compose.yml
├── render.yaml
├── package.json
├── turbo.json (optional)
├── .gitignore
└── README.md
```

---

## DATABASE SETUP (Supabase)

Use Supabase SQL editor or migrations. Enable `uuid-ossp` and Timescale. Full schema identical to original spec but with:
- Encryption key table
- Access + refresh sessions
- Provenance on recommendations
- Job tracking improvements

(See “Complete Database Schema” section later in this document.)

---

## BACKEND DATABASE CLIENT (pg + Supabase)

```typescript
// apps/api/src/db/index.ts
import { Pool } from 'pg';
import pino from 'pino';

const logger = pino({ level: process.env.LOG_LEVEL ?? 'info' });

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL is required');
}

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }, // Supabase requires SSL
  max: 10,
  idleTimeoutMillis: 30_000
});

export async function query<T = any>(text: string, params?: any[]): Promise<T[]> {
  const start = Date.now();
  const client = await pool.connect();

  try {
    const result = await client.query(text, params);
    logger.debug({ text, duration: Date.now() - start, rows: result.rowCount }, 'query executed');
    return result.rows;
  } catch (error) {
    logger.error({ text, params, error }, 'query failed');
    throw error;
  } finally {
    client.release();
  }
}

export async function testConnection() {
  const result = await query<{ now: string }>('SELECT NOW()');
  logger.info({ time: result[0].now }, 'database connection OK');
}
```

---

## PINO LOGGING

Use the same configuration from the previous prompt (see `apps/api/src/utils/logger.ts` snippet) but remove Vercel-specific checks. Detect Render via `process.env.RENDER` if desired. Ensure redact list covers tokens, passwords, encrypted payloads. Use `pino-http` middleware.

Frontend logger remains the same; errors post to `/api/logs` endpoint.

---

## RENDER DEPLOYMENT

Create `render.yaml`:

```yaml
services:
  - type: web
    name: advergent-api
    env: node
    plan: standard
    buildCommand: cd apps/api && npm install && npm run build
    startCommand: node apps/api/dist/server.js
    envVars:
      - key: NODE_ENV
        value: production
      - key: DATABASE_URL
        sync: false
      - key: UPSTASH_REDIS_URL
        sync: false
      - key: UPSTASH_REDIS_TOKEN
        sync: false
      - key: JWT_SECRET
        sync: false
      - key: COOKIE_SECRET
        sync: false
      - key: ANTHROPIC_API_KEY
        sync: false
      - key: GOOGLE_CLIENT_ID
        sync: false
      - key: GOOGLE_CLIENT_SECRET
        sync: false
      - key: GOOGLE_ADS_DEVELOPER_TOKEN
        sync: false
      - key: SENDGRID_API_KEY
        sync: false

  - type: worker
    name: advergent-worker
    env: node
    plan: standard
    buildCommand: cd apps/api && npm install && npm run build
    startCommand: node apps/api/dist/workers/index.js
    envVars:
      - fromService:
          type: web
          name: advergent-api
          envVarKey: DATABASE_URL
      # duplicate other secrets or use Render Shared Environment Groups

  - type: static_site
    name: advergent-web
    buildCommand: cd apps/web && npm install && npm run build
    publishPath: apps/web/dist
    envVars:
      - key: VITE_API_URL
        value: https://advergent-api.onrender.com
```

*Note*: Render’s worker will run BullMQ schedulers and workers (no serverless limitations). Use Render Cron jobs if you want OS-level scheduling; otherwise rely on the distributed scheduler (see below).

---

## BULLMQ & DISTRIBUTED SCHEDULER

Use Upstash Redis + BullMQ with Redis `SETNX` leader election (see `apps/api/src/workers/scheduler.ts` snippet from previous prompt). Ensure scheduler only runs inside the worker process on Render (set `RUN_SCHEDULER=true` env var).

---

## CLAUDE AI ANALYZER

Use the same robust implementation provided earlier (Zod validation, retry logic, encrypted snapshot storage). Update logging references to Render instead of Vercel.

---

## SECURITY REQUIREMENTS

1. **Token Encryption**: AES-256-GCM via AWS KMS-managed data keys. All OAuth refresh/access tokens and Claude data snapshots must be encrypted before storing in Postgres.
2. **Password Hashing**: bcrypt with 12 rounds, algorithm + cost stored per user for future upgrades.
3. **Session Management**: Access token 15 minutes, refresh 7 days; rotation on every refresh. Sessions tied to DB record so revocation works even if JWT is copied.
4. **Leader Election**: Use Redis key `scheduler:leader` to prevent duplicate cron job execution.
5. **Input Validation**: Zod for all incoming payloads and external service responses.
6. **Logging**: Structured Pino logs with redaction; no secrets in logs.

---

## FRONTEND CONFIG (Vite)

Use the same Vite/Tailwind configs described previously. Ensure `VITE_API_URL` defaults to `http://localhost:3001` for dev and Render URL for prod. Proxy `/api` to local backend in `vite.config.ts`.

---

## ROOT PACKAGE SCRIPTS

```json
{
  "name": "advergent",
  "private": true,
  "workspaces": ["apps/*", "packages/*"],
  "scripts": {
    "dev": "concurrently \"npm run dev:api\" \"npm run dev:web\"",
    "dev:api": "cd apps/api && npm run dev",
    "dev:web": "cd apps/web && npm run dev",
    "build": "npm run build --workspaces",
    "lint": "npm run lint --workspaces",
    "type-check": "npm run type-check --workspaces"
  },
  "devDependencies": {
    "concurrently": "^8.2.2",
    "typescript": "^5.3.3"
  }
}
```

---

## ENVIRONMENT VARIABLES

`apps/api/.env.example`

```
NODE_ENV=development
PORT=3001

# Supabase Postgres
DATABASE_URL=postgresql://user:password@db.supabase.co:5432/advergent?sslmode=require

# Redis
UPSTASH_REDIS_URL=https://your-url.upstash.io
UPSTASH_REDIS_TOKEN=your-token

# Auth
JWT_SECRET=change-me
COOKIE_SECRET=change-me

# Frontend URL
FRONTEND_URL=http://localhost:5173

# Google OAuth / Ads
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
GOOGLE_REDIRECT_URI=http://localhost:3001/api/google/callback
GOOGLE_ADS_DEVELOPER_TOKEN=...

# Anthropic
ANTHROPIC_API_KEY=...

# AWS KMS
AWS_REGION=ap-southeast-2
AWS_ACCESS_KEY_ID=...
AWS_SECRET_ACCESS_KEY=...
KMS_KEY_ID=...

# Email
RESEND_API_KEY=...

# Feature Flags
USE_MOCK_GOOGLE_APIS=true
RUN_SCHEDULER=true
```

`apps/web/.env.example`

```
VITE_API_URL=http://localhost:3001
VITE_ENV=development
```

---

## DOCKER COMPOSE (DEV)

```yaml
version: '3.8'
services:
  postgres:
    image: postgres:15-alpine
    environment:
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
      POSTGRES_DB: advergent_dev
    ports: ["5432:5432"]
    volumes:
      - postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres"]
      interval: 10s
      timeout: 5s
      retries: 5

  redis:
    image: redis:7-alpine
    ports: ["6379:6379"]
    volumes:
      - redis_data:/data
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 10s
      timeout: 3s
      retries: 5

volumes:
  postgres_data:
  redis_data:
```

---

## COMPLETE DATABASE SCHEMA

(Use the schema from the previous message; ensure it reflects encryption fields, sessions, recommendations, competitors, etc. Replace Neon-specific comments with Supabase references. Keep indexes identical.)

---

## IMPLEMENTATION PHASES

### Week 1 – Foundation
1. Initialize monorepo + workspaces
2. Scaffold Vite frontend, Express backend
3. Configure ESLint/Prettier, Pino logging
4. Connect to local Postgres (Docker) + Supabase (env)
5. Implement auth (signup/login), bcrypt hashing, JWT rotation
6. Protected routes + session middleware

### Week 2 – Google OAuth & Data Sync
1. OAuth credential flow
2. Token encryption service (KMS)
3. Google Ads + Search Console service skeletons
4. Mock services + fixtures for offline dev

### Week 3 – Query Matching & AI
1. Query normalization + hashing
2. Claude integration with Zod validation
3. Recommendation storage with encrypted snapshots

### Week 4 – Workers & Scheduling
1. BullMQ + Upstash Redis integration
2. Distributed scheduler with leader election
3. Sync worker, analysis worker, competitor worker
4. Render worker deployment (RUN_SCHEDULER flag)

### Week 5 – Frontend MVP
1. Onboarding flow, dashboards, recommendation list/detail
2. Hook up TanStack Query + API client interceptors
3. Approve/reject recommendation actions

### Week 6 – Polish & Deploy
1. Error handling, skeleton states, toasts
2. Build & deploy to Render (web/api/worker)
3. Wire Supabase + Upstash production envs
4. Smoke tests with real Google accounts

### Weeks 7–8 – Competitor Intelligence (Phase 2)
1. Auction Insights integration
2. Competitor dashboards + alerts
3. Surface competitive context in AI prompts

---

## SUCCESS CRITERIA

**MVP**
1. Agencies can sign up, onboard, and add clients
2. Google Ads + Search Console connections succeed (tokens stored encrypted)
3. Daily sync pulls data and generates Claude recommendations
4. Recommendations visible + actionable in dashboard
5. Approval/reject flow updates recommendation status
6. BullMQ scheduler runs exactly once per day per client (leader election working)

**Phase 2**
1. Competitors auto-detected via Auction Insights
2. Competitive metrics appear inside recommendations
3. Alerts trigger for significant competitor changes

---

## CRITICAL NOTES FOR THE AI AGENT

1. **Use TypeScript everywhere**
2. **Follow coding best practices**—clean abstractions, meaningful naming, modular files, minimal duplication, defensive error handling, and unit tests for non-trivial logic.
3. **Stay modular**—if any file approaches ~500 lines, split logic into smaller hooks/orchestrators/services. Reuse shared utilities, avoid copy/paste, and keep components focused on a single concern.
4. **Consistent naming conventions**—use `camelCase` for variables/functions, `PascalCase` for classes/types/components, and `snake_case` only for SQL identifiers or environment variable keys. Enforce lint rules accordingly.
5. **Add Pino logging to all async operations**
6. **Encrypt tokens before writing to DB**
7. **Store JWTs in HTTP-only cookies; rotate refresh tokens**
8. **Implement mock Google services to unblock development**
9. **Ensure workers are Render-friendly (long-running, not serverless)**
10. **Validate every request/response with Zod**
11. **Rate limit Google & Claude APIs**
12. **Document key decisions in README**
13. **Security first—no plain text secrets, sanitize inputs**

---

## NEXT STEPS

1. Scaffold monorepo structure + configs
2. Set up Tailwind, shadcn/ui, ESLint/Prettier
3. Implement backend foundation (auth, logging, db)
4. Create migrations for full schema
5. Wire encryption/password services
6. Build OAuth + data sync services (mock first)
7. Integrate Claude + BullMQ workers
8. Build frontend flows
9. Deploy to Render (web/api/worker) + configure Supabase & Upstash
10. Run end-to-end onboarding + sync test before launch
