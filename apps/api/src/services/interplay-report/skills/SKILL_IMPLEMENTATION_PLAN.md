# Skill Bundle Implementation Plan

This document provides a comprehensive guide for implementing the remaining skill bundles (lead-gen, SaaS, local) following the pattern established by the ecommerce bundle.

## Overview

### Completed
- **Ecommerce** (`skills/ecommerce/`) - Full implementation with 5 skill files + index

### To Implement
1. **Lead-Gen** (`skills/lead-gen/`) - Service businesses focused on lead generation
2. **SaaS** (`skills/saas/`) - Software-as-a-service subscription businesses
3. **Local** (`skills/local/`) - Local businesses with physical locations

## File Structure

Each business type folder should contain:
```
skills/{business-type}/
├── scout.skill.ts        # Data triage thresholds and priority rules
├── researcher.skill.ts   # Data enrichment and content signals
├── sem.skill.ts          # Paid search analysis (AI-powered)
├── seo.skill.ts          # Organic search analysis (AI-powered)
├── director.skill.ts     # Synthesis and prioritization
└── index.ts              # Bundle export
```

## Reference Implementation

Use `skills/ecommerce/` as the template. Each file follows the type definitions in `skills/types.ts`.

---

## Lead-Gen Skill Bundle

### Business Context
Lead generation businesses (agencies, B2B services, professional services, home services) convert visitors into leads (form submissions, phone calls, consultations) rather than direct purchases.

### Key Differences from Ecommerce

| Aspect | Ecommerce | Lead-Gen |
|--------|-----------|----------|
| Primary KPI | ROAS, Revenue | Cost per Lead (CPL), Lead Volume |
| Conversion | Purchase | Form submission, phone call |
| Value tracking | Transaction value | Lead value (often estimated) |
| Schema | Product, Offer | Service, ProfessionalService, LocalBusiness |
| Content focus | Product pages | Service pages, landing pages |

### Scout Skill (`lead-gen/scout.skill.ts`)

```typescript
thresholds: {
  highSpendThreshold: 300,      // Lower than ecommerce - leads are cheaper
  lowRoasThreshold: null,       // NOT APPLICABLE - use CPL instead
  lowCplThreshold: 150,         // NEW: Cost per lead threshold
  cannibalizationPosition: 5,
  highBounceRateThreshold: 70,
  lowCtrThreshold: 2.0,
  minImpressionsForAnalysis: 50, // Lower threshold - less volume
}

metrics: {
  include: ['spend', 'conversions', 'cpl', 'ctr', 'impressions', 'position', 'conversionRate'],
  exclude: ['roas', 'revenue', 'aov', 'conversionValue'], // CRITICAL: Exclude ecommerce metrics
  primary: ['cpl', 'conversions', 'conversionRate'],
}
```

**Priority Rules to Include:**
- `high-spend-low-conversions`: Keywords spending but not generating leads
- `high-cpl-keywords`: Leads costing more than target CPL
- `brand-efficiency`: Brand terms that could rely on organic
- `competitor-keywords`: Targeting competitor brand names
- `service-area-mismatch`: Targeting outside service area

### Researcher Skill (`lead-gen/researcher.skill.ts`)

**Schema Extraction:**
```typescript
schemaExtraction: {
  lookFor: ['Service', 'ProfessionalService', 'Organization', 'LocalBusiness', 'FAQPage'],
  flagIfPresent: ['Product', 'Offer', 'AggregateOffer'], // Ecommerce schemas = wrong
  flagIfMissing: ['Service', 'Organization'],
}
```

**Content Signals:**
- Contact form presence (critical)
- Phone number visibility (critical)
- Trust signals (certifications, awards, testimonials)
- Service area information
- Pricing/quote request CTAs

**Page Classification Patterns:**
- `/services/`, `/our-services/` → service page
- `/contact`, `/get-quote`, `/free-consultation` → conversion page
- `/about`, `/team`, `/why-us` → trust page
- `/locations/`, `/areas-served/` → location page

### SEM Skill (`lead-gen/sem.skill.ts`)

**KPIs:**
```typescript
kpis: {
  primary: [
    { metric: 'cpl', importance: 'critical', targetDirection: 'lower', benchmark: 75 },
    { metric: 'conversions', importance: 'critical', targetDirection: 'higher' },
    { metric: 'conversionRate', importance: 'high', targetDirection: 'higher', benchmark: 0.05 },
  ],
  secondary: [
    { metric: 'ctr', importance: 'medium' },
    { metric: 'impressionShare', importance: 'medium' },
    { metric: 'qualityScore', importance: 'medium' },
  ],
  irrelevant: ['roas', 'revenue', 'aov', 'conversionValue', 'transactionId'],
}
```

