# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Advergent** is an SEO-PPC optimization platform for digital marketing agencies. It identifies Google Ads spend overlap with organic search rankings and delivers AI-powered recommendations using Claude Sonnet 4. The platform integrates with Google Ads API and Search Console to analyze query performance across paid and organic channels.

### Core Value Proposition

Automatically detect when agencies are paying for Google Ads clicks they could capture organically and surface AI recommendations that consider competitive dynamics, SERP features, conversion quality, and user intent.

### Target Customer

Digital marketing agencies (10–50+ active clients) such as Overdose Digital, Rise Interactive, etc.

### Key Differentiators

- **AI-powered recommendations** (actionable, not just reports)
- **Agency-focused portfolio management** (multi-client view)
- **Competitive intelligence** (auction insights, alerts)
- **Continuous monitoring** (daily sync + alerts)

### Pricing Tiers

- **Starter** – $299/mo (5 clients)
- **Growth** – $699/mo (15 clients)
- **Agency** – $1,499/mo (40 clients)

## Monorepo Structure

This is a workspace-based monorepo with three main packages:

- `apps/web` - React + Vite frontend (TypeScript)
- `apps/api` - Express backend (TypeScript, ES modules)
- `packages/shared` - Shared types and utilities

The project uses npm workspaces (not Turborepo despite turbo.json existing).

## Development Commands

### Initial Setup
```bash
# Install all dependencies
npm install

# Copy environment files
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env

# Start local Postgres + Redis
docker-compose up -d
```

### Development
```bash
# Run both frontend and backend concurrently
npm run dev

# Run only backend (port 3001)
npm run dev:api
# or: cd apps/api && npm run dev

# Run only frontend (port 5173)
npm run dev:web
# or: cd apps/web && npm run dev
```

### Building & Type Checking
```bash
# Build all workspaces
npm run build

# Type check all workspaces
npm run type-check

# Lint all workspaces
npm run lint
```

### Database Migrations
```bash
cd apps/api
npm run migrate          # Run pending migrations
npm run migrate:down     # Rollback last migration
```

## Architecture Overview

### Backend (apps/api)

**Key architectural patterns:**

1. **ES Modules** - The API uses `"type": "module"` in package.json. All imports must use file extensions or path aliases (configured with TypeScript path mapping using `@/` prefix).

2. **Path Aliases** - Use `@/` for all internal imports:
   - `@/config` → `src/config`
   - `@/middleware` → `src/middleware`
   - `@/services` → `src/services`
   - etc.

3. **Database Access** - Single `pg` Pool instance exported from `apps/api/src/db/index.ts`. All queries go through the `query()` helper function which provides logging and error handling.

4. **Authentication** - JWT-based auth with:
   - Access tokens (15 min) + refresh tokens (7 days)
   - HTTP-only cookies for token storage
   - Session table for revocation support
   - Middleware: `authenticate` from `@/middleware/auth.middleware`

5. **Service Layer Pattern**:
   - `google-ads.service.ts` + `google-ads.service.mock.ts` (mock used when `USE_MOCK_GOOGLE_APIS=true`)
   - `search-console.service.ts` + `search-console.service.mock.ts`
   - `query-matcher.service.ts` - Query normalization and hashing (MD5)
   - `ai-analyzer.service.ts` - Claude integration with Zod validation
   - `encryption.service.ts` - AES-256-GCM via AWS KMS for OAuth tokens
   - `password.service.ts` - bcrypt hashing (12 rounds)

6. **Background Jobs** - Render Cron Jobs:
   - `jobs/daily-sync.ts` - Daily data sync at 2 AM UTC via Render cron service
   - Manual syncs via `POST /api/clients/:id/sync` endpoint (fire-and-forget async)
   - `services/client-sync.service.ts` - Shared sync logic used by both cron and manual triggers
   - No queue system - direct function calls with throwing error contract
   - Sequential client processing (parallelization can be added if needed)
   - Job status tracked in `sync_jobs` table with concurrency guard
   - Stale job cleanup runs before each daily sync

7. **Logging** - Pino structured logging:
   - `@/utils/logger` exports multiple named loggers (logger, aiLogger, workerLogger)
   - Request logging via `pino-http` middleware
   - Pretty printing in development

8. **Security**:
   - Helmet for HTTP headers
   - CORS configured for frontend URL only
   - All external API tokens encrypted before DB storage
   - Input validation with Zod schemas
   - Signed cookies via `cookie-parser`

**Routes structure:**
- `/api/auth` - Public signup/login
- `/api/agency` - Protected, agency management
- `/api/clients` - Protected, client CRUD + onboarding
- `/api/recommendations` - Protected, AI recommendations
- `/api/competitors` - Protected, competitor insights
- `/api/google` - Protected, OAuth callback + token refresh

