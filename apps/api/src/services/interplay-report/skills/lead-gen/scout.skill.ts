/**
 * Lead-Gen Scout Skill
 *
 * The Scout performs data triage (no AI) to identify battleground keywords
 * and critical pages that warrant deeper analysis.
 *
 * Lead-gen focus: Cost per lead optimization, form submissions, phone calls
 */

import type { ScoutSkillDefinition } from '../types.js';

export const leadGenScoutSkill: ScoutSkillDefinition = {
  version: '1.0.0',

  thresholds: {
    // Lead-gen typically has lower spend thresholds than ecommerce
    highSpendThreshold: 300, // Monthly spend in dollars
    lowRoasThreshold: 0, // NOT APPLICABLE for lead-gen - use CPL instead
    cannibalizationPosition: 5, // Organic position where paid may be redundant
    highBounceRateThreshold: 70, // Service pages should engage users
    lowCtrThreshold: 2.0, // CTR below this signals ad copy or relevance issues
    minImpressionsForAnalysis: 50, // Lower threshold - lead-gen often has less volume
  },

  priorityRules: {
    battlegroundKeywords: [
      {
        id: 'high-spend-low-conversions',
        name: 'High Spend, Low Leads',
        description: 'Keywords with significant spend but few lead conversions',
        condition: 'spend > highSpendThreshold AND conversions < 3',
        priority: 'critical',
        enabled: true,
      },
      {
        id: 'high-cpl-keywords',
        name: 'High Cost Per Lead',
        description: 'Keywords where leads cost more than target CPL',
        condition: 'cpl > targetCpl AND conversions > 2',
        priority: 'critical',
        enabled: true,
      },
      {
        id: 'cannibalization-risk',
        name: 'Paid/Organic Cannibalization',
        description: 'Paying for clicks on keywords where organic ranks well',
        condition: 'organicPosition <= cannibalizationPosition AND spend > 100',
        priority: 'high',
        enabled: true,
      },
      {
        id: 'brand-efficiency',
        name: 'Brand Term Efficiency',
        description: 'Brand keywords with high spend that could rely on organic',
        condition: 'isBrandTerm AND spend > 150 AND organicPosition <= 3',
        priority: 'high',
        enabled: true,
      },
      {
        id: 'competitor-keywords',
        name: 'Competitor Keywords',
        description: 'Targeting competitor brand names - review for effectiveness',
        condition: 'isCompetitorTerm AND spend > 100',
        priority: 'high',
        enabled: true,
      },
      {
        id: 'service-area-mismatch',
        name: 'Service Area Mismatch',
        description: 'Keywords targeting areas outside primary service area',
        condition: 'isLocationKeyword AND notInServiceArea',
        priority: 'medium',
        enabled: true,
      },
      {
        id: 'high-intent-opportunity',
        name: 'High Intent Opportunity',
        description: 'Converting keywords with room to scale',
        condition: 'conversions > 5 AND impressionShare < 50',
        priority: 'medium',
        enabled: true,
      },
    ],
    criticalPages: [
      {
        id: 'high-spend-service-page',
        name: 'High Spend Service Page',
        description: 'Service pages receiving significant paid traffic',
        condition: 'isServicePage AND paidSpend > 250',
        priority: 'critical',
        enabled: true,
      },
      {
        id: 'poor-converting-landing',
        name: 'Poor Converting Landing Page',
        description: 'Landing pages with traffic but low form submissions',
        condition: 'sessions > 100 AND conversionRate < 2',
        priority: 'critical',
        enabled: true,
      },
      {
        id: 'high-bounce-landing',
        name: 'High Bounce Landing Page',
        description: 'Landing pages with excessive bounce rates',
        condition: 'bounceRate > highBounceRateThreshold AND sessions > 75',
        priority: 'high',
        enabled: true,
      },
      {
        id: 'contact-page-issues',
        name: 'Contact Page Issues',
        description: 'Contact pages with poor engagement metrics',
        condition: 'isContactPage AND (bounceRate > 60 OR avgTimeOnPage < 30)',
        priority: 'high',
        enabled: true,
      },
      {
        id: 'service-page-opportunity',
        name: 'Service Page Opportunity',
        description: 'Service pages that could capture more organic traffic',
        condition: 'isServicePage AND impressions > 500 AND ctr < lowCtrThreshold',
        priority: 'medium',
        enabled: true,
      },
    ],
  },

  metrics: {
    // Lead-gen focuses on lead volume and cost efficiency
    include: [
      'spend',
      'conversions',
      'cpl',
      'ctr',
      'cpc',
      'impressions',
      'impressionShare',
      'position',
      'bounceRate',
      'conversionRate',
      'calls',
      'formSubmissions',
    ],
    // CRITICAL: Exclude ecommerce metrics that don't apply
    exclude: [
      'roas',
      'revenue',
      'aov',
      'conversionValue',
      'transactionId',
    ],
    primary: ['cpl', 'conversions', 'conversionRate'], // Sort/prioritize by these
  },

  limits: {
    maxBattlegroundKeywords: 20,
    maxCriticalPages: 12,
  },
};
