/**
 * Lead-Gen SEO Skill
 *
 * AI-powered analysis of organic search performance for lead generation businesses.
 * Focuses on service page optimization, E-E-A-T signals, and local visibility.
 */

import type { SEOSkillDefinition } from '../types.js';

export const leadGenSEOSkill: SEOSkillDefinition = {
  version: '1.0.0',

  context: {
    siteType:
      'Service business website focused on lead generation through form submissions and phone calls. Success is measured by organic lead volume and service page visibility.',
    primaryGoal:
      'Drive organic traffic that converts to leads. Optimize service pages for discovery queries and build trust through content that demonstrates expertise.',
    contentStrategy:
      'Service-focused content with detailed descriptions of offerings, process explanations, and trust signals. Educational content (guides, FAQs) captures research-phase traffic. Case studies and testimonials build credibility.',
  },

  schema: {
    required: [
      {
        type: 'Service',
        description: 'Service structured data with provider and area served',
        importance: 'required',
        validationNotes:
          'Must include name, description, provider (Organization). Include serviceType and areaServed when applicable.',
      },
      {
        type: 'Organization',
        description: 'Business information and contact details',
        importance: 'required',
        validationNotes:
          'Include name, logo, contactPoint with phone/email. Add sameAs for social profiles.',
      },
    ],
    recommended: [
      {
        type: 'FAQPage',
        description: 'Service FAQs for rich results',
        importance: 'recommended',
        validationNotes:
          'Use for actual customer questions. Can significantly improve CTR in SERPs.',
      },
      {
        type: 'Review',
        description: 'Customer testimonials and reviews',
        importance: 'recommended',
        validationNotes:
          'Include author, reviewRating, reviewBody. Must be real reviews.',
      },
      {
        type: 'LocalBusiness',
        description: 'For businesses serving specific geographic areas',
        importance: 'recommended',
        validationNotes:
          'Use specific subtype (Plumber, Attorney, etc.) Include address, phone, hours.',
      },
      {
        type: 'HowTo',
        description: 'Process explanations and guides',
        importance: 'optional',
        validationNotes:
          'Good for educational content. Include steps with descriptions.',
      },
      {
        type: 'BreadcrumbList',
        description: 'Navigation breadcrumb trail',
        importance: 'recommended',
        validationNotes:
          'Helps users and search engines understand site structure.',
      },
    ],
    invalid: [
      {
        type: 'Product',
        description: 'Product schema on service pages',
        importance: 'required',
        validationNotes:
          'Service businesses should use Service schema, not Product. Product is for ecommerce.',
      },
      {
        type: 'Offer',
        description: 'Offer schema for services',
        importance: 'required',
        validationNotes:
          'Offer schema is for products with fixed prices. Services use Service schema.',
      },
      {
        type: 'AggregateOffer',
        description: 'Multiple offers schema',
        importance: 'required',
        validationNotes:
          'Not applicable for service businesses - this is for product variants.',
      },
    ],
    pageTypeRules: [
      {
        pageType: 'service',
        requiredSchema: ['Service', 'Organization'],
        recommendedSchema: ['FAQPage', 'BreadcrumbList'],
        invalidSchema: ['Product', 'Offer', 'AggregateOffer'],
      },
      {
        pageType: 'contact',
        requiredSchema: ['Organization'],
        recommendedSchema: ['LocalBusiness', 'ContactPoint'],
        invalidSchema: ['Product', 'Article'],
      },
      {
        pageType: 'about',
        requiredSchema: ['Organization'],
        recommendedSchema: ['Person', 'Review'],
        invalidSchema: ['Product', 'Service'],
      },
      {
        pageType: 'location',
        requiredSchema: ['LocalBusiness'],
        recommendedSchema: ['Service', 'GeoCoordinates'],
        invalidSchema: ['Product'],
      },
    ],
  },

  kpis: {
    primary: [
      {
        metric: 'organicLeads',
        importance: 'critical',
        description: 'Leads attributed to organic search traffic',
        targetDirection: 'higher',
        businessContext:
          'Ultimate success metric. Track form submissions and calls from organic traffic.',
      },
      {
        metric: 'servicePageVisibility',
        importance: 'critical',
        description: 'Average position of service pages for target keywords',
        targetDirection: 'lower',
        benchmark: 10,
        businessContext:
          'Service pages should rank on page 1 for their primary service keywords.',
      },
      {
        metric: 'organicConversionRate',
        importance: 'critical',
        description: 'Lead conversion rate from organic traffic',
        targetDirection: 'higher',
        benchmark: 0.03,
        businessContext:
          'Indicates landing page effectiveness and traffic quality.',
      },
    ],
    secondary: [
      {
        metric: 'organicCtr',
        importance: 'high',
        description: 'Click-through rate from search results',
        targetDirection: 'higher',
        benchmark: 0.04,
        businessContext:
          'Indicates title/description effectiveness. FAQ rich results can significantly improve CTR.',
      },
      {
        metric: 'localPackPresence',
        importance: 'high',
        description: 'Visibility in Google Maps local pack results',
        targetDirection: 'higher',
        businessContext:
          'Local pack often captures high-intent local service queries.',
      },
      {
        metric: 'brandSearchVolume',
        importance: 'medium',
        description: 'Branded search query volume',
        targetDirection: 'higher',
        businessContext:
          'Indicates brand awareness and word-of-mouth referrals.',
      },
    ],
    irrelevant: [
      'organicRevenue', // No direct revenue tracking
      'transactionsFromOrganic', // Not a transactional site
      'productPageRankings', // No product pages
      'shoppingVisibility', // No product listings
    ],
  },

  benchmarks: {
    organicCtr: {
      excellent: 0.06,
      good: 0.04,
      average: 0.025,
      poor: 0.015,
    },
    bounceRate: {
      excellent: 0.40,
      good: 0.50,
      average: 0.60,
      poor: 0.75,
    },
    avgPosition: {
      excellent: 5,
      good: 10,
      average: 20,
      poor: 40,
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
        id: 'thin-service-content',
        name: 'Thin Service Descriptions',
        goodPattern:
          'Service pages with 500+ words, unique content, process explanation, benefits, FAQs',
        badPattern:
          'Service pages under 200 words, generic descriptions, no differentiation',
        recommendation:
          'Expand service pages with detailed process explanations, benefits, FAQs, and case studies. Each service should have unique, comprehensive content.',
      },
      {
        id: 'missing-trust-signals',
        name: 'Missing Trust Signals',
        goodPattern:
          'Pages with testimonials, certifications, awards, case studies, team credentials',
        badPattern:
          'Service pages with no social proof, missing credentials, no case studies',
        recommendation:
          'Add customer testimonials with names/photos, display certifications and awards, include relevant case studies on service pages.',
      },
      {
        id: 'poor-local-content',
        name: 'Weak Location Content',
        goodPattern:
          'Location pages with unique local content, local testimonials, area-specific information',
        badPattern:
          'Duplicate location pages with only city name changed, no local context',
        recommendation:
          'Create unique content for each service area with local landmarks, specific services offered, and testimonials from local customers.',
      },
      {
        id: 'missing-faq-content',
        name: 'Missing FAQ Content',
        goodPattern:
          'Comprehensive FAQs addressing common customer questions, using Service and FAQ schema',
        badPattern:
          'No FAQ section, or FAQs that don\'t match actual customer questions',
        recommendation:
          'Add FAQ sections to service pages with questions from actual customer inquiries. Implement FAQPage schema for rich results.',
      },
    ],
    technicalChecks: [
      {
        id: 'contact-form-accessibility',
        name: 'Contact Form Accessibility',
        importance: 'critical',
        description:
          'Contact forms must be accessible, functional on mobile, and fast to submit',
      },
      {
        id: 'phone-number-markup',
        name: 'Phone Number Click-to-Call',
        importance: 'critical',
        description:
          'Phone numbers should use tel: links for mobile click-to-call functionality',
      },
      {
        id: 'local-seo-signals',
        name: 'Local SEO Implementation',
        importance: 'high',
        description:
          'NAP consistency, Google Business Profile optimization, local schema markup',
      },
      {
        id: 'https-security',
        name: 'HTTPS Security',
        importance: 'critical',
        description:
          'All pages must be HTTPS, especially contact forms handling user data',
      },
      {
        id: 'mobile-usability',
        name: 'Mobile Experience',
        importance: 'critical',
        description:
          'Mobile-first design with easy-to-use forms and click-to-call buttons',
      },
      {
        id: 'core-web-vitals',
        name: 'Core Web Vitals',
        importance: 'high',
        description:
          'LCP, FID, CLS scores impact rankings and user experience',
      },
    ],
    onPageFactors: [
      {
        factor: 'title-tag',
        importance: 'critical',
        guidance:
          'Format: "Service Name in [Location] | Company Name" or "Service Name - Key Benefit | Company". Include primary service keyword and location if local.',
      },
      {
        factor: 'meta-description',
        importance: 'high',
        guidance:
          'Include service benefits, location served, and call-to-action. 150-160 characters. Make it compelling to click.',
      },
      {
        factor: 'h1-tag',
        importance: 'critical',
        guidance:
          'One H1 per page matching the primary service. Include location for local services. Should clearly communicate the service offered.',
      },
      {
        factor: 'internal-linking',
        importance: 'high',
        guidance:
          'Link related services, location pages, and case studies. Create clear paths to contact/quote pages from all service content.',
      },
      {
        factor: 'trust-elements',
        importance: 'high',
        guidance:
          'Include testimonials, certifications, awards, and years in business on key service pages.',
      },
      {
        factor: 'call-to-action',
        importance: 'critical',
        guidance:
          'Clear CTAs for contact, quote request, or consultation. Multiple CTAs per page, including header/footer.',
      },
    ],
  },

  prompt: {
    roleContext: `You are an expert lead generation SEO strategist analyzing organic search performance for a service business. Your recommendations should focus on improving service page visibility and organic lead generation. You understand E-E-A-T (Experience, Expertise, Authority, Trust) principles and how they apply to service businesses where trust is essential for conversion.`,

    analysisInstructions: `Analyze the provided page data with these priorities:

1. SERVICE PAGE OPTIMIZATION: Assess service pages for content depth, E-E-A-T signals, and conversion elements. Service pages should demonstrate expertise and make it easy to contact.

2. LOCAL SEO (if applicable): Evaluate local visibility, NAP consistency, Google Business Profile optimization, and location page quality.

3. TRUST SIGNALS: Check for testimonials, certifications, case studies, and credentials. These are critical for service businesses.

4. TECHNICAL HEALTH: Check for mobile usability, form functionality, phone click-to-call, and page speed.

5. SCHEMA IMPLEMENTATION: Verify Service and Organization schema. Check for FAQ schema opportunities.

6. CONTENT GAPS: Identify service queries where competitors outrank despite relevant offerings.

Quantify opportunities in terms of potential organic leads or visibility improvements where possible.`,

    outputGuidance: `Provide specific, implementable recommendations:
- Reference specific URLs and pages
- Include exact schema markup fixes needed
- Prioritize by lead generation impact
- Consider implementation complexity

A service business marketing team should be able to create action items from these recommendations.`,

    examples: [
      {
        scenario: 'Service page missing trust signals',
        pageData:
          'URL: /services/commercial-plumbing - Position 12 for "commercial plumber [city]", No reviews, No certifications displayed, 180 word description',
        recommendation:
          'Add trust signals to commercial plumbing page: display contractor license number, include 2-3 customer testimonials with company names, add certifications (bonded/insured badges). Expand content to 500+ words covering commercial specialties, response times, and service process. Implement Service schema. Potential impact: Moving to page 1 could generate 5-10 additional leads monthly.',
        reasoning:
          'Commercial services require strong trust signals. B2B buyers verify credentials before contacting. Thin content and missing trust elements are likely causing lower rankings and poor conversion.',
      },
      {
        scenario: 'Missing FAQ rich results opportunity',
        pageData:
          'URL: /services/roof-repair - Position 7 for "roof repair", Good content but no FAQ section, competitors showing FAQ rich results',
        recommendation:
          'Add FAQ section addressing: "How much does roof repair cost?", "How long does roof repair take?", "Do you offer emergency roof repair?", "What are signs I need roof repair?" Implement FAQPage schema. Potential impact: FAQ rich results typically improve CTR by 20-30%, which at current position could mean 50+ additional clicks monthly.',
        reasoning:
          'FAQ rich results significantly increase SERP real estate and CTR. Answering common questions also improves page relevance and can help with featured snippet capture.',
      },
    ],

    constraints: [
      'NEVER recommend Product schema - this is a service business, use Service schema',
      'Focus on E-E-A-T signals (Experience, Expertise, Authority, Trust)',
      'Service pages should demonstrate expertise, not just list offerings',
      'Consider lead capture optimization alongside SEO improvements',
      'Do not recommend content that would hurt user experience for SEO gains',
      'For local businesses, ensure Google Business Profile recommendations are included',
    ],
  },

  commonIssues: {
    critical: [
      {
        id: 'missing-service-schema',
        pattern: 'Service pages without Service structured data',
        description: 'Missing opportunity for rich results and clear signal to Google about page purpose',
        recommendation:
          'Implement Service schema with required properties: name, description, provider. Include serviceType and areaServed.',
      },
      {
        id: 'broken-contact-forms',
        pattern: 'Contact forms with submission errors or poor mobile experience',
        description: 'Directly prevents lead capture - critical business impact',
        recommendation:
          'Audit all contact forms for functionality, mobile usability, and submission confirmation. Test regularly.',
      },
      {
        id: 'missing-phone-clicktocall',
        pattern: 'Phone numbers not using tel: links',
        description: 'Mobile users cannot easily call, reducing phone lead conversions',
        recommendation:
          'Wrap all phone numbers in <a href="tel:+1XXXXXXXXXX"> for click-to-call functionality.',
      },
    ],
    warnings: [
      {
        id: 'thin-service-content',
        pattern: 'Service pages under 300 words',
        description: 'Limited ranking potential and poor user experience for important decisions',
        recommendation:
          'Expand with process explanation, benefits, FAQs, and case studies.',
      },
      {
        id: 'missing-testimonials',
        pattern: 'Service pages without customer testimonials',
        description: 'Missing critical trust signal for service businesses',
        recommendation:
          'Add 2-3 relevant testimonials with customer name and context.',
      },
      {
        id: 'duplicate-location-pages',
        pattern: 'Location pages with only city name differences',
        description: 'May be seen as thin/duplicate content, reduces ranking potential',
        recommendation:
          'Create unique content for each location with local context and testimonials.',
      },
    ],
    falsePositives: [
      'Short pages for simple services - may be appropriate if comprehensive',
      'No LocalBusiness schema for national services - not always needed',
      'Missing FAQPage on pages with few common questions',
    ],
  },

  output: {
    recommendationTypes: {
      prioritize: [
        'service-schema-implementation',
        'trust-signal-addition',
        'content-expansion',
        'local-seo-optimization',
        'conversion-element-improvement',
        'faq-implementation',
      ],
      deprioritize: [
        'site-architecture-overhaul', // Too large for quick wins
        'cms-migration', // Out of scope
      ],
      exclude: [
        'product-schema', // Wrong business type
        'ecommerce-recommendations', // Not applicable
        'shopping-feed-optimization', // Not applicable
      ],
    },
    maxRecommendations: 8,
  },
};
