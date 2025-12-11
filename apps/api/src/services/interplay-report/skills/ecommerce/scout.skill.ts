/**
 * Ecommerce Scout Skill
 *
 * The Scout performs data triage (no AI) to identify battleground keywords
 * and critical pages that warrant deeper analysis.
 *
 * Ecommerce focus: Revenue-driving keywords, product pages, high-ROAS opportunities
 */

import type { ScoutSkillDefinition } from '../types.js';

export const ecommerceScoutSkill: ScoutSkillDefinition = {
  version: '1.0.0',

  thresholds: {
    // Ecommerce typically has higher spend thresholds due to product margins
    highSpendThreshold: 500, // Monthly spend in dollars
    lowRoasThreshold: 2.0, // ROAS below 2x is concerning for most ecommerce
    cannibalizationPosition: 5, // Organic position where paid may be redundant
    highBounceRateThreshold: 65, // Product pages should engage users
    lowCtrThreshold: 1.5, // CTR below this signals ad copy or relevance issues
    minImpressionsForAnalysis: 100, // Need sufficient data for reliable analysis
  },

  priorityRules: {
    battlegroundKeywords: [
      {
        id: 'high-spend-low-roas',
        name: 'High Spend, Low ROAS',
        description: 'Keywords with significant spend but poor return on ad spend',
        condition: 'spend > highSpendThreshold AND roas < lowRoasThreshold',
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
        id: 'brand-vs-generic',
        name: 'Brand Term Efficiency',
        description: 'Brand keywords with high spend that could rely on organic',
        condition: 'isBrandTerm AND spend > 200 AND organicPosition <= 3',
        priority: 'high',
        enabled: true,
      },
      {
        id: 'high-intent-low-conversion',
        name: 'High Intent, Low Conversion',
        description: 'Product-specific queries not converting well',
        condition: 'isProductQuery AND clicks > 50 AND conversions < 2',
        priority: 'high',
        enabled: true,
      },
      {
        id: 'growth-potential',
        name: 'Growth Opportunity',
        description: 'Keywords with good ROAS that could scale with more budget',
        condition: 'roas > 4 AND impressionShare < 50',
        priority: 'medium',
        enabled: true,
      },
      {
        id: 'competitive-pressure',
        name: 'Competitive Pressure',
        description: 'Losing impression share to competitors on key terms',
        condition: 'lostImpressionShareRank > 30 AND conversions > 5',
        priority: 'medium',
        enabled: true,
      },
    ],
    criticalPages: [
      {
        id: 'high-spend-product-page',
        name: 'High Spend Product Page',
        description: 'Product pages receiving significant paid traffic',
        condition: 'isProductPage AND paidSpend > 300',
        priority: 'critical',
        enabled: true,
      },
      {
        id: 'poor-organic-product',
        name: 'Poor Organic Visibility',
        description: 'Product pages with weak organic presence',
        condition: 'isProductPage AND organicPosition > 20',
        priority: 'high',
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
        id: 'category-page-opportunity',
        name: 'Category Page Opportunity',
        description: 'Category pages that could capture more organic traffic',
        condition: 'isCategoryPage AND impressions > 1000 AND ctr < lowCtrThreshold',
        priority: 'medium',
        enabled: true,
      },
    ],
  },

  metrics: {
    // Ecommerce uses all revenue-focused metrics
    include: [
      'spend',
      'revenue',
      'roas',
      'conversions',
      'conversionValue',
      'ctr',
      'cpc',
      'impressions',
      'impressionShare',
      'position',
      'bounceRate',
      'aov',
    ],
    exclude: [
      // No metrics excluded for ecommerce
    ],
    primary: ['roas', 'revenue', 'conversions'], // Sort/prioritize by these
  },

  limits: {
    maxBattlegroundKeywords: 25,
    maxCriticalPages: 15,
  },
};
