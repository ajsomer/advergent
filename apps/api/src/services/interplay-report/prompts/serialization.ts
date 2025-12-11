/**
 * Prompt Serialisation Layer
 *
 * Converts TypeScript skill definitions into prompt text that can be
 * injected into agent prompts. Handles token budget management and
 * data truncation with priority-based selection.
 */

import type {
  SEMSkillDefinition,
  SEOSkillDefinition,
  DirectorSkillDefinition,
  KPIDefinition,
  ThresholdSet,
  AnalysisPattern,
  SEMExample,
  SEOExample,
  ContentPattern,
} from '../skills/types.js';
import { logger } from '@/utils/logger.js';

// ============================================================================
// Token Budget Constants
// ============================================================================

export const TOKEN_LIMITS = {
  MAX_PROMPT_TOKENS: 30000,
  MAX_DATA_TOKENS: 15000,
  MAX_SKILL_CONTEXT_TOKENS: 5000,

  MAX_KEYWORDS_FULL: 20,
  MAX_KEYWORDS_COMPACT: 10,
  MAX_PAGES_FULL: 10,
  MAX_PAGES_COMPACT: 5,

  MAX_CONTENT_PREVIEW_CHARS: 500,
  MAX_PAGE_TITLE_CHARS: 100,
};

export type SerializationMode = 'full' | 'compact';

export interface TokenBudgetResult {
  mode: SerializationMode;
  keywordsIncluded: number;
  keywordsDropped: number;
  pagesIncluded: number;
  pagesDropped: number;
  truncationApplied: boolean;
}

// ============================================================================
// KPI Formatting
// ============================================================================

/**
 * Format KPIs in full detail for prompts with token budget available.
 */
export function formatKPIs(kpis: SEMSkillDefinition['kpis'] | SEOSkillDefinition['kpis']): {
  primary: string;
  secondary: string;
  irrelevant: string;
} {
  const formatKPI = (kpi: KPIDefinition) =>
    `- **${kpi.metric}** (${kpi.importance}): ${kpi.description}
  Target: ${kpi.targetDirection}${kpi.benchmark ? ` | Benchmark: ${kpi.benchmark}` : ''}
  Why it matters: ${kpi.businessContext}`;

  return {
    primary: kpis.primary.map(formatKPI).join('\n\n'),
    secondary: kpis.secondary.map(formatKPI).join('\n\n'),
    irrelevant: kpis.irrelevant.map((m) => `- ${m}`).join('\n'),
  };
}

/**
 * Format KPIs in compact form for token-constrained prompts.
 */
export function formatKPIsCompact(kpis: SEMSkillDefinition['kpis'] | SEOSkillDefinition['kpis']): {
  primary: string;
  irrelevant: string;
} {
  const formatKPICompact = (kpi: KPIDefinition) =>
    `- **${kpi.metric}**: ${kpi.description} (${kpi.targetDirection})`;

  return {
    primary: kpis.primary.map(formatKPICompact).join('\n'),
    irrelevant: kpis.irrelevant.map((m) => `- ${m}`).join('\n'),
  };
}

// ============================================================================
// Benchmark Formatting
// ============================================================================

/**
 * Format benchmarks as a markdown table.
 */
export function formatBenchmarks(benchmarks: Record<string, ThresholdSet | undefined>): string {
  const rows = Object.entries(benchmarks)
    .filter(([_, v]) => v !== undefined)
    .map(([metric, thresholds]) => {
      const t = thresholds as ThresholdSet;
      return `| ${metric} | ${t.excellent} | ${t.good} | ${t.average} | ${t.poor} |`;
    });

  if (rows.length === 0) {
    return 'No benchmarks defined.';
  }

  return `| Metric | Excellent | Good | Average | Poor |
|--------|-----------|------|---------|------|
${rows.join('\n')}`;
}

/**
 * Format benchmarks in compact form.
 */
export function formatBenchmarksCompact(
  benchmarks: Record<string, ThresholdSet | undefined>
): string {
  const lines = Object.entries(benchmarks)
    .filter(([_, v]) => v !== undefined)
    .map(([metric, thresholds]) => {
      const t = thresholds as ThresholdSet;
      return `- ${metric}: Good = ${t.good}`;
    });

  return lines.length > 0 ? lines.join('\n') : 'No benchmarks defined.';
}

// ============================================================================
// Pattern Formatting
// ============================================================================

/**
 * Format analysis patterns in full detail.
 */
