import type { DirectorSkillDefinition, BusinessType } from '../types.js';

/**
 * Phase 6: Business-type-specific constraint exclusions.
 *
 * These patterns filter out recommendations that are inappropriate
 * for the business type. The Director validates upstream agent outputs
 * against these patterns before synthesis.
 *
 * Pattern syntax:
 * - "metric:X" - Exclude if recommendation mentions metric X
 * - "schema:X" - Exclude if recommending schema type X
 * - "type:X" - Exclude if contains phrase X (spaces replace hyphens)
 * - Plain text - Simple text match
 */
const BUSINESS_TYPE_EXCLUSIONS: Record<BusinessType, string[]> = {
  // Lead-gen: No e-commerce metrics or product schema
  'lead-gen': [
    'metric:roas', // ROAS not applicable for lead-gen
    'metric:revenue', // Revenue not a primary metric
    'metric:aov', // AOV not applicable
    'schema:Product', // Product schema is wrong for services
    'schema:Offer', // Offer schema is e-commerce focused
    'schema:AggregateOffer', // E-commerce schema
    'type:shopping-campaign', // No shopping campaigns
    'type:merchant-center', // No merchant center
    'type:product-feed', // No product feeds
    'type:product-listing-ads', // No PLAs
  ],

  // E-commerce: All metrics and schemas are generally valid
  ecommerce: [
    // E-commerce can use most strategies
    // Only exclude very service-specific schemas
    'schema:ProfessionalService', // Service schema not for products
  ],

  // SaaS: Similar to lead-gen but may have recurring revenue
  saas: [
    'metric:aov', // AOV not as relevant for subscriptions
    'schema:Product', // Physical product schema
    'schema:Offer', // Physical offer schema
    'type:shopping-campaign', // No shopping campaigns
    'type:merchant-center', // No merchant center
    'type:product-feed', // No product feeds
  ],

  // Local: Focus on local presence, not e-commerce
  local: [
    'metric:roas', // Local often has offline conversions
    'schema:Product', // Unless they sell products
    'type:merchant-center', // Usually not applicable
  ],
};

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
      mustExclude: BUSINESS_TYPE_EXCLUSIONS[businessType] || [],
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
