# Migration Task: Switch from Supabase to Neon + Add Drizzle ORM

## Objective
Migrate the Advergent database from Supabase (IPv6-only, connection issues) to Neon (IPv4 compatible) and add Drizzle ORM for type-safe database schema management and queries.

## Current State
- **Database**: Supabase (tvyjtezcourgfvuztwek.supabase.co) - IPv6 only, pooler authentication timeouts
- **Schema Management**: node-pg-migrate with raw SQL migrations
- **Query Method**: Direct `pg` queries using `apps/api/src/db/index.ts`
- **Schema**: 15 tables already defined in `complete_migration.sql` (agencies, users, user_sessions, client_accounts, search_queries, google_ads_queries, search_console_queries, query_overlaps, recommendations, competitors, competitor_metrics, sync_jobs, analysis_jobs, + 2 materialized views)

## Why This Change?

### Problem with Current Setup:
1. **Supabase Free tier is IPv6-only** - requires paid IPv4 add-on ($25/mo)
2. **Connection pooler constantly times out** - authentication errors, queue timeouts
3. **No local development** - can't connect from IPv4-only networks
4. **Raw SQL migrations** - no type safety, manual query building

### Benefits of Neon + Drizzle:
1. **Neon**: IPv4 support on free tier, better serverless architecture, instant wake-up, reliable connection pooling
2. **Drizzle**: Type-safe schema definitions, automatic TypeScript types, migration generation, query builder with IntelliSense
3. **Developer Experience**: Schema changes auto-generate TypeScript types, compile-time query validation
4. **Migration Path**: Can keep existing schema, just convert SQL → Drizzle schema definitions

## Implementation Steps

### Phase 1: Set Up Neon Database (10 minutes)

#### 1.1 Create Neon Account & Project
- Go to https://neon.tech
- Sign up (free, no credit card)
- Create project: "Advergent"
- Region: Choose closest (US East, EU West, etc.)
- Postgres version: 16 (latest)

#### 1.2 Get Connection String
Neon provides a connection string like:
```
postgresql://username:password@ep-cool-meadow-123456.us-east-2.aws.neon.tech/neondb?sslmode=require
```

Save this for later.

#### 1.3 Update Environment Variables
Update `apps/api/.env`:
```bash
# Replace Supabase connection with Neon
DATABASE_URL=postgresql://[NEON_CONNECTION_STRING]
```

### Phase 2: Install & Configure Drizzle (15 minutes)

#### 2.1 Install Dependencies
```bash
cd apps/api
npm install drizzle-orm postgres
npm install -D drizzle-kit
```

#### 2.2 Create Drizzle Configuration
Create `apps/api/drizzle.config.ts`:
```typescript
import type { Config } from 'drizzle-kit';
import * as dotenv from 'dotenv';

dotenv.config();

export default {
  schema: './src/db/schema.ts',
  out: './drizzle',
  driver: 'pg',
  dbCredentials: {
    connectionString: process.env.DATABASE_URL!,
  },
  verbose: true,
  strict: true,
} satisfies Config;
```

#### 2.3 Convert SQL Schema to Drizzle Schema
Create `apps/api/src/db/schema.ts`:

This is the **main task** - convert all 15 tables from `complete_migration.sql` into Drizzle schema definitions.

**Template structure:**
```typescript
import { pgTable, uuid, varchar, timestamp, integer, text, boolean, date, decimal, bigint, check, index, uniqueIndex, pgEnum } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

// Enums
export const billingTierEnum = pgEnum('billing_tier', ['starter', 'growth', 'agency']);
export const roleEnum = pgEnum('role', ['owner', 'admin', 'member']);
// ... other enums

// Tables
export const agencies = pgTable('agencies', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: varchar('name', { length: 255 }).notNull(),
  billingTier: billingTierEnum('billing_tier').notNull(),
  clientLimit: integer('client_limit').notNull(),
  stripeCustomerId: varchar('stripe_customer_id', { length: 255 }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
}, (table) => ({
  billingTierIdx: index('idx_agencies_billing_tier').on(table.billingTier),
  stripeCustomerIdx: index('idx_agencies_stripe_customer_id').on(table.stripeCustomerId),
}));

export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  agencyId: uuid('agency_id').notNull().references(() => agencies.id, { onDelete: 'cascade' }),
  email: varchar('email', { length: 255 }).notNull().unique(),
  name: varchar('name', { length: 255 }).notNull(),
  passwordHash: text('password_hash').notNull(),
  passwordAlgorithm: varchar('password_algorithm', { length: 20 }).notNull().default('bcrypt'),
  passwordCost: integer('password_cost').notNull().default(12),
  role: roleEnum('role').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
}, (table) => ({
  agencyIdx: index('idx_users_agency_id').on(table.agencyId),
  emailIdx: index('idx_users_email').on(table.email),
}));

// Relations
export const agenciesRelations = relations(agencies, ({ many }) => ({
  users: many(users),
  clientAccounts: many(clientAccounts),
}));

export const usersRelations = relations(users, ({ one, many }) => ({
  agency: one(agencies, {
    fields: [users.agencyId],
    references: [agencies.id],
  }),
  sessions: many(userSessions),
}));

// ... Continue for all 15 tables
```

