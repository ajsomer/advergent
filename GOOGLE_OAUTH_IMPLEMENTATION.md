# Week 2: Google OAuth & Data Sync Implementation

## Overview

Implement Google OAuth 2.0 integration for connecting client Google Ads and Search Console accounts. This enables Advergent to fetch paid search and organic search performance data for analysis.

---

## Prerequisites

- ✅ Clerk authentication working
- ✅ Neon Postgres + Drizzle ORM configured
- ✅ Database schema with `client_accounts` table
- ✅ Environment variables configured

---

## Architecture

```
User Flow:
1. Agency user navigates to "Add Client" or client onboarding
2. Clicks "Connect Google Ads" → Redirected to Google OAuth consent
3. User authorizes Advergent to access Google Ads + Search Console
4. Google redirects back with authorization code
5. Backend exchanges code for access/refresh tokens
6. Tokens encrypted and stored in client_accounts table
7. Background workers can now fetch data using stored tokens
```

---

## Task 1: Token Encryption Service

**File:** `apps/api/src/services/encryption.service.ts`

### Requirements:

1. **Encrypt Function**
   - Algorithm: AES-256-GCM
   - Input: plaintext string (OAuth token)
   - Output: encrypted string with IV and auth tag
   - Use `ENCRYPTION_KEY` from environment (32-byte hex string)

2. **Decrypt Function**
   - Input: encrypted string
   - Output: plaintext OAuth token
   - Handle IV and auth tag extraction

3. **Key Generation Helper**
   - Provide CLI command to generate secure encryption keys
   - Document in README

### Implementation Notes:

- Use Node.js `crypto` module
- Format: `{iv}:{authTag}:{encryptedData}` (all base64 encoded)
- Add error handling for corrupt data
- Log encryption/decryption operations (but NOT the tokens themselves)

### Example Interface:

```typescript
export interface EncryptionService {
  encrypt(plaintext: string): string;
  decrypt(ciphertext: string): string;
  generateKey(): string; // For CLI tool
}
```

### Testing:

```typescript
const token = 'ya29.a0AfH6SMBx...';
const encrypted = encryptionService.encrypt(token);
const decrypted = encryptionService.decrypt(encrypted);
assert(decrypted === token);
```

---

## Task 2: Google OAuth Routes

**File:** `apps/api/src/routes/google-oauth.routes.ts`

### Endpoints:

#### 1. `GET /api/google/auth/initiate`

**Purpose:** Start OAuth flow for a client

**Query Params:**
- `clientId` - UUID of client account (from `client_accounts` table)
- `service` - Either `ads` or `search_console`

**Logic:**
1. Verify user is authenticated (Clerk)
2. Verify user has access to this client
3. Generate OAuth URL with appropriate scopes
4. Store `state` parameter in session/redis with clientId + service
5. Return redirect URL to frontend

**Google Ads Scopes:**
- `https://www.googleapis.com/auth/adwords`

**Search Console Scopes:**
- `https://www.googleapis.com/auth/webmasters.readonly`

**Response:**
```json
{
  "authUrl": "https://accounts.google.com/o/oauth2/v2/auth?..."
}
```

#### 2. `GET /api/google/callback`

**Purpose:** Handle OAuth callback from Google

**Query Params:**
- `code` - Authorization code from Google
- `state` - State parameter (contains clientId + service)
- `error` - Error from Google (optional)

**Logic:**
1. Verify state parameter matches stored value
2. Exchange authorization code for tokens using Google OAuth2 client
3. Extract `access_token` and `refresh_token`
4. Encrypt refresh token using encryption service
5. Update `client_accounts` table:
   - For Google Ads: `google_ads_refresh_token_encrypted`, `google_ads_customer_id`
   - For Search Console: `search_console_refresh_token_encrypted`, `search_console_site_url`
6. Redirect to frontend success page

**Error Handling:**
- If `error` in query params, redirect to frontend with error message
- If token exchange fails, log and redirect to frontend with error
- If encryption fails, log and return 500

**Response:** Redirect to frontend
- Success: `${FRONTEND_URL}/clients/${clientId}/onboarding?step=complete`
- Error: `${FRONTEND_URL}/clients/${clientId}/onboarding?error=${errorMessage}`

#### 3. `POST /api/google/disconnect`

**Purpose:** Revoke Google OAuth connection for a client

**Body:**
```json
{
  "clientId": "uuid",
  "service": "ads" | "search_console"
}
```

**Logic:**
1. Verify user has access to client
2. Fetch refresh token from DB
3. Decrypt token
4. Revoke token via Google API
5. Clear encrypted token from DB
6. Return success

