import { Router, Request, Response } from 'express';
import { google } from 'googleapis';
import { z } from 'zod';
import { GoogleAdsApi } from 'google-ads-api';
import { db } from '@/db/index.js';
import { clientAccounts, searchQueries, searchConsoleQueries } from '@/db/schema.js';
import { eq } from 'drizzle-orm';
import { encryptToken } from '@/services/encryption.service.js';
import { config } from '@/config/index.js';
import { logger } from '@/utils/logger.js';
import { tempOAuthStore } from '@/utils/temp-oauth-store.js';
import { getOrCreateQuery } from '@/services/query-matcher.service.js';

const router = Router();

// OAuth scopes for Google Ads and Search Console
const GOOGLE_ADS_SCOPES = ['https://www.googleapis.com/auth/adwords'];
const SEARCH_CONSOLE_SCOPES = ['https://www.googleapis.com/auth/webmasters.readonly'];

// Validation schemas
const initiateSchema = z.object({
  clientId: z.string().uuid(),
  service: z.enum(['ads', 'search_console']),
});

const disconnectSchema = z.object({
  clientId: z.string().uuid(),
  service: z.enum(['ads', 'search_console']),
});

const connectSchema = z.object({
  clientId: z.string().uuid(),
  service: z.enum(['ads', 'search_console']),
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

    // TODO: Add agency membership check via Clerk org membership
    // For now, we trust that the user has access if they know the clientId

    // Determine scopes based on service
    const scopes = service === 'ads' ? GOOGLE_ADS_SCOPES : SEARCH_CONSOLE_SCOPES;

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
    let stateData: { clientId: string; service: 'ads' | 'search_console' };
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
      logger.error({ clientId, service }, 'No refresh token received from Google');
      return res.redirect(
        `${config.frontendUrl}/clients/${clientId}/onboarding?error=${encodeURIComponent('No refresh token received. Please try again.')}`
      );
    }

    // For Google Ads, redirect to account selection page
    if (service === 'ads') {
      // Generate temporary session token
      const sessionToken = tempOAuthStore.generateSessionToken();

      // Store tokens temporarily
      tempOAuthStore.storeSession(sessionToken, {
        refreshToken: tokens.refresh_token!,
        accessToken: tokens.access_token || undefined,
        clientId,
        service,
      });

      logger.info({ clientId, sessionToken: sessionToken.substring(0, 8) + '...' }, 'Redirecting to Google Ads account selection');

      // Redirect to account selection page
      return res.redirect(
        `${config.frontendUrl}/onboarding/select-account?session=${sessionToken}&clientId=${clientId}&service=${service}`
      );
    }

    // For Search Console, also redirect to property selection
    // Generate temporary session token
    const sessionToken = tempOAuthStore.generateSessionToken();

    // Store tokens temporarily
    tempOAuthStore.storeSession(sessionToken, {
      refreshToken: tokens.refresh_token!,
      accessToken: tokens.access_token || undefined,
      clientId,
      service,
    });

    logger.info({ clientId, sessionToken: sessionToken.substring(0, 8) + '...' }, 'Redirecting to Search Console property selection');

    // Redirect to property selection page
    return res.redirect(
      `${config.frontendUrl}/onboarding/select-account?session=${sessionToken}&clientId=${clientId}&service=${service}`
    );
  } catch (error) {
    logger.error({ error }, 'Error in Google OAuth callback');
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

    // Verify client exists
    const [client] = await db
      .select()
      .from(clientAccounts)
      .where(eq(clientAccounts.id, clientId))
      .limit(1);

    if (!client) {
      return res.status(404).json({ error: 'Client not found' });
    }

    // TODO: Add agency membership check via Clerk org membership

    let accounts = [];

    if (config.useMockGoogleApis) {
      // Mock mode: return fake accounts
      const { listAccessibleAccountsMock } = await import('@/services/google-ads.service.mock.js');
      accounts = await listAccessibleAccountsMock();
      logger.info({ clientId, accountCount: accounts.length }, 'Returning mock Google Ads accounts');
    } else {
      // Real Google Ads API mode
      const googleAdsClient = new GoogleAdsApi({
        client_id: config.googleClientId!,
        client_secret: config.googleClientSecret!,
        developer_token: config.googleAdsDeveloperToken!,
      });

      logger.info({ clientId, sessionToken: session.substring(0, 8) + '...' }, 'Fetching accessible Google Ads accounts');

      // Fetch accessible customers
      const accessibleCustomers = await googleAdsClient.listAccessibleCustomers(oauthSession.refreshToken);

      const customerIds = accessibleCustomers.resource_names?.map((name: string) => {
        return name.replace('customers/', '');
      }) || [];

      if (customerIds.length === 0) {
        logger.warn({ clientId }, 'No accessible Google Ads accounts found');
        return res.json({ accounts: [] });
      }

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

      logger.info({ clientId, accountCount: accounts.length }, 'Successfully fetched Google Ads accounts');
    }

    res.json({ accounts });
  } catch (error) {
    logger.error({
      error: error instanceof Error ? { message: error.message, stack: error.stack } : error,
      clientId: req.params.clientId
    }, 'Error fetching Google Ads accounts');
    res.status(500).json({
      error: 'Failed to fetch Google Ads accounts',
      message: 'An error occurred while fetching your accounts. Please try again.',
    });
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
      return res.status(400).json({
        error: 'Session expired or invalid',
        message: 'Your session has expired. Please reconnect your Google account.',
      });
    }

    // Verify session belongs to this client
    if (oauthSession.clientId !== clientId) {
      return res.status(400).json({ error: 'Session does not match client' });
    }

    // Verify client exists
    const [client] = await db
      .select()
      .from(clientAccounts)
      .where(eq(clientAccounts.id, clientId))
      .limit(1);

    if (!client) {
      return res.status(404).json({ error: 'Client not found' });
    }

    // TODO: Add agency membership check via Clerk org membership

    let properties = [];

    if (config.useMockGoogleApis) {
      // Mock mode: return fake properties
      const { listSearchConsolePropertiesMock } = await import('@/services/search-console.service.mock.js');
      properties = await listSearchConsolePropertiesMock();
      logger.info({ clientId, propertyCount: properties.length }, 'Returning mock Search Console properties');
    } else {
      // Real Search Console API mode
      const { listSearchConsoleProperties } = await import('@/services/search-console.service.js');

      logger.info({ clientId, sessionToken: session.substring(0, 8) + '...' }, 'Fetching accessible Search Console properties');

      properties = await listSearchConsoleProperties(oauthSession.refreshToken);

      logger.info({ clientId, propertyCount: properties.length }, 'Successfully fetched Search Console properties');
    }

    res.json({ properties });
  } catch (error) {
    logger.error({
      error: error instanceof Error ? { message: error.message, stack: error.stack } : error,
      clientId: req.params.clientId
    }, 'Error fetching Search Console properties');
    res.status(500).json({
      error: 'Failed to fetch Search Console properties',
      message: 'An error occurred while fetching your properties. Please try again.',
    });
  }
});

