/**
 * SEM Agent Prompt Builder
 *
 * Builds prompts for the SEM agent using skill-based configuration
 * with token budget management.
 */

import type { EnrichedKeyword } from '../types.js';
import type { SEMSkillDefinition } from '../skills/types.js';
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
  validatePromptSize,
  type SerializableKeyword,
} from './serialization.js';

// ============================================================================
// Types
// ============================================================================

export interface SEMAgentContext {
  skill: SEMSkillDefinition;
  industry?: string;
  targetMarket?: string;
  clientName?: string;
}

// ============================================================================
// Prompt Builders
// ============================================================================

/**
 * Build SEM prompt using skill configuration.
 * Automatically manages token budget and truncates data if needed.
 */
export function buildSEMPrompt(
  keywords: EnrichedKeyword[],
  context: SEMAgentContext
): string {
  const { skill } = context;

  // Convert to serializable format
  const serializableKeywords: SerializableKeyword[] = keywords.map((k) => ({
    query: k.query,
    priority: k.priority,
    reason: k.reason,
    spend: k.spend,
    conversions: k.conversions,
    roas: k.roas,
    organicPosition: k.organicPosition,
    competitiveMetrics: k.competitiveMetrics
      ? {
          impressionShare: k.competitiveMetrics.impressionShare,
          lostImpressionShareRank: k.competitiveMetrics.lostImpressionShareRank,
          lostImpressionShareBudget: k.competitiveMetrics.lostImpressionShareBudget,
          topOfPageRate: k.competitiveMetrics.topOfPageRate,
          absTopOfPageRate: k.competitiveMetrics.absTopOfPageRate,
          dataLevel: k.competitiveMetrics.dataLevel,
        }
      : undefined,
  }));

  const { mode, budget } = determineSerializationMode(serializableKeywords, []);

  // Truncate keywords if needed, keeping highest priority
  const { included: includedKeywords, dropped } = prioritizeAndTruncate(
    serializableKeywords,
    budget.keywordsIncluded,
    calculateKeywordPriority
  );

  // Add truncation notice if data was dropped
  const truncationNotice =
    dropped > 0
      ? `\n\nNOTE: Data was truncated for token limits. ${dropped} lower-priority keywords omitted. Focus analysis on the provided high-priority items.\n`
      : '';

  const prompt =
    mode === 'compact'
      ? buildCompactSEMPrompt(includedKeywords, skill, truncationNotice, context)
      : buildFullSEMPrompt(includedKeywords, skill, truncationNotice, context);

  // Final safety check
  validatePromptSize(prompt, 'SEM');

  return prompt;
}

/**
 * Build full SEM prompt with all skill details.
 */
function buildFullSEMPrompt(
  keywords: SerializableKeyword[],
  skill: SEMSkillDefinition,
  truncationNotice: string,
  context: SEMAgentContext
): string {
  const kpiSection = formatKPIs(skill.kpis);
  const benchmarkSection = formatBenchmarks(skill.benchmarks);
  const examplesSection = formatSEMExamples(skill.prompt.examples);
  const constraintsSection = formatConstraints(skill.prompt.constraints);

  const keywordsJson = JSON.stringify(keywords, null, 2);

  return `${skill.prompt.roleContext}

## Business Context
${skill.context.businessModel}

Conversion Definition: ${skill.context.conversionDefinition}
Customer Journey: ${skill.context.typicalCustomerJourney}
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

## Analysis Guidance
${skill.prompt.analysisInstructions}

## Patterns to Look For
${formatPatterns(skill.analysis.keyPatterns)}

## Anti-Patterns (Problems to Flag)
${formatPatterns(skill.analysis.antiPatterns)}
${truncationNotice}
## Data to Analyze
\`\`\`json
${keywordsJson}
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
  "semActions": [
    {
      "action": "string",
      "level": "campaign" | "ad_group" | "keyword",
      "expectedUplift": "string",
      "reasoning": "string",
      "impact": "high" | "medium" | "low",
      "keyword": "optional keyword this applies to"
    }
  ]
}`;
}

/**
 * Build compact SEM prompt for token-constrained scenarios.
 */
function buildCompactSEMPrompt(
  keywords: SerializableKeyword[],
  skill: SEMSkillDefinition,
  truncationNotice: string,
  context: SEMAgentContext
): string {
  const kpiSection = formatKPIsCompact(skill.kpis);
  const benchmarkSection = formatBenchmarksCompact(skill.benchmarks);
  const examplesSection = formatSEMExamplesCompact(skill.prompt.examples);
  const constraintsSection = formatConstraints(skill.prompt.constraints);

  const keywordsJson = JSON.stringify(keywords, null, 2);

  return `${skill.prompt.roleContext}

## Business Context
${skill.context.businessModel}
${context.industry ? `Industry: ${context.industry}` : ''}

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
${keywordsJson}
\`\`\`

## Output
${skill.prompt.outputGuidance}

${examplesSection}

## CONSTRAINTS
${constraintsSection}

## Output Format
Return ONLY valid JSON:

{
  "semActions": [
    {
      "action": "string",
      "level": "campaign" | "ad_group" | "keyword",
      "expectedUplift": "string",
      "reasoning": "string",
      "impact": "high" | "medium" | "low",
      "keyword": "optional keyword"
    }
  ]
}`;
}

