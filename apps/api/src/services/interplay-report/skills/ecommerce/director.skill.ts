/**
 * Ecommerce Director Skill
 *
 * Synthesizes SEM and SEO recommendations into unified, prioritized actions.
 * Resolves conflicts, identifies synergies, and frames for executive presentation.
 */

import type { DirectorSkillDefinition } from '../types.js';

export const ecommerceDirectorSkill: DirectorSkillDefinition = {
  version: '1.0.0',

  context: {
    businessPriorities: [
      'Maximize return on ad spend (ROAS)',
      'Grow profitable revenue',
      'Reduce wasted ad spend',
      'Improve organic visibility for product pages',
      'Increase market share in key categories',
    ],
    successMetrics: [
      'Total revenue (paid + organic)',
      'Blended ROAS',
      'Organic traffic growth',
      'Product page rankings',
      'Cost savings from optimization',
    ],
    executiveFraming:
      'Focus on revenue impact and ROI. Ecommerce leadership wants to see dollar amounts - potential revenue gains, cost savings, and efficiency improvements. Balance quick wins with strategic initiatives.',
  },

  synthesis: {
    conflictResolution: [
      {
        id: 'paid-vs-organic-cannibalization',
        semSignal: 'Recommend maintaining spend on branded/product keywords',
        seoSignal: 'Strong organic rankings for same keywords',
        resolution:
          'Test reducing paid spend incrementally while monitoring total traffic. Recommend 20% paid reduction test on keywords ranking #1-3 organically.',
        resultingType: 'hybrid',
      },
      {
        id: 'landing-page-conflict',
        semSignal: 'Recommend dedicated PPC landing page',
        seoSignal: 'Recommend optimizing existing product/category page',
        resolution:
          'Use existing page for organic, create targeted PPC variant only if conversion rate justifies development cost.',
        resultingType: 'hybrid',
      },
      {
        id: 'budget-allocation-conflict',
        semSignal: 'Increase budget on performing campaigns',
        seoSignal: 'Invest in content and technical SEO',
        resolution:
          'Prioritize paid for immediate revenue needs, SEO for sustainable growth. Recommend 70/30 split for short-term, shifting to 50/50 over 6 months.',
        resultingType: 'hybrid',
      },
      {
        id: 'keyword-targeting-overlap',
        semSignal: 'Target broad product category keywords',
        seoSignal: 'Focus on long-tail product-specific keywords',
        resolution:
          'Use paid for competitive head terms where organic struggles, SEO for long-tail where content can win. Map keywords to appropriate channel.',
        resultingType: 'hybrid',
      },
    ],
    synergyIdentification: [
      {
        id: 'search-data-sharing',
        semCondition: 'High-converting search queries identified',
        seoCondition: 'Content gaps in product descriptions',
        combinedRecommendation:
          'Use converting PPC search terms to inform product page content optimization. Incorporate high-intent language into descriptions and titles.',
      },
      {
        id: 'landing-page-testing',
        semCondition: 'PPC landing page variants tested',
        seoCondition: 'Product pages need conversion optimization',
        combinedRecommendation:
          'Apply winning PPC landing page elements (headlines, CTAs, layout) to organic product pages.',
      },
      {
        id: 'schema-rich-results',
        semCondition: 'Product ads showing price and reviews',
        seoCondition: 'Product schema implementation needed',
        combinedRecommendation:
          'Implement Product schema to get organic rich results matching paid ad format. Creates consistent SERP presence.',
      },
      {
        id: 'category-authority',
        semCondition: 'Shopping campaigns performing well in category',
        seoCondition: 'Category page rankings improving',
        combinedRecommendation:
          'Double down on category - paid captures immediate demand while SEO builds long-term authority. Cross-link content to reinforce topical relevance.',
      },
    ],
    prioritization: [
      {
        condition: 'Recommendation has quantified revenue impact > $5,000/month',
        adjustment: 'boost',
        factor: 2.0,
        reason: 'High revenue impact prioritized for ecommerce',
      },
      {
        condition: 'Recommendation fixes critical technical SEO issue',
        adjustment: 'boost',
        factor: 1.5,
        reason: 'Technical foundations enable other optimizations',
      },
      {
        condition: 'Recommendation requires development resources',
        adjustment: 'reduce',
        factor: 0.7,
        reason: 'Development dependency may delay implementation',
      },
      {
        condition: 'Recommendation is Quick Win (< 2 hours implementation)',
        adjustment: 'boost',
        factor: 1.3,
        reason: 'Fast implementation means faster results',
      },
      {
        condition: 'Recommendation affects checkout flow',
        adjustment: 'require',
        factor: 1.0,
        reason: 'Checkout issues directly impact revenue - cannot ignore',
      },
      {
        condition: 'Recommendation is purely cosmetic',
        adjustment: 'exclude',
        factor: 0,
        reason: 'Focus on performance-impacting changes',
      },
    ],
  },

  filtering: {
    maxRecommendations: 10,
    minImpactThreshold: 'medium',
    impactWeights: {
      revenue: 0.35,
      cost: 0.25,
      effort: 0.20,
      risk: 0.20,
    },
    mustInclude: [
      'Any recommendation with >$10K monthly revenue impact',
      'Critical technical issues affecting indexing',
      'Schema implementation for product pages',
    ],
    mustExclude: [
      // Ecommerce-specific exclusions
      'schema:ProfessionalService', // Service schema not for products
      'schema:LocalBusiness', // Unless they have physical stores
      'type:lead-form', // Not a lead-gen business
    ],
  },

  executiveSummary: {
    focusAreas: [
      'Revenue opportunity from paid search optimization',
      'Cost savings from efficiency improvements',
      'Organic traffic growth potential',
      'Competitive positioning in key categories',
    ],
    metricsToQuantify: [
      'Estimated monthly revenue impact',
      'Potential cost savings',
      'Traffic increase projections',
      'ROAS improvement targets',
    ],
    framingGuidance:
      'Lead with the total revenue opportunity. Ecommerce executives think in terms of sales and margins. Frame SEO improvements as "free traffic" that reduces customer acquisition cost. Include timeline expectations - paid optimizations show results in days, SEO in weeks/months.',
    maxHighlights: 5,
  },

  prompt: {
    roleContext: `You are a senior digital marketing director synthesizing SEM and SEO recommendations for an ecommerce business. Your role is to create a unified strategy that maximizes revenue while efficiently allocating resources between paid and organic channels. You report to ecommerce leadership who care about sales, margins, and growth.`,

    synthesisInstructions: `Review the SEM and SEO agent outputs and create a unified recommendation set:

1. IDENTIFY SYNERGIES: Find where paid and organic can reinforce each other. PPC data informs SEO content. Organic authority reduces paid costs.

2. RESOLVE CONFLICTS: When recommendations conflict (e.g., both want budget), determine the best allocation based on ROI timeline and business goals.

3. PRIORITIZE BY IMPACT: Rank recommendations by revenue impact. Quick wins that drive immediate sales should surface first.

4. BALANCE CHANNELS: Ensure recommendations don't over-index on one channel. Both paid and organic need attention.

5. CONSOLIDATE DUPLICATES: If both agents recommend similar actions, merge into one comprehensive recommendation.`,

    prioritizationGuidance: `Prioritization framework for ecommerce:

1. REVENUE IMPACT (35%): Direct impact on sales. A 10% ROAS improvement on $50K spend = $5K value.

2. COST SAVINGS (25%): Reducing wasted spend or improving efficiency. Pausing non-converting keywords saves real dollars.

3. EFFORT REQUIRED (20%): Implementation complexity. Prefer changes the team can make this week over projects requiring dev sprints.

4. RISK (20%): Likelihood of negative impact. Avoid recommendations that could hurt conversion rates or rankings.

Score each recommendation and present in priority order.`,

    outputFormat: `Structure the output as:

EXECUTIVE SUMMARY:
- 2-3 sentence overview of total opportunity
- Key highlights (revenue, savings, growth)
- Recommended immediate actions

UNIFIED RECOMMENDATIONS:
Each recommendation should include:
- Clear title describing the action
- Category (SEM, SEO, or Hybrid)
- Impact level (High/Medium/Low)
- Effort level (High/Medium/Low)
- Detailed description with specific actions
- Quantified expected impact
- 3-5 specific action items

Order by priority score (impact vs effort).`,

    constraints: [
      'Do not recommend major platform migrations or CMS changes',
      'Keep recommendations actionable within current toolset',
      'Quantify impact in revenue/cost terms where data supports it',
      'Consider seasonality - Q4 recommendations differ from Q1',
      'Do not sacrifice user experience for short-term gains',
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
