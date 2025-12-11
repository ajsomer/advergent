/**
 * SaaS Researcher Skill
 *
 * The Researcher enriches Scout findings with competitive data and page content.
 * No AI - pure data enrichment and extraction.
 *
 * SaaS focus: SoftwareApplication schema, trial CTAs, feature comparison
 */

import type { ResearcherSkillDefinition } from '../types.js';

export const saasResearcherSkill: ResearcherSkillDefinition = {
  version: '1.0.0',

  keywordEnrichment: {
    competitiveMetrics: {
      // Critical for understanding market position
      required: [
        'impressionShare',
        'lostImpressionShareRank',
        'lostImpressionShareBudget',
      ],
      // Helpful for competitive positioning
      optional: [
        'topOfPageRate',
        'absTopOfPageRate',
        'overlapRate',
        'outrankingShare',
        'positionAboveRate',
      ],
      // Not applicable for SaaS
      irrelevant: [
        'shoppingImpressionShare', // No shopping campaigns
        'productListingShare', // No product feeds
      ],
    },
    priorityBoosts: [
      {
        metric: 'impressionShare',
        condition: 'impressionShare < 35 AND conversions > 5',
        boost: 2,
        reason: 'High-converting keyword with significant market share opportunity',
      },
      {
        metric: 'lostImpressionShareBudget',
        condition: 'lostImpressionShareBudget > 30 AND cac < targetCac',
        boost: 1.6,
        reason: 'Efficient keyword limited by budget',
      },
      {
        metric: 'isCompetitorTerm',
        condition: 'isCompetitorTerm AND conversionRate > 3',
        boost: 1.5,
        reason: 'Competitor keyword with strong conversion - capture switching intent',
      },
      {
        metric: 'isFeatureQuery',
        condition: 'isFeatureQuery AND conversions > 3',
        boost: 1.4,
        reason: 'Feature-specific query showing purchase intent',
      },
    ],
  },

  pageEnrichment: {
    standardExtractions: {
      title: true,
      h1: true,
      metaDescription: true,
      canonicalUrl: true,
      wordCount: true,
    },

    schemaExtraction: {
      // SaaS should have these schemas
      lookFor: [
        'SoftwareApplication',
        'WebApplication',
        'Organization',
        'FAQPage',
        'HowTo',
        'VideoObject',
        'Review',
        'AggregateRating',
      ],
      // These schemas indicate wrong business type
      flagIfPresent: [
        'Product', // Physical product schema
        'Offer', // Physical product offers
        'LocalBusiness', // SaaS is not location-based
      ],
      // Missing schemas that should exist
      flagIfMissing: [
        'SoftwareApplication', // Core requirement for SaaS
        'Organization', // Business info should be present
      ],
    },

    contentSignals: [
      {
        id: 'trial-cta',
        name: 'Free Trial CTA',
        selector: '[class*="trial"], [data-action*="trial"], .start-trial, .free-trial',
        importance: 'critical',
        description: 'Free trial signup call-to-action',
        businessContext: 'Primary conversion mechanism for SaaS',
      },
      {
        id: 'demo-cta',
        name: 'Demo Request CTA',
        selector: '[class*="demo"], .request-demo, .book-demo, .schedule-demo',
        importance: 'critical',
        description: 'Demo request call-to-action',
        businessContext: 'Secondary conversion for enterprise SaaS',
      },
      {
        id: 'pricing-display',
        name: 'Pricing Information',
        selector: '[class*="pricing"], .price, .plan, [data-plan]',
        importance: 'high',
        description: 'Pricing and plan information',
        businessContext: 'Transparent pricing builds trust and qualifies visitors',
      },
      {
        id: 'feature-comparison',
        name: 'Feature Comparison',
        selector: '[class*="comparison"], [class*="compare"], .vs, .alternative',
        importance: 'high',
        description: 'Feature comparison tables',
        businessContext: 'Helps users evaluate against competitors',
      },
      {
        id: 'integration-logos',
        name: 'Integration Partners',
        selector: '[class*="integration"], [class*="partner"], .apps, .connect',
        importance: 'medium',
        description: 'Integration partner logos and badges',
        businessContext: 'Integrations are major buying criteria for SaaS',
      },
      {
        id: 'security-badges',
        name: 'Security Certifications',
        selector: '[class*="security"], [class*="compliance"], .soc2, .gdpr, .hipaa',
        importance: 'high',
        description: 'Security and compliance certifications',
        businessContext: 'Security is critical for B2B SaaS purchases',
      },
      {
        id: 'customer-logos',
        name: 'Customer Logos',
        selector: '[class*="customer"], [class*="client"], .trusted-by, .used-by',
        importance: 'high',
        description: 'Customer logo display',
        businessContext: 'Social proof from recognized brands',
      },
      {
        id: 'testimonials',
        name: 'Customer Testimonials',
        selector: '[class*="testimonial"], [class*="review"], .quote, blockquote',
        importance: 'medium',
        description: 'Customer testimonials and reviews',
        businessContext: 'Social proof for purchase decisions',
      },
    ],

    pageClassification: {
      patterns: [
        {
          pattern: '/pricing|/plans|/packages',
          pageType: 'pricing',
          description: 'Pricing and plans page',
          confidence: 0.95,
        },
        {
          pattern: '/features/|/product/|/platform/',
          pageType: 'feature',
          description: 'Product feature page',
          confidence: 0.9,
        },
        {
          pattern: '/feature/[^/]+/?$',
          pageType: 'feature-detail',
          description: 'Individual feature detail page',
          confidence: 0.85,
        },
        {
          pattern: '/integrations/|/apps/|/marketplace/',
          pageType: 'integrations',
          description: 'Integration directory page',
          confidence: 0.9,
        },
        {
          pattern: '/integration/[^/]+|/connect/[^/]+',
          pageType: 'integration-detail',
          description: 'Individual integration page',
          confidence: 0.85,
        },
        {
          pattern: '/compare/|/vs/|/alternative',
          pageType: 'comparison',
          description: 'Competitor comparison page',
          confidence: 0.9,
        },
        {
          pattern: '/customers/|/case-studies/|/success-stories/',
          pageType: 'case-studies',
          description: 'Customer success stories',
          confidence: 0.85,
        },
        {
          pattern: '/docs/|/help/|/support/|/knowledge-base/',
          pageType: 'documentation',
          description: 'Help documentation',
          confidence: 0.9,
        },
        {
          pattern: '/demo|/request-demo|/book-demo',
          pageType: 'demo',
          description: 'Demo request page',
          confidence: 0.95,
        },
        {
          pattern: '/trial|/signup|/get-started|/start',
          pageType: 'trial',
          description: 'Trial signup page',
          confidence: 0.9,
        },
        {
          pattern: '/solutions/|/use-cases/|/industries/',
          pageType: 'solutions',
          description: 'Solution/use case page',
          confidence: 0.85,
        },
        {
          pattern: '/changelog|/updates|/releases',
          pageType: 'changelog',
          description: 'Product updates page',
          confidence: 0.85,
        },
        {
          pattern: '/blog/|/resources/|/articles/',
          pageType: 'content',
          description: 'Content marketing',
          confidence: 0.8,
        },
      ],
      defaultType: 'landing',
      confidenceThreshold: 0.7,
    },
  },

  dataQuality: {
    minKeywordsWithCompetitiveData: 10,
    minPagesWithContent: 5,
    maxFetchTimeout: 15000,
    maxConcurrentFetches: 5,
  },
};