**Tables to convert:**
1. agencies ✓ (example above)
2. users ✓ (example above)
3. user_sessions
4. client_accounts
5. search_queries
6. google_ads_queries
7. search_console_queries
8. query_overlaps
9. recommendations
10. competitors
11. competitor_metrics
12. sync_jobs
13. analysis_jobs

**Note:** Materialized views (`google_ads_daily_summary`, `search_console_daily_summary`) will still need raw SQL - Drizzle doesn't have native materialized view support. Keep these in a separate migration file.

#### 2.4 Update Database Client
Replace `apps/api/src/db/index.ts` with Drizzle client:

```typescript
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';
import { dbLogger } from '@/utils/logger';

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL is required');
}

// Create postgres.js client
const queryClient = postgres(process.env.DATABASE_URL, {
  max: 10,
  idle_timeout: 30,
  onnotice: (notice) => dbLogger.debug({ notice }, 'postgres notice'),
});

// Create Drizzle instance with schema
export const db = drizzle(queryClient, { schema, logger: true });

// Export schema for use in queries
export * from './schema';

// Helper for raw queries (when needed)
export const rawQuery = queryClient;
```

#### 2.5 Update package.json Scripts
Add to `apps/api/package.json`:
```json
{
  "scripts": {
    "db:generate": "drizzle-kit generate:pg",
    "db:push": "drizzle-kit push:pg",
    "db:studio": "drizzle-kit studio",
    "db:migrate": "tsx src/db/migrate.ts"
  }
}
```

Create `apps/api/src/db/migrate.ts`:
```typescript
import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';
import { logger } from '@/utils/logger';

async function runMigrations() {
  const migrationClient = postgres(process.env.DATABASE_URL!, { max: 1 });
  const db = drizzle(migrationClient);
  
  logger.info('Running migrations...');
  await migrate(db, { migrationsFolder: './drizzle' });
  logger.info('Migrations complete');
  
  await migrationClient.end();
}

runMigrations().catch((err) => {
  logger.error({ err }, 'Migration failed');
  process.exit(1);
});
```

### Phase 3: Migrate Data (5 minutes)

#### 3.1 Generate Initial Migration
```bash
npm run db:generate
```
This creates migration files in `drizzle/` folder based on your schema.

#### 3.2 Push Schema to Neon
```bash
npm run db:push
```
This applies the schema to your Neon database.

**OR** run the existing `complete_migration.sql` directly:
```bash
psql $DATABASE_URL < complete_migration.sql
```

### Phase 4: Update Existing Code to Use Drizzle (30 minutes)

#### 4.1 Example: Update Auth Routes
**Before** (`apps/api/src/routes/auth.routes.ts`):
```typescript
const users = await query(
  `SELECT id, email, name FROM users WHERE email = $1`,
  [email]
);
```

**After** (with Drizzle):
```typescript
import { db, users } from '@/db';
import { eq } from 'drizzle-orm';

const userList = await db.select({
  id: users.id,
  email: users.email,
  name: users.name,
}).from(users).where(eq(users.email, email));
```

**Benefits:**
- ✅ Type-safe: TypeScript knows all column names and types
- ✅ Autocomplete: IntelliSense suggests available columns
- ✅ Compile-time errors: Typos caught before runtime

#### 4.2 Files to Update (in order of priority)
1. `apps/api/src/routes/auth.routes.ts` - User signup/login queries
2. `apps/api/src/middleware/auth.middleware.ts` - Session queries
3. `apps/api/src/services/query-matcher.service.ts` - Search query operations
4. `apps/api/src/services/recommendation.service.ts` - Recommendation CRUD
5. `apps/api/src/workers/sync.worker.ts` - Job tracking queries

#### 4.3 Common Drizzle Patterns

