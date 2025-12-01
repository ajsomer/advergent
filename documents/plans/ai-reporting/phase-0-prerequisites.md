# Phase 0: Prerequisites and Foundation

## Objective

Establish the data foundation required for the Reports feature before building the multi-agent system or UI. This includes:
1. Implementing a unified CSV upload system that accepts all Google Ads exports
2. Smart file detection to automatically identify and route each report type
3. Tiered storage strategy (essential vs contextual vs skip)
4. Database schema extensions for new data types

## Prerequisites

- Database is set up with existing core tables
- Basic client management is functional
- Google Ads/Search Console OAuth flow exists (even if token not approved)

---

## Part 1: Upload Strategy - "Upload Everything, We'll Handle It"

### User Experience Goal

Users should be able to:
1. Go to Google Ads Overview tab
2. Download all reports
3. Upload the entire folder/ZIP to Advergent
4. We automatically detect, parse, and store what's needed

```
┌─────────────────────────────────────────────────────────────────┐
│  Upload Google Ads Reports                                       │
│                                                                  │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │                                                            │ │
│  │     Drop your Google Ads export folder or files here       │ │
│  │              or click to select files                      │ │
│  │                                                            │ │
│  │     We'll automatically detect and import:                 │ │
│  │     • Search terms • Keywords • Auction insights           │ │
│  │     • Campaigns • Devices • Daily trends                   │ │
│  │                                                            │ │
│  └────────────────────────────────────────────────────────────┘ │
│                                                                  │
│  ℹ️ Download all reports from Google Ads Overview tab            │
└─────────────────────────────────────────────────────────────────┘
```

### Tiered Storage Strategy

| Tier | Purpose | Files | Action |
|------|---------|-------|--------|
| **Tier 1: Essential** | Used for AI report generation | Searches, Keywords, Auction Insights | Store fully |
| **Tier 2: Contextual** | Future features, small footprint | Campaigns, Devices, Time Series | Store fully |
| **Tier 3: Skip** | Not needed, derivable, or irrelevant | Demographics, Word Analysis, Day/Hour, Networks, etc. | Parse to validate, don't store |

### File Detection Patterns

```typescript
type GoogleAdsReportType =
  | 'google_ads_searches'      // Tier 1
  | 'google_ads_keywords'      // Tier 1
  | 'auction_insights'         // Tier 1
  | 'campaigns'                // Tier 2
  | 'devices'                  // Tier 2
  | 'time_series'              // Tier 2
  | 'skip';                    // Tier 3

const FILE_PATTERNS: Record<string, GoogleAdsReportType> = {
  // Tier 1: Essential
  'Searches(Search_': 'google_ads_searches',
  'Search_keywords(': 'google_ads_keywords',
  'Auction_insights(Compare_': 'auction_insights',

  // Tier 2: Contextual
  'Campaigns(': 'campaigns',
  'Devices(': 'devices',
  'Time_series(': 'time_series',

  // Tier 3: Skip (parse to validate, don't store)
  'Searches(Word_': 'skip',
  'Demographics(': 'skip',
  'Day_&_hour(': 'skip',
  'Networks(': 'skip',
  'Biggest_changes(': 'skip',
  'Optimisation_score(': 'skip',
  'Auction_insights(Metric_': 'skip',  // Time-series auction (future)
};
```

### Upload Result Feedback

```
┌─────────────────────────────────────────────────────────────────┐
│  ✅ Upload Complete                                              │
│                                                                  │
│  Imported:                                                       │
│  ✅ Search Terms - 101 queries                                   │
│  ✅ Keywords - 31 keywords with match types                      │
│  ✅ Auction Insights - 8 competitors detected                    │
│  ✅ Campaigns - 4 campaigns                                      │
│  ✅ Devices - 4 device types                                     │
│  ✅ Daily Trends - 30 days of data                               │
│                                                                  │
│  Skipped (not needed for analysis):                              │
│  ⏭️ Word Analysis, Demographics, Day & Hour, Networks            │
│                                                                  │
│  Date Range: Nov 1 - Nov 30, 2025                                │
└─────────────────────────────────────────────────────────────────┘
```

---

## Part 2: Google Ads Sample Data Analysis

### Downloaded Files

| File | Tier | Rows | Columns | Notes |
|------|------|------|---------|-------|
| `Searches(Search_*.csv)` | 1 | 101 | Search, Cost, Clicks, Impressions, Conversions | Aggregated (no date) |
| `Search_keywords(*.csv)` | 1 | 31 | Keyword, Match type, Status, Cost, Clicks, CTR | Has match type |
| `Auction_insights(Compare_*.csv)` | 1 | 9 | Competitor, Impression share, Overlap rate, etc. | Critical! |
| `Campaigns(*.csv)` | 2 | 4 | Campaign Name, Status, Cost, Clicks, CTR | Small, useful context |
| `Devices(*.csv)` | 2 | 4 | Device, Cost, Impressions, Clicks | Small, useful context |
| `Time_series(*.csv)` | 2 | 30 | Date, Clicks, Impressions, Avg CPC, Cost | Daily trends |
| `Auction_insights(Metric_over_time_*.csv)` | 3 | 1 | Only header row in sample | Skip for now |
| `Searches(Word_*.csv)` | 3 | 95 | Word analysis | Derivable from searches |
| `Demographics(Age_*.csv)` | 3 | 7 | Age breakdown | Not needed |
| `Demographics(Gender_*.csv)` | 3 | - | Gender breakdown | Not needed |
| `Day_&_hour(*.csv)` | 3 | 7-30 | Time breakdowns | Not needed |
| `Networks(*.csv)` | 3 | 2 | Network breakdown | Not needed |
| `Biggest_changes(*.csv)` | 3 | 3 | Period comparison | Not actionable |
| `Optimisation_score(*.csv)` | 3 | - | Google's score | Not ours |

### Key Findings

**1. Search Terms are Aggregated**

```csv
Search,Cost,Clicks,Impressions,Conversions
all diamonds,$134.62,54,291,0.00
```

No date column - this is a summary for the entire date range. We need to:
- Extract date range from filename: `Searches(Search_2025.11.01-2025.11.30).csv`
- Store with `date_range_start` and `date_range_end` instead of single `date`

**2. Auction Insights Contains Competitor Data**

```csv
Advertiser Name,Impression share,Outranking share,Overlap rate,Top of page rate,Position above rate
melbournediamondlab.com.au,13.73%,7.39%,29.77%,90.66%,69.99%
```

This is exactly what the Scout agent needs for competitive analysis!

**3. "< 10%" and "No data" Values**

```csv
You,< 10%,< 10%,No data,No data,91.61%
```

Need special handling - store as `null` with a flag or as `9.0` for "< 10%".

---

## Part 3: Database Schema

### New Enum: `data_source`

```typescript
export const dataSourceEnum = pgEnum('data_source', ['api', 'csv_upload']);
```

### New Table: `csv_uploads`

Tracks all upload sessions for audit and history.

