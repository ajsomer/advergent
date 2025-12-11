/**
 * Ecommerce SEM Skill
 *
 * AI-powered analysis of paid search performance for ecommerce businesses.
 * Focuses on ROAS optimization, Shopping campaigns, and revenue growth.
 */

import type { SEMSkillDefinition } from '../types.js';

export const ecommerceSEMSkill: SEMSkillDefinition = {
  version: '1.0.0',

  context: {
    businessModel:
      'Online retail business selling products directly to consumers. Revenue is generated through product sales, with success measured by transaction volume, average order value, and return on ad spend.',
    conversionDefinition:
      'A conversion is a completed purchase transaction. Conversion value represents the order total. Secondary conversions include add-to-cart events and checkout initiations.',
    typicalCustomerJourney:
      'Awareness (display/social) → Research (generic searches) → Consideration (product-specific searches, comparisons) → Purchase (brand/product searches, Shopping ads) → Repeat (remarketing, email)',
  },

  kpis: {
    primary: [
      {
        metric: 'roas',
        importance: 'critical',
        description: 'Return on Ad Spend - revenue generated per dollar spent',
        targetDirection: 'higher',
        benchmark: 4.0,
        businessContext:
          'Primary efficiency metric. Target ROAS varies by margin (low-margin products need higher ROAS). Below 2x is typically unprofitable.',
      },
      {
        metric: 'revenue',
        importance: 'critical',
        description: 'Total revenue attributed to paid search',
        targetDirection: 'higher',
        businessContext:
          'Top-line growth metric. Balance against ROAS - sometimes lower ROAS at higher revenue is preferable.',
      },
      {
        metric: 'conversionValue',
        importance: 'critical',
        description: 'Total value of conversions (same as revenue for ecommerce)',
        targetDirection: 'higher',
        businessContext: 'Used in bidding strategies and performance evaluation.',
      },
    ],
    secondary: [
      {
        metric: 'conversions',
        importance: 'high',
        description: 'Number of completed transactions',
        targetDirection: 'higher',
        businessContext:
          'Volume metric. High conversions with low value may indicate discount-driven sales.',
      },
      {
        metric: 'aov',
        importance: 'high',
        description: 'Average Order Value',
        targetDirection: 'higher',
        benchmark: 75,
        businessContext:
          'Revenue per transaction. Increasing AOV improves efficiency of acquisition spend.',
      },
      {
        metric: 'ctr',
        importance: 'medium',
        description: 'Click-through rate',
        targetDirection: 'higher',
        benchmark: 0.02,
        businessContext:
          'Ad relevance indicator. Low CTR suggests poor ad copy or targeting.',
      },
      {
        metric: 'impressionShare',
        importance: 'medium',
        description: 'Share of available impressions captured',
        targetDirection: 'higher',
        businessContext:
          'Market presence metric. Low share on high-ROAS keywords indicates growth opportunity.',
      },
    ],
    irrelevant: [
      'cpl', // Cost per lead - not applicable
      'leadQuality', // No leads in ecommerce
      'mrr', // SaaS metric
      'ltv', // Can be relevant but typically not tracked in Google Ads
    ],
  },

  benchmarks: {
    ctr: {
      excellent: 0.04,
      good: 0.025,
      average: 0.015,
      poor: 0.008,
    },
    conversionRate: {
      excellent: 0.04,
      good: 0.025,
      average: 0.015,
      poor: 0.008,
    },
    cpc: {
      excellent: 0.5,
      good: 1.0,
      average: 1.5,
      poor: 2.5,
    },
    roas: {
      excellent: 6.0,
      good: 4.0,
      average: 2.5,
      poor: 1.5,
    },
    costPerConversion: {
      excellent: 15,
      good: 25,
      average: 40,
      poor: 60,
    },
  },

  analysis: {
    keyPatterns: [
      {
        id: 'shopping-dominance',
        name: 'Shopping Campaign Success',
        description: 'Shopping campaigns outperforming text ads',
        indicators: [
          'Shopping ROAS > Search ROAS',
          'Shopping conversion rate higher',
          'Lower CPC on Shopping',
        ],
        recommendation:
          'Shift budget toward Shopping campaigns for product-specific queries',
      },
      {
        id: 'brand-efficiency',
        name: 'Brand Term Efficiency',
        description: 'Brand campaigns showing strong performance',
        indicators: [
          'Brand ROAS > 10',
          'High conversion rate on brand terms',
          'Low CPC',
        ],
        recommendation:
          'Evaluate organic brand visibility - may be able to reduce brand spend',
      },
      {
        id: 'category-expansion',
        name: 'Category Expansion Opportunity',
        description: 'Strong category performance with room to grow',
        indicators: [
          'Good ROAS on category terms',
          'Low impression share',
          'Competitors bidding aggressively',
        ],
        recommendation:
          'Increase budget and bids on performing category keywords',
      },
      {
        id: 'remarketing-value',
        name: 'Remarketing High Value',
        description: 'Remarketing lists showing strong returns',
        indicators: [
          'RLSA ROAS significantly higher than standard',
          'Cart abandoner conversions',
          'Past purchaser repeat purchases',
        ],
        recommendation: 'Expand remarketing lists and increase bid adjustments',
      },
    ],
    antiPatterns: [
      {
        id: 'broad-match-bleed',
        name: 'Broad Match Budget Bleed',
        description: 'Broad match capturing irrelevant traffic',
        indicators: [
          'High spend on broad match',
          'Low conversion rate vs exact/phrase',
          'Many irrelevant search terms',
        ],
        recommendation:
          'Tighten match types, add negatives, or switch to broad match modifier',
      },
      {
        id: 'geographic-waste',
        name: 'Geographic Inefficiency',
        description: 'Spending in non-converting regions',
        indicators: [
          'Low conversion rate in specific geos',
          'High CPA in certain locations',
          'No shipping to some targeted areas',
        ],
        recommendation: 'Review geographic targeting, add location exclusions',
      },
      {
        id: 'mobile-mismatch',
        name: 'Mobile Experience Gap',
        description: 'Mobile traffic not converting',
        indicators: [
          'High mobile impressions',
          'Low mobile conversion rate',
          'Mobile bounce rate significantly higher',
        ],
        recommendation:
          'Audit mobile site experience, consider mobile bid adjustments',
      },
    ],
    opportunities: [
      {
        type: 'pmax-adoption',
        description: 'Performance Max campaign opportunity',
        signals: [
          'Strong Shopping performance',
          'Good product feed quality',
          'Multiple conversion actions tracked',
        ],
        typicalAction: 'Test Performance Max campaign with best-performing products',
      },
      {
        type: 'audience-expansion',
        description: 'Audience targeting expansion',
        signals: [
          'Strong remarketing performance',
          'Customer match data available',
          'Similar audiences not tested',
        ],
        typicalAction: 'Layer in-market and similar audiences on campaigns',
      },
      {
        type: 'feed-optimization',
        description: 'Product feed improvement opportunity',
        signals: [
          'Low Shopping impression share',
          'Products disapproved',
          'Missing product attributes',
        ],
        typicalAction: 'Optimize product titles, descriptions, and attributes',
      },
    ],
  },

  prompt: {
    roleContext: `You are an expert ecommerce PPC strategist analyzing Google Ads performance for an online retail business. Your recommendations should focus on maximizing return on ad spend (ROAS) while growing profitable revenue. You understand the nuances of Shopping campaigns, product feed optimization, and the ecommerce customer journey.`,

    analysisInstructions: `Analyze the provided keyword and campaign data with these priorities:

1. ROAS OPTIMIZATION: Identify keywords and campaigns with below-target ROAS that are dragging down overall performance. Consider whether poor ROAS is due to targeting, bid strategy, or landing page issues.

2. REVENUE GROWTH: Find opportunities to scale profitable keywords by increasing impression share. Look for high-ROAS keywords with budget or bid constraints.

3. SHOPPING vs SEARCH: Evaluate the balance between Shopping and Search campaigns. Product queries often perform better on Shopping.

4. COMPETITIVE POSITION: Assess impression share and auction insights to understand market position. Identify where competitors are winning.

5. KEYWORD EFFICIENCY: Analyze match type performance. Broad match often needs tighter control in ecommerce.

For each issue identified, quantify the potential impact in terms of revenue or cost savings.`,

    outputGuidance: `Structure recommendations as specific, actionable items:
- Lead with the business impact (revenue opportunity or cost savings)
- Specify exact keywords, campaigns, or settings to change
- Provide benchmarks or targets for success
- Consider seasonality and inventory when relevant

Prioritize recommendations by potential revenue impact. An ecommerce manager should be able to implement these changes immediately.`,

    examples: [
      {
        scenario: 'High-spend keyword with poor ROAS',
        data: 'Keyword "wireless headphones" - $2,400/month spend, 1.2 ROAS, 2.1% CTR, $45 CPC',
        recommendation:
          'Reduce bids on "wireless headphones" by 30% or pause and reallocate to Shopping campaigns where this category shows 3.8 ROAS. Estimated monthly savings: $800-1,000.',
        reasoning:
          'Generic product terms often perform better on Shopping where visual ads and pricing drive purchase intent. The high CPC suggests aggressive competition on text ads.',
      },
      {
        scenario: 'Strong performer limited by budget',
        data: 'Keyword "buy nike air max" - $500/month spend, 6.2 ROAS, 45% impression share lost to budget',
        recommendation:
          'Increase daily budget allocation to capture additional 45% impression share on "buy nike air max". At current ROAS, an additional $500/month spend could generate $3,100 in revenue.',
        reasoning:
          'High-intent purchase queries with strong ROAS should capture maximum available traffic. Budget limitations are leaving revenue on the table.',
      },
    ],

    constraints: [
      'Always recommend ROAS targets appropriate for the product category',
      'Consider that some low-ROAS keywords may be necessary for brand awareness',
      'Account for Shopping campaign dynamics when analyzing product keywords',
      'Do not recommend pausing campaigns without suggesting reallocation',
      'Factor in seasonality - Q4 may justify higher spend at lower ROAS',
    ],
  },

  output: {
    recommendationTypes: {
      prioritize: [
        'budget-reallocation',
        'bid-optimization',
        'shopping-expansion',
        'negative-keywords',
        'audience-targeting',
      ],
      deprioritize: [
        'brand-campaign-changes', // Often sensitive
        'complete-restructure', // Too disruptive
      ],
      exclude: [
        'platform-migration', // Out of scope
        'attribution-model-change', // Requires stakeholder buy-in
      ],
    },
    maxRecommendations: 8,
    requireQuantifiedImpact: true,
  },
};
