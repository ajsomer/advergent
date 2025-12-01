# Reports Tab Implementation Plan

## Overview

This plan outlines the implementation of a **Reports** tab within the Client Details section of Advergent. The Reports feature will allow agencies to generate, view, and export formatted reports containing client performance data, recommendations, and insights.

---

## Report Types Overview

### MVP: SEO/SEM Interplay Report (Auto-Generated)
The primary report, generated automatically at **client creation** after initial data sync:
- **SEO/SEM Interplay Report**: Multi-agent AI analysis (Scout → Researcher → SEM Agent → SEO Agent → Director)
- Produces executive summary + unified recommendations
- See "Phase 4: SEO/SEM Interplay Report" section for full architecture

### Future: Simple Manual Reports (Post-MVP)
Additional reports that users could generate on-demand:
- **Performance Overview**: High-level metrics summary
- **Paid vs Organic Analysis**: Query overlap details, spend analysis
- **Recommendations History**: All recommendations with status and reasoning
- **Performance Trends**: GA4/SC metrics over time

---

## Architecture Decision: HTML Preview + PDF Download

After evaluating different approaches, we're using **Option 1: Live HTML Preview + PDF Download on Demand**.

### How It Works (MVP)
1. User navigates to Reports tab → system auto-loads the pre-generated SEO/SEM Interplay Report
2. Report renders as an **interactive HTML preview** using read-only presentational components
3. User reviews the report in the browser (scrollable, fast, interactive)
4. When ready, user clicks "Download PDF" which generates the PDF on-demand

**Note**: MVP has no date range selector or report type selector. The report is auto-generated once at client creation with a fixed 30-day window. Post-MVP will add manual regeneration and additional report types.

### Why This Approach
| Benefit | Description |
|---------|-------------|
| **Fast rendering** | HTML preview is instant; PDF generation only when needed |
| **Interactive preview** | Users can scroll, hover, review before committing to download |
| **Easier styling** | Reuse existing Tailwind/shadcn components for preview |
| **Lower memory** | No upfront PDF generation until requested |
| **Familiar UX** | Common pattern used by most report tools |

### Trade-off
- Slight visual differences between HTML preview and PDF are possible
- Mitigated by designing PDF templates to closely mirror HTML layout

---

## Key Technical Decisions

### 1. Report is Auto-Generated, Fixed 30-Day Window

The SEO/SEM Interplay Report is **auto-generated once** after client creation when data sync completes. It always analyzes the **last 30 days** of data at generation time.

- **No date range selector** in the Reports tab (MVP)
- Report shows the date range it was generated with
- **Post-MVP**: "Regenerate Report" button to create a fresh analysis

### 2. Data Flow: Fetch Stored Report via `useInterplayReport`

The Reports tab does **NOT** reuse data from `useClientDetail`. Instead, it fetches the pre-generated report from the `interplay_reports` table.

```tsx
// apps/web/src/hooks/useInterplayReport.ts
export function useInterplayReport(clientId: string) {
  const apiClient = useApiClient();

  return useQuery<InterplayReportResponse>({
    queryKey: ['client', clientId, 'interplay-report'],
    queryFn: async () => {
      const { data } = await apiClient.get(`/api/clients/${clientId}/interplay-report`);
      return data;
    },
    enabled: !!clientId,
  });
}

// apps/web/src/pages/ClientDetail.tsx
{activeTab === 'reports' && (
  <ReportsTab clientId={clientId} client={client} />
  // NO data props passed - ReportsTab fetches its own report data
)}

// apps/web/src/components/clients/ReportsTab.tsx
function ReportsTab({ clientId, client }) {
  const { data: report, isLoading, isError } = useInterplayReport(clientId);
  // Render the stored report
}
```

### 3. Auto-Trigger: Report Generation After Sync

The report must be triggered automatically after successful data ingestion. Data can come from two sources:

**Data Sources (First-Class Citizens)**:
1. **OAuth API Sync** - Google Ads, Search Console, GA4 data fetched via OAuth
2. **CSV Upload** - Manual upload of Google Ads export files (Search Terms, Keywords, Auction Insights, etc.)

**Implementation in `client-sync.service.ts`**:
```typescript
// apps/api/src/services/client-sync.service.ts
export async function runClientSync(clientId: string, options?: { trigger?: 'manual' | 'scheduled' }) {
  // ... existing sync logic for GA4, Google Ads, Search Console via OAuth ...

  // After successful sync, check if this is the first sync (no existing report)
  // AND if we have sufficient data (either from OAuth or CSV upload)
  const hasDataForAnalysis = await checkDataAvailability(clientId);
  const existingReport = await db
    .select({ id: interplayReports.id })
    .from(interplayReports)
    .where(eq(interplayReports.clientAccountId, clientId))
    .limit(1);

  const isInitialSync = existingReport.length === 0;

  if (isInitialSync && hasDataForAnalysis) {
    await generateInterplayReport(clientId, { days: 30, trigger: 'client_creation' });
  }
}

// Helper to check if we have data from either source
async function checkDataAvailability(clientId: string): Promise<boolean> {
  const [oauthData, csvData] = await Promise.all([
    db.select({ count: sql`count(*)` }).from(googleAdsQueries)
      .where(and(eq(googleAdsQueries.clientAccountId, clientId), eq(googleAdsQueries.dataSource, 'api'))),
    db.select({ count: sql`count(*)` }).from(googleAdsQueries)
      .where(and(eq(googleAdsQueries.clientAccountId, clientId), eq(googleAdsQueries.dataSource, 'csv_upload'))),
  ]);
  return (oauthData[0]?.count || 0) > 0 || (csvData[0]?.count || 0) > 0;
}
```

