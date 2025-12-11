/**
 * Director Agent Prompt Builder
 *
 * Builds prompts for the Director agent using skill-based configuration
 * with synthesis rules and executive summary guidance.
 */

import type { SEMAgentOutput, SEOAgentOutput } from '../types.js';
import type { DirectorSkillDefinition } from '../skills/types.js';
import {
  formatConflictRules,
  formatSynergyRules,
  formatPrioritizationRules,
  formatConstraints,
  validatePromptSize,
} from './serialization.js';

// ============================================================================
// Legacy Types (for backward compatibility)
// ============================================================================

export interface DirectorPromptContext {
  industry?: string;
  targetMarket?: string;
  clientName?: string;
}

// ============================================================================
// Skill-based Types
// ============================================================================

export interface DirectorAgentContext {
  skill: DirectorSkillDefinition;
  industry?: string;
  targetMarket?: string;
  clientName?: string;
}

// ============================================================================
// Prompt Builders
// ============================================================================

/**
 * Build Director prompt using skill configuration.
 */
export function buildDirectorPromptWithSkill(
  semAnalysis: SEMAgentOutput,
  seoAnalysis: SEOAgentOutput,
  context: DirectorAgentContext
): string {
  const { skill } = context;

  const inputData = JSON.stringify(
    {
      semAnalysis,
      seoAnalysis,
    },
    null,
    2
  );

  const prompt = buildFullDirectorPrompt(inputData, skill, context);

  // Final safety check
  validatePromptSize(prompt, 'Director');

  return prompt;
}

/**
 * Build full Director prompt with all skill details.
 */
function buildFullDirectorPrompt(
  inputData: string,
  skill: DirectorSkillDefinition,
  context: DirectorAgentContext
): string {
  const conflictRulesSection = formatConflictRules(skill.synthesis.conflictResolution);
  const synergyRulesSection = formatSynergyRules(skill.synthesis.synergyIdentification);
  const prioritizationRulesSection = formatPrioritizationRules(skill.synthesis.prioritization);
  const constraintsSection = formatConstraints(skill.prompt.constraints);

  // Format business priorities
  const prioritiesSection = skill.context.businessPriorities
    .map((p, i) => `${i + 1}. ${p}`)
    .join('\n');

  // Format success metrics
  const metricsSection = skill.context.successMetrics.map((m) => `- ${m}`).join('\n');

  // Format executive summary guidance
  const focusAreasSection = skill.executiveSummary.focusAreas.map((f) => `- ${f}`).join('\n');
  const quantifyMetricsSection = skill.executiveSummary.metricsToQuantify
    .map((m) => `- ${m}`)
    .join('\n');

  // Format filtering rules
  const mustIncludeSection =
    skill.filtering.mustInclude.length > 0
      ? skill.filtering.mustInclude.map((m) => `- ${m}`).join('\n')
      : 'None specified';
  const mustExcludeSection =
    skill.filtering.mustExclude.length > 0
      ? skill.filtering.mustExclude.map((m) => `- ${m}`).join('\n')
      : 'None specified';

  return `${skill.prompt.roleContext}

## Business Context
${skill.context.executiveFraming}
${context.industry ? `Industry: ${context.industry}` : ''}
${context.targetMarket ? `Target Market: ${context.targetMarket}` : ''}

### Business Priorities (in order)
${prioritiesSection}

### Success Metrics
${metricsSection}

## Specialist Outputs
You have received tactical recommendations from your SEM and SEO specialists:

${inputData}

## Synthesis Rules

### Conflict Resolution
When SEM and SEO recommendations conflict, apply these rules:
${conflictRulesSection}

### Synergy Identification
Look for opportunities to combine recommendations:
${synergyRulesSection}

### Prioritization Rules
Adjust recommendation priority based on:
${prioritizationRulesSection}

## Your Mandate

### 1. Synthesize & Prioritize
${skill.prompt.synthesisInstructions}

### 2. Curation & Filtering
Apply the following logic:

**Impact Weights:**
- Revenue Impact: ${skill.filtering.impactWeights.revenue * 100}%
- Cost Savings: ${skill.filtering.impactWeights.cost * 100}%
- Implementation Effort: ${skill.filtering.impactWeights.effort * 100}%
- Risk: ${skill.filtering.impactWeights.risk * 100}%

**Filtering Rules:**
- Maximum recommendations: ${skill.filtering.maxRecommendations}
- Minimum impact threshold: ${skill.filtering.minImpactThreshold}

**Must Include (if present):**
${mustIncludeSection}

**Must Exclude:**
${mustExcludeSection}

### 3. Executive Summary
${skill.executiveSummary.framingGuidance}

**Focus Areas to Address:**
${focusAreasSection}

**Metrics to Quantify:**
${quantifyMetricsSection}

**Maximum Highlights:** ${skill.executiveSummary.maxHighlights}

### 4. Prioritization Guidance
${skill.prompt.prioritizationGuidance}

## Output Format
${skill.prompt.outputFormat}

## CRITICAL CONSTRAINTS
${constraintsSection}

## Output Requirements
IMPORTANT: Return ONLY valid JSON without markdown code blocks.

{
  "executiveSummary": {
    "summary": "3-5 sentence executive overview",
    "keyHighlights": ["highlight 1", "highlight 2", "highlight 3"]
  },
  "unifiedRecommendations": [
    {
      "title": "Short actionable title (max 100 chars)",
      "description": "2-3 sentence explanation of the recommendation",
      "type": "${skill.output.categoryLabels.sem}" | "${skill.output.categoryLabels.seo}" | "${skill.output.categoryLabels.hybrid}",
      "impact": "high" | "medium" | "low",
      "effort": "high" | "medium" | "low",
      "actionItems": ["specific action 1", "specific action 2"]
    }
  ]
}

Remember:
- Maximum ${skill.filtering.maxRecommendations} recommendations
- Prioritize by business impact
- Be specific and actionable
- Combine related recommendations when possible`;
}

