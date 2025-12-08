import Papa from 'papaparse';
import { randomUUID } from 'crypto';
import { db } from '@/db/index.js';
import {
  csvUploads,
  searchQueries,
  googleAdsQueries,
  auctionInsights,
  campaignMetrics,
  deviceMetrics,
  dailyAccountMetrics,
} from '@/db/schema.js';
import { eq, and } from 'drizzle-orm';
import { logger } from '@/utils/logger.js';
import {
  detectGoogleAdsReportType,
  parseDateRangeFromFilename,
  type GoogleAdsReportType,
} from '@/utils/csv-file-detector.js';
import {
  GOOGLE_ADS_SEARCHES_COLUMNS,
  GOOGLE_ADS_KEYWORDS_COLUMNS,
  AUCTION_INSIGHTS_COLUMNS,
  CAMPAIGNS_COLUMNS,
  DEVICES_COLUMNS,
  TIME_SERIES_COLUMNS,
  normalizeColumnName,
  parseCurrencyToMicros,
  parsePercentage,
  parseInteger,
  parseDate,
  isBelowThreshold,
} from '@/utils/csv-column-mapper.js';
import { normalizeQuery, hashQuery } from '@/services/query-matcher.service.js';
import { generateInterplayReport, hasExistingReports } from '@/services/interplay-report/index.js';

// ============================================================================
// TYPES
// ============================================================================

export interface UploadSessionResult {
  sessionId: string;
  totalFiles: number;
  imported: ImportedFile[];
  skipped: SkippedFile[];
  failed: FailedFile[];
  dateRange: { start: string; end: string } | null;
}

interface ImportedFile {
  fileName: string;
  fileType: string;
  description: string;
  rowCount: number;
}

interface SkippedFile {
  fileName: string;
  reason: string;
}

interface FailedFile {
  fileName: string;
  error: string;
}

interface FileData {
  buffer: Buffer;
  filename: string;
  size: number;
}

// ============================================================================
// MAIN UPLOAD HANDLER
// ============================================================================

/**
 * Process multiple files in a single upload session
 */
