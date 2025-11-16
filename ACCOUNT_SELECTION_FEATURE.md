# Google Ads Account Selection Feature

## Context

Currently, the Google OAuth flow for connecting Google Ads accounts doesn't allow users to select which Google Ads account to connect. This is a problem for users who have access to multiple Google Ads accounts (manager accounts, multiple client accounts, etc.).

The current flow:
1. User clicks "Connect Google Ads"
2. OAuth consent screen
3. Callback saves the refresh token immediately
4. User proceeds to next step

**Problem**: No account selection happens, and we don't save which Google Ads customer ID was selected.

## Objective

Implement a Google Ads account selection step between OAuth callback and final connection storage. After a user authorizes the app via Google OAuth, they should see a list of all accessible Google Ads accounts and select which one to connect to this client.

## Requirements

### 1. Backend Changes

#### A. Modify OAuth Callback (`apps/api/src/routes/google-oauth.routes.ts`)

**Current behavior**:
- OAuth callback receives authorization code
- Exchanges code for tokens
- Encrypts and saves refresh token immediately
- Redirects to frontend

**New behavior**:
- OAuth callback receives authorization code
- Exchanges code for tokens
- **Store tokens temporarily** (in-memory cache or Redis with TTL of 10 minutes)
- **Redirect to account selection page** instead of marking complete
- Pass a temporary session token in the URL to retrieve the OAuth tokens later

**Implementation**:
```typescript
// After exchanging code for tokens:
const sessionToken = crypto.randomBytes(32).toString('hex');

// Store in Redis or in-memory map with 10-minute TTL
await storeTemporaryTokens(sessionToken, {
  refreshToken: tokens.refresh_token,
  accessToken: tokens.access_token,
  clientId,
  service
});

// Redirect to account selection page
res.redirect(`${config.frontendUrl}/onboarding/select-account?session=${sessionToken}&clientId=${clientId}&service=${service}`);
```

#### B. New Endpoint: Fetch Available Google Ads Accounts

**Route**: `GET /api/google/accounts/:clientId`

**Query Params**:
- `session` - temporary session token from OAuth callback

**Logic**:
1. Retrieve temporary tokens using session token
2. Use `google-ads-api` to call `listAccessibleCustomers` endpoint
3. For each customer ID, fetch basic account info (name, customer ID, account type)
4. Return array of accounts

**Response**:
```json
{
  "accounts": [
    {
      "customerId": "123-456-7890",
      "name": "Client A - Main Account",
      "isManager": false,
      "currency": "USD"
    },
    {
      "customerId": "987-654-3210",
      "name": "Client B - Campaign Account",
      "isManager": false,
      "currency": "USD"
    }
  ]
}
```

**Google Ads API calls needed**:
```typescript
// 1. List accessible customers
const response = await googleAdsClient.listAccessibleCustomers(refreshToken);
const customerIds = response.resource_names.map(name => name.replace('customers/', ''));

// 2. For each customer, get account details
const accounts = [];
for (const customerId of customerIds) {
  const customer = googleAdsClient.Customer({
    customer_id: customerId,
    refresh_token: refreshToken
  });

  const accountInfo = await customer.query(`
    SELECT
      customer.id,
      customer.descriptive_name,
      customer.currency_code,
      customer.manager
    FROM customer
    LIMIT 1
  `);

  accounts.push({
    customerId: accountInfo[0].customer.id,
    name: accountInfo[0].customer.descriptive_name || `Account ${customerId}`,
    isManager: accountInfo[0].customer.manager || false,
    currency: accountInfo[0].customer.currency_code
  });
}
```

#### C. New Endpoint: Save Selected Account

**Route**: `POST /api/google/connect`

**Body**:
```json
{
  "clientId": "uuid",
  "service": "ads",
  "session": "session-token",
  "selectedAccountId": "123-456-7890"
}
```

**Logic**:
1. Retrieve temporary tokens using session token
2. Verify the selected account ID is in the list of accessible accounts
3. Encrypt the refresh token
4. Save to database:
   - `google_ads_refresh_token_encrypted`
   - `google_ads_customer_id` (the selected account ID)
5. Delete temporary session tokens
6. Return success

**Response**:
```json
{
  "success": true,
  "accountId": "123-456-7890",
  "accountName": "Client A - Main Account"
}
```

#### D. Temporary Token Storage

Create a simple in-memory store or use Redis:

**File**: `apps/api/src/utils/temp-oauth-store.ts`

```typescript
interface TempOAuthSession {
  refreshToken: string;
  accessToken?: string;
  clientId: string;
  service: 'ads' | 'search_console';
  expiresAt: number;
}

const sessions = new Map<string, TempOAuthSession>();

export function storeTempSession(sessionToken: string, data: Omit<TempOAuthSession, 'expiresAt'>) {
  sessions.set(sessionToken, {
    ...data,
    expiresAt: Date.now() + 10 * 60 * 1000 // 10 minutes
  });
}

export function getTempSession(sessionToken: string): TempOAuthSession | null {
  const session = sessions.get(sessionToken);
  if (!session) return null;

  if (Date.now() > session.expiresAt) {
    sessions.delete(sessionToken);
    return null;
  }

  return session;
}

export function deleteTempSession(sessionToken: string) {
  sessions.delete(sessionToken);
}

// Cleanup expired sessions every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [token, session] of sessions.entries()) {
    if (now > session.expiresAt) {
      sessions.delete(token);
    }
  }
}, 5 * 60 * 1000);
```

### 2. Frontend Changes

#### A. New Page: Account Selection

