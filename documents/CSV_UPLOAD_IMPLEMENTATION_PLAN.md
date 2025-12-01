# CSV Upload Implementation Plan

## Overview

This plan outlines adding CSV file upload as an alternative data source alongside OAuth integration. This allows agencies to import Google Ads and Search Console data manually while waiting for API developer token approval.

---

## Architecture Decision

**CSV Upload as a Parallel Option to OAuth**

```
┌─────────────────────────────────────────────────────────────┐
│                    Client Data Sources                       │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│   ┌──────────────────┐         ┌──────────────────┐         │
│   │   Google OAuth   │   OR    │   CSV Upload     │         │
│   │   (API Sync)     │         │   (Manual)       │         │
│   └────────┬─────────┘         └────────┬─────────┘         │
│            │                            │                    │
│            └──────────┬─────────────────┘                    │
│                       ▼                                      │
│            ┌──────────────────┐                              │
│            │  Normalized Data │                              │
│            │  (Same Schema)   │                              │
│            └────────┬─────────┘                              │
│                     ▼                                        │
│            ┌──────────────────┐                              │
│            │    Reports &     │                              │
│            │  Recommendations │                              │
│            └──────────────────┘                              │
└─────────────────────────────────────────────────────────────┘
```

---

## Google Ads CSV Export Format

### How Users Export from Google Ads

1. Go to **Google Ads** > **Reports** or **Keywords** > **Search terms**
2. Select date range
3. Click **Download** > **CSV** or **.csv (Excel)**

### Standard Google Ads Search Terms Report Columns