export function formatPatterns(patterns: AnalysisPattern[]): string {
  if (patterns.length === 0) {
    return 'No patterns defined.';
  }

  return patterns
    .map(
      (p) =>
        `### ${p.name}
${p.description}
- **Indicators:** ${p.indicators.join(', ')}
- **Recommended Action:** ${p.recommendation}`
    )
    .join('\n\n');
}

/**
 * Format patterns in compact form.
 */
export function formatPatternsCompact(patterns: AnalysisPattern[], limit: number = 3): string {
  if (patterns.length === 0) {
    return 'No patterns defined.';
  }

  return patterns
    .slice(0, limit)
    .map((p) => `- **${p.name}**: ${p.description}`)
    .join('\n');
}

// ============================================================================
// Example Formatting
// ============================================================================

/**
 * Format SEM examples in full detail.
 */
export function formatSEMExamples(examples: SEMExample[]): string {
  if (examples.length === 0) {
    return 'No examples provided.';
  }

  return examples
    .map(
      (ex, i) =>
        `### Example ${i + 1}: ${ex.scenario}
**Data:** ${ex.data}
**Recommendation:** ${ex.recommendation}
**Reasoning:** ${ex.reasoning}`
    )
    .join('\n\n');
}

/**
 * Format SEM examples in compact form (single example).
 */
export function formatSEMExamplesCompact(examples: SEMExample[]): string {
  if (examples.length === 0) return '';
  const ex = examples[0];
  return `### Example: ${ex.scenario}
**Data:** ${ex.data}
**Recommendation:** ${ex.recommendation}`;
}

/**
 * Format SEO examples in full detail.
 */
export function formatSEOExamples(examples: SEOExample[]): string {
  if (examples.length === 0) {
    return 'No examples provided.';
  }

  return examples
    .map(
      (ex, i) =>
        `### Example ${i + 1}: ${ex.scenario}
**Page Data:** ${ex.pageData}
**Recommendation:** ${ex.recommendation}
**Reasoning:** ${ex.reasoning}`
    )
    .join('\n\n');
}

/**
 * Format SEO examples in compact form (single example).
 */
export function formatSEOExamplesCompact(examples: SEOExample[]): string {
  if (examples.length === 0) return '';
  const ex = examples[0];
  return `### Example: ${ex.scenario}
**Page Data:** ${ex.pageData}
**Recommendation:** ${ex.recommendation}`;
}

// ============================================================================
// Constraint Formatting
// ============================================================================

/**
 * Format constraints as a numbered list.
 */
export function formatConstraints(constraints: string[]): string {
  if (constraints.length === 0) {
    return 'No constraints defined.';
  }
  return constraints.map((c, i) => `${i + 1}. ${c}`).join('\n');
}

// ============================================================================
// Schema Rule Formatting (SEO-specific)
// ============================================================================

/**
 * Format schema rules for SEO prompts.
 */
export function formatSchemaRules(schema: SEOSkillDefinition['schema']): string {
  const sections: string[] = [];

  if (schema.required.length > 0) {
    sections.push(`### Required Schema
${schema.required.map((r) => `- **${r.type}**: ${r.description} (${r.validationNotes})`).join('\n')}`);
  }

  if (schema.recommended.length > 0) {
    sections.push(`### Recommended Schema
${schema.recommended.map((r) => `- **${r.type}**: ${r.description}`).join('\n')}`);
  }

  if (schema.invalid.length > 0) {
    sections.push(`### INVALID Schema (Flag as Error)
${schema.invalid.map((r) => `- **${r.type}**: ${r.description} - ${r.validationNotes}`).join('\n')}`);
  }

  return sections.length > 0 ? sections.join('\n\n') : 'No schema rules defined.';
}

// ============================================================================
// Content Pattern Formatting (SEO-specific)
// ============================================================================

/**
 * Format content patterns for SEO prompts.
 */
export function formatContentPatterns(patterns: ContentPattern[]): string {
  if (patterns.length === 0) {
    return 'No content patterns defined.';
  }

  return patterns
    .map(
      (p) =>
        `### ${p.name}
- **Good:** ${p.goodPattern}
- **Bad:** ${p.badPattern}
- **Recommendation:** ${p.recommendation}`
    )
    .join('\n\n');
}

/**
 * Format content patterns in compact form.
 */
export function formatContentPatternsCompact(patterns: ContentPattern[], limit: number = 3): string {
  if (patterns.length === 0) {
    return 'No content patterns defined.';
  }

  return patterns
    .slice(0, limit)
    .map((p) => `- **${p.name}**: Good = "${p.goodPattern}" | Bad = "${p.badPattern}"`)
    .join('\n');
}

