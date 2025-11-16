import { pgTable, uuid, varchar, timestamp, integer, text, boolean, date, decimal, bigint, check, index, uniqueIndex, pgEnum } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

// ============================================================================
// ENUMS
// ============================================================================

export const billingTierEnum = pgEnum('billing_tier', ['starter', 'growth', 'agency']);
export const roleEnum = pgEnum('role', ['owner', 'admin', 'member']);
export const syncFrequencyEnum = pgEnum('sync_frequency', ['daily']);
export const analysisStatusEnum = pgEnum('analysis_status', ['pending', 'analyzing', 'completed', 'failed']);
export const recommendationTypeEnum = pgEnum('recommendation_type', ['reduce', 'pause', 'increase', 'maintain']);
export const confidenceLevelEnum = pgEnum('confidence_level', ['high', 'medium', 'low']);
export const recommendationStatusEnum = pgEnum('recommendation_status', ['pending', 'approved', 'rejected', 'applied']);
export const jobTypeEnum = pgEnum('job_type', ['google_ads_sync', 'search_console_sync', 'full_sync']);
export const jobStatusEnum = pgEnum('job_status', ['pending', 'running', 'completed', 'failed']);
export const detectedViaEnum = pgEnum('detected_via', ['auction_insights']);

// ============================================================================
// CORE TABLES
// ============================================================================

export const agencies = pgTable('agencies', {
  id: uuid('id').primaryKey().defaultRandom(),
  clerkOrgId: text('clerk_org_id').unique(),
  name: varchar('name', { length: 255 }).notNull(),
  billingTier: billingTierEnum('billing_tier').notNull(),
  clientLimit: integer('client_limit').notNull(),
  stripeCustomerId: varchar('stripe_customer_id', { length: 255 }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
}, (table) => ({
  clerkOrgIdx: index('idx_agencies_clerk_org_id').on(table.clerkOrgId),
  billingTierIdx: index('idx_agencies_billing_tier').on(table.billingTier),
  stripeCustomerIdx: index('idx_agencies_stripe_customer_id').on(table.stripeCustomerId),
}));

export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  clerkUserId: text('clerk_user_id').notNull().unique(),
  agencyId: uuid('agency_id').notNull().references(() => agencies.id, { onDelete: 'cascade' }),
  email: varchar('email', { length: 255 }).notNull().unique(),
  name: varchar('name', { length: 255 }).notNull(),
  role: roleEnum('role').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
}, (table) => ({
  clerkUserIdx: index('idx_users_clerk_user_id').on(table.clerkUserId),
  agencyIdx: index('idx_users_agency_id').on(table.agencyId),
  emailIdx: index('idx_users_email').on(table.email),
}));

// NOTE: user_sessions table removed - Clerk manages sessions
// Keeping this commented for reference during migration
// export const userSessions = pgTable('user_sessions', {
//   id: uuid('id').primaryKey().defaultRandom(),
//   userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
//   accessToken: text('access_token').notNull(),
//   refreshToken: text('refresh_token').notNull(),
//   accessTokenExpiresAt: timestamp('access_token_expires_at', { withTimezone: true }).notNull(),
//   refreshTokenExpiresAt: timestamp('refresh_token_expires_at', { withTimezone: true }).notNull(),
//   createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
//   revokedAt: timestamp('revoked_at', { withTimezone: true }),
// }, (table) => ({
//   userIdx: index('idx_user_sessions_user_id').on(table.userId),
//   accessTokenIdx: index('idx_user_sessions_access_token').on(table.accessToken),
//   refreshTokenIdx: index('idx_user_sessions_refresh_token').on(table.refreshToken),
//   expiresIdx: index('idx_user_sessions_expires').on(table.accessTokenExpiresAt, table.refreshTokenExpiresAt),
// }));

