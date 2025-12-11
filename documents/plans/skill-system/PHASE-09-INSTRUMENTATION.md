# Phase 9: Instrumentation

## Goal

Add metrics collection and monitoring to measure skill effectiveness, detect constraint violations, and track report quality over time.

## Database Schema

### 1. Report Metrics Table

**Migration: `apps/api/drizzle/migrations/XXXX_add_report_metrics.sql`**

```sql
-- Create report_metrics table for tracking skill effectiveness
CREATE TABLE report_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id UUID NOT NULL REFERENCES interplay_reports(id) ON DELETE CASCADE,
  client_account_id UUID NOT NULL REFERENCES client_accounts(id),
  business_type VARCHAR(50) NOT NULL,
  skill_version VARCHAR(20) NOT NULL,
  using_fallback BOOLEAN NOT NULL DEFAULT false,

  -- Constraint violations
  constraint_violations INTEGER NOT NULL DEFAULT 0,
  violations_by_rule JSONB NOT NULL DEFAULT '{}',

  -- Content analysis
  roas_mentions INTEGER NOT NULL DEFAULT 0,
  product_schema_recommended BOOLEAN NOT NULL DEFAULT false,
  invalid_metrics_detected TEXT[] NOT NULL DEFAULT '{}',

  -- Performance metrics
  skill_load_time_ms INTEGER,
  scout_duration_ms INTEGER,
  researcher_duration_ms INTEGER,
  sem_duration_ms INTEGER,
  seo_duration_ms INTEGER,
  director_duration_ms INTEGER,
  total_duration_ms INTEGER,

  -- Token budget
  serialization_mode VARCHAR(10) CHECK (serialization_mode IN ('full', 'compact')),
  truncation_applied BOOLEAN NOT NULL DEFAULT false,
  keywords_dropped INTEGER NOT NULL DEFAULT 0,
  pages_dropped INTEGER NOT NULL DEFAULT 0,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for efficient querying
CREATE INDEX idx_report_metrics_business_type ON report_metrics(business_type);
CREATE INDEX idx_report_metrics_created_at ON report_metrics(created_at);
CREATE INDEX idx_report_metrics_skill_version ON report_metrics(skill_version);
CREATE INDEX idx_report_metrics_violations ON report_metrics(constraint_violations) WHERE constraint_violations > 0;
```

### 2. Constraint Violations Table

**Already created in Phase 6, but for reference:**

```sql
CREATE TABLE constraint_violations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id UUID NOT NULL REFERENCES interplay_reports(id),
  client_account_id UUID NOT NULL REFERENCES client_accounts(id),
  business_type VARCHAR(50) NOT NULL,
  source VARCHAR(10) NOT NULL CHECK (source IN ('sem', 'seo')),
  constraint_id VARCHAR(100) NOT NULL,
  violating_content TEXT NOT NULL,
  skill_version VARCHAR(20) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

## Implementation

### 1. Metrics Collection Service

**`apps/api/src/services/interplay-report/utils/metrics.ts`**

```typescript
import { db } from '@/db';
import { reportMetrics } from '@/db/schema';
import { logger } from '@/utils/logger';
import { BusinessType } from '../skills/types';

export interface ReportMetricsData {
  reportId: string;
  clientAccountId: string;
  businessType: BusinessType;
  skillVersion: string;
  usingFallback: boolean;

  // Constraint violations
  constraintViolations: number;
  violationsByRule: Record<string, number>;

  // Content analysis
  roasMentionsInOutput: number;
  productSchemaRecommended: boolean;
  invalidMetricsDetected: string[];

  // Performance
  skillLoadTimeMs?: number;
  scoutDurationMs?: number;
  researcherDurationMs?: number;
  semDurationMs?: number;
  seoDurationMs?: number;
  directorDurationMs?: number;
  totalDurationMs?: number;

  // Token budget
  serializationMode?: 'full' | 'compact';
  truncationApplied: boolean;
  keywordsDropped: number;
  pagesDropped: number;
}

export async function saveReportMetrics(data: ReportMetricsData): Promise<void> {
  try {
    await db.insert(reportMetrics).values({
      reportId: data.reportId,
      clientAccountId: data.clientAccountId,
      businessType: data.businessType,
      skillVersion: data.skillVersion,
      usingFallback: data.usingFallback,
      constraintViolations: data.constraintViolations,
      violationsByRule: data.violationsByRule,
      roasMentions: data.roasMentionsInOutput,
      productSchemaRecommended: data.productSchemaRecommended,
      invalidMetricsDetected: data.invalidMetricsDetected,
      skillLoadTimeMs: data.skillLoadTimeMs,
      scoutDurationMs: data.scoutDurationMs,
      researcherDurationMs: data.researcherDurationMs,
      semDurationMs: data.semDurationMs,
      seoDurationMs: data.seoDurationMs,
      directorDurationMs: data.directorDurationMs,
      totalDurationMs: data.totalDurationMs,
      serializationMode: data.serializationMode,
      truncationApplied: data.truncationApplied,
      keywordsDropped: data.keywordsDropped,
      pagesDropped: data.pagesDropped,
    });

    logger.debug({
      reportId: data.reportId,
      businessType: data.businessType,
      constraintViolations: data.constraintViolations,
    }, 'Report metrics saved');
  } catch (error) {
    logger.error({ error, reportId: data.reportId }, 'Failed to save report metrics');
    // Don't throw - metrics collection should not break report generation
  }
}
```

### 2. Output Analysis Function

**`apps/api/src/services/interplay-report/utils/output-analysis.ts`**

```typescript
import { BusinessType } from '../skills/types';