**Prompt Context:**
```typescript
context: {
  businessModel: 'Service business generating leads through form submissions and phone calls. Success is measured by lead volume and cost efficiency, not direct revenue.',
  conversionDefinition: 'A conversion is a qualified lead - form submission, phone call, or consultation request. Lead quality matters as much as quantity.',
  typicalCustomerJourney: 'Awareness → Research (comparing providers) → Consideration (reading reviews, checking credentials) → Contact (form/call) → Sales follow-up → Close',
}
```

**Key Patterns:**
- `call-extension-opportunity`: Mobile traffic without call extensions
- `form-abandonment`: High landing page visits, low form submissions
- `service-keyword-expansion`: Core services not fully covered
- `geographic-targeting`: Spending outside service area

**Constraints (CRITICAL):**
```typescript
constraints: [
  'NEVER mention ROAS - this is not an ecommerce business',
  'NEVER recommend Shopping campaigns or product feeds',
  'Focus on lead quality, not just volume',
  'Consider that lead value varies - a commercial contract lead > residential',
  'Account for sales team capacity when recommending volume increases',
]
```

### SEO Skill (`lead-gen/seo.skill.ts`)

**Schema Requirements:**
```typescript
schema: {
  required: [
    { type: 'Service', description: 'Service offerings with description and provider' },
    { type: 'Organization', description: 'Company information' },
  ],
  recommended: [
    { type: 'FAQPage', description: 'Service FAQs for rich results' },
    { type: 'Review', description: 'Customer testimonials' },
    { type: 'LocalBusiness', description: 'If serving specific geographic area' },
  ],
  invalid: [
    { type: 'Product', description: 'Product schema is for ecommerce, not services' },
    { type: 'Offer', description: 'Offer schema implies product pricing' },
  ],
}
```

**Content Patterns:**
- Service page depth (detailed descriptions, process, benefits)
- Trust content (case studies, testimonials, credentials)
- Local content (service area pages if applicable)
- Educational content (guides, FAQs answering common questions)

**Constraints:**
```typescript
constraints: [
  'NEVER recommend Product schema - this is a service business',
  'Focus on E-E-A-T signals (Experience, Expertise, Authority, Trust)',
  'Service pages should demonstrate expertise, not just list offerings',
  'Consider lead capture optimization alongside SEO',
]
```

### Director Skill (`lead-gen/director.skill.ts`)

**Must Exclude (CRITICAL for constraint validation):**
```typescript
mustExclude: [
  'metric:roas',
  'metric:revenue',
  'metric:aov',
  'metric:conversionValue',
  'schema:Product',
  'schema:Offer',
  'schema:AggregateOffer',
  'type:shopping-campaign',
  'type:merchant-center',
  'type:product-feed',
  'type:product-listing-ads',
]
```

**Executive Framing:**
```typescript
executiveFraming: 'Focus on lead volume and cost efficiency. Service business leadership wants to see pipeline growth and marketing efficiency. Frame recommendations in terms of leads generated and cost per acquisition. Include capacity considerations - more leads only matter if sales can handle them.'
```

---

## SaaS Skill Bundle

### Business Context
Software-as-a-service businesses with subscription revenue models. Focus on trial signups, demo requests, and subscription conversions.

### Key Differences

| Aspect | Ecommerce | SaaS |
|--------|-----------|------|
| Primary KPI | ROAS | CAC, Trial-to-Paid Rate |
| Conversion | Purchase | Trial signup, Demo request |
| Revenue model | Transaction | Subscription (MRR/ARR) |
| Content focus | Product pages | Feature pages, comparisons, docs |
| Schema | Product | SoftwareApplication, WebApplication |

### Scout Skill (`saas/scout.skill.ts`)

```typescript
thresholds: {
  highSpendThreshold: 500,
  lowRoasThreshold: null,        // Not primary metric
  targetCac: 200,                // NEW: Customer acquisition cost target
  cannibalizationPosition: 5,
  highBounceRateThreshold: 60,   // SaaS pages should engage
  lowCtrThreshold: 2.5,          // Higher expectation for targeted SaaS keywords
  minImpressionsForAnalysis: 75,
}

metrics: {
  include: ['spend', 'conversions', 'ctr', 'impressions', 'position', 'trialSignups', 'demoRequests'],
  exclude: ['aov'], // Not applicable
  primary: ['conversions', 'cac', 'trialConversionRate'],
}
```

