/**
 * Local Business Researcher Skill
 *
 * The Researcher enriches Scout findings with competitive data and page content.
 * No AI - pure data enrichment and extraction.
 *
 * Local focus: LocalBusiness schema, NAP consistency, Google Business Profile signals
 */

import type { ResearcherSkillDefinition } from '../types.js';

export const localResearcherSkill: ResearcherSkillDefinition = {
  version: '1.0.0',

  keywordEnrichment: {
    competitiveMetrics: {
      // Critical for understanding local market position
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
      // Not applicable for local business
      irrelevant: [
        'shoppingImpressionShare', // No shopping campaigns
        'productListingShare', // No product feeds
      ],
    },
    priorityBoosts: [
      {
        metric: 'impressionShare',
        condition: 'impressionShare < 40 AND conversions > 3',
        boost: 2,
        reason: 'Converting local keyword with market share opportunity',
      },
      {
        metric: 'isNearMeQuery',
        condition: 'isNearMeQuery AND conversionRate > 5',
        boost: 1.8,
        reason: 'High-intent "near me" keyword performing well',
      },
      {
        metric: 'callConversions',
        condition: 'callConversions > 3 AND callConversionRate > 10',
        boost: 1.6,
        reason: 'Strong phone call conversion keyword',
      },
      {
        metric: 'lostImpressionShareBudget',
        condition: 'lostImpressionShareBudget > 30 AND conversions > 2',
        boost: 1.5,
        reason: 'Converting keyword limited by budget',
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
      // Local businesses should have these schemas (including specific LocalBusiness subtypes)
      lookFor: [
        'LocalBusiness',
        'Organization',
        'PostalAddress',
        'GeoCoordinates',
        'OpeningHoursSpecification',
        'AggregateRating',
        'Review',
        'Service',
        // Specific LocalBusiness subtypes
        'Restaurant',
        'Dentist',
        'Plumber',
        'Attorney',
        'RealEstateAgent',
        'HealthAndBeautyBusiness',
        'HomeAndConstructionBusiness',
        'AutomotiveBusiness',
        'Store',
      ],
      // These schemas indicate wrong focus
      flagIfPresent: [
        'SoftwareApplication', // Not a software business
        'WebApplication', // Not a web app
      ],
      // Missing schemas that must exist for local
      flagIfMissing: [
        'LocalBusiness', // Core requirement
        'PostalAddress', // Address is critical
      ],
    },

    contentSignals: [
      {
        id: 'nap-display',
        name: 'NAP Display',
        selector: '[class*="address"], [itemtype*="PostalAddress"], .business-address',
        importance: 'critical',
        description: 'Name, Address, Phone number display',
        businessContext: 'NAP consistency is critical for local SEO',
      },
      {
        id: 'phone-clicktocall',
        name: 'Click-to-Call Phone',
        selector: 'a[href^="tel:"], [class*="phone"], .phone-number',
        importance: 'critical',
        description: 'Clickable phone number',
        businessContext: 'Phone calls are primary conversion for local businesses',
      },
      {
        id: 'google-maps-embed',
        name: 'Google Maps Embed',
        selector: 'iframe[src*="google.com/maps"], [class*="map"], .google-map',
        importance: 'high',
        description: 'Embedded Google Map',
        businessContext: 'Helps users find physical location',
      },
      {
        id: 'hours-display',
        name: 'Business Hours',
        selector: '[class*="hours"], [itemtype*="OpeningHours"], .business-hours',
        importance: 'high',
        description: 'Business hours display',
        businessContext: 'Hours reduce friction for visit planning',
      },
      {
        id: 'reviews-display',
        name: 'Customer Reviews',
        selector: '[class*="review"], [class*="testimonial"], .customer-review',
        importance: 'high',
        description: 'Customer reviews and ratings',
        businessContext: 'Reviews significantly impact local purchase decisions',
      },
      {
        id: 'service-area-info',
        name: 'Service Area',
        selector: '[class*="service-area"], [class*="location"], .areas-served',
        importance: 'medium',
        description: 'Service area information',
        businessContext: 'Helps users understand coverage',
      },
      {
        id: 'directions-link',
        name: 'Directions Link',
        selector: 'a[href*="maps.google"], a[href*="directions"], .get-directions',
        importance: 'medium',
        description: 'Get directions link',
        businessContext: 'Facilitates store visits',
      },
      {
        id: 'parking-info',
        name: 'Parking Information',
        selector: '[class*="parking"], .parking-info',
        importance: 'low',
        description: 'Parking availability',
        businessContext: 'Reduces friction for visits',
      },
    ],

    pageClassification: {
      patterns: [
        {
          pattern: '/locations/|/our-locations/|/find-us/',
          pageType: 'locations',
          description: 'Multi-location directory page',
          confidence: 0.9,
        },
        {
          pattern: '/location/[^/]+|/store/[^/]+',
          pageType: 'location-detail',
          description: 'Individual location page',
          confidence: 0.9,
        },
        {
          pattern: '/service-area/|/areas-served/|/we-serve/',
          pageType: 'service-area',
          description: 'Service area page',
          confidence: 0.85,
        },
        {
          pattern: '/services/|/our-services/',
          pageType: 'services',
          description: 'Service listing page',
          confidence: 0.85,
        },
        {
          pattern: '/service/[^/]+',
          pageType: 'service-detail',
          description: 'Individual service page',
          confidence: 0.85,
        },
        {
          pattern: '/contact|/contact-us|/reach-us',
          pageType: 'contact',
          description: 'Contact page',
          confidence: 0.95,
        },
        {
          pattern: '/about|/about-us|/our-story',
          pageType: 'about',
          description: 'About page',
          confidence: 0.85,
        },
        {
          pattern: '/reviews|/testimonials|/what-people-say',
          pageType: 'reviews',
          description: 'Reviews/testimonials page',
          confidence: 0.85,
        },
        {
          pattern: '/hours|/schedule|/appointments',
          pageType: 'hours',
          description: 'Hours/scheduling page',
          confidence: 0.85,
        },
        {
          pattern: '/blog/|/news/|/updates/',
          pageType: 'content',
          description: 'Content/blog page',
          confidence: 0.8,
        },
      ],
      defaultType: 'landing',
      confidenceThreshold: 0.7,
    },
  },

  dataQuality: {
    minKeywordsWithCompetitiveData: 5,
    minPagesWithContent: 3,
    maxFetchTimeout: 15000,
    maxConcurrentFetches: 5,
  },
};