export interface OutputAnalysis {
  roasMentions: number;
  productSchemaRecommended: boolean;
  invalidMetrics: string[];
}

interface DirectorOutput {
  executiveSummary: string;
  highlights: { title: string; description: string }[];
  unifiedRecommendations: { title: string; description: string; actionItems: string[] }[];
}

export function analyzeOutputForViolations(
  output: DirectorOutput,
  businessType: BusinessType
): OutputAnalysis {
  const fullText = JSON.stringify(output).toLowerCase();

  // Count ROAS mentions
  const roasMatches = fullText.match(/\broas\b|return on ad spend/gi) || [];
  const roasMentions = roasMatches.length;

  // Check for product schema recommendations
  const productSchemaRecommended = /add.*product schema|implement.*product schema|missing.*product schema/i.test(fullText);

  // Detect invalid metrics for this business type
  const invalidMetrics = detectInvalidMetrics(fullText, businessType);

  return {
    roasMentions,
    productSchemaRecommended,
    invalidMetrics,
  };
}

function detectInvalidMetrics(text: string, businessType: BusinessType): string[] {
  const invalidMetrics: string[] = [];

  // Define invalid metrics per business type
  const invalidMetricPatterns: Record<BusinessType, { pattern: RegExp; metric: string }[]> = {
    'lead-gen': [
      { pattern: /\broas\b/i, metric: 'roas' },
      { pattern: /\brevenue\b/i, metric: 'revenue' },
      { pattern: /\baov\b|average order value/i, metric: 'aov' },
    ],
    'saas': [
      { pattern: /\broas\b/i, metric: 'roas' },
      { pattern: /\baov\b|average order value/i, metric: 'aov' },
    ],
    'ecommerce': [],  // No invalid metrics for ecommerce
    'local': [],
  };

  const patterns = invalidMetricPatterns[businessType] || [];

  for (const { pattern, metric } of patterns) {
    if (pattern.test(text)) {
      invalidMetrics.push(metric);
    }
  }

  return invalidMetrics;
}
```

### 3. Critical Alert Logging

**`apps/api/src/services/interplay-report/utils/alerts.ts`**

```typescript
import { logger } from '@/utils/logger';
import { BusinessType } from '../skills/types';
import { OutputAnalysis } from './output-analysis';

export function checkAndAlertCriticalViolations(
  reportId: string,
  businessType: BusinessType,
  analysis: OutputAnalysis
): void {
  // Lead-gen client with ROAS or Product schema = critical failure
  if (businessType === 'lead-gen') {
    if (analysis.roasMentions > 0) {
      logger.error({
        reportId,
        businessType,
        roasMentions: analysis.roasMentions,
        severity: 'critical',
      }, 'CRITICAL: ROAS mentioned in lead-gen report - skill constraints failed');
    }

    if (analysis.productSchemaRecommended) {
      logger.error({
        reportId,
        businessType,
        severity: 'critical',
      }, 'CRITICAL: Product schema recommended in lead-gen report - skill constraints failed');
    }
  }

  // SaaS client with ROAS = warning
  if (businessType === 'saas' && analysis.roasMentions > 0) {
    logger.warn({
      reportId,
      businessType,
      roasMentions: analysis.roasMentions,
    }, 'ROAS mentioned in SaaS report - may not be applicable');
  }

  // Any invalid metrics detected
  if (analysis.invalidMetrics.length > 0) {
    logger.warn({
      reportId,
      businessType,
      invalidMetrics: analysis.invalidMetrics,
    }, 'Invalid metrics detected in report output');
  }
}
```

### 4. Orchestrator Integration

**Update `apps/api/src/services/interplay-report/orchestrator.ts`**

```typescript
import { saveReportMetrics, ReportMetricsData } from './utils/metrics';
import { analyzeOutputForViolations } from './utils/output-analysis';
import { checkAndAlertCriticalViolations } from './utils/alerts';