**File**: `apps/web/src/pages/SelectAccount.tsx`

**URL**: `/onboarding/select-account?session=xxx&clientId=xxx&service=ads`

**UI Components**:
1. **Header**: "Select Google Ads Account"
2. **Description**: "Choose which Google Ads account to connect for this client"
3. **Account Cards**: Radio button list of available accounts showing:
   - Account name
   - Customer ID (formatted as 123-456-7890)
   - Account type badge (Manager/Client)
   - Currency
4. **Continue Button**: Disabled until an account is selected
5. **Loading State**: While fetching accounts
6. **Error State**: If fetching accounts fails

**Logic**:
```typescript
const [searchParams] = useSearchParams();
const session = searchParams.get('session');
const clientId = searchParams.get('clientId');
const service = searchParams.get('service');

const [accounts, setAccounts] = useState([]);
const [selectedAccountId, setSelectedAccountId] = useState(null);
const [loading, setLoading] = useState(true);

useEffect(() => {
  async function fetchAccounts() {
    const response = await api.get(`/api/google/accounts/${clientId}?session=${session}`);
    setAccounts(response.data.accounts);
    setLoading(false);
  }
  fetchAccounts();
}, []);

async function handleContinue() {
  await api.post('/api/google/connect', {
    clientId,
    service,
    session,
    selectedAccountId
  });

  // Redirect back to onboarding with success
  navigate(`/onboarding?step=complete&service=${service}&clientId=${clientId}`);
}
```

#### B. Update Onboarding Flow

**File**: `apps/web/src/pages/Onboarding.tsx`

**Change**: When returning from OAuth callback, if redirected to `/onboarding/select-account`, show that page instead of marking the connection as complete.

The account selection page will handle the redirect back to onboarding once complete.

### 3. User Experience Flow

```
1. User: Click "Connect Google Ads"
   → Frontend: GET /api/google/auth/initiate
   → Backend: Returns Google OAuth URL

2. User: Authorize on Google consent screen
   → Google: Redirects to /api/google/callback with code

3. Backend: OAuth callback handler
   → Exchange code for tokens
   → Store tokens temporarily with session token
   → Redirect to /onboarding/select-account?session=xxx&clientId=xxx&service=ads

4. Frontend: Account selection page loads
   → GET /api/google/accounts/:clientId?session=xxx
   → Backend: Fetches accessible Google Ads accounts
   → Frontend: Displays account cards

5. User: Selects account and clicks "Continue"
   → POST /api/google/connect
   → Backend: Saves selected account + encrypted tokens
   → Frontend: Redirects to /onboarding?step=complete&service=ads&clientId=xxx

6. Frontend: Shows "Google Ads Connected" success state
   → User proceeds to next step (Connect Search Console or Complete)
```

### 4. Error Handling

**Scenarios to handle**:

1. **Session expired** (10 minutes passed):
   - Show error: "Session expired. Please reconnect your Google account."
   - Button to restart OAuth flow

2. **No accessible accounts found**:
   - Show error: "No Google Ads accounts found. Make sure you have access to at least one Google Ads account."
   - Button to try again or skip

3. **Google API errors**:
   - Handle rate limiting
   - Handle permission errors
   - Show user-friendly error messages

4. **Network errors**:
   - Show retry button
   - Don't lose the session token

### 5. Testing Checklist

- [ ] OAuth flow redirects to account selection page
- [ ] Account list displays all accessible accounts
- [ ] Account selection saves correct customer ID to database
- [ ] Session expires after 10 minutes
- [ ] Error handling for expired sessions
- [ ] Error handling for API failures
- [ ] Works with manager accounts (multiple sub-accounts)
- [ ] Works with single account access
- [ ] Loading states display correctly
- [ ] Success redirect back to onboarding works
- [ ] Tokens are encrypted before storage
- [ ] Temporary tokens are cleaned up after use

### 6. Database Verification

After completing the flow, verify in the database:

```sql
SELECT
  id,
  name,
  google_ads_customer_id,
  google_ads_refresh_token_encrypted IS NOT NULL as has_token
FROM client_accounts
WHERE id = '<client-id>';
```

Should show:
- `google_ads_customer_id`: The selected account ID (e.g., "1234567890")
- `has_token`: true

### 7. Optional Enhancements (Future)

- Cache the account list for 5 minutes to avoid repeated API calls
- Show account performance preview (spend, campaigns) if available
- Allow filtering/searching accounts if user has many (10+)
- Show account hierarchy for manager accounts
- Remember last selected account per user

## Implementation Order

1. **Backend first**:
   - Create temp token storage utility
   - Modify OAuth callback to use temp storage
   - Implement GET /api/google/accounts/:clientId
   - Implement POST /api/google/connect

2. **Frontend**:
   - Create SelectAccount.tsx page
   - Add route to router
   - Test full flow end-to-end

3. **Testing**:
   - Test with multiple accounts
   - Test with single account
   - Test session expiration
   - Test error scenarios

## Success Criteria

✅ Users with multiple Google Ads accounts can see all accessible accounts
✅ Users can select which account to connect
✅ Selected account ID is saved to the database
✅ Temporary OAuth tokens are cleaned up after use
✅ Error states are handled gracefully
✅ Flow works seamlessly within the existing onboarding wizard

---

## Technical Notes

- Use `google-ads-api` package's `listAccessibleCustomers()` method
- Customer resource names are in format `customers/1234567890` - extract the ID
- Manager accounts will show multiple customer IDs
- Some accounts may be inaccessible even if listed - handle 403 errors
- Consider adding retry logic for Google API calls
- Log all account selections for audit purposes
