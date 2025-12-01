# Phase 1: Reports Tab UI Implementation Prompt

You are implementing Phase 1 of the Advergent AI Reporting system - the Reports Tab UI Infrastructure. This phase creates the frontend components to display the SEO/SEM Interplay Reports that the Phase 4 multi-agent system generates.

## Prerequisites Completed

- **Phase 0**: CSV upload infrastructure with `auction_insights`, `csv_uploads` tables ✅
- **Phase 4**: Multi-agent interplay report system with Scout, Researcher, SEM, SEO, and Director agents ✅

The backend API endpoint `GET /api/clients/:clientId/interplay-report` is already implemented and returns report data.

---

## Project Structure

This is a monorepo with:
- `apps/web` - React + Vite frontend (TypeScript)
- `apps/api` - Express backend (TypeScript, ES modules)
- `packages/shared` - Shared types and utilities

### Key Frontend Patterns

1. **Path Aliases**: Use `@/` for imports (e.g., `@/components/ui/card`)
2. **State Management**: TanStack Query v5 for server state
3. **UI Components**: shadcn/ui (Radix primitives + Tailwind)
4. **API Client**: Use `useApiClient()` hook from `@/lib/api` for authenticated requests
5. **Styling**: Tailwind CSS with slate colors for text, blue for accents

### Available UI Components

Located in `apps/web/src/components/ui/`:
- `button.tsx` - Button component
- `card.tsx` - Card, CardHeader, CardTitle, CardDescription, CardContent
- `badge.tsx` - Badge component
- `skeleton.tsx` - Skeleton loading component
- `alert.tsx` - Alert component
- `dialog.tsx` - Dialog/Modal component
- `accordion.tsx` - Accordion component
- `scroll-area.tsx` - Scroll area component
- `select.tsx` - Select dropdown
- `input.tsx` - Input component
- `label.tsx` - Label component

Icons are imported from `lucide-react`.

---

## Current ClientDetail.tsx Structure

The `ClientDetail.tsx` page at `apps/web/src/pages/ClientDetail.tsx` currently has 6 tabs:

```typescript
type TabType = 'overview' | 'recommendations' | 'query-data' | 'search-console' | 'ga4' | 'analysis';

const tabs = [
  { id: 'overview' as const, label: 'Overview' },
  { id: 'recommendations' as const, label: 'Recommendations', badge: recommendations?.summary.total },
  { id: 'query-data' as const, label: 'Query Data' },
  { id: 'search-console' as const, label: 'Search Console', badge: searchConsoleData?.totalQueries },
  { id: 'ga4' as const, label: 'GA4 Analytics', badge: ga4Data?.totalMetrics },
  { id: 'analysis' as const, label: 'Analysis' },
];
```

Tab content is rendered conditionally: `{activeTab === 'overview' && ( ... )}`

---

## Backend API Response Format

The `GET /api/clients/:clientId/interplay-report` endpoint returns:

```typescript
interface InterplayReportResponse {
  id: string;
  clientAccountId: string;
  status: 'pending' | 'researching' | 'analyzing' | 'completed' | 'failed';
  dateRange: {
    start: string;   // ISO date string (e.g., "2024-11-01")
    end: string;     // ISO date string
    days: number;    // Always 30 for MVP
  };
  executiveSummary?: {
    summary: string;
    keyHighlights: string[];
  };
  recommendations?: Array<{
    title: string;
    description: string;
    type: 'sem' | 'seo' | 'hybrid';
    impact: 'high' | 'medium' | 'low';
    effort: 'high' | 'medium' | 'low';
    actionItems: string[];
  }>;
  metadata: {
    tokensUsed?: number;
    processingTimeMs?: number;
    createdAt: string;    // ISO timestamp
    completedAt?: string;
  };
  error?: string;
}
```

Returns 404 if no report exists for the client.

---

## Implementation Tasks

### Task 1: Create useInterplayReport Hook

**File**: `apps/web/src/hooks/useInterplayReport.ts`

Create a TanStack Query hook that:
1. Fetches from `GET /api/clients/${clientId}/interplay-report`
2. Uses `useApiClient()` for authenticated requests
3. Returns `null` (not throws) when API returns 404
4. Includes the query key `['client', clientId, 'interplay-report']`

