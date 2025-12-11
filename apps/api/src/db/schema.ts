import { pgTable, uuid, varchar, timestamp, integer, text, boolean, date, decimal, bigint, check, index, uniqueIndex, pgEnum } from 'drizzle-orm/pg-core';
import { relations, sql } from 'drizzle-orm';

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
export const dataSourceEnum = pgEnum('data_source', ['api', 'csv_upload']);

// Phase 4: Interplay Reports enums
export const reportTriggerEnum = pgEnum('report_trigger', ['client_creation', 'manual', 'scheduled']);
export const reportStatusEnum = pgEnum('report_status', ['pending', 'researching', 'analyzing', 'completed', 'failed']);
export const recommendationSourceEnum = pgEnum('recommendation_source', ['legacy', 'interplay_report']);
export const recommendationCategoryEnum = pgEnum('recommendation_category', ['sem', 'seo', 'hybrid']);
export const impactLevelEnum = pgEnum('impact_level', ['high', 'medium', 'low']);
export const effortLevelEnum = pgEnum('effort_level', ['high', 'medium', 'low']);

// Phase 6: Constraint Validation enums
export const constraintViolationSourceEnum = pgEnum('constraint_violation_source', ['sem', 'seo']);

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
  ga4PropertyId: varchar('ga4_property_id', { length: 50 }),
  ga4RefreshTokenEncrypted: text('ga4_refresh_token_encrypted'),
  ga4RefreshTokenKeyVersion: integer('ga4_refresh_token_key_version').default(1),
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
  // CSV upload fields
  dataSource: dataSourceEnum('data_source').default('api'),
  matchType: varchar('match_type', { length: 20 }), // 'Phrase match', 'Exact match', 'Broad match'
  criterionStatus: varchar('criterion_status', { length: 20 }), // 'Enabled', 'Paused', 'Removed'
  campaignStatus: varchar('campaign_status', { length: 20 }),
  adGroupStatus: varchar('ad_group_status', { length: 20 }),
  dateRangeStart: date('date_range_start'), // For aggregated CSV data (no single date)
  dateRangeEnd: date('date_range_end'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
}, (table) => ({
  clientIdx: index('idx_google_ads_queries_client').on(table.clientAccountId),
  searchQueryIdx: index('idx_google_ads_queries_search_query').on(table.searchQueryId),
  dateIdx: index('idx_google_ads_queries_date').on(table.date),
  dataSourceIdx: index('idx_google_ads_queries_data_source').on(table.dataSource),
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
  country: varchar('country', { length: 3 }),
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
  queryOverlapId: uuid('query_overlap_id').references(() => queryOverlaps.id, { onDelete: 'cascade' }), // Now nullable for interplay recommendations
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
  // Phase 4: Interplay report fields
  source: recommendationSourceEnum('source').default('legacy'),
  interplayReportId: uuid('interplay_report_id').references(() => interplayReports.id, { onDelete: 'set null' }),
  recommendationCategory: recommendationCategoryEnum('recommendation_category'),
  title: varchar('title', { length: 255 }),
  impactLevel: impactLevelEnum('impact_level'),
  effortLevel: effortLevelEnum('effort_level'),
  actionItems: text('action_items').array(),
}, (table) => ({
  clientIdx: index('idx_recommendations_client').on(table.clientAccountId),
  overlapIdx: index('idx_recommendations_overlap').on(table.queryOverlapId),
  statusIdx: index('idx_recommendations_status').on(table.status),
  typeIdx: index('idx_recommendations_type').on(table.recommendationType),
  confidenceIdx: index('idx_recommendations_confidence').on(table.confidenceLevel),
  interplayReportIdx: index('idx_recommendations_interplay_report').on(table.interplayReportId),
  sourceIdx: index('idx_recommendations_source').on(table.source),
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

export const ga4Metrics = pgTable('ga4_metrics', {
  id: uuid('id').primaryKey().defaultRandom(),
  clientAccountId: uuid('client_account_id').notNull().references(() => clientAccounts.id, { onDelete: 'cascade' }),
  date: date('date').notNull(),
  sessions: integer('sessions').default(0),
  engagementRate: decimal('engagement_rate', { precision: 5, scale: 2 }),
  viewsPerSession: decimal('views_per_session', { precision: 5, scale: 2 }),
  conversions: decimal('conversions', { precision: 10, scale: 2 }).default('0'),
  totalRevenue: decimal('total_revenue', { precision: 12, scale: 2 }).default('0'),
  averageSessionDuration: decimal('average_session_duration', { precision: 10, scale: 2 }),
  bounceRate: decimal('bounce_rate', { precision: 5, scale: 2 }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
}, (table) => ({
  clientIdx: index('idx_ga4_metrics_client').on(table.clientAccountId),
  dateIdx: index('idx_ga4_metrics_date').on(table.date),
  uniqueIdx: uniqueIndex('idx_ga4_metrics_unique').on(table.clientAccountId, table.date),
}));

export const ga4LandingPageMetrics = pgTable('ga4_landing_page_metrics', {
  id: uuid('id').primaryKey().defaultRandom(),
  clientAccountId: uuid('client_account_id').notNull().references(() => clientAccounts.id, { onDelete: 'cascade' }),
  date: date('date').notNull(),
  landingPage: text('landing_page').notNull(),
  sessionSource: varchar('session_source', { length: 100 }),
  sessionMedium: varchar('session_medium', { length: 100 }),
  sessions: integer('sessions').default(0),
  engagementRate: decimal('engagement_rate', { precision: 5, scale: 2 }),
  conversions: decimal('conversions', { precision: 10, scale: 2 }).default('0'),
  totalRevenue: decimal('total_revenue', { precision: 12, scale: 2 }).default('0'),
  averageSessionDuration: decimal('average_session_duration', { precision: 10, scale: 2 }),
  bounceRate: decimal('bounce_rate', { precision: 5, scale: 2 }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
}, (table) => ({
  clientIdx: index('idx_ga4_landing_page_metrics_client').on(table.clientAccountId),
  dateIdx: index('idx_ga4_landing_page_metrics_date').on(table.date),
  pageIdx: index('idx_ga4_landing_page_metrics_page').on(table.landingPage),
  sourceMediumIdx: index('idx_ga4_landing_page_metrics_source_medium').on(table.sessionSource, table.sessionMedium),
  uniqueIdx: uniqueIndex('idx_ga4_landing_page_metrics_unique').on(table.clientAccountId, table.date, table.landingPage, table.sessionSource, table.sessionMedium),
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
  // Add partial unique index for active jobs (pending/running)
  activePerClientIdx: uniqueIndex('idx_sync_jobs_active_per_client')
    .on(table.clientAccountId)
    .where(sql`status IN ('pending', 'running')`),

  // Add regular index for all client lookups
  clientAllIdx: index('idx_sync_jobs_client_all').on(table.clientAccountId),

  // Keep existing indexes
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
// INTERPLAY REPORTS (PHASE 4)
// ============================================================================

export const interplayReports = pgTable('interplay_reports', {
  id: uuid('id').primaryKey().defaultRandom(),
  clientAccountId: uuid('client_account_id').notNull().references(() => clientAccounts.id, { onDelete: 'cascade' }),
  triggerType: reportTriggerEnum('trigger_type').notNull(),
  status: reportStatusEnum('status').default('pending').notNull(),

  // Date range analyzed
  dateRangeStart: date('date_range_start').notNull(),
  dateRangeEnd: date('date_range_end').notNull(),
  dateRangeDays: integer('date_range_days').default(30).notNull(),

  // Phase outputs (stored as encrypted JSON)
  scoutFindingsEncrypted: text('scout_findings_encrypted'),
  researcherDataEncrypted: text('researcher_data_encrypted'),
  semAgentOutputEncrypted: text('sem_agent_output_encrypted'),
  seoAgentOutputEncrypted: text('seo_agent_output_encrypted'),
  directorOutputEncrypted: text('director_output_encrypted'),

  // Final output (encrypted)
  executiveSummaryEncrypted: text('executive_summary_encrypted'),
  unifiedRecommendationsEncrypted: text('unified_recommendations_encrypted'),

  // Metadata
  tokensUsed: integer('tokens_used'),
  processingTimeMs: integer('processing_time_ms'),
  errorMessage: text('error_message'),

  // Skill and performance metadata (stored as JSON)
  skillMetadataJson: text('skill_metadata_json'), // SkillBundleMetadata
  performanceMetricsJson: text('performance_metrics_json'), // ReportPerformanceMetrics
  warningsJson: text('warnings_json'), // ReportWarning[]

  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  startedAt: timestamp('started_at', { withTimezone: true }),
  completedAt: timestamp('completed_at', { withTimezone: true }),
}, (table) => ({
  clientIdx: index('idx_interplay_reports_client').on(table.clientAccountId),
  statusIdx: index('idx_interplay_reports_status').on(table.status),
  createdIdx: index('idx_interplay_reports_created').on(table.createdAt),
}));

// ============================================================================
// CONSTRAINT VIOLATIONS (PHASE 6)
// ============================================================================

/**
 * Tracks constraint violations from upstream agents (SEM, SEO).
 * Used for debugging prompt quality and monitoring system health.
 */
export const constraintViolations = pgTable('constraint_violations', {
  id: uuid('id').primaryKey().defaultRandom(),

  // Link to the report where violation was detected
  reportId: uuid('report_id').notNull().references(() => interplayReports.id, { onDelete: 'cascade' }),

  // Client context for analysis
  clientAccountId: uuid('client_account_id').notNull().references(() => clientAccounts.id, { onDelete: 'cascade' }),

  // Business type at time of violation (for trend analysis)
  businessType: varchar('business_type', { length: 50 }).notNull(),

  // Which agent generated the violation
  source: constraintViolationSourceEnum('source').notNull(),

  // Which constraint rule was violated (e.g., "metric:roas", "schema:Product")
  constraintId: varchar('constraint_id', { length: 100 }).notNull(),

  // Preview of the violating content (truncated for storage)
  violatingContent: text('violating_content').notNull(),

  // Skill version for debugging
  skillVersion: varchar('skill_version', { length: 20 }).notNull(),

  // Timestamps
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
}, (table) => ({
  reportIdx: index('idx_constraint_violations_report').on(table.reportId),
  clientIdx: index('idx_constraint_violations_client').on(table.clientAccountId),
  businessTypeIdx: index('idx_constraint_violations_business_type').on(table.businessType),
  sourceIdx: index('idx_constraint_violations_source').on(table.source),
  constraintIdIdx: index('idx_constraint_violations_constraint_id').on(table.constraintId),
  createdAtIdx: index('idx_constraint_violations_created_at').on(table.createdAt),
  // Composite index for trend analysis by business type and constraint
  trendIdx: index('idx_constraint_violations_trend').on(table.businessType, table.constraintId, table.createdAt),
}));

// ============================================================================
// CSV UPLOAD TABLES
// ============================================================================

export const csvUploads = pgTable('csv_uploads', {
  id: uuid('id').primaryKey().defaultRandom(),
  clientAccountId: uuid('client_account_id').notNull().references(() => clientAccounts.id, { onDelete: 'cascade' }),
  uploadSessionId: uuid('upload_session_id').notNull(), // Groups multiple files from same upload
  fileName: varchar('file_name', { length: 255 }).notNull(),
  fileType: varchar('file_type', { length: 50 }).notNull(), // 'google_ads_searches', 'auction_insights', etc.
  fileSize: integer('file_size').notNull(),
  rowCount: integer('row_count').default(0),
  dateRangeStart: date('date_range_start'),
  dateRangeEnd: date('date_range_end'),
  status: varchar('status', { length: 20 }).default('processing'), // 'processing', 'completed', 'failed', 'skipped'
  errorMessage: text('error_message'),
  uploadedBy: uuid('uploaded_by').references(() => users.id),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
}, (table) => ({
  clientIdx: index('idx_csv_uploads_client').on(table.clientAccountId),
  sessionIdx: index('idx_csv_uploads_session').on(table.uploadSessionId),
  typeIdx: index('idx_csv_uploads_type').on(table.fileType),
  statusIdx: index('idx_csv_uploads_status').on(table.status),
}));

// ============================================================================
// AUCTION INSIGHTS (TIER 1 - COMPETITOR DATA)
// ============================================================================
// Google Ads Auction Insights can be exported at multiple levels:
// - Account level (no segment columns)
// - Campaign level (campaign_name populated)
// - Ad Group level (campaign_name + ad_group_name populated)
// - Keyword level (campaign_name + ad_group_name + keyword populated)
//
// For the multi-agent system to work correctly per the spec, we need
// KEYWORD-LEVEL auction insights to provide per-battleground-keyword
// competitive metrics.

export const auctionInsights = pgTable('auction_insights', {
  id: uuid('id').primaryKey().defaultRandom(),
  clientAccountId: uuid('client_account_id').notNull().references(() => clientAccounts.id, { onDelete: 'cascade' }),
  // Segment columns (determines granularity level)
  campaignName: varchar('campaign_name', { length: 255 }), // Populated for campaign/ad_group/keyword level
  adGroupName: varchar('ad_group_name', { length: 255 }), // Populated for ad_group/keyword level
  keyword: varchar('keyword', { length: 500 }), // Populated for keyword level (most granular)
  keywordMatchType: varchar('keyword_match_type', { length: 20 }), // 'Exact', 'Phrase', 'Broad'
  // Competitor identification
  competitorDomain: varchar('competitor_domain', { length: 255 }).notNull(),
  isOwnAccount: boolean('is_own_account').default(false), // "You" row
  // Date range
  dateRangeStart: date('date_range_start').notNull(),
  dateRangeEnd: date('date_range_end').notNull(),
  // Core competitive metrics
  impressionShare: decimal('impression_share', { precision: 5, scale: 2 }),
  lostImpressionShareRank: decimal('lost_impression_share_rank', { precision: 5, scale: 2 }),
  lostImpressionShareBudget: decimal('lost_impression_share_budget', { precision: 5, scale: 2 }),
  // Additional competitive metrics
  outrankingShare: decimal('outranking_share', { precision: 5, scale: 2 }),
  overlapRate: decimal('overlap_rate', { precision: 5, scale: 2 }),
  topOfPageRate: decimal('top_of_page_rate', { precision: 5, scale: 2 }),
  positionAboveRate: decimal('position_above_rate', { precision: 5, scale: 2 }),
  absTopOfPageRate: decimal('abs_top_of_page_rate', { precision: 5, scale: 2 }),
  impressionShareBelowThreshold: boolean('impression_share_below_threshold').default(false), // Flag for "< 10%" values
  dataSource: dataSourceEnum('data_source').default('csv_upload'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
}, (table) => ({
  clientIdx: index('idx_auction_insights_client').on(table.clientAccountId),
  competitorIdx: index('idx_auction_insights_competitor').on(table.competitorDomain),
  dateRangeIdx: index('idx_auction_insights_date_range').on(table.dateRangeStart, table.dateRangeEnd),
  keywordIdx: index('idx_auction_insights_keyword').on(table.keyword),
  campaignIdx: index('idx_auction_insights_campaign').on(table.campaignName),
}));

// ============================================================================
// CAMPAIGN METRICS (TIER 2)
// ============================================================================

export const campaignMetrics = pgTable('campaign_metrics', {
  id: uuid('id').primaryKey().defaultRandom(),
  clientAccountId: uuid('client_account_id').notNull().references(() => clientAccounts.id, { onDelete: 'cascade' }),
  campaignName: varchar('campaign_name', { length: 255 }).notNull(),
  campaignGroupName: varchar('campaign_group_name', { length: 255 }),
  campaignStatus: varchar('campaign_status', { length: 20 }), // 'Enabled', 'Paused'
  dateRangeStart: date('date_range_start').notNull(),
  dateRangeEnd: date('date_range_end').notNull(),
  impressions: integer('impressions').default(0),
  clicks: integer('clicks').default(0),
  costMicros: bigint('cost_micros', { mode: 'number' }).default(0),
  ctr: decimal('ctr', { precision: 5, scale: 4 }),
  dataSource: dataSourceEnum('data_source').default('csv_upload'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
}, (table) => ({
  clientIdx: index('idx_campaign_metrics_client').on(table.clientAccountId),
  campaignIdx: index('idx_campaign_metrics_campaign').on(table.campaignName),
}));

// ============================================================================
// DEVICE METRICS (TIER 2)
// ============================================================================

export const deviceMetrics = pgTable('device_metrics', {
  id: uuid('id').primaryKey().defaultRandom(),
  clientAccountId: uuid('client_account_id').notNull().references(() => clientAccounts.id, { onDelete: 'cascade' }),
  device: varchar('device', { length: 50 }).notNull(), // 'Computers', 'Mobile Phones', 'Tablets', 'TV screens'
  dateRangeStart: date('date_range_start').notNull(),
  dateRangeEnd: date('date_range_end').notNull(),
  impressions: integer('impressions').default(0),
  clicks: integer('clicks').default(0),
  costMicros: bigint('cost_micros', { mode: 'number' }).default(0),
  dataSource: dataSourceEnum('data_source').default('csv_upload'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
}, (table) => ({
  clientIdx: index('idx_device_metrics_client').on(table.clientAccountId),
  deviceIdx: index('idx_device_metrics_device').on(table.device),
}));

// ============================================================================
// DAILY ACCOUNT METRICS (TIER 2 - TIME SERIES)
// ============================================================================

export const dailyAccountMetrics = pgTable('daily_account_metrics', {
  id: uuid('id').primaryKey().defaultRandom(),
  clientAccountId: uuid('client_account_id').notNull().references(() => clientAccounts.id, { onDelete: 'cascade' }),
  date: date('date').notNull(),
  impressions: integer('impressions').default(0),
  clicks: integer('clicks').default(0),
  costMicros: bigint('cost_micros', { mode: 'number' }).default(0),
  avgCpcMicros: bigint('avg_cpc_micros', { mode: 'number' }),
  dataSource: dataSourceEnum('data_source').default('csv_upload'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
}, (table) => ({
  clientIdx: index('idx_daily_account_metrics_client').on(table.clientAccountId),
  dateIdx: index('idx_daily_account_metrics_date').on(table.date),
  uniqueIdx: uniqueIndex('idx_daily_account_metrics_unique').on(table.clientAccountId, table.date),
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
  ga4Metrics: many(ga4Metrics),
  ga4LandingPageMetrics: many(ga4LandingPageMetrics),
  syncJobs: many(syncJobs),
  // CSV upload related
  csvUploads: many(csvUploads),
  auctionInsights: many(auctionInsights),
  campaignMetrics: many(campaignMetrics),
  deviceMetrics: many(deviceMetrics),
  dailyAccountMetrics: many(dailyAccountMetrics),
  // Phase 4: Interplay reports
  interplayReports: many(interplayReports),
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
  interplayReport: one(interplayReports, {
    fields: [recommendations.interplayReportId],
    references: [interplayReports.id],
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

export const ga4MetricsRelations = relations(ga4Metrics, ({ one }) => ({
  clientAccount: one(clientAccounts, {
    fields: [ga4Metrics.clientAccountId],
    references: [clientAccounts.id],
  }),
}));

export const ga4LandingPageMetricsRelations = relations(ga4LandingPageMetrics, ({ one }) => ({
  clientAccount: one(clientAccounts, {
    fields: [ga4LandingPageMetrics.clientAccountId],
    references: [clientAccounts.id],
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

// ============================================================================
// INTERPLAY REPORTS RELATIONS
// ============================================================================

export const interplayReportsRelations = relations(interplayReports, ({ one, many }) => ({
  clientAccount: one(clientAccounts, {
    fields: [interplayReports.clientAccountId],
    references: [clientAccounts.id],
  }),
  recommendations: many(recommendations),
  constraintViolations: many(constraintViolations),
}));

// ============================================================================
// CONSTRAINT VIOLATIONS RELATIONS (PHASE 6)
// ============================================================================

export const constraintViolationsRelations = relations(constraintViolations, ({ one }) => ({
  interplayReport: one(interplayReports, {
    fields: [constraintViolations.reportId],
    references: [interplayReports.id],
  }),
  clientAccount: one(clientAccounts, {
    fields: [constraintViolations.clientAccountId],
    references: [clientAccounts.id],
  }),
}));

// ============================================================================
// CSV UPLOAD RELATIONS
// ============================================================================

export const csvUploadsRelations = relations(csvUploads, ({ one }) => ({
  clientAccount: one(clientAccounts, {
    fields: [csvUploads.clientAccountId],
    references: [clientAccounts.id],
  }),
  uploader: one(users, {
    fields: [csvUploads.uploadedBy],
    references: [users.id],
  }),
}));

export const auctionInsightsRelations = relations(auctionInsights, ({ one }) => ({
  clientAccount: one(clientAccounts, {
    fields: [auctionInsights.clientAccountId],
    references: [clientAccounts.id],
  }),
}));

export const campaignMetricsRelations = relations(campaignMetrics, ({ one }) => ({
  clientAccount: one(clientAccounts, {
    fields: [campaignMetrics.clientAccountId],
    references: [clientAccounts.id],
  }),
}));

export const deviceMetricsRelations = relations(deviceMetrics, ({ one }) => ({
  clientAccount: one(clientAccounts, {
    fields: [deviceMetrics.clientAccountId],
    references: [clientAccounts.id],
  }),
}));

export const dailyAccountMetricsRelations = relations(dailyAccountMetrics, ({ one }) => ({
  clientAccount: one(clientAccounts, {
    fields: [dailyAccountMetrics.clientAccountId],
    references: [clientAccounts.id],
  }),
}));
