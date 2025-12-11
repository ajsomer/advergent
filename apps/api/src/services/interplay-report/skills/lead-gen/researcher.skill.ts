/**
 * Lead-Gen Researcher Skill
 *
 * The Researcher enriches Scout findings with competitive data and page content.
 * No AI - pure data enrichment and extraction.
 *
 * Lead-gen focus: Service schema, contact forms, trust signals
 */

import type { ResearcherSkillDefinition } from '../types.js';

export const leadGenResearcherSkill: ResearcherSkillDefinition = {
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
      // Not applicable for lead-gen
      irrelevant: [
        'shoppingImpressionShare', // No shopping campaigns
        'productListingShare', // No product feeds
      ],
    },
    priorityBoosts: [
      {
        metric: 'impressionShare',
        condition: 'impressionShare < 40 AND conversions > 5',
        boost: 2,
        reason: 'High-converting keyword with significant market share opportunity',
      },
      {
        metric: 'lostImpressionShareBudget',
        condition: 'lostImpressionShareBudget > 30 AND cpl < targetCpl',
        boost: 1.5,
        reason: 'Efficient keyword limited by budget',
      },
      {
        metric: 'topOfPageRate',
        condition: 'topOfPageRate < 50 AND isHighIntentQuery',
        boost: 1.3,
        reason: 'High-intent query not achieving top positions',
      },
      {
        metric: 'conversionRate',
        condition: 'conversionRate > 5 AND spend < 200',
        boost: 1.4,
        reason: 'High-converting keyword with room to scale',
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
      // Lead-gen should have these schemas
      lookFor: [
        'Service',
        'ProfessionalService',
        'Organization',
        'LocalBusiness',
        'FAQPage',
        'ContactPoint',
        'PostalAddress',
      ],
      // These schemas indicate potential issues on lead-gen pages
      flagIfPresent: [
        'Product', // Product schema suggests ecommerce, not services
        'Offer', // Offer schema is for products
        'AggregateOffer', // Multiple offers - not service business
      ],
      // Missing schemas that should exist
      flagIfMissing: [
        'Service', // Service pages should have Service schema
        'Organization', // Business info should be present
      ],
    },

    contentSignals: [
      {
        id: 'contact-form',
        name: 'Contact Form',
        selector: 'form[class*="contact"], form[id*="contact"], form[action*="contact"], .contact-form',
        importance: 'critical',
        description: 'Lead capture form presence',
        businessContext: 'Primary conversion mechanism for lead-gen businesses',
      },
      {
        id: 'phone-number',
        name: 'Phone Number Display',
        selector: 'a[href^="tel:"], [class*="phone"], .phone-number, [data-phone]',
        importance: 'critical',
        description: 'Click-to-call phone number',
        businessContext: 'Many leads come through phone calls',
      },
      {
        id: 'trust-signals',
        name: 'Trust Signals',
        selector: '[class*="certification"], [class*="award"], [class*="badge"], .trust-badge',
        importance: 'high',
        description: 'Certifications, awards, accreditations',
        businessContext: 'Trust signals improve conversion rates for services',
      },
      {
        id: 'testimonials',
        name: 'Customer Testimonials',
        selector: '[class*="testimonial"], [class*="review"], .client-review, blockquote',
        importance: 'high',
        description: 'Customer testimonials and reviews',
        businessContext: 'Social proof is critical for service businesses',
      },
      {
        id: 'service-area',
        name: 'Service Area Information',
        selector: '[class*="service-area"], [class*="location"], .areas-served',
        importance: 'medium',
        description: 'Geographic service area display',
        businessContext: 'Helps users understand if service is available in their area',
      },
      {
        id: 'cta-buttons',
        name: 'Call-to-Action Buttons',
        selector: '[class*="cta"], .get-quote, .free-consultation, .contact-us',
        importance: 'high',
        description: 'Clear calls-to-action',
        businessContext: 'Multiple CTAs improve conversion opportunities',
      },
      {
        id: 'pricing-info',
        name: 'Pricing Information',
        selector: '[class*="pricing"], [class*="price"], .rates, .cost',
        importance: 'medium',
        description: 'Pricing or quote request information',
        businessContext: 'Transparency on pricing builds trust',
      },
    ],

    pageClassification: {
      patterns: [
        {
          pattern: '/services/|/our-services/|/what-we-do/',
          pageType: 'service',
          description: 'Service offering page',
          confidence: 0.9,
        },
        {
          pattern: '/service/[^/]+/?$',
          pageType: 'service-detail',
          description: 'Individual service detail page',
          confidence: 0.85,
        },
        {
          pattern: '/contact|/get-in-touch|/reach-us',
          pageType: 'contact',
          description: 'Contact page',
          confidence: 0.95,
        },
        {
          pattern: '/quote|/free-quote|/get-quote|/estimate',
          pageType: 'quote',
          description: 'Quote request page',
          confidence: 0.95,
        },
        {
          pattern: '/consultation|/free-consultation|/book|/schedule',
          pageType: 'booking',
          description: 'Consultation/booking page',
          confidence: 0.9,
        },
        {
          pattern: '/about|/about-us|/our-team|/who-we-are',
          pageType: 'about',
          description: 'About/trust page',
          confidence: 0.85,
        },
        {
          pattern: '/locations/|/areas-served/|/service-areas/',
          pageType: 'location',
          description: 'Service area page',
          confidence: 0.85,
        },
        {
          pattern: '/case-studies/|/portfolio/|/our-work/',
          pageType: 'portfolio',
          description: 'Case studies/portfolio page',
          confidence: 0.85,
        },
        {
          pattern: '/testimonials|/reviews|/clients',
          pageType: 'testimonials',
          description: 'Social proof page',
          confidence: 0.85,
        },
        {
          pattern: '/blog/|/resources/|/articles/',
          pageType: 'content',
          description: 'Educational content',
          confidence: 0.8,
        },
      ],
      defaultType: 'landing',
      confidenceThreshold: 0.7,
    },
  },

  dataQuality: {
    minKeywordsWithCompetitiveData: 8,
    minPagesWithContent: 4,
    maxFetchTimeout: 15000,
    maxConcurrentFetches: 5,
  },
};
