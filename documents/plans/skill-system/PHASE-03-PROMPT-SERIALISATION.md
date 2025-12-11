# Phase 3: Prompt Serialisation Layer

## Goal

Create the translation layer that converts TypeScript skill definitions into prompt text that can be injected into agent prompts.

## Files to Create

### 1. `apps/api/src/services/interplay-report/prompts/serialization.ts`

Core serialisation utilities and token budget management.

```typescript
import {
  SEMSkillDefinition,
  SEOSkillDefinition,
  DirectorSkillDefinition,
  KPIDefinition,
  ThresholdSet,
  AnalysisPattern,
  SEMExample,
  SEOExample,
  SchemaRule,
  ContentPattern,
} from '../skills/types';
import { logger } from '@/utils/logger';

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

export function formatKPIs(kpis: SEMSkillDefinition['kpis']): {
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
    irrelevant: kpis.irrelevant.map(m => `- ${m}`).join('\n'),
  };
}

export function formatKPIsCompact(kpis: SEMSkillDefinition['kpis']): {
  primary: string;
  irrelevant: string;
} {
  const formatKPICompact = (kpi: KPIDefinition) =>
    `- **${kpi.metric}**: ${kpi.description} (${kpi.targetDirection})`;

  return {
    primary: kpis.primary.map(formatKPICompact).join('\n'),
    irrelevant: kpis.irrelevant.map(m => `- ${m}`).join('\n'),
  };
}

// ============================================================================
// Benchmark Formatting
// ============================================================================

export function formatBenchmarks(benchmarks: Record<string, ThresholdSet | undefined>): string {
  const rows = Object.entries(benchmarks)
    .filter(([_, v]) => v !== undefined)
    .map(([metric, thresholds]) => {
      const t = thresholds as ThresholdSet;
      return `| ${metric} | ${t.excellent} | ${t.good} | ${t.average} | ${t.poor} |`;
    });

  return `| Metric | Excellent | Good | Average | Poor |
|--------|-----------|------|---------|------|
${rows.join('\n')}`;
}

export function formatBenchmarksCompact(benchmarks: Record<string, ThresholdSet | undefined>): string {
  return Object.entries(benchmarks)
    .filter(([_, v]) => v !== undefined)
    .map(([metric, thresholds]) => {
      const t = thresholds as ThresholdSet;
      return `- ${metric}: Good = ${t.good}`;
    })
    .join('\n');
}

// ============================================================================
// Pattern Formatting
// ============================================================================

export function formatPatterns(patterns: AnalysisPattern[]): string {
  return patterns.map(p =>
    `### ${p.name}
${p.description}
- **Indicators:** ${p.indicators.join(', ')}
- **Recommended Action:** ${p.recommendation}`
  ).join('\n\n');
}

export function formatPatternsCompact(patterns: AnalysisPattern[], limit: number = 3): string {
  return patterns.slice(0, limit).map(p =>
    `- **${p.name}**: ${p.description}`
  ).join('\n');
}

// ============================================================================
// Example Formatting
// ============================================================================

export function formatSEMExamples(examples: SEMExample[]): string {
  return examples.map((ex, i) =>
    `### Example ${i + 1}: ${ex.scenario}
**Data:** ${ex.data}
**Recommendation:** ${ex.recommendation}
**Reasoning:** ${ex.reasoning}`
  ).join('\n\n');
}

export function formatSEMExamplesCompact(examples: SEMExample[]): string {
  if (examples.length === 0) return '';
  const ex = examples[0];
  return `### Example: ${ex.scenario}
**Data:** ${ex.data}
**Recommendation:** ${ex.recommendation}`;
}

export function formatSEOExamples(examples: SEOExample[]): string {
  return examples.map((ex, i) =>
    `### Example ${i + 1}: ${ex.scenario}
**Page Data:** ${ex.pageData}
**Recommendation:** ${ex.recommendation}
**Reasoning:** ${ex.reasoning}`
  ).join('\n\n');
}

// ============================================================================
// Constraint Formatting
// ============================================================================

export function formatConstraints(constraints: string[]): string {
  return constraints.map((c, i) => `${i + 1}. ${c}`).join('\n');
}

// ============================================================================
// Schema Rule Formatting (SEO-specific)
// ============================================================================

export function formatSchemaRules(schema: SEOSkillDefinition['schema']): string {
  const sections: string[] = [];

  if (schema.required.length > 0) {
    sections.push(`### Required Schema
${schema.required.map(r => `- **${r.type}**: ${r.description} (${r.validationNotes})`).join('\n')}`);
  }

  if (schema.recommended.length > 0) {
    sections.push(`### Recommended Schema