export async function generateInterplayReport(
  clientAccountId: string,
  options: GenerateReportOptions
): Promise<{ reportId: string; metadata: ReportMetadata }> {
  const metrics: Partial<ReportMetricsData> = {
    clientAccountId,
    truncationApplied: false,
    keywordsDropped: 0,
    pagesDropped: 0,
    constraintViolations: 0,
    violationsByRule: {},
    roasMentionsInOutput: 0,
    productSchemaRecommended: false,
    invalidMetricsDetected: [],
  };

  // ... existing pipeline code ...

  // After director output
  metrics.constraintViolations = directorOutput.constraintValidation.violationCount;

  // Analyze final output for any slipped violations
  const outputAnalysis = analyzeOutputForViolations(
    directorOutput,
    client.businessType
  );

  metrics.roasMentionsInOutput = outputAnalysis.roasMentions;
  metrics.productSchemaRecommended = outputAnalysis.productSchemaRecommended;
  metrics.invalidMetricsDetected = outputAnalysis.invalidMetrics;

  // Alert on critical violations
  checkAndAlertCriticalViolations(reportId, client.businessType, outputAnalysis);

  // Save metrics (non-blocking)
  metrics.reportId = reportId;
  metrics.businessType = client.businessType;
  metrics.skillVersion = skillResult.bundle.version;
  metrics.usingFallback = skillResult.usingFallback;
  metrics.totalDurationMs = Date.now() - startTime;

  saveReportMetrics(metrics as ReportMetricsData).catch(err => {
    logger.error({ error: err, reportId }, 'Failed to save metrics');
  });

  return { reportId, metadata: finalMetadata };
}
```

## Dashboard Queries

### Weekly Skill Effectiveness Report

```sql
SELECT
  DATE_TRUNC('week', created_at) as week,
  business_type,
  skill_version,
  COUNT(*) as reports_generated,
  AVG(constraint_violations) as avg_violations,
  SUM(CASE WHEN roas_mentions > 0 AND business_type = 'lead-gen' THEN 1 ELSE 0 END) as leadgen_roas_leaks,
  SUM(CASE WHEN product_schema_recommended AND business_type = 'lead-gen' THEN 1 ELSE 0 END) as leadgen_product_schema_leaks,
  AVG(skill_load_time_ms) as avg_skill_load_ms,
  AVG(total_duration_ms) as avg_total_time_ms,
  SUM(CASE WHEN truncation_applied THEN 1 ELSE 0 END) as truncated_reports
FROM report_metrics
WHERE created_at > NOW() - INTERVAL '4 weeks'
GROUP BY 1, 2, 3
ORDER BY 1 DESC, 2;
```

### Constraint Violation Hotspots

```sql
SELECT
  constraint_id,
  source,
  business_type,
  COUNT(*) as violation_count,
  COUNT(DISTINCT report_id) as affected_reports
FROM constraint_violations
WHERE created_at > NOW() - INTERVAL '7 days'
GROUP BY constraint_id, source, business_type
ORDER BY violation_count DESC
LIMIT 20;
```

### Performance Trends

```sql
SELECT
  DATE_TRUNC('day', created_at) as day,
  business_type,
  AVG(total_duration_ms) as avg_total_ms,
  AVG(sem_duration_ms) as avg_sem_ms,
  AVG(seo_duration_ms) as avg_seo_ms,
  AVG(director_duration_ms) as avg_director_ms,
  PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY total_duration_ms) as p95_total_ms
FROM report_metrics
WHERE created_at > NOW() - INTERVAL '14 days'
GROUP BY 1, 2
ORDER BY 1 DESC, 2;
```

### Token Budget Usage

```sql
SELECT
  business_type,
  serialization_mode,
  COUNT(*) as report_count,
  AVG(keywords_dropped) as avg_keywords_dropped,
  AVG(pages_dropped) as avg_pages_dropped,
  SUM(CASE WHEN truncation_applied THEN 1 ELSE 0 END)::float / COUNT(*) * 100 as truncation_rate
FROM report_metrics
WHERE created_at > NOW() - INTERVAL '30 days'
GROUP BY 1, 2
ORDER BY 1, 2;
```

## Success Metrics & Targets

| Metric | Definition | Target |
|--------|------------|--------|
| **False Positive Rate** | Reports with constraint violations | < 5% |
| **ROAS Mentions (Lead-Gen)** | Lead-gen reports mentioning ROAS | 0% |
| **Product Schema (Lead-Gen)** | Lead-gen reports recommending Product schema | 0% |
| **Constraint Violation Rate** | Reports with upstream violations caught | < 2% |
| **Skill Load Time** | Time to load skill bundle | < 15ms p95 |
| **Truncation Rate** | Reports requiring token budget truncation | < 10% |

## Dependencies

- Phase 5 (Orchestrator Integration)
- Phase 6 (Constraint Enforcement)

## Validation Criteria

- [ ] `report_metrics` table created successfully
- [ ] Metrics are saved for every report
- [ ] Output analysis detects ROAS mentions correctly
- [ ] Output analysis detects Product schema recommendations
- [ ] Critical alerts are logged for lead-gen violations
- [ ] Dashboard queries execute efficiently
- [ ] Metrics saving doesn't block report generation

## Estimated Effort

Medium - requires implementing several analysis functions and database schema.