```typescript
export const csvUploads = pgTable('csv_uploads', {
  id: uuid('id').primaryKey().defaultRandom(),
  clientAccountId: uuid('client_account_id').notNull().references(() => clientAccounts.id, { onDelete: 'cascade' }),

  // Upload metadata
  uploadSessionId: uuid('upload_session_id').notNull(), // Groups multiple files from same upload
  fileName: varchar('file_name', { length: 255 }).notNull(),
  fileType: varchar('file_type', { length: 50 }).notNull(), // 'google_ads_searches', 'auction_insights', etc.
  fileSize: integer('file_size').notNull(),
  rowCount: integer('row_count').default(0),

  // Date range (extracted from filename)
  dateRangeStart: date('date_range_start'),
  dateRangeEnd: date('date_range_end'),

  // Status
  status: varchar('status', { length: 20 }).default('processing'), // 'processing', 'completed', 'failed', 'skipped'
  errorMessage: text('error_message'),

  // Audit
  uploadedBy: uuid('uploaded_by').references(() => users.id),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
}, (table) => ({
  clientIdx: index('idx_csv_uploads_client').on(table.clientAccountId),
  sessionIdx: index('idx_csv_uploads_session').on(table.uploadSessionId),
  typeIdx: index('idx_csv_uploads_type').on(table.fileType),
  statusIdx: index('idx_csv_uploads_status').on(table.status),
}));
```

### New Table: `auction_insights` (Tier 1)

```typescript
export const auctionInsights = pgTable('auction_insights', {
  id: uuid('id').primaryKey().defaultRandom(),
  clientAccountId: uuid('client_account_id').notNull().references(() => clientAccounts.id, { onDelete: 'cascade' }),

  // Competitor identification
  competitorDomain: varchar('competitor_domain', { length: 255 }).notNull(),
  isOwnAccount: boolean('is_own_account').default(false), // "You" row

  // Date range this data covers
  dateRangeStart: date('date_range_start').notNull(),
  dateRangeEnd: date('date_range_end').notNull(),

  // Auction metrics (stored as percentages, e.g., 13.73 for 13.73%)
  impressionShare: decimal('impression_share', { precision: 5, scale: 2 }),
  outrankingShare: decimal('outranking_share', { precision: 5, scale: 2 }),
  overlapRate: decimal('overlap_rate', { precision: 5, scale: 2 }),
  topOfPageRate: decimal('top_of_page_rate', { precision: 5, scale: 2 }),
  positionAboveRate: decimal('position_above_rate', { precision: 5, scale: 2 }),
  absTopOfPageRate: decimal('abs_top_of_page_rate', { precision: 5, scale: 2 }),

  // Flag for "< 10%" values (stored as null, this flag indicates it was present but below threshold)
  impressionShareBelowThreshold: boolean('impression_share_below_threshold').default(false),

  // Data source
  dataSource: dataSourceEnum('data_source').default('csv_upload'),

  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
}, (table) => ({
  clientIdx: index('idx_auction_insights_client').on(table.clientAccountId),
  competitorIdx: index('idx_auction_insights_competitor').on(table.competitorDomain),
  dateRangeIdx: index('idx_auction_insights_date_range').on(table.dateRangeStart, table.dateRangeEnd),
  uniqueIdx: uniqueIndex('idx_auction_insights_unique').on(
    table.clientAccountId,
    table.competitorDomain,
    table.dateRangeStart,
    table.dateRangeEnd
  ),
}));
```

### New Table: `campaign_metrics` (Tier 2)

```typescript
export const campaignMetrics = pgTable('campaign_metrics', {
  id: uuid('id').primaryKey().defaultRandom(),
  clientAccountId: uuid('client_account_id').notNull().references(() => clientAccounts.id, { onDelete: 'cascade' }),

  campaignName: varchar('campaign_name', { length: 255 }).notNull(),
  campaignGroupName: varchar('campaign_group_name', { length: 255 }),
  campaignStatus: varchar('campaign_status', { length: 20 }), // 'Enabled', 'Paused'

  // Date range
  dateRangeStart: date('date_range_start').notNull(),
  dateRangeEnd: date('date_range_end').notNull(),

  // Metrics
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
```

### New Table: `device_metrics` (Tier 2)

```typescript
export const deviceMetrics = pgTable('device_metrics', {
  id: uuid('id').primaryKey().defaultRandom(),
  clientAccountId: uuid('client_account_id').notNull().references(() => clientAccounts.id, { onDelete: 'cascade' }),

  device: varchar('device', { length: 50 }).notNull(), // 'Computers', 'Mobile Phones', 'Tablets', 'TV screens'

  // Date range
  dateRangeStart: date('date_range_start').notNull(),
  dateRangeEnd: date('date_range_end').notNull(),

  // Metrics
  impressions: integer('impressions').default(0),
  clicks: integer('clicks').default(0),
  costMicros: bigint('cost_micros', { mode: 'number' }).default(0),

  dataSource: dataSourceEnum('data_source').default('csv_upload'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
}, (table) => ({
  clientIdx: index('idx_device_metrics_client').on(table.clientAccountId),
  deviceIdx: index('idx_device_metrics_device').on(table.device),
}));
```

### New Table: `daily_account_metrics` (Tier 2)

```typescript
export const dailyAccountMetrics = pgTable('daily_account_metrics', {
  id: uuid('id').primaryKey().defaultRandom(),
  clientAccountId: uuid('client_account_id').notNull().references(() => clientAccounts.id, { onDelete: 'cascade' }),

  date: date('date').notNull(),

  // Metrics
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
```

### Extended: `google_ads_queries` table

Add new columns for keyword data:

```typescript
// Add to googleAdsQueries
matchType: varchar('match_type', { length: 20 }), // 'Phrase match', 'Exact match', 'Broad match'
criterionStatus: varchar('criterion_status', { length: 20 }), // 'Enabled', 'Paused', 'Removed'
campaignStatus: varchar('campaign_status', { length: 20 }),
adGroupStatus: varchar('ad_group_status', { length: 20 }),
dataSource: dataSourceEnum('data_source').default('api'),

// For aggregated CSV data (no single date)
dateRangeStart: date('date_range_start'),
dateRangeEnd: date('date_range_end'),
```

---

## Part 4: Implementation Tasks

### Task 1: Create Database Migration

**File**: `apps/api/drizzle/0008_csv_upload_support.sql`

