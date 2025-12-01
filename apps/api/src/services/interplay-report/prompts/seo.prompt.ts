/**
 * SEO Agent Prompt Builder
 */

import type { EnrichedPage } from '../types.js';

export interface SEOPromptContext {
  industry?: string;
  targetMarket?: string;
  clientName?: string;
}

export function buildSEOPrompt(
  pages: EnrichedPage[],
  context: SEOPromptContext
): string {
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
