import { Router, Request, Response } from 'express';
import { google } from 'googleapis';
import { z } from 'zod';
import { GoogleAdsApi } from 'google-ads-api';
import { db } from '@/db/index.js';
import { clientAccounts, searchQueries, searchConsoleQueries, ga4Metrics } from '@/db/schema.js';
import { eq } from 'drizzle-orm';
import { encryptToken } from '@/services/encryption.service.js';
import { config } from '@/config/index.js';
import { logger } from '@/utils/logger.js';
import { tempOAuthStore } from '@/utils/temp-oauth-store.js';
import { getOrCreateQuery } from '@/services/query-matcher.service.js';

const router = Router();

// OAuth scopes for Google Ads, Search Console, and GA4
const GOOGLE_ADS_SCOPES = ['https://www.googleapis.com/auth/adwords'];
const SEARCH_CONSOLE_SCOPES = ['https://www.googleapis.com/auth/webmasters.readonly'];
const GA4_SCOPES = ['https://www.googleapis.com/auth/analytics.readonly'];

// Validation schemas
const initiateSchema = z.object({
  clientId: z.string().uuid(),
  service: z.enum(['ads', 'search_console', 'ga4']),
});

const disconnectSchema = z.object({
  clientId: z.string().uuid(),
  service: z.enum(['ads', 'search_console', 'ga4']),
});

const connectSchema = z.object({
  clientId: z.string().uuid(),
  service: z.enum(['ads', 'search_console', 'ga4']),
  session: z.string(),
  selectedAccountId: z.string().min(1, 'Account ID or site URL is required'),
});

// Create OAuth2 client
function getOAuth2Client() {
  return new google.auth.OAuth2(
    config.googleClientId,
    config.googleClientSecret,
    config.googleRedirectUri
  );
}

/**
 * GET /api/google/auth/initiate
 * Initiates Google OAuth flow for a client
 */
router.get('/auth/initiate', async (req: Request, res: Response) => {
  try {
    const { clientId, service } = initiateSchema.parse(req.query);
    const userId = req.auth?.userId;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Verify client exists and user has access
    const [client] = await db
      .select()
      .from(clientAccounts)
      .where(eq(clientAccounts.id, clientId))
      .limit(1);

    if (!client) {
      return res.status(404).json({ error: 'Client not found' });
    }

    // Determine scopes based on service
    let scopes: string[] = [];
    if (service === 'ads') scopes = GOOGLE_ADS_SCOPES;
    else if (service === 'search_console') scopes = SEARCH_CONSOLE_SCOPES;
    else if (service === 'ga4') scopes = GA4_SCOPES;

    // Create OAuth2 client
    const oauth2Client = getOAuth2Client();

    // Generate state parameter with client ID and service
    const state = Buffer.from(JSON.stringify({ clientId, service })).toString('base64');

    // Generate authorization URL
    const authUrl = oauth2Client.generateAuthUrl({
      access_type: 'offline', // Request refresh token
      scope: scopes,
      state,
      prompt: 'consent', // Force consent screen to ensure refresh token
    });

    logger.info({ clientId, service }, 'Google OAuth flow initiated');

    res.json({ authUrl });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid request parameters', details: error.errors });
    }
    logger.error({ error }, 'Error initiating Google OAuth');
    res.status(500).json({ error: 'Failed to initiate OAuth flow' });
  }
});

/**
 * GET /api/google/callback
 * Handles OAuth callback from Google
 */