```sql
-- Add data source enum
CREATE TYPE data_source AS ENUM ('api', 'csv_upload');

-- ============================================================================
-- CSV UPLOADS TRACKING
-- ============================================================================

CREATE TABLE csv_uploads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_account_id UUID NOT NULL REFERENCES client_accounts(id) ON DELETE CASCADE,
  upload_session_id UUID NOT NULL,
  file_name VARCHAR(255) NOT NULL,
  file_type VARCHAR(50) NOT NULL,
  file_size INTEGER NOT NULL,
  row_count INTEGER DEFAULT 0,
  date_range_start DATE,
  date_range_end DATE,
  status VARCHAR(20) DEFAULT 'processing',
  error_message TEXT,
  uploaded_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_csv_uploads_client ON csv_uploads(client_account_id);
CREATE INDEX idx_csv_uploads_session ON csv_uploads(upload_session_id);
CREATE INDEX idx_csv_uploads_type ON csv_uploads(file_type);
CREATE INDEX idx_csv_uploads_status ON csv_uploads(status);

-- ============================================================================
-- TIER 1: AUCTION INSIGHTS (COMPETITOR DATA)
-- ============================================================================
--
-- Google Ads Auction Insights can be exported at multiple levels:
-- - Account level (no segment columns)
-- - Campaign level (campaign_name populated)
-- - Ad Group level (campaign_name + ad_group_name populated)
-- - Keyword level (campaign_name + ad_group_name + keyword populated)
--
-- For the multi-agent system to work correctly per the spec, we need
-- KEYWORD-LEVEL auction insights to provide per-battleground-keyword
-- competitive metrics. Encourage users to export at keyword level.
-- ============================================================================

CREATE TABLE auction_insights (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_account_id UUID NOT NULL REFERENCES client_accounts(id) ON DELETE CASCADE,

  -- Segment columns (determines granularity level)
  campaign_name VARCHAR(255),          -- Populated for campaign/ad_group/keyword level
  ad_group_name VARCHAR(255),          -- Populated for ad_group/keyword level
  keyword VARCHAR(500),                -- Populated for keyword level (most granular)
  keyword_match_type VARCHAR(20),      -- 'Exact', 'Phrase', 'Broad' (for keyword level)

  -- Competitor identification
  competitor_domain VARCHAR(255) NOT NULL,
  is_own_account BOOLEAN DEFAULT FALSE,

  -- Date range
  date_range_start DATE NOT NULL,
  date_range_end DATE NOT NULL,

  -- Core competitive metrics (per spec)
  impression_share DECIMAL(5, 2),           -- Search Impression Share
  lost_impression_share_rank DECIMAL(5, 2), -- Search Lost IS (Rank)
  lost_impression_share_budget DECIMAL(5, 2), -- Search Lost IS (Budget)

  -- Additional competitive metrics
  outranking_share DECIMAL(5, 2),
  overlap_rate DECIMAL(5, 2),
  top_of_page_rate DECIMAL(5, 2),
  position_above_rate DECIMAL(5, 2),
  abs_top_of_page_rate DECIMAL(5, 2),
  impression_share_below_threshold BOOLEAN DEFAULT FALSE,

  data_source data_source DEFAULT 'csv_upload',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_auction_insights_client ON auction_insights(client_account_id);
CREATE INDEX idx_auction_insights_competitor ON auction_insights(competitor_domain);
CREATE INDEX idx_auction_insights_date_range ON auction_insights(date_range_start, date_range_end);
CREATE INDEX idx_auction_insights_keyword ON auction_insights(keyword);
CREATE INDEX idx_auction_insights_campaign ON auction_insights(campaign_name);

-- Unique constraint depends on granularity level - use all segment columns
CREATE UNIQUE INDEX idx_auction_insights_unique ON auction_insights(
  client_account_id,
  COALESCE(campaign_name, ''),
  COALESCE(ad_group_name, ''),
  COALESCE(keyword, ''),
  competitor_domain,
  date_range_start,
  date_range_end
);

-- ============================================================================
-- TIER 2: CAMPAIGN METRICS
-- ============================================================================

CREATE TABLE campaign_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_account_id UUID NOT NULL REFERENCES client_accounts(id) ON DELETE CASCADE,
  campaign_name VARCHAR(255) NOT NULL,
  campaign_group_name VARCHAR(255),
  campaign_status VARCHAR(20),
  date_range_start DATE NOT NULL,
  date_range_end DATE NOT NULL,
  impressions INTEGER DEFAULT 0,
  clicks INTEGER DEFAULT 0,
  cost_micros BIGINT DEFAULT 0,
  ctr DECIMAL(5, 4),
  data_source data_source DEFAULT 'csv_upload',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_campaign_metrics_client ON campaign_metrics(client_account_id);
CREATE INDEX idx_campaign_metrics_campaign ON campaign_metrics(campaign_name);

-- ============================================================================
-- TIER 2: DEVICE METRICS
-- ============================================================================

CREATE TABLE device_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_account_id UUID NOT NULL REFERENCES client_accounts(id) ON DELETE CASCADE,
  device VARCHAR(50) NOT NULL,
  date_range_start DATE NOT NULL,
  date_range_end DATE NOT NULL,
  impressions INTEGER DEFAULT 0,
  clicks INTEGER DEFAULT 0,
  cost_micros BIGINT DEFAULT 0,
  data_source data_source DEFAULT 'csv_upload',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_device_metrics_client ON device_metrics(client_account_id);
CREATE INDEX idx_device_metrics_device ON device_metrics(device);

-- ============================================================================
-- TIER 2: DAILY ACCOUNT METRICS
-- ============================================================================

CREATE TABLE daily_account_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_account_id UUID NOT NULL REFERENCES client_accounts(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  impressions INTEGER DEFAULT 0,
  clicks INTEGER DEFAULT 0,
  cost_micros BIGINT DEFAULT 0,
  avg_cpc_micros BIGINT,
  data_source data_source DEFAULT 'csv_upload',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_daily_account_metrics_client ON daily_account_metrics(client_account_id);
CREATE INDEX idx_daily_account_metrics_date ON daily_account_metrics(date);
CREATE UNIQUE INDEX idx_daily_account_metrics_unique ON daily_account_metrics(client_account_id, date);

-- ============================================================================
-- EXTEND EXISTING TABLES
-- ============================================================================

-- Add data source and keyword fields to google_ads_queries
ALTER TABLE google_ads_queries
ADD COLUMN data_source data_source DEFAULT 'api',
ADD COLUMN match_type VARCHAR(20),
ADD COLUMN criterion_status VARCHAR(20),
ADD COLUMN campaign_status VARCHAR(20),
ADD COLUMN ad_group_status VARCHAR(20),
ADD COLUMN date_range_start DATE,
ADD COLUMN date_range_end DATE;

-- Note: Search Console data is fetched via OAuth API, no CSV upload needed
```

### Task 2: Install Dependencies

```bash
# Backend
cd apps/api
npm install papaparse multer
npm install -D @types/papaparse @types/multer

# Frontend
cd apps/web
npm install react-dropzone papaparse
npm install -D @types/papaparse
```

### Task 3: Create File Detection Utility

**File**: `apps/api/src/utils/csv-file-detector.ts`