${schema.recommended.map(r => `- **${r.type}**: ${r.description}`).join('\n')}`);
  }

  if (schema.invalid.length > 0) {
    sections.push(`### INVALID Schema (Flag as Error)
${schema.invalid.map(r => `- **${r.type}**: ${r.description} - ${r.validationNotes}`).join('\n')}`);
  }

  return sections.join('\n\n');
}

// ============================================================================
// Content Pattern Formatting (SEO-specific)
// ============================================================================

export function formatContentPatterns(patterns: ContentPattern[]): string {
  return patterns.map(p =>
    `### ${p.name}
- **Good:** ${p.goodPattern}
- **Bad:** ${p.badPattern}
- **Recommendation:** ${p.recommendation}`
  ).join('\n\n');
}

// ============================================================================
// Token Budget Management
// ============================================================================

export function estimateTokens(text: string): number {
  // Rough estimation: 1 token ≈ 4 characters
  return Math.ceil(text.length / 4);
}

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
    logger.warn({
      originalKeywords: keywordCount,
      originalPages: pageCount,
      ...budget,
    }, 'Data truncated due to token budget');
  }

  return { mode, budget };
}

// ============================================================================
// Priority Scoring for Truncation
// ============================================================================

export interface EnrichedKeyword {
  query: string;
  queryHash: string;
  priorityReason: string;
  spend: number;
  clicks: number;
  impressions: number;
  conversions?: number;
  conversionValue?: number;
  cpc: number;
  ctr: number;
  roas?: number;
  organicPosition?: number;
  organicClicks?: number;
  organicImpressions?: number;
  organicCtr?: number;
  competitiveMetrics?: {
    impressionShare: number;
    lostImpressionShareBudget: number;
    lostImpressionShareRank: number;
    topOfPageRate: number;
    absoluteTopOfPageRate: number;
  };
}

export interface EnrichedPage {
  url: string;
  path: string;
  priorityReason: string;
  paidSpend?: number;
  paidClicks?: number;
  organicImpressions?: number;
  organicClicks?: number;
  organicPosition?: number;
  organicCtr?: number;
  bounceRate?: number;
  avgTimeOnPage?: number;
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
  'high-spend-low-roas': 100,
  'cannibalization-risk': 90,
  'growth-potential': 70,
  'competitive-pressure': 60,
};

export function calculateKeywordPriority(keyword: EnrichedKeyword): number {
  let score = 0;

  // Base score from Scout's priority reason
  score += KEYWORD_PRIORITY_WEIGHTS[keyword.priorityReason] || 50;

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
  'high-paid-spend-low-organic': 100,
  'high-traffic-high-bounce': 80,
  'high-impressions-low-ctr': 70,
};

export function calculatePagePriority(page: EnrichedPage): number {
  let score = 0;

  // Base score from Scout's priority reason
  score += PAGE_PRIORITY_WEIGHTS[page.priorityReason] || 50;

  // Boost based on paid spend
  if (page.paidSpend && page.paidSpend > 300) score += 25;
  else if (page.paidSpend && page.paidSpend > 100) score += 15;

  // Boost if content was successfully fetched
  if (page.fetchedContent) score += 10;

  // Boost based on organic impressions
  if (page.organicImpressions && page.organicImpressions > 1000) score += 10;

  return score;
}

export function prioritizeAndTruncate<T>(
  items: T[],
  limit: number,
  calculatePriority: (item: T) => number
): { included: T[]; dropped: number } {
  if (items.length <= limit) {
    return { included: items, dropped: 0 };
  }

  const scored = items.map(item => ({
    item,
    score: calculatePriority(item),
  }));

  const sorted = scored.sort((a, b) => b.score - a.score);
  const included = sorted.slice(0, limit).map(s => s.item);
  const dropped = items.length - limit;

  return { included, dropped };
}
```

### 2. Update `apps/api/src/services/interplay-report/prompts/sem.prompt.ts`

Modify to accept and serialize skill.

