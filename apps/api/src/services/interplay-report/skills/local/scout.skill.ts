/**
 * Local Business Scout Skill
 *
 * The Scout performs data triage (no AI) to identify battleground keywords
 * and critical pages that warrant deeper analysis.
 *
 * Local focus: Store visits, phone calls, directions, local pack presence
 */

import type { ScoutSkillDefinition } from '../types.js';

export const localScoutSkill: ScoutSkillDefinition = {
  version: '1.0.0',

  thresholds: {
    // Local businesses typically have smaller budgets
    highSpendThreshold: 200, // Monthly spend in dollars
    lowRoasThreshold: 0, // Often can't track offline revenue
    cannibalizationPosition: 3, // Local pack is top 3
    highBounceRateThreshold: 60, // Local pages should engage
    lowCtrThreshold: 3.0, // Local intent = higher CTR expected
    minImpressionsForAnalysis: 30, // Lower volume in local markets
  },

  priorityRules: {
    battlegroundKeywords: [
      {
        id: 'high-spend-low-conversions',
        name: 'High Spend, Low Conversions',
        description: 'Keywords with significant spend but few calls/visits',
        condition: 'spend > highSpendThreshold AND conversions < 3',
        priority: 'critical',
        enabled: true,
      },
      {
        id: 'service-area-coverage',
        name: 'Service Area Coverage',
        description: 'Keywords for service areas not fully covered',
        condition: 'isServiceAreaKeyword AND impressionShare < 40',
        priority: 'critical',
        enabled: true,
      },
      {
        id: 'local-pack-competition',
        name: 'Local Pack Competition',
        description: 'Competitors appearing in local pack for key terms',
        condition: 'hasLocalPackCompetitors AND spend > 100',
        priority: 'high',
        enabled: true,
      },
      {
        id: 'call-tracking-gaps',
        name: 'Call Tracking Gaps',
        description: 'Mobile traffic without call extensions or tracking',
        condition: 'isMobileHeavy AND callConversions < clicks * 0.02',
        priority: 'high',
        enabled: true,
      },
      {
        id: 'location-keyword-match',
        name: 'Location Keyword Match',
        description: 'Keywords matching service locations',
        condition: 'isLocationKeyword AND conversions > 2',
        priority: 'high',
        enabled: true,
      },
      {
        id: 'gmb-opportunity',
        name: 'Google Business Profile Opportunity',
        description: 'Keywords where GBP could drive more visibility',
        condition: 'isLocalIntent AND organicPosition > 5',
        priority: 'medium',
        enabled: true,
      },
      {
        id: 'near-me-keywords',
        name: 'Near Me Keywords',
        description: 'High-intent "near me" local searches',
        condition: 'isNearMeQuery AND impressions > 50',
        priority: 'medium',
        enabled: true,
      },
    ],
    criticalPages: [
      {
        id: 'location-page-issues',
        name: 'Location Page Issues',
        description: 'Location pages with poor performance',
        condition: 'isLocationPage AND (bounceRate > 60 OR conversionRate < 3)',
        priority: 'critical',
        enabled: true,
      },
      {
        id: 'high-spend-landing',
        name: 'High Spend Landing Page',
        description: 'Landing pages receiving significant paid traffic',
        condition: 'paidSpend > 150',
        priority: 'critical',
        enabled: true,
      },
      {
        id: 'service-page-local',
        name: 'Service Page Opportunity',
        description: 'Service pages that need local optimization',
        condition: 'isServicePage AND missingLocalSignals',
        priority: 'high',
        enabled: true,
      },
      {
        id: 'contact-page-issues',
        name: 'Contact Page Issues',
        description: 'Contact page with poor engagement',
        condition: 'isContactPage AND (bounceRate > 50 OR avgTimeOnPage < 30)',
        priority: 'high',
        enabled: true,
      },
      {
        id: 'hours-page-visibility',
        name: 'Hours & Location Visibility',
        description: 'Pages with business hours and location info',
        condition: 'hasHoursInfo AND organicPosition > 10',
        priority: 'medium',
        enabled: true,
      },
    ],
  },

  metrics: {
    // Local focuses on calls, visits, and directions
    include: [
      'spend',
      'conversions',
      'calls',
      'directions',
      'storeVisits',
      'ctr',
      'cpc',
      'impressions',
      'impressionShare',
      'position',
      'bounceRate',
      'conversionRate',
    ],
    // Exclude metrics that can't be tracked for offline conversions
    exclude: [
      'roas', // Often can't track offline revenue
      'revenue', // Transactions happen offline
      'aov', // No online transactions
      'mrr', // SaaS metric
      'arr', // SaaS metric
    ],
    primary: ['conversions', 'calls', 'storeVisits'], // Sort/prioritize by these
  },

  limits: {
    maxBattlegroundKeywords: 15,
    maxCriticalPages: 10,
  },
};
