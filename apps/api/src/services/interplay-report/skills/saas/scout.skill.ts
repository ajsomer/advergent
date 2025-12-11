/**
 * SaaS Scout Skill
 *
 * The Scout performs data triage (no AI) to identify battleground keywords
 * and critical pages that warrant deeper analysis.
 *
 * SaaS focus: Trial signups, demo requests, customer acquisition cost (CAC)
 */

import type { ScoutSkillDefinition } from '../types.js';

export const saasScoutSkill: ScoutSkillDefinition = {
  version: '1.0.0',

  thresholds: {
    // SaaS can justify higher acquisition costs due to subscription LTV
    highSpendThreshold: 500, // Monthly spend in dollars
    lowRoasThreshold: 0, // NOT primary metric for SaaS - use CAC instead
    cannibalizationPosition: 5, // Organic position where paid may be redundant
    highBounceRateThreshold: 60, // SaaS pages should engage - lower tolerance
    lowCtrThreshold: 2.5, // Higher expectation for targeted SaaS keywords
    minImpressionsForAnalysis: 75, // SaaS keywords often have lower volume
  },

  priorityRules: {
    battlegroundKeywords: [
      {
        id: 'high-cac-keywords',
        name: 'High CAC Keywords',
        description: 'Keywords where customer acquisition cost exceeds target',
        condition: 'cac > targetCac AND conversions > 2',
        priority: 'critical',
        enabled: true,
      },
      {
        id: 'high-spend-low-trials',
        name: 'High Spend, Low Trials',
        description: 'Keywords with significant spend but few trial signups',
        condition: 'spend > highSpendThreshold AND conversions < 3',
        priority: 'critical',
        enabled: true,
      },
      {
        id: 'cannibalization-risk',
        name: 'Paid/Organic Cannibalization',
        description: 'Paying for clicks on keywords where organic ranks well',
        condition: 'organicPosition <= cannibalizationPosition AND spend > 150',
        priority: 'high',
        enabled: true,
      },
      {
        id: 'competitor-comparison',
        name: 'Competitor Comparison Keywords',
        description: 'Keywords targeting competitor alternatives',
        condition: 'isCompetitorTerm AND spend > 100',
        priority: 'high',
        enabled: true,
      },
      {
        id: 'feature-keyword-gaps',
        name: 'Feature Keyword Gaps',
        description: 'Product feature keywords not being targeted effectively',
        condition: 'isFeatureQuery AND (spend < 50 OR impressionShare < 30)',
        priority: 'high',
        enabled: true,
      },
      {
        id: 'integration-keywords',
        name: 'Integration Keywords',
        description: '[Tool] integration keywords with potential',
        condition: 'isIntegrationQuery AND impressions > 200',
        priority: 'medium',
        enabled: true,
      },
      {
        id: 'high-intent-opportunity',
        name: 'High Intent Opportunity',
        description: 'Converting keywords with room to scale',
        condition: 'conversions > 5 AND impressionShare < 40',
        priority: 'medium',
        enabled: true,
      },
    ],
    criticalPages: [
      {
        id: 'high-spend-feature-page',
        name: 'High Spend Feature Page',
        description: 'Feature pages receiving significant paid traffic',
        condition: 'isFeaturePage AND paidSpend > 300',
        priority: 'critical',
        enabled: true,
      },
      {
        id: 'poor-converting-pricing',
        name: 'Poor Converting Pricing Page',
        description: 'Pricing page with high traffic but low trial signups',
        condition: 'isPricingPage AND sessions > 200 AND conversionRate < 3',
        priority: 'critical',
        enabled: true,
      },
      {
        id: 'high-bounce-landing',
        name: 'High Bounce Landing Page',
        description: 'Landing pages with excessive bounce rates',
        condition: 'bounceRate > highBounceRateThreshold AND sessions > 100',
        priority: 'high',
        enabled: true,
      },
      {
        id: 'integration-page-opportunity',
        name: 'Integration Page Opportunity',
        description: 'Integration pages that could capture more traffic',
        condition: 'isIntegrationPage AND impressions > 500 AND ctr < lowCtrThreshold',
        priority: 'medium',
        enabled: true,
      },
      {
        id: 'comparison-page-gap',
        name: 'Comparison Page Gap',
        description: 'Missing comparison pages for key competitors',
        condition: 'isComparisonPage AND (position > 10 OR missingPage)',
        priority: 'medium',
        enabled: true,
      },
    ],
  },

  metrics: {
    // SaaS focuses on trial/demo conversions and acquisition efficiency
    include: [
      'spend',
      'conversions',
      'cac',
      'ctr',
      'cpc',
      'impressions',
      'impressionShare',
      'position',
      'bounceRate',
      'conversionRate',
      'trialSignups',
      'demoRequests',
    ],
    // Exclude metrics that don't apply to SaaS model
    exclude: [
      'aov', // No average order value - subscriptions
      'transactionValue', // Subscription value not tracked in ads
    ],
    primary: ['conversions', 'cac', 'conversionRate'], // Sort/prioritize by these
  },

  limits: {
    maxBattlegroundKeywords: 25,
    maxCriticalPages: 15,
  },
};
