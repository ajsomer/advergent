/**
 * Lead-Gen SEM Skill
 *
 * AI-powered analysis of paid search performance for lead generation businesses.
 * Focuses on cost per lead optimization, form submissions, and call tracking.
 */

import type { SEMSkillDefinition } from '../types.js';

export const leadGenSEMSkill: SEMSkillDefinition = {
  version: '1.0.0',

  context: {
    businessModel:
      'Service business generating leads through form submissions and phone calls. Success is measured by lead volume and cost efficiency, not direct revenue. Lead quality matters as much as quantity.',
    conversionDefinition:
      'A conversion is a qualified lead - form submission, phone call, or consultation request. Lead quality varies significantly - a commercial contract inquiry is worth more than a basic information request.',
    typicalCustomerJourney:
      'Problem awareness → Solution research (comparing providers) → Consideration (reading reviews, checking credentials) → Contact (form/call) → Sales follow-up → Close',
  },

  kpis: {
    primary: [
      {
        metric: 'cpl',
        importance: 'critical',
        description: 'Cost Per Lead - average cost to acquire a lead',
        targetDirection: 'lower',
        benchmark: 75,
        businessContext:
          'Primary efficiency metric. Target CPL varies by industry and lead value. Should be well below expected customer lifetime value.',
      },
      {
        metric: 'conversions',
        importance: 'critical',
        description: 'Total number of leads generated',
        targetDirection: 'higher',
        businessContext:
          'Volume metric. Balance against CPL - cheaper leads at scale may reduce quality.',
      },
      {
        metric: 'conversionRate',
        importance: 'critical',
        description: 'Percentage of clicks that become leads',
        targetDirection: 'higher',
        benchmark: 0.05,
        businessContext:
          'Landing page and targeting effectiveness indicator. Low rates suggest audience or page issues.',
      },
    ],
    secondary: [
      {
        metric: 'ctr',
        importance: 'medium',
        description: 'Click-through rate',
        targetDirection: 'higher',
        benchmark: 0.03,
        businessContext:
          'Ad relevance indicator. Low CTR suggests poor ad copy or targeting.',
      },
      {
        metric: 'impressionShare',
        importance: 'medium',
        description: 'Share of available impressions captured',
        targetDirection: 'higher',
        businessContext:
          'Market presence metric. Low share on efficient keywords indicates growth opportunity.',
      },
      {
        metric: 'qualityScore',
        importance: 'medium',
        description: 'Google Ads quality score',
        targetDirection: 'higher',
        benchmark: 7,
        businessContext:
          'Affects CPC and ad position. Low scores increase costs.',
      },
      {
        metric: 'callConversions',
        importance: 'high',
        description: 'Phone call leads from ads',
        targetDirection: 'higher',
        businessContext:
          'Phone leads often higher quality than form submissions. Track call duration for quality.',
      },
    ],
    irrelevant: [
      'roas', // NO direct revenue tracking
      'revenue', // Service revenue not tracked in Google Ads
      'aov', // No average order value
      'conversionValue', // Leads don't have direct monetary value in platform
      'transactionId', // No transactions
      'mrr', // SaaS metric
      'arr', // SaaS metric
    ],
  },

  benchmarks: {
    ctr: {
      excellent: 0.05,
      good: 0.035,
      average: 0.02,
      poor: 0.01,
    },
    conversionRate: {
      excellent: 0.08,
      good: 0.05,
      average: 0.03,
      poor: 0.015,
    },
    cpc: {
      excellent: 2.0,
      good: 4.0,
      average: 7.0,
      poor: 12.0,
    },
    costPerConversion: {
      excellent: 30,
      good: 60,
      average: 100,
      poor: 175,
    },
  },

  analysis: {
    keyPatterns: [
      {
        id: 'call-extension-success',
        name: 'Call Extension Performance',
        description: 'Call extensions driving significant lead volume',
        indicators: [
          'High call conversion rate',
          'Calls during business hours',
          'Long call duration (quality indicator)',
        ],
        recommendation:
          'Maximize call extension visibility, consider call-only campaigns for mobile',
      },
      {
        id: 'form-conversion-efficiency',
        name: 'Form Conversion Efficiency',
        description: 'Landing pages with strong form completion rates',
        indicators: [
          'High form submission rate',
          'Low form abandonment',
          'Multiple form completions from same campaign',
        ],
        recommendation:
          'Identify winning landing page elements and replicate across campaigns',
      },
      {
        id: 'service-keyword-strength',
        name: 'Service Keyword Strength',
        description: 'Service-specific keywords outperforming generic terms',
        indicators: [
          'Lower CPL on service keywords',
          'Higher conversion rate',
          'Better quality score',
        ],
        recommendation:
          'Expand specific service keyword coverage, reduce generic term spend',
      },
      {
        id: 'location-performance',
        name: 'Location Targeting Success',
        description: 'Strong performance in specific geographic areas',
        indicators: [
          'Lower CPL in certain locations',
          'Higher conversion rate by area',
          'Consistent lead quality from regions',
        ],
        recommendation:
          'Increase bids and budget in high-performing locations',
      },
    ],
    antiPatterns: [
      {
        id: 'broad-match-waste',
        name: 'Broad Match Budget Waste',
        description: 'Broad match capturing irrelevant service queries',
        indicators: [
          'High spend on broad match with low conversions',
          'Many irrelevant search terms',
          'Low quality score',
        ],
        recommendation:
          'Tighten match types, add extensive negative keywords, review search terms weekly',
      },
      {
        id: 'after-hours-waste',
        name: 'After-Hours Spend Inefficiency',
        description: 'Spending during hours when leads cannot be followed up',
        indicators: [
          'Conversions during non-business hours',
          'Lower call answer rate',
          'Delayed lead response time',
        ],
        recommendation:
          'Implement ad scheduling, reduce bids during off-hours, ensure lead capture for later follow-up',
      },
      {
        id: 'mobile-form-friction',
        name: 'Mobile Form Friction',
        description: 'Mobile traffic not converting due to form issues',
        indicators: [
          'High mobile impressions',
          'Low mobile conversion rate',
          'High mobile bounce rate',
        ],
        recommendation:
          'Simplify mobile forms, implement click-to-call, consider call-only campaigns',
      },
      {
        id: 'geographic-mismatch',
        name: 'Geographic Targeting Mismatch',
        description: 'Spending in areas outside service territory',
        indicators: [
          'Conversions from non-service areas',
          'Wasted spend on unserviceable leads',
          'Location settings too broad',
        ],
        recommendation:
          'Tighten location targeting to actual service areas, add location exclusions',
      },
    ],
    opportunities: [
      {
        type: 'call-only-campaigns',
        description: 'Call-only campaign opportunity for mobile traffic',
        signals: [
          'High mobile traffic percentage',
          'Strong call extension performance',
          'Phone leads higher quality than forms',
        ],
        typicalAction: 'Launch call-only campaigns for high-intent service keywords',
      },
      {
        type: 'lead-form-extensions',
        description: 'Google Lead Form Extension opportunity',
        signals: [
          'High mobile traffic',
          'Form completion is primary goal',
          'Simple qualification questions',
        ],
        typicalAction: 'Test lead form extensions to reduce friction on mobile',
      },
      {
        type: 'local-campaigns',
        description: 'Local Services Ads opportunity',
        signals: [
          'Service business with physical presence',
          'Google-verified business',
          'Strong review profile',
        ],
        typicalAction: 'Enroll in Local Services Ads for guaranteed lead pricing',
      },
      {
        type: 'remarketing-leads',
        description: 'Remarketing to site visitors who did not convert',
        signals: [
          'High traffic, low conversion rate',
          'Long consideration cycle',
          'Multiple touch points before conversion',
        ],
        typicalAction: 'Implement RLSA and display remarketing for lead nurturing',
      },
    ],
  },

  prompt: {
    roleContext: `You are an expert lead generation PPC strategist analyzing Google Ads performance for a service business. Your recommendations should focus on reducing cost per lead while maintaining or improving lead quality. You understand the nuances of service-based businesses where success is measured by lead volume and cost efficiency, NOT by direct revenue or ROAS.`,

    analysisInstructions: `Analyze the provided keyword and campaign data with these priorities:

1. COST PER LEAD OPTIMIZATION: Identify keywords and campaigns with above-target CPL. Determine whether high CPL is due to poor targeting, low quality scores, or landing page issues.

2. LEAD VOLUME GROWTH: Find opportunities to scale efficient keywords by increasing impression share. Look for keywords with good CPL that are budget or bid constrained.

3. CALL vs FORM PERFORMANCE: Evaluate the balance between call and form conversions. Phone leads often have higher close rates - ensure call tracking is optimized.

4. GEOGRAPHIC EFFICIENCY: Assess location targeting to ensure spend aligns with actual service areas. Identify high-performing and underperforming regions.

5. LANDING PAGE IMPACT: Analyze conversion rates by landing page to identify optimization opportunities. A/B testing recommendations should be specific.

For each issue identified, quantify the potential impact in terms of lead volume or cost savings.`,

    outputGuidance: `Structure recommendations as specific, actionable items:
- Lead with the business impact (additional leads or cost savings)
- Specify exact keywords, campaigns, or settings to change
- Provide CPL targets or benchmarks for success
- Consider lead quality implications, not just volume

Prioritize recommendations by potential CPL reduction or lead volume increase. A marketing manager should be able to implement these changes immediately.`,

    examples: [
      {
        scenario: 'High-spend keyword with poor CPL',
        data: 'Keyword "plumber near me" - $1,800/month spend, $180 CPL, 2.1% CTR, 10 leads',
        recommendation:
          'Reduce bids on "plumber near me" by 25% and reallocate budget to "emergency plumber [city]" which shows $65 CPL. Add phrase match negatives for DIY and salary-related queries. Estimated savings: $400-600/month while maintaining lead volume.',
        reasoning:
          'Generic "near me" queries often capture research-stage users. More specific service + location combinations typically convert better and have clearer intent.',
      },
      {
        scenario: 'Strong performer limited by budget',
        data: 'Keyword "roof repair quote" - $400/month spend, $45 CPL, 55% impression share lost to budget',
        recommendation:
          'Increase daily budget allocation to capture additional 55% impression share on "roof repair quote". At current CPL, an additional $400/month spend could generate 9 more leads per month.',
        reasoning:
          'High-intent service queries with efficient CPL should maximize visibility. Budget constraints are leaving qualified leads for competitors.',
      },
    ],

    constraints: [
      'NEVER mention ROAS - this is not an ecommerce business',
      'NEVER recommend Shopping campaigns or product feeds',
      'Focus on lead quality, not just volume - cheaper leads may not close',
      'Consider that lead value varies - a commercial contract lead > residential',
      'Account for sales team capacity when recommending volume increases',
      'Ensure geographic targeting aligns with actual service areas',
      'Consider business hours when evaluating ad scheduling',
    ],
  },

  output: {
    recommendationTypes: {
      prioritize: [
        'cpl-reduction',
        'lead-volume-growth',
        'call-optimization',
        'landing-page-improvement',
        'geographic-targeting',
        'negative-keywords',
      ],
      deprioritize: [
        'brand-campaign-changes', // Often sensitive
        'complete-restructure', // Too disruptive
      ],
      exclude: [
        'shopping-campaigns', // Not applicable
        'product-feed-optimization', // Not applicable
        'roas-targeting', // Wrong metric
        'revenue-maximization', // Wrong model
      ],
    },
    maxRecommendations: 8,
    requireQuantifiedImpact: true,
  },
};