export async function processUploadSession(
  clientAccountId: string,
  files: FileData[],
  uploadedBy: string
): Promise<UploadSessionResult> {
  const sessionId = randomUUID();
  const result: UploadSessionResult = {
    sessionId,
    totalFiles: files.length,
    imported: [],
    skipped: [],
    failed: [],
    dateRange: null,
  };

  logger.info({ sessionId, fileCount: files.length }, 'Starting upload session');

  for (const file of files) {
    try {
      const detection = detectGoogleAdsReportType(file.filename);

      if (!detection) {
        result.skipped.push({
          fileName: file.filename,
          reason: 'Unrecognized file format',
        });
        continue;
      }

      if (!detection.shouldStore) {
        // Tier 3: Validate but don't store
        await createUploadRecord(clientAccountId, sessionId, file, detection.type, 'skipped', uploadedBy);
        result.skipped.push({
          fileName: file.filename,
          reason: `${detection.description} (not needed for analysis)`,
        });
        continue;
      }

      // Extract date range from filename
      const dateRange = parseDateRangeFromFilename(file.filename);
      if (dateRange && !result.dateRange) {
        result.dateRange = dateRange;
      }

      // Process based on file type
      const importResult = await processFile(
        clientAccountId,
        sessionId,
        file,
        detection.type,
        dateRange,
        uploadedBy
      );

      result.imported.push({
        fileName: file.filename,
        fileType: detection.type,
        description: detection.description,
        rowCount: importResult.rowCount,
      });

    } catch (error) {
      logger.error({ error, fileName: file.filename }, 'Failed to process file');
      result.failed.push({
        fileName: file.filename,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  logger.info(
    {
      sessionId,
      imported: result.imported.length,
      skipped: result.skipped.length,
      failed: result.failed.length,
    },
    'Upload session complete'
  );

  // Check if Tier 1 data was uploaded - this enables AI report generation
  // Per Phase 4 spec, CSV uploads should auto-trigger report generation
  // when Tier 1 data is first uploaded
  const tier1FileTypes = ['google_ads_searches', 'google_ads_keywords', 'auction_insights'];
  // Note: Auto-report generation is now handled by the OAuth sync service
  // (client-sync.service.ts) which waits for all API data to be fetched.
  // CSV upload alone doesn't trigger reports to avoid racing with OAuth sync.
  const hasTier1Data = result.imported.some(f => tier1FileTypes.includes(f.fileType));

  if (hasTier1Data) {
    logger.info(
      { clientAccountId, sessionId, tier1Files: result.imported.filter(f => tier1FileTypes.includes(f.fileType)).length },
      'Tier 1 data uploaded - report generation will be triggered after OAuth sync completes'
    );
  }

  return result;
}

/**
 * Process a single file based on its type
 */
async function processFile(
  clientAccountId: string,
  sessionId: string,
  file: FileData,
  fileType: GoogleAdsReportType,
  dateRange: { start: string; end: string } | null,
  uploadedBy: string
): Promise<{ rowCount: number }> {
  const csvText = file.buffer.toString('utf-8');

  switch (fileType) {
    case 'google_ads_searches':
      return importGoogleAdsSearches(clientAccountId, sessionId, file, csvText, dateRange, uploadedBy);
    case 'google_ads_keywords':
      return importGoogleAdsKeywords(clientAccountId, sessionId, file, csvText, dateRange, uploadedBy);
    case 'auction_insights':
      return importAuctionInsights(clientAccountId, sessionId, file, csvText, dateRange, uploadedBy);
    case 'campaigns':
      return importCampaigns(clientAccountId, sessionId, file, csvText, dateRange, uploadedBy);
    case 'devices':
      return importDevices(clientAccountId, sessionId, file, csvText, dateRange, uploadedBy);
    case 'time_series':
      return importTimeSeries(clientAccountId, sessionId, file, csvText, uploadedBy);
    default:
      throw new Error(`Unsupported file type: ${fileType}`);
  }
}

// ============================================================================
// TIER 1 IMPORTERS
// ============================================================================

async function importGoogleAdsSearches(
  clientAccountId: string,
  sessionId: string,
  file: FileData,
  csvText: string,
  dateRange: { start: string; end: string } | null,
  uploadedBy: string
): Promise<{ rowCount: number }> {
  const parsed = Papa.parse(csvText, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h) => normalizeColumnName(h, GOOGLE_ADS_SEARCHES_COLUMNS),
  });

  let rowCount = 0;

  for (const row of parsed.data as Record<string, string>[]) {
    if (!row.queryText) continue;

    // Normalize and hash query
    const queryNormalized = normalizeQuery(row.queryText);
    const queryHash = hashQuery(queryNormalized);

    // Upsert search query
    await db
      .insert(searchQueries)
      .values({
        clientAccountId,
        queryText: row.queryText,
        queryNormalized,
        queryHash,
      })
      .onConflictDoNothing();

    // Get the search query ID
    const [existingQuery] = await db
      .select()
      .from(searchQueries)
      .where(and(
        eq(searchQueries.clientAccountId, clientAccountId),
        eq(searchQueries.queryHash, queryHash)
      ))
      .limit(1);

    if (!existingQuery) continue;

    // Insert Google Ads query data
    await db
      .insert(googleAdsQueries)
      .values({
        clientAccountId,
        searchQueryId: existingQuery.id,
        date: row.date ? parseDate(row.date) || dateRange?.end || new Date().toISOString().split('T')[0] : dateRange?.end || new Date().toISOString().split('T')[0],
        dateRangeStart: dateRange?.start,
        dateRangeEnd: dateRange?.end,
        impressions: parseInteger(row.impressions),
        clicks: parseInteger(row.clicks),
        costMicros: parseCurrencyToMicros(row.cost),
        conversions: row.conversions || '0',
        dataSource: 'csv_upload',
      })
      .onConflictDoNothing();

    rowCount++;
  }

  await createUploadRecord(clientAccountId, sessionId, file, 'google_ads_searches', 'completed', uploadedBy, rowCount, dateRange);
  return { rowCount };
}

async function importGoogleAdsKeywords(
  clientAccountId: string,
  sessionId: string,
  file: FileData,
  csvText: string,
  dateRange: { start: string; end: string } | null,
  uploadedBy: string
): Promise<{ rowCount: number }> {
  const parsed = Papa.parse(csvText, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h) => normalizeColumnName(h, GOOGLE_ADS_KEYWORDS_COLUMNS),
  });

  let rowCount = 0;

  for (const row of parsed.data as Record<string, string>[]) {
    if (!row.queryText) continue;

    const queryNormalized = normalizeQuery(row.queryText);
    const queryHash = hashQuery(queryNormalized);

    await db
      .insert(searchQueries)
      .values({
        clientAccountId,
        queryText: row.queryText,
        queryNormalized,
        queryHash,
      })
      .onConflictDoNothing();

    const [existingQuery] = await db
      .select()
      .from(searchQueries)
      .where(and(
        eq(searchQueries.clientAccountId, clientAccountId),
        eq(searchQueries.queryHash, queryHash)
      ))
      .limit(1);

    if (!existingQuery) continue;

    const ctrValue = parsePercentage(row.ctr, true);

    await db
      .insert(googleAdsQueries)
      .values({
        clientAccountId,
        searchQueryId: existingQuery.id,
        date: dateRange?.end || new Date().toISOString().split('T')[0],
        dateRangeStart: dateRange?.start,
        dateRangeEnd: dateRange?.end,
        clicks: parseInteger(row.clicks),
        costMicros: parseCurrencyToMicros(row.cost),
        ctr: ctrValue?.toString() || null,
        matchType: row.matchType,
        criterionStatus: row.criterionStatus,
        campaignStatus: row.campaignStatus,
        adGroupStatus: row.adGroupStatus,
        dataSource: 'csv_upload',
      })
      .onConflictDoNothing();

    rowCount++;
  }

  await createUploadRecord(clientAccountId, sessionId, file, 'google_ads_keywords', 'completed', uploadedBy, rowCount, dateRange);
  return { rowCount };
}