**Priority Rules:**
- `high-cac-keywords`: Keywords with acquisition cost above target
- `trial-signup-efficiency`: Trial signups vs spend
- `competitor-comparison`: "[competitor] alternative" keywords
- `feature-keyword-gaps`: Product features not being targeted
- `integration-keywords`: "[tool] integration" opportunities

### Researcher Skill (`saas/researcher.skill.ts`)

**Schema Extraction:**
```typescript
schemaExtraction: {
  lookFor: ['SoftwareApplication', 'WebApplication', 'Organization', 'FAQPage', 'HowTo'],
  flagIfPresent: ['Product', 'Offer'], // Physical product schemas
  flagIfMissing: ['SoftwareApplication', 'Organization'],
}
```

**Content Signals:**
- Free trial CTA
- Demo request form
- Pricing page structure
- Feature comparison tables
- Integration logos/badges
- Security/compliance badges (SOC2, GDPR)
- Customer logos

**Page Classification:**
- `/pricing`, `/plans` → pricing page
- `/features/`, `/product/` → feature page
- `/integrations/`, `/apps/` → integration page
- `/docs/`, `/help/`, `/support/` → documentation
- `/customers/`, `/case-studies/` → social proof
- `/compare/`, `/vs/`, `/alternative` → comparison page

### SEM Skill (`saas/sem.skill.ts`)

**KPIs:**
```typescript
kpis: {
  primary: [
    { metric: 'trialSignups', importance: 'critical', targetDirection: 'higher' },
    { metric: 'cac', importance: 'critical', targetDirection: 'lower', benchmark: 150 },
    { metric: 'demoRequests', importance: 'high', targetDirection: 'higher' },
  ],
  secondary: [
    { metric: 'ctr', importance: 'medium', benchmark: 0.03 },
    { metric: 'conversionRate', importance: 'high', benchmark: 0.04 },
  ],
  irrelevant: ['aov', 'transactionValue'], // Not applicable
}
```

**Context:**
```typescript
context: {
  businessModel: 'Subscription software business. Revenue comes from recurring subscriptions, so customer lifetime value justifies higher acquisition costs. Focus on qualified signups over volume.',
  conversionDefinition: 'Primary: Free trial signup or demo request. Secondary: Pricing page visit, feature page engagement. Quality matters - a qualified trial > 10 unqualified signups.',
  typicalCustomerJourney: 'Problem awareness → Solution research → Vendor comparison → Trial/Demo → Evaluation → Purchase decision → Onboarding → Expansion',
}
```

**Key Patterns:**
- `competitor-conquesting`: Bidding on competitor brand terms
- `feature-based-targeting`: Keywords matching product capabilities
- `integration-partnerships`: Co-marketing with integration partners
- `bottom-funnel-focus`: Demo/trial keywords vs awareness keywords

**Constraints:**
```typescript
constraints: [
  'Consider trial-to-paid conversion rate when evaluating trial volume',
  'Competitor conquesting may have legal restrictions - flag for review',
  'Integration keywords often have partnership implications',
  'Account for sales cycle length - B2B SaaS may take months to close',
  'ROAS may be mentioned but LTV/CAC is the true north metric',
]
```

### SEO Skill (`saas/seo.skill.ts`)

**Schema:**
```typescript
schema: {
  required: [
    { type: 'SoftwareApplication', description: 'Software product details' },
    { type: 'Organization', description: 'Company information' },
  ],
  recommended: [
    { type: 'FAQPage', description: 'Product FAQs' },
    { type: 'HowTo', description: 'Tutorial content' },
    { type: 'Review', description: 'G2/Capterra style reviews' },
  ],
  invalid: [
    { type: 'Product', description: 'Physical product schema - use SoftwareApplication' },
    { type: 'LocalBusiness', description: 'SaaS is not location-based' },
  ],
}
```

**Content Focus:**
- Feature pages with depth
- Comparison pages ("[Product] vs [Competitor]")
- Integration documentation
- Use case pages by industry/role
- Help documentation (can rank for support queries)
- Changelog/product updates (freshness signals)

**Constraints:**
```typescript
constraints: [
  'NEVER recommend Product schema - use SoftwareApplication',
  'Documentation can be powerful for SEO - don\'t neglect help content',
  'Comparison pages must be fair and accurate to avoid reputation issues',
  'Consider programmatic SEO for integration/use case pages',
]
```

### Director Skill (`saas/director.skill.ts`)

**Must Exclude:**
```typescript
mustExclude: [
  'metric:aov',
  'schema:Product',
  'schema:Offer',
  'schema:LocalBusiness',
  'type:shopping-campaign',
  'type:merchant-center',
  'type:product-feed',
]
```