### Frontend (apps/web)

**Key patterns:**

1. **Routing** - React Router v6 with pages in `src/pages/`
2. **State Management** - TanStack Query v5 for server state
3. **Forms** - React Hook Form + Zod validation
4. **UI Components** - shadcn/ui (Radix primitives + Tailwind)
5. **API Client** - Axios instance in `src/lib/api.ts` with interceptor for credentials
6. **Hooks** - Custom hooks in `src/hooks/`:
   - `useAuth.ts` - Auth state + login/logout
   - `useClient.ts` - Client data fetching
   - `useRecommendations.ts` - Recommendations with filters

**Page structure:**
- `Login.tsx` / `Signup.tsx` - Public auth pages
- `Dashboard.tsx` - Agency overview, client portfolio cards, aggregate metrics
- `Onboarding.tsx` - Google OAuth flow + client setup wizard
- `ClientDetail.tsx` - Individual client view with query overlaps, spend trends
- `Recommendations.tsx` - List view with filters (type, confidence, status)
- `Competitors.tsx` - Competitor insights from Auction Insights (Phase 2)

**Component organization:**
- `components/ui/` - shadcn/ui primitives (Button, Dialog, Select, Toast, etc.)
- `components/auth/` - Login/signup forms
- `components/onboarding/` - Multi-step onboarding wizard
- `components/dashboard/` - Client cards, aggregate charts
- `components/clients/` - Client detail views
- `components/recommendations/` - Recommendation cards, filters, detail modals

**Environment variables:**
- `VITE_API_URL` - Backend URL (defaults to `http://localhost:3001` in dev)

### Shared Package (packages/shared)

- Common TypeScript types exported via `src/types/index.ts`
- Shared utilities in `src/utils/index.ts`
- Consumed by both frontend and backend

## Critical Implementation Details

### Query Matching System

Queries are normalized and hashed for deduplication:
```typescript
// apps/api/src/services/query-matcher.service.ts
normalizeQuery() // lowercase, strip special chars, normalize whitespace
hashQuery()      // MD5 hash for fast lookups
```

Matching logic compares Google Ads queries against Search Console queries to identify paid/organic overlap.

### AI Analysis Flow

1. Worker pulls Google Ads + Search Console data for a client
2. `query-matcher.service` identifies overlapping queries
3. `ai-analyzer.service` sends data to Claude Sonnet 4
4. Claude returns structured JSON (validated with Zod)
5. Recommendations stored with encrypted snapshot in DB

**Claude Analysis Process:**
- Uses Anthropic SDK with Claude Sonnet 4 model
- Input data includes: query text, Google Ads metrics (CPC, spend, conversions), Search Console metrics (position, CTR, impressions)
- Prompt instructs Claude to consider: competitive dynamics, SERP features, conversion quality, user intent
- Response validated with strict Zod schema before database storage
- Retry logic with exponential backoff for API failures
- Encrypted snapshot of request/response stored for audit trail and provenance

**Response schema (Zod validated):**
```typescript
{
  recommendation_type: 'reduce' | 'pause' | 'increase' | 'maintain',
  confidence_level: 'high' | 'medium' | 'low',
  current_monthly_spend: number,
  recommended_monthly_spend: number,
  estimated_monthly_savings: number,
  reasoning: string,
  key_factors: string[]
}
```

**Critical implementation notes:**
- Always validate Claude responses with Zod before storing
- Store encrypted snapshot in `recommendations.encrypted_snapshot` for audit
- Log all AI interactions with `aiLogger` from `@/utils/logger`
- Implement retry logic (3 attempts with exponential backoff)
- Respect Anthropic rate limits

### Mock Services for Development

When `USE_MOCK_GOOGLE_APIS=true`:
- `google-ads.service.mock.ts` returns fixture data from `fixtures/google-ads-sample.json`
- `search-console.service.mock.ts` returns fixture data from `fixtures/search-console-sample.json`

This allows frontend/backend development without real Google credentials.

## Deployment (Render)

Configured in `render.yaml`:

1. **Web Service** - Express API (apps/api)
   - Build: `cd apps/api && npm install && npm run build`
   - Start: `node dist/server.js`
   - Auto-deployment on push

2. **Cron Job Service** - Daily sync
   - Build: same as web service
   - Schedule: `0 2 * * *` (2 AM UTC)
   - Command: `node dist/jobs/daily-sync.js`
   - Runs independently of web service
   - Includes stale job cleanup before each run

3. **Static Site** - React frontend
   - Build: `cd apps/web && npm install && npm run build`
   - Publish: `dist/` directory

**External services:**
- Database: Supabase Postgres (with Timescale extension)
- AI: Anthropic Claude API
- Email: Resend
- Encryption: AWS KMS