```typescript
import { useQuery } from '@tanstack/react-query';
import { useApiClient } from '@/lib/api';

// Define types inline (or import from shared if available)
interface InterplayReportResponse {
  id: string;
  clientAccountId: string;
  status: 'pending' | 'researching' | 'analyzing' | 'completed' | 'failed';
  dateRange: {
    start: string;
    end: string;
    days: number;
  };
  executiveSummary?: {
    summary: string;
    keyHighlights: string[];
  };
  recommendations?: Array<{
    title: string;
    description: string;
    type: 'sem' | 'seo' | 'hybrid';
    impact: 'high' | 'medium' | 'low';
    effort: 'high' | 'medium' | 'low';
    actionItems: string[];
  }>;
  metadata: {
    tokensUsed?: number;
    processingTimeMs?: number;
    createdAt: string;
    completedAt?: string;
  };
  error?: string;
}

export function useInterplayReport(clientId: string) {
  const apiClient = useApiClient();

  return useQuery<InterplayReportResponse | null>({
    queryKey: ['client', clientId, 'interplay-report'],
    queryFn: async () => {
      try {
        const { data } = await apiClient.get(`/api/clients/${clientId}/interplay-report`);
        return data;
      } catch (error: any) {
        // Return null if no report exists (404)
        if (error.response?.status === 404) {
          return null;
        }
        throw error;
      }
    },
    enabled: !!clientId,
  });
}
```

### Task 2: Update ClientDetail.tsx Tab System

**File**: `apps/web/src/pages/ClientDetail.tsx`

1. Add `'reports'` to the `TabType` union:
```typescript
type TabType = 'overview' | 'recommendations' | 'query-data' | 'search-console' | 'ga4' | 'analysis' | 'reports';
```

2. Import FileText icon:
```typescript
import { ArrowLeft, RefreshCw, FileText } from 'lucide-react';
```

3. Add reports tab to the `tabs` array (add it after 'analysis'):
```typescript
{ id: 'reports' as const, label: 'Reports', icon: FileText },
```

4. Add conditional rendering for reports tab (after the analysis tab section):
```typescript
{activeTab === 'reports' && (
  <ReportsTab clientId={clientId} client={client} />
)}
```

5. Import the ReportsTab component at the top:
```typescript
import { ReportsTab } from '@/components/clients/ReportsTab';
```

### Task 3: Create ReportsTab Component

**File**: `apps/web/src/components/clients/ReportsTab.tsx`

This is the main container that:
- Fetches report data using `useInterplayReport`
- Handles loading, empty, error, and in-progress states
- Renders the completed report view

Handle these states:
1. **Loading**: Show skeleton
2. **Error**: Show destructive alert
3. **No report (null)**: Show empty state with FileText icon
4. **In progress** (status !== 'completed'): Show spinning RefreshCw with status
5. **Failed**: Show error alert
6. **Completed**: Render full report with header, export buttons, and content

```typescript
import { useInterplayReport } from '@/hooks/useInterplayReport';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert } from '@/components/ui/alert';
import { FileText, RefreshCw } from 'lucide-react';
import { ReportHeader } from './reports/ReportHeader';
import { ReportPreviewContainer } from './reports/ReportPreviewContainer';
import { InterplayReportView } from './reports/templates/InterplayReportView';
import { ExportActions } from './reports/ExportActions';

interface ReportsTabProps {
  clientId: string;
  client: {
    id: string;
    name: string;
  };
}

export function ReportsTab({ clientId, client }: ReportsTabProps) {
  const { data: report, isLoading, isError, error } = useInterplayReport(clientId);

  // Loading state
  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  // Error state
  if (isError) {
    return (
      <Alert variant="destructive">
        <p>Error loading report: {(error as Error)?.message || 'Unknown error'}</p>
      </Alert>
    );
  }

  // Empty state - no report generated yet
  if (!report) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <div className="text-slate-400 mb-4">
            <FileText className="h-12 w-12 mx-auto" />
          </div>
          <p className="text-slate-500 text-lg">No report available yet</p>
          <p className="text-sm text-slate-400 mt-2">
            The SEO/SEM Interplay Report will be generated automatically after the initial data sync completes.
          </p>
        </CardContent>
      </Card>
    );
  }

  // Report failed
  if (report.status === 'failed') {
    return (
      <Alert variant="destructive">
        <p>Report generation failed: {report.error || 'Unknown error'}. Please try syncing the client data again.</p>
      </Alert>
    );
  }

  // Report still generating
  if (report.status !== 'completed') {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <div className="text-blue-500 mb-4">
            <RefreshCw className="h-12 w-12 mx-auto animate-spin" />
          </div>
          <p className="text-slate-500 text-lg">Report is being generated...</p>
          <p className="text-sm text-slate-400 mt-2">
            Status: {report.status}
          </p>
          <Badge variant="secondary" className="mt-4">
            {report.status === 'researching' && 'Gathering data...'}
            {report.status === 'analyzing' && 'AI analysis in progress...'}
            {report.status === 'pending' && 'Queued for processing...'}
          </Badge>
        </CardContent>
      </Card>
    );
  }

  // Completed report - render the full view
  return (
    <div className="space-y-6">
      <ReportHeader
        title="SEO/SEM Interplay Report"
        generatedAt={report.metadata.createdAt}
        dateRange={report.dateRange}
      />

      <ExportActions
        report={report}
        clientName={client.name}
      />

      <ReportPreviewContainer>
        <InterplayReportView report={report} />
      </ReportPreviewContainer>
    </div>
  );
}
```

