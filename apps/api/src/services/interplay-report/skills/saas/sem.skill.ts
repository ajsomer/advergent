/**
 * SaaS SEM Skill
 *
 * AI-powered analysis of paid search performance for SaaS businesses.
 * Focuses on trial signups, demo requests, and customer acquisition cost optimization.
 */

import type { SEMSkillDefinition } from '../types.js';

export const saasSEMSkill: SEMSkillDefinition = {
  version: '1.0.0',

  context: {
    businessModel:
      'Subscription software business. Revenue comes from recurring subscriptions, so customer lifetime value (LTV) justifies higher acquisition costs. Focus on qualified signups over raw volume.',
    conversionDefinition:
      'Primary conversions: Free trial signup or demo request. Secondary conversions: Pricing page visit, feature page engagement. Quality matters - a qualified trial that converts to paid > 10 unqualified signups.',
    typicalCustomerJourney:
      'Problem awareness → Solution research → Vendor comparison → Trial/Demo → Evaluation → Purchase decision → Onboarding → Expansion/Upsell',
  },

  kpis: {
    primary: [
      {
        metric: 'trialSignups',
        importance: 'critical',
        description: 'Number of free trial signups',
        targetDirection: 'higher',
        businessContext:
          'Primary conversion metric. Quality matters - track trial-to-paid conversion rate alongside volume.',
      },
      {
        metric: 'cac',
        importance: 'critical',
        description: 'Customer Acquisition Cost - cost to acquire a new customer',
        targetDirection: 'lower',
        benchmark: 150,
        businessContext:
          'Primary efficiency metric. Should be evaluated against LTV (target LTV:CAC ratio of 3:1+).',
      },
      {
        metric: 'demoRequests',
        importance: 'high',
        description: 'Number of demo requests (enterprise focus)',
        targetDirection: 'higher',
        businessContext:
          'High-value conversion for enterprise SaaS. Demos typically have higher close rates than self-serve trials.',
      },
    ],
    secondary: [
      {
        metric: 'conversionRate',
        importance: 'high',
        description: 'Percentage of clicks that become trials/demos',
        targetDirection: 'higher',
        benchmark: 0.04,
        businessContext:
          'Landing page and targeting effectiveness indicator.',
      },
      {
        metric: 'ctr',
        importance: 'medium',
        description: 'Click-through rate',
        targetDirection: 'higher',
        benchmark: 0.03,
        businessContext:
          'Ad relevance indicator. SaaS keywords should have targeted, relevant ads.',
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
          'Affects CPC and ad position. Low scores increase acquisition costs.',
      },
    ],
    irrelevant: [
      'aov', // No average order value - subscriptions
      'transactionValue', // Not tracked in Google Ads for SaaS
      'transactionId', // No one-time transactions
      'productRevenue', // Not a product business
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
      excellent: 0.07,
      good: 0.04,
      average: 0.025,
      poor: 0.01,
    },
    cpc: {
      excellent: 3.0,
      good: 6.0,
      average: 10.0,
      poor: 18.0,
    },
    costPerConversion: {
      excellent: 50,
      good: 100,
      average: 175,
      poor: 300,
    },
  },

  analysis: {
    keyPatterns: [
      {
        id: 'competitor-conquesting-success',
        name: 'Competitor Conquesting Success',
        description: 'Competitor brand keywords driving conversions',
        indicators: [
          'Conversions on competitor terms',
          'Reasonable CPC despite competition',
          'Good landing page with comparison content',
        ],
        recommendation:
          'Expand competitor targeting with dedicated comparison landing pages. Track closely for trademark issues.',
      },
      {
        id: 'feature-keyword-strength',
        name: 'Feature Keyword Strength',
        description: 'Product feature keywords outperforming generic terms',
        indicators: [
          'Higher conversion rate on feature keywords',
          'Lower CAC than category keywords',
          'Clear user intent alignment',
        ],
        recommendation:
          'Expand feature keyword coverage, create dedicated landing pages for top features.',
      },
      {
        id: 'integration-keyword-success',
        name: 'Integration Keyword Success',
        description: 'Integration-related keywords showing strong performance',
        indicators: [
          '[Tool] integration keywords converting',
          'Clear product-market fit signal',
          'Partnership marketing opportunity',
        ],
        recommendation:
          'Build out integration keyword coverage, create co-marketing content with partners.',
      },
      {
        id: 'trial-vs-demo-balance',
        name: 'Trial vs Demo Balance',
        description: 'Understanding optimal conversion path by audience',
        indicators: [
          'Different conversion rates for trial vs demo',
          'Enterprise keywords prefer demo',
          'SMB keywords prefer trial',
        ],
        recommendation:
          'Segment campaigns by buyer type, offer appropriate conversion action.',
      },
    ],
    antiPatterns: [
      {
        id: 'broad-match-waste',
        name: 'Broad Match Budget Waste',
        description: 'Broad match capturing irrelevant software queries',
        indicators: [
          'High spend on broad match with low conversions',
          'Irrelevant search terms (tutorials, jobs, reviews)',
          'Low quality score',
        ],
        recommendation:
          'Tighten match types, add extensive negative keywords (free, tutorial, jobs, salary, reviews).',
      },
      {
        id: 'competitor-trademark-risk',
        name: 'Competitor Trademark Risk',
        description: 'Bidding on competitor terms without proper strategy',
        indicators: [
          'High CPC on competitor terms',
          'Low ad quality (can\'t use their brand in ads)',
          'No comparison landing page',
        ],
        recommendation:
          'Create dedicated comparison pages, use generic ad copy, monitor for legal issues.',
      },
      {
        id: 'enterprise-smb-mismatch',
        name: 'Enterprise/SMB Targeting Mismatch',
        description: 'Mixing enterprise and SMB traffic inefficiently',
        indicators: [
          'Enterprise keywords going to self-serve trial page',
          'SMB keywords going to sales-qualified demo',
          'Inconsistent conversion experiences',
        ],
        recommendation:
          'Segment campaigns by buyer type, match landing pages to buyer journey.',
      },
      {
        id: 'informational-keyword-spend',
        name: 'Informational Keyword Overspend',
        description: 'Spending on "how to" and informational queries',
        indicators: [
          'High impressions on how-to keywords',
          'Very low conversion rate',
          'Better suited for content marketing',
        ],
        recommendation:
          'Move informational keywords to SEO/content strategy, focus paid on bottom-funnel intent.',
      },
    ],
    opportunities: [
      {
        type: 'competitor-comparison-pages',
        description: 'Competitor comparison page opportunity',
        signals: [
          'Competitor keywords driving traffic',
          'No dedicated comparison content',
          'Comparison searches have high intent',
        ],
        typicalAction: 'Create "[Product] vs [Competitor]" pages with honest comparison.',
      },
      {
        type: 'remarketing-trial-conversion',
        description: 'Remarketing to trial users who haven\'t converted',
        signals: [
          'Low trial-to-paid conversion rate',
          'Significant trial volume',
          'Users engaging but not converting',
        ],
        typicalAction: 'Implement remarketing for trial users with upgrade messaging.',
      },
      {
        type: 'integration-partnerships',
        description: 'Integration partner co-marketing opportunity',
        signals: [
          'Integration keywords performing well',
          'Partner has active marketing program',
          'Mutual benefit opportunity',
        ],
        typicalAction: 'Reach out to integration partners for co-marketing campaigns.',
      },
      {
        type: 'linkedin-audience-expansion',
        description: 'LinkedIn audience targeting for B2B',
        signals: [
          'B2B SaaS product',
          'Clear ICP definition',
          'Search volume limited for niche terms',
        ],
        typicalAction: 'Test LinkedIn ads targeting by job title, company size, industry.',
      },
    ],
  },

  prompt: {
    roleContext: `You are an expert SaaS PPC strategist analyzing Google Ads performance for a subscription software business. Your recommendations should focus on reducing customer acquisition cost (CAC) while maintaining or improving trial/demo quality. You understand the SaaS business model where lifetime value justifies higher acquisition costs, and where trial-to-paid conversion rate is as important as trial volume.`,

    analysisInstructions: `Analyze the provided keyword and campaign data with these priorities:

1. CAC OPTIMIZATION: Identify keywords and campaigns with above-target CAC. Determine whether high CAC is due to poor targeting, low conversion rates, or inefficient bidding.

2. TRIAL/DEMO VOLUME: Find opportunities to scale efficient acquisition channels. Look for keywords with good CAC that are budget or bid constrained.

3. COMPETITOR STRATEGY: Evaluate competitor keyword performance and comparison content effectiveness. Competitor targeting can be highly effective but requires proper landing pages.

4. FEATURE & INTEGRATION KEYWORDS: Assess coverage of product features and integrations. These often have high intent and convert well.

5. AUDIENCE SEGMENTATION: Analyze whether enterprise and SMB traffic is being handled appropriately with matching conversion paths.

For each issue identified, quantify the potential impact in terms of trial volume or CAC reduction.`,

    outputGuidance: `Structure recommendations as specific, actionable items:
- Lead with the business impact (additional trials/demos or CAC reduction)
- Specify exact keywords, campaigns, or settings to change
- Provide CAC targets or benchmarks for success
- Consider trial quality, not just volume

Prioritize recommendations by potential CAC reduction or conversion volume increase. A SaaS marketing manager should be able to implement these changes immediately.`,

    examples: [
      {
        scenario: 'High CAC on generic category keyword',
        data: 'Keyword "project management software" - $3,200/month spend, $280 CAC, 11 trials',
        recommendation:
          'Reduce bids on generic "project management software" by 40% and reallocate to specific feature keywords like "project management with time tracking" which shows $95 CAC. Add negative keywords for "free", "open source", and "download". Estimated savings: $1,000/month while maintaining similar trial volume.',
        reasoning:
          'Generic category terms attract researchers and competitors\' customers who may not be ready to switch. More specific feature keywords indicate clearer buying intent.',
      },
      {
        scenario: 'Competitor keyword without comparison page',
        data: 'Keyword "[competitor] alternative" - $800/month spend, $160 CAC, 5 trials, landing page is generic homepage',
        recommendation:
          'Create dedicated "[Your Product] vs [Competitor]" comparison landing page. Feature comparison should be honest and highlight your strengths. Expected to improve conversion rate by 30-50%, reducing CAC to ~$100-110.',
        reasoning:
          'Users searching for alternatives have clear switching intent but need to understand how you differ. A generic homepage doesn\'t answer their specific questions.',
      },
    ],

    constraints: [
      'Consider trial-to-paid conversion rate when evaluating trial volume',
      'Competitor conquesting may have legal restrictions - flag for review',
      'Integration keywords often have partnership implications - consider co-marketing',
      'Account for sales cycle length - B2B SaaS may take months to close',
      'ROAS may be mentioned but LTV/CAC is the true north metric for SaaS',
      'Enterprise and SMB segments may need different conversion paths',
    ],
  },

  output: {
    recommendationTypes: {
      prioritize: [
        'cac-reduction',
        'trial-volume-growth',
        'competitor-strategy',
        'feature-keyword-expansion',
        'landing-page-optimization',
        'audience-segmentation',
      ],
      deprioritize: [
        'brand-campaign-changes', // Often sensitive
        'complete-restructure', // Too disruptive
      ],
      exclude: [
        'shopping-campaigns', // Not applicable
        'product-feed-optimization', // Not applicable
        'local-targeting', // SaaS is not location-based
      ],
    },
    maxRecommendations: 8,
    requireQuantifiedImpact: true,
  },
};