export const clientAccounts = pgTable('client_accounts', {
  id: uuid('id').primaryKey().defaultRandom(),
  agencyId: uuid('agency_id').notNull().references(() => agencies.id, { onDelete: 'cascade' }),
  name: varchar('name', { length: 255 }).notNull(),
  googleAdsCustomerId: varchar('google_ads_customer_id', { length: 20 }),
  googleAdsRefreshTokenEncrypted: text('google_ads_refresh_token_encrypted'),
  googleAdsRefreshTokenKeyVersion: integer('google_ads_refresh_token_key_version').default(1),
  searchConsoleSiteUrl: varchar('search_console_site_url', { length: 500 }),
  searchConsoleRefreshTokenEncrypted: text('search_console_refresh_token_encrypted'),
  searchConsoleRefreshTokenKeyVersion: integer('search_console_refresh_token_key_version').default(1),
  syncFrequency: varchar('sync_frequency', { length: 20 }).default('daily'),
  isActive: boolean('is_active').default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
}, (table) => ({
  agencyIdx: index('idx_client_accounts_agency_id').on(table.agencyId),
  isActiveIdx: index('idx_client_accounts_is_active').on(table.isActive),
  googleAdsCustomerIdx: index('idx_client_accounts_google_ads_customer_id').on(table.googleAdsCustomerId),
}));

// ============================================================================
// DATA SYNC TABLES
// ============================================================================

