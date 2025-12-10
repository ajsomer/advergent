import type { SEMSkillDefinition, BusinessType } from '../types.js';

export function createPlaceholderSEMSkill(businessType: BusinessType): SEMSkillDefinition {
  return {
    version: '0.1.0-placeholder',
    context: {
      businessModel: `This is a ${businessType} business.`,
      conversionDefinition: 'Conversions as tracked in Google Ads.',
      typicalCustomerJourney: 'Standard search → click → convert journey.',
    },
    kpis: {
      primary: [
        {
          metric: 'conversions',
          importance: 'critical',
          description: 'Total conversions',
          targetDirection: 'higher',
          businessContext: 'Primary goal metric',
        },
      ],
      secondary: [],
      irrelevant: [],
    },
    benchmarks: {
      ctr: { excellent: 0.05, good: 0.03, average: 0.02, poor: 0.01 },
      conversionRate: { excellent: 0.05, good: 0.03, average: 0.02, poor: 0.01 },
      cpc: { excellent: 1, good: 2, average: 3, poor: 5 },
    },
    analysis: {
      keyPatterns: [],
      antiPatterns: [],
      opportunities: [],
    },
    prompt: {
      roleContext: `You are analyzing a ${businessType} Google Ads account.`,
      analysisInstructions: 'Analyze the keyword data and provide recommendations.',
      outputGuidance: 'Focus on actionable improvements.',
      examples: [],
      constraints: [],
    },
    output: {
      recommendationTypes: {
        prioritize: [],
        deprioritize: [],
        exclude: [],
      },
      maxRecommendations: 8,
      requireQuantifiedImpact: false,
    },
  };
}