**Insert:**
```typescript
const [newUser] = await db.insert(users).values({
  agencyId: '...',
  email: 'user@example.com',
  name: 'John Doe',
  passwordHash: '...',
  role: 'owner',
}).returning();
```

**Select with relations:**
```typescript
const agency = await db.query.agencies.findFirst({
  where: eq(agencies.id, agencyId),
  with: {
    users: true,
    clientAccounts: true,
  },
});
```

**Update:**
```typescript
await db.update(users)
  .set({ updatedAt: new Date() })
  .where(eq(users.id, userId));
```

**Delete:**
```typescript
await db.delete(userSessions)
  .where(eq(userSessions.id, sessionId));
```

**Complex joins:**
```typescript
const overlaps = await db.select({
  queryText: searchQueries.queryText,
  adsClicks: googleAdsQueries.clicks,
  organicClicks: searchConsoleQueries.clicks,
})
.from(queryOverlaps)
.innerJoin(searchQueries, eq(queryOverlaps.searchQueryId, searchQueries.id))
.leftJoin(googleAdsQueries, eq(searchQueries.id, googleAdsQueries.searchQueryId))
.leftJoin(searchConsoleQueries, eq(searchQueries.id, searchConsoleQueries.searchQueryId))
.where(eq(queryOverlaps.clientAccountId, clientId));
```

### Phase 5: Testing & Verification (15 minutes)

#### 5.1 Test Database Connection
```bash
npm run db:studio
```
Opens Drizzle Studio in browser - GUI for browsing/editing data.

#### 5.2 Verify Migration
```sql
-- Run in Neon SQL editor or via psql
SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename;
```
Should show all 15 tables.

#### 5.3 Test Queries
Create a simple test script to verify Drizzle queries work:
```typescript
// apps/api/src/db/test-connection.ts
import { db, agencies } from './index';

async function test() {
  const result = await db.select().from(agencies).limit(1);
  console.log('Connection successful:', result);
}

test();
```

### Phase 6: Clean Up (5 minutes)

#### 6.1 Remove Old Migration System
- Keep `complete_migration.sql` for reference
- Remove or archive `apps/api/migrations/` folder
- Remove `node-pg-migrate` dependency:
  ```bash
  npm uninstall node-pg-migrate
  ```
- Remove `.pgmigrate` config file

#### 6.2 Update Documentation
Update `CLAUDE.md` and `README.md` to reflect:
- Database: Neon (not Supabase)
- ORM: Drizzle
- Migration commands: `npm run db:generate`, `npm run db:push`

## Success Criteria

✅ Neon database created and accessible via IPv4
✅ All 15 tables exist in Neon database
✅ Drizzle schema matches SQL schema exactly
✅ `npm run db:studio` opens Drizzle Studio successfully
✅ Sample queries work with full TypeScript autocomplete
✅ Old `query()` helper replaced with Drizzle queries
✅ Tests pass (once written)

## Rollback Plan

If migration fails:
1. Keep Supabase connection string in `.env.backup`
2. Revert `apps/api/src/db/index.ts` to old `pg` version
3. Continue using SQL Editor for Supabase operations
4. Database schema already exists in both places

## Reference Links

- **Neon Docs**: https://neon.tech/docs/introduction
- **Drizzle Docs**: https://orm.drizzle.team/docs/overview
- **Drizzle PostgreSQL Guide**: https://orm.drizzle.team/docs/get-started-postgresql
- **Migration Guide**: https://orm.drizzle.team/docs/migrations
- **Drizzle Studio**: https://orm.drizzle.team/drizzle-studio/overview

## Estimated Timeline

- Phase 1 (Neon setup): 10 min
- Phase 2 (Drizzle install): 15 min
- Phase 3 (Schema conversion): 45-60 min ⚠️ **Most time-consuming**
- Phase 4 (Update code): 30 min
- Phase 5 (Testing): 15 min
- Phase 6 (Cleanup): 5 min

**Total: ~2-2.5 hours**

## Notes for AI Agent

- **Priority**: Convert SQL schema → Drizzle schema accurately (Phase 2.3)
- **Maintain compatibility**: Keep same table/column names for easy migration
- **Type safety**: Leverage Drizzle's TypeScript types throughout codebase
- **Incremental approach**: Can run both `pg` and Drizzle side-by-side during transition
- **Test thoroughly**: Verify each table's schema matches before removing old code
- **Preserve data**: Migration is schema-only (no data to move from Supabase since it's empty)

---
Generated: 2025-11-16
