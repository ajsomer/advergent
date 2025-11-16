import { GoogleAdsApi } from 'google-ads-api';
import { db } from '@/db/index.js';
import { clientAccounts } from '@/db/schema.js';
import { eq } from 'drizzle-orm';
import { decryptToken } from './encryption.service.js';
import { config } from '@/config/index.js';
import { logger } from '@/utils/logger.js';

export interface GoogleAdsQuery {
  searchTerm: string;
  impressions: number;
  clicks: number;
  costMicros: number;
  conversions: number;
  ctr: number;
  averageCpc: number;
  campaignId: string;
  campaignName: string;
  adGroupId: string;
  adGroupName: string;
  date: string;
}

/**
 * Creates an authenticated Google Ads API client for a specific client account
 */
async function getClient(clientAccountId: string): Promise<{ client: GoogleAdsApi; customerId: string; refreshToken: string }> {
  // Fetch client from database
  const [client] = await db
    .select()
    .from(clientAccounts)
    .where(eq(clientAccounts.id, clientAccountId))
    .limit(1);

  if (!client) {
    throw new Error(`Client account not found: ${clientAccountId}`);
  }

  if (!client.googleAdsRefreshTokenEncrypted) {
    throw new Error(`Google Ads not connected for client: ${clientAccountId}`);
  }

  if (!client.googleAdsCustomerId) {
    throw new Error(`Google Ads customer ID not set for client: ${clientAccountId}`);
  }

  // Decrypt refresh token
  const refreshToken = await decryptToken(
    client.googleAdsRefreshTokenEncrypted,
    client.googleAdsRefreshTokenKeyVersion || 1
  );

  // Initialize Google Ads API client
  const googleAdsClient = new GoogleAdsApi({
    client_id: config.googleClientId!,
    client_secret: config.googleClientSecret!,
    developer_token: config.googleAdsDeveloperToken!,
  });

  logger.debug({ clientAccountId, customerId: client.googleAdsCustomerId }, 'Google Ads client initialized');

  return { client: googleAdsClient, customerId: client.googleAdsCustomerId, refreshToken };
}

/**
 * Fetches search query performance report from Google Ads
 */
export async function getSearchQueryReport(
  clientAccountId: string,
  startDate: string,
  endDate: string
): Promise<GoogleAdsQuery[]> {
  try {
    const { client: googleAdsClient, customerId, refreshToken } = await getClient(clientAccountId);

    // Create customer instance
    const customer = googleAdsClient.Customer({
      customer_id: customerId,
      refresh_token: refreshToken,
    });

    // GAQL query for search term performance
    const query = `
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
      LIMIT 25000
    `;

    logger.info(
      { clientAccountId, customerId, startDate, endDate },
      'Fetching Google Ads search query report'
    );

    // Execute query with streaming
    const results: GoogleAdsQuery[] = [];
    const stream = customer.queryStream(query);

    for await (const row of stream) {
      results.push({
        searchTerm: row.search_term_view?.search_term || '',
        impressions: Number(row.metrics?.impressions || 0),
        clicks: Number(row.metrics?.clicks || 0),
        costMicros: Number(row.metrics?.cost_micros || 0),
        conversions: Number(row.metrics?.conversions || 0),
        ctr: Number(row.metrics?.ctr || 0),
        averageCpc: Number(row.metrics?.average_cpc || 0),
        campaignId: String(row.campaign?.id || ''),
        campaignName: row.campaign?.name || '',
        adGroupId: String(row.ad_group?.id || ''),
        adGroupName: row.ad_group?.name || '',
        date: row.segments?.date || '',
      });
    }

    logger.info(
      { clientAccountId, customerId, recordCount: results.length },
      'Google Ads search query report fetched successfully'
    );

    return results;
  } catch (error) {
    logger.error(
      { error, clientAccountId, startDate, endDate },
      'Failed to fetch Google Ads search query report'
    );
    throw error;
  }
}

/**
 * Fetches list of accessible customer IDs for the authenticated account
 */
export async function getCustomerIds(clientAccountId: string): Promise<string[]> {
  try {
    const { client: googleAdsClient, refreshToken } = await getClient(clientAccountId);

    // Get accessible customers using the listAccessibleCustomers endpoint
    const response = await googleAdsClient.listAccessibleCustomers(refreshToken);

    const customerIds = response.resource_names?.map((name: string) => {
      // Extract customer ID from resource name format: customers/1234567890
      return name.replace('customers/', '');
    }) || [];

    logger.info({ clientAccountId, customerCount: customerIds.length }, 'Fetched accessible customer IDs');

    return customerIds;
  } catch (error) {
    logger.error({ error, clientAccountId }, 'Failed to fetch customer IDs');
    throw error;
  }
}

/**
 * Fetches Auction Insights data for competitive analysis
 * Note: This is a Phase 2 feature
 */
export async function getAuctionInsights(
  clientAccountId: string,
  startDate: string,
  endDate: string
): Promise<any[]> {
  // Note: Auction Insights is a Phase 2 feature
  // The Google Ads API doesn't directly expose auction insights via GAQL
  // This would require using the AdWords API or manual upload integration
  logger.warn({ clientAccountId }, 'Auction Insights feature not yet implemented (Phase 2)');
  return [];
}

/**
 * Main export for backwards compatibility
 * If USE_MOCK_GOOGLE_APIS=true, this will be overridden by the service factory
 */
export async function fetchGoogleAdsData(
  clientId: string,
  startDate: string,
  endDate: string
): Promise<GoogleAdsQuery[]> {
  return getSearchQueryReport(clientId, startDate, endDate);
}

export async function fetchAuctionInsights(
  clientId: string,
  startDate: string,
  endDate: string
): Promise<any[]> {
  return getAuctionInsights(clientId, startDate, endDate);
}