```typescript
export type GoogleAdsReportType =
  | 'google_ads_searches'
  | 'google_ads_keywords'
  | 'auction_insights'
  | 'campaigns'
  | 'devices'
  | 'time_series'
  | 'skip';

// Note: Search Console data is fetched via OAuth API integration, not CSV upload

interface FileDetectionResult {
  type: GoogleAdsReportType;
  tier: 1 | 2 | 3;
  shouldStore: boolean;
  description: string;
}

const GOOGLE_ADS_PATTERNS: Array<{ pattern: RegExp; result: FileDetectionResult }> = [
  // Tier 1: Essential
  {
    pattern: /^Searches?\(Search_/i,
    result: { type: 'google_ads_searches', tier: 1, shouldStore: true, description: 'Search Terms' },
  },
  {
    pattern: /^Search_keywords\(/i,
    result: { type: 'google_ads_keywords', tier: 1, shouldStore: true, description: 'Keywords' },
  },
  {
    pattern: /^Auction_insights\(Compare/i,
    result: { type: 'auction_insights', tier: 1, shouldStore: true, description: 'Auction Insights' },
  },

  // Tier 2: Contextual
  {
    pattern: /^Campaigns\(/i,
    result: { type: 'campaigns', tier: 2, shouldStore: true, description: 'Campaigns' },
  },
  {
    pattern: /^Devices\(/i,
    result: { type: 'devices', tier: 2, shouldStore: true, description: 'Devices' },
  },
  {
    pattern: /^Time_series\(/i,
    result: { type: 'time_series', tier: 2, shouldStore: true, description: 'Daily Trends' },
  },

  // Tier 3: Skip
  {
    pattern: /^Searches?\(Word_/i,
    result: { type: 'skip', tier: 3, shouldStore: false, description: 'Word Analysis' },
  },
  {
    pattern: /^Demographics\(/i,
    result: { type: 'skip', tier: 3, shouldStore: false, description: 'Demographics' },
  },
  {
    pattern: /^Day_&_hour\(/i,
    result: { type: 'skip', tier: 3, shouldStore: false, description: 'Day & Hour' },
  },
  {
    pattern: /^Networks\(/i,
    result: { type: 'skip', tier: 3, shouldStore: false, description: 'Networks' },
  },
  {
    pattern: /^Biggest_changes\(/i,
    result: { type: 'skip', tier: 3, shouldStore: false, description: 'Biggest Changes' },
  },
  {
    pattern: /^Optimisation_score\(/i,
    result: { type: 'skip', tier: 3, shouldStore: false, description: 'Optimisation Score' },
  },
  {
    pattern: /^Auction_insights\(Metric/i,
    result: { type: 'skip', tier: 3, shouldStore: false, description: 'Auction Trends' },
  },
];

/**
 * Detect the type of Google Ads report from filename
 */
export function detectGoogleAdsReportType(filename: string): FileDetectionResult | null {
  for (const { pattern, result } of GOOGLE_ADS_PATTERNS) {
    if (pattern.test(filename)) {
      return result;
    }
  }
  return null;
}

/**
 * Parse date range from filename
 * Format: Searches(Search_2025.11.01-2025.11.30).csv
 */
export function parseDateRangeFromFilename(filename: string): { start: string; end: string } | null {
  const match = filename.match(/(\d{4}\.\d{2}\.\d{2})-(\d{4}\.\d{2}\.\d{2})/);
  if (!match) return null;

  // Convert 2025.11.01 to 2025-11-01
  const start = match[1].replace(/\./g, '-');
  const end = match[2].replace(/\./g, '-');

  return { start, end };
}
```

### Task 4: Create Column Mapper Utility

**File**: `apps/api/src/utils/csv-column-mapper.ts`

```typescript
export interface ColumnMapping {
  [csvColumn: string]: string;
}

// ============================================================================
// TIER 1: ESSENTIAL
// ============================================================================

export const GOOGLE_ADS_SEARCHES_COLUMNS: ColumnMapping = {
  'Search': 'queryText',
  'Search term': 'queryText',
  'Search Term': 'queryText',
  'Cost': 'cost',
  'Clicks': 'clicks',
  'Impressions': 'impressions',
  'Impr.': 'impressions',
  'Conversions': 'conversions',
  'Conv.': 'conversions',
  'Day': 'date',
  'Date': 'date',
};

export const GOOGLE_ADS_KEYWORDS_COLUMNS: ColumnMapping = {
  'Search Keyword': 'queryText',
  'Keyword': 'queryText',
  'Match type': 'matchType',
  'Match Type': 'matchType',
  'Criterion Status': 'criterionStatus',
  'Status': 'criterionStatus',
  'Campaign Status': 'campaignStatus',
  'Ad Group Status': 'adGroupStatus',
  'Cost': 'cost',
  'Clicks': 'clicks',
  'CTR': 'ctr',
  'Impressions': 'impressions',
  'Impr.': 'impressions',
};

export const AUCTION_INSIGHTS_COLUMNS: ColumnMapping = {
  'Advertiser Name': 'competitorDomain',
  'Advertiser': 'competitorDomain',
  'Display URL domain': 'competitorDomain',
  'Impression share': 'impressionShare',
  'Impression share (Comparison)': 'impressionShareComparison',
  'Outranking share': 'outrankingShare',
  'Outranking share (Comparison)': 'outrankingShareComparison',
  'Overlap rate': 'overlapRate',
  'Overlap rate (Comparison)': 'overlapRateComparison',
  'Top of page rate': 'topOfPageRate',
  'Top of page rate (Comparison)': 'topOfPageRateComparison',
  'Position above rate': 'positionAboveRate',
  'Position above rate (Comparison)': 'positionAboveRateComparison',
  'Abs. top of page rate': 'absTopOfPageRate',
};

// ============================================================================
// TIER 2: CONTEXTUAL
// ============================================================================

export const CAMPAIGNS_COLUMNS: ColumnMapping = {
  'Campaign Name': 'campaignName',
  'Campaign': 'campaignName',
  'Campaign Group Name': 'campaignGroupName',
  'Campaign Status': 'campaignStatus',
  'Status': 'campaignStatus',
  'Cost': 'cost',
  'Clicks': 'clicks',
  'Impressions': 'impressions',
  'CTR': 'ctr',
};

export const DEVICES_COLUMNS: ColumnMapping = {
  'Device': 'device',
  'Cost': 'cost',
  'Clicks': 'clicks',
  'Impressions': 'impressions',
};

export const TIME_SERIES_COLUMNS: ColumnMapping = {
  'Date': 'date',
  'Day': 'date',
  'Clicks': 'clicks',
  'Impressions': 'impressions',
  'Cost': 'cost',
  'Avg. CPC': 'avgCpc',
  'Average CPC': 'avgCpc',
};

// Note: Search Console data is fetched via OAuth API integration, not CSV upload

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Normalize a CSV header to our internal field name
 */
export function normalizeColumnName(header: string, mapping: ColumnMapping): string {
  const trimmed = header.trim();
  return mapping[trimmed] || trimmed.toLowerCase().replace(/\s+/g, '_');
}

/**
 * Parse currency string to number (removes $ and commas)
 * "$1,234.56" → 1234.56
 */
export function parseCurrency(value: string | undefined): number {
  if (!value) return 0;
  return parseFloat(value.replace(/[$,]/g, '')) || 0;
}

/**
 * Parse currency to micros (Google Ads uses micros for currency)
 * "$1,234.56" → 1234560000
 */
export function parseCurrencyToMicros(value: string | undefined): number {
  return Math.round(parseCurrency(value) * 1_000_000);
}

/**
 * Parse percentage string to number
 * "8.57%" → 8.57 (or 0.0857 if asDecimal=true)
 */
export function parsePercentage(value: string | undefined, asDecimal: boolean = false): number | null {
  if (!value || value === 'No data') return null;

  // Handle "< 10%" type values
  if (value.includes('<')) return null;

  const num = parseFloat(value.replace('%', ''));
  if (isNaN(num)) return null;

  return asDecimal ? num / 100 : num;
}

/**
 * Check if a percentage value is "< X%" (below threshold)
 */
export function isBelowThreshold(value: string | undefined): boolean {
  return !!value && value.includes('<');
}

/**
 * Parse date from various formats
 * "Sat, 1 Nov 2025" → "2025-11-01"
 * "2025.11.01" → "2025-11-01"
 */
export function parseDate(value: string | undefined): string | null {
  if (!value) return null;

  // Try parsing "Sat, 1 Nov 2025" format
  const longMatch = value.match(/(\d{1,2})\s+(\w+)\s+(\d{4})/);
  if (longMatch) {
    const [, day, monthName, year] = longMatch;
    const months: Record<string, string> = {
      'Jan': '01', 'Feb': '02', 'Mar': '03', 'Apr': '04',
      'May': '05', 'Jun': '06', 'Jul': '07', 'Aug': '08',
      'Sep': '09', 'Oct': '10', 'Nov': '11', 'Dec': '12',
    };
    const month = months[monthName];
    if (month) {
      return `${year}-${month}-${day.padStart(2, '0')}`;
    }
  }

  // Try parsing "2025.11.01" format
  const dotMatch = value.match(/(\d{4})\.(\d{2})\.(\d{2})/);
  if (dotMatch) {
    const [, year, month, day] = dotMatch;
    return `${year}-${month}-${day}`;
  }

  // Try parsing ISO format "2025-11-01"
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return value;
  }

  return null;
}

/**
 * Parse integer with comma separators
 * "11,423" → 11423
 */
export function parseInteger(value: string | undefined): number {
  if (!value) return 0;
  return parseInt(value.replace(/,/g, ''), 10) || 0;
}
```

