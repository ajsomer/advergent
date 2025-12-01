/**
 * Director Agent Prompt Builder
 */

import type { SEMAgentOutput, SEOAgentOutput } from '../types.js';

export interface DirectorPromptContext {
  industry?: string;
  targetMarket?: string;
  clientName?: string;
}

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