// ============================================================================
// Legacy Prompt Builder (backward compatibility)
// ============================================================================

/**
 * Legacy Director prompt builder for backward compatibility.
 * Use buildDirectorPromptWithSkill for new skill-based prompts.
 */
export function buildDirectorPrompt(
  semAnalysis: SEMAgentOutput,
  seoAnalysis: SEOAgentOutput,
  context: DirectorPromptContext
): string {
  const inputData = JSON.stringify(
    {
      semAnalysis,
      seoAnalysis,
    },
    null,
    2
  );

  return `You are a Digital Marketing Director synthesizing specialist recommendations into an executive report.

## Context
- Industry: ${context.industry || 'Not specified'}
- Target Market: ${context.targetMarket || 'Not specified'}

## Specialist Outputs
You have received tactical recommendations from your SEM and SEO specialists:

${inputData}

## Your Mandate

### 1. Synthesize & Prioritize
Review all recommendations from both specialists and:
- Resolve conflicts (e.g., if SEM says "reduce spend" but SEO says "content isn't ready yet")
- Identify synergies (e.g., reducing paid spend on a term while improving organic)
- Order by **Business Impact** (revenue generation or cost savings)

### 2. Curation & Filtering
Apply the following logic:
- **Rank** all recommendations by Impact (High > Medium > Low)
- **Filter**:
  - If > 10 High/Medium recommendations: DROP all Low recommendations
  - If < 5 High/Medium recommendations: INCLUDE best Low recommendations to reach 5-7 items
  - **Cap** the final list at **10 items maximum**
- **Combine** related SEM + SEO recommendations into "hybrid" recommendations when appropriate

### 3. Executive Summary
Write a narrative summary (3-5 sentences) assessing:
- Overall account health (overspending? under-investing? misaligned strategy?)
- Key opportunities identified
- Recommended priority focus area
- Estimated impact if recommendations are implemented

### 4. Unified Recommendations
Present the final curated list with clear titles and action items.

## Output Requirements
IMPORTANT: Return ONLY valid JSON without markdown code blocks.

{
  "executiveSummary": {
    "summary": "3-5 sentence executive overview",
    "keyHighlights": ["highlight 1", "highlight 2", "highlight 3"]
  },
  "unifiedRecommendations": [
    {
      "title": "Short actionable title (max 100 chars)",
      "description": "2-3 sentence explanation of the recommendation",
      "type": "sem" | "seo" | "hybrid",
      "impact": "high" | "medium" | "low",
      "effort": "high" | "medium" | "low",
      "actionItems": ["specific action 1", "specific action 2"]
    }
  ]
}

Remember:
- Maximum 10 recommendations
- Prioritize by business impact
- Be specific and actionable
- Combine related recommendations when possible`;
}