---

## Task 3: Google Ads Service

### File: `apps/api/src/services/google-ads.service.ts`

**Purpose:** Fetch Google Ads search query performance data

**Dependencies:**
- `google-ads-api` package
- Client's encrypted refresh token
- Encryption service to decrypt token

**Methods:**

#### 1. `getClient(clientAccountId: string): GoogleAdsApi`

- Fetch client from DB
- Decrypt refresh token
- Initialize GoogleAdsApi client with credentials
- Return authenticated client

#### 2. `getSearchQueryReport(clientAccountId: string, startDate: string, endDate: string)`

**Purpose:** Fetch search query performance for date range

**Google Ads Query (GAQL):**
```sql
SELECT
  search_term_view.search_term,
  metrics.impressions,
  metrics.clicks,
  metrics.cost_micros,
  metrics.conversions,
  metrics.ctr,
  metrics.average_cpc,
  campaign.id,
  campaign.name,
  ad_group.id,
  ad_group.name,
  segments.date
FROM search_term_view
WHERE segments.date BETWEEN '${startDate}' AND '${endDate}'
  AND metrics.impressions > 0
ORDER BY metrics.impressions DESC
```

**Return Type:**
```typescript
interface GoogleAdsQuery {
  searchTerm: string;
  impressions: number;
  clicks: number;
  costMicros: number; // Cost in micros (divide by 1,000,000 for dollars)
  conversions: number;
  ctr: number;
  averageCpc: number;
  campaignId: string;
  campaignName: string;
  adGroupId: string;
  adGroupName: string;
  date: string; // YYYY-MM-DD
}

type GoogleAdsQueryReport = GoogleAdsQuery[];
```

**Error Handling:**
- Handle token expiration (refresh and retry)
- Handle API rate limits (exponential backoff)
- Handle customer ID not found
- Log all errors with structured logging

#### 3. `getCustomerIds(clientAccountId: string): string[]`

**Purpose:** Get list of accessible customer IDs for the authenticated account

**Note:** Some accounts are manager accounts with access to multiple customer IDs

---

### File: `apps/api/src/services/google-ads.service.mock.ts`

**Purpose:** Mock implementation for development when `USE_MOCK_GOOGLE_APIS=true`

**Implementation:**
- Return hardcoded sample data
- Same interface as real service
- Include realistic test data (20-30 search terms)
- Mimic API delays with `setTimeout` (100-300ms)

**Sample Data Structure:**
```typescript
export const MOCK_GOOGLE_ADS_DATA: GoogleAdsQuery[] = [
  {
    searchTerm: 'nike running shoes',
    impressions: 15234,
    clicks: 892,
    costMicros: 3450000, // $3.45
    conversions: 23,
    ctr: 0.0585,
    averageCpc: 3.87,
    campaignId: '12345',
    campaignName: 'Brand - Running Shoes',
    adGroupId: '67890',
    adGroupName: 'Nike Running',
    date: '2025-01-15'
  },
  // ... more mock data
];
```

---

## Task 4: Search Console Service

### File: `apps/api/src/services/search-console.service.ts`

**Purpose:** Fetch Google Search Console organic search performance data

**Dependencies:**
- `googleapis` package (Webmasters API)
- Client's encrypted refresh token
- Encryption service

**Methods:**

#### 1. `getClient(clientAccountId: string): webmasters_v3.Webmasters`

- Fetch client from DB
- Decrypt refresh token
- Create OAuth2 client with refresh token
- Initialize Webmasters API client
- Return authenticated client

#### 2. `getSearchAnalytics(clientAccountId: string, startDate: string, endDate: string)`

**Purpose:** Fetch organic search query performance

**Search Console API Request:**
```typescript
const request = {
  siteUrl: client.searchConsoleSiteUrl, // e.g., 'https://example.com/'
  requestBody: {
    startDate: '2025-01-01', // YYYY-MM-DD
    endDate: '2025-01-31',
    dimensions: ['query', 'date'],
    rowLimit: 25000,
    type: 'web'
  }
};

const response = await webmasters.searchanalytics.query(request);
```

**Return Type:**
```typescript
interface SearchConsoleQuery {
  query: string;
  impressions: number;
  clicks: number;
  ctr: number;
  position: number; // Average position in SERP
  date: string; // YYYY-MM-DD
}

type SearchConsoleReport = SearchConsoleQuery[];
```

**Error Handling:**
- Handle token expiration (refresh and retry)
- Handle site not verified in Search Console
- Handle permission denied errors
- Log all errors

#### 3. `getSiteUrls(clientAccountId: string): string[]`