router.get('/callback', async (req: Request, res: Response) => {
  try {
    const { code, state, error } = req.query;

    // Handle OAuth error from Google
    if (error) {
      logger.error({ error }, 'Google OAuth error');
      return res.redirect(
        `${config.frontendUrl}/onboarding?error=${encodeURIComponent(String(error))}`
      );
    }

    if (!code || !state) {
      return res.redirect(
        `${config.frontendUrl}/onboarding?error=${encodeURIComponent('Missing authorization code or state')}`
      );
    }

    // Decode state parameter
    let stateData: { clientId: string; service: 'ads' | 'search_console' | 'ga4' };
    try {
      stateData = JSON.parse(Buffer.from(String(state), 'base64').toString('utf-8'));
    } catch (err) {
      logger.error({ error: err }, 'Failed to decode state parameter');
      return res.redirect(
        `${config.frontendUrl}/onboarding?error=${encodeURIComponent('Invalid state parameter')}`
      );
    }

    const { clientId, service } = stateData;

    // Verify client exists
    const [client] = await db
      .select()
      .from(clientAccounts)
      .where(eq(clientAccounts.id, clientId))
      .limit(1);

    if (!client) {
      return res.redirect(
        `${config.frontendUrl}/onboarding?error=${encodeURIComponent('Client not found')}`
      );
    }

    // Exchange authorization code for tokens
    let tokens: { refresh_token?: string | null; access_token?: string | null };

    if (config.useMockGoogleApis) {
      // Mock mode: generate fake tokens
      tokens = {
        refresh_token: `mock_refresh_token_${clientId}_${service}_${Date.now()}`,
        access_token: `mock_access_token_${clientId}_${service}_${Date.now()}`,
      };
      logger.info({ clientId, service }, 'Using mock OAuth tokens');
    } else {
      // Real OAuth flow
      const oauth2Client = getOAuth2Client();
      const tokenResponse = await oauth2Client.getToken(String(code));
      tokens = tokenResponse.tokens;
    }

    if (!tokens.refresh_token) {
      logger.warn({ clientId, service }, 'No refresh token received from Google');
      // We can't proceed without a refresh token for offline access
      return res.redirect(`${config.frontendUrl}/onboarding?error=${encodeURIComponent('Failed to get refresh token. Please try again.')}`);
    }

    // Store session temporarily
    const sessionToken = tempOAuthStore.generateSessionToken();
    tempOAuthStore.storeSession(sessionToken, {
      clientId,
      service: service as 'ads' | 'search_console' | 'ga4',
      refreshToken: tokens.refresh_token,
      accessToken: tokens.access_token || undefined,
    });

    logger.info({ clientId, service, sessionToken: sessionToken.substring(0, 8) + '...' }, 'Redirecting to account selection');

    // Redirect to account selection page
    return res.redirect(
      `${config.frontendUrl}/onboarding/select-account?session=${sessionToken}&clientId=${clientId}&service=${service}`
    );

  } catch (error: any) {
    logger.error({
      error: error.response?.data || error.message,
      clientId: req.query.clientId,
      service: req.query.service
    }, 'Error in Google OAuth callback');
    res.redirect(
      `${config.frontendUrl}/onboarding?error=${encodeURIComponent('OAuth callback failed')}`
    );
  }
});

/**
 * GET /api/google/accounts/:clientId
 * Fetches accessible Google Ads accounts for account selection
 */
router.get('/accounts/:clientId', async (req: Request, res: Response) => {
  try {
    const { clientId } = req.params;
    const { session } = req.query;
    const userId = req.auth?.userId;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    if (!session || typeof session !== 'string') {
      return res.status(400).json({ error: 'Missing session parameter' });
    }

    // Retrieve temporary OAuth session
    const oauthSession = tempOAuthStore.getSession(session);

    if (!oauthSession) {
      return res.status(400).json({
        error: 'Session expired or invalid',
        message: 'Your session has expired. Please reconnect your Google account.',
      });
    }

    // Verify session belongs to this client
    if (oauthSession.clientId !== clientId) {
      return res.status(400).json({ error: 'Session does not match client' });
    }

    let accounts = [];

    if (config.useMockGoogleApis) {
      // Mock mode: return fake accounts
      const { listAccessibleAccountsMock } = await import('@/services/google-ads.service.mock.js');
      accounts = await listAccessibleAccountsMock();
    } else {
      // Real Google Ads API mode
      const googleAdsClient = new GoogleAdsApi({
        client_id: config.googleClientId!,
        client_secret: config.googleClientSecret!,
        developer_token: config.googleAdsDeveloperToken!,
      });

      // Fetch accessible customers
      const accessibleCustomers = await googleAdsClient.listAccessibleCustomers(oauthSession.refreshToken);

      const customerIds = accessibleCustomers.resource_names?.map((name: string) => {
        return name.replace('customers/', '');
      }) || [];

      // Fetch account details for each customer
      for (const customerId of customerIds) {
        try {
          const customer = googleAdsClient.Customer({
            customer_id: customerId,
            refresh_token: oauthSession.refreshToken,
          });

          const accountInfo = await customer.query(`
            SELECT
              customer.id,
              customer.descriptive_name,
              customer.currency_code,
              customer.manager
            FROM customer
            WHERE customer.id = ${customerId}
            LIMIT 1
          `);

          if (accountInfo && accountInfo.length > 0) {
            const account = accountInfo[0];
            if (account.customer) {
              accounts.push({
                customerId: String(account.customer.id),
                name: account.customer.descriptive_name || `Account ${customerId}`,
                isManager: account.customer.manager || false,
                currency: account.customer.currency_code || 'USD',
              });
            }
          }
        } catch (error) {
          // Log but continue - some accounts may be inaccessible
          logger.warn({ clientId, customerId, error }, 'Failed to fetch account details');
        }
      }
    }

    res.json({ accounts });
  } catch (error) {
    logger.error({ error, clientId: req.params.clientId }, 'Error fetching Google Ads accounts');
    res.status(500).json({ error: 'Failed to fetch Google Ads accounts' });
  }
});