// ============================================================================
// Director-specific Formatting
// ============================================================================

/**
 * Format conflict resolution rules for Director prompts.
 */
export function formatConflictRules(
  rules: DirectorSkillDefinition['synthesis']['conflictResolution']
): string {
  if (rules.length === 0) {
    return 'No conflict resolution rules defined.';
  }

  return rules
    .map(
      (r) =>
        `- **${r.id}**: When SEM says "${r.semSignal}" and SEO says "${r.seoSignal}" → ${r.resolution} (Result: ${r.resultingType})`
    )
    .join('\n');
}

/**
 * Format synergy rules for Director prompts.
 */
export function formatSynergyRules(
  rules: DirectorSkillDefinition['synthesis']['synergyIdentification']
): string {
  if (rules.length === 0) {
    return 'No synergy rules defined.';
  }

  return rules
    .map(
      (r) =>
        `- **${r.id}**: When SEM has "${r.semCondition}" AND SEO has "${r.seoCondition}" → ${r.combinedRecommendation}`
    )
    .join('\n');
}

/**
 * Format prioritization rules for Director prompts.
 */
export function formatPrioritizationRules(
  rules: DirectorSkillDefinition['synthesis']['prioritization']
): string {
  if (rules.length === 0) {
    return 'No prioritization rules defined.';
  }

  return rules
    .map(
      (r) =>
        `- ${r.condition}: ${r.adjustment} by ${r.factor}x (${r.reason})`
    )
    .join('\n');
}

// ============================================================================
// Token Budget Management
// ============================================================================

/**
 * Estimate token count from text (rough approximation: 1 token ≈ 4 characters).
 */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

/**
 * Determine serialization mode based on data volume.
 */
export function determineSerializationMode<K, P>(
  keywords: K[],
  pages: P[]
): { mode: SerializationMode; budget: TokenBudgetResult } {
  const keywordCount = keywords.length;
  const pageCount = pages.length;

  // Estimate token usage (rough)
  const estimatedDataTokens = Math.ceil(
    (JSON.stringify(keywords).length + JSON.stringify(pages).length) / 4
  );

  let mode: SerializationMode = 'full';
  let keywordsIncluded = keywordCount;
  let pagesIncluded = pageCount;

  // Switch to compact if over budget
  if (
    keywordCount > TOKEN_LIMITS.MAX_KEYWORDS_FULL ||
    pageCount > TOKEN_LIMITS.MAX_PAGES_FULL ||
    estimatedDataTokens > TOKEN_LIMITS.MAX_DATA_TOKENS
  ) {
    mode = 'compact';
    keywordsIncluded = Math.min(keywordCount, TOKEN_LIMITS.MAX_KEYWORDS_COMPACT);
    pagesIncluded = Math.min(pageCount, TOKEN_LIMITS.MAX_PAGES_COMPACT);
  }

  const budget: TokenBudgetResult = {
    mode,
    keywordsIncluded,
    keywordsDropped: keywordCount - keywordsIncluded,
    pagesIncluded,
    pagesDropped: pageCount - pagesIncluded,
    truncationApplied: keywordsIncluded < keywordCount || pagesIncluded < pageCount,
  };

  // Log if truncation occurred
  if (budget.truncationApplied) {
    logger.warn(
      {
        originalKeywords: keywordCount,
        originalPages: pageCount,
        ...budget,
      },
      'Data truncated due to token budget'
    );
  }

  return { mode, budget };
}

// ============================================================================
// Priority Scoring for Truncation
// ============================================================================

/**
 * Enriched keyword type for prompt serialization.
 * Compatible with the existing EnrichedKeyword from types.ts but
 * extended for serialization purposes.
 */
export interface SerializableKeyword {
  query: string;
  queryHash?: string;
  priority?: string;
  priorityReason?: string;
  reason?: string;
  spend: number;
  clicks?: number;
  impressions?: number;
  conversions?: number;
  conversionValue?: number;
  cpc?: number;
  ctr?: number;
  roas?: number;
  organicPosition?: number | null;
  organicClicks?: number;
  organicImpressions?: number;
  organicCtr?: number;
  competitiveMetrics?: {
    impressionShare?: number | null;
    lostImpressionShareBudget?: number | null;
    lostImpressionShareRank?: number | null;
    topOfPageRate?: number | null;
    absoluteTopOfPageRate?: number | null;
    absTopOfPageRate?: number | null;
    outrankingShare?: number | null;
    overlapRate?: number | null;
    positionAboveRate?: number | null;
    dataLevel?: string;
  };
}