**Executive Framing:**
```typescript
executiveFraming: 'Focus on pipeline efficiency and customer acquisition cost. SaaS leadership thinks in terms of MRR/ARR growth, CAC payback period, and trial conversion rates. Frame recommendations in terms of qualified pipeline generated, not just traffic or clicks.'
```

---

## Local Business Skill Bundle

### Business Context
Businesses with physical locations serving geographic areas (restaurants, dentists, plumbers, retail stores, etc.). Combines elements of lead-gen with local SEO focus.

### Key Differences

| Aspect | Ecommerce | Local |
|--------|-----------|-------|
| Primary KPI | ROAS | Store visits, Local calls, Directions |
| Conversion | Purchase | Call, Visit, Booking |
| Geographic | Nationwide | Service area specific |
| Schema | Product | LocalBusiness, specific types |
| Content focus | Product pages | Location pages, service areas |

### Scout Skill (`local/scout.skill.ts`)

```typescript
thresholds: {
  highSpendThreshold: 200,       // Local budgets typically smaller
  lowRoasThreshold: null,        // Often can't track offline revenue
  cannibalizationPosition: 3,    // Local pack is top 3
  highBounceRateThreshold: 60,
  lowCtrThreshold: 3.0,          // Local intent = higher CTR expected
  minImpressionsForAnalysis: 30, // Lower volume in local markets
}

metrics: {
  include: ['spend', 'conversions', 'calls', 'directions', 'storeVisits', 'ctr', 'impressions'],
  exclude: ['roas'], // Often can't track offline conversion value
  primary: ['conversions', 'calls', 'storeVisits'],
}
```

**Priority Rules:**
- `service-area-coverage`: Keywords for each service area
- `competitor-local`: Local competitors appearing in pack
- `call-tracking-gaps`: Mobile traffic without call extensions
- `gmb-optimization`: Google Business Profile opportunities
- `location-keyword-match`: Keywords matching service locations

### Researcher Skill (`local/researcher.skill.ts`)

**Schema Extraction:**
```typescript
schemaExtraction: {
  lookFor: ['LocalBusiness', 'Organization', 'PostalAddress', 'GeoCoordinates', 'OpeningHoursSpecification'],
  // Specific types based on business
  lookFor: ['Restaurant', 'Dentist', 'Plumber', 'Attorney', 'RealEstateAgent', /* etc */],
  flagIfPresent: [], // LocalBusiness can have Product if they sell items
  flagIfMissing: ['LocalBusiness', 'PostalAddress'],
}
```

**Content Signals:**
- NAP consistency (Name, Address, Phone)
- Google Maps embed
- Service area list
- Hours of operation
- Reviews/testimonials
- Local trust signals (BBB, local awards)
- Booking/appointment widget

**Page Classification:**
- `/locations/`, `/our-locations/` → location page
- `/service-area/`, `/areas-we-serve/` → service area page
- `/services/` → service page
- `/contact`, `/book`, `/schedule` → conversion page
- `/reviews/`, `/testimonials/` → trust page

### SEM Skill (`local/sem.skill.ts`)

**KPIs:**
```typescript
kpis: {
  primary: [
    { metric: 'calls', importance: 'critical', targetDirection: 'higher' },
    { metric: 'storeVisits', importance: 'critical', targetDirection: 'higher' },
    { metric: 'conversions', importance: 'critical', targetDirection: 'higher' },
  ],
  secondary: [
    { metric: 'directions', importance: 'high', targetDirection: 'higher' },
    { metric: 'ctr', importance: 'medium', benchmark: 0.04 },
    { metric: 'impressionShare', importance: 'medium' },
  ],
  irrelevant: ['roas', 'aov', 'mrr', 'arr'], // Can't track offline value reliably
}
```

**Context:**
```typescript
context: {
  businessModel: 'Local service business with physical location(s). Revenue generated through in-person visits, service calls, and local appointments. Success measured by foot traffic, phone calls, and bookings.',
  conversionDefinition: 'Primary: Phone call, direction request, or booking. Many conversions happen offline after initial contact. Attribution is challenging.',
  typicalCustomerJourney: 'Local search ("near me", "[service] [city]") → Review local pack → Check reviews/ratings → Call or visit → In-person transaction',
}
```

**Key Patterns:**
- `local-pack-presence`: Appearing in Google Maps 3-pack
- `call-only-campaigns`: Mobile-focused call campaigns
- `location-extensions`: Using location assets effectively
- `service-area-targeting`: Radius and location targeting
- `competitor-location`: Ads near competitor locations