/**
 * GET /api/google/properties/:clientId
 * Fetches accessible Search Console properties for property selection
 */
router.get('/properties/:clientId', async (req: Request, res: Response) => {
  try {
    const { clientId } = req.params;
    const { session } = req.query;
    const userId = req.auth?.userId;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    if (!session || typeof session !== 'string') {
      return res.status(400).json({ error: 'Missing session parameter' });
    }

    // Retrieve temporary OAuth session
    const oauthSession = tempOAuthStore.getSession(session);

    if (!oauthSession) {
      return res.status(400).json({ error: 'Session expired or invalid' });
    }

    let properties = [];

    if (config.useMockGoogleApis) {
      // Mock mode
      const { listSearchConsolePropertiesMock } = await import('@/services/search-console.service.mock.js');
      properties = await listSearchConsolePropertiesMock();
    } else {
      // Real Search Console API mode
      const { listSearchConsoleProperties } = await import('@/services/search-console.service.js');
      properties = await listSearchConsoleProperties(oauthSession.refreshToken);
    }

    res.json({ properties });
  } catch (error) {
    logger.error({ error, clientId: req.params.clientId }, 'Error fetching Search Console properties');
    res.status(500).json({ error: 'Failed to fetch Search Console properties' });
  }
});

/**
 * GET /api/google/ga4-properties/:clientId
 * Fetches accessible GA4 properties
 */
router.get('/ga4-properties/:clientId', async (req: Request, res: Response) => {
  try {
    const { clientId } = req.params;
    const { session } = req.query;
    const userId = req.auth?.userId;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    if (!session || typeof session !== 'string') {
      return res.status(400).json({ error: 'Missing session parameter' });
    }

    const oauthSession = tempOAuthStore.getSession(session);

    if (!oauthSession) {
      return res.status(400).json({ error: 'Session expired or invalid' });
    }

    let properties = [];

    if (config.useMockGoogleApis) {
      // TODO: Implement mock for GA4 if needed, for now return empty or error
      properties = [{ propertyId: '123456', displayName: 'Mock GA4 Property' }];
    } else {
      const { listGA4Properties } = await import('@/services/ga4.service.js');
      logger.info({
        sessionToken: session,
        hasRefreshToken: !!oauthSession.refreshToken,
        hasAccessToken: !!oauthSession.accessToken,
        refreshTokenLength: oauthSession.refreshToken?.length
      }, 'Calling listGA4Properties');
      properties = await listGA4Properties(oauthSession.refreshToken, oauthSession.accessToken);
    }

    res.json({ properties });
  } catch (error) {
    logger.error({ error, clientId: req.params.clientId }, 'Error fetching GA4 properties');
    res.status(500).json({ error: 'Failed to fetch GA4 properties' });
  }
});

/**
 * POST /api/google/connect
 * Saves the selected Google Ads account, Search Console property, or GA4 property
 */