async function importAuctionInsights(
  clientAccountId: string,
  sessionId: string,
  file: FileData,
  csvText: string,
  dateRange: { start: string; end: string } | null,
  uploadedBy: string
): Promise<{ rowCount: number }> {
  if (!dateRange) {
    throw new Error('Date range required for auction insights');
  }

  const parsed = Papa.parse(csvText, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h) => normalizeColumnName(h, AUCTION_INSIGHTS_COLUMNS),
  });

  let rowCount = 0;

  for (const row of parsed.data as Record<string, string>[]) {
    if (!row.competitorDomain) continue;

    const isOwnAccount = row.competitorDomain.toLowerCase() === 'you';

    await db
      .insert(auctionInsights)
      .values({
        clientAccountId,
        // Segment columns (keyword-level granularity when present)
        campaignName: row.campaignName || null,
        adGroupName: row.adGroupName || null,
        keyword: row.keyword || null,
        keywordMatchType: row.keywordMatchType || null,
        // Competitor identification
        competitorDomain: row.competitorDomain,
        isOwnAccount,
        // Date range
        dateRangeStart: dateRange.start,
        dateRangeEnd: dateRange.end,
        // Core competitive metrics
        impressionShare: parsePercentage(row.impressionShare)?.toString() || null,
        lostImpressionShareRank: parsePercentage(row.lostImpressionShareRank)?.toString() || null,
        lostImpressionShareBudget: parsePercentage(row.lostImpressionShareBudget)?.toString() || null,
        // Additional competitive metrics
        outrankingShare: parsePercentage(row.outrankingShare)?.toString() || null,
        overlapRate: parsePercentage(row.overlapRate)?.toString() || null,
        topOfPageRate: parsePercentage(row.topOfPageRate)?.toString() || null,
        positionAboveRate: parsePercentage(row.positionAboveRate)?.toString() || null,
        absTopOfPageRate: parsePercentage(row.absTopOfPageRate)?.toString() || null,
        impressionShareBelowThreshold: isBelowThreshold(row.impressionShare),
        dataSource: 'csv_upload',
      });

    rowCount++;
  }

  await createUploadRecord(clientAccountId, sessionId, file, 'auction_insights', 'completed', uploadedBy, rowCount, dateRange);
  return { rowCount };
}

// ============================================================================
// TIER 2 IMPORTERS
// ============================================================================

