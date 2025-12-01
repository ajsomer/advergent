/**
 * SEM Agent Prompt Builder
 */

import type { EnrichedKeyword } from '../types.js';

export interface SEMPromptContext {
  industry?: string;
  targetMarket?: string;
  clientName?: string;
}

export function buildSEMPrompt(
  keywords: EnrichedKeyword[],
  context: SEMPromptContext
): string {
  const keywordsJson = JSON.stringify(
    keywords.map((k) => ({
      query: k.query,
      priority: k.priority,
      reason: k.reason,
      spend: k.spend,
      roas: k.roas,
      organicPosition: k.organicPosition,
      conversions: k.conversions,
      competitiveMetrics: k.competitiveMetrics
        ? {
            impressionShare: k.competitiveMetrics.impressionShare,
            lostImpressionShareRank: k.competitiveMetrics.lostImpressionShareRank,
            lostImpressionShareBudget: k.competitiveMetrics.lostImpressionShareBudget,
            topOfPageRate: k.competitiveMetrics.topOfPageRate,
            dataLevel: k.competitiveMetrics.dataLevel,
          }
        : null,
    })),
    null,
    2
  );

  return `You are an elite Google Ads Strategist analyzing the interplay between Paid and Organic search performance.

## Context
- Industry: ${context.industry || 'Not specified'}
- Target Market: ${context.targetMarket || 'Not specified'}

## Battleground Keywords
These keywords have been identified as requiring immediate attention based on spend, ROAS, organic overlap, or competitive pressure.

${keywordsJson}

## Priority Reasons Explained
- **high_spend_low_roas**: Spending heavily but not converting efficiently
- **cannibalization_risk**: Strong organic position but still paying for ads
- **growth_potential**: Converting well but may have expansion opportunity
- **competitive_pressure**: Facing significant competition (check impression share)

## Your Analysis Mandate
Review each keyword and provide specific, actionable recommendations:

1. **For High Spend + Low ROAS**: Should we reduce bids, pause, or restructure?
2. **For Cannibalization Risk**: Should we reduce paid spend and rely on organic?
3. **For Growth Potential**: Should we increase bids to capture more volume?
4. **For Competitive Pressure**: How should we respond to competitors?

Consider the competitive metrics when available:
- Low Impression Share + High Lost IS (Rank) = Need higher bids
- High Lost IS (Budget) = Need more budget allocation
- High Top of Page Rate = Already well-positioned

## Output Requirements
Provide 5-10 specific recommendations. For each:
- **action**: Exact change to make (e.g., "Reduce bids by 20% on [keyword]")
- **level**: campaign, ad_group, or keyword
- **expectedUplift**: Quantified impact estimate
- **reasoning**: Why, based on the data
- **impact**: high, medium, or low

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