/**
 * POST /api/google/connect
 * Saves the selected Google Ads account or Search Console property with encrypted tokens
 */
router.post('/connect', async (req: Request, res: Response) => {
  try {
    const { clientId, service, session, selectedAccountId } = connectSchema.parse(req.body);
    const userId = req.auth?.userId;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Retrieve temporary OAuth session
    const oauthSession = tempOAuthStore.getSession(session);

    if (!oauthSession) {
      return res.status(400).json({
        error: 'Session expired or invalid',
        message: 'Your session has expired. Please reconnect your Google account.',
      });
    }

    // Verify session matches request
    if (oauthSession.clientId !== clientId || oauthSession.service !== service) {
      return res.status(400).json({ error: 'Session does not match request' });
    }

    // Verify client exists
    const [client] = await db
      .select()
      .from(clientAccounts)
      .where(eq(clientAccounts.id, clientId))
      .limit(1);

    if (!client) {
      return res.status(404).json({ error: 'Client not found' });
    }

    // TODO: Add agency membership check via Clerk org membership

    // For Google Ads, verify the selected account exists and is accessible
    if (service === 'ads') {
      if (config.useMockGoogleApis) {
        // Mock mode: simple validation
        const { verifyAccountAccessMock } = await import('@/services/google-ads.service.mock.js');
        const isValid = await verifyAccountAccessMock(selectedAccountId);
        if (!isValid) {
          return res.status(400).json({ error: 'Selected account not accessible' });
        }
        logger.info({ clientId, selectedAccountId }, 'Verified mock Google Ads account access');
      } else {
        // Real Google Ads API verification
        try {
          const googleAdsClient = new GoogleAdsApi({
            client_id: config.googleClientId!,
            client_secret: config.googleClientSecret!,
            developer_token: config.googleAdsDeveloperToken!,
          });

          const customer = googleAdsClient.Customer({
            customer_id: selectedAccountId,
            refresh_token: oauthSession.refreshToken,
          });

          // Verify account is accessible
          const accountInfo = await customer.query(`
            SELECT customer.id, customer.descriptive_name
            FROM customer
            WHERE customer.id = ${selectedAccountId}
            LIMIT 1
          `);

          if (!accountInfo || accountInfo.length === 0) {
            return res.status(400).json({ error: 'Selected account not accessible' });
          }

          logger.info({ clientId, selectedAccountId }, 'Verified Google Ads account access');
        } catch (error) {
          logger.error({ error, clientId, selectedAccountId }, 'Failed to verify account access');
          return res.status(400).json({
            error: 'Failed to verify account access',
            message: 'Could not access the selected account. Please try again.',
          });
        }
      }
    }

    // For Search Console, verify the selected property exists and is accessible
    if (service === 'search_console') {
      if (config.useMockGoogleApis) {
        // Mock mode: simple validation
        const { verifyPropertyAccessMock } = await import('@/services/search-console.service.mock.js');
        const isValid = await verifyPropertyAccessMock(selectedAccountId);
        if (!isValid) {
          return res.status(400).json({ error: 'Selected property not accessible' });
        }
        logger.info({ clientId, siteUrl: selectedAccountId }, 'Verified mock Search Console property access');
      } else {
        // Real Search Console API verification
        try {
          const { verifyPropertyAccess } = await import('@/services/search-console.service.js');
          const isValid = await verifyPropertyAccess(oauthSession.refreshToken, selectedAccountId);

          if (!isValid) {
            return res.status(400).json({ error: 'Selected property not accessible' });
          }

          logger.info({ clientId, siteUrl: selectedAccountId }, 'Verified Search Console property access');
        } catch (error) {
          logger.error({ error, clientId, siteUrl: selectedAccountId }, 'Failed to verify property access');
          return res.status(400).json({
            error: 'Failed to verify property access',
            message: 'Could not access the selected property. Please try again.',
          });
        }
      }
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

      logger.info({ clientId, customerId: selectedAccountId }, 'Google Ads account connected successfully');
    } else {
      await db
        .update(clientAccounts)
        .set({
          searchConsoleRefreshTokenEncrypted: encrypted,
          searchConsoleRefreshTokenKeyVersion: keyVersion,
          searchConsoleSiteUrl: selectedAccountId,
          updatedAt: new Date(),
        })
        .where(eq(clientAccounts.id, clientId));

      logger.info({ clientId, siteUrl: selectedAccountId }, 'Search Console connected successfully');

      // Trigger initial Search Console data sync in the background (don't await)
      // This prevents the response from timing out on large datasets
      (async () => {
        try {
          const endDate = new Date().toISOString().split('T')[0];
          const startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
            .toISOString()
            .split('T')[0];

          logger.info({ clientId, startDate, endDate }, 'Starting initial Search Console sync');

          let scData;

          if (config.useMockGoogleApis) {
            // Mock mode: use mock service
            const { getSearchAnalyticsMock } = await import('@/services/search-console.service.mock.js');
            scData = await getSearchAnalyticsMock(clientId, startDate, endDate);
            logger.info({ clientId, recordCount: scData.length }, 'Fetched mock Search Console data');
          } else {
            // Real mode: use real service
            const { getSearchAnalytics } = await import('@/services/search-console.service.js');
            scData = await getSearchAnalytics(clientId, startDate, endDate);
            logger.info({ clientId, recordCount: scData.length }, 'Fetched real Search Console data');
          }

          // Insert data into database
          let insertedCount = 0;
          for (const row of scData) {
            try {
              // Get or create normalized query
              const query = await getOrCreateQuery(clientId, row.query);

              // Insert Search Console data
              await db.insert(searchConsoleQueries).values({
                clientAccountId: clientId,
                searchQueryId: query.id,
                date: row.date,
                impressions: row.impressions,
                clicks: row.clicks,
                ctr: row.ctr.toString(),
                position: row.position.toString(),
              }).onConflictDoNothing();

              insertedCount++;
            } catch (error) {
              logger.error(
                { error, clientId, query: row.query },
                'Failed to insert Search Console query record'
              );
              // Continue processing other records
            }
          }

          logger.info(
            { clientId, recordCount: scData.length, insertedCount },
            'Initial Search Console sync completed'
          );
        } catch (error) {
          logger.error({ error, clientId }, 'Initial Search Console sync failed - will retry later');
        }
      })();

      logger.info({ clientId }, 'Background sync triggered, returning success response');
    }

    // Delete temporary session
    tempOAuthStore.deleteSession(session);

    res.json({
      success: true,
      accountId: selectedAccountId,
      message: `${service === 'ads' ? 'Google Ads' : 'Search Console'} connected successfully`,
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

    // Verify client exists
    const [client] = await db
      .select()
      .from(clientAccounts)
      .where(eq(clientAccounts.id, clientId))
      .limit(1);

    if (!client) {
      return res.status(404).json({ error: 'Client not found' });
    }

    // TODO: Add agency membership check via Clerk org membership

    // Get encrypted token to revoke
    const encryptedToken =
      service === 'ads'
        ? client.googleAdsRefreshTokenEncrypted
        : client.searchConsoleRefreshTokenEncrypted;

    if (!encryptedToken) {
      return res.status(400).json({ error: 'No token to disconnect' });
    }

    // Note: We're not decrypting and revoking the token via Google API here
    // because it requires additional setup. For now, we just remove it from our DB.
    // In production, you should revoke the token via Google's revoke endpoint:
    // https://oauth2.googleapis.com/revoke?token={token}

    // Clear encrypted token from database
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

      logger.info({ clientId }, 'Google Ads disconnected');
    } else {
      await db
        .update(clientAccounts)
        .set({
          searchConsoleRefreshTokenEncrypted: null,
          searchConsoleRefreshTokenKeyVersion: null,
          searchConsoleSiteUrl: null,
          updatedAt: new Date(),
        })
        .where(eq(clientAccounts.id, clientId));

      logger.info({ clientId }, 'Search Console disconnected');
    }

    res.json({ success: true, message: `${service === 'ads' ? 'Google Ads' : 'Search Console'} disconnected successfully` });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid request parameters', details: error.errors });
    }
    logger.error({ error }, 'Error disconnecting Google OAuth');
    res.status(500).json({ error: 'Failed to disconnect OAuth' });
  }
});

export default router;
