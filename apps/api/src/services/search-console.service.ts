import { google, webmasters_v3 } from 'googleapis';
import { db } from '@/db/index.js';
import { clientAccounts } from '@/db/schema.js';
import { eq } from 'drizzle-orm';
import { decryptToken } from './encryption.service.js';
import { config } from '@/config/index.js';
import { logger } from '@/utils/logger.js';

export interface SearchConsoleQuery {
  query: string;
  impressions: number;
  clicks: number;
  ctr: number;
  position: number;
  date: string;
  page?: string;
  device?: string;
  country?: string;
  searchAppearance?: string;
  searchType?: string;
}

export interface SearchConsoleProperty {
  siteUrl: string;
  permissionLevel: string;
}

/**
 * Creates an authenticated Google Search Console client for a specific client account
 */
async function getClient(
  clientAccountId: string
): Promise<{ client: webmasters_v3.Webmasters; siteUrl: string }> {
  // Fetch client from database
  const [client] = await db
    .select()
    .from(clientAccounts)
    .where(eq(clientAccounts.id, clientAccountId))
    .limit(1);

  if (!client) {
    throw new Error(`Client account not found: ${clientAccountId}`);
  }

  if (!client.searchConsoleRefreshTokenEncrypted) {
    throw new Error(`Search Console not connected for client: ${clientAccountId}`);
  }

  if (!client.searchConsoleSiteUrl) {
    throw new Error(`Search Console site URL not set for client: ${clientAccountId}`);
  }

  // Decrypt refresh token
  const refreshToken = await decryptToken(
    client.searchConsoleRefreshTokenEncrypted,
    client.searchConsoleRefreshTokenKeyVersion || 1
  );

  // Initialize OAuth2 client
  const oauth2Client = new google.auth.OAuth2(
    config.googleClientId,
    config.googleClientSecret,
    config.googleRedirectUri
  );

  // Set credentials with refresh token
  oauth2Client.setCredentials({
    refresh_token: refreshToken,
  });

  // Initialize Search Console API client
  const webmasters = google.webmasters({
    version: 'v3',
    auth: oauth2Client,
  });

  logger.debug(
    { clientAccountId, siteUrl: client.searchConsoleSiteUrl },
    'Search Console client initialized'
  );

  return { client: webmasters, siteUrl: client.searchConsoleSiteUrl };
}

/**
 * Fetches search analytics data from Google Search Console
 */
export async function getSearchAnalytics(
  clientAccountId: string,
  startDate: string,
  endDate: string
): Promise<SearchConsoleQuery[]> {
  try {
    const { client: webmasters, siteUrl } = await getClient(clientAccountId);

    logger.info(
      { clientAccountId, siteUrl, startDate, endDate },
      'Fetching Search Console analytics'
    );

    // Make API request
    const response = await webmasters.searchanalytics.query({
      siteUrl,
      requestBody: {
        startDate, // YYYY-MM-DD format
        endDate,
        dimensions: ['query', 'date', 'page', 'device', 'country', 'searchAppearance'],
        rowLimit: 25000,
        dataState: 'all', // Include fresh data (not just final)
      },
    });

    // Transform results
    const results: SearchConsoleQuery[] = [];

    if (response.data.rows) {
      for (const row of response.data.rows) {
        if (!row.keys) continue;

        results.push({
          query: row.keys[0] || '',
          date: row.keys[1] || '',
          page: row.keys[2] || undefined,
          device: row.keys[3] || undefined,
          country: row.keys[4] || undefined,
          searchAppearance: row.keys[5] || undefined,
          searchType: 'web', // Default to 'web' since we're not filtering by type
          impressions: row.impressions || 0,
          clicks: row.clicks || 0,
          ctr: row.ctr || 0,
          position: row.position || 0,
        });
      }
    }

    logger.info(
      { clientAccountId, siteUrl, recordCount: results.length },
      'Search Console analytics fetched successfully'
    );

    return results;
  } catch (error) {
    logger.error(
      { error, clientAccountId, startDate, endDate },
      'Failed to fetch Search Console analytics'
    );
    throw error;
  }
}

/**
 * Fetches list of verified sites for the authenticated account
 */