## Tech Stack Details

### Frontend Stack
- **Framework**: React 18+ with Vite 5+
- **Language**: TypeScript 5+
- **Styling**: TailwindCSS 3+
- **UI Kit**: shadcn/ui (Radix primitives)
- **State**: TanStack Query v5
- **Routing**: React Router v6
- **Forms**: React Hook Form + Zod
- **Charts**: Recharts
- **Dates**: date-fns
- **Logging**: Pino browser logger

### Backend Stack
- **Runtime**: Node.js 20+
- **Framework**: Express.js (TypeScript, ES modules)
- **Auth**: JWT (access 15m + refresh 7d) in HTTP-only cookies, session table
- **Validation**: Zod schemas everywhere
- **Logging**: Pino (pino-http + pino-pretty in dev)
- **Security**: AES-256-GCM encryption (KMS managed keys), bcrypt (12 rounds)

### Database & Infrastructure
- **Primary DB**: Supabase Postgres 15 with Timescale extension
- **Access**: `pg` Pool over SSL
- **Migrations**: node-pg-migrate
- **Hosting**: Render (web service + cron job + static site)
- **Email**: Resend

## Code Conventions

1. **TypeScript everywhere** - Strict mode enabled
2. **Naming**:
   - `camelCase` for variables/functions
   - `PascalCase` for classes/types/React components
   - `snake_case` for SQL columns and env vars
3. **Imports** - Use path aliases (`@/` in backend, relative paths in frontend)
4. **Error handling** - All async operations wrapped in try/catch with Pino logging
5. **Validation** - Zod schemas for all API requests/responses
6. **Modular code** - If any file approaches ~500 lines, split into smaller modules
7. **Clean abstractions** - Meaningful naming, minimal duplication, defensive error handling
8. **Comments** - JSDoc for public functions, inline comments for complex logic

## Environment Variables

### Backend (apps/api/.env)
```
NODE_ENV=development
PORT=3001
DATABASE_URL=postgresql://...
CLERK_PUBLISHABLE_KEY=...
CLERK_SECRET_KEY=...
COOKIE_SECRET=...
FRONTEND_URL=http://localhost:5173
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
GOOGLE_REDIRECT_URI=http://localhost:3001/api/google/callback
GOOGLE_ADS_DEVELOPER_TOKEN=...
ANTHROPIC_API_KEY=...
ENCRYPTION_MASTER_KEY=...
AWS_REGION=ap-southeast-2
AWS_ACCESS_KEY_ID=...
AWS_SECRET_ACCESS_KEY=...
KMS_KEY_ID=...
RESEND_API_KEY=...
USE_MOCK_GOOGLE_APIS=true
```

### Frontend (apps/web/.env)
```
VITE_API_URL=http://localhost:3001
VITE_ENV=development
```

## Critical Implementation Guidelines

These guidelines come from PROMPT.md and must be followed:

1. **TypeScript everywhere** - No JavaScript files
2. **Follow coding best practices** - Clean abstractions, meaningful naming, modular files, minimal duplication, defensive error handling
3. **Stay modular** - If any file approaches ~500 lines, split logic into smaller hooks/orchestrators/services
4. **Consistent naming conventions** - Enforce via ESLint
5. **Add Pino logging to all async operations** - Use appropriate logger (logger, aiLogger, syncLogger, workerLogger)
6. **Encrypt tokens before writing to DB** - Use `encryption.service.ts` with KMS
7. **Store JWTs in HTTP-only cookies; rotate refresh tokens** - Never expose tokens to client JS
8. **Implement mock Google services to unblock development** - Use `USE_MOCK_GOOGLE_APIS=true` for local dev
9. **Validate every request/response with Zod** - No unvalidated data
10. **Rate limit Google & Claude APIs** - Implement backoff and respect quotas
11. **Security first** - No plain text secrets, sanitize inputs, redact logs

## Key Files to Reference

- `PROMPT.md` - Complete product specification and implementation roadmap (560 lines of detailed requirements)
- `apps/api/src/server.ts` - Express app configuration
- `apps/api/src/db/index.ts` - Database client with connection pooling
- `apps/api/src/jobs/daily-sync.ts` - Daily cron job for scheduled syncs
- `apps/api/src/services/client-sync.service.ts` - Shared sync logic for scheduled and manual syncs
- `apps/api/src/services/ai-analyzer.service.ts` - Claude integration
- `apps/api/src/services/encryption.service.ts` - KMS encryption (not yet implemented)
- `apps/api/src/services/password.service.ts` - bcrypt password hashing (not yet implemented)
- `apps/web/src/lib/api.ts` - Frontend API client

## Database Schema Overview

The database uses Supabase Postgres with Timescale extension enabled. Key tables:

