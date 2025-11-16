# Advergent - Google Ads API Integration Design Document

## Application Overview

**Application Name:** Advergent
**Purpose:** SEO-PPC Optimization Platform for Digital Marketing Agencies
**API Access Level:** Basic Access (Read-Only)
**Date:** November 2024

## Executive Summary

Advergent is a SaaS platform that helps digital marketing agencies optimize their clients' advertising budgets by identifying and reducing wasted spend on Google Ads queries that could be captured organically through SEO.

## Business Model

- **Target Users:** Digital marketing agencies managing 10-50+ client accounts
- **Revenue Model:** Subscription-based SaaS (Starter: $299/mo, Growth: $699/mo, Agency: $1,499/mo)
- **Value Proposition:** Reduce wasted PPC spend by identifying paid/organic search overlaps

## Google Ads API Use Case

### Primary Objective
Read and analyze Google Ads search query performance data to identify opportunities where clients are paying for clicks on queries they already rank for organically.

### Data Access Requirements

**Read-Only Access to:**
1. Search Query Reports (search term performance)
2. Campaign and Ad Group data
3. Performance metrics (impressions, clicks, cost, conversions)
4. Cost data (CPC, total spend)

**We DO NOT:**
- Modify campaigns, bids, or budgets
- Create or delete ads
- Change account settings
- Access billing information beyond cost metrics

### API Integration Flow

```
┌─────────────────────────────────────────────────────────────┐
│                    User Onboarding Flow                      │
└─────────────────────────────────────────────────────────────┘

1. Agency user creates client account in Advergent
2. User initiates OAuth 2.0 flow for Google Ads
3. User authorizes Advergent to read Google Ads data
4. User selects which Google Ads account to connect
5. Advergent stores encrypted OAuth refresh token
6. Daily background sync retrieves search query data

┌─────────────────────────────────────────────────────────────┐
│                    Data Sync Process                         │
└─────────────────────────────────────────────────────────────┘

Daily Schedule:
- Fetch search query report for last 30 days
- Retrieve campaign and ad group names
- Pull performance metrics (impressions, clicks, cost)
- Store data in Advergent database for analysis

GAQL Query Example:
SELECT
  search_term_view.search_term,
  metrics.impressions,
  metrics.clicks,
  metrics.cost_micros,
  metrics.conversions,
  campaign.name,
  ad_group.name
FROM search_term_view
WHERE segments.date DURING LAST_30_DAYS
```

### Data Analysis Workflow

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│  Google Ads API │────▶│  Advergent       │────▶│  AI Analysis    │
│  (Search Queries)│     │  Query Matcher   │     │  (Claude API)   │
└─────────────────┘     └──────────────────┘     └─────────────────┘
                                │                          │
                                ▼                          ▼
                        ┌──────────────────┐     ┌─────────────────┐
                        │ Google Search    │     │ Recommendations │
                        │ Console API      │     │ Dashboard       │
                        └──────────────────┘     └─────────────────┘
```

## Technical Architecture

### Authentication
- **Method:** OAuth 2.0 with offline access
- **Token Storage:** AES-256-GCM encrypted refresh tokens
- **Rotation:** Tokens refreshed automatically before expiration

### API Client Configuration
```javascript
const googleAdsClient = new GoogleAdsApi({
  client_id: process.env.GOOGLE_CLIENT_ID,
  client_secret: process.env.GOOGLE_CLIENT_SECRET,
  developer_token: process.env.GOOGLE_ADS_DEVELOPER_TOKEN,
});

const customer = googleAdsClient.Customer({
  customer_id: clientCustomerId,
  refresh_token: decryptedRefreshToken,
});
```

### Data Retrieval
- **Frequency:** Once per day per client
- **Date Range:** Rolling 30-day window
- **Rate Limiting:** Respects Google Ads API quotas
- **Error Handling:** Exponential backoff on failures

### API Endpoints Used

| Endpoint | Purpose | Frequency |
|----------|---------|-----------|
| `listAccessibleCustomers` | Account selection during onboarding | One-time |
| `customer.query` (search_term_view) | Daily search query data | Daily |
| `customer.query` (campaign) | Campaign metadata | Daily |

## Security & Privacy

### Data Protection
- OAuth tokens encrypted at rest using AWS KMS
- All API communication over HTTPS
- Database credentials stored in environment variables
- No plaintext storage of sensitive data

### Compliance
- GDPR compliant data handling
- Users can disconnect accounts anytime
- Data deleted upon account disconnection
- Audit logs for all API access

### Access Controls
- Role-based access (Owner, Admin, Member)
- Agency users can only access their own clients
- Multi-factor authentication supported via Clerk

## User Interface

### Account Selection Screen
After OAuth authorization, users see a list of all accessible Google Ads accounts and select which one to connect.

**UI Elements:**
- Account name
- Customer ID (formatted: 123-456-7890)
- Account type badge (Manager/Client)
- Currency indicator

### Dashboard View
Displays recommendations based on Google Ads and Search Console data overlap.

**Key Metrics Shown:**
- Current monthly ad spend on overlapping queries
- Recommended monthly spend
- Estimated monthly savings
- Confidence level (High/Medium/Low)

## API Quota Usage Estimates

**Per Client Per Day:**
- 1 search_term_view query
- 1 campaign query
- Estimated operations: ~2-5 per client per day

**Total (for 100 clients):**
- ~200-500 operations per day
- Well within Basic Access limits

## Development & Testing

### Development Environment
- Local testing with test Google Ads accounts
- Mock API mode for offline development
- Staging environment before production deployment

### Production Deployment
- Hosted on Render.com
- PostgreSQL database (Neon/Supabase)
- Redis for job queuing (Upstash)
- Background workers for data sync

## Support & Maintenance

**Contact Information:**
- Email: support@advergent.com
- Documentation: https://docs.advergent.com
- Support Hours: Monday-Friday, 9am-5pm EST

## Appendix: Sample Data Flow

### Example API Call
```javascript
// Fetch search query report
const query = `
  SELECT
    search_term_view.search_term,
    metrics.impressions,
    metrics.clicks,
    metrics.cost_micros,
    metrics.conversions,
    campaign.name,
    ad_group.name,
    segments.date
  FROM search_term_view
  WHERE segments.date DURING LAST_30_DAYS
    AND metrics.impressions > 0
  ORDER BY metrics.impressions DESC
  LIMIT 25000
`;

const results = await customer.queryStream(query);
```

### Example Response Processing
```javascript
for await (const row of results) {
  // Store in database
  await saveQuery({
    searchTerm: row.search_term_view.search_term,
    impressions: row.metrics.impressions,
    clicks: row.metrics.clicks,
    cost: row.metrics.cost_micros / 1000000, // Convert micros to dollars
    conversions: row.metrics.conversions,
    campaignName: row.campaign.name,
    date: row.segments.date
  });
}
```

## Conclusion

Advergent's integration with the Google Ads API is designed to provide read-only access to search query performance data, enabling agencies to make data-driven decisions about their clients' advertising budgets. The integration is secure, compliant, and respects Google's API usage policies.

---

**Document Version:** 1.0
**Last Updated:** November 15, 2024
**Prepared By:** Advergent Development Team
