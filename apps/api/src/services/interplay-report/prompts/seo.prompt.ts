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
// Types
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
export function buildSEOPrompt(pages: EnrichedPage[], context: SEOAgentContext): string {
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