**Constraints:**
```typescript
constraints: [
  'ROAS tracking is limited for offline conversions - focus on calls/visits',
  'Consider store visit conversions if available',
  'Geographic targeting must match actual service area',
  'Call tracking is essential for attribution',
  'Reviews significantly impact local ad performance',
]
```

### SEO Skill (`local/seo.skill.ts`)

**Schema:**
```typescript
schema: {
  required: [
    { type: 'LocalBusiness', description: 'Business NAP and details - use specific subtype' },
    { type: 'PostalAddress', description: 'Physical address' },
    { type: 'GeoCoordinates', description: 'Lat/long for mapping' },
  ],
  recommended: [
    { type: 'OpeningHoursSpecification', description: 'Business hours' },
    { type: 'Review', description: 'Customer reviews' },
    { type: 'AggregateRating', description: 'Overall rating' },
    { type: 'Service', description: 'Services offered' },
  ],
  invalid: [
    { type: 'SoftwareApplication', description: 'Not a software business' },
  ],
  pageTypeRules: [
    {
      pageType: 'location',
      requiredSchema: ['LocalBusiness', 'PostalAddress', 'GeoCoordinates'],
      recommendedSchema: ['OpeningHoursSpecification', 'AggregateRating'],
    },
  ],
}
```

**Content Focus:**
- Google Business Profile optimization
- Location pages for each area served
- Service + location combinations
- Local citations and directory listings
- Review acquisition and management
- Local content (community involvement, local news)

**Constraints:**
```typescript
constraints: [
  'NAP consistency is critical - same name/address/phone everywhere',
  'Each physical location needs its own page if multi-location',
  'Service area pages should have unique, valuable content - not just city name swaps',
  'Google Business Profile is as important as website SEO',
  'Reviews are a ranking factor - include review acquisition strategy',
]
```

### Director Skill (`local/director.skill.ts`)

**Must Exclude:**
```typescript
mustExclude: [
  'metric:roas',        // Can't track offline conversions
  'metric:mrr',         // SaaS metric
  'metric:arr',         // SaaS metric
  'type:shopping-campaign',
  'type:merchant-center',
  'schema:SoftwareApplication',
]
```

**Executive Framing:**
```typescript
executiveFraming: 'Focus on calls, visits, and local visibility. Local business owners want to know if their marketing is driving customers through the door. Frame recommendations in terms of estimated calls, foot traffic, and local market share. Keep technical SEO jargon minimal.'
```

---

## Implementation Checklist

For each business type, verify:

### Scout Skill
- [ ] Thresholds appropriate for business model
- [ ] Metrics.exclude removes inappropriate metrics (e.g., ROAS for lead-gen)
- [ ] Priority rules match business priorities
- [ ] Limits appropriate for typical data volume

### Researcher Skill
- [ ] Schema lookFor includes correct schema types
- [ ] Schema flagIfPresent catches wrong schemas
- [ ] Content signals match business conversion points
- [ ] Page classification patterns match typical URL structures

### SEM Skill
- [ ] KPIs.primary has correct metrics for business type
- [ ] KPIs.irrelevant excludes inappropriate metrics
- [ ] Context accurately describes business model
- [ ] Prompt constraints prevent wrong recommendations
- [ ] Examples are realistic for business type

### SEO Skill
- [ ] Schema.required has correct types
- [ ] Schema.invalid prevents wrong schema recommendations
- [ ] Content patterns match business content needs
- [ ] Prompt constraints prevent inappropriate recommendations

### Director Skill
- [ ] mustExclude has all inappropriate metrics/schemas
- [ ] Executive framing uses business-appropriate language
- [ ] Conflict resolution rules make sense for business type
- [ ] Impact weights appropriate for business priorities

### Index File
- [ ] Imports all 5 skill files
- [ ] Exports correctly typed AgentSkillBundle
- [ ] Version is 1.0.0

---

## Testing

After implementation, test each bundle by:

1. **Type Check**: `npm run type-check` passes
2. **Build**: `npm run build` succeeds
3. **Constraint Validation**: Generate a report and verify:
   - Lead-gen reports don't mention ROAS
   - SaaS reports don't recommend Product schema
   - Local reports don't reference MRR/ARR
4. **Instrumentation**: Check `report_metrics` table for violations

---

## Files to Update After Implementation

1. `skills/index.ts` - Update exports if needed
2. Remove placeholder files once real skills are complete:
   - `skills/placeholders/` directory can be deleted
