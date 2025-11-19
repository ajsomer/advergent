import { google } from 'googleapis';
import { db } from '@/db/index.js';
import { clientAccounts } from '@/db/schema.js';
import { eq } from 'drizzle-orm';
import { decryptToken } from './encryption.service.js';
import { config } from '@/config/index.js';
import { logger } from '@/utils/logger.js';

export interface GA4Property {
    propertyId: string;
    displayName: string;
}

export interface GA4DailyMetrics {
    date: string;
    sessions: number;
    engagementRate: number;
    viewsPerSession: number;
    conversions: number;
    totalRevenue: number;
    averageSessionDuration: number;
    bounceRate: number;
}

export interface GA4LandingPageMetric {
    date: string;
    landingPage: string;
    sessionSource: string;
    sessionMedium: string;
    sessions: number;
    engagementRate: number;
    conversions: number;
    totalRevenue: number;
    averageSessionDuration: number;
    bounceRate: number;
}


/**
 * Creates an authenticated Google Analytics Data API client
 */
async function getClient(
    clientAccountId: string
) {
    // Fetch client from database
    const [client] = await db
        .select()
        .from(clientAccounts)
        .where(eq(clientAccounts.id, clientAccountId))
        .limit(1);

    if (!client) {
        throw new Error(`Client account not found: ${clientAccountId}`);
    }

    if (!client.ga4RefreshTokenEncrypted) {
        throw new Error(`GA4 not connected for client: ${clientAccountId}`);
    }

    // Decrypt refresh token
    const refreshToken = await decryptToken(
        client.ga4RefreshTokenEncrypted,
        client.ga4RefreshTokenKeyVersion || 1
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

    return {
        analyticsData: google.analyticsdata({ version: 'v1beta', auth: oauth2Client }),
        analyticsAdmin: google.analyticsadmin({ version: 'v1beta', auth: oauth2Client }),
        propertyId: client.ga4PropertyId
    };
}

/**
 * Lists available GA4 properties for the user
 */
export async function listGA4Properties(refreshToken: string, accessToken?: string): Promise<GA4Property[]> {
    try {
        const oauth2Client = new google.auth.OAuth2(
            config.googleClientId,
            config.googleClientSecret,
            config.googleRedirectUri
        );

        oauth2Client.setCredentials({
            refresh_token: refreshToken,
            access_token: accessToken,
        });

        logger.info({
            hasRefreshToken: !!refreshToken,
            hasAccessToken: !!accessToken,
            refreshTokenLength: refreshToken?.length,
            refreshTokenPreview: refreshToken ? `${refreshToken.substring(0, 4)}...${refreshToken.substring(refreshToken.length - 4)}` : 'none'
        }, 'Initializing GA4 client with token');

        const analyticsAdmin = google.analyticsadmin({ version: 'v1beta', auth: oauth2Client });

        // List account summaries to find accessible properties
        const response = await analyticsAdmin.accountSummaries.list();

        const properties: GA4Property[] = [];

        if (response.data.accountSummaries) {
            for (const account of response.data.accountSummaries) {
                if (account.propertySummaries) {
                    for (const prop of account.propertySummaries) {
                        if (prop.property) {
                            properties.push({
                                propertyId: prop.property.replace('properties/', ''),
                                displayName: prop.displayName || 'Untitled Property',
                            });
                        }
                    }
                }
            }
        }

        return properties;
    } catch (error) {
        logger.error({ error }, 'Failed to list GA4 properties');
        throw error;
    }
}

/**
 * Fetches daily metrics from GA4
 */
export async function getGA4Analytics(
    clientAccountId: string,
    startDate: string,
    endDate: string
): Promise<GA4DailyMetrics[]> {
    try {
        const { analyticsData, propertyId } = await getClient(clientAccountId);

        if (!propertyId) {
            throw new Error(`GA4 Property ID not set for client: ${clientAccountId}`);
        }

        logger.info({ clientAccountId, propertyId, startDate, endDate }, 'Fetching GA4 analytics');

        const response = await analyticsData.properties.runReport({
            property: `properties/${propertyId}`,
            requestBody: {
                dateRanges: [{ startDate, endDate }],
                dimensions: [{ name: 'date' }],
                metrics: [
                    { name: 'sessions' },
                    { name: 'engagementRate' },
                    { name: 'screenPageViewsPerSession' },
                    { name: 'keyEvents' }, // Formerly conversions
                    { name: 'totalRevenue' },
                    { name: 'averageSessionDuration' },
                    { name: 'bounceRate' }
                ],
            },
        });

        const results: GA4DailyMetrics[] = [];

        if (response.data.rows) {
            for (const row of response.data.rows) {
                if (!row.dimensionValues?.[0]?.value) continue;

                // GA4 returns date as YYYYMMDD, need to convert to YYYY-MM-DD
                const dateStr = row.dimensionValues[0].value;
                const formattedDate = `${dateStr.substring(0, 4)}-${dateStr.substring(4, 6)}-${dateStr.substring(6, 8)}`;

                const metrics = row.metricValues || [];

                results.push({
                    date: formattedDate,
                    sessions: parseInt(metrics[0]?.value || '0', 10),
                    engagementRate: parseFloat(metrics[1]?.value || '0'),
                    viewsPerSession: parseFloat(metrics[2]?.value || '0'),
                    conversions: parseFloat(metrics[3]?.value || '0'),
                    totalRevenue: parseFloat(metrics[4]?.value || '0'),
                    averageSessionDuration: parseFloat(metrics[5]?.value || '0'),
                    bounceRate: parseFloat(metrics[6]?.value || '0'),
                });
            }
        }

        logger.info({ clientAccountId, recordCount: results.length }, 'GA4 analytics fetched successfully');
        return results;

    } catch (error) {
        logger.error({ error, clientAccountId }, 'Failed to fetch GA4 analytics');
        throw error;
    }
}

/**
 * Fetches landing page metrics from GA4 with session source/medium breakdown
 * Filters for organic Google traffic to correlate with Search Console data
 */
export async function getGA4LandingPageMetrics(
    clientAccountId: string,
    startDate: string,
    endDate: string
): Promise<GA4LandingPageMetric[]> {
    try {
        const { analyticsData, propertyId } = await getClient(clientAccountId);

        if (!propertyId) {
            throw new Error(`GA4 Property ID not set for client: ${clientAccountId}`);
        }

        logger.info({ clientAccountId, propertyId, startDate, endDate }, 'Fetching GA4 landing page metrics');

        const response = await analyticsData.properties.runReport({
            property: `properties/${propertyId}`,
            requestBody: {
                dateRanges: [{ startDate, endDate }],
                dimensions: [
                    { name: 'date' },
                    { name: 'landingPagePath' },
                    { name: 'sessionSource' },
                    { name: 'sessionMedium' }
                ],
                metrics: [
                    { name: 'sessions' },
                    { name: 'engagementRate' },
                    { name: 'keyEvents' }, // Conversions
                    { name: 'totalRevenue' },
                    { name: 'averageSessionDuration' },
                    { name: 'bounceRate' }
                ],
                // Filter for organic Google traffic
                dimensionFilter: {
                    andGroup: {
                        expressions: [
                            {
                                filter: {
                                    fieldName: 'sessionMedium',
                                    stringFilter: {
                                        matchType: 'EXACT',
                                        value: 'organic'
                                    }
                                }
                            },
                            {
                                filter: {
                                    fieldName: 'sessionSource',
                                    stringFilter: {
                                        matchType: 'EXACT',
                                        value: 'google'
                                    }
                                }
                            }
                        ]
                    }
                },
                // Order by sessions descending
                orderBys: [
                    {
                        metric: {
                            metricName: 'sessions'
                        },
                        desc: true
                    }
                ],
                // Limit to top 500 landing pages
                limit: '500'
            },
        });

        const results: GA4LandingPageMetric[] = [];

        if (response.data.rows) {
            for (const row of response.data.rows) {
                if (!row.dimensionValues?.[0]?.value) continue;

                // GA4 returns date as YYYYMMDD, need to convert to YYYY-MM-DD
                const dateStr = row.dimensionValues[0].value;
                const formattedDate = `${dateStr.substring(0, 4)}-${dateStr.substring(4, 6)}-${dateStr.substring(6, 8)}`;

                const landingPage = row.dimensionValues[1]?.value || '/';
                const sessionSource = row.dimensionValues[2]?.value || 'unknown';
                const sessionMedium = row.dimensionValues[3]?.value || 'unknown';

                const metrics = row.metricValues || [];

                results.push({
                    date: formattedDate,
                    landingPage,
                    sessionSource,
                    sessionMedium,
                    sessions: parseInt(metrics[0]?.value || '0', 10),
                    engagementRate: parseFloat(metrics[1]?.value || '0'),
                    conversions: parseFloat(metrics[2]?.value || '0'),
                    totalRevenue: parseFloat(metrics[3]?.value || '0'),
                    averageSessionDuration: parseFloat(metrics[4]?.value || '0'),
                    bounceRate: parseFloat(metrics[5]?.value || '0'),
                });
            }
        }

        logger.info({ clientAccountId, recordCount: results.length }, 'GA4 landing page metrics fetched successfully');
        return results;

    } catch (error) {
        logger.error({ error, clientAccountId }, 'Failed to fetch GA4 landing page metrics');
        throw error;
    }
}