export const searchQueries = pgTable('search_queries', {
  id: uuid('id').primaryKey().defaultRandom(),
  clientAccountId: uuid('client_account_id').notNull().references(() => clientAccounts.id, { onDelete: 'cascade' }),
  queryText: text('query_text').notNull(),
  queryNormalized: text('query_normalized').notNull(),
  queryHash: varchar('query_hash', { length: 32 }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
}, (table) => ({
  clientAccountIdx: index('idx_search_queries_client_account_id').on(table.clientAccountId),
  hashIdx: index('idx_search_queries_hash').on(table.queryHash),
  uniqueIdx: uniqueIndex('idx_search_queries_unique').on(table.clientAccountId, table.queryHash),
}));

export const googleAdsQueries = pgTable('google_ads_queries', {
  id: uuid('id').primaryKey().defaultRandom(),
  clientAccountId: uuid('client_account_id').notNull().references(() => clientAccounts.id, { onDelete: 'cascade' }),
  searchQueryId: uuid('search_query_id').notNull().references(() => searchQueries.id, { onDelete: 'cascade' }),
  date: date('date').notNull(),
  impressions: integer('impressions').default(0),
  clicks: integer('clicks').default(0),
  costMicros: bigint('cost_micros', { mode: 'number' }).default(0),
  conversions: decimal('conversions', { precision: 10, scale: 2 }).default('0'),
  ctr: decimal('ctr', { precision: 5, scale: 4 }),
  avgCpcMicros: bigint('avg_cpc_micros', { mode: 'number' }),
  campaignId: varchar('campaign_id', { length: 50 }),
  campaignName: varchar('campaign_name', { length: 255 }),
  adGroupId: varchar('ad_group_id', { length: 50 }),
  adGroupName: varchar('ad_group_name', { length: 255 }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
}, (table) => ({
  clientIdx: index('idx_google_ads_queries_client').on(table.clientAccountId),
  searchQueryIdx: index('idx_google_ads_queries_search_query').on(table.searchQueryId),
  dateIdx: index('idx_google_ads_queries_date').on(table.date),
  uniqueIdx: uniqueIndex('idx_google_ads_queries_unique').on(table.clientAccountId, table.searchQueryId, table.date),
}));

export const searchConsoleQueries = pgTable('search_console_queries', {
  id: uuid('id').primaryKey().defaultRandom(),
  clientAccountId: uuid('client_account_id').notNull().references(() => clientAccounts.id, { onDelete: 'cascade' }),
  searchQueryId: uuid('search_query_id').notNull().references(() => searchQueries.id, { onDelete: 'cascade' }),
  date: date('date').notNull(),
  impressions: integer('impressions').default(0),
  clicks: integer('clicks').default(0),
  ctr: decimal('ctr', { precision: 5, scale: 4 }),
  position: decimal('position', { precision: 5, scale: 2 }),
  page: text('page'),
  device: varchar('device', { length: 20 }),
  country: varchar('country', { length: 2 }),
  searchAppearance: varchar('search_appearance', { length: 50 }),
  searchType: varchar('search_type', { length: 20 }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
}, (table) => ({
  clientIdx: index('idx_search_console_queries_client').on(table.clientAccountId),
  searchQueryIdx: index('idx_search_console_queries_search_query').on(table.searchQueryId),
  dateIdx: index('idx_search_console_queries_date').on(table.date),
  pageIdx: index('idx_search_console_queries_page').on(table.page),
  deviceIdx: index('idx_search_console_queries_device').on(table.device),
  searchTypeIdx: index('idx_search_console_queries_search_type').on(table.searchType),
  uniqueIdx: uniqueIndex('idx_search_console_queries_unique').on(table.clientAccountId, table.searchQueryId, table.date, table.page, table.device, table.country, table.searchAppearance, table.searchType),
}));

export const queryOverlaps = pgTable('query_overlaps', {
  id: uuid('id').primaryKey().defaultRandom(),
  clientAccountId: uuid('client_account_id').notNull().references(() => clientAccounts.id, { onDelete: 'cascade' }),
  searchQueryId: uuid('search_query_id').notNull().references(() => searchQueries.id, { onDelete: 'cascade' }),
  overlapDetectedAt: timestamp('overlap_detected_at', { withTimezone: true }).defaultNow(),
  lastAnalyzedAt: timestamp('last_analyzed_at', { withTimezone: true }),
  analysisStatus: analysisStatusEnum('analysis_status').default('pending'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
}, (table) => ({
  clientIdx: index('idx_query_overlaps_client').on(table.clientAccountId),
  searchQueryIdx: index('idx_query_overlaps_search_query').on(table.searchQueryId),
  statusIdx: index('idx_query_overlaps_status').on(table.analysisStatus),
  uniqueIdx: uniqueIndex('idx_query_overlaps_unique').on(table.clientAccountId, table.searchQueryId),
}));

// ============================================================================
// RECOMMENDATIONS & COMPETITORS
// ============================================================================

export const recommendations = pgTable('recommendations', {
  id: uuid('id').primaryKey().defaultRandom(),
  clientAccountId: uuid('client_account_id').notNull().references(() => clientAccounts.id, { onDelete: 'cascade' }),
  queryOverlapId: uuid('query_overlap_id').notNull().references(() => queryOverlaps.id, { onDelete: 'cascade' }),
  recommendationType: recommendationTypeEnum('recommendation_type').notNull(),
  confidenceLevel: confidenceLevelEnum('confidence_level').notNull(),
  currentMonthlySpend: decimal('current_monthly_spend', { precision: 12, scale: 2 }),
  recommendedMonthlySpend: decimal('recommended_monthly_spend', { precision: 12, scale: 2 }),
  estimatedMonthlySavings: decimal('estimated_monthly_savings', { precision: 12, scale: 2 }),
  reasoning: text('reasoning').notNull(),
  keyFactors: text('key_factors').array(),
  encryptedSnapshot: text('encrypted_snapshot'),
  encryptedSnapshotKeyVersion: integer('encrypted_snapshot_key_version').default(1),
  status: recommendationStatusEnum('status').default('pending'),
  approvedBy: uuid('approved_by').references(() => users.id),
  approvedAt: timestamp('approved_at', { withTimezone: true }),
  appliedAt: timestamp('applied_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
}, (table) => ({
  clientIdx: index('idx_recommendations_client').on(table.clientAccountId),
  overlapIdx: index('idx_recommendations_overlap').on(table.queryOverlapId),
  statusIdx: index('idx_recommendations_status').on(table.status),
  typeIdx: index('idx_recommendations_type').on(table.recommendationType),
  confidenceIdx: index('idx_recommendations_confidence').on(table.confidenceLevel),
}));

export const competitors = pgTable('competitors', {
  id: uuid('id').primaryKey().defaultRandom(),
  clientAccountId: uuid('client_account_id').notNull().references(() => clientAccounts.id, { onDelete: 'cascade' }),
  competitorDomain: varchar('competitor_domain', { length: 255 }).notNull(),
  detectedVia: varchar('detected_via', { length: 50 }).default('auction_insights'),
  firstSeenAt: timestamp('first_seen_at', { withTimezone: true }).defaultNow(),
  lastSeenAt: timestamp('last_seen_at', { withTimezone: true }).defaultNow(),
  isActive: boolean('is_active').default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
}, (table) => ({
  clientIdx: index('idx_competitors_client').on(table.clientAccountId),
  domainIdx: index('idx_competitors_domain').on(table.competitorDomain),
  isActiveIdx: index('idx_competitors_is_active').on(table.isActive),
  uniqueIdx: uniqueIndex('idx_competitors_unique').on(table.clientAccountId, table.competitorDomain),
}));

export const competitorMetrics = pgTable('competitor_metrics', {
  id: uuid('id').primaryKey().defaultRandom(),
  competitorId: uuid('competitor_id').notNull().references(() => competitors.id, { onDelete: 'cascade' }),
  date: date('date').notNull(),
  impressionShare: decimal('impression_share', { precision: 5, scale: 2 }),
  overlapRate: decimal('overlap_rate', { precision: 5, scale: 2 }),
  positionAboveRate: decimal('position_above_rate', { precision: 5, scale: 2 }),
  topOfPageRate: decimal('top_of_page_rate', { precision: 5, scale: 2 }),
  outrankingShare: decimal('outranking_share', { precision: 5, scale: 2 }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
}, (table) => ({
  competitorIdx: index('idx_competitor_metrics_competitor').on(table.competitorId),
  dateIdx: index('idx_competitor_metrics_date').on(table.date),
  uniqueIdx: uniqueIndex('idx_competitor_metrics_unique').on(table.competitorId, table.date),
}));

// ============================================================================
// JOB TRACKING
// ============================================================================

export const syncJobs = pgTable('sync_jobs', {
  id: uuid('id').primaryKey().defaultRandom(),
  clientAccountId: uuid('client_account_id').notNull().references(() => clientAccounts.id, { onDelete: 'cascade' }),
  jobType: jobTypeEnum('job_type').notNull(),
  status: jobStatusEnum('status').default('pending'),
  startedAt: timestamp('started_at', { withTimezone: true }),
  completedAt: timestamp('completed_at', { withTimezone: true }),
  errorMessage: text('error_message'),
  recordsProcessed: integer('records_processed').default(0),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
}, (table) => ({
  clientIdx: index('idx_sync_jobs_client').on(table.clientAccountId),
  statusIdx: index('idx_sync_jobs_status').on(table.status),
  createdAtIdx: index('idx_sync_jobs_created_at').on(table.createdAt),
}));

export const analysisJobs = pgTable('analysis_jobs', {
  id: uuid('id').primaryKey().defaultRandom(),
  queryOverlapId: uuid('query_overlap_id').notNull().references(() => queryOverlaps.id, { onDelete: 'cascade' }),
  status: jobStatusEnum('status').default('pending'),
  startedAt: timestamp('started_at', { withTimezone: true }),
  completedAt: timestamp('completed_at', { withTimezone: true }),
  errorMessage: text('error_message'),
  aiTokensUsed: integer('ai_tokens_used'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
}, (table) => ({
  overlapIdx: index('idx_analysis_jobs_overlap').on(table.queryOverlapId),
  statusIdx: index('idx_analysis_jobs_status').on(table.status),
  createdAtIdx: index('idx_analysis_jobs_created_at').on(table.createdAt),
}));

// ============================================================================
// RELATIONS
// ============================================================================

export const agenciesRelations = relations(agencies, ({ many }) => ({
  users: many(users),
  clientAccounts: many(clientAccounts),
}));

export const usersRelations = relations(users, ({ one, many }) => ({
  agency: one(agencies, {
    fields: [users.agencyId],
    references: [agencies.id],
  }),
  // sessions removed - Clerk manages sessions
  approvedRecommendations: many(recommendations),
}));

// userSessionsRelations removed - Clerk manages sessions
// export const userSessionsRelations = relations(userSessions, ({ one }) => ({
//   user: one(users, {
//     fields: [userSessions.userId],
//     references: [users.id],
//   }),
// }));

export const clientAccountsRelations = relations(clientAccounts, ({ one, many }) => ({
  agency: one(agencies, {
    fields: [clientAccounts.agencyId],
    references: [agencies.id],
  }),
  searchQueries: many(searchQueries),
  googleAdsQueries: many(googleAdsQueries),
  searchConsoleQueries: many(searchConsoleQueries),
  queryOverlaps: many(queryOverlaps),
  recommendations: many(recommendations),
  competitors: many(competitors),
  syncJobs: many(syncJobs),
}));

export const searchQueriesRelations = relations(searchQueries, ({ one, many }) => ({
  clientAccount: one(clientAccounts, {
    fields: [searchQueries.clientAccountId],
    references: [clientAccounts.id],
  }),
  googleAdsQueries: many(googleAdsQueries),
  searchConsoleQueries: many(searchConsoleQueries),
  queryOverlaps: many(queryOverlaps),
}));

export const googleAdsQueriesRelations = relations(googleAdsQueries, ({ one }) => ({
  clientAccount: one(clientAccounts, {
    fields: [googleAdsQueries.clientAccountId],
    references: [clientAccounts.id],
  }),
  searchQuery: one(searchQueries, {
    fields: [googleAdsQueries.searchQueryId],
    references: [searchQueries.id],
  }),
}));

export const searchConsoleQueriesRelations = relations(searchConsoleQueries, ({ one }) => ({
  clientAccount: one(clientAccounts, {
    fields: [searchConsoleQueries.clientAccountId],
    references: [clientAccounts.id],
  }),
  searchQuery: one(searchQueries, {
    fields: [searchConsoleQueries.searchQueryId],
    references: [searchQueries.id],
  }),
}));

export const queryOverlapsRelations = relations(queryOverlaps, ({ one, many }) => ({
  clientAccount: one(clientAccounts, {
    fields: [queryOverlaps.clientAccountId],
    references: [clientAccounts.id],
  }),
  searchQuery: one(searchQueries, {
    fields: [queryOverlaps.searchQueryId],
    references: [searchQueries.id],
  }),
  recommendations: many(recommendations),
  analysisJobs: many(analysisJobs),
}));

export const recommendationsRelations = relations(recommendations, ({ one }) => ({
  clientAccount: one(clientAccounts, {
    fields: [recommendations.clientAccountId],
    references: [clientAccounts.id],
  }),
  queryOverlap: one(queryOverlaps, {
    fields: [recommendations.queryOverlapId],
    references: [queryOverlaps.id],
  }),
  approver: one(users, {
    fields: [recommendations.approvedBy],
    references: [users.id],
  }),
}));

export const competitorsRelations = relations(competitors, ({ one, many }) => ({
  clientAccount: one(clientAccounts, {
    fields: [competitors.clientAccountId],
    references: [clientAccounts.id],
  }),
  metrics: many(competitorMetrics),
}));

export const competitorMetricsRelations = relations(competitorMetrics, ({ one }) => ({
  competitor: one(competitors, {
    fields: [competitorMetrics.competitorId],
    references: [competitors.id],
  }),
}));

export const syncJobsRelations = relations(syncJobs, ({ one }) => ({
  clientAccount: one(clientAccounts, {
    fields: [syncJobs.clientAccountId],
    references: [clientAccounts.id],
  }),
}));

export const analysisJobsRelations = relations(analysisJobs, ({ one }) => ({
  queryOverlap: one(queryOverlaps, {
    fields: [analysisJobs.queryOverlapId],
    references: [queryOverlaps.id],
  }),
}));
