import type { DirectorSkillDefinition, BusinessType } from '../types.js';

export function createPlaceholderDirectorSkill(businessType: BusinessType): DirectorSkillDefinition {
  return {
    version: '0.1.0-placeholder',
    context: {
      businessPriorities: ['Improve performance'],
      successMetrics: ['conversions', 'traffic'],
      executiveFraming: `Focus on key metrics for ${businessType} businesses.`,
    },
    synthesis: {
      conflictResolution: [],
      synergyIdentification: [],
      prioritization: [],
    },
    filtering: {
      maxRecommendations: 10,
      minImpactThreshold: 'medium',
      impactWeights: {
        revenue: 0.3,
        cost: 0.3,
        effort: 0.2,
        risk: 0.2,
      },
      mustInclude: [],
      mustExclude: [],
    },
    executiveSummary: {
      focusAreas: ['Overall performance'],
      metricsToQuantify: ['conversions'],
      framingGuidance: 'Focus on actionable insights.',
      maxHighlights: 5,
    },
    prompt: {
      roleContext: `You are synthesizing recommendations for a ${businessType} client.`,
      synthesisInstructions: 'Combine SEM and SEO recommendations into a unified view.',
      prioritizationGuidance: 'Prioritize by business impact.',
      outputFormat: 'Structured recommendations with impact and effort.',
      constraints: [],
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
}