### Task 4: Create Report Header Component

**File**: `apps/web/src/components/clients/reports/ReportHeader.tsx`

```typescript
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';

interface ReportHeaderProps {
  title: string;
  generatedAt: string;
  dateRange: {
    start: string;
    end: string;
    days: number;
  };
}

export function ReportHeader({ title, generatedAt, dateRange }: ReportHeaderProps) {
  const formatDate = (dateStr: string) => {
    return format(new Date(dateStr), 'MMM d, yyyy');
  };

  return (
    <div className="flex items-center justify-between">
      <div>
        <h2 className="text-2xl font-bold text-slate-900">{title}</h2>
        <p className="text-sm text-slate-500 mt-1">
          Analyzing {formatDate(dateRange.start)} - {formatDate(dateRange.end)} ({dateRange.days} days)
        </p>
      </div>
      <div className="text-right">
        <p className="text-sm text-slate-500">
          Generated {formatDate(generatedAt)}
        </p>
        <Badge variant="outline" className="mt-1">
          Auto-Generated
        </Badge>
      </div>
    </div>
  );
}
```

### Task 5: Create Export Actions Component (Stub)

**File**: `apps/web/src/components/clients/reports/ExportActions.tsx`

PDF and CSV export will be implemented in Phases 2 and 3. Create stubs with console.log for now.

```typescript
import { Button } from '@/components/ui/button';
import { Download, FileSpreadsheet } from 'lucide-react';

interface ExportActionsProps {
  report: any;
  clientName: string;
}

export function ExportActions({ report, clientName }: ExportActionsProps) {
  // PDF generation will be implemented in Phase 2
  const handleDownloadPDF = async () => {
    console.log('PDF download - to be implemented in Phase 2', { report, clientName });
  };

  // CSV export will be implemented in Phase 3
  const handleExportCSV = () => {
    console.log('CSV export - to be implemented in Phase 3', { report, clientName });
  };

  return (
    <div className="flex gap-3">
      <Button onClick={handleDownloadPDF} className="gap-2">
        <Download className="h-4 w-4" />
        Download PDF
      </Button>
      <Button variant="outline" onClick={handleExportCSV} className="gap-2">
        <FileSpreadsheet className="h-4 w-4" />
        Export CSV
      </Button>
    </div>
  );
}
```

### Task 6: Create Report Preview Container

**File**: `apps/web/src/components/clients/reports/ReportPreviewContainer.tsx`

```typescript
import { ReactNode } from 'react';

interface ReportPreviewContainerProps {
  children: ReactNode;
}

export function ReportPreviewContainer({ children }: ReportPreviewContainerProps) {
  return (
    <div className="bg-white rounded-lg shadow-lg border border-slate-200 overflow-hidden">
      <div className="max-h-[800px] overflow-y-auto">
        <div className="p-8">
          {children}
        </div>
      </div>
    </div>
  );
}
```

### Task 7: Create Executive Summary Component

**File**: `apps/web/src/components/clients/reports/components/ReportExecutiveSummary.tsx`

```typescript
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Lightbulb } from 'lucide-react';

interface ReportExecutiveSummaryProps {
  summary: string;
  keyHighlights: string[];
}

export function ReportExecutiveSummary({ summary, keyHighlights }: ReportExecutiveSummaryProps) {
  return (
    <Card className="border-blue-200 bg-blue-50/50">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-blue-900">
          <Lightbulb className="h-5 w-5" />
          Executive Summary
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-slate-700 leading-relaxed mb-4">{summary}</p>

        {keyHighlights.length > 0 && (
          <div className="mt-4">
            <h4 className="text-sm font-semibold text-slate-600 mb-2">Key Highlights</h4>
            <ul className="space-y-2">
              {keyHighlights.map((highlight, index) => (
                <li key={index} className="flex items-start gap-2">
                  <Badge variant="secondary" className="mt-0.5 shrink-0">
                    {index + 1}
                  </Badge>
                  <span className="text-sm text-slate-600">{highlight}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
```

