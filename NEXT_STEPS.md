# Advergent - Next Implementation Steps

## Current Status (as of 2025-11-16)

### ✅ Completed:
1. **Project structure** - Monorepo with npm workspaces (apps/api, apps/web, packages/shared)
2. **Database schema** - All 15 tables created successfully in Supabase (run via SQL Editor)
3. **Encryption service** - Switched from AWS KMS to master key encryption (simpler, no external deps)
4. **Configuration** - All environment variables set up with real credentials
5. **Dependencies** - All npm packages installed
6. **Mock services** - Google Ads and Search Console mock services with fixtures
7. **Workers skeleton** - BullMQ + Redis scheduler with leader election pattern

### 🔄 Current Blocker:
**Supabase connection pooler issues** - Both transaction and session poolers are timing out with authentication errors. The database schema was successfully created via Supabase SQL Editor, but programmatic connections from the CLI are failing with queue timeouts.

**Root cause:** Supabase's pooler (Supavisor) is experiencing queue timeouts on both ports (5432 session mode, 6543 transaction mode). This appears to be either:
- Database cold-start issue (free tier auto-pauses)
- Pool size too small for current load
- IPv4/IPv6 network configuration issue

**Connection string tried:**
```
postgresql://postgres.tvyjtezcourgfvuztwek:G3uhPj8mFs8vdKLS@aws-1-ap-south-1.pooler.supabase.com:6543/postgres
```

### 📋 Immediate Next Steps:

#### Option A: Troubleshoot Supabase Connection (Recommended First)
1. **Check Supabase dashboard** for pooler metrics:
   - Go to: Database → Settings → Connection pooling configuration
   - Increase pool size if needed (default might be too small)
   - Check Pooler Logs for queue backup issues

2. **Verify database is not paused:**
   - Free tier databases auto-pause after inactivity
   - Check dashboard for "Project paused" message
   - If paused, restore and wait 1-2 minutes

3. **Try direct connection if IPv6 is available:**
   - Test: `curl -6 https://ipv6.icanhazip.com`
   - If IPv6 works, use: `db.tvyjtezcourgfvuztwek.supabase.co:5432`

4. **Consider upgrading Supabase plan:**
   - Free tier has limited pooler capacity
   - Pro plan ($25/mo) has better pooler performance

#### Option B: Continue Development (If Connection Can't Be Fixed Immediately)
Since the schema is already created via SQL Editor, you can proceed with implementing features and test them once the connection is stable:

1. **Implement Authentication Endpoints** (`apps/api/src/routes/auth.routes.ts`)
   - Signup: Hash password → Create agency → Create user → Generate JWT → Set cookies
   - Login: Verify password → Create session → Generate JWT → Set cookies
   - Logout: Revoke session in database
   - /me: Return current user from session

2. **Implement Google OAuth Flow** (`apps/api/src/routes/google-oauth.routes.ts`)
   - OAuth redirect to Google consent screen
   - Callback handler to exchange code for tokens
   - Encrypt tokens before storing in database
   - Handle scope validation (Google Ads + Search Console)

3. **Implement Query Matching Logic** (`apps/api/src/services/query-matcher.service.ts`)
   - Complete `matchQueries()` function
   - Compare Google Ads queries vs Search Console queries
   - Create query_overlaps records
   - Return overlaps for AI analysis

4. **Implement AI Analysis Pipeline** (`apps/api/src/services/ai-analyzer.service.ts`)
   - Complete `analyzeQuery()` function
   - Pull Google Ads + Search Console data
   - Send to Claude Sonnet 4 with structured prompt
   - Validate response with Zod
   - Encrypt snapshot and store recommendation

5. **Implement Sync Worker** (`apps/api/src/workers/sync.worker.ts`)
   - Pull client list from database
   - Fetch Google Ads data (or use mocks with USE_MOCK_GOOGLE_APIS=true)
   - Fetch Search Console data
   - Run query matching
   - Trigger AI analysis
   - Update sync_jobs status

6. **Build Frontend Auth UI** (`apps/web/src/pages/`)
   - Login.tsx - Form with React Hook Form + Zod
   - Signup.tsx - Registration form
   - Dashboard.tsx - Client portfolio cards
   - Use TanStack Query hooks already created

### 🔧 Technical Notes:

**Database Connection String Formats:**
- Transaction pooler (6543): Best for migrations, serverless functions
- Session pooler (5432): For long-lived connections, requires IPv4
- Direct (5432): Requires IPv6 or paid IPv4 add-on

**Current .env Configuration:**
```bash
DATABASE_URL=postgresql://postgres.tvyjtezcourgfvuztwek:G3uhPj8mFs8vdKLS@aws-1-ap-south-1.pooler.supabase.com:6543/postgres
ENCRYPTION_MASTER_KEY=afbe8848c5f85e2814092922abdda97a1e274a93faf2ca77de5092046c6d525a
GOOGLE_CLIENT_ID=1091129446858-3q3t6jdnd00utvp9uealbktq6e6d1kp7.apps.googleusercontent.com
GOOGLE_ADS_DEVELOPER_TOKEN=fFQfLwXq76QExj_cVtuApA
ANTHROPIC_API_KEY=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
```

**Migration Files Location:**
- `apps/api/migrations/1700000001_initial_schema.sql` (applied via SQL Editor)
- `apps/api/migrations/1700000002_create_materialized_views.sql` (applied via SQL Editor)
- `complete_migration.sql` (combined version in project root)

**Key Implementation References:**
- PROMPT.md - Complete specification (560 lines)
- CLAUDE.md - Architecture guide and conventions
- apps/api/src/services/password.service.ts - bcrypt hashing (implemented)
- apps/api/src/services/encryption.service.ts - AES-256-GCM (implemented)
- apps/api/src/utils/logger.ts - Pino structured logging (configured)

### 🎯 Recommended Approach:

**Start with authentication implementation** since it doesn't require database writes initially (you can test logic separately). Once the Supabase connection is stable, you can test the full flow end-to-end.

Use `USE_MOCK_GOOGLE_APIS=true` flag to develop Google integrations without real API calls.

Focus on critical path: Auth → OAuth → Query Matching → AI Analysis → Frontend

---
Generated: 2025-11-16
