/**
 * Ecommerce SEO Skill
 *
 * AI-powered analysis of organic search performance for ecommerce businesses.
 * Focuses on product page optimization, category architecture, and schema markup.
 */

import type { SEOSkillDefinition } from '../types.js';

export const ecommerceSEOSkill: SEOSkillDefinition = {
  version: '1.0.0',

  context: {
    siteType:
      'Ecommerce website with product catalog, category pages, and transactional intent. Success is measured by organic revenue, product page visibility, and category rankings.',
    primaryGoal:
      'Drive organic traffic that converts to purchases. Optimize product pages for transactional queries and category pages for broader discovery.',
    contentStrategy:
      'Product-focused content with detailed descriptions, specifications, and user reviews. Category pages serve as landing pages for broader queries. Supporting content (guides, comparisons) captures research-phase traffic.',
  },

  schema: {
    required: [
      {
        type: 'Product',
        description: 'Product structured data with price, availability, reviews',
        importance: 'required',
        validationNotes:
          'Must include name, image, price, priceCurrency, availability. SKU and brand recommended.',
      },
      {
        type: 'BreadcrumbList',
        description: 'Navigation breadcrumb trail',
        importance: 'required',
        validationNotes:
          'Should reflect actual site hierarchy. Include on all product and category pages.',
      },
      {
        type: 'Organization',
        description: 'Company/brand information',
        importance: 'required',
        validationNotes: 'Include on homepage. Should have logo, name, and contact info.',
      },
    ],
    recommended: [
      {
        type: 'AggregateRating',
        description: 'Average product rating from reviews',
        importance: 'recommended',
        validationNotes:
          'Include within Product schema. Requires actual reviews - do not fake.',
      },
      {
        type: 'Review',
        description: 'Individual product reviews',
        importance: 'recommended',
        validationNotes: 'Can include multiple reviews within Product schema.',
      },
      {
        type: 'Offer',
        description: 'Product offer/pricing details',
        importance: 'recommended',
        validationNotes: 'Nested within Product. Include price, availability, condition.',
      },
      {
        type: 'FAQPage',
        description: 'Product or category FAQ',
        importance: 'optional',
        validationNotes: 'Use for product Q&A sections. Do not fabricate questions.',
      },
      {
        type: 'WebSite',
        description: 'Sitewide search action',
        importance: 'optional',
        validationNotes: 'Enables sitelinks search box in SERPs.',
      },
    ],
    invalid: [
      {
        type: 'Article',
        description: 'Article schema on product pages',
        importance: 'required',
        validationNotes:
          'Product pages should use Product schema, not Article. Articles are for blog content.',
      },
      {
        type: 'LocalBusiness',
        description: 'Local business schema on product pages',
        importance: 'required',
        validationNotes:
          'LocalBusiness is for location-based businesses. Use Organization for ecommerce.',
      },
    ],
    pageTypeRules: [
      {
        pageType: 'product',
        requiredSchema: ['Product', 'BreadcrumbList'],
        recommendedSchema: ['AggregateRating', 'Review', 'Offer'],
        invalidSchema: ['Article', 'LocalBusiness', 'NewsArticle'],
      },
      {
        pageType: 'category',
        requiredSchema: ['BreadcrumbList'],
        recommendedSchema: ['ItemList', 'CollectionPage'],
        invalidSchema: ['Product', 'Article'],
      },
      {
        pageType: 'homepage',
        requiredSchema: ['Organization', 'WebSite'],
        recommendedSchema: ['BreadcrumbList'],
        invalidSchema: ['Product', 'Article'],
      },
    ],
  },

  kpis: {
    primary: [
      {
        metric: 'organicRevenue',
        importance: 'critical',
        description: 'Revenue attributed to organic search traffic',
        targetDirection: 'higher',
        businessContext:
          'Ultimate success metric. Track via GA4 with proper attribution.',
      },
      {
        metric: 'organicTransactions',
        importance: 'critical',
        description: 'Number of purchases from organic search',
        targetDirection: 'higher',
        businessContext: 'Volume counterpart to revenue. Monitor conversion rate.',
      },
      {
        metric: 'productPageVisibility',
        importance: 'critical',
        description: 'Average position of product pages for target keywords',
        targetDirection: 'lower',
        benchmark: 10,
        businessContext:
          'Product pages should rank on page 1 for their primary keywords.',
      },
    ],
    secondary: [
      {
        metric: 'organicCtr',
        importance: 'high',
        description: 'Click-through rate from search results',
        targetDirection: 'higher',
        benchmark: 0.03,
        businessContext:
          'Indicates title/description effectiveness. Rich results improve CTR.',
      },
      {
        metric: 'indexedProductPages',
        importance: 'high',
        description: 'Number of product pages in Google index',
        targetDirection: 'higher',
        businessContext:
          'All in-stock products should be indexed. Monitor for crawl issues.',
      },
      {
        metric: 'categoryRankings',
        importance: 'medium',
        description: 'Rankings for category-level keywords',
        targetDirection: 'higher',
        businessContext:
          'Category pages capture broader discovery queries. Important for brand awareness.',
      },
    ],
    irrelevant: [
      'leadGeneration', // Not applicable to ecommerce
      'formSubmissions', // Not a primary metric
      'phoneCallsFromSearch', // Local metric
    ],
  },

  benchmarks: {
    organicCtr: {
      excellent: 0.05,
      good: 0.03,
      average: 0.02,
      poor: 0.01,
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
      poor: 35,
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
        id: 'thin-product-content',
        name: 'Thin Product Descriptions',
        goodPattern:
          'Product descriptions with 200+ words, unique content, specifications, use cases',
        badPattern:
          'Manufacturer descriptions only, under 100 words, duplicate across variants',
        recommendation:
          'Expand product descriptions with unique value propositions, detailed specifications, and customer-focused benefits.',
      },
      {
        id: 'missing-category-content',
        name: 'Category Page Content Gap',
        goodPattern:
          'Category pages with intro content, buying guides, filter explanations',
        badPattern: 'Category pages with only product listings, no contextual content',
        recommendation:
          'Add 150-300 words of category-relevant content above or below product listings.',
      },
      {
        id: 'image-optimization',
        name: 'Product Image SEO',
        goodPattern:
          'Descriptive filenames, alt text with product name, compressed images, multiple angles',
        badPattern:
          'Generic filenames (IMG_001.jpg), missing alt text, uncompressed images',
        recommendation:
          'Rename images with descriptive keywords, add alt text, implement lazy loading.',
      },
    ],
    technicalChecks: [
      {
        id: 'faceted-navigation',
        name: 'Faceted Navigation Control',
        importance: 'critical',
        description:
          'Filter combinations creating duplicate/thin pages that dilute crawl budget',
      },
      {
        id: 'canonical-tags',
        name: 'Canonical Implementation',
        importance: 'critical',
        description:
          'Product variants, sorted views, and filtered pages need proper canonicals',
      },
      {
        id: 'pagination',
        name: 'Pagination Handling',
        importance: 'high',
        description:
          'Category pagination should be crawlable, not infinite scroll without fallback',
      },
      {
        id: 'https-migration',
        name: 'HTTPS Security',
        importance: 'critical',
        description: 'All pages must be HTTPS, especially checkout flow',
      },
      {
        id: 'mobile-usability',
        name: 'Mobile Experience',
        importance: 'critical',
        description:
          'Mobile-first indexing requires excellent mobile product page experience',
      },
      {
        id: 'core-web-vitals',
        name: 'Core Web Vitals',
        importance: 'high',
        description: 'LCP, FID, CLS scores impact rankings and user experience',
      },
    ],
    onPageFactors: [
      {
        factor: 'title-tag',
        importance: 'critical',
        guidance:
          'Format: "Product Name - Category | Brand" or "Product Name | Key Feature | Brand". Include primary keyword, keep under 60 characters.',
      },
      {
        factor: 'meta-description',
        importance: 'high',
        guidance:
          'Include price, key features, and call-to-action. 150-160 characters. Make it compelling to click.',
      },
      {
        factor: 'h1-tag',
        importance: 'critical',
        guidance:
          'One H1 per page, should be the product name. Include primary keyword naturally.',
      },
      {
        factor: 'internal-linking',
        importance: 'high',
        guidance:
          'Link related products, category breadcrumbs, and cross-sell opportunities.',
      },
      {
        factor: 'url-structure',
        importance: 'medium',
        guidance:
          'Clean URLs: /category/subcategory/product-name. Avoid parameters in indexed URLs.',
      },
    ],
  },

  prompt: {
    roleContext: `You are an expert ecommerce SEO strategist analyzing organic search performance for an online retail website. Your recommendations should focus on improving product page visibility, category rankings, and organic revenue. You understand the unique challenges of ecommerce SEO including faceted navigation, product schema, and large-scale content optimization.`,

    analysisInstructions: `Analyze the provided page data with these priorities:

1. PRODUCT PAGE OPTIMIZATION: Assess product pages for content quality, schema markup, and on-page SEO factors. Identify pages with thin content or missing structured data.

2. CATEGORY ARCHITECTURE: Evaluate category page structure, internal linking, and content. Categories are key landing pages for discovery queries.

3. TECHNICAL HEALTH: Check for crawlability issues, duplicate content from filters/sorting, canonical implementation, and Core Web Vitals.

4. SCHEMA IMPLEMENTATION: Verify Product schema with required properties. Check for rich result eligibility.

5. COMPETITIVE GAPS: Identify queries where competitors outrank despite having relevant products. Look for content or authority gaps.

Quantify opportunities in terms of potential traffic or revenue impact where possible.`,

    outputGuidance: `Provide specific, implementable recommendations:
- Reference specific URLs and pages
- Include exact schema markup fixes needed
- Prioritize by traffic/revenue impact
- Consider implementation complexity

An ecommerce SEO team should be able to create tickets from these recommendations.`,

    examples: [
      {
        scenario: 'Product page missing rich results',
        pageData:
          'URL: /products/wireless-earbuds-pro - Position 8 for "wireless earbuds", No Product schema, 85 word description',
        recommendation:
          'Implement Product schema with price ($79.99), availability (InStock), and aggregateRating (4.5/5 from 230 reviews). Expand product description to 200+ words with unique features. Potential impact: Rich result could improve CTR by 30%, driving ~150 additional monthly clicks.',
        reasoning:
          'Product schema enables rich results showing price, availability, and ratings directly in SERPs. The thin description also limits ranking potential for long-tail queries.',
      },
      {
        scenario: 'Category page with thin content',
        pageData:
          'URL: /category/headphones - Position 15 for "headphones", 0 words above fold, 45 products listed',
        recommendation:
          'Add 200-300 word intro covering headphone types, key features to consider, and buying guidance. Include internal links to subcategories (wireless, noise-canceling, gaming). Target: position 8-10 improvement.',
        reasoning:
          'Category pages with contextual content outrank pure product listing pages. Content helps Google understand topic relevance and improves user experience.',
      },
    ],

    constraints: [
      'Product schema must accurately reflect actual product data - never recommend faking reviews or ratings',
      'Consider crawl budget implications for large catalogs',
      'Faceted navigation recommendations must balance UX and SEO',
      'Do not recommend content that would hurt user experience for SEO gains',
      'Account for product availability - out of stock pages need different handling',
    ],
  },

  commonIssues: {
    critical: [
      {
        id: 'missing-product-schema',
        pattern: 'Product pages without Product structured data',
        description: 'Prevents rich results and reduces click-through rate',
        recommendation:
          'Implement Product schema with required properties: name, image, price, priceCurrency, availability',
      },
      {
        id: 'duplicate-content-filters',
        pattern: 'Multiple URLs for same content via filter parameters',
        description: 'Dilutes page authority and wastes crawl budget',
        recommendation:
          'Implement canonical tags, use robots noindex for filter combinations, or parameter handling in GSC',
      },
      {
        id: 'orphaned-products',
        pattern: 'Product pages not linked from category navigation',
        description: 'Pages may not be discovered by crawlers',
        recommendation: 'Ensure all products are accessible via category navigation and XML sitemap',
      },
    ],
    warnings: [
      {
        id: 'thin-product-descriptions',
        pattern: 'Product descriptions under 100 words',
        description: 'Limited ranking potential and poor user experience',
        recommendation:
          'Expand with unique content, specifications, use cases, and benefits',
      },
      {
        id: 'missing-alt-text',
        pattern: 'Product images without alt attributes',
        description: 'Missed image search opportunity and accessibility issue',
        recommendation: 'Add descriptive alt text including product name and key attributes',
      },
      {
        id: 'slow-page-speed',
        pattern: 'Product pages with LCP > 2.5s',
        description: 'Core Web Vitals impact rankings and conversions',
        recommendation:
          'Optimize images, implement lazy loading, reduce JavaScript blocking',
      },
    ],
    falsePositives: [
      'Out of stock products with noindex - this is often intentional',
      'Product variants on same URL - may be valid UX choice',
      'Short descriptions for simple products - context dependent',
    ],
  },

  output: {
    recommendationTypes: {
      prioritize: [
        'schema-implementation',
        'content-expansion',
        'technical-fixes',
        'internal-linking',
        'page-speed',
      ],
      deprioritize: [
        'site-architecture-overhaul', // Too large for quick wins
        'cms-migration', // Out of scope
      ],
      exclude: [
        'link-building-tactics', // Separate discipline
        'ppc-recommendations', // Wrong channel
      ],
    },
    maxRecommendations: 8,
  },
};
