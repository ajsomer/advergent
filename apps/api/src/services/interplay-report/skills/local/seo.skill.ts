/**
 * Local Business SEO Skill
 *
 * AI-powered analysis of organic search performance for local businesses.
 * Focuses on Google Business Profile, local pack presence, NAP consistency, and location pages.
 */

import type { SEOSkillDefinition } from '../types.js';

export const localSEOSkill: SEOSkillDefinition = {
  version: '1.0.0',

  context: {
    siteType:
      'Local business website with physical location(s). Success is measured by local pack presence, direction requests, phone calls, and store visits from organic search.',
    primaryGoal:
      'Dominate local search results for service area. Optimize Google Business Profile, build local citations, and ensure location pages rank for "[service] [city]" queries.',
    contentStrategy:
      'Location-focused content with unique pages for each service area. Trust signals (reviews, certifications) are critical. Google Business Profile optimization is as important as website SEO.',
  },

  schema: {
    required: [
      {
        type: 'LocalBusiness',
        description: 'Local business structured data with NAP and details',
        importance: 'required',
        validationNotes:
          'Use specific subtype (Restaurant, Dentist, Plumber, etc.). Must include name, address, telephone, openingHours.',
      },
      {
        type: 'PostalAddress',
        description: 'Physical address structured data',
        importance: 'required',
        validationNotes:
          'Include streetAddress, addressLocality, addressRegion, postalCode, addressCountry.',
      },
      {
        type: 'GeoCoordinates',
        description: 'Latitude and longitude',
        importance: 'required',
        validationNotes:
          'Accurate coordinates for Google Maps integration.',
      },
    ],
    recommended: [
      {
        type: 'OpeningHoursSpecification',
        description: 'Business hours structured data',
        importance: 'recommended',
        validationNotes:
          'Include for each day. Can specify special hours for holidays.',
      },
      {
        type: 'AggregateRating',
        description: 'Overall business rating',
        importance: 'recommended',
        validationNotes:
          'Include ratingValue, reviewCount. Must reflect real reviews.',
      },
      {
        type: 'Review',
        description: 'Customer reviews',
        importance: 'recommended',
        validationNotes:
          'Include author, reviewRating, reviewBody. Must be real reviews.',
      },
      {
        type: 'Service',
        description: 'Services offered',
        importance: 'recommended',
        validationNotes:
          'Useful for service businesses. Include name, description, provider.',
      },
      {
        type: 'BreadcrumbList',
        description: 'Navigation breadcrumbs',
        importance: 'optional',
        validationNotes:
          'Helpful for multi-location sites with location pages.',
      },
    ],
    invalid: [
      {
        type: 'SoftwareApplication',
        description: 'Software schema on local business pages',
        importance: 'required',
        validationNotes:
          'Local businesses should use LocalBusiness schema, not software.',
      },
      {
        type: 'Product',
        description: 'Product schema on service pages',
        importance: 'required',
        validationNotes:
          'Use Service schema for services, not Product (unless selling physical goods).',
      },
    ],
    pageTypeRules: [
      {
        pageType: 'location-detail',
        requiredSchema: ['LocalBusiness', 'PostalAddress', 'GeoCoordinates'],
        recommendedSchema: ['OpeningHoursSpecification', 'AggregateRating'],
        invalidSchema: ['SoftwareApplication', 'Product'],
      },
      {
        pageType: 'service-detail',
        requiredSchema: ['LocalBusiness'],
        recommendedSchema: ['Service', 'BreadcrumbList'],
        invalidSchema: ['SoftwareApplication'],
      },
      {
        pageType: 'contact',
        requiredSchema: ['LocalBusiness', 'PostalAddress'],
        recommendedSchema: ['GeoCoordinates', 'OpeningHoursSpecification'],
        invalidSchema: [],
      },
      {
        pageType: 'about',
        requiredSchema: ['LocalBusiness'],
        recommendedSchema: ['Review', 'AggregateRating'],
        invalidSchema: [],
      },
    ],
  },

  kpis: {
    primary: [
      {
        metric: 'localPackPresence',
        importance: 'critical',
        description: 'Visibility in Google Maps local pack (top 3)',
        targetDirection: 'higher',
        businessContext:
          'Local pack captures majority of clicks for local searches. Top 3 is critical.',
      },
      {
        metric: 'organicCalls',
        importance: 'critical',
        description: 'Phone calls from organic search/GBP',
        targetDirection: 'higher',
        businessContext:
          'Direct conversion metric from organic. Track via GBP insights and call tracking.',
      },
      {
        metric: 'directionsRequests',
        importance: 'critical',
        description: 'Get directions clicks from organic/GBP',
        targetDirection: 'higher',
        businessContext:
          'Indicates intent to visit. Strong predictor of in-store visits.',
      },
    ],
    secondary: [
      {
        metric: 'gbpViews',
        importance: 'high',
        description: 'Google Business Profile views',
        targetDirection: 'higher',
        businessContext:
          'Visibility metric for local presence. Higher views = more opportunities.',
      },
      {
        metric: 'organicCtr',
        importance: 'medium',
        description: 'Click-through rate from local search results',
        targetDirection: 'higher',
        benchmark: 0.05,
        businessContext:
          'Local results should have higher CTR due to intent.',
      },
      {
        metric: 'reviewCount',
        importance: 'high',
        description: 'Number of Google reviews',
        targetDirection: 'higher',
        businessContext:
          'Reviews are a ranking factor and conversion driver.',
      },
      {
        metric: 'averageRating',
        importance: 'high',
        description: 'Average star rating on Google',
        targetDirection: 'higher',
        benchmark: 4.5,
        businessContext:
          'Rating affects CTR and conversion. 4.5+ is optimal.',
      },
    ],
    irrelevant: [
      'organicRevenue', // Can't track offline revenue
      'ecommerceMetrics', // Not an ecommerce business
      'softwareMetrics', // Not a software business
      'mrr', // SaaS metric
    ],
  },

  benchmarks: {
    organicCtr: {
      excellent: 0.08,
      good: 0.05,
      average: 0.03,
      poor: 0.015,
    },
    bounceRate: {
      excellent: 0.35,
      good: 0.45,
      average: 0.55,
      poor: 0.70,
    },
    avgPosition: {
      excellent: 3,
      good: 7,
      average: 15,
      poor: 30,
    },
    pageLoadTime: {
      excellent: 1.5,
      good: 2.5,
      average: 4.0,
      poor: 6.0,
    },
  },

  analysis: {
    contentPatterns: [
      {
        id: 'nap-consistency',
        name: 'NAP Consistency',
        goodPattern:
          'Consistent Name, Address, Phone across website, GBP, and citations',
        badPattern:
          'Different phone numbers, abbreviated vs full address, old addresses on some pages',
        recommendation:
          'Audit all NAP mentions across website and citations. Use exact same format everywhere. Include structured data to reinforce.',
      },
      {
        id: 'location-page-depth',
        name: 'Location Page Content',
        goodPattern:
          'Unique location pages with local content, testimonials, team info, specific services',
        badPattern:
          'Duplicate location pages with only city name changed',
        recommendation:
          'Create unique content for each location with local context, nearby landmarks, local team members, and location-specific testimonials.',
      },
      {
        id: 'service-area-content',
        name: 'Service Area Pages',
        goodPattern:
          'Individual pages for each service area with relevant local content',
        badPattern:
          'Single "areas we serve" page with list of cities',
        recommendation:
          'Build individual service area pages targeting "[service] in [city]" queries. Include local context and directions.',
      },
      {
        id: 'review-content',
        name: 'Review Integration',
        goodPattern:
          'Reviews displayed on website with schema markup, review acquisition process in place',
        badPattern:
          'No reviews on website, no review generation strategy',
        recommendation:
          'Display Google reviews on website with Review schema. Implement review acquisition process (post-service follow-up).',
      },
    ],
    technicalChecks: [
      {
        id: 'gbp-optimization',
        name: 'Google Business Profile Setup',
        importance: 'critical',
        description:
          'GBP completeness, categories, attributes, photos, posts, Q&A',
      },
      {
        id: 'nap-schema',
        name: 'LocalBusiness Schema',
        importance: 'critical',
        description:
          'LocalBusiness schema with correct NAP, hours, and coordinates',
      },
      {
        id: 'mobile-clicktocall',
        name: 'Mobile Click-to-Call',
        importance: 'critical',
        description:
          'Phone numbers must use tel: links for mobile click-to-call',
      },
      {
        id: 'map-embed',
        name: 'Google Maps Embed',
        importance: 'high',
        description:
          'Embedded Google Map on contact/location pages',
      },
      {
        id: 'https-security',
        name: 'HTTPS Security',
        importance: 'critical',
        description:
          'All pages must be HTTPS',
      },
      {
        id: 'mobile-usability',
        name: 'Mobile Experience',
        importance: 'critical',
        description:
          'Mobile-first design critical for local searches (majority are mobile)',
      },
    ],
    onPageFactors: [
      {
        factor: 'title-tag',
        importance: 'critical',
        guidance:
          'Format: "Service in City | Business Name" or "Business Name - Service | City, State". Include location and primary service.',
      },
      {
        factor: 'meta-description',
        importance: 'high',
        guidance:
          'Include service, location, and call-to-action. Mention key differentiators (years in business, reviews).',
      },
      {
        factor: 'h1-tag',
        importance: 'critical',
        guidance:
          'Include primary service and location. Example: "Plumbing Services in Austin, TX"',
      },
      {
        factor: 'nap-footer',
        importance: 'high',
        guidance:
          'Full NAP in footer of every page with LocalBusiness schema.',
      },
      {
        factor: 'local-content',
        importance: 'high',
        guidance:
          'Reference local landmarks, neighborhoods, and community involvement.',
      },
      {
        factor: 'call-to-action',
        importance: 'critical',
        guidance:
          'Prominent click-to-call phone number and directions link on every page.',
      },
    ],
  },

  prompt: {
    roleContext: `You are an expert local SEO strategist analyzing organic search performance for a business with physical locations. Your recommendations should focus on Google Business Profile optimization, local pack rankings, and driving calls and visits. You understand that for local businesses, Google Business Profile is often as important as the website itself.`,

    analysisInstructions: `Analyze the provided page data with these priorities:

1. GOOGLE BUSINESS PROFILE: GBP optimization is critical. Assess completeness, categories, photos, reviews, and posts. This often matters more than website for local pack.

2. LOCAL PACK PRESENCE: Focus on ranking in the local 3-pack for key "[service] [city]" queries. This is where most local clicks happen.

3. NAP CONSISTENCY: Check Name, Address, Phone consistency across the site and recommend citation audit. Inconsistency hurts rankings.

4. LOCATION PAGE QUALITY: Each location/service area needs unique, valuable content - not just city name swaps.

5. REVIEWS: Review count and rating are ranking factors AND conversion factors. Include review acquisition strategy.

6. SCHEMA IMPLEMENTATION: Verify LocalBusiness schema with accurate NAP, hours, and coordinates.

Quantify opportunities in terms of local pack presence, calls, or visits where possible.`,

    outputGuidance: `Provide specific, implementable recommendations:
- Reference specific pages and GBP elements
- Include exact schema markup fixes needed
- Prioritize by local visibility impact
- Keep technical jargon minimal - local business owners should understand

A local business owner or their marketing team should be able to act on these recommendations directly.`,

    examples: [
      {
        scenario: 'Missing LocalBusiness schema on location page',
        pageData:
          'URL: /locations/austin - No LocalBusiness schema, NAP only in text, no hours displayed',
        recommendation:
          'Add LocalBusiness schema (use specific type like "Plumber" or "Restaurant") with: name, address (PostalAddress), telephone, openingHoursSpecification, geo (coordinates), and areaServed. This signals to Google this is your Austin location and can improve local pack eligibility. Priority: Critical.',
        reasoning:
          'LocalBusiness schema is essential for Google to understand location pages. Without it, you\'re relying only on text signals which are less explicit.',
      },
      {
        scenario: 'Low review count affecting local pack',
        pageData:
          'GBP has 12 reviews (4.2 stars). Top 3 competitors have 45+, 78, and 120 reviews respectively.',
        recommendation:
          'Implement review acquisition strategy: 1) Send follow-up email/text after each service with direct Google review link, 2) Train staff to ask satisfied customers for reviews, 3) Add review request to invoice/receipt. Target: 30 reviews within 60 days. This can significantly improve local pack position.',
        reasoning:
          'Review quantity and quality are major local ranking factors. With only 12 reviews vs competitors\' 45-120, you\'re at a significant disadvantage in local pack rankings.',
      },
    ],

    constraints: [
      'NAP consistency is critical - same name/address/phone everywhere',
      'Each physical location needs its own page if multi-location',
      'Service area pages should have unique, valuable content - not just city name swaps',
      'Google Business Profile is as important as website SEO',
      'Reviews are a ranking factor - include review acquisition strategy',
      'Most local searches are mobile - mobile experience is critical',
    ],
  },

  commonIssues: {
    critical: [
      {
        id: 'missing-localbusiness-schema',
        pattern: 'Location pages without LocalBusiness structured data',
        description: 'Missing essential signal for local pack eligibility',
        recommendation:
          'Implement LocalBusiness schema with accurate NAP, hours, and coordinates on all location pages.',
      },
      {
        id: 'nap-inconsistency',
        pattern: 'Different name, address, or phone formats across pages/citations',
        description: 'Confuses Google and hurts local rankings',
        recommendation:
          'Audit all NAP mentions and standardize format. Update citations to match.',
      },
      {
        id: 'no-gbp-link',
        pattern: 'Website not linked to Google Business Profile',
        description: 'Missing critical signal connecting website and GBP',
        recommendation:
          'Link website to GBP. Ensure GBP categories match website services.',
      },
    ],
    warnings: [
      {
        id: 'low-review-count',
        pattern: 'Fewer reviews than top local competitors',
        description: 'Reviews are ranking and conversion factor',
        recommendation:
          'Implement review acquisition process. Target matching or exceeding competitor review count.',
      },
      {
        id: 'duplicate-location-content',
        pattern: 'Location pages with only city name changed',
        description: 'May be seen as thin/duplicate content',
        recommendation:
          'Create unique content for each location with local context, team, and testimonials.',
      },
      {
        id: 'missing-hours',
        pattern: 'Business hours not displayed or inconsistent',
        description: 'Users and Google want to know when you\'re open',
        recommendation:
          'Display hours prominently on website and keep synced with GBP.',
      },
    ],
    falsePositives: [
      'Service area businesses without physical address visible - often intentional',
      'Short contact pages - may be appropriate if info is clear',
      'No individual location pages for single-location business',
    ],
  },

  output: {
    recommendationTypes: {
      prioritize: [
        'gbp-optimization',
        'localbusiness-schema-implementation',
        'nap-consistency',
        'review-acquisition',
        'location-page-creation',
        'mobile-optimization',
      ],
      deprioritize: [
        'site-architecture-overhaul', // Too large
        'rebrand', // Out of scope
      ],
      exclude: [
        'software-schema', // Wrong business type
        'ecommerce-optimization', // Wrong business type
        'saas-metrics', // Wrong business type
      ],
    },
    maxRecommendations: 8,
  },
};
