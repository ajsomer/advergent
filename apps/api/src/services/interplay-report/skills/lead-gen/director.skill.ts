/**
 * Lead-Gen Director Skill
 *
 * Synthesizes SEM and SEO recommendations into unified, prioritized actions.
 * Resolves conflicts, identifies synergies, and frames for executive presentation.
 *
 * Lead-gen focus: Cost per lead, lead volume, pipeline growth
 */

import type { DirectorSkillDefinition } from '../types.js';

export const leadGenDirectorSkill: DirectorSkillDefinition = {
  version: '1.0.0',

  context: {
    businessPriorities: [
      'Reduce cost per lead (CPL)',
      'Increase lead volume',
      'Improve lead quality',
      'Build trust and credibility',
      'Expand geographic reach',
    ],
    successMetrics: [
      'Total leads (paid + organic)',
      'Blended cost per lead',
      'Organic lead growth',
      'Service page rankings',
      'Lead conversion rate',
    ],
    executiveFraming:
      'Focus on lead volume and cost efficiency. Service business leadership wants to see pipeline growth and marketing efficiency. Frame recommendations in terms of leads generated and cost per acquisition. Include capacity considerations - more leads only matter if sales can handle them.',
  },

  synthesis: {
    conflictResolution: [
      {
        id: 'paid-vs-organic-overlap',
        semSignal: 'Recommend maintaining spend on service keywords',
        seoSignal: 'Strong organic rankings for same service keywords',
        resolution:
          'Test reducing paid spend incrementally on keywords ranking #1-3 organically. Monitor total lead volume during 2-week test period.',
        resultingType: 'hybrid',
      },
      {
        id: 'landing-page-strategy',
        semSignal: 'Recommend dedicated PPC landing page with minimal navigation',
        seoSignal: 'Recommend comprehensive service page for organic ranking',
        resolution:
          'Use service page for organic, create PPC-specific variant only for high-volume campaigns. Ensure both versions capture leads effectively.',
        resultingType: 'hybrid',
      },
      {
        id: 'content-investment',
        semSignal: 'Increase budget on converting campaigns',
        seoSignal: 'Invest in content and trust signals',
        resolution:
          'Balance based on timeline needs. Paid for immediate lead goals, SEO for sustainable acquisition cost reduction. Start 60/40 paid/organic investment.',
        resultingType: 'hybrid',
      },
      {
        id: 'geographic-strategy',
        semSignal: 'Expand paid targeting to new service areas',
        seoSignal: 'Build location pages for new areas',
        resolution:
          'Test new areas with paid first to validate demand, then build organic presence for efficient long-term capture.',
        resultingType: 'hybrid',
      },
    ],
    synergyIdentification: [
      {
        id: 'keyword-content-alignment',
        semCondition: 'High-converting search queries identified in paid',
        seoCondition: 'Service pages need content expansion',
        combinedRecommendation:
          'Use converting PPC search terms to inform service page content. Incorporate high-intent language that drives paid conversions into organic content.',
      },
      {
        id: 'trust-signal-impact',
        semCondition: 'Ads with trust extensions performing well',
        seoCondition: 'Service pages missing trust signals',
        combinedRecommendation:
          'Add the trust elements working in ads (reviews, certifications, years in business) to organic service pages. Consistent messaging improves both channels.',
      },
      {
        id: 'faq-content-leverage',
        semCondition: 'Common questions appearing in search terms',
        seoCondition: 'FAQPage schema opportunity identified',
        combinedRecommendation:
          'Create FAQ content answering questions seen in paid search terms. Implement FAQPage schema. Reduces paid costs for informational queries while capturing organic traffic.',
      },
      {
        id: 'local-presence',
        semCondition: 'Location targeting showing strong ROI',
        seoCondition: 'Local SEO improvements recommended',
        combinedRecommendation:
          'Double down on proven service areas - increase paid presence and strengthen local organic signals (GBP, local content, citations). Combined visibility dominates local searches.',
      },
    ],
    prioritization: [
      {
        condition: 'Recommendation reduces CPL by >$20',
        adjustment: 'boost',
        factor: 2.0,
        reason: 'Direct cost efficiency improvement',
      },
      {
        condition: 'Recommendation increases lead volume by >20%',
        adjustment: 'boost',
        factor: 1.8,
        reason: 'Significant pipeline growth',
      },
      {
        condition: 'Recommendation fixes critical conversion issue (form/phone)',
        adjustment: 'require',
        factor: 1.0,
        reason: 'Conversion blockers directly prevent lead capture',
      },
      {
        condition: 'Recommendation is Quick Win (< 2 hours implementation)',
        adjustment: 'boost',
        factor: 1.4,
        reason: 'Fast implementation means faster results',
      },
      {
        condition: 'Recommendation requires significant development',
        adjustment: 'reduce',
        factor: 0.6,
        reason: 'Development dependency delays implementation',
      },
      {
        condition: 'Recommendation is purely cosmetic',
        adjustment: 'exclude',
        factor: 0,
        reason: 'Focus on lead generation impact',
      },
    ],
  },

  filtering: {
    maxRecommendations: 10,
    minImpactThreshold: 'medium',
    impactWeights: {
      revenue: 0.30, // Represented by lead value
      cost: 0.30, // CPL efficiency
      effort: 0.20,
      risk: 0.20,
    },
    mustInclude: [
      'Any recommendation fixing lead capture blockers (broken forms, missing phones)',
      'Recommendations reducing CPL by >30%',
      'Trust signal improvements for key service pages',
    ],
    mustExclude: [
      // Lead-gen specific exclusions - these should NEVER appear
      'metric:roas',
      'metric:revenue',
      'metric:aov',
      'metric:conversionValue',
      'schema:Product',
      'schema:Offer',
      'schema:AggregateOffer',
      'type:shopping-campaign',
      'type:merchant-center',
      'type:product-feed',
      'type:product-listing-ads',
    ],
  },

  executiveSummary: {
    focusAreas: [
      'Lead volume growth opportunity',
      'Cost per lead optimization',
      'Organic lead generation improvement',
      'Trust and credibility building',
    ],
    metricsToQuantify: [
      'Estimated additional leads per month',
      'Potential CPL reduction',
      'Organic traffic growth projections',
      'Conversion rate improvement targets',
    ],
    framingGuidance:
      'Lead with the lead generation opportunity. Service business executives think in terms of pipeline and cost efficiency. Frame SEO improvements as reducing customer acquisition cost over time. Include sales capacity considerations - ensure recommendations account for ability to handle increased lead volume.',
    maxHighlights: 5,
  },

  prompt: {
    roleContext: `You are a senior digital marketing director synthesizing SEM and SEO recommendations for a lead generation business. Your role is to create a unified strategy that maximizes lead volume while reducing cost per lead. You report to leadership who care about pipeline growth and marketing efficiency - NOT about ROAS or revenue (since leads don't have immediate revenue attribution).`,

    synthesisInstructions: `Review the SEM and SEO agent outputs and create a unified recommendation set:

1. IDENTIFY SYNERGIES: Find where paid and organic can reinforce each other. PPC data informs content strategy. Organic authority reduces paid costs.

2. RESOLVE CONFLICTS: When recommendations conflict (e.g., landing page strategy), determine the best approach based on lead volume and CPL impact.

3. PRIORITIZE BY IMPACT: Rank recommendations by lead generation impact. Quick wins that drive immediate leads should surface first.

4. BALANCE CHANNELS: Ensure recommendations address both paid and organic. Neither channel should be neglected.

5. CONSOLIDATE DUPLICATES: If both agents recommend similar actions, merge into one comprehensive recommendation.

CRITICAL: Never include ROAS, revenue, or shopping campaign recommendations. This is a service business measuring leads, not transactions.`,

    prioritizationGuidance: `Prioritization framework for lead generation:

1. LEAD VOLUME IMPACT (30%): Direct impact on leads generated. More qualified leads = more pipeline.

2. COST EFFICIENCY (30%): Reducing CPL improves marketing ROI. Efficiency gains compound over time.

3. EFFORT REQUIRED (20%): Implementation complexity. Prefer changes the team can make this week.

4. RISK (20%): Likelihood of negative impact. Avoid changes that could reduce current lead flow.

Score each recommendation and present in priority order.`,

    outputFormat: `Structure the output as:

EXECUTIVE SUMMARY:
- 2-3 sentence overview of total lead generation opportunity
- Key highlights (leads, CPL reduction, growth)
- Recommended immediate actions

UNIFIED RECOMMENDATIONS:
Each recommendation should include:
- Clear title describing the action
- Category (SEM, SEO, or Hybrid)
- Impact level (High/Medium/Low)
- Effort level (High/Medium/Low)
- Detailed description with specific actions
- Quantified expected impact (leads or CPL)
- 3-5 specific action items

Order by priority score (impact vs effort).`,

    constraints: [
      'NEVER include ROAS or revenue-based recommendations',
      'NEVER recommend Shopping campaigns or product feeds',
      'Keep recommendations actionable within current toolset',
      'Quantify impact in leads or CPL terms where data supports it',
      'Consider sales team capacity for handling increased lead volume',
      'Do not sacrifice lead quality for short-term volume gains',
    ],
  },

  output: {
    recommendationFormat: {
      requireTitle: true,
      requireDescription: true,
      requireImpact: true,
      requireEffort: true,
      requireActionItems: true,
      maxActionItems: 5,
    },
    categoryLabels: {
      sem: 'Paid Search',
      seo: 'Organic Search',
      hybrid: 'Cross-Channel',
    },
  },
};
