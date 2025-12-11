/**
 * Local Business Director Skill
 *
 * Synthesizes SEM and SEO recommendations into unified, prioritized actions.
 * Resolves conflicts, identifies synergies, and frames for executive presentation.
 *
 * Local focus: Calls, visits, local visibility, review acquisition
 */

import type { DirectorSkillDefinition } from '../types.js';

export const localDirectorSkill: DirectorSkillDefinition = {
  version: '1.0.0',

  context: {
    businessPriorities: [
      'Increase phone calls and store visits',
      'Dominate local search results',
      'Build review profile',
      'Improve local brand awareness',
      'Expand service area presence',
    ],
    successMetrics: [
      'Total calls (paid + organic/GBP)',
      'Store visits and directions',
      'Local pack rankings',
      'Review count and rating',
      'Service area visibility',
    ],
    executiveFraming:
      'Focus on calls, visits, and local visibility. Local business owners want to know if their marketing is driving customers through the door. Frame recommendations in terms of estimated calls, foot traffic, and local market share. Keep technical SEO jargon minimal.',
  },

  synthesis: {
    conflictResolution: [
      {
        id: 'paid-vs-organic-local',
        semSignal: 'Recommend maintaining spend on local keywords',
        seoSignal: 'Strong local pack/GBP presence for same keywords',
        resolution:
          'Local market is often small enough to dominate both. Keep paid for visibility guarantee, but test reducing bids where organic is #1 in local pack.',
        resultingType: 'hybrid',
      },
      {
        id: 'gbp-vs-website-priority',
        semSignal: 'Focus on website landing page optimization',
        seoSignal: 'Focus on Google Business Profile optimization',
        resolution:
          'Both are essential for local. GBP drives local pack; website supports conversion. Prioritize GBP for local pack visibility, website for trust building.',
        resultingType: 'hybrid',
      },
      {
        id: 'single-vs-multiple-locations',
        semSignal: 'Single campaign targeting all service areas',
        seoSignal: 'Individual location pages for each area',
        resolution:
          'For SEO, unique location pages are critical. For PPC, consider ad groups by location for relevant messaging. Both approaches serve different purposes.',
        resultingType: 'hybrid',
      },
      {
        id: 'call-vs-website-conversion',
        semSignal: 'Drive traffic to website',
        seoSignal: 'Optimize for direct calls from GBP',
        resolution:
          'Both paths lead to customers. Track calls from both GBP and website. Consider call-only campaigns for mobile PPC to streamline conversion.',
        resultingType: 'hybrid',
      },
    ],
    synergyIdentification: [
      {
        id: 'review-amplification',
        semCondition: 'Review extensions showing in ads',
        seoCondition: 'Review acquisition recommended',
        combinedRecommendation:
          'Reviews benefit both channels - they improve ad CTR via extensions and boost local pack rankings. Prioritize review acquisition as cross-channel investment.',
      },
      {
        id: 'local-keyword-alignment',
        semCondition: 'Local keywords converting in PPC',
        seoCondition: 'Location pages need content expansion',
        combinedRecommendation:
          'Use converting PPC search terms to inform location page content. The language driving paid conversions should appear in organic content.',
      },
      {
        id: 'call-tracking-unified',
        semCondition: 'Call extensions tracking PPC calls',
        seoCondition: 'GBP call tracking needed',
        combinedRecommendation:
          'Implement unified call tracking across PPC and organic/GBP. Understand total call volume and attribute by channel for better optimization.',
      },
      {
        id: 'mobile-optimization',
        semCondition: 'High mobile traffic on PPC',
        seoCondition: 'Mobile experience improvements needed',
        combinedRecommendation:
          'Mobile dominates local search. Improvements to mobile experience (speed, click-to-call, maps) benefit both paid and organic traffic.',
      },
    ],
    prioritization: [
      {
        condition: 'Recommendation increases calls by >20%',
        adjustment: 'boost',
        factor: 2.0,
        reason: 'Direct impact on primary conversion',
      },
      {
        condition: 'Recommendation improves local pack position',
        adjustment: 'boost',
        factor: 1.8,
        reason: 'Local pack captures majority of local clicks',
      },
      {
        condition: 'Recommendation addresses review acquisition',
        adjustment: 'boost',
        factor: 1.5,
        reason: 'Reviews impact both rankings and conversions',
      },
      {
        condition: 'Recommendation is Quick Win (< 2 hours implementation)',
        adjustment: 'boost',
        factor: 1.4,
        reason: 'Fast implementation means faster results',
      },
      {
        condition: 'Recommendation fixes NAP inconsistency',
        adjustment: 'boost',
        factor: 1.5,
        reason: 'NAP consistency is foundational for local SEO',
      },
      {
        condition: 'Recommendation requires significant development',
        adjustment: 'reduce',
        factor: 0.6,
        reason: 'Local businesses often have limited dev resources',
      },
    ],
  },

  filtering: {
    maxRecommendations: 8,
    minImpactThreshold: 'medium',
    impactWeights: {
      revenue: 0.30, // Represented by calls/visits value
      cost: 0.25, // Efficiency
      effort: 0.25, // Local businesses have limited resources
      risk: 0.20,
    },
    mustInclude: [
      'GBP optimization if not complete',
      'NAP consistency fixes',
      'LocalBusiness schema implementation',
    ],
    mustExclude: [
      // Local-specific exclusions - these should NEVER appear
      'metric:roas', // Can't track offline revenue
      'metric:mrr', // SaaS metric
      'metric:arr', // SaaS metric
      'schema:SoftwareApplication', // Wrong business type
      'type:shopping-campaign', // Not applicable
      'type:merchant-center', // Not applicable
    ],
  },

  executiveSummary: {
    focusAreas: [
      'Phone call and visit growth opportunity',
      'Local pack visibility improvement',
      'Review acquisition strategy',
      'Service area expansion',
    ],
    metricsToQuantify: [
      'Estimated additional calls per month',
      'Potential store visits increase',
      'Local pack ranking improvements',
      'Review count targets',
    ],
    framingGuidance:
      'Lead with calls and visits - that\'s what local business owners care about. Avoid technical jargon. Frame everything in terms of customers through the door. Include competitor context (e.g., "Competitor X has 50 more reviews").',
    maxHighlights: 4,
  },

  prompt: {
    roleContext: `You are a senior digital marketing director synthesizing SEM and SEO recommendations for a local business with physical locations. Your role is to create a unified strategy that maximizes phone calls, store visits, and local visibility. You report to a local business owner who cares about customers through the door - keep recommendations practical and jargon-free.`,

    synthesisInstructions: `Review the SEM and SEO agent outputs and create a unified recommendation set:

1. IDENTIFY SYNERGIES: Reviews benefit both channels. Mobile optimization helps all traffic. Find the cross-channel wins.

2. RESOLVE CONFLICTS: When recommendations conflict (e.g., GBP vs website priority), determine what drives the most calls/visits.

3. PRIORITIZE BY IMPACT: Local pack presence and reviews often have biggest impact. Quick wins that drive immediate results should surface first.

4. BALANCE CHANNELS: GBP, website SEO, and PPC all matter for local. Ensure recommendations cover the essentials of each.

5. KEEP IT SIMPLE: Local business owners don't need technical jargon. Frame everything in terms they understand: calls, visits, customers.

Remember: For local businesses, Google Business Profile is often as important as the website. Don't neglect GBP recommendations.`,

    prioritizationGuidance: `Prioritization framework for local businesses:

1. CALL/VISIT IMPACT (30%): Direct impact on customers through the door. This is what matters most.

2. LOCAL VISIBILITY (25%): Local pack position, map presence. Being found when people search locally.

3. EFFORT REQUIRED (25%): Local businesses often have limited time and resources. Prefer easy wins.

4. RISK (20%): Avoid changes that could hurt current visibility or confuse customers.

Score each recommendation and present in priority order. Use plain language.`,

    outputFormat: `Structure the output as:

EXECUTIVE SUMMARY:
- 2-3 sentence overview of opportunity (in plain language)
- Key highlights (calls, visits, visibility)
- Recommended immediate actions

UNIFIED RECOMMENDATIONS:
Each recommendation should include:
- Clear title describing the action (no jargon)
- Category (Paid Search, Local SEO, or Both)
- Impact level (High/Medium/Low)
- Effort level (High/Medium/Low)
- Detailed description with specific actions
- Expected impact (calls, visits, rankings)
- 3-5 specific action items

Order by priority. Keep language simple and actionable.`,

    constraints: [
      'NEVER include ROAS or revenue metrics - local can\'t track offline sales',
      'NEVER recommend SaaS or ecommerce-specific tactics',
      'Keep recommendations practical for local business resources',
      'GBP optimization is often the highest-impact opportunity',
      'Reviews impact both SEO and conversion - prioritize acquisition',
      'Mobile experience is critical - most local searches are mobile',
    ],
  },

  output: {
    recommendationFormat: {
      requireTitle: true,
      requireDescription: true,
      requireImpact: true,
      requireEffort: true,
      requireActionItems: true,
      maxActionItems: 4,
    },
    categoryLabels: {
      sem: 'Paid Search',
      seo: 'Local SEO',
      hybrid: 'Both Channels',
    },
  },
};