### Task 5: Create CSV Import Service

**File**: `apps/api/src/services/csv-import.service.ts`

```typescript
import Papa from 'papaparse';
import { v4 as uuidv4 } from 'uuid';
import { db } from '@/db';
import {
  csvUploads,
  searchQueries,
  googleAdsQueries,
  auctionInsights,
  campaignMetrics,
  deviceMetrics,
  dailyAccountMetrics,
} from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import { logger } from '@/utils/logger';
import {
  detectGoogleAdsReportType,
  parseDateRangeFromFilename,
  GoogleAdsReportType,
} from '@/utils/csv-file-detector';
import {
  GOOGLE_ADS_SEARCHES_COLUMNS,
  GOOGLE_ADS_KEYWORDS_COLUMNS,
  AUCTION_INSIGHTS_COLUMNS,
  CAMPAIGNS_COLUMNS,
  DEVICES_COLUMNS,
  TIME_SERIES_COLUMNS,
  normalizeColumnName,
  parseCurrency,
  parseCurrencyToMicros,
  parsePercentage,
  parseInteger,
  parseDate,
  isBelowThreshold,
} from '@/utils/csv-column-mapper';
import { normalizeQuery, hashQuery } from '@/services/query-matcher.service';

// ============================================================================
// TYPES
// ============================================================================

export interface UploadSessionResult {
  sessionId: string;
  totalFiles: number;
  imported: ImportedFile[];
  skipped: SkippedFile[];
  failed: FailedFile[];
  dateRange: { start: string; end: string } | null;
}

interface ImportedFile {
  fileName: string;
  fileType: string;
  description: string;
  rowCount: number;
}

interface SkippedFile {
  fileName: string;
  reason: string;
}

interface FailedFile {
  fileName: string;
  error: string;
}

// ============================================================================
// MAIN UPLOAD HANDLER
// ============================================================================

/**
 * Process multiple files in a single upload session
 */
export async function processUploadSession(
  clientAccountId: string,
  files: Array<{ buffer: Buffer; filename: string; size: number }>,
  uploadedBy: string
): Promise<UploadSessionResult> {
  const sessionId = uuidv4();
  const result: UploadSessionResult = {
    sessionId,
    totalFiles: files.length,
    imported: [],
    skipped: [],
    failed: [],
    dateRange: null,
  };

  logger.info({ sessionId, fileCount: files.length }, 'Starting upload session');

  for (const file of files) {
    try {
      const detection = detectGoogleAdsReportType(file.filename);

      if (!detection) {
        result.skipped.push({
          fileName: file.filename,
          reason: 'Unrecognized file format',
        });
        continue;
      }

      if (!detection.shouldStore) {
        // Tier 3: Validate but don't store
        await createUploadRecord(clientAccountId, sessionId, file, detection.type, 'skipped', uploadedBy);
        result.skipped.push({
          fileName: file.filename,
          reason: `${detection.description} (not needed for analysis)`,
        });
        continue;
      }

      // Extract date range from filename
      const dateRange = parseDateRangeFromFilename(file.filename);
      if (dateRange && !result.dateRange) {
        result.dateRange = dateRange;
      }

      // Process based on file type
      const importResult = await processFile(
        clientAccountId,
        sessionId,
        file,
        detection.type,
        dateRange,
        uploadedBy
      );

      result.imported.push({
        fileName: file.filename,
        fileType: detection.type,
        description: detection.description,
        rowCount: importResult.rowCount,
      });

    } catch (error) {
      logger.error({ error, fileName: file.filename }, 'Failed to process file');
      result.failed.push({
        fileName: file.filename,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  logger.info(
    {
      sessionId,
      imported: result.imported.length,
      skipped: result.skipped.length,
      failed: result.failed.length,
    },
    'Upload session complete'
  );

  return result;
}

/**
 * Process a single file based on its type
 */
async function processFile(
  clientAccountId: string,
  sessionId: string,
  file: { buffer: Buffer; filename: string; size: number },
  fileType: GoogleAdsReportType,
  dateRange: { start: string; end: string } | null,
  uploadedBy: string
): Promise<{ rowCount: number }> {
  const csvText = file.buffer.toString('utf-8');

  switch (fileType) {
    case 'google_ads_searches':
      return importGoogleAdsSearches(clientAccountId, sessionId, file, csvText, dateRange, uploadedBy);
    case 'google_ads_keywords':
      return importGoogleAdsKeywords(clientAccountId, sessionId, file, csvText, dateRange, uploadedBy);
    case 'auction_insights':
      return importAuctionInsights(clientAccountId, sessionId, file, csvText, dateRange, uploadedBy);
    case 'campaigns':
      return importCampaigns(clientAccountId, sessionId, file, csvText, dateRange, uploadedBy);
    case 'devices':
      return importDevices(clientAccountId, sessionId, file, csvText, dateRange, uploadedBy);
    case 'time_series':
      return importTimeSeries(clientAccountId, sessionId, file, csvText, uploadedBy);
    default:
      throw new Error(`Unsupported file type: ${fileType}`);
  }
}

// ============================================================================
// TIER 1 IMPORTERS
// ============================================================================

async function importGoogleAdsSearches(
  clientAccountId: string,
  sessionId: string,
  file: { buffer: Buffer; filename: string; size: number },
  csvText: string,
  dateRange: { start: string; end: string } | null,
  uploadedBy: string
): Promise<{ rowCount: number }> {
  const parsed = Papa.parse(csvText, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h) => normalizeColumnName(h, GOOGLE_ADS_SEARCHES_COLUMNS),
  });

  let rowCount = 0;

  for (const row of parsed.data as any[]) {
    if (!row.queryText) continue;

    // Normalize and hash query
    const queryNormalized = normalizeQuery(row.queryText);
    const queryHash = hashQuery(queryNormalized);

    // Upsert search query
    await db
      .insert(searchQueries)
      .values({
        clientAccountId,
        queryText: row.queryText,
        queryNormalized,
        queryHash,
      })
      .onConflictDoNothing();

    // Get the search query ID
    const [existingQuery] = await db
      .select()
      .from(searchQueries)
      .where(and(
        eq(searchQueries.clientAccountId, clientAccountId),
        eq(searchQueries.queryHash, queryHash)
      ))
      .limit(1);

    if (!existingQuery) continue;

    // Insert Google Ads query data
    await db
      .insert(googleAdsQueries)
      .values({
        clientAccountId,
        searchQueryId: existingQuery.id,
        date: row.date ? parseDate(row.date) : dateRange?.end || new Date().toISOString().split('T')[0],
        dateRangeStart: dateRange?.start,
        dateRangeEnd: dateRange?.end,
        impressions: parseInteger(row.impressions),
        clicks: parseInteger(row.clicks),
        costMicros: parseCurrencyToMicros(row.cost),
        conversions: row.conversions || '0',
        dataSource: 'csv_upload',
      })
      .onConflictDoNothing();

    rowCount++;
  }

  await createUploadRecord(clientAccountId, sessionId, file, 'google_ads_searches', 'completed', uploadedBy, rowCount, dateRange);
  return { rowCount };
}

async function importGoogleAdsKeywords(
  clientAccountId: string,
  sessionId: string,
  file: { buffer: Buffer; filename: string; size: number },
  csvText: string,
  dateRange: { start: string; end: string } | null,
  uploadedBy: string
): Promise<{ rowCount: number }> {
  const parsed = Papa.parse(csvText, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h) => normalizeColumnName(h, GOOGLE_ADS_KEYWORDS_COLUMNS),
  });

  let rowCount = 0;

  for (const row of parsed.data as any[]) {
    if (!row.queryText) continue;

    const queryNormalized = normalizeQuery(row.queryText);
    const queryHash = hashQuery(queryNormalized);

    await db
      .insert(searchQueries)
      .values({
        clientAccountId,
        queryText: row.queryText,
        queryNormalized,
        queryHash,
      })
      .onConflictDoNothing();

    const [existingQuery] = await db
      .select()
      .from(searchQueries)
      .where(and(
        eq(searchQueries.clientAccountId, clientAccountId),
        eq(searchQueries.queryHash, queryHash)
      ))
      .limit(1);

    if (!existingQuery) continue;

    await db
      .insert(googleAdsQueries)
      .values({
        clientAccountId,
        searchQueryId: existingQuery.id,
        date: dateRange?.end || new Date().toISOString().split('T')[0],
        dateRangeStart: dateRange?.start,
        dateRangeEnd: dateRange?.end,
        clicks: parseInteger(row.clicks),
        costMicros: parseCurrencyToMicros(row.cost),
        ctr: parsePercentage(row.ctr, true)?.toString() || null,
        matchType: row.matchType,
        criterionStatus: row.criterionStatus,
        campaignStatus: row.campaignStatus,
        adGroupStatus: row.adGroupStatus,
        dataSource: 'csv_upload',
      })
      .onConflictDoNothing();

    rowCount++;
  }

  await createUploadRecord(clientAccountId, sessionId, file, 'google_ads_keywords', 'completed', uploadedBy, rowCount, dateRange);
  return { rowCount };
}

async function importAuctionInsights(
  clientAccountId: string,
  sessionId: string,
  file: { buffer: Buffer; filename: string; size: number },
  csvText: string,
  dateRange: { start: string; end: string } | null,
  uploadedBy: string
): Promise<{ rowCount: number }> {
  if (!dateRange) {
    throw new Error('Date range required for auction insights');
  }

  const parsed = Papa.parse(csvText, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h) => normalizeColumnName(h, AUCTION_INSIGHTS_COLUMNS),
  });

  let rowCount = 0;

  for (const row of parsed.data as any[]) {
    if (!row.competitorDomain) continue;

    const isOwnAccount = row.competitorDomain.toLowerCase() === 'you';

    await db
      .insert(auctionInsights)
      .values({
        clientAccountId,
        competitorDomain: row.competitorDomain,
        isOwnAccount,
        dateRangeStart: dateRange.start,
        dateRangeEnd: dateRange.end,
        impressionShare: parsePercentage(row.impressionShare),
        outrankingShare: parsePercentage(row.outrankingShare),
        overlapRate: parsePercentage(row.overlapRate),
        topOfPageRate: parsePercentage(row.topOfPageRate),
        positionAboveRate: parsePercentage(row.positionAboveRate),
        absTopOfPageRate: parsePercentage(row.absTopOfPageRate),
        impressionShareBelowThreshold: isBelowThreshold(row.impressionShare),
        dataSource: 'csv_upload',
      })
      .onConflictDoUpdate({
        target: [auctionInsights.clientAccountId, auctionInsights.competitorDomain, auctionInsights.dateRangeStart, auctionInsights.dateRangeEnd],
        set: {
          impressionShare: parsePercentage(row.impressionShare),
          outrankingShare: parsePercentage(row.outrankingShare),
          overlapRate: parsePercentage(row.overlapRate),
          topOfPageRate: parsePercentage(row.topOfPageRate),
          positionAboveRate: parsePercentage(row.positionAboveRate),
          impressionShareBelowThreshold: isBelowThreshold(row.impressionShare),
          updatedAt: new Date(),
        },
      });

    rowCount++;
  }

  await createUploadRecord(clientAccountId, sessionId, file, 'auction_insights', 'completed', uploadedBy, rowCount, dateRange);
  return { rowCount };
}

// ============================================================================
// TIER 2 IMPORTERS
// ============================================================================

async function importCampaigns(
  clientAccountId: string,
  sessionId: string,
  file: { buffer: Buffer; filename: string; size: number },
  csvText: string,
  dateRange: { start: string; end: string } | null,
  uploadedBy: string
): Promise<{ rowCount: number }> {
  if (!dateRange) {
    throw new Error('Date range required for campaign metrics');
  }

  const parsed = Papa.parse(csvText, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h) => normalizeColumnName(h, CAMPAIGNS_COLUMNS),
  });

  let rowCount = 0;

  for (const row of parsed.data as any[]) {
    if (!row.campaignName) continue;

    await db
      .insert(campaignMetrics)
      .values({
        clientAccountId,
        campaignName: row.campaignName,
        campaignGroupName: row.campaignGroupName,
        campaignStatus: row.campaignStatus,
        dateRangeStart: dateRange.start,
        dateRangeEnd: dateRange.end,
        impressions: parseInteger(row.impressions),
        clicks: parseInteger(row.clicks),
        costMicros: parseCurrencyToMicros(row.cost),
        ctr: parsePercentage(row.ctr, true)?.toString() || null,
        dataSource: 'csv_upload',
      });

    rowCount++;
  }

  await createUploadRecord(clientAccountId, sessionId, file, 'campaigns', 'completed', uploadedBy, rowCount, dateRange);
  return { rowCount };
}

async function importDevices(
  clientAccountId: string,
  sessionId: string,
  file: { buffer: Buffer; filename: string; size: number },
  csvText: string,
  dateRange: { start: string; end: string } | null,
  uploadedBy: string
): Promise<{ rowCount: number }> {
  if (!dateRange) {
    throw new Error('Date range required for device metrics');
  }

  const parsed = Papa.parse(csvText, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h) => normalizeColumnName(h, DEVICES_COLUMNS),
  });

  let rowCount = 0;

  for (const row of parsed.data as any[]) {
    if (!row.device) continue;

    await db
      .insert(deviceMetrics)
      .values({
        clientAccountId,
        device: row.device,
        dateRangeStart: dateRange.start,
        dateRangeEnd: dateRange.end,
        impressions: parseInteger(row.impressions),
        clicks: parseInteger(row.clicks),
        costMicros: parseCurrencyToMicros(row.cost),
        dataSource: 'csv_upload',
      });

    rowCount++;
  }

  await createUploadRecord(clientAccountId, sessionId, file, 'devices', 'completed', uploadedBy, rowCount, dateRange);
  return { rowCount };
}

async function importTimeSeries(
  clientAccountId: string,
  sessionId: string,
  file: { buffer: Buffer; filename: string; size: number },
  csvText: string,
  uploadedBy: string
): Promise<{ rowCount: number }> {
  const parsed = Papa.parse(csvText, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h) => normalizeColumnName(h, TIME_SERIES_COLUMNS),
  });

  let rowCount = 0;
  let minDate: string | null = null;
  let maxDate: string | null = null;

  for (const row of parsed.data as any[]) {
    const date = parseDate(row.date);
    if (!date) continue;

    if (!minDate || date < minDate) minDate = date;
    if (!maxDate || date > maxDate) maxDate = date;

    await db
      .insert(dailyAccountMetrics)
      .values({
        clientAccountId,
        date,
        impressions: parseInteger(row.impressions),
        clicks: parseInteger(row.clicks),
        costMicros: parseCurrencyToMicros(row.cost),
        avgCpcMicros: parseCurrencyToMicros(row.avgCpc),
        dataSource: 'csv_upload',
      })
      .onConflictDoUpdate({
        target: [dailyAccountMetrics.clientAccountId, dailyAccountMetrics.date],
        set: {
          impressions: parseInteger(row.impressions),
          clicks: parseInteger(row.clicks),
          costMicros: parseCurrencyToMicros(row.cost),
          avgCpcMicros: parseCurrencyToMicros(row.avgCpc),
        },
      });

    rowCount++;
  }

  const dateRange = minDate && maxDate ? { start: minDate, end: maxDate } : null;
  await createUploadRecord(clientAccountId, sessionId, file, 'time_series', 'completed', uploadedBy, rowCount, dateRange);
  return { rowCount };
}

// ============================================================================
// HELPERS
// ============================================================================

async function createUploadRecord(
  clientAccountId: string,
  sessionId: string,
  file: { buffer: Buffer; filename: string; size: number },
  fileType: string,
  status: string,
  uploadedBy: string,
  rowCount: number = 0,
  dateRange?: { start: string; end: string } | null
): Promise<void> {
  await db.insert(csvUploads).values({
    clientAccountId,
    uploadSessionId: sessionId,
    fileName: file.filename,
    fileType,
    fileSize: file.size,
    rowCount,
    dateRangeStart: dateRange?.start,
    dateRangeEnd: dateRange?.end,
    status,
    uploadedBy,
  });
}
```