router.post('/connect', async (req: Request, res: Response) => {
  try {
    const { clientId, service, session, selectedAccountId } = connectSchema.parse(req.body);
    const userId = req.auth?.userId;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const oauthSession = tempOAuthStore.getSession(session);

    if (!oauthSession) {
      return res.status(400).json({ error: 'Session expired or invalid' });
    }

    if (oauthSession.clientId !== clientId || oauthSession.service !== service) {
      return res.status(400).json({ error: 'Session does not match request' });
    }

    // Encrypt refresh token
    const { encrypted, keyVersion } = await encryptToken(oauthSession.refreshToken);

    // Save to database
    if (service === 'ads') {
      await db
        .update(clientAccounts)
        .set({
          googleAdsRefreshTokenEncrypted: encrypted,
          googleAdsRefreshTokenKeyVersion: keyVersion,
          googleAdsCustomerId: selectedAccountId,
          updatedAt: new Date(),
        })
        .where(eq(clientAccounts.id, clientId));

      logger.info({ clientId }, 'Google Ads connected');

      // Trigger initial sync (background)
      (async () => {
        try {
          const { runClientSync } = await import('@/services/client-sync.service.js');
          await runClientSync(clientId, 'manual');
          logger.info({ clientId }, 'Initial Google Ads sync completed');
        } catch (error) {
          logger.error({ error, clientId }, 'Initial Google Ads sync failed');
        }
      })();

    } else if (service === 'search_console') {
      await db
        .update(clientAccounts)
        .set({
          searchConsoleRefreshTokenEncrypted: encrypted,
          searchConsoleRefreshTokenKeyVersion: keyVersion,
          searchConsoleSiteUrl: selectedAccountId,
          updatedAt: new Date(),
        })
        .where(eq(clientAccounts.id, clientId));

      logger.info({ clientId }, 'Search Console connected');

      // Trigger initial sync (background)
      (async () => {
        try {
          const { runClientSync } = await import('@/services/client-sync.service.js');
          await runClientSync(clientId, 'manual');
          logger.info({ clientId }, 'Initial Search Console sync completed');
        } catch (error) {
          logger.error({ error, clientId }, 'Initial Search Console sync failed');
        }
      })();

    } else if (service === 'ga4') {
      await db
        .update(clientAccounts)
        .set({
          ga4RefreshTokenEncrypted: encrypted,
          ga4RefreshTokenKeyVersion: keyVersion,
          ga4PropertyId: selectedAccountId,
          updatedAt: new Date(),
        })
        .where(eq(clientAccounts.id, clientId));

      logger.info({ clientId }, 'GA4 connected');

      // Trigger initial GA4 sync
      (async () => {
        try {
          const endDate = new Date().toISOString().split('T')[0];
          const startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
            .toISOString()
            .split('T')[0];

          let ga4Data: any[] = [];
          if (config.useMockGoogleApis) {
            // Mock data
            ga4Data = [];
          } else {
            const { getGA4Analytics } = await import('@/services/ga4.service.js');
            ga4Data = await getGA4Analytics(clientId, startDate, endDate);
          }

          // Insert GA4 data
          for (const row of ga4Data) {
            await db.insert(ga4Metrics).values({
              clientAccountId: clientId,
              date: row.date,
              sessions: row.sessions,
              engagementRate: row.engagementRate.toString(),
              viewsPerSession: row.viewsPerSession.toString(),
              conversions: row.conversions.toString(),
              totalRevenue: row.totalRevenue.toString(),
              averageSessionDuration: row.averageSessionDuration.toString(),
              bounceRate: row.bounceRate.toString(),
            }).onConflictDoNothing();
          }

          logger.info({ clientId, recordCount: ga4Data.length }, 'Initial GA4 sync completed');
        } catch (error) {
          logger.error({ error, clientId }, 'Initial GA4 sync failed');
        }
      })();
    }

    // Delete temporary session
    tempOAuthStore.deleteSession(session);

    res.json({
      success: true,
      accountId: selectedAccountId,
      message: `${service === 'ads' ? 'Google Ads' : service === 'ga4' ? 'GA4' : 'Search Console'} connected successfully`,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid request parameters', details: error.errors });
    }
    logger.error({ error }, 'Error connecting Google OAuth');
    res.status(500).json({ error: 'Failed to connect account' });
  }
});

/**
 * POST /api/google/disconnect
 * Disconnects Google OAuth for a client
 */
router.post('/disconnect', async (req: Request, res: Response) => {
  try {
    const { clientId, service } = disconnectSchema.parse(req.body);
    const userId = req.auth?.userId;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    if (service === 'ads') {
      await db
        .update(clientAccounts)
        .set({
          googleAdsRefreshTokenEncrypted: null,
          googleAdsRefreshTokenKeyVersion: null,
          googleAdsCustomerId: null,
          updatedAt: new Date(),
        })
        .where(eq(clientAccounts.id, clientId));
    } else if (service === 'search_console') {
      await db
        .update(clientAccounts)
        .set({
          searchConsoleRefreshTokenEncrypted: null,
          searchConsoleRefreshTokenKeyVersion: null,
          searchConsoleSiteUrl: null,
          updatedAt: new Date(),
        })
        .where(eq(clientAccounts.id, clientId));
    } else if (service === 'ga4') {
      await db
        .update(clientAccounts)
        .set({
          ga4RefreshTokenEncrypted: null,
          ga4RefreshTokenKeyVersion: null,
          ga4PropertyId: null,
          updatedAt: new Date(),
        })
        .where(eq(clientAccounts.id, clientId));
    }

    res.json({ success: true, message: 'Disconnected successfully' });
  } catch (error) {
    logger.error({ error }, 'Error disconnecting');
    res.status(500).json({ error: 'Failed to disconnect' });
  }
});

export default router;