Based on [Google Ads documentation](https://support.google.com/google-ads/answer/2454071):

| Google Ads Column | Our Schema Field | Notes |
|-------------------|------------------|-------|
| `Search term` | `queryText` | The actual search query |
| `Campaign` | `campaignName` | Campaign name |
| `Campaign ID` | `campaignId` | Numeric campaign ID |
| `Ad group` | `adGroupName` | Ad group name |
| `Ad group ID` | `adGroupId` | Numeric ad group ID |
| `Impressions` / `Impr.` | `impressions` | Number of impressions |
| `Clicks` | `clicks` | Number of clicks |
| `Cost` | `costMicros` | Convert $ to micros (*1,000,000) |
| `CTR` | `ctr` | Click-through rate (strip %) |
| `Avg. CPC` | `avgCpcMicros` | Convert $ to micros |
| `Conversions` / `Conv.` | `conversions` | Conversion count |
| `Day` / `Date` | `date` | YYYY-MM-DD format |

### Column Name Variations to Handle

Google exports columns with varying names depending on the report type:

```typescript
const GOOGLE_ADS_COLUMN_MAPPINGS = {
  // Query text
  'Search term': 'queryText',
  'Search Term': 'queryText',
  'Query': 'queryText',

  // Campaign
  'Campaign': 'campaignName',
  'Campaign name': 'campaignName',
  'Campaign ID': 'campaignId',

  // Ad Group
  'Ad group': 'adGroupName',
  'Ad Group': 'adGroupName',
  'Ad group name': 'adGroupName',
  'Ad group ID': 'adGroupId',
  'Ad Group ID': 'adGroupId',

  // Metrics
  'Impressions': 'impressions',
  'Impr.': 'impressions',
  'Clicks': 'clicks',
  'Cost': 'cost',
  'Spend': 'cost',
  'CTR': 'ctr',
  'Click-through rate': 'ctr',
  'Avg. CPC': 'avgCpc',
  'Average CPC': 'avgCpc',
  'Conversions': 'conversions',
  'Conv.': 'conversions',
  'All conv.': 'conversions',

  // Date
  'Day': 'date',
  'Date': 'date',
};
```

---

## Search Console CSV Export Format

### How Users Export from Search Console

1. Go to **Search Console** > **Performance**
2. Select date range and filters
3. Click **Export** > **Download CSV**

Based on [Google Search Console documentation](https://support.google.com/webmasters/answer/12919797):

### Standard Search Console Columns

| Search Console Column | Our Schema Field | Notes |
|----------------------|------------------|-------|
| `Query` / `Top queries` | `queryText` | Search query |
| `Clicks` | `clicks` | Number of clicks |
| `Impressions` | `impressions` | Number of impressions |
| `CTR` | `ctr` | Click-through rate (strip %) |
| `Position` | `position` | Average position |
| `Page` / `Top pages` | `page` | Landing page URL |
| `Device` | `device` | DESKTOP, MOBILE, TABLET |
| `Country` | `country` | 3-letter country code |
| `Date` | `date` | YYYY-MM-DD format |

### Column Name Variations

```typescript
const SEARCH_CONSOLE_COLUMN_MAPPINGS = {
  // Query
  'Query': 'queryText',
  'Top queries': 'queryText',
  'Queries': 'queryText',

  // Metrics
  'Clicks': 'clicks',
  'Impressions': 'impressions',
  'CTR': 'ctr',
  'Position': 'position',
  'Average position': 'position',

  // Dimensions
  'Page': 'page',
  'Top pages': 'page',
  'Pages': 'page',
  'Device': 'device',
  'Country': 'country',
  'Date': 'date',
};
```

---

## Recommended Libraries

### Primary: papaparse
- **Purpose**: CSV parsing with streaming support
- **Why**: Most popular, handles edge cases well, browser + Node.js
- **Stars**: 12,000+ on GitHub
- **Weekly downloads**: 2,500,000+

```bash
npm install papaparse
npm install -D @types/papaparse
```

### Secondary: react-dropzone
- **Purpose**: Drag-and-drop file upload UI
- **Why**: Lightweight, accessible, widely used
- **Stars**: 10,000+ on GitHub

```bash
npm install react-dropzone
```

---

## Implementation Phases

### Phase 1: Database Schema Updates

**Goal**: Track data source (API vs CSV) and upload metadata.

#### Schema Changes

```typescript
// Add to schema.ts

// New enum for data source
export const dataSourceEnum = pgEnum('data_source', ['api', 'csv_upload']);

// New table for tracking CSV uploads
export const csvUploads = pgTable('csv_uploads', {
  id: uuid('id').primaryKey().defaultRandom(),
  clientAccountId: uuid('client_account_id').notNull().references(() => clientAccounts.id, { onDelete: 'cascade' }),
  uploadType: varchar('upload_type', { length: 50 }).notNull(), // 'google_ads' | 'search_console'
  fileName: varchar('file_name', { length: 255 }).notNull(),
  fileSize: integer('file_size').notNull(),
  rowCount: integer('row_count').notNull(),
  dateRangeStart: date('date_range_start'),
  dateRangeEnd: date('date_range_end'),
  uploadedBy: uuid('uploaded_by').references(() => users.id),
  status: varchar('status', { length: 20 }).default('processing'), // processing, completed, failed
  errorMessage: text('error_message'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
}, (table) => ({
  clientIdx: index('idx_csv_uploads_client').on(table.clientAccountId),
  typeIdx: index('idx_csv_uploads_type').on(table.uploadType),
  statusIdx: index('idx_csv_uploads_status').on(table.status),
}));

// Add data source column to existing tables
// googleAdsQueries: add dataSource column
// searchConsoleQueries: add dataSource column
```

#### Migration

```sql
-- 0008_csv_upload_support.sql

-- Add data source enum
CREATE TYPE data_source AS ENUM ('api', 'csv_upload');

-- Add data source to google_ads_queries
ALTER TABLE google_ads_queries
ADD COLUMN data_source data_source DEFAULT 'api';

-- Add data source to search_console_queries
ALTER TABLE search_console_queries
ADD COLUMN data_source data_source DEFAULT 'api';

-- Create csv_uploads table
CREATE TABLE csv_uploads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_account_id UUID NOT NULL REFERENCES client_accounts(id) ON DELETE CASCADE,
  upload_type VARCHAR(50) NOT NULL,
  file_name VARCHAR(255) NOT NULL,
  file_size INTEGER NOT NULL,
  row_count INTEGER NOT NULL,
  date_range_start DATE,
  date_range_end DATE,
  uploaded_by UUID REFERENCES users(id),
  status VARCHAR(20) DEFAULT 'processing',
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_csv_uploads_client ON csv_uploads(client_account_id);
CREATE INDEX idx_csv_uploads_type ON csv_uploads(upload_type);
CREATE INDEX idx_csv_uploads_status ON csv_uploads(status);
```

---

### Phase 2: Backend CSV Processing Service

**Goal**: Parse, validate, and import CSV data into the database.

#### New Files

```
apps/api/src/
├── services/
│   └── csv-import.service.ts      # Main CSV processing logic
├── routes/
│   └── csv-upload.routes.ts       # Upload endpoints
└── utils/
    ├── csv-column-mapper.ts       # Column name normalization
    └── csv-validators.ts          # Data validation
```

#### CSV Import Service

```typescript
// apps/api/src/services/csv-import.service.ts

import Papa from 'papaparse';
import { db } from '@/db';
import { googleAdsQueries, searchConsoleQueries, searchQueries, csvUploads } from '@/db/schema';
import { normalizeQuery, hashQuery } from '@/services/query-matcher.service';
import { GOOGLE_ADS_COLUMN_MAPPINGS, SEARCH_CONSOLE_COLUMN_MAPPINGS } from '@/utils/csv-column-mapper';
import { logger } from '@/utils/logger';

interface CSVImportResult {
  success: boolean;
  rowsProcessed: number;
  rowsSkipped: number;
  errors: string[];
  dateRange: { start: string; end: string } | null;
}

export async function importGoogleAdsCSV(
  clientAccountId: string,
  fileBuffer: Buffer,
  fileName: string,
  uploadedBy: string
): Promise<CSVImportResult> {
  const result: CSVImportResult = {
    success: false,
    rowsProcessed: 0,
    rowsSkipped: 0,
    errors: [],
    dateRange: null,
  };

  // Create upload record
  const [upload] = await db.insert(csvUploads).values({
    clientAccountId,
    uploadType: 'google_ads',
    fileName,
    fileSize: fileBuffer.length,
    rowCount: 0,
    uploadedBy,
    status: 'processing',
  }).returning();

  try {
    const csvText = fileBuffer.toString('utf-8');

    const parsed = Papa.parse(csvText, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (header) => normalizeColumnName(header, GOOGLE_ADS_COLUMN_MAPPINGS),
    });

    if (parsed.errors.length > 0) {
      result.errors = parsed.errors.map(e => e.message);
    }

    const rows = parsed.data as GoogleAdsRow[];
    const dates: string[] = [];

    for (const row of rows) {
      try {
        // Validate required fields
        if (!row.queryText || !row.date) {
          result.rowsSkipped++;
          continue;
        }

        // Normalize query
        const queryNormalized = normalizeQuery(row.queryText);
        const queryHash = hashQuery(queryNormalized);

        // Upsert search query
        const [searchQuery] = await db
          .insert(searchQueries)
          .values({
            clientAccountId,
            queryText: row.queryText,
            queryNormalized,
            queryHash,
          })
          .onConflictDoNothing()
          .returning();

        // Get existing or inserted search query
        const existingQuery = searchQuery || await db.query.searchQueries.findFirst({
          where: (sq, { and, eq }) =>
            and(eq(sq.clientAccountId, clientAccountId), eq(sq.queryHash, queryHash))
        });

        if (!existingQuery) {
          result.rowsSkipped++;
          continue;
        }

        // Parse and convert metrics
        const costMicros = parseCurrency(row.cost) * 1_000_000;
        const avgCpcMicros = parseCurrency(row.avgCpc) * 1_000_000;

        // Insert Google Ads query data
        await db
          .insert(googleAdsQueries)
          .values({
            clientAccountId,
            searchQueryId: existingQuery.id,
            date: row.date,
            impressions: parseInt(row.impressions) || 0,
            clicks: parseInt(row.clicks) || 0,
            costMicros,
            conversions: row.conversions || '0',
            ctr: parsePercentage(row.ctr),
            avgCpcMicros,
            campaignId: row.campaignId,
            campaignName: row.campaignName,
            adGroupId: row.adGroupId,
            adGroupName: row.adGroupName,
            dataSource: 'csv_upload',
          })
          .onConflictDoUpdate({
            target: [googleAdsQueries.clientAccountId, googleAdsQueries.searchQueryId, googleAdsQueries.date],
            set: {
              impressions: parseInt(row.impressions) || 0,
              clicks: parseInt(row.clicks) || 0,
              costMicros,
              conversions: row.conversions || '0',
              ctr: parsePercentage(row.ctr),
              avgCpcMicros,
              dataSource: 'csv_upload',
            },
          });

        dates.push(row.date);
        result.rowsProcessed++;
      } catch (rowError) {
        logger.warn({ rowError, row }, 'Failed to process CSV row');
        result.rowsSkipped++;
      }
    }

    // Calculate date range
    if (dates.length > 0) {
      dates.sort();
      result.dateRange = {
        start: dates[0],
        end: dates[dates.length - 1],
      };
    }

    // Update upload record
    await db.update(csvUploads)
      .set({
        status: 'completed',
        rowCount: result.rowsProcessed,
        dateRangeStart: result.dateRange?.start,
        dateRangeEnd: result.dateRange?.end,
      })
      .where(eq(csvUploads.id, upload.id));

    result.success = true;
  } catch (error) {
    logger.error({ error, fileName }, 'CSV import failed');

    await db.update(csvUploads)
      .set({
        status: 'failed',
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
      })
      .where(eq(csvUploads.id, upload.id));

    result.errors.push(error instanceof Error ? error.message : 'Import failed');
  }

  return result;
}

// Similar function for Search Console CSV...
export async function importSearchConsoleCSV(
  clientAccountId: string,
  fileBuffer: Buffer,
  fileName: string,
  uploadedBy: string
): Promise<CSVImportResult> {
  // Implementation similar to Google Ads, using SEARCH_CONSOLE_COLUMN_MAPPINGS
  // Maps to searchConsoleQueries table
}

// Helper functions
function parseCurrency(value: string | undefined): number {
  if (!value) return 0;
  // Remove currency symbols and commas: "$1,234.56" -> 1234.56
  return parseFloat(value.replace(/[$,]/g, '')) || 0;
}

function parsePercentage(value: string | undefined): string | null {
  if (!value) return null;
  // Remove % sign: "12.34%" -> "0.1234"
  const num = parseFloat(value.replace('%', ''));
  return isNaN(num) ? null : (num / 100).toFixed(4);
}
```

#### Upload Routes

```typescript
// apps/api/src/routes/csv-upload.routes.ts

import { Router } from 'express';
import multer from 'multer';
import { authenticate } from '@/middleware/auth.middleware';
import { importGoogleAdsCSV, importSearchConsoleCSV } from '@/services/csv-import.service';

const router = Router();

// Configure multer for memory storage (files under 10MB)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'text/csv' || file.originalname.endsWith('.csv')) {
      cb(null, true);
    } else {
      cb(new Error('Only CSV files are allowed'));
    }
  },
});

// Upload Google Ads CSV
router.post(
  '/clients/:clientId/upload/google-ads',
  authenticate,
  upload.single('file'),
  async (req, res) => {
    try {
      const { clientId } = req.params;
      const file = req.file;

      if (!file) {
        return res.status(400).json({ error: 'No file uploaded' });
      }

      const result = await importGoogleAdsCSV(
        clientId,
        file.buffer,
        file.originalname,
        req.user.id
      );

      res.json(result);
    } catch (error) {
      res.status(500).json({ error: 'Upload failed' });
    }
  }
);

// Upload Search Console CSV
router.post(
  '/clients/:clientId/upload/search-console',
  authenticate,
  upload.single('file'),
  async (req, res) => {
    try {
      const { clientId } = req.params;
      const file = req.file;

      if (!file) {
        return res.status(400).json({ error: 'No file uploaded' });
      }

      const result = await importSearchConsoleCSV(
        clientId,
        file.buffer,
        file.originalname,
        req.user.id
      );

      res.json(result);
    } catch (error) {
      res.status(500).json({ error: 'Upload failed' });
    }
  }
);

// Get upload history for a client
router.get(
  '/clients/:clientId/uploads',
  authenticate,
  async (req, res) => {
    const { clientId } = req.params;

    const uploads = await db.query.csvUploads.findMany({
      where: eq(csvUploads.clientAccountId, clientId),
      orderBy: [desc(csvUploads.createdAt)],
    });

    res.json(uploads);
  }
);

export default router;
```

---

### Phase 3: Frontend Upload UI

**Goal**: Add drag-and-drop CSV upload interface to Client Settings / Onboarding.

#### New Files

```
apps/web/src/components/
├── upload/
│   ├── CSVUploadZone.tsx         # Drag-and-drop component
│   ├── CSVUploadProgress.tsx     # Upload progress indicator
│   ├── CSVUploadHistory.tsx      # List of past uploads
│   └── CSVColumnPreview.tsx      # Preview detected columns
└── clients/
    └── DataSourceSettings.tsx    # Settings panel for data source
```

#### CSV Upload Component

```tsx
// apps/web/src/components/upload/CSVUploadZone.tsx

import { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { Upload, FileSpreadsheet, CheckCircle, AlertCircle } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useApiClient } from '@/lib/api';

interface CSVUploadZoneProps {
  clientId: string;
  uploadType: 'google-ads' | 'search-console';
  onUploadComplete: (result: UploadResult) => void;
}

export function CSVUploadZone({ clientId, uploadType, onUploadComplete }: CSVUploadZoneProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [result, setResult] = useState<UploadResult | null>(null);
  const apiClient = useApiClient();

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    if (!file) return;

    setIsUploading(true);
    setUploadStatus('idle');

    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await apiClient.post(
        `/api/clients/${clientId}/upload/${uploadType}`,
        formData,
        {
          headers: { 'Content-Type': 'multipart/form-data' },
        }
      );

      setResult(response.data);
      setUploadStatus('success');
      onUploadComplete(response.data);
    } catch (error) {
      setUploadStatus('error');
    } finally {
      setIsUploading(false);
    }
  }, [clientId, uploadType, apiClient, onUploadComplete]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'text/csv': ['.csv'],
    },
    maxFiles: 1,
    disabled: isUploading,
  });

  const title = uploadType === 'google-ads'
    ? 'Google Ads Search Terms Report'
    : 'Search Console Performance Report';

  return (
    <Card>
      <CardContent className="p-6">
        <div
          {...getRootProps()}
          className={`
            border-2 border-dashed rounded-lg p-8 text-center cursor-pointer
            transition-colors duration-200
            ${isDragActive ? 'border-blue-500 bg-blue-50' : 'border-slate-300 hover:border-slate-400'}
            ${isUploading ? 'opacity-50 cursor-not-allowed' : ''}
          `}
        >
          <input {...getInputProps()} />

          {uploadStatus === 'success' ? (
            <div className="space-y-2">
              <CheckCircle className="w-12 h-12 mx-auto text-green-500" />
              <p className="text-green-700 font-medium">Upload Complete</p>
              <p className="text-sm text-slate-500">
                {result?.rowsProcessed} rows imported
                {result?.rowsSkipped > 0 && ` (${result.rowsSkipped} skipped)`}
              </p>
            </div>
          ) : uploadStatus === 'error' ? (
            <div className="space-y-2">
              <AlertCircle className="w-12 h-12 mx-auto text-red-500" />
              <p className="text-red-700 font-medium">Upload Failed</p>
              <Button variant="outline" size="sm" onClick={() => setUploadStatus('idle')}>
                Try Again
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              <FileSpreadsheet className="w-12 h-12 mx-auto text-slate-400" />
              <div>
                <p className="font-medium text-slate-700">{title}</p>
                <p className="text-sm text-slate-500 mt-1">
                  {isDragActive
                    ? 'Drop the CSV file here...'
                    : 'Drag and drop a CSV file, or click to select'}
                </p>
              </div>
              <p className="text-xs text-slate-400">
                Export from {uploadType === 'google-ads' ? 'Google Ads' : 'Search Console'}
                {' '}and upload here
              </p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
```

#### Data Source Settings Panel

```tsx
// apps/web/src/components/clients/DataSourceSettings.tsx

import { useState } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { CSVUploadZone } from '@/components/upload/CSVUploadZone';
import { CSVUploadHistory } from '@/components/upload/CSVUploadHistory';
import { Link2, Upload } from 'lucide-react';

interface DataSourceSettingsProps {
  clientId: string;
  hasOAuthConnection: boolean;
}

export function DataSourceSettings({ clientId, hasOAuthConnection }: DataSourceSettingsProps) {
  const [activeTab, setActiveTab] = useState<'oauth' | 'csv'>('oauth');

  return (
    <Card>
      <CardHeader>
        <CardTitle>Data Sources</CardTitle>
        <CardDescription>
          Connect via OAuth for automatic syncing, or upload CSV files manually
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'oauth' | 'csv')}>
          <TabsList className="mb-4">
            <TabsTrigger value="oauth" className="flex items-center gap-2">
              <Link2 className="w-4 h-4" />
              OAuth Connection
              {hasOAuthConnection && <Badge variant="success" className="ml-2">Connected</Badge>}
            </TabsTrigger>
            <TabsTrigger value="csv" className="flex items-center gap-2">
              <Upload className="w-4 h-4" />
              CSV Upload
            </TabsTrigger>
          </TabsList>

          <TabsContent value="oauth">
            {/* Existing OAuth connection UI */}
            <OAuthConnectionPanel clientId={clientId} />
          </TabsContent>

          <TabsContent value="csv" className="space-y-6">
            <div className="grid gap-6 md:grid-cols-2">
              <CSVUploadZone
                clientId={clientId}
                uploadType="google-ads"
                onUploadComplete={() => {/* refresh data */}}
              />
              <CSVUploadZone
                clientId={clientId}
                uploadType="search-console"
                onUploadComplete={() => {/* refresh data */}}
              />
            </div>

            <CSVUploadHistory clientId={clientId} />
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
```

---

### Phase 4: Onboarding Flow Integration

**Goal**: Offer CSV upload as an option during client onboarding.

#### Updated Onboarding Flow

```
Step 1: Client Details (name, website)
           ▼
Step 2: Data Source Selection
        ┌─────────────────────────────────────┐
        │  How would you like to connect?     │
        │                                     │
        │  ┌───────────┐  ┌───────────┐      │
        │  │  Google   │  │   Upload  │      │
        │  │   OAuth   │  │    CSV    │      │
        │  │(Automatic)│  │  (Manual) │      │
        │  └───────────┘  └───────────┘      │
        └─────────────────────────────────────┘
           ▼                    ▼
Step 3a: OAuth Flow    Step 3b: CSV Upload
           ▼                    ▼
Step 4: Review & Confirm
```

---

### Phase 5: Data Freshness & Staleness Warnings

**Goal**: Track when CSV data was last uploaded and warn users when data is stale.

#### Staleness Tracking

```typescript
// Add to client detail response
interface ClientDataStatus {
  googleAds: {
    source: 'api' | 'csv_upload' | 'none';
    lastSync: Date | null;
    dataRange: { start: string; end: string } | null;
    isStale: boolean; // > 7 days old
  };
  searchConsole: {
    source: 'api' | 'csv_upload' | 'none';
    lastSync: Date | null;
    dataRange: { start: string; end: string } | null;
    isStale: boolean;
  };
}
```

#### Staleness Warning UI

```tsx
// Show warning banner when data is stale
{dataStatus.googleAds.isStale && (
  <Alert variant="warning">
    <AlertTriangle className="w-4 h-4" />
    <AlertTitle>Data may be outdated</AlertTitle>
    <AlertDescription>
      Google Ads data was last uploaded {formatDistanceToNow(dataStatus.googleAds.lastSync)} ago.
      <Button variant="link" onClick={() => setActiveTab('csv')}>
        Upload fresh data
      </Button>
    </AlertDescription>
  </Alert>
)}
```

---

## File Structure Summary

```
apps/api/src/
├── db/
│   └── schema.ts                    # Add csvUploads table, dataSource column
├── routes/
│   └── csv-upload.routes.ts         # Upload endpoints
├── services/
│   └── csv-import.service.ts        # CSV parsing and import logic
└── utils/
    ├── csv-column-mapper.ts         # Column name normalization
    └── csv-validators.ts            # Data validation helpers

apps/web/src/
├── components/
│   ├── upload/
│   │   ├── CSVUploadZone.tsx        # Drag-and-drop upload
│   │   ├── CSVUploadProgress.tsx    # Upload progress
│   │   ├── CSVUploadHistory.tsx     # Past uploads list
│   │   └── CSVColumnPreview.tsx     # Column mapping preview
│   └── clients/
│       └── DataSourceSettings.tsx   # Data source settings panel
└── pages/
    └── Onboarding.tsx               # Updated with CSV option
```

---

## Dependencies

```bash
# Backend
cd apps/api
npm install papaparse multer
npm install -D @types/papaparse @types/multer

# Frontend
cd apps/web
npm install react-dropzone papaparse
npm install -D @types/papaparse
```

---

## Implementation Order

1. **Phase 1** - Database schema updates
   - Add `dataSource` column to query tables
   - Create `csvUploads` table
   - Run migration

2. **Phase 2** - Backend CSV processing
   - Install papaparse, multer
   - Create column mapping utilities
   - Build csv-import.service.ts
   - Add upload routes

3. **Phase 3** - Frontend upload UI
   - Install react-dropzone
   - Create CSVUploadZone component
   - Create upload history component

4. **Phase 4** - Integration
   - Add to client settings page
   - Update onboarding flow
   - Add data source badges to UI

5. **Phase 5** - Polish
   - Staleness warnings
   - Error handling improvements
   - Column mapping preview

---

## Success Criteria

- [ ] Users can upload Google Ads CSV and see data in reports
- [ ] Users can upload Search Console CSV and see data in reports
- [ ] CSV data integrates with existing recommendation engine
- [ ] Upload history shows past uploads with status
- [ ] Stale data warnings appear when uploads are > 7 days old
- [ ] Column name variations are handled correctly
- [ ] Invalid rows are skipped with clear error messages
- [ ] Uploads complete within 30 seconds for files under 10MB

---

## Sources

- [Google Ads CSV columns](https://support.google.com/google-ads/editor/answer/57747)
- [Google Ads statistics columns](https://support.google.com/google-ads/answer/2454071)
- [Search Console data export](https://support.google.com/webmasters/answer/12919797)
- [Google Search Console export improvements](https://developers.google.com/search/blog/2020/02/data-export)
- [papaparse](https://www.papaparse.com/) - CSV parsing library
- [react-dropzone](https://react-dropzone.js.org/) - File upload component