**Purpose:** Get list of verified sites for the authenticated account

**Use Case:** Let user select which site to connect during onboarding

---

### File: `apps/api/src/services/search-console.service.mock.ts`

**Purpose:** Mock implementation for development

**Sample Data:**
```typescript
export const MOCK_SEARCH_CONSOLE_DATA: SearchConsoleQuery[] = [
  {
    query: 'nike running shoes',
    impressions: 8234,
    clicks: 456,
    ctr: 0.0554,
    position: 4.2,
    date: '2025-01-15'
  },
  // ... more mock data
];
```

---

## Task 5: Service Factory Pattern

**File:** `apps/api/src/services/index.ts`

**Purpose:** Export correct service based on `USE_MOCK_GOOGLE_APIS` flag

```typescript
import { config } from '@/config';
import * as GoogleAdsServiceReal from './google-ads.service';
import * as GoogleAdsServiceMock from './google-ads.service.mock';
import * as SearchConsoleServiceReal from './search-console.service';
import * as SearchConsoleServiceMock from './search-console.service.mock';

export const googleAdsService = config.useMockGoogleApis
  ? GoogleAdsServiceMock
  : GoogleAdsServiceReal;

export const searchConsoleService = config.useMockGoogleApis
  ? SearchConsoleServiceMock
  : SearchConsoleServiceReal;
```

**Usage in Routes/Workers:**
```typescript
import { googleAdsService, searchConsoleService } from '@/services';

// Always uses correct implementation based on env flag
const report = await googleAdsService.getSearchQueryReport(clientId, start, end);
```

---

## Task 6: Database Updates

### Update `client_accounts` Table Schema

**Required Fields (already in schema):**
- `google_ads_customer_id` - Customer ID from Google Ads (e.g., "123-456-7890")
- `google_ads_refresh_token_encrypted` - Encrypted refresh token
- `search_console_site_url` - Site URL (e.g., "https://example.com/")
- `search_console_refresh_token_encrypted` - Encrypted refresh token

### Optional: Add OAuth Metadata

Consider adding these fields for better tracking:
- `google_ads_connected_at` - Timestamp when connected
- `search_console_connected_at` - Timestamp when connected
- `google_ads_token_expires_at` - When access token expires (for refresh logic)
- `search_console_token_expires_at` - When access token expires

**Migration:**
```typescript
// If adding new fields, create migration with Drizzle Kit
await db.schema.alterTable('client_accounts').addColumn({
  googleAdsConnectedAt: timestamp('google_ads_connected_at'),
  searchConsoleConnectedAt: timestamp('search_console_connected_at')
});
```

---

## Task 7: Environment Variables

### Add to `apps/api/.env`

```bash
# Token Encryption
ENCRYPTION_KEY=<generate-with-crypto-random-bytes-32>

# Google OAuth
GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-client-secret
GOOGLE_REDIRECT_URI=http://localhost:3001/api/google/callback

# Google Ads
GOOGLE_ADS_DEVELOPER_TOKEN=your-developer-token
```

### Generate Encryption Key

**CLI Command:**
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Add output to `.env` as `ENCRYPTION_KEY`

---

## Task 8: Google Cloud Console Setup

### Create OAuth 2.0 Credentials

1. Go to https://console.cloud.google.com
2. Create new project or select existing
3. Enable APIs:
   - Google Ads API
   - Google Search Console API
4. Go to **Credentials** → **Create Credentials** → **OAuth 2.0 Client ID**
5. Application type: **Web application**
6. Authorized redirect URIs:
   - `http://localhost:3001/api/google/callback` (dev)
   - `https://your-api.onrender.com/api/google/callback` (production)
7. Copy **Client ID** and **Client Secret** to `.env`

### Get Google Ads Developer Token

1. Go to https://ads.google.com/aw/apicenter
2. Apply for developer token (test account initially)
3. Wait for approval (can take 24-48 hours)
4. Copy token to `.env`

**Note:** Test accounts have limited access but work for development

---

## Task 9: Frontend Integration

### Onboarding Flow

**File:** `apps/web/src/pages/Onboarding.tsx`

**Steps:**
1. Create client account (name, description)
2. Connect Google Ads
3. Connect Search Console
4. Complete

**Connect Google Ads Button:**
```typescript
const handleConnectGoogleAds = async () => {
  const api = useApiClient();
  const { data } = await api.get('/api/google/auth/initiate', {
    params: { clientId, service: 'ads' }
  });

  // Redirect to Google OAuth
  window.location.href = data.authUrl;
};
```

