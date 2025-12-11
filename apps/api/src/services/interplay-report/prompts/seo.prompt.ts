/**
 * SEO Agent Prompt Builder
 *
 * Builds prompts for the SEO agent using skill-based configuration
 * with token budget management.
 */

import type { EnrichedPage } from '../types.js';
import type { SEOSkillDefinition } from '../skills/types.js';
import {
  formatKPIs,
  formatKPIsCompact,
  formatBenchmarks,
  formatBenchmarksCompact,
  formatSchemaRules,
  formatContentPatterns,
  formatContentPatternsCompact,
  formatSEOExamples,
  formatSEOExamplesCompact,
  formatConstraints,
  determineSerializationMode,
  prioritizeAndTruncate,
  calculatePagePriority,
  validatePromptSize,
  type SerializablePage,
} from './serialization.js';

// ============================================================================
// Legacy Types (for backward compatibility)
// ============================================================================

export interface SEOPromptContext {
  industry?: string;
  targetMarket?: string;
  clientName?: string;
}

// ============================================================================
// Skill-based Types
// ============================================================================

export interface SEOAgentContext {
  skill: SEOSkillDefinition;
  industry?: string;
  targetMarket?: string;
  clientName?: string;
}

// ============================================================================
// Prompt Builders
// ============================================================================

/**
 * Build SEO prompt using skill configuration.
 * Automatically manages token budget and truncates data if needed.
 */
export function buildSEOPromptWithSkill(pages: EnrichedPage[], context: SEOAgentContext): string {
  const { skill } = context;

  // Convert to serializable format
  const serializablePages: SerializablePage[] = pages.map((p) => ({
    url: p.url,
    priority: p.priority,
    reason: p.reason,
    paidSpend: p.paidSpend,
    organicPosition: p.organicPosition,
    bounceRate: p.bounceRate,
    impressions: p.impressions,
    ctr: p.ctr,
    content: p.content
      ? {
          wordCount: p.content.wordCount,
          title: p.content.title,
          h1: p.content.h1,
          metaDescription: p.content.metaDescription,
          contentPreview: p.content.contentPreview?.slice(0, 200),
        }
      : undefined,
  }));

  const { mode, budget } = determineSerializationMode([], serializablePages);

  // Truncate pages if needed, keeping highest priority
  const { included: includedPages, dropped } = prioritizeAndTruncate(
    serializablePages,
    budget.pagesIncluded,
    calculatePagePriority
  );

  // Add truncation notice if data was dropped
  const truncationNotice =
    dropped > 0
      ? `\n\nNOTE: Data was truncated for token limits. ${dropped} lower-priority pages omitted. Focus analysis on the provided high-priority items.\n`
      : '';

  const prompt =
    mode === 'compact'
      ? buildCompactSEOPrompt(includedPages, skill, truncationNotice, context)
      : buildFullSEOPrompt(includedPages, skill, truncationNotice, context);

  // Final safety check
  validatePromptSize(prompt, 'SEO');

  return prompt;
}

/**
 * Build full SEO prompt with all skill details.
 */
function buildFullSEOPrompt(
  pages: SerializablePage[],
  skill: SEOSkillDefinition,
  truncationNotice: string,
  context: SEOAgentContext
): string {
  const kpiSection = formatKPIs(skill.kpis);
  const benchmarkSection = formatBenchmarks(skill.benchmarks);
  const schemaSection = formatSchemaRules(skill.schema);
  const contentPatternsSection = formatContentPatterns(skill.analysis.contentPatterns);
  const examplesSection = formatSEOExamples(skill.prompt.examples);
  const constraintsSection = formatConstraints(skill.prompt.constraints);

  const pagesJson = JSON.stringify(pages, null, 2);

  // Format common issues
  const criticalIssues =
    skill.commonIssues.critical.length > 0
      ? skill.commonIssues.critical.map((i) => `- **${i.id}**: ${i.description}`).join('\n')
      : 'None defined';
  const warningIssues =
    skill.commonIssues.warnings.length > 0
      ? skill.commonIssues.warnings.map((i) => `- **${i.id}**: ${i.description}`).join('\n')
      : 'None defined';

  return `${skill.prompt.roleContext}

## Business Context
Site Type: ${skill.context.siteType}
Primary Goal: ${skill.context.primaryGoal}
Content Strategy: ${skill.context.contentStrategy}
${context.industry ? `Industry: ${context.industry}` : ''}
${context.targetMarket ? `Target Market: ${context.targetMarket}` : ''}

## Key Performance Indicators

### Primary KPIs (Focus Here)
${kpiSection.primary}

### Secondary KPIs
${kpiSection.secondary}

### Metrics to IGNORE (Not Applicable)
${kpiSection.irrelevant}

## Benchmarks for This Business Type
${benchmarkSection}

## Schema Markup Requirements
${schemaSection}

## Content Patterns to Look For
${contentPatternsSection}

## Analysis Guidance
${skill.prompt.analysisInstructions}

## Common Issues for This Business Type

### Critical Issues (Always Flag)
${criticalIssues}

### Warnings (Flag if Severe)
${warningIssues}

### False Positives (IGNORE These)
${skill.commonIssues.falsePositives.length > 0 ? skill.commonIssues.falsePositives.map((f) => `- ${f}`).join('\n') : 'None'}
${truncationNotice}
## Pages to Analyze
\`\`\`json
${pagesJson}
\`\`\`

## Output Requirements
${skill.prompt.outputGuidance}

## Examples
${examplesSection}

## CRITICAL CONSTRAINTS
${constraintsSection}

## Output Format
IMPORTANT: Return ONLY valid JSON without markdown code blocks.

{
  "seoActions": [
    {
      "condition": "string describing the problem",
      "recommendation": "string describing the strategy",
      "specificActions": ["action 1", "action 2", "action 3"],
      "impact": "high" | "medium" | "low",
      "url": "optional url"
    }
  ]
}`;
}

