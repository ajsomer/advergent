/**
 * SaaS SEO Skill
 *
 * AI-powered analysis of organic search performance for SaaS businesses.
 * Focuses on product pages, comparison content, documentation, and feature discoverability.
 */

import type { SEOSkillDefinition } from '../types.js';

export const saasSEOSkill: SEOSkillDefinition = {
  version: '1.0.0',

  context: {
    siteType:
      'Software-as-a-Service website with subscription model. Success is measured by organic trial signups, demo requests, and product page visibility.',
    primaryGoal:
      'Drive organic traffic that converts to trials and demos. Optimize feature pages for discovery queries, comparison pages for switching intent, and documentation for support and long-tail traffic.',
    contentStrategy:
      'Product-led content with detailed feature pages, competitor comparisons, integration documentation, and use case content by industry/role. Help documentation can capture significant long-tail traffic.',
  },

  schema: {
    required: [
      {
        type: 'SoftwareApplication',
        description: 'Software product structured data',
        importance: 'required',
        validationNotes:
          'Must include name, applicationCategory, operatingSystem. Include offers for pricing, aggregateRating if reviews exist.',
      },
      {
        type: 'Organization',
        description: 'Company information',
        importance: 'required',
        validationNotes:
          'Include name, logo, contactPoint. Add sameAs for social profiles and review platforms (G2, Capterra).',
      },
    ],
    recommended: [
      {
        type: 'FAQPage',
        description: 'Product FAQs and common questions',
        importance: 'recommended',
        validationNotes:
          'Use for pricing FAQs, feature questions. Can significantly improve CTR.',
      },
      {
        type: 'HowTo',
        description: 'Tutorial and setup content',
        importance: 'recommended',
        validationNotes:
          'Good for onboarding content and feature tutorials. Include steps with descriptions.',
      },
      {
        type: 'Review',
        description: 'Customer reviews (from G2, Capterra, etc.)',
        importance: 'recommended',
        validationNotes:
          'Pull from verified review platforms. Include author, reviewRating, publisher.',
      },
      {
        type: 'VideoObject',
        description: 'Product demos and tutorials',
        importance: 'optional',
        validationNotes:
          'Include for demo videos and tutorials. Can capture video carousel in SERPs.',
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
        description: 'Physical product schema on SaaS pages',
        importance: 'required',
        validationNotes:
          'SaaS should use SoftwareApplication schema, not Product. Product is for physical goods.',
      },
      {
        type: 'LocalBusiness',
        description: 'Local business schema',
        importance: 'required',
        validationNotes:
          'SaaS is not location-based. LocalBusiness is for physical locations.',
      },
      {
        type: 'Offer',
        description: 'Offer schema outside of SoftwareApplication',
        importance: 'required',
        validationNotes:
          'Offers should be nested within SoftwareApplication, not standalone.',
      },
    ],
    pageTypeRules: [
      {
        pageType: 'pricing',
        requiredSchema: ['SoftwareApplication', 'Organization'],
        recommendedSchema: ['FAQPage'],
        invalidSchema: ['Product', 'LocalBusiness'],
      },
      {
        pageType: 'feature',
        requiredSchema: ['SoftwareApplication'],
        recommendedSchema: ['FAQPage', 'HowTo', 'VideoObject'],
        invalidSchema: ['Product', 'LocalBusiness'],
      },
      {
        pageType: 'comparison',
        requiredSchema: ['SoftwareApplication', 'Organization'],
        recommendedSchema: ['FAQPage'],
        invalidSchema: ['Product'],
      },
      {
        pageType: 'documentation',
        requiredSchema: ['Organization'],
        recommendedSchema: ['HowTo', 'FAQPage', 'BreadcrumbList'],
        invalidSchema: ['Product', 'LocalBusiness'],
      },
      {
        pageType: 'integration-detail',
        requiredSchema: ['SoftwareApplication'],
        recommendedSchema: ['HowTo'],
        invalidSchema: ['Product'],
      },
    ],
  },

  kpis: {
    primary: [
      {
        metric: 'organicTrials',
        importance: 'critical',
        description: 'Trial signups attributed to organic search traffic',
        targetDirection: 'higher',
        businessContext:
          'Ultimate success metric. Track trial-to-paid conversion separately.',
      },
      {
        metric: 'productPageVisibility',
        importance: 'critical',
        description: 'Average position of feature/product pages for target keywords',
        targetDirection: 'lower',
        benchmark: 10,
        businessContext:
          'Feature pages should rank on page 1 for their primary keywords.',
      },
      {
        metric: 'organicDemos',
        importance: 'high',
        description: 'Demo requests from organic traffic',
        targetDirection: 'higher',
        businessContext:
          'High-value conversion for enterprise. Track alongside trial volume.',
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
          'Indicates title/description effectiveness. FAQ and review rich results improve CTR.',
      },
      {
        metric: 'comparisonPageRankings',
        importance: 'high',
        description: 'Rankings for competitor comparison keywords',
        targetDirection: 'higher',
        businessContext:
          'Comparison pages capture high-intent switching traffic.',
      },
      {
        metric: 'documentationTraffic',
        importance: 'medium',
        description: 'Organic traffic to help/documentation pages',
        targetDirection: 'higher',
        businessContext:
          'Documentation captures long-tail queries and supports existing users.',
      },
    ],
    irrelevant: [
      'organicRevenue', // Subscription revenue not directly attributed
      'transactionsFromOrganic', // Not a transaction-based model
      'productListings', // No product feeds
      'localPackPresence', // Not location-based
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
      excellent: 0.35,
      good: 0.45,
      average: 0.55,
      poor: 0.70,
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
        id: 'thin-feature-pages',
        name: 'Thin Feature Pages',
        goodPattern:
          'Feature pages with 800+ words, use cases, screenshots, video, comparison to alternatives',
        badPattern:
          'Feature pages under 300 words, generic benefits, no visuals or proof',
        recommendation:
          'Expand feature pages with detailed use cases, screenshots, customer examples, and clear CTAs. Each feature should demonstrate value comprehensively.',
      },
      {
        id: 'missing-comparison-content',
        name: 'Missing Comparison Content',
        goodPattern:
          'Dedicated "[Product] vs [Competitor]" pages with honest comparison, feature tables, and differentiation',
        badPattern:
          'No comparison pages, or biased comparisons that don\'t acknowledge competitor strengths',
        recommendation:
          'Create comparison pages for top 5-10 competitors. Be honest about trade-offs to build trust. Include migration guides.',
      },
      {
        id: 'integration-page-depth',
        name: 'Integration Page Content',
        goodPattern:
          'Integration pages with setup guides, use cases, screenshots, and partner co-branding',
        badPattern:
          'Integration pages that just say "We integrate with X" with no detail',
        recommendation:
          'Build out integration pages with detailed setup instructions, use cases, and benefits. Consider programmatic SEO for scale.',
      },
      {
        id: 'use-case-content',
        name: 'Use Case Content',
        goodPattern:
          'Dedicated pages for each industry/role use case with specific examples and case studies',
        badPattern:
          'Generic "solutions" page without specific targeting',
        recommendation:
          'Create use case pages targeting specific industries (e.g., "[Product] for Marketing Teams") and roles.',
      },
    ],
    technicalChecks: [
      {
        id: 'trial-signup-indexing',
        name: 'Trial Signup Page Handling',
        importance: 'critical',
        description:
          'Trial/signup pages should be indexable and optimized for branded searches',
      },
      {
        id: 'documentation-crawlability',
        name: 'Documentation Crawlability',
        importance: 'high',
        description:
          'Help docs should be crawlable (not behind login) for SEO value and user findability',
      },
      {
        id: 'changelog-indexing',
        name: 'Changelog SEO',
        importance: 'medium',
        description:
          'Product changelog provides freshness signals and captures feature-specific queries',
      },
      {
        id: 'https-security',
        name: 'HTTPS Security',
        importance: 'critical',
        description:
          'All pages must be HTTPS, especially trial signup and login pages',
      },
      {
        id: 'mobile-usability',
        name: 'Mobile Experience',
        importance: 'high',
        description:
          'Mobile experience matters for research phase, though most SaaS conversions are desktop',
      },
      {
        id: 'core-web-vitals',
        name: 'Core Web Vitals',
        importance: 'high',
        description:
          'SPA frameworks may need attention for LCP. Marketing pages should load fast.',
      },
    ],
    onPageFactors: [
      {
        factor: 'title-tag',
        importance: 'critical',
        guidance:
          'Format: "Feature Name - Product Category | Brand" or "Product vs Competitor | Brand". Include primary keyword, keep under 60 characters.',
      },
      {
        factor: 'meta-description',
        importance: 'high',
        guidance:
          'Include key benefit, differentiation, and CTA (free trial, demo). 150-160 characters.',
      },
      {
        factor: 'h1-tag',
        importance: 'critical',
        guidance:
          'One H1 per page matching the primary topic. Should clearly communicate the page purpose.',
      },
      {
        factor: 'internal-linking',
        importance: 'high',
        guidance:
          'Link related features, integrations, and use cases. Create clear paths to trial/demo pages.',
      },
      {
        factor: 'conversion-elements',
        importance: 'critical',
        guidance:
          'Clear trial/demo CTAs on every page. Multiple CTAs without being pushy.',
      },
      {
        factor: 'social-proof',
        importance: 'high',
        guidance:
          'Customer logos, review scores (G2, Capterra), and testimonials on key pages.',
      },
    ],
  },

  prompt: {
    roleContext: `You are an expert SaaS SEO strategist analyzing organic search performance for a subscription software business. Your recommendations should focus on improving product page visibility, comparison content effectiveness, and organic trial/demo generation. You understand that SaaS SEO is about capturing users at different stages of the buying journey - from awareness through to vendor comparison.`,

    analysisInstructions: `Analyze the provided page data with these priorities:

1. FEATURE PAGE OPTIMIZATION: Assess feature pages for content depth, visual elements, and conversion optimization. Each feature should be comprehensively covered.

2. COMPARISON CONTENT: Evaluate competitor comparison page presence and quality. These capture high-intent switching traffic.

3. INTEGRATION PAGES: Check integration page depth and SEO optimization. Integration keywords often have clear product-market fit.

4. DOCUMENTATION SEO: Assess help/docs pages for SEO value. Documentation captures long-tail queries and supports authority.

5. TECHNICAL HEALTH: Check for SPA rendering issues, page speed, and mobile usability.

6. SCHEMA IMPLEMENTATION: Verify SoftwareApplication schema with offers. Check for FAQ opportunities.

Quantify opportunities in terms of potential organic trials or visibility improvements where possible.`,

    outputGuidance: `Provide specific, implementable recommendations:
- Reference specific URLs and pages
- Include exact schema markup fixes needed
- Prioritize by trial/demo generation impact
- Consider content scalability (programmatic SEO for integrations, use cases)

A SaaS marketing team should be able to create action items from these recommendations.`,

    examples: [
      {
        scenario: 'Missing competitor comparison pages',
        pageData:
          'No comparison pages exist. Competitor search volume: "[product] vs [competitor A]" - 800/mo, "[product] vs [competitor B]" - 500/mo',
        recommendation:
          'Create comparison pages for top 3 competitors. Each page should include: feature comparison table, pricing comparison, honest pros/cons, migration guide. Implement SoftwareApplication schema. Potential impact: Capturing 20-30% of 1,300+ monthly comparison searches could drive 50+ qualified visits monthly.',
        reasoning:
          'Users searching for comparisons have clear switching intent. Comparison pages that are honest and thorough build trust and capture high-intent traffic.',
      },
      {
        scenario: 'Thin feature page losing to competitors',
        pageData:
          'URL: /features/reporting - Position 15 for "reporting dashboard software", 180 words, no screenshots, no customer examples',
        recommendation:
          'Expand reporting feature page to 800+ words: include 3-5 screenshot examples, specific use cases by role, customer quote, video walkthrough if available. Implement SoftwareApplication schema. Target: position 8-10 improvement, potential 40% traffic increase.',
        reasoning:
          'Feature pages need depth to rank competitively. Users evaluating software want to see specific capabilities, not generic benefits.',
      },
    ],

    constraints: [
      'NEVER recommend Product schema - use SoftwareApplication for SaaS',
      'Documentation can be powerful for SEO - don\'t neglect help content',
      'Comparison pages must be fair and accurate to avoid reputation issues',
      'Consider programmatic SEO for integration/use case pages at scale',
      'Do not recommend content that would hurt user experience for SEO gains',
      'Remember that trial signup pages need to be indexable for branded searches',
    ],
  },

  commonIssues: {
    critical: [
      {
        id: 'missing-software-schema',
        pattern: 'Product/feature pages without SoftwareApplication structured data',
        description: 'Missing opportunity for rich results and clear signal to Google',
        recommendation:
          'Implement SoftwareApplication schema with name, applicationCategory, operatingSystem. Include offers for pricing.',
      },
      {
        id: 'blocked-documentation',
        pattern: 'Help documentation behind login or blocked from crawling',
        description: 'Losing significant long-tail SEO value from support content',
        recommendation:
          'Make documentation publicly accessible. Implement proper site structure with breadcrumbs.',
      },
      {
        id: 'no-comparison-pages',
        pattern: 'Missing comparison pages for top competitors',
        description: 'Losing high-intent switching traffic to review sites',
        recommendation:
          'Create "[Product] vs [Competitor]" pages for top 5-10 competitors with honest comparisons.',
      },
    ],
    warnings: [
      {
        id: 'thin-feature-content',
        pattern: 'Feature pages under 400 words',
        description: 'Limited ranking potential and poor user experience',
        recommendation:
          'Expand with use cases, screenshots, customer examples, and detailed capabilities.',
      },
      {
        id: 'missing-integration-pages',
        pattern: 'No individual pages for key integrations',
        description: 'Missed opportunity for "[Product] [Integration] integration" searches',
        recommendation:
          'Create integration pages with setup guides and use cases. Consider programmatic approach.',
      },
      {
        id: 'no-use-case-pages',
        pattern: 'No industry or role-specific use case pages',
        description: 'Missing "[Product] for [Industry/Role]" traffic',
        recommendation:
          'Create use case pages targeting specific industries and roles with relevant examples.',
      },
    ],
    falsePositives: [
      'Trial/signup pages with noindex - sometimes intentional for conversion optimization',
      'Short pricing pages - may be appropriate if pricing is simple',
      'Login page not indexed - typically correct',
    ],
  },

  output: {
    recommendationTypes: {
      prioritize: [
        'software-schema-implementation',
        'comparison-content-creation',
        'feature-page-expansion',
        'integration-page-creation',
        'documentation-optimization',
        'use-case-content',
      ],
      deprioritize: [
        'site-architecture-overhaul', // Too large
        'cms-migration', // Out of scope
      ],
      exclude: [
        'product-schema', // Wrong schema type
        'local-seo', // Not applicable
        'shopping-optimization', // Not applicable
      ],
    },
    maxRecommendations: 8,
  },
};