### Task 6: Create Upload Routes

**File**: `apps/api/src/routes/csv-upload.routes.ts`

```typescript
import { Router } from 'express';
import multer from 'multer';
import { authenticate } from '@/middleware/auth.middleware';
import { processUploadSession } from '@/services/csv-import.service';
import { db } from '@/db';
import { csvUploads } from '@/db/schema';
import { eq, desc } from 'drizzle-orm';
import { logger } from '@/utils/logger';

const router = Router();

// Configure multer for memory storage
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB per file
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'text/csv' || file.originalname.endsWith('.csv')) {
      cb(null, true);
    } else {
      cb(new Error('Only CSV files are allowed'));
    }
  },
});

/**
 * POST /api/clients/:clientId/upload
 * Upload multiple CSV files in a single session
 */
router.post(
  '/clients/:clientId/upload',
  authenticate,
  upload.array('files', 20), // Max 20 files
  async (req, res) => {
    try {
      const { clientId } = req.params;
      const files = req.files as Express.Multer.File[];

      if (!files || files.length === 0) {
        return res.status(400).json({ error: 'No files uploaded' });
      }

      const fileData = files.map((f) => ({
        buffer: f.buffer,
        filename: f.originalname,
        size: f.size,
      }));

      const result = await processUploadSession(
        clientId,
        fileData,
        req.user.id
      );

      res.json(result);
    } catch (error) {
      logger.error({ error }, 'Upload failed');
      res.status(500).json({ error: 'Upload failed' });
    }
  }
);

/**
 * GET /api/clients/:clientId/uploads
 * Get upload history for a client
 */
router.get('/clients/:clientId/uploads', authenticate, async (req, res) => {
  try {
    const { clientId } = req.params;

    const uploads = await db
      .select()
      .from(csvUploads)
      .where(eq(csvUploads.clientAccountId, clientId))
      .orderBy(desc(csvUploads.createdAt))
      .limit(50);

    res.json(uploads);
  } catch (error) {
    logger.error({ error }, 'Failed to get upload history');
    res.status(500).json({ error: 'Failed to get upload history' });
  }
});

/**
 * GET /api/clients/:clientId/uploads/:sessionId
 * Get details of a specific upload session
 */
router.get('/clients/:clientId/uploads/:sessionId', authenticate, async (req, res) => {
  try {
    const { clientId, sessionId } = req.params;

    const uploads = await db
      .select()
      .from(csvUploads)
      .where(eq(csvUploads.uploadSessionId, sessionId))
      .orderBy(csvUploads.fileName);

    res.json(uploads);
  } catch (error) {
    logger.error({ error }, 'Failed to get upload session');
    res.status(500).json({ error: 'Failed to get upload session' });
  }
});

export default router;
```