/**
 * Enriched page type for prompt serialization.
 */
export interface SerializablePage {
  url: string;
  path?: string;
  priority?: string;
  priorityReason?: string;
  reason?: string;
  paidSpend?: number;
  paidClicks?: number;
  organicImpressions?: number;
  organicClicks?: number;
  organicPosition?: number | null;
  organicCtr?: number;
  bounceRate?: number | null;
  impressions?: number;
  ctr?: number | null;
  avgTimeOnPage?: number;
  content?: {
    wordCount: number;
    title: string | null;
    h1: string | null;
    metaDescription: string | null;
    contentPreview?: string;
  };
  fetchedContent?: {
    title: string;
    h1: string;
    metaDescription: string;
    wordCount: number;
    contentPreview: string;
    detectedSchema: string[];
    contentSignals: Record<string, boolean>;
  };
}

const KEYWORD_PRIORITY_WEIGHTS: Record<string, number> = {
  'high_spend_low_roas': 100,
  'high-spend-low-roas': 100,
  'cannibalization_risk': 90,
  'cannibalization-risk': 90,
  'growth_potential': 70,
  'growth-potential': 70,
  'competitive_pressure': 60,
  'competitive-pressure': 60,
};

/**
 * Calculate priority score for a keyword (higher = more important).
 */
export function calculateKeywordPriority(keyword: SerializableKeyword): number {
  let score = 0;

  // Base score from Scout's priority reason
  const reason = keyword.priorityReason || keyword.reason || '';
  score += KEYWORD_PRIORITY_WEIGHTS[reason] || 50;

  // Boost based on spend
  if (keyword.spend > 500) score += 30;
  else if (keyword.spend > 200) score += 20;
  else if (keyword.spend > 100) score += 10;

  // Boost based on conversion data availability
  if (keyword.conversions && keyword.conversions > 0) score += 15;

  // Boost if competitive data is available
  if (keyword.competitiveMetrics) score += 10;

  return score;
}

const PAGE_PRIORITY_WEIGHTS: Record<string, number> = {
  'high_spend_low_organic': 100,
  'high-spend-low-organic': 100,
  'high-paid-spend-low-organic': 100,
  'high_traffic_high_bounce': 80,
  'high-traffic-high-bounce': 80,
  'high_impressions_low_ctr': 70,
  'high-impressions-low-ctr': 70,
};

/**
 * Calculate priority score for a page (higher = more important).
 */
export function calculatePagePriority(page: SerializablePage): number {
  let score = 0;

  // Base score from Scout's priority reason
  const reason = page.priorityReason || page.reason || '';
  score += PAGE_PRIORITY_WEIGHTS[reason] || 50;

  // Boost based on paid spend
  if (page.paidSpend && page.paidSpend > 300) score += 25;
  else if (page.paidSpend && page.paidSpend > 100) score += 15;

  // Boost if content was successfully fetched
  if (page.content || page.fetchedContent) score += 10;

  // Boost based on organic impressions
  if (page.organicImpressions && page.organicImpressions > 1000) score += 10;

  return score;
}

/**
 * Sort and truncate items by priority, keeping highest priority items.
 */
export function prioritizeAndTruncate<T>(
  items: T[],
  limit: number,
  calculatePriority: (item: T) => number
): { included: T[]; dropped: number } {
  if (items.length <= limit) {
    return { included: items, dropped: 0 };
  }

  const scored = items.map((item) => ({
    item,
    score: calculatePriority(item),
  }));

  const sorted = scored.sort((a, b) => b.score - a.score);
  const included = sorted.slice(0, limit).map((s) => s.item);
  const dropped = items.length - limit;

  return { included, dropped };
}

/**
 * Validate that a prompt doesn't exceed token limits.
 * Throws if prompt is too large.
 */
export function validatePromptSize(prompt: string, context: string): void {
  const estimatedTokens = estimateTokens(prompt);
  if (estimatedTokens > TOKEN_LIMITS.MAX_PROMPT_TOKENS) {
    logger.error(
      {
        estimatedTokens,
        limit: TOKEN_LIMITS.MAX_PROMPT_TOKENS,
        context,
      },
      'Prompt exceeds token limit even after truncation'
    );
    throw new Error(`${context} prompt too large for model context window`);
  }
}
