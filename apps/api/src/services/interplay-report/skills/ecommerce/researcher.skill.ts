/**
 * Ecommerce Researcher Skill
 *
 * The Researcher enriches Scout findings with competitive data and page content.
 * No AI - pure data enrichment and extraction.
 *
 * Ecommerce focus: Product schema, pricing signals, competitor analysis
 */

import type { ResearcherSkillDefinition } from '../types.js';

export const ecommerceResearcherSkill: ResearcherSkillDefinition = {
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
      // Not applicable for ecommerce keyword analysis
      irrelevant: [],
    },
    priorityBoosts: [
      {
        metric: 'impressionShare',
        condition: 'impressionShare < 30 AND conversions > 10',
        boost: 2,
        reason: 'High-converting keyword with significant market share opportunity',
      },
      {
        metric: 'lostImpressionShareBudget',
        condition: 'lostImpressionShareBudget > 40 AND roas > 3',
        boost: 1.5,
        reason: 'Profitable keyword limited by budget',
      },
      {
        metric: 'topOfPageRate',
        condition: 'topOfPageRate < 50 AND isProductQuery',
        boost: 1.3,
        reason: 'Product query not achieving top positions',
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
      // Ecommerce should have these schemas
      lookFor: [
        'Product',
        'Offer',
        'AggregateOffer',
        'AggregateRating',
        'Review',
        'BreadcrumbList',
        'Organization',
        'WebSite',
      ],
      // These schemas indicate potential issues on ecommerce pages
      flagIfPresent: [
        'Article', // Blog schema on product pages
        'NewsArticle', // News schema on product pages
      ],
      // Missing schemas that should exist
      flagIfMissing: [
        'Product', // Product pages must have Product schema
        'BreadcrumbList', // Navigation schema important for ecommerce
      ],
    },

    contentSignals: [
      {
        id: 'price-display',
        name: 'Price Display',
        selector: '[class*="price"], [data-price], .product-price',
        importance: 'critical',
        description: 'Product price visibility',
        businessContext: 'Clear pricing is essential for ecommerce conversion',
      },
      {
        id: 'add-to-cart',
        name: 'Add to Cart Button',
        selector: '[class*="add-to-cart"], [data-action="add-to-cart"], .add-to-cart',
        importance: 'critical',
        description: 'Primary conversion action',
        businessContext: 'Must be prominent and functional',
      },
      {
        id: 'product-images',
        name: 'Product Images',
        selector: '.product-image, .product-gallery, [class*="product-photo"]',
        importance: 'high',
        description: 'Product imagery presence',
        businessContext: 'Visual content critical for purchase decisions',
      },
      {
        id: 'reviews-section',
        name: 'Customer Reviews',
        selector: '.reviews, [class*="review"], .customer-reviews',
        importance: 'high',
        description: 'Social proof presence',
        businessContext: 'Reviews significantly impact conversion rates',
      },
      {
        id: 'stock-status',
        name: 'Stock Availability',
        selector: '[class*="stock"], [class*="availability"], .in-stock',
        importance: 'medium',
        description: 'Inventory status display',
        businessContext: 'Reduces abandonment from uncertainty',
      },
      {
        id: 'shipping-info',
        name: 'Shipping Information',
        selector: '[class*="shipping"], [class*="delivery"], .shipping-info',
        importance: 'medium',
        description: 'Delivery information visibility',
        businessContext: 'Shipping clarity reduces cart abandonment',
      },
    ],

    pageClassification: {
      patterns: [
        {
          pattern: '/product/|/p/|/item/|/shop/.+/.+',
          pageType: 'product',
          description: 'Product detail page',
          confidence: 0.9,
        },
        {
          pattern: '/category/|/c/|/collection/|/shop/?$',
          pageType: 'category',
          description: 'Category or collection page',
          confidence: 0.85,
        },
        {
          pattern: '/cart|/basket|/shopping-cart',
          pageType: 'cart',
          description: 'Shopping cart page',
          confidence: 0.95,
        },
        {
          pattern: '/checkout|/order|/payment',
          pageType: 'checkout',
          description: 'Checkout flow page',
          confidence: 0.95,
        },
        {
          pattern: '/search|/results|\\?q=|\\?search=',
          pageType: 'search',
          description: 'Search results page',
          confidence: 0.9,
        },
        {
          pattern: '/brand/|/brands/',
          pageType: 'brand',
          description: 'Brand landing page',
          confidence: 0.85,
        },
        {
          pattern: '/sale|/clearance|/deals|/offers',
          pageType: 'promotion',
          description: 'Promotional landing page',
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