### Task 7: Create Frontend Upload Component

**File**: `apps/web/src/components/upload/CSVUploadZone.tsx`

```typescript
import { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { Upload, FileSpreadsheet, CheckCircle, AlertCircle, Loader2, X } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { apiClient } from '@/lib/api';

interface UploadResult {
  sessionId: string;
  totalFiles: number;
  imported: Array<{
    fileName: string;
    fileType: string;
    description: string;
    rowCount: number;
  }>;
  skipped: Array<{
    fileName: string;
    reason: string;
  }>;
  failed: Array<{
    fileName: string;
    error: string;
  }>;
  dateRange: { start: string; end: string } | null;
}

interface CSVUploadZoneProps {
  clientId: string;
  onUploadComplete?: (result: UploadResult) => void;
}

export function CSVUploadZone({ clientId, onUploadComplete }: CSVUploadZoneProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [result, setResult] = useState<UploadResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    if (acceptedFiles.length === 0) return;

    setIsUploading(true);
    setUploadProgress(0);
    setError(null);
    setResult(null);

    const formData = new FormData();
    acceptedFiles.forEach((file) => {
      formData.append('files', file);
    });

    try {
      const response = await apiClient.post(
        `/api/clients/${clientId}/upload`,
        formData,
        {
          headers: { 'Content-Type': 'multipart/form-data' },
          onUploadProgress: (progressEvent) => {
            const progress = progressEvent.total
              ? Math.round((progressEvent.loaded * 100) / progressEvent.total)
              : 0;
            setUploadProgress(progress);
          },
        }
      );

      setResult(response.data);
      onUploadComplete?.(response.data);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Upload failed');
    } finally {
      setIsUploading(false);
    }
  }, [clientId, onUploadComplete]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'text/csv': ['.csv'] },
    disabled: isUploading,
  });

  const resetUpload = () => {
    setResult(null);
    setError(null);
    setUploadProgress(0);
  };

  // Show results
  if (result) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-green-700">
              <CheckCircle className="h-5 w-5" />
              Upload Complete
            </CardTitle>
            <Button variant="ghost" size="sm" onClick={resetUpload}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Date Range */}
          {result.dateRange && (
            <p className="text-sm text-slate-500">
              Date Range: {result.dateRange.start} to {result.dateRange.end}
            </p>
          )}

          {/* Imported Files */}
          {result.imported.length > 0 && (
            <div>
              <h4 className="text-sm font-medium text-slate-700 mb-2">Imported:</h4>
              <div className="space-y-1">
                {result.imported.map((file, i) => (
                  <div key={i} className="flex items-center gap-2 text-sm">
                    <CheckCircle className="h-4 w-4 text-green-500" />
                    <span className="font-medium">{file.description}</span>
                    <Badge variant="secondary">{file.rowCount} rows</Badge>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Skipped Files */}
          {result.skipped.length > 0 && (
            <div>
              <h4 className="text-sm font-medium text-slate-500 mb-2">
                Skipped (not needed for analysis):
              </h4>
              <p className="text-sm text-slate-400">
                {result.skipped.map((f) => f.reason.split(' (')[0]).join(', ')}
              </p>
            </div>
          )}

          {/* Failed Files */}
          {result.failed.length > 0 && (
            <div>
              <h4 className="text-sm font-medium text-red-600 mb-2">Failed:</h4>
              <div className="space-y-1">
                {result.failed.map((file, i) => (
                  <div key={i} className="flex items-center gap-2 text-sm text-red-600">
                    <AlertCircle className="h-4 w-4" />
                    <span>{file.fileName}: {file.error}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <Button onClick={resetUpload} className="w-full">
            Upload More Files
          </Button>
        </CardContent>
      </Card>
    );
  }

  // Show error
  if (error) {
    return (
      <Card className="border-red-200">
        <CardContent className="py-8 text-center">
          <AlertCircle className="h-12 w-12 mx-auto text-red-500 mb-4" />
          <p className="text-red-700 font-medium mb-2">Upload Failed</p>
          <p className="text-sm text-red-600 mb-4">{error}</p>
          <Button variant="outline" onClick={resetUpload}>
            Try Again
          </Button>
        </CardContent>
      </Card>
    );
  }

  // Show upload zone
  return (
    <Card>
      <CardContent className="p-6">
        <div
          {...getRootProps()}
          className={`
            border-2 border-dashed rounded-lg p-8 text-center cursor-pointer
            transition-colors duration-200
            ${isDragActive ? 'border-blue-500 bg-blue-50' : 'border-slate-300 hover:border-slate-400'}
            ${isUploading ? 'opacity-50 cursor-not-allowed' : ''}
          `}
        >
          <input {...getInputProps()} />

          {isUploading ? (
            <div className="space-y-4">
              <Loader2 className="h-12 w-12 mx-auto text-blue-500 animate-spin" />
              <p className="font-medium text-slate-700">Uploading...</p>
              <Progress value={uploadProgress} className="max-w-xs mx-auto" />
              <p className="text-sm text-slate-500">{uploadProgress}%</p>
            </div>
          ) : (
            <div className="space-y-4">
              <FileSpreadsheet className="h-12 w-12 mx-auto text-slate-400" />
              <div>
                <p className="font-medium text-slate-700">
                  Upload Google Ads Reports
                </p>
                <p className="text-sm text-slate-500 mt-1">
                  {isDragActive
                    ? 'Drop the files here...'
                    : 'Drag and drop CSV files, or click to select'}
                </p>
              </div>
              <div className="text-xs text-slate-400 space-y-1">
                <p>We'll automatically detect and import:</p>
                <p>Search terms • Keywords • Auction insights • Campaigns • Devices • Trends</p>
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
```

