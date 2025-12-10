import type { ScoutSkillDefinition, BusinessType } from '../types.js';

export function createPlaceholderScoutSkill(businessType: BusinessType): ScoutSkillDefinition {
  return {
    version: '0.1.0-placeholder',
    thresholds: {
      highSpendThreshold: 100,
      lowRoasThreshold: 2.0,
      cannibalizationPosition: 5,
      highBounceRateThreshold: 70,
      lowCtrThreshold: 2.0,
      minImpressionsForAnalysis: 100,
    },
    priorityRules: {
      battlegroundKeywords: [],
      criticalPages: [],
    },
    metrics: {
      include: ['spend', 'conversions', 'ctr', 'impressions', 'position'],
      exclude: [],
      primary: ['spend', 'conversions'],
    },
    limits: {
      maxBattlegroundKeywords: 20,
      maxCriticalPages: 10,
    },
  };
}