```typescript
import { SEMSkillDefinition } from '../skills/types';
import {
  formatKPIs,
  formatKPIsCompact,
  formatBenchmarks,
  formatBenchmarksCompact,
  formatPatterns,
  formatPatternsCompact,
  formatSEMExamples,
  formatSEMExamplesCompact,
  formatConstraints,
  determineSerializationMode,
  prioritizeAndTruncate,
  calculateKeywordPriority,
  TOKEN_LIMITS,
  EnrichedKeyword,
} from './serialization';
import { logger } from '@/utils/logger';

export interface SEMAgentContext {
  skill: SEMSkillDefinition;
  // ... other context fields
}

export function buildSEMPrompt(
  keywords: EnrichedKeyword[],
  context: SEMAgentContext
): string {
  const { skill } = context;
  const { mode, budget } = determineSerializationMode(keywords, []);

  // Truncate keywords if needed, keeping highest priority
  const { included: includedKeywords, dropped } = prioritizeAndTruncate(
    keywords,
    budget.keywordsIncluded,
    calculateKeywordPriority
  );

  // Add truncation notice if data was dropped
  const truncationNotice = dropped > 0
    ? `\n\nNOTE: Data was truncated for token limits. ${dropped} lower-priority keywords omitted. Focus analysis on the provided high-priority items.\n`
    : '';

  const prompt = mode === 'compact'
    ? buildCompactSEMPrompt(includedKeywords, skill, truncationNotice)
    : buildFullSEMPrompt(includedKeywords, skill, truncationNotice);

  // Final safety check
  const estimatedTokens = Math.ceil(prompt.length / 4);
  if (estimatedTokens > TOKEN_LIMITS.MAX_PROMPT_TOKENS) {
    logger.error({
      estimatedTokens,
      limit: TOKEN_LIMITS.MAX_PROMPT_TOKENS,
    }, 'SEM prompt exceeds token limit even after truncation');
    throw new Error('Prompt too large for model context window');
  }

  return prompt;
}

function buildFullSEMPrompt(
  keywords: EnrichedKeyword[],
  skill: SEMSkillDefinition,
  truncationNotice: string
): string {
  const kpiSection = formatKPIs(skill.kpis);
  const benchmarkSection = formatBenchmarks(skill.benchmarks);
  const examplesSection = formatSEMExamples(skill.prompt.examples);
  const constraintsSection = formatConstraints(skill.prompt.constraints);

  return `${skill.prompt.roleContext}

## Business Context
${skill.context.businessModel}

Conversion Definition: ${skill.context.conversionDefinition}
Customer Journey: ${skill.context.typicalCustomerJourney}

## Key Performance Indicators

### Primary KPIs (Focus Here)
${kpiSection.primary}

### Secondary KPIs
${kpiSection.secondary}

### Metrics to IGNORE (Not Applicable)
${kpiSection.irrelevant}

## Benchmarks for This Business Type
${benchmarkSection}

## Analysis Guidance
${skill.prompt.analysisInstructions}

## Patterns to Look For
${formatPatterns(skill.analysis.keyPatterns)}

## Anti-Patterns (Problems to Flag)
${formatPatterns(skill.analysis.antiPatterns)}
${truncationNotice}
## Data to Analyze
\`\`\`json
${JSON.stringify(keywords, null, 2)}
\`\`\`

## Output Requirements
${skill.prompt.outputGuidance}

## Examples
${examplesSection}

## CRITICAL CONSTRAINTS
${constraintsSection}

Return your analysis as valid JSON matching the schema below...
`;
}

function buildCompactSEMPrompt(
  keywords: EnrichedKeyword[],
  skill: SEMSkillDefinition,
  truncationNotice: string
): string {
  const kpiSection = formatKPIsCompact(skill.kpis);
  const benchmarkSection = formatBenchmarksCompact(skill.benchmarks);
  const examplesSection = formatSEMExamplesCompact(skill.prompt.examples);
  const constraintsSection = formatConstraints(skill.prompt.constraints);

  return `${skill.prompt.roleContext}

## Business Context
${skill.context.businessModel}

## Primary KPIs
${kpiSection.primary}

## Metrics to IGNORE
${kpiSection.irrelevant}

## Benchmarks
${benchmarkSection}

## Key Patterns
${formatPatternsCompact(skill.analysis.keyPatterns)}
${truncationNotice}
## Data
\`\`\`json
${JSON.stringify(keywords, null, 2)}
\`\`\`

## Output
${skill.prompt.outputGuidance}

${examplesSection}

## CONSTRAINTS
${constraintsSection}
`;
}
```

### 3. Update `apps/api/src/services/interplay-report/prompts/seo.prompt.ts`

Similar pattern for SEO prompt building.

### 4. Update `apps/api/src/services/interplay-report/prompts/director.prompt.ts`

Similar pattern for Director prompt building.

## Dependencies

- Phase 1 (Type Definitions)
- Phase 2 (Skill Loader)

## Validation Criteria

- [ ] `formatKPIs()` produces readable markdown
- [ ] `formatBenchmarks()` produces valid markdown table
- [ ] `determineSerializationMode()` correctly switches to compact mode
- [ ] `prioritizeAndTruncate()` keeps highest priority items
- [ ] Full prompt stays under token limits
- [ ] Compact mode significantly reduces token count
- [ ] Truncation notice is added when data is dropped

## Estimated Effort

Medium - requires careful implementation of serialisation logic and token budget management.