### Core Tables
- **agencies** - Agency accounts with billing tier (starter/growth/agency) and client limits
- **users** - Agency staff with role-based access (owner/admin/member)
- **sessions** - JWT session tracking for revocation support
- **client_accounts** - Individual client profiles with Google account IDs
- **encryption_keys** - KMS-managed data encryption keys per client

### Data Sync Tables
- **search_queries** - Normalized queries with MD5 hash for deduplication
- **google_ads_queries** - Raw Google Ads performance data
- **search_console_queries** - Raw Search Console performance data
- **query_overlaps** - Detected paid/organic overlaps for analysis

### Recommendations & Competitors
- **recommendations** - AI-generated recommendations with encrypted Claude snapshot
  - Fields: `recommendation_type` (reduce/pause/increase/maintain), `confidence_level`, spend amounts
  - Status: pending → approved → applied or rejected
  - Provenance: stores encrypted snapshot of data sent to Claude for audit
- **competitors** - Detected via Auction Insights
- **competitor_metrics** - Time-series competitive data (using Timescale)

### Job Tracking
- **sync_jobs** - Tracks daily sync execution per client
- **analysis_jobs** - Tracks AI analysis runs

**Important schema notes:**
- All OAuth tokens stored encrypted via `encryption_keys` table
- Passwords hashed with bcrypt (12 rounds), algorithm version stored per user
- Timescale hypertables used for time-series data (metrics, performance data)
- Indexes on query_hash, client_account_id, and timestamps for performance

## Security Implementation Requirements

1. **Token Encryption** - AES-256-GCM via AWS KMS-managed data keys. All OAuth refresh/access tokens and Claude data snapshots must be encrypted before storing in Postgres.

2. **Password Hashing** - bcrypt with 12 rounds, algorithm + cost stored per user for future upgrades.

3. **Session Management** - Access token 15 minutes, refresh 7 days; rotation on every refresh. Sessions tied to DB record so revocation works even if JWT is copied.

4. **Input Validation** - Zod for all incoming payloads and external service responses (Google APIs, Claude API).

5. **Logging Security** - Structured Pino logs with redaction of sensitive fields (tokens, passwords, encrypted_payload, etc.). No secrets in logs.

6. **Rate Limiting** - Respect Google API and Claude API rate limits to prevent service interruption.

## Implementation Phases (from PROMPT.md)

### Week 1 – Foundation
- Initialize monorepo + workspaces
- Scaffold Vite frontend, Express backend
- Configure ESLint/Prettier, Pino logging
- Connect to local Postgres (Docker) + Supabase (env)
- Implement auth (signup/login), bcrypt hashing, JWT rotation
- Protected routes + session middleware

### Week 2 – Google OAuth & Data Sync
- OAuth credential flow
- Token encryption service (KMS)
- Google Ads + Search Console service skeletons
- Mock services + fixtures for offline dev

### Week 3 – Query Matching & AI
- Query normalization + hashing
- Claude integration with Zod validation
- Recommendation storage with encrypted snapshots

### Week 4 – Scheduling & Background Jobs
- Render Cron Jobs for daily syncs
- Client sync service for reusable sync logic
- Manual sync endpoint with fire-and-forget execution
- Database-level concurrency control for sync jobs

### Week 5 – Frontend MVP
- Onboarding flow, dashboards, recommendation list/detail
- Hook up TanStack Query + API client interceptors
- Approve/reject recommendation actions

### Week 6 – Polish & Deploy
- Error handling, skeleton states, toasts
- Build & deploy to Render (web/api/cron job)
- Wire Supabase production envs
- Smoke tests with real Google accounts

### Weeks 7–8 – Competitor Intelligence (Phase 2)
- Auction Insights integration
- Competitor dashboards + alerts
- Surface competitive context in AI prompts

## Success Criteria

### MVP (Minimum Viable Product)
1. Agencies can sign up, onboard, and add clients
2. Google Ads + Search Console connections succeed (tokens stored encrypted)
3. Daily sync pulls data and generates Claude recommendations
4. Recommendations visible + actionable in dashboard
5. Approval/reject flow updates recommendation status
6. Render cron job runs daily syncs successfully with concurrency control

### Phase 2 (Competitive Intelligence)
1. Competitors auto-detected via Auction Insights
2. Competitive metrics appear inside recommendations
3. Alerts trigger for significant competitor changes

## Testing

Currently no test framework is configured. Tests should be added in future iterations following the naming convention `*.test.ts` or `*.spec.ts`.

**When adding tests:**
- Use `vitest` for both frontend and backend (Vite-native)
- Mock external APIs (Google Ads, Search Console, Claude)
- Test critical paths: auth flow, encryption/decryption, query matching, recommendation generation
