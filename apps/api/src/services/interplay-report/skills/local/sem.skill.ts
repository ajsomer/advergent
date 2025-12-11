/**
 * Local Business SEM Skill
 *
 * AI-powered analysis of paid search performance for local businesses.
 * Focuses on calls, store visits, directions, and local market presence.
 */

import type { SEMSkillDefinition } from '../types.js';

export const localSEMSkill: SEMSkillDefinition = {
  version: '1.0.0',

  context: {
    businessModel:
      'Local service business with physical location(s). Revenue is generated through in-person visits, service calls, and local appointments. Success is measured by foot traffic, phone calls, and bookings.',
    conversionDefinition:
      'Primary conversions: Phone call, direction request, or booking. Many conversions happen offline after initial contact. Attribution is challenging but calls and store visits are key indicators.',
    typicalCustomerJourney:
      'Local search ("near me", "[service] [city]") → Review local pack results → Check reviews and ratings → Call or visit → In-person transaction',
  },

  kpis: {
    primary: [
      {
        metric: 'calls',
        importance: 'critical',
        description: 'Phone calls from ads',
        targetDirection: 'higher',
        businessContext:
          'Phone calls are often the primary conversion for local businesses. Track call duration for quality indicators.',
      },
      {
        metric: 'storeVisits',
        importance: 'critical',
        description: 'In-store visits attributed to ads',
        targetDirection: 'higher',
        businessContext:
          'Store visit conversions (if available) measure actual foot traffic. Requires location extensions and sufficient data.',
      },
      {
        metric: 'conversions',
        importance: 'critical',
        description: 'All conversions (calls, directions, form submissions)',
        targetDirection: 'higher',
        businessContext:
          'Combined conversion metric. Weight by value if possible (calls often more valuable than direction requests).',
      },
    ],
    secondary: [
      {
        metric: 'directions',
        importance: 'high',
        description: 'Get directions clicks from ads',
        targetDirection: 'higher',
        businessContext:
          'Direction requests indicate intent to visit. Track alongside store visits if available.',
      },
      {
        metric: 'ctr',
        importance: 'medium',
        description: 'Click-through rate',
        targetDirection: 'higher',
        benchmark: 0.04,
        businessContext:
          'Local ads should have higher CTR due to high intent. Low CTR suggests targeting or ad copy issues.',
      },
      {
        metric: 'impressionShare',
        importance: 'medium',
        description: 'Share of available impressions',
        targetDirection: 'higher',
        businessContext:
          'Local market presence. Important to capture available demand in your service area.',
      },
    ],
    irrelevant: [
      'roas', // Often can't track offline revenue
      'revenue', // Transactions happen offline
      'aov', // No online transactions
      'mrr', // SaaS metric
      'arr', // SaaS metric
      'trialSignups', // Not applicable
    ],
  },

  benchmarks: {
    ctr: {
      excellent: 0.06,
      good: 0.04,
      average: 0.025,
      poor: 0.015,
    },
    conversionRate: {
      excellent: 0.10,
      good: 0.06,
      average: 0.04,
      poor: 0.02,
    },
    cpc: {
      excellent: 1.5,
      good: 3.0,
      average: 5.0,
      poor: 10.0,
    },
    costPerConversion: {
      excellent: 15,
      good: 30,
      average: 50,
      poor: 100,
    },
  },

  analysis: {
    keyPatterns: [
      {
        id: 'call-extension-success',
        name: 'Call Extension Performance',
        description: 'Call extensions driving significant conversion volume',
        indicators: [
          'High call conversion rate',
          'Calls during business hours',
          'Call duration indicating quality',
        ],
        recommendation:
          'Maximize call extension visibility. Consider call-only campaigns for mobile. Ensure call tracking is properly configured.',
      },
      {
        id: 'location-extension-impact',
        name: 'Location Extension Impact',
        description: 'Location extensions driving directions and visits',
        indicators: [
          'Strong direction clicks',
          'Store visit conversions (if tracked)',
          'Local searches triggering ads',
        ],
        recommendation:
          'Ensure location extensions are enabled and GBP is linked. Consider location assets for multi-location businesses.',
      },
      {
        id: 'service-area-strength',
        name: 'Service Area Performance',
        description: 'Strong performance in specific geographic areas',
        indicators: [
          'Lower cost per conversion in certain areas',
          'Higher conversion rate by location',
          'Consistent call volume from regions',
        ],
        recommendation:
          'Increase bids in high-performing service areas. Refine targeting to match actual service territory.',
      },
      {
        id: 'near-me-success',
        name: 'Near Me Keyword Success',
        description: '"Near me" keywords driving conversions',
        indicators: [
          'High conversion rate on near me queries',
          'Mobile traffic dominance',
          'Strong local intent signals',
        ],
        recommendation:
          'Expand "near me" keyword coverage. Ensure mobile experience is optimized.',
      },
    ],
    antiPatterns: [
      {
        id: 'geographic-waste',
        name: 'Geographic Targeting Waste',
        description: 'Spending outside actual service area',
        indicators: [
          'Conversions from areas not served',
          'High spend in distant locations',
          'Location targeting too broad',
        ],
        recommendation:
          'Tighten location targeting to actual service radius. Use location exclusions for areas you don\'t serve.',
      },
      {
        id: 'after-hours-spend',
        name: 'After-Hours Spend Inefficiency',
        description: 'Spending when business is closed',
        indicators: [
          'Ad spend during closed hours',
          'Lower call answer rate off-hours',
          'Wasted budget when no one can respond',
        ],
        recommendation:
          'Implement ad scheduling to align with business hours. Reduce bids during off-hours or pause entirely.',
      },
      {
        id: 'missing-call-extensions',
        name: 'Missing Call Extensions',
        description: 'Mobile ads without call extensions',
        indicators: [
          'High mobile impressions',
          'No call extension clicks',
          'Users can\'t easily call',
        ],
        recommendation:
          'Add call extensions to all campaigns. Consider call-only ads for mobile.',
      },
      {
        id: 'non-local-keywords',
        name: 'Non-Local Keyword Spend',
        description: 'Spending on generic keywords without local intent',
        indicators: [
          'Generic keywords without location modifiers',
          'Low conversion rate vs local keywords',
          'High CPC for competitive terms',
        ],
        recommendation:
          'Focus on location-modified keywords. Generic terms attract non-local searches.',
      },
    ],
    opportunities: [
      {
        type: 'call-only-campaigns',
        description: 'Call-only campaign opportunity',
        signals: [
          'High mobile traffic percentage',
          'Phone calls are primary conversion',
          'Strong call extension performance',
        ],
        typicalAction: 'Launch call-only campaigns for high-intent local keywords',
      },
      {
        type: 'local-services-ads',
        description: 'Local Services Ads opportunity',
        signals: [
          'Service business (plumber, lawyer, etc.)',
          'Google-verified business',
          'Strong review profile',
        ],
        typicalAction: 'Enroll in Google Local Services Ads for guaranteed lead pricing',
      },
      {
        type: 'competitor-location-targeting',
        description: 'Competitor location targeting',
        signals: [
          'Known competitor locations',
          'Users searching near competitors',
          'Conquest opportunity',
        ],
        typicalAction: 'Target radius around competitor locations with compelling offers',
      },
      {
        type: 'review-extension',
        description: 'Review extension opportunity',
        signals: [
          'Strong Google reviews',
          'Review count above threshold',
          'Positive rating (4.0+)',
        ],
        typicalAction: 'Enable review extensions to show rating in ads',
      },
    ],
  },

  prompt: {
    roleContext: `You are an expert local business PPC strategist analyzing Google Ads performance for a business with physical locations. Your recommendations should focus on driving phone calls, store visits, and local conversions. You understand that local businesses often cannot track offline revenue directly, so success is measured by calls, directions, and foot traffic.`,

    analysisInstructions: `Analyze the provided keyword and campaign data with these priorities:

1. CALL OPTIMIZATION: Phone calls are often the primary conversion. Ensure call extensions are enabled, call tracking is working, and call-only campaigns are considered for mobile.

2. LOCATION TARGETING: Verify geographic targeting matches actual service area. No point paying for clicks from areas you don't serve.

3. LOCAL KEYWORD COVERAGE: Assess coverage of "[service] [city]" and "near me" queries. These high-intent local searches should be priorities.

4. AD SCHEDULING: Evaluate performance by time of day. Consider business hours - ads running when closed may waste budget.

5. LOCAL PACK PRESENCE: Consider how paid search complements organic local presence. Sometimes Local Services Ads may be more efficient.

For each issue identified, quantify the potential impact in terms of calls, visits, or cost savings.`,

    outputGuidance: `Structure recommendations as specific, actionable items:
- Lead with the business impact (additional calls/visits or cost savings)
- Specify exact keywords, campaigns, or settings to change
- Provide targets for success
- Consider the offline nature of local conversions

A local business owner should be able to understand and act on these recommendations. Keep technical jargon minimal.`,

    examples: [
      {
        scenario: 'Geographic targeting too broad',
        data: 'Campaign targeting 50-mile radius, but business only serves 15-mile area. 40% of clicks from outside service area. $800/month on out-of-area traffic.',
        recommendation:
          'Reduce location targeting to 15-mile service radius. Add location exclusions for surrounding areas you don\'t serve. Estimated monthly savings: $800. This alone could reduce cost per call significantly.',
        reasoning:
          'Paying for clicks from areas you don\'t serve is pure waste. Even if someone calls, you\'ll have to turn them away, wasting both your time and theirs.',
      },
      {
        scenario: 'Call extensions missing on mobile campaigns',
        data: 'Mobile impressions: 5,000/month, Call extension clicks: 0. Mobile conversion rate 50% lower than desktop.',
        recommendation:
          'Add call extensions to all campaigns immediately. For high-intent local keywords, test call-only ads that only appear on mobile and require a call to engage. Expected impact: 20-30 additional calls per month based on industry benchmarks.',
        reasoning:
          'Mobile users searching for local services often prefer to call directly. Without call extensions, you\'re forcing them to click through and find your number - many won\'t bother.',
      },
    ],

    constraints: [
      'ROAS tracking is limited for offline conversions - focus on calls/visits',
      'Consider store visit conversions if available in the account',
      'Geographic targeting must match actual service area',
      'Call tracking is essential for attribution - recommend if not in place',
      'Reviews significantly impact local ad performance - consider in recommendations',
      'Business hours affect ad effectiveness - account for scheduling',
    ],
  },

  output: {
    recommendationTypes: {
      prioritize: [
        'call-optimization',
        'location-targeting',
        'ad-scheduling',
        'local-keyword-expansion',
        'location-extensions',
        'local-services-ads',
      ],
      deprioritize: [
        'brand-campaign-changes', // Often sensitive
        'complete-restructure', // Too disruptive for local
      ],
      exclude: [
        'shopping-campaigns', // Not applicable
        'product-feed-optimization', // Not applicable
        'roas-targeting', // Can't track offline revenue
        'saas-metrics', // Wrong business type
      ],
    },
    maxRecommendations: 6,
    requireQuantifiedImpact: true,
  },
};
