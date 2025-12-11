/**
 * Phase 9: Output Analysis
 *
 * Analyzes final report output to detect constraint violations that may have
 * slipped through upstream validation. This is the last line of defense.
 */

import type { BusinessType } from '../skills/types.js';
import type { DirectorOutput } from '../types.js';

// ============================================================================
// TYPES
// ============================================================================

export interface OutputAnalysis {
  /** Number of ROAS mentions in the output */
  roasMentions: number;
  /** Whether Product schema was recommended */
  productSchemaRecommended: boolean;
  /** Invalid metrics detected for this business type */
  invalidMetrics: string[];
}

// ============================================================================
// METRIC PATTERNS
// ============================================================================

/**
 * Patterns for detecting specific metrics in text.
 */
const METRIC_PATTERNS: Record<string, RegExp> = {
  roas: /\broas\b|return on ad spend/gi,
  revenue: /\brevenue\b|\bearnings\b|\bsales\s+revenue\b/gi,
  aov: /\baov\b|average order value/gi,
  ltv: /\bltv\b|lifetime value|customer lifetime/gi,
  mrr: /\bmrr\b|monthly recurring revenue/gi,
  arr: /\barr\b|annual recurring revenue/gi,
  cpl: /\bcpl\b|cost per lead/gi,
};

/**
 * Patterns for detecting schema recommendations.
 */
const PRODUCT_SCHEMA_PATTERNS = [
  /\badd\s+(?:\w+\s+)*product\s+schema/i,
  /\bimplement\s+(?:\w+\s+)*product\s+schema/i,
  /\bmissing\s+(?:\w+\s+)*product\s+schema/i,
  /\brecommend\s+(?:\w+\s+)*product\s+schema/i,
  /\bproduct\s+structured\s+data/i,
  /\bschema\.org\/product/i,
];

/**
 * Invalid metrics per business type.
 * These metrics should never appear in recommendations for these business types.
 */
const INVALID_METRICS_BY_BUSINESS_TYPE: Record<BusinessType, string[]> = {
  'lead-gen': ['roas', 'revenue', 'aov', 'ltv'],
  'saas': ['roas', 'aov'],
  'ecommerce': [], // No invalid metrics for ecommerce
  'local': ['mrr', 'arr'], // B2B SaaS metrics don't apply to local
};

// ============================================================================
// ANALYSIS FUNCTIONS
// ============================================================================

/**
 * Analyzes the final director output for constraint violations.
 *
 * This function checks for:
 * 1. ROAS mentions (invalid for lead-gen)
 * 2. Product schema recommendations (invalid for lead-gen, saas)
 * 3. Business-type-specific invalid metrics
 */
export function analyzeOutputForViolations(
  output: DirectorOutput,
  businessType: BusinessType
): OutputAnalysis {
  // Serialize entire output to text for analysis
  const fullText = serializeOutputToText(output);

  // Count ROAS mentions
  const roasMatches = fullText.match(METRIC_PATTERNS.roas);
  const roasMentions = roasMatches?.length ?? 0;

  // Check for Product schema recommendations
  const productSchemaRecommended = PRODUCT_SCHEMA_PATTERNS.some((pattern) =>
    pattern.test(fullText)
  );

  // Detect invalid metrics for this business type
  const invalidMetrics = detectInvalidMetrics(fullText, businessType);

  return {
    roasMentions,
    productSchemaRecommended,
    invalidMetrics,
  };
}

/**
 * Serializes director output to a single text string for pattern matching.
 */
function serializeOutputToText(output: DirectorOutput): string {
  const parts: string[] = [];

  // Executive summary
  if (output.executiveSummary) {
    parts.push(output.executiveSummary.summary ?? '');
    if (output.executiveSummary.keyHighlights) {
      parts.push(...output.executiveSummary.keyHighlights);
    }
  }

  // Unified recommendations
  if (output.unifiedRecommendations) {
    for (const rec of output.unifiedRecommendations) {
      parts.push(rec.title ?? '');
      parts.push(rec.description ?? '');
      if (rec.actionItems) {
        parts.push(...rec.actionItems);
      }
    }
  }

  return parts.join(' ').toLowerCase();
}

/**
 * Detects metrics that are invalid for the given business type.
 */
function detectInvalidMetrics(
  text: string,
  businessType: BusinessType
): string[] {
  const invalidMetricNames = INVALID_METRICS_BY_BUSINESS_TYPE[businessType] || [];
  const detectedInvalid: string[] = [];

  for (const metricName of invalidMetricNames) {
    const pattern = METRIC_PATTERNS[metricName];
    if (pattern && pattern.test(text)) {
      detectedInvalid.push(metricName);
      // Reset regex lastIndex for global patterns
      pattern.lastIndex = 0;
    }
  }

  return detectedInvalid;
}

/**
 * Counts how many times each metric appears in the output.
 * Useful for detailed analysis.
 */
export function countMetricMentions(
  output: DirectorOutput
): Record<string, number> {
  const fullText = serializeOutputToText(output);
  const counts: Record<string, number> = {};

  for (const [metricName, pattern] of Object.entries(METRIC_PATTERNS)) {
    const matches = fullText.match(pattern);
    counts[metricName] = matches?.length ?? 0;
    // Reset regex lastIndex for global patterns
    pattern.lastIndex = 0;
  }

  return counts;
}