async function importCampaigns(
  clientAccountId: string,
  sessionId: string,
  file: FileData,
  csvText: string,
  dateRange: { start: string; end: string } | null,
  uploadedBy: string
): Promise<{ rowCount: number }> {
  if (!dateRange) {
    throw new Error('Date range required for campaign metrics');
  }

  const parsed = Papa.parse(csvText, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h) => normalizeColumnName(h, CAMPAIGNS_COLUMNS),
  });

  let rowCount = 0;

  for (const row of parsed.data as Record<string, string>[]) {
    if (!row.campaignName) continue;

    const ctrValue = parsePercentage(row.ctr, true);

    await db
      .insert(campaignMetrics)
      .values({
        clientAccountId,
        campaignName: row.campaignName,
        campaignGroupName: row.campaignGroupName || null,
        campaignStatus: row.campaignStatus,
        dateRangeStart: dateRange.start,
        dateRangeEnd: dateRange.end,
        impressions: parseInteger(row.impressions),
        clicks: parseInteger(row.clicks),
        costMicros: parseCurrencyToMicros(row.cost),
        ctr: ctrValue?.toString() || null,
        dataSource: 'csv_upload',
      });

    rowCount++;
  }

  await createUploadRecord(clientAccountId, sessionId, file, 'campaigns', 'completed', uploadedBy, rowCount, dateRange);
  return { rowCount };
}

async function importDevices(
  clientAccountId: string,
  sessionId: string,
  file: FileData,
  csvText: string,
  dateRange: { start: string; end: string } | null,
  uploadedBy: string
): Promise<{ rowCount: number }> {
  if (!dateRange) {
    throw new Error('Date range required for device metrics');
  }

  const parsed = Papa.parse(csvText, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h) => normalizeColumnName(h, DEVICES_COLUMNS),
  });

  let rowCount = 0;

  for (const row of parsed.data as Record<string, string>[]) {
    if (!row.device) continue;

    await db
      .insert(deviceMetrics)
      .values({
        clientAccountId,
        device: row.device,
        dateRangeStart: dateRange.start,
        dateRangeEnd: dateRange.end,
        impressions: parseInteger(row.impressions),
        clicks: parseInteger(row.clicks),
        costMicros: parseCurrencyToMicros(row.cost),
        dataSource: 'csv_upload',
      });

    rowCount++;
  }

  await createUploadRecord(clientAccountId, sessionId, file, 'devices', 'completed', uploadedBy, rowCount, dateRange);
  return { rowCount };
}

async function importTimeSeries(
  clientAccountId: string,
  sessionId: string,
  file: FileData,
  csvText: string,
  uploadedBy: string
): Promise<{ rowCount: number }> {
  const parsed = Papa.parse(csvText, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h) => normalizeColumnName(h, TIME_SERIES_COLUMNS),
  });

  let rowCount = 0;
  let minDate: string | null = null;
  let maxDate: string | null = null;

  for (const row of parsed.data as Record<string, string>[]) {
    const date = parseDate(row.date);
    if (!date) continue;

    if (!minDate || date < minDate) minDate = date;
    if (!maxDate || date > maxDate) maxDate = date;

    await db
      .insert(dailyAccountMetrics)
      .values({
        clientAccountId,
        date,
        impressions: parseInteger(row.impressions),
        clicks: parseInteger(row.clicks),
        costMicros: parseCurrencyToMicros(row.cost),
        avgCpcMicros: parseCurrencyToMicros(row.avgCpc),
        dataSource: 'csv_upload',
      })
      .onConflictDoUpdate({
        target: [dailyAccountMetrics.clientAccountId, dailyAccountMetrics.date],
        set: {
          impressions: parseInteger(row.impressions),
          clicks: parseInteger(row.clicks),
          costMicros: parseCurrencyToMicros(row.cost),
          avgCpcMicros: parseCurrencyToMicros(row.avgCpc),
        },
      });

    rowCount++;
  }

  const dateRange = minDate && maxDate ? { start: minDate, end: maxDate } : null;
  await createUploadRecord(clientAccountId, sessionId, file, 'time_series', 'completed', uploadedBy, rowCount, dateRange);
  return { rowCount };
}

// ============================================================================
// HELPERS
// ============================================================================

async function createUploadRecord(
  clientAccountId: string,
  sessionId: string,
  file: FileData,
  fileType: string,
  status: string,
  uploadedBy: string,
  rowCount: number = 0,
  dateRange?: { start: string; end: string } | null
): Promise<void> {
  await db.insert(csvUploads).values({
    clientAccountId,
    uploadSessionId: sessionId,
    fileName: file.filename,
    fileType,
    fileSize: file.size,
    rowCount,
    dateRangeStart: dateRange?.start,
    dateRangeEnd: dateRange?.end,
    status,
    uploadedBy,
  });
}