/**
 * Build compact SEO prompt for token-constrained scenarios.
 */
function buildCompactSEOPrompt(
  pages: SerializablePage[],
  skill: SEOSkillDefinition,
  truncationNotice: string,
  context: SEOAgentContext
): string {
  const kpiSection = formatKPIsCompact(skill.kpis);
  const benchmarkSection = formatBenchmarksCompact(skill.benchmarks);
  const contentPatternsSection = formatContentPatternsCompact(skill.analysis.contentPatterns);
  const examplesSection = formatSEOExamplesCompact(skill.prompt.examples);
  const constraintsSection = formatConstraints(skill.prompt.constraints);

  const pagesJson = JSON.stringify(pages, null, 2);

  return `${skill.prompt.roleContext}

## Business Context
Site Type: ${skill.context.siteType}
Primary Goal: ${skill.context.primaryGoal}
${context.industry ? `Industry: ${context.industry}` : ''}

## Primary KPIs
${kpiSection.primary}

## Metrics to IGNORE
${kpiSection.irrelevant}

## Benchmarks
${benchmarkSection}

## Content Patterns
${contentPatternsSection}
${truncationNotice}
## Pages
\`\`\`json
${pagesJson}
\`\`\`

## Output
${skill.prompt.outputGuidance}

${examplesSection}

## CONSTRAINTS
${constraintsSection}

## Output Format
Return ONLY valid JSON:

{
  "seoActions": [
    {
      "condition": "string",
      "recommendation": "string",
      "specificActions": ["action 1", "action 2"],
      "impact": "high" | "medium" | "low",
      "url": "optional url"
    }
  ]
}`;
}

// ============================================================================
// Legacy Prompt Builder (backward compatibility)
// ============================================================================

/**
 * Legacy SEO prompt builder for backward compatibility.
 * Use buildSEOPromptWithSkill for new skill-based prompts.
 */
export function buildSEOPrompt(pages: EnrichedPage[], context: SEOPromptContext): string {
  const pagesJson = JSON.stringify(
    pages.map((p) => ({
      url: p.url,
      priority: p.priority,
      reason: p.reason,
      paidSpend: p.paidSpend,
      organicPosition: p.organicPosition,
      bounceRate: p.bounceRate,
      impressions: p.impressions,
      ctr: p.ctr,
      content: p.content
        ? {
            wordCount: p.content.wordCount,
            title: p.content.title,
            h1: p.content.h1,
            metaDescription: p.content.metaDescription,
            contentPreview: p.content.contentPreview?.slice(0, 200),
          }
        : null,
    })),
    null,
    2
  );

  return `You are an expert SEO Strategist using Paid Search data to accelerate organic growth.

## Context
- Industry: ${context.industry || 'Not specified'}
- Target Market: ${context.targetMarket || 'Not specified'}

## Critical Pages
These pages have been identified as underperforming based on paid spend vs organic performance, engagement issues, or CTR problems.

${pagesJson}

## Priority Reasons Explained
- **high_spend_low_organic**: Paying heavily for traffic that organic should capture
- **high_traffic_high_bounce**: Getting visitors but they're leaving immediately (UX/content issue)
- **high_impressions_low_ctr**: Appearing in search but not getting clicks (title/meta issue)

## Your Analysis Mandate
For each page, diagnose the problem and prescribe specific fixes:

1. **For High Spend + Low Organic**:
   - What content gaps prevent organic ranking?
   - What on-page SEO issues exist?
   - What new content should be created?

2. **For High Bounce Rate**:
   - Is the content matching search intent?
   - Are there UX issues (speed, mobile, layout)?
   - Is the CTA clear and compelling?

3. **For Low CTR**:
   - Is the title tag optimized and compelling?
   - Does the meta description include a clear value proposition?
   - Are there rich snippet opportunities (FAQ, how-to)?

Use the page content analysis when available to provide specific, contextual recommendations.

## Output Requirements
Provide 5-10 specific recommendations. For each:
- **condition**: The data pattern you identified
- **recommendation**: High-level strategy
- **specificActions**: 2-4 concrete steps to take
- **impact**: high, medium, or low
- **url**: (optional) The specific page this applies to

IMPORTANT: Return ONLY valid JSON without markdown code blocks.

{
  "seoActions": [
    {
      "condition": "string describing the problem",
      "recommendation": "string describing the strategy",
      "specificActions": ["action 1", "action 2", "action 3"],
      "impact": "high" | "medium" | "low",
      "url": "optional url"
    }
  ]
}`;
}
