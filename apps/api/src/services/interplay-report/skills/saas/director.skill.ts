/**
 * SaaS Director Skill
 *
 * Synthesizes SEM and SEO recommendations into unified, prioritized actions.
 * Resolves conflicts, identifies synergies, and frames for executive presentation.
 *
 * SaaS focus: Customer acquisition cost, trial volume, pipeline efficiency
 */

import type { DirectorSkillDefinition } from '../types.js';

export const saasDirectorSkill: DirectorSkillDefinition = {
  version: '1.0.0',

  context: {
    businessPriorities: [
      'Reduce customer acquisition cost (CAC)',
      'Increase trial and demo volume',
      'Improve trial-to-paid conversion',
      'Build competitive positioning',
      'Scale efficient acquisition channels',
    ],
    successMetrics: [
      'Total signups (paid + organic)',
      'Blended CAC',
      'Organic trial growth',
      'Feature page rankings',
      'Comparison page visibility',
    ],
    executiveFraming:
      'Focus on pipeline efficiency and customer acquisition cost. SaaS leadership thinks in terms of MRR/ARR growth, CAC payback period, and trial conversion rates. Frame recommendations in terms of qualified pipeline generated, not just traffic or clicks.',
  },

  synthesis: {
    conflictResolution: [
      {
        id: 'paid-vs-organic-brand',
        semSignal: 'Recommend maintaining spend on brand and product keywords',
        seoSignal: 'Strong organic rankings for same keywords',
        resolution:
          'Test reducing paid spend on branded terms where organic ranks #1. Keep paid for competitor brand targeting. Monitor total signup volume during 2-week test.',
        resultingType: 'hybrid',
      },
      {
        id: 'landing-page-strategy',
        semSignal: 'Recommend dedicated PPC landing page with single CTA',
        seoSignal: 'Recommend comprehensive feature page for organic ranking',
        resolution:
          'Use feature pages for organic, create PPC variants for high-volume campaigns. Ensure both paths lead to trial/demo effectively.',
        resultingType: 'hybrid',
      },
      {
        id: 'comparison-content-investment',
        semSignal: 'Bid on competitor keywords',
        seoSignal: 'Create comparison pages for organic',
        resolution:
          'Do both - comparison pages support both channels. Organic comparison pages improve paid Quality Score on competitor keywords.',
        resultingType: 'hybrid',
      },
      {
        id: 'documentation-investment',
        semSignal: 'Focus on bottom-funnel conversion keywords',
        seoSignal: 'Invest in documentation for long-tail SEO',
        resolution:
          'Both are valid - documentation builds authority and captures support queries, while paid focuses on conversion. Allocate based on current pipeline needs.',
        resultingType: 'hybrid',
      },
    ],
    synergyIdentification: [
      {
        id: 'comparison-page-quality-score',
        semCondition: 'Bidding on competitor keywords',
        seoCondition: 'Creating competitor comparison pages',
        combinedRecommendation:
          'Comparison pages benefit both channels - they improve Quality Score for competitor keyword bidding and capture organic comparison traffic. Prioritize top 5 competitors.',
      },
      {
        id: 'feature-keyword-alignment',
        semCondition: 'Feature keywords converting well in paid',
        seoCondition: 'Feature pages need content expansion',
        combinedRecommendation:
          'Use converting paid search terms to inform feature page content. The language that drives paid conversions should be incorporated into organic content.',
      },
      {
        id: 'integration-content',
        semCondition: 'Integration keywords showing good performance',
        seoCondition: 'Integration pages identified for SEO expansion',
        combinedRecommendation:
          'Integration content benefits both channels and enables partner co-marketing. Create comprehensive integration pages that support paid campaigns and rank organically.',
      },
      {
        id: 'review-site-presence',
        semCondition: 'Review sites (G2, Capterra) driving traffic',
        seoCondition: 'Organization schema and review markup needed',
        combinedRecommendation:
          'Strengthen review platform presence. Reviews improve ad extensions, provide schema markup content, and build credibility for both channels.',
      },
    ],
    prioritization: [
      {
        condition: 'Recommendation reduces CAC by >$30',
        adjustment: 'boost',
        factor: 2.0,
        reason: 'Direct acquisition efficiency improvement',
      },
      {
        condition: 'Recommendation increases trial volume by >25%',
        adjustment: 'boost',
        factor: 1.8,
        reason: 'Significant pipeline growth',
      },
      {
        condition: 'Recommendation creates comparison content for top competitor',
        adjustment: 'boost',
        factor: 1.5,
        reason: 'High-intent content with dual-channel benefits',
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
        reason: 'Focus on conversion and acquisition impact',
      },
    ],
  },

  filtering: {
    maxRecommendations: 10,
    minImpactThreshold: 'medium',
    impactWeights: {
      revenue: 0.30, // Represented by trial/signup value
      cost: 0.30, // CAC efficiency
      effort: 0.20,
      risk: 0.20,
    },
    mustInclude: [
      'Any recommendation reducing CAC by >40%',
      'Comparison page creation for top 3 competitors',
      'Schema implementation for core product pages',
    ],
    mustExclude: [
      // SaaS-specific exclusions - these should NEVER appear
      'metric:aov',
      'schema:Product',
      'schema:Offer', // standalone, not nested in SoftwareApplication
      'schema:LocalBusiness',
      'type:shopping-campaign',
      'type:merchant-center',
      'type:product-feed',
      'type:local-targeting',
    ],
  },

  executiveSummary: {
    focusAreas: [
      'Trial/demo volume growth opportunity',
      'Customer acquisition cost optimization',
      'Competitive positioning improvement',
      'Organic pipeline development',
    ],
    metricsToQuantify: [
      'Estimated additional trials/demos per month',
      'Potential CAC reduction',
      'Organic traffic growth projections',
      'Conversion rate improvement targets',
    ],
    framingGuidance:
      'Lead with the pipeline opportunity. SaaS executives think in terms of MRR growth and CAC efficiency. Frame SEO improvements as building sustainable acquisition channels that reduce CAC over time. Include trial-to-paid conversion considerations - more trials only matter if they convert.',
    maxHighlights: 5,
  },

  prompt: {
    roleContext: `You are a senior digital marketing director synthesizing SEM and SEO recommendations for a SaaS business. Your role is to create a unified strategy that maximizes trial/demo volume while optimizing customer acquisition cost. You report to leadership who care about pipeline growth and acquisition efficiency - they think in terms of MRR, CAC payback, and LTV:CAC ratios.`,

    synthesisInstructions: `Review the SEM and SEO agent outputs and create a unified recommendation set:

1. IDENTIFY SYNERGIES: Find where paid and organic reinforce each other. Comparison pages help both channels. Feature content supports Quality Score.

2. RESOLVE CONFLICTS: When recommendations conflict (e.g., resource allocation), determine the best approach based on CAC impact and pipeline needs.

3. PRIORITIZE BY IMPACT: Rank recommendations by trial/demo generation and CAC impact. Comparison content often has highest ROI.

4. BALANCE CHANNELS: Ensure recommendations address both paid and organic. Neither channel should be neglected.

5. CONSOLIDATE DUPLICATES: If both agents recommend similar actions (e.g., comparison pages), merge into one comprehensive recommendation.

Remember: Quality matters as much as quantity. Trial-to-paid conversion rate is the ultimate measure of acquisition quality.`,

    prioritizationGuidance: `Prioritization framework for SaaS:

1. PIPELINE IMPACT (30%): Direct impact on qualified trials and demos. More qualified signups = more MRR potential.

2. CAC EFFICIENCY (30%): Reducing acquisition cost improves unit economics. Efficiency gains compound over time.

3. EFFORT REQUIRED (20%): Implementation complexity. Prefer changes that can ship this sprint.

4. RISK (20%): Likelihood of negative impact. Avoid changes that could reduce current signup volume.

Score each recommendation and present in priority order.`,

    outputFormat: `Structure the output as:

EXECUTIVE SUMMARY:
- 2-3 sentence overview of total pipeline opportunity
- Key highlights (trials, CAC reduction, growth)
- Recommended immediate actions

UNIFIED RECOMMENDATIONS:
Each recommendation should include:
- Clear title describing the action
- Category (SEM, SEO, or Hybrid)
- Impact level (High/Medium/Low)
- Effort level (High/Medium/Low)
- Detailed description with specific actions
- Quantified expected impact (trials or CAC)
- 3-5 specific action items

Order by priority score (impact vs effort).`,

    constraints: [
      'NEVER recommend Product schema - use SoftwareApplication for SaaS',
      'NEVER recommend local SEO or Shopping campaigns',
      'Keep recommendations actionable within current toolset',
      'Quantify impact in trials/demos or CAC terms where data supports it',
      'Consider trial-to-paid conversion rate, not just trial volume',
      'Do not sacrifice signup quality for short-term volume gains',
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