**CSV Upload Trigger** (in `csv-import.service.ts`):
```typescript
// After successful CSV upload session, check if report should be generated
export async function processUploadSession(...) {
  // ... existing CSV processing logic ...

  // After successful upload, trigger report generation if this is first data
  const existingReport = await db
    .select({ id: interplayReports.id })
    .from(interplayReports)
    .where(eq(interplayReports.clientAccountId, clientAccountId))
    .limit(1);

  if (existingReport.length === 0 && result.imported.length > 0) {
    await generateInterplayReport(clientAccountId, { days: 30, trigger: 'client_creation' });
  }

  return result;
}
```

**Data Conflict Resolution**:
- When both OAuth and CSV data exist for the same queries/date range:
  - `data_source` column identifies origin ('api' vs 'csv_upload')
  - Analysis pipeline merges data, preferring more recent timestamps
  - Scout/Researcher agents receive unified data regardless of source
  - Auction Insights from CSV enriches API data (API doesn't provide competitor details)

**Option B: Background Job Queue (Post-MVP)**
- Use BullMQ to enqueue report generation
- Allows retries, progress tracking, timeouts
- Better for long-running multi-agent analysis

**Trigger points**:
1. After initial client creation + first successful OAuth sync
2. After first CSV upload with data
3. Manual "Regenerate Report" button (Post-MVP)
4. Scheduled regeneration (Post-MVP)

### 4. Type Definitions: Single Source in `packages/shared`

Report types will live in `packages/shared/src/types/reports.types.ts` (NOT duplicated in `apps/web/src/types`).

**Required Changes**:
- Add `reports.types.ts` to `packages/shared/src/types/`
- Update `packages/shared/src/types/index.ts` to export it: `export * from './reports.types'`
- Frontend imports from `@advergent/shared` (may need to add workspace dependency)

### 5. File Locations: Use Existing Aliases

The web TS config only has aliases for `@/components`, `@/lib`, `@/hooks`, `@/types`, `@/pages`.

**Solution**: Place utilities under `src/lib/` instead of creating a new `src/utils/` directory:

```
apps/web/src/lib/
├── api.ts           # (existing)
├── utils.ts         # (existing)
├── generatePDF.ts   # NEW
└── exportCSV.ts     # NEW
```

### 6. Read-Only Report Components

Existing components like `RecommendationCard` include interactive elements (Approve/Reject buttons, toggle state). For printable reports, we need **read-only presentational variants**.

**Solution**: Create lightweight report-specific components:

```
apps/web/src/components/clients/reports/
├── templates/
│   └── components/           # Read-only presentational components
│       ├── ReportMetricCard.tsx
│       ├── ReportRecommendationItem.tsx  # No buttons, just display
│       ├── ReportQueryTable.tsx          # No sorting, no hover actions
│       └── ReportChart.tsx
```

These components are purely presentational - no state, no actions, optimized for PDF rendering.

---

## Recommended Libraries

### Primary: @react-pdf/renderer
- **Purpose**: Generate downloadable PDFs on-demand
- **Why**: React-first approach using JSX components, matches our stack
- **Use case**: "Download PDF" button triggers PDF generation
- **Stars**: 15,000+ on GitHub
- **Weekly downloads**: 500,000+

### Secondary: papaparse
- **Purpose**: CSV export for tabular data
- **Why**: Lightweight, reliable data export
- **Use case**: "Export CSV" for data tables

### Optional: jsPDF + html2canvas
- **Purpose**: Quick "print current view" functionality
- **Use case**: Fallback for simpler exports or browser print dialog

---

## Implementation Phases

### Phase 1: Reports Tab UI Infrastructure

**Goal**: Build the reports infrastructure that will display the SEO/SEM Interplay Report.

#### Tasks

1. **Update ClientDetail.tsx tab system**
   - Add `'reports'` to the `TabType` union type
   - Add reports tab configuration to the `tabs` array
   - Add conditional rendering block for reports tab content

2. **Create `useInterplayReport` hook**
   - Location: `apps/web/src/hooks/useInterplayReport.ts`
   - Fetches stored report from `GET /api/clients/:id/interplay-report`
   - Returns report data, loading state, error state

3. **Create ReportsTab component**
   - Location: `apps/web/src/components/clients/ReportsTab.tsx`
   - Uses `useInterplayReport` hook to fetch data
   - Structure:
     ```
     ReportsTab/
     ├── ReportHeader (title, generated date, data range, status badge)
     ├── ExportActions (Download PDF, Export CSV buttons)
     └── ReportPreviewContainer (scrollable paper-like container)
         └── InterplayReportView (displays the agent-generated report)
     ```

4. **Create read-only presentational components for Interplay Report**
   - `ReportExecutiveSummary.tsx` - Displays Director's executive summary + key highlights
   - `ReportUnifiedRecommendations.tsx` - List of prioritized recommendations
   - `ReportRecommendationCard.tsx` - Individual recommendation (type badge, impact/effort, action items)

5. **Create InterplayReportView template**
   - **InterplayReportView.tsx**: Renders the Director's output
   - Sections:
     - Executive Summary card (summary narrative + key highlights)
     - Unified Recommendations list (sorted by impact, color-coded by type)
     - Each recommendation expandable to show action items

6. **Style the preview container**
   - Paper-like appearance with shadow/border
   - Scrollable with max-height
   - Print-friendly styling

7. **Add report types to shared package**
   - Create `packages/shared/src/types/reports.types.ts`
   - Export from `packages/shared/src/types/index.ts`

8. **Handle report states**
   - Loading state (report being generated - show progress)
   - Empty state (no report yet - "Report will be generated after data sync")
   - Error state (generation failed - show error message)

#### UI Mockup
```
┌─────────────────────────────────────────────────────────┐
│ Reports                                                  │
├─────────────────────────────────────────────────────────┤
│ SEO/SEM Interplay Report    Generated: Dec 1, 2024      │
│                                          [Download PDF] │
├─────────────────────────────────────────────────────────┤
│ ┌─────────────────────────────────────────────────────┐ │
│ │  ╔═══════════════════════════════════════════════╗  │ │
│ │  ║  EXECUTIVE SUMMARY                            ║  │ │
│ │  ║                                               ║  │ │
│ │  ║  "This account shows strong organic presence  ║  │ │
│ │  ║  but significant paid/organic cannibalization ║  │ │
│ │  ║  on brand terms. Immediate action on 3 high-  ║  │ │
│ │  ║  impact recommendations could save $2.4k/mo." ║  │ │
│ │  ║                                               ║  │ │
│ │  ║  Key Highlights:                              ║  │ │
│ │  ║  • 42% of ad spend on queries ranking #1-3   ║  │ │
│ │  ║  • 3 critical pages with high bounce rate    ║  │ │
│ │  ╚═══════════════════════════════════════════════╝  │ │
│ │                                                      │ │
│ │  UNIFIED RECOMMENDATIONS (7)                         │ │
│ │                                                      │ │
│ │  ┌─────────────────────────────────────────────┐    │ │
│ │  │ [SEM] [HIGH IMPACT]                         │    │ │
│ │  │ Pause ads on "brand name" keywords          │    │ │
│ │  │ Save $800/mo - organic ranks #1 with 45% CTR│    │ │
│ │  │ ▼ Action Items                              │    │ │
│ │  └─────────────────────────────────────────────┘    │ │
│ │  ┌─────────────────────────────────────────────┐    │ │
│ │  │ [SEO] [HIGH IMPACT]                         │    │ │
│ │  │ Optimize landing page for "services"        │    │ │
│ │  │ High paid conversions but 78% bounce rate   │    │ │
│ │  │ ▼ Action Items                              │    │ │
│ │  └─────────────────────────────────────────────┘    │ │
│ │  ...                                                │ │
│ └─────────────────────────────────────────────────────┘ │
│                                                          │
│ [Download PDF]  [Export CSV]                            │
└─────────────────────────────────────────────────────────┘
```

#### New Files
```
packages/shared/src/types/reports.types.ts    # Shared report type definitions

apps/web/src/hooks/useInterplayReport.ts      # Hook to fetch stored report

apps/web/src/components/clients/ReportsTab.tsx
apps/web/src/components/clients/reports/
  ├── ReportHeader.tsx                         # Title, generated date, data range, status
  ├── ExportActions.tsx                        # Download PDF / Export CSV
  ├── ReportPreviewContainer.tsx               # Scrollable paper-like container
  ├── components/                              # Read-only presentational components
  │   ├── ReportExecutiveSummary.tsx           # Director's summary + highlights
  │   ├── ReportUnifiedRecommendations.tsx     # List wrapper
  │   └── ReportRecommendationCard.tsx         # Individual recommendation
  └── templates/
      └── InterplayReportView.tsx              # MVP: SEO/SEM Interplay Report
```

**Note**: Report data fetched from `GET /api/clients/:id/interplay-report` (endpoint created in Phase 4).

---

### Phase 2: PDF Generation with @react-pdf/renderer

**Goal**: Create PDF templates that mirror HTML previews; generate on-demand when user clicks download.

#### Tasks

1. **Install dependencies**
   ```bash
   cd apps/web
   npm install @react-pdf/renderer
   ```

2. **Create PDF document components**
   - Mirror the HTML templates but using react-pdf primitives
   - Design branded report header with Advergent logo
   - Create reusable PDF components (tables, metrics cards)

3. **PDF Component Structure**
   ```tsx
   // Example: ExecutiveSummaryPDF.tsx
   import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

   const ExecutiveSummaryPDF = ({ data, client, dateRange }) => (
     <Document>
       <Page size="A4" style={styles.page}>
         <View style={styles.header}>
           <Text style={styles.title}>Advergent Performance Report</Text>
           <Text style={styles.subtitle}>{client.name} | {dateRange}</Text>
         </View>
         <View style={styles.metricsRow}>
           <MetricCard label="Total Spend" value={data.totalSpend} />
           <MetricCard label="Potential Savings" value={data.savings} />
           <MetricCard label="Query Overlaps" value={data.overlaps} />
         </View>
         {/* More sections mirroring HTML template */}
       </Page>
     </Document>
   );
   ```

4. **Implement PDF download handler**
   ```tsx
   import { pdf } from '@react-pdf/renderer';

   const handleDownloadPDF = async () => {
     setIsGenerating(true);
     try {
       const blob = await pdf(
         <ExecutiveSummaryPDF data={reportData} client={client} dateRange={dateRange} />
       ).toBlob();

       const url = URL.createObjectURL(blob);
       const link = document.createElement('a');
       link.href = url;
       link.download = `${client.name}-${reportType}-${formatDate(new Date())}.pdf`;
       link.click();
       URL.revokeObjectURL(url);
     } finally {
       setIsGenerating(false);
     }
   };
   ```

5. **Add loading state during PDF generation**
   - Disable button and show spinner
   - "Generating PDF..." text

#### New Files
```
apps/web/src/lib/generatePDF.ts               # PDF generation utility (in lib/, not utils/)

apps/web/src/components/clients/reports/pdf/
  ├── PDFDocument.tsx (base wrapper with styles)
  ├── PDFHeader.tsx
  ├── PDFFooter.tsx
  ├── PDFTable.tsx
  ├── PDFMetricsCard.tsx
  └── templates/
      └── ExecutiveSummaryPDF.tsx             # MVP: Only this template
      # Future Phase 4:
      # ├── PaidOrganicPDF.tsx
      # ├── RecommendationsPDF.tsx
      # └── PerformanceTrendsPDF.tsx
```

---

### Phase 3: CSV Export + Additional Features

**Goal**: Add CSV export and refine the export experience.

#### Tasks

1. **CSV Export**
   - Install: `npm install papaparse`
   - Create CSV export utility for tabular data
   - Support exporting individual report sections or all data
   ```tsx
   import Papa from 'papaparse';

   const handleCSVExport = () => {
     const csv = Papa.unparse(reportData.queryOverlaps);
     const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
     const url = URL.createObjectURL(blob);
     const link = document.createElement('a');
     link.href = url;
     link.download = `${client.name}-data-${formatDate(new Date())}.csv`;
     link.click();
   };
   ```

2. **Export dropdown menu**
   - Combine PDF and CSV exports into a dropdown
   - Add section-specific CSV exports (e.g., "Export Query Data", "Export Recommendations")

3. **Print-friendly styles**
   - Add `@media print` CSS for browser print dialog
   - Hide controls, show only report content

#### New Files
```
apps/web/src/lib/exportCSV.ts                 # CSV export utility (in lib/, not utils/)
```

---

### Phase 4: Backend Report API (Optional Enhancement)

**Goal**: Add server-side report generation for complex reports or scheduled delivery.

#### Tasks

1. **Create reports routes**
   - `GET /api/clients/:id/reports/data` - Aggregated report data
   - `POST /api/clients/:id/reports/generate` - Server-side PDF generation
   - `GET /api/clients/:id/reports/history` - Previously generated reports

2. **Report data aggregation service**
   - Location: `apps/api/src/services/report.service.ts`
   - Aggregate data from multiple tables efficiently
   - Cache report data for performance

3. **Server-side PDF generation (optional)**
   - Use Puppeteer or pdfmake on the server
   - Useful for scheduled email reports
   - Store generated PDFs in cloud storage

#### New Files
```
apps/api/src/routes/reports.routes.ts
apps/api/src/services/report.service.ts
apps/api/src/services/report-generator.service.ts (optional)
```

---

### Phase 5: Polish and UX Enhancements

**Goal**: Refine the user experience and add advanced features.

#### Tasks

1. **Loading states**
   - Skeleton loaders while generating report preview
   - Progress indicator during PDF generation

2. **Error handling**
   - Handle missing data gracefully
   - Show helpful messages when no data available

3. **Report customization** (Post-MVP)
   - Allow users to select which sections to include
   - Custom date range selection (requires backend changes)
   - Comparison periods (this month vs last month)

4. **Report scheduling (future)**
   - Schedule automated weekly/monthly reports
   - Email delivery to stakeholders

---

## Technical Specifications

### Dependencies to Install

> **Note**: Dependencies are organized by phase. Phase 0 dependencies are required first.

#### Phase 0: Prerequisites (Backend + Frontend)

```bash
# Backend (apps/api)
cd apps/api
npm install papaparse multer
npm install -D @types/papaparse @types/multer

# Frontend (apps/web)
cd apps/web
npm install react-dropzone papaparse
npm install -D @types/papaparse
```

#### Phases 1-3: Reports UI + Export (Frontend)

```bash
cd apps/web
npm install @react-pdf/renderer
# Note: papaparse already installed in Phase 0
```

#### All Dependencies Summary

```json
// apps/api/package.json (additions)
{
  "dependencies": {
    "papaparse": "^5.4.1",
    "multer": "^1.4.5-lts.1"
  },
  "devDependencies": {
    "@types/papaparse": "^5.3.14",
    "@types/multer": "^1.4.11"
  }
}

// apps/web/package.json (additions)
{
  "dependencies": {
    "@react-pdf/renderer": "^3.4.0",
    "papaparse": "^5.4.1",
    "react-dropzone": "^14.2.3"
  },
  "devDependencies": {
    "@types/papaparse": "^5.3.14"
  }
}
```

Note: `date-fns` is already installed in the project.

### Report Data Structure

**Single source of truth**: `packages/shared/src/types/reports.types.ts`

```typescript
// packages/shared/src/types/reports.types.ts
// Import in frontend: import { InterplayReport, ReportTrigger } from '@advergent/shared';

// How the report was generated
export type ReportTrigger = 'client_creation' | 'manual' | 'scheduled';

// Report status
export type ReportStatus = 'pending' | 'researching' | 'analyzing' | 'completed' | 'failed';

// Recommendation category from agents
export type RecommendationCategory = 'sem' | 'seo' | 'hybrid';

// Impact/effort levels
export type ImpactLevel = 'high' | 'medium' | 'low';
export type EffortLevel = 'high' | 'medium' | 'low';

// Unified recommendation from Director
export interface UnifiedRecommendation {
  title: string;
  description: string;
  type: RecommendationCategory;
  impact: ImpactLevel;
  effort: EffortLevel;
  actionItems: string[];
}

// Executive summary from Director
export interface ExecutiveSummary {
  summary: string;
  keyHighlights: string[];
}

// Full interplay report response (for display)
export interface InterplayReportResponse {
  id: string;
  clientAccountId: string;
  trigger: ReportTrigger;
  status: ReportStatus;

  // Date range the report analyzed
  dateRange: {
    startDate: string;  // ISO date
    endDate: string;    // ISO date
    days: number;       // Always 30 for MVP
  };

  // Director output (the main display content)
  executiveSummary: ExecutiveSummary;
  unifiedRecommendations: UnifiedRecommendation[];

  // Metadata
  generatedAt: string;  // ISO timestamp
  tokensUsed?: number;
  processingTimeMs?: number;
}

// Extended response for QA/debugging - includes all agent outputs
export interface InterplayReportDebugResponse extends InterplayReportResponse {
  agentOutputs: {
    scout: ScoutFindings | null;       // Battleground keywords + critical pages
    researcher: ResearcherData | null; // Enriched data with competitive metrics + page content
    semAgent: SemAnalysis | null;      // semActions[]
    seoAgent: SeoAnalysis | null;      // seoActions[]
    director: DirectorOutput | null;   // Full director output
  };
}
```

**Note**: Update `packages/shared/src/types/index.ts` to include:
```typescript
export * from './reports.types';
```

### Component Integration Pattern

```tsx
// apps/web/src/pages/ClientDetail.tsx

// 1. Add to TabType
type TabType = 'overview' | 'recommendations' | 'query-data' |
               'search-console' | 'ga4' | 'analysis' | 'reports';

// 2. Add to tabs array
const tabs = [
  // ... existing tabs
  { id: 'reports' as const, label: 'Reports', icon: FileText },
];

// 3. Render ReportsTab - it fetches its own data via useInterplayReport
{activeTab === 'reports' && (
  <ReportsTab clientId={clientId} client={client} />
)}
```

**Data Flow Diagram**:
```
ClientDetail.tsx
    │
    └── ReportsTab
            │
            ├── useInterplayReport(clientId)
            │       │
            │       ▼
            │   GET /api/clients/:id/interplay-report
            │       │
            │       ▼
            │   interplay_reports table (pre-generated report)
            │
            └── InterplayReportView (renders stored report)
```

---

## UI/UX Design Guidelines

### Report Header
- Report title: "SEO/SEM Interplay Report"
- Generated date: "Generated Dec 1, 2024"
- Data range: "Analyzing Nov 1 - Nov 30, 2024" (fixed 30 days at generation time)
- Status badge if still generating

### Report Type Selector (Post-MVP)
- **MVP**: Only SEO/SEM Interplay Report (no selector needed)
- **Post-MVP**: Dropdown with icons for additional report types

### Report Preview
- Scrollable preview pane showing report layout
- Page-by-page navigation for multi-page reports
- Zoom controls for detailed viewing

### Export Actions
- Primary button: "Download PDF"
- Secondary: "Export Data (CSV)"
- Icon buttons for print, email (future)

### Styling
- Follow existing Tailwind patterns
- Use shadcn/ui components (Card, Button, Select, Badge)
- Maintain slate color scheme with blue accents
- PDF styling to match brand guidelines

---

## File Structure Summary

```
packages/shared/src/
└── types/
    ├── index.ts                              # Add: export * from './reports.types'
    └── reports.types.ts                      # SINGLE SOURCE for report types

apps/web/src/
├── components/
│   └── clients/
│       ├── ReportsTab.tsx                    # Main tab component
│       └── reports/
│           ├── ReportHeader.tsx              # Title, date, status badge
│           ├── ExportActions.tsx             # Download PDF / Export CSV buttons
│           ├── ReportPreviewContainer.tsx    # Scrollable paper-like container
│           │
│           ├── components/                   # Read-only presentational components
│           │   ├── ReportExecutiveSummary.tsx    # Director's summary + highlights
│           │   ├── ReportUnifiedRecommendations.tsx  # List wrapper
│           │   ├── ReportRecommendationCard.tsx  # Individual recommendation
│           │   └── ReportMetricCard.tsx      # Display-only metric card
│           │
│           ├── templates/                    # HTML preview templates
│           │   └── InterplayReportView.tsx   # MVP: SEO/SEM Interplay Report
│           │   # Post-MVP:
│           │   # ├── PerformanceOverviewReport.tsx
│           │   # └── PaidOrganicReport.tsx
│           │
│           └── pdf/                          # PDF generation templates
│               ├── PDFDocument.tsx           # Base wrapper with global styles
│               ├── PDFHeader.tsx
│               ├── PDFFooter.tsx
│               ├── PDFTable.tsx
│               ├── PDFRecommendationCard.tsx
│               └── templates/
│                   └── InterplayReportPDF.tsx    # MVP: SEO/SEM Interplay PDF
│
├── lib/                                      # Use existing alias (@/lib/*)
│   ├── api.ts                                # (existing)
│   ├── utils.ts                              # (existing)
│   ├── generatePDF.ts                        # NEW: PDF generation utility
│   └── exportCSV.ts                          # NEW: CSV export utility
│
└── hooks/
    └── useInterplayReport.ts                 # Fetch report from interplay_reports table

apps/api/src/                                 # Phase 4: Multi-Agent System
├── routes/
│   └── reports.routes.ts                     # GET /clients/:id/interplay-report
├── services/
│   ├── interplay-report.service.ts           # Orchestrates the multi-agent flow
│   └── analysis-agents/
│       ├── scout.agent.ts                    # Data triage logic
│       ├── researcher.agent.ts               # Fetch competitive metrics, page content
│       ├── sem.agent.ts                      # SEM Agent (Claude prompt)
│       ├── seo.agent.ts                      # SEO Agent (Claude prompt)
│       └── director.agent.ts                 # Synthesis + filtering
└── db/
    └── schema.ts                             # Add interplay_reports table
```

---

## Implementation Order

> **IMPORTANT**: The recommended implementation order is:
> **Phase 0 → Phase 4 → Phase 1 → Phase 2 → Phase 3 → Phase 5**
>
> Phase 0 (Prerequisites) must come first as it establishes the database schema and CSV upload infrastructure.
> Phase 4 (Multi-Agent System) should come before Phase 1 (UI) so there's real data to display.
> Alternatively, Phase 1 can use mock data if you want to validate UI before backend work.

### Foundation (Phase 0) - REQUIRED FIRST

0. **Phase 0** - Prerequisites and Foundation
   - Database schema extensions (`csv_uploads`, `auction_insights`, `campaign_metrics`, etc.)
   - CSV upload infrastructure (backend routes, file detection, parsers)
   - Frontend upload component (`CSVUploadZone.tsx`)
   - Dependencies: `papaparse`, `multer`, `react-dropzone`
   - See `documents/plans/ai-reporting/phase-0-prerequisites.md` for full details

### Backend Core (Phase 4)

4. **Phase 4** - SEO/SEM Interplay Report (Multi-Agent System)
   - Create `interplay_reports` table
   - Extend `recommendations` table with new columns
   - Implement Scout, Researcher, SEM Agent, SEO Agent, Director agents
   - Auto-trigger report generation after sync OR CSV upload
   - API endpoints for fetching reports
   - See `documents/plans/ai-reporting/phase-4-multi-agent-system.md` for full details

### Frontend Infrastructure (Phases 1-3)

1. **Phase 1** - Reports Tab UI Infrastructure
   - Add report types to `packages/shared/src/types/reports.types.ts`
   - Add `'reports'` tab to ClientDetail.tsx
   - Create ReportsTab component with loading/empty/error states
   - Create read-only presentational components for Interplay Report:
     - ReportExecutiveSummary, ReportUnifiedRecommendations, ReportRecommendationCard
   - Create InterplayReportView.tsx template
   - Style the preview container (paper-like appearance)
   - **Note**: Can use mock data if Phase 4 is not complete yet

2. **Phase 2** - PDF Generation
   - Install @react-pdf/renderer
   - Create PDF base components in `src/lib/generatePDF.ts`
   - Build InterplayReportPDF.tsx mirroring HTML layout
   - Implement "Download PDF" button with loading state

3. **Phase 3** - CSV Export
   - Install papaparse (already installed in Phase 0)
   - Create CSV export utility in `src/lib/exportCSV.ts`
   - Add "Export CSV" for recommendations data

5. **Phase 5** - Polish & Future Enhancements
   - Manual "Regenerate Report" button
   - Report history (view past reports)
   - Simple manual report templates (Performance Overview, etc.)
   - Scheduled report generation
   - Email delivery

---

## Success Criteria

### Infrastructure (Phases 1-3)
- [ ] Reports tab visible in Client Details page
- [ ] Loading/empty/error states handled gracefully
- [ ] InterplayReportView displays executive summary + recommendations
- [ ] Recommendations are expandable to show action items
- [ ] PDF download generates correctly formatted document
- [ ] PDF layout closely matches HTML preview
- [ ] CSV export works for recommendations data
- [ ] PDF generation completes within 5 seconds
- [ ] Loading spinner shown during PDF generation

### MVP Core (Phase 4)
- [ ] SEO/SEM Interplay Report auto-generates on client creation
- [ ] Scout correctly identifies battleground keywords and critical pages
- [ ] Researcher fetches competitive metrics (when API available)
- [ ] SEM Agent produces valid JSON output with actionable recommendations
- [ ] SEO Agent produces valid JSON output with actionable recommendations
- [ ] Director synthesizes and filters to max 10 recommendations
- [ ] Report stored in `interplay_reports` table
- [ ] **Recommendations populated in `recommendations` table**
- [ ] **Recommendations appear in Recommendations tab with SEM/SEO badges**
- [ ] **Recommendations can be approved/rejected like existing ones**
- [ ] Report displays in frontend within 30 seconds of client creation
- [ ] Executive summary provides meaningful account health narrative

---

## Phase 4: SEO/SEM Interplay Report (Multi-Agent System)

> **Status**: MVP scope. This is the core report that will be auto-generated at client creation.

### Overview

The SEO/SEM Interplay Report is an **auto-generated** report that runs at **client creation** (after initial data sync). It uses a multi-agent AI system to analyze the interplay between Paid and Organic data.

### Trigger Point

```
Client Creation Flow:
1. User creates client
2. Data sync completes (Google Ads + Search Console + GA4)
3. System triggers SEO/SEM Interplay Report generation
4. Report stored in database
5. User sees report in Reports tab (marked as "Initial Analysis")
```

### Three-Phase Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    SEO/SEM INTERPLAY REPORT                      │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  PHASE 1: RESEARCH LAYER                                        │
│  ┌──────────────┐    ┌──────────────┐                           │
│  │   The Scout  │───▶│ The Researcher│                          │
│  │ (Data Triage)│    │(Fetch Details)│                          │
│  └──────────────┘    └──────────────┘                           │
│         │                    │                                   │
│         ▼                    ▼                                   │
│  • Battleground Keywords    • Competitive Metrics                │
│  • Critical Pages           • Page HTML Content                  │
│                                                                  │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  PHASE 2: ANALYSIS LAYER                                        │
│  ┌──────────────┐    ┌──────────────┐                           │
│  │  SEM Agent   │    │  SEO Agent   │                           │
│  │(Paid Search) │    │  (Organic)   │                           │
│  └──────────────┘    └──────────────┘                           │
│         │                    │                                   │
│         ▼                    ▼                                   │
│  • semActions[]             • seoActions[]                       │
│                                                                  │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  PHASE 3: STRATEGY LAYER                                        │
│  ┌──────────────────────────────────────┐                       │
│  │           The Director               │                       │
│  │  (Synthesize & Prioritize)           │                       │
│  └──────────────────────────────────────┘                       │
│                      │                                           │
│                      ▼                                           │
│  • executiveSummary                                              │
│  • unifiedRecommendations[] (max 10, sorted by impact)          │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### Phase 1: Research Layer

#### Data Sources (Merged Pipeline)

The Scout and Researcher operate on a **unified data view** that combines data from both sources:

| Data Type | OAuth API Source | CSV Upload Source |
|-----------|------------------|-------------------|
| Search Terms | `google_ads_queries` (data_source='api') | `google_ads_queries` (data_source='csv_upload') |
| Keywords | `google_ads_queries` (with match_type) | `google_ads_queries` (with match_type) |
| Organic Data | `search_console_queries` | N/A (OAuth only) |
| Auction Insights | N/A (not available via API for most accounts) | `auction_insights` table |
| Campaign/Device Metrics | `google_ads_queries` aggregated | `campaign_metrics`, `device_metrics` tables |
| GA4 Landing Pages | `ga4_landing_page_data` | N/A (OAuth only) |

**Data Construction** (`constructInterplayData` in `ai-analyzer.service.ts`):
```typescript
async function constructInterplayData(clientId: string, days: number): Promise<InterplayData> {
  // Fetch from all sources, merging OAuth and CSV data
  const [googleAdsData, searchConsoleData, ga4Data, auctionInsights] = await Promise.all([
    // Google Ads: merge API and CSV data, deduplicate by query_hash
    fetchMergedGoogleAdsData(clientId, days),
    // Search Console: OAuth only
    fetchSearchConsoleData(clientId, days),
    // GA4: OAuth only
    fetchGA4LandingPageData(clientId, days),
    // Auction Insights: CSV only (not available via API)
    fetchAuctionInsights(clientId, days),
  ]);

  // Combine into unified query view with competitive metrics
  return buildUnifiedQueryView(googleAdsData, searchConsoleData, ga4Data, auctionInsights);
}
```

#### The Scout (Data Triage)
Scans data to identify areas requiring deeper investigation:

**SEM Research Track (Battleground Keywords)**:
- High Spend + Low ROAS
- High Organic Rank (#1-3) + High Ad Spend (cannibalization risk)
- High Conversions + Low Impression Share (growth potential)
- **NEW**: High competitor overlap rate (from CSV auction insights)

**SEO Research Track (Critical Pages)**:
- High Paid Spend + Low Organic Rank
- High Organic Traffic + High Bounce Rate
- High Impressions + Low CTR

#### The Researcher (Active Research)
Fetches additional data for flagged items:
- **SEM**: Competitive Metrics from:
  - `auction_insights` table (CSV-sourced competitor data)
  - Google Ads API (Impression Share, Lost IS Rank/Budget) - if API access available
- **SEO**: Live HTML content for critical pages (optional, Post-MVP)

### Phase 2: Analysis Layer

#### SEM Agent Output Schema
```typescript
interface SEMAgentOutput {
  semActions: Array<{
    action: string;           // e.g., "Reduce bids on [keyword]"
    level: 'campaign' | 'keyword' | 'ad_group';
    expectedUplift: string;   // e.g., "Potential 15% cost saving"
    reasoning: string;        // Data-driven explanation
    impact: 'high' | 'medium' | 'low';
  }>;
}
```

#### SEO Agent Output Schema
```typescript
interface SEOAgentOutput {
  seoActions: Array<{
    condition: string;        // e.g., "High Paid Conversions vs. Low Organic Rank"
    recommendation: string;   // e.g., "Create dedicated landing page"
    specificActions: string[]; // e.g., ["Draft 1500w guide", "Update meta title"]
    impact: 'high' | 'medium' | 'low';
  }>;
}
```

### Phase 3: Strategy Layer

#### The Director Output Schema
```typescript
interface DirectorOutput {
  executiveSummary: {
    summary: string;          // 3-5 sentences on account health
    keyHighlights: string[];  // Top 2-3 insights
  };
  unifiedRecommendations: Array<{
    title: string;
    description: string;
    type: 'sem' | 'seo' | 'hybrid';
    impact: 'high' | 'medium' | 'low';
    effort: 'high' | 'medium' | 'low';
    actionItems: string[];
  }>;
}
```

#### Filtering Logic
- Rank all recommendations by Impact (High > Medium > Low)
- If > 10 High/Medium recommendations: DROP all Low
- If < 5 High/Medium recommendations: INCLUDE best Low to reach 5-7 items
- Cap at 10 items maximum

### Database Schema Considerations

> **Note**: Phase 0 (Prerequisites) must be implemented first. It creates the foundational tables
> for CSV upload support. See `documents/plans/ai-reporting/phase-0-prerequisites.md` for full details.

#### Phase 0 Tables (Prerequisites)

| Table | Purpose | Created In |
|-------|---------|------------|
| `csv_uploads` | Track upload history and file metadata | Phase 0 |
| `auction_insights` | Competitor data from Google Ads Auction Insights CSV | Phase 0 |
| `campaign_metrics` | Campaign-level performance data | Phase 0 |
| `device_metrics` | Device breakdown metrics | Phase 0 |
| `daily_account_metrics` | Daily time-series data | Phase 0 |

**Extended columns in existing tables (Phase 0)**:
- `google_ads_queries`: `data_source`, `match_type`, `criterion_status`, `campaign_status`, `ad_group_status`, `date_range_start`, `date_range_end`

#### Phase 4 Tables (Multi-Agent System)

#### 1. `interplay_reports` Table (New)

Stores the full report output from the multi-agent system:

```typescript
// interplay_reports table
interface InterplayReport {
  id: string;
  clientAccountId: string;
  triggerType: 'client_creation' | 'manual' | 'scheduled';
  status: 'pending' | 'researching' | 'analyzing' | 'completed' | 'failed';

  // Phase outputs (stored as encrypted JSON)
  scoutFindings: ScoutOutput;
  researcherData: ResearcherOutput;
  semAgentOutput: SEMAgentOutput;
  seoAgentOutput: SEOAgentOutput;
  directorOutput: DirectorOutput;

  // Metadata
  tokensUsed: number;
  processingTimeMs: number;
  createdAt: Date;
  completedAt: Date;
}
```

#### 2. `recommendations` Table (Extend Existing)

The Director's `unifiedRecommendations` should populate the existing `recommendations` table so they:
- Appear in the Recommendations tab
- Can be approved/rejected by users
- Track status (pending → approved → applied)

**Schema changes needed**:

```sql
-- Add new columns to recommendations table
ALTER TABLE recommendations ADD COLUMN source VARCHAR(50) DEFAULT 'legacy';
  -- 'legacy' = old single-query analysis
  -- 'interplay_report' = from SEO/SEM Interplay Report

ALTER TABLE recommendations ADD COLUMN interplay_report_id UUID REFERENCES interplay_reports(id);

ALTER TABLE recommendations ADD COLUMN recommendation_category VARCHAR(20);
  -- 'sem' | 'seo' | 'hybrid'

ALTER TABLE recommendations ADD COLUMN title VARCHAR(255);
  -- Short title for the recommendation (from Director output)

ALTER TABLE recommendations ADD COLUMN impact_level VARCHAR(20);
  -- 'high' | 'medium' | 'low' - SEPARATE from confidence_level
  -- impact_level = business impact (from Director)
  -- confidence_level = AI confidence in the recommendation (existing)

ALTER TABLE recommendations ADD COLUMN effort_level VARCHAR(20);
  -- 'high' | 'medium' | 'low'

ALTER TABLE recommendations ADD COLUMN action_items TEXT[];
  -- Array of specific action steps

-- Make query_overlap_id nullable (Interplay recommendations may not be query-specific)
ALTER TABLE recommendations ALTER COLUMN query_overlap_id DROP NOT NULL;
```

**Report API Endpoints**:

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/clients/:id/interplay-report` | GET | Get the latest report for display (Director output only) |
| `/api/clients/:id/interplay-report/debug` | GET | Get full report with all agent outputs for QA |
| `/api/clients/:id/interplay-report/regenerate` | POST | Manually trigger report regeneration (Post-MVP) |

**Debug Endpoint Response** (`/debug`):
```typescript
{
  ...InterplayReportResponse,
  agentOutputs: {
    scout: { battlegroundKeywords, criticalPages, summary },
    researcher: { enrichedKeywords, enrichedPages, researchSummary },
    semAgent: { semActions: [...] },
    seoAgent: { seoActions: [...] },
    director: { executiveSummary, unifiedRecommendations }
  }
}
```

Use the debug endpoint to review:
- **Scout output**: Which keywords/pages were flagged for investigation
- **Researcher output**: What competitive metrics and page content was gathered
- **SEM Agent output**: Raw `semActions[]` before Director synthesis
- **SEO Agent output**: Raw `seoActions[]` before Director synthesis
- **Director output**: How recommendations were prioritized and filtered

---

**API Changes Required (Recommendations)**:

The existing `/api/clients/:id/recommendations` endpoint joins through `query_overlaps` to get `queryText`. With nullable `query_overlap_id`, we need:

```typescript
// apps/api/src/routes/clients.routes.ts - Updated query
const recommendations = await db
  .select({
    // ... existing fields
    queryText: sql`COALESCE(sq.query_text, r.title)`, // Fallback to title if no query
  })
  .from(recommendations as r)
  .leftJoin(queryOverlaps, eq(r.queryOverlapId, queryOverlaps.id)) // LEFT JOIN not INNER
  .leftJoin(searchQueries as sq, eq(queryOverlaps.searchQueryId, sq.id))
  .where(eq(r.clientAccountId, clientId));
```

**Frontend Changes Required**:

Update `RecommendationCard.tsx` to handle both sources:

```tsx
// Show title OR queryText depending on source
<h3>{recommendation.title || recommendation.queryText}</h3>

// Show impact badge (NOT confidence) for interplay recommendations
{recommendation.source === 'interplay_report' && (
  <Badge variant={impactVariant}>{recommendation.impactLevel} Impact</Badge>
)}

// Show category badge for interplay recommendations
{recommendation.recommendationCategory && (
  <Badge>{recommendation.recommendationCategory.toUpperCase()}</Badge>
)}
```

**Data flow**:

```
┌─────────────────────────────────────────────────────────────────┐
│                    REPORT GENERATION FLOW                        │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Director Output                                                 │
│  └── unifiedRecommendations[]                                   │
│          │                                                       │
│          ▼                                                       │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │  For each recommendation:                                   ││
│  │  1. Insert into `recommendations` table                     ││
│  │  2. Set source = 'interplay_report'                         ││
│  │  3. Set interplay_report_id = report.id                     ││
│  │  4. Set query_overlap_id = NULL (no specific query)         ││
│  │  5. Map fields:                                             ││
│  │     - title → title (NEW column)                            ││
│  │     - type → recommendation_category                        ││
│  │     - impact → impact_level (NEW column, NOT confidence)    ││
│  │     - effort → effort_level                                 ││
│  │     - actionItems → action_items                            ││
│  │     - description → reasoning                               ││
│  │  6. Set status = 'pending'                                  ││
│  │  7. Set confidence_level = 'high' (default for AI reports)  ││
│  └─────────────────────────────────────────────────────────────┘│
│          │                                                       │
│          ▼                                                       │
│  Recommendations Tab shows all recommendations                   │
│  (both legacy query-based AND interplay report-based)           │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

**Recommendation types mapping**:

| Director Output | `recommendation_type` | `recommendation_category` |
|-----------------|----------------------|---------------------------|
| SEM: "Pause ads" | `pause` | `sem` |
| SEM: "Reduce bids" | `reduce` | `sem` |
| SEM: "Increase bids" | `increase` | `sem` |
| SEO: "Optimize page" | `maintain` (or new type) | `seo` |
| Hybrid | varies | `hybrid` |

**Note**: May need to extend `recommendationTypeEnum` to include SEO-specific types like `'optimize_content'`, `'create_content'`, `'fix_technical'`.

### Report Display Considerations

The SEO/SEM Interplay Report will need a unique template that displays:

1. **Executive Summary Card**
   - Health state narrative
   - Key highlights as badges/chips

2. **Unified Recommendations List**
   - Sorted by impact
   - Color-coded by type (SEM/SEO/Hybrid)
   - Effort indicator
   - Expandable action items

3. **Agent Insights Accordion** (optional deep-dive)
   - Raw SEM Agent findings
   - Raw SEO Agent findings
   - Research data used

### Integration Points

When implementing the report infrastructure, ensure:

1. **Report type enum** includes `'seo-sem-interplay'`
2. **ReportData interface** can accommodate agent outputs
3. **PDF templates** support the unified recommendations format
4. **Report history** tracks auto-generated vs manual reports
5. **API routes** support triggering analysis (for future manual re-runs)

---

## Sources

- [@react-pdf/renderer](https://react-pdf.org/) - React-first PDF generation
- [jsPDF](https://github.com/parallax/jsPDF) - Client-side PDF generation
- [pdfmake](http://pdfmake.org/) - Declarative PDF generation
- [Top 6 PDF Libraries for React](https://blog.react-pdf.dev/6-open-source-pdf-generation-and-modification-libraries-every-react-dev-should-know-in-2025)
- [jsreport](https://jsreport.net/) - Full reporting platform (alternative)
- [Carbone](https://carbone.io/) - Template-based document generation (alternative)