---

## Part 5: User Instructions

### Simple Export Instructions

Add this to the UI near the upload zone:

```
📥 How to export from Google Ads:

1. Go to Google Ads → Overview tab
2. Click "Download" icon in the top right
3. Select all reports and download
4. Upload all files here - we'll handle the rest!
```

**Note**: Search Console data is synced automatically via the OAuth integration - no CSV upload needed.

---

## File Structure Summary

After completing Phase 0:

```
apps/api/
├── drizzle/
│   └── 0008_csv_upload_support.sql           # NEW
├── src/
│   ├── db/
│   │   └── schema.ts                          # MODIFIED
│   ├── routes/
│   │   └── csv-upload.routes.ts               # NEW
│   ├── services/
│   │   └── csv-import.service.ts              # NEW
│   └── utils/
│       ├── csv-file-detector.ts               # NEW
│       └── csv-column-mapper.ts               # NEW

apps/web/src/
├── components/
│   └── upload/
│       └── CSVUploadZone.tsx                  # NEW
```

---

## Success Criteria

### Upload Flow
- [ ] User can upload multiple CSV files at once
- [ ] Files are automatically detected by filename pattern
- [ ] Tier 1 files (Search, Keywords, Auction Insights) are stored
- [ ] Tier 2 files (Campaigns, Devices, Time Series) are stored
- [ ] Tier 3 files (Demographics, Word Analysis, etc.) are skipped gracefully
- [ ] Upload result shows what was imported vs skipped
- [ ] Date range extracted from filenames automatically

### Data Import
- [ ] Search terms import correctly (101 rows from sample)
- [ ] Keywords import with match type (31 rows from sample)
- [ ] Auction insights import with competitor data (8 competitors from sample)
- [ ] Campaigns import (4 campaigns from sample)
- [ ] Devices import (4 device types from sample)
- [ ] Time series import (30 days from sample)

### Special Cases
- [ ] "< 10%" values stored as null with `below_threshold` flag
- [ ] "No data" values stored as null
- [ ] Currency parsed correctly ($1,234.56 → 1234560000 micros)
- [ ] Percentages parsed correctly (8.57% → 8.57)
- [ ] Dates parsed from "Sat, 1 Nov 2025" format

### Schema
- [ ] Migration runs without errors
- [ ] All new tables created
- [ ] `data_source` column added to existing tables
- [ ] Indexes created for performance

---

## Next Steps

After Phase 0 is complete, the recommended order is:

```
Phase 0 (done) → Phase 4 → Phase 1 → Phase 2 → Phase 3 → Phase 5
```

1. **Phase 4** (Multi-Agent System) - Uses the data structures created here:
   - Scout agent reads from `google_ads_queries` (both `data_source='api'` and `data_source='csv_upload'`)
   - Researcher enriches data from `auction_insights` table (CSV-sourced competitor data)
   - Auto-trigger works for both OAuth sync and CSV upload

2. **Phase 1** (Reports Tab UI) - Displays the generated reports
   - Can use mock data if Phase 4 is not ready yet

See `/documents/plans/ai-reporting/README.md` for full implementation order details.