### Task 8: Create Recommendation Card Component

**File**: `apps/web/src/components/clients/reports/components/ReportRecommendationCard.tsx`

```typescript
import { useState } from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ChevronDown, ChevronUp, Target, Zap } from 'lucide-react';

interface ReportRecommendationCardProps {
  title: string;
  description: string;
  type: 'sem' | 'seo' | 'hybrid';
  impact: 'high' | 'medium' | 'low';
  effort: 'high' | 'medium' | 'low';
  actionItems: string[];
  index: number;
}

export function ReportRecommendationCard({
  title,
  description,
  type,
  impact,
  effort,
  actionItems,
  index,
}: ReportRecommendationCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const typeColors = {
    sem: 'bg-purple-100 text-purple-800 border-purple-200',
    seo: 'bg-green-100 text-green-800 border-green-200',
    hybrid: 'bg-orange-100 text-orange-800 border-orange-200',
  };

  const impactColors = {
    high: 'bg-red-100 text-red-800',
    medium: 'bg-yellow-100 text-yellow-800',
    low: 'bg-slate-100 text-slate-800',
  };

  const effortColors = {
    high: 'text-red-600',
    medium: 'text-yellow-600',
    low: 'text-green-600',
  };

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-3">
            <span className="flex items-center justify-center h-6 w-6 rounded-full bg-slate-100 text-slate-600 text-sm font-medium">
              {index + 1}
            </span>
            <div>
              <div className="flex items-center gap-2 mb-1">
                <Badge className={typeColors[type]}>
                  {type.toUpperCase()}
                </Badge>
                <Badge className={impactColors[impact]}>
                  <Target className="h-3 w-3 mr-1" />
                  {impact.charAt(0).toUpperCase() + impact.slice(1)} Impact
                </Badge>
              </div>
              <h3 className="font-semibold text-slate-900">{title}</h3>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className={`text-xs ${effortColors[effort]}`}>
              <Zap className="h-3 w-3 inline mr-1" />
              {effort.charAt(0).toUpperCase() + effort.slice(1)} Effort
            </span>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-slate-600 mb-3">{description}</p>

        {actionItems.length > 0 && (
          <div>
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className="flex items-center gap-1 text-sm text-blue-600 hover:text-blue-800 font-medium"
            >
              {isExpanded ? (
                <>
                  <ChevronUp className="h-4 w-4" />
                  Hide Action Items
                </>
              ) : (
                <>
                  <ChevronDown className="h-4 w-4" />
                  View Action Items ({actionItems.length})
                </>
              )}
            </button>

            {isExpanded && (
              <ul className="mt-3 space-y-2 pl-4 border-l-2 border-slate-200">
                {actionItems.map((item, idx) => (
                  <li key={idx} className="text-sm text-slate-600">
                    {item}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
```

### Task 9: Create Unified Recommendations Component

**File**: `apps/web/src/components/clients/reports/components/ReportUnifiedRecommendations.tsx`

```typescript
import { ReportRecommendationCard } from './ReportRecommendationCard';

interface Recommendation {
  title: string;
  description: string;
  type: 'sem' | 'seo' | 'hybrid';
  impact: 'high' | 'medium' | 'low';
  effort: 'high' | 'medium' | 'low';
  actionItems: string[];
}

interface ReportUnifiedRecommendationsProps {
  recommendations: Recommendation[];
}

export function ReportUnifiedRecommendations({ recommendations }: ReportUnifiedRecommendationsProps) {
  // Group by impact for summary
  const highImpact = recommendations.filter(r => r.impact === 'high');
  const mediumImpact = recommendations.filter(r => r.impact === 'medium');
  const lowImpact = recommendations.filter(r => r.impact === 'low');

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-slate-900">
          Unified Recommendations ({recommendations.length})
        </h2>
        <div className="flex gap-4 text-sm text-slate-500">
          <span className="flex items-center gap-1">
            <span className="h-2 w-2 rounded-full bg-red-400" />
            High: {highImpact.length}
          </span>
          <span className="flex items-center gap-1">
            <span className="h-2 w-2 rounded-full bg-yellow-400" />
            Medium: {mediumImpact.length}
          </span>
          <span className="flex items-center gap-1">
            <span className="h-2 w-2 rounded-full bg-slate-400" />
            Low: {lowImpact.length}
          </span>
        </div>
      </div>

      <div className="space-y-4">
        {recommendations.map((rec, index) => (
          <ReportRecommendationCard
            key={index}
            index={index}
            title={rec.title}
            description={rec.description}
            type={rec.type}
            impact={rec.impact}
            effort={rec.effort}
            actionItems={rec.actionItems}
          />
        ))}
      </div>
    </div>
  );
}
```