**Handle Callback:**
```typescript
// In useEffect, check for success/error params
const params = new URLSearchParams(window.location.search);
if (params.get('step') === 'complete') {
  toast.success('Google account connected!');
}
if (params.get('error')) {
  toast.error(params.get('error'));
}
```

---

## Task 10: Testing Checklist

### Manual Testing

1. **Encryption Service**
   - [ ] Can encrypt a string
   - [ ] Can decrypt the encrypted string
   - [ ] Decrypted value matches original
   - [ ] Handles corrupt data gracefully

2. **Google Ads OAuth**
   - [ ] Initiate flow redirects to Google
   - [ ] Callback saves encrypted token to DB
   - [ ] Can fetch customer IDs
   - [ ] Can fetch search query report
   - [ ] Mock service works when flag enabled

3. **Search Console OAuth**
   - [ ] Initiate flow redirects to Google
   - [ ] Callback saves encrypted token to DB
   - [ ] Can fetch site URLs
   - [ ] Can fetch search analytics
   - [ ] Mock service works when flag enabled

4. **Token Refresh**
   - [ ] Expired access tokens automatically refresh
   - [ ] Refresh logic works without user intervention

5. **Error Handling**
   - [ ] Invalid tokens return proper error
   - [ ] API rate limits trigger exponential backoff
   - [ ] Frontend shows user-friendly error messages

---

## Task 11: Documentation

### Update README.md

Add section:

```markdown
## Google OAuth Setup

### Prerequisites
1. Create Google Cloud project
2. Enable Google Ads API and Search Console API
3. Create OAuth 2.0 credentials
4. Get Google Ads developer token

### Environment Variables
- `GOOGLE_CLIENT_ID` - OAuth client ID
- `GOOGLE_CLIENT_SECRET` - OAuth client secret
- `GOOGLE_REDIRECT_URI` - Callback URL
- `GOOGLE_ADS_DEVELOPER_TOKEN` - Ads API token
- `ENCRYPTION_KEY` - 32-byte hex key for token encryption

### Generate Encryption Key
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### Development Mode
Set `USE_MOCK_GOOGLE_APIS=true` to use mock data without real Google accounts.
```

---

## Success Criteria

When this week is complete, you should be able to:

- ✅ Start Google OAuth flow from frontend
- ✅ Connect Google Ads account and store encrypted refresh token
- ✅ Connect Search Console account and store encrypted refresh token
- ✅ Fetch Google Ads search query data (real or mock)
- ✅ Fetch Search Console organic query data (real or mock)
- ✅ All tokens encrypted before storage
- ✅ Mock services work for development without real credentials
- ✅ Proper error handling and logging throughout

---

## File Checklist

**Create:**
- [ ] `apps/api/src/services/encryption.service.ts`
- [ ] `apps/api/src/services/google-ads.service.ts`
- [ ] `apps/api/src/services/google-ads.service.mock.ts`
- [ ] `apps/api/src/services/search-console.service.ts`
- [ ] `apps/api/src/services/search-console.service.mock.ts`
- [ ] `apps/api/src/services/index.ts` (service factory)

**Update:**
- [ ] `apps/api/src/routes/google-oauth.routes.ts` (add OAuth endpoints)
- [ ] `apps/api/src/config/index.ts` (add Google OAuth config)
- [ ] `apps/api/.env` (add encryption key + Google credentials)
- [ ] `apps/web/src/pages/Onboarding.tsx` (add OAuth buttons)

**Optional:**
- [ ] `apps/api/src/db/schema.ts` (add OAuth metadata fields)
- [ ] Create Drizzle migration if schema changes

---

## Tips for Implementation

1. **Start with Encryption Service** - Test it thoroughly before moving on
2. **Use Mock Services First** - Get the flow working with mocks before adding real APIs
3. **Test OAuth Flow Manually** - Use Postman or browser to test OAuth before integrating frontend
4. **Handle Token Refresh** - Build refresh logic early, you'll need it
5. **Log Everything** - Use Pino to log all OAuth steps for debugging
6. **Secure Secrets** - Never log decrypted tokens or encryption keys

---

## Common Pitfalls to Avoid

1. **Don't store tokens in plaintext** - Always encrypt before DB write
2. **Don't forget to refresh access tokens** - They expire in ~1 hour
3. **Don't hardcode redirect URIs** - Use environment variables
4. **Don't skip error handling** - OAuth flows have many failure modes
5. **Don't expose encryption keys** - Keep them in `.env`, never commit

---

## Next Steps (Week 3)

After completing this week, you'll be ready for:
- Query normalization and matching
- Claude AI integration
- Recommendation generation

But first, get the data flowing from Google! 🚀
