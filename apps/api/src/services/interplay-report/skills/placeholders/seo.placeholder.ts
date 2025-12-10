import type { SEOSkillDefinition, BusinessType } from '../types.js';

export function createPlaceholderSEOSkill(businessType: BusinessType): SEOSkillDefinition {
  return {
    version: '0.1.0-placeholder',
    context: {
      siteType: `${businessType} website`,
      primaryGoal: 'Drive organic traffic and conversions',
      contentStrategy: 'Content aligned with business goals',
    },
    schema: {
      required: [],
      recommended: [],
      invalid: [],
      pageTypeRules: [],
    },
    kpis: {
      primary: [
        {
          metric: 'organicTraffic',
          importance: 'critical',
          description: 'Total organic sessions',
          targetDirection: 'higher',
          businessContext: 'Primary traffic metric',
        },
      ],
      secondary: [],
      irrelevant: [],
    },
    benchmarks: {
      organicCtr: { excellent: 0.05, good: 0.03, average: 0.02, poor: 0.01 },
      bounceRate: { excellent: 0.40, good: 0.50, average: 0.60, poor: 0.75 },
      avgPosition: { excellent: 3, good: 7, average: 15, poor: 25 },
    },
    analysis: {
      contentPatterns: [],
      technicalChecks: [],
      onPageFactors: [],
    },
    prompt: {
      roleContext: `You are analyzing a ${businessType} website for SEO.`,
      analysisInstructions: 'Analyze the page data and provide SEO recommendations.',
      outputGuidance: 'Focus on actionable improvements.',
      examples: [],
      constraints: [],
    },
    commonIssues: {
      critical: [],
      warnings: [],
      falsePositives: [],
    },
    output: {
      recommendationTypes: {
        prioritize: [],
        deprioritize: [],
        exclude: [],
      },
      maxRecommendations: 8,
    },
  };
}