### Task 10: Create InterplayReportView Template

**File**: `apps/web/src/components/clients/reports/templates/InterplayReportView.tsx`

```typescript
import { ReportExecutiveSummary } from '../components/ReportExecutiveSummary';
import { ReportUnifiedRecommendations } from '../components/ReportUnifiedRecommendations';

interface InterplayReportViewProps {
  report: {
    executiveSummary?: {
      summary: string;
      keyHighlights: string[];
    };
    recommendations?: Array<{
      title: string;
      description: string;
      type: 'sem' | 'seo' | 'hybrid';
      impact: 'high' | 'medium' | 'low';
      effort: 'high' | 'medium' | 'low';
      actionItems: string[];
    }>;
  };
}

export function InterplayReportView({ report }: InterplayReportViewProps) {
  return (
    <div className="space-y-8">
      {/* Executive Summary Section */}
      {report.executiveSummary && (
        <ReportExecutiveSummary
          summary={report.executiveSummary.summary}
          keyHighlights={report.executiveSummary.keyHighlights}
        />
      )}

      {/* Divider */}
      <hr className="border-slate-200" />

      {/* Unified Recommendations Section */}
      {report.recommendations && report.recommendations.length > 0 && (
        <ReportUnifiedRecommendations
          recommendations={report.recommendations}
        />
      )}

      {/* Empty state if no recommendations */}
      {(!report.recommendations || report.recommendations.length === 0) && (
        <div className="text-center py-8 text-slate-500">
          <p>No recommendations generated for this report.</p>
        </div>
      )}
    </div>
  );
}
```

---

## File Structure Summary

After completing this phase, you should have:

```
apps/web/src/
├── hooks/
│   └── useInterplayReport.ts         # NEW
├── pages/
│   └── ClientDetail.tsx              # MODIFIED: Added reports tab
└── components/clients/
    ├── ReportsTab.tsx                # NEW
    └── reports/
        ├── ReportHeader.tsx          # NEW
        ├── ExportActions.tsx         # NEW
        ├── ReportPreviewContainer.tsx # NEW
        ├── components/
        │   ├── ReportExecutiveSummary.tsx      # NEW
        │   ├── ReportRecommendationCard.tsx    # NEW
        │   └── ReportUnifiedRecommendations.tsx # NEW
        └── templates/
            └── InterplayReportView.tsx # NEW
```

---

## Testing Checklist

After implementation, verify:

- [ ] Reports tab appears in ClientDetail navigation (7th tab)
- [ ] Clicking Reports tab shows loading skeleton initially
- [ ] Empty state displays when no report exists (FileText icon with message)
- [ ] "Generating" state shows when report status is pending/researching/analyzing
- [ ] Error alert shows when report status is 'failed'
- [ ] Completed report displays executive summary correctly
- [ ] Key highlights render as numbered badges
- [ ] Recommendations display with correct type badges (SEM=purple, SEO=green, Hybrid=orange)
- [ ] Impact badges show correct colors (High=red, Medium=yellow, Low=slate)
- [ ] Effort indicator shows in top-right of each card
- [ ] Action items expand/collapse correctly when clicked
- [ ] Report header shows correct date range and generation date
- [ ] Export buttons are visible (console.log on click for now)
- [ ] No TypeScript errors
- [ ] No console errors in browser

---

## Notes

1. **date-fns**: Already installed in the project. Use `import { format } from 'date-fns'` for date formatting.

2. **API Authentication**: Always use `useApiClient()` hook, not the raw `apiClient`, to ensure Clerk tokens are included.

3. **Error Handling**: The hook should return `null` for 404 responses, not throw. This distinguishes "no report" from actual errors.

4. **Type Safety**: Define types inline in the hook file. The backend types are in `apps/api/src/services/interplay-report/types.ts` for reference.

5. **Styling Consistency**: Follow existing patterns - use slate colors for text, blue for primary actions/accents, and the established color scheme for badges.

---

## Commands

Run the dev server to test:
```bash
npm run dev
```

Type check:
```bash
npm run type-check
```