export async function getSiteUrls(clientAccountId: string): Promise<string[]> {
  try {
    const [clientData] = await db
      .select()
      .from(clientAccounts)
      .where(eq(clientAccounts.id, clientAccountId))
      .limit(1);

    if (!clientData) {
      throw new Error(`Client account not found: ${clientAccountId}`);
    }

    if (!clientData.searchConsoleRefreshTokenEncrypted) {
      throw new Error(`Search Console not connected for client: ${clientAccountId}`);
    }

    // Decrypt refresh token
    const refreshToken = await decryptToken(
      clientData.searchConsoleRefreshTokenEncrypted,
      clientData.searchConsoleRefreshTokenKeyVersion || 1
    );

    // Initialize OAuth2 client
    const oauth2Client = new google.auth.OAuth2(
      config.googleClientId,
      config.googleClientSecret,
      config.googleRedirectUri
    );

    oauth2Client.setCredentials({
      refresh_token: refreshToken,
    });

    // Initialize Search Console API client
    const webmasters = google.webmasters({
      version: 'v3',
      auth: oauth2Client,
    });

    // Fetch sites list
    const response = await webmasters.sites.list();

    const siteUrls = (response.data.siteEntry || [])
      .filter((site) => site.permissionLevel !== 'siteUnverifiedUser')
      .map((site) => site.siteUrl || '')
      .filter(Boolean);

    logger.info({ clientAccountId, siteCount: siteUrls.length }, 'Fetched verified site URLs');

    return siteUrls;
  } catch (error) {
    logger.error({ error, clientAccountId }, 'Failed to fetch site URLs');
    throw error;
  }
}

/**
 * Lists all Search Console properties accessible by the provided refresh token
 * Used during OAuth onboarding for property selection
 */
export async function listSearchConsoleProperties(
  refreshToken: string
): Promise<SearchConsoleProperty[]> {
  try {
    // Initialize OAuth2 client
    const oauth2Client = new google.auth.OAuth2(
      config.googleClientId,
      config.googleClientSecret,
      config.googleRedirectUri
    );

    oauth2Client.setCredentials({
      refresh_token: refreshToken,
    });

    // Initialize Search Console API client
    const webmasters = google.webmasters({
      version: 'v3',
      auth: oauth2Client,
    });

    logger.info('Fetching Search Console properties');

    // Fetch sites list
    const response = await webmasters.sites.list();

    const properties: SearchConsoleProperty[] = (response.data.siteEntry || [])
      .filter((site) => site.permissionLevel && site.permissionLevel !== 'siteUnverifiedUser')
      .map((site) => ({
        siteUrl: site.siteUrl || '',
        permissionLevel: site.permissionLevel || '',
      }))
      .filter((prop) => prop.siteUrl);

    logger.info({ propertyCount: properties.length }, 'Search Console properties fetched successfully');

    return properties;
  } catch (error) {
    logger.error({ error }, 'Failed to list Search Console properties');
    throw error;
  }
}

/**
 * Verifies that the user has access to a specific Search Console property
 */
export async function verifyPropertyAccess(
  refreshToken: string,
  siteUrl: string
): Promise<boolean> {
  try {
    // Initialize OAuth2 client
    const oauth2Client = new google.auth.OAuth2(
      config.googleClientId,
      config.googleClientSecret,
      config.googleRedirectUri
    );

    oauth2Client.setCredentials({
      refresh_token: refreshToken,
    });

    // Initialize Search Console API client
    const webmasters = google.webmasters({
      version: 'v3',
      auth: oauth2Client,
    });

    logger.info({ siteUrl }, 'Verifying Search Console property access');

    // Try to get the specific site
    const response = await webmasters.sites.get({ siteUrl });

    // If we get a response with permission level, user has access
    const hasAccess = !!response.data.permissionLevel &&
                      response.data.permissionLevel !== 'siteUnverifiedUser';

    logger.info({ siteUrl, hasAccess }, 'Property access verification complete');

    return hasAccess;
  } catch (error) {
    logger.error({ error, siteUrl }, 'Failed to verify property access');
    return false;
  }
}

/**
 * Main export for backwards compatibility
 * If USE_MOCK_GOOGLE_APIS=true, this will be overridden by the service factory
 */
export async function fetchSearchConsoleData(
  clientId: string,
  startDate: string,
  endDate: string
): Promise<SearchConsoleQuery[]> {
  return getSearchAnalytics(clientId, startDate, endDate);
}
