# Phase 1: Reports Tab UI Infrastructure

## Objective

Build the frontend infrastructure for displaying the SEO/SEM Interplay Report in a new "Reports" tab within the Client Details page. This phase creates the UI shell that will display pre-generated reports fetched from the backend.

## Prerequisites

- **Required**: Phase 0 (Prerequisites) must be completed first - it establishes the database schema
- **Recommended**: Phase 4 (Multi-Agent System) should be completed so there's actual report data to display
- **Alternative**: If Phase 4 is not ready, use the mock data provided at the end of this document for UI development

> **Note**: The recommended implementation order is: `Phase 0 → Phase 4 → Phase 1 → Phase 2 → Phase 3 → Phase 5`
> See `/documents/plans/ai-reporting/README.md` for details on why this order is recommended.

## Context

### Current State
- `ClientDetail.tsx` has 6 tabs: Overview, Recommendations, Query Data, Search Console, GA4 Analytics, Analysis
- Tab system uses a `TabType` union type and a `tabs` array for configuration
- Each tab fetches its own data via custom hooks (e.g., `useClientDetail`)
- Components are located in `apps/web/src/components/clients/`

### Target State
- Add a 7th "Reports" tab that displays the auto-generated SEO/SEM Interplay Report
- Report is fetched from `GET /api/clients/:id/interplay-report` endpoint
- Display executive summary + unified recommendations in a read-only, print-friendly format

## Tasks

### Task 1: Add Report Types to Shared Package

Create the type definitions that will be used by both frontend and backend.

**File**: `packages/shared/src/types/reports.types.ts`

```typescript
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

// Full interplay report response from API
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
```

**File**: `packages/shared/src/types/index.ts` - Add export:
```typescript
export * from './reports.types';
```

### Task 2: Create useInterplayReport Hook

**File**: `apps/web/src/hooks/useInterplayReport.ts`

```typescript
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';
// Note: If @advergent/shared import doesn't work, define types locally temporarily

interface InterplayReportResponse {
  id: string;
  clientAccountId: string;
  trigger: 'client_creation' | 'manual' | 'scheduled';
  status: 'pending' | 'researching' | 'analyzing' | 'completed' | 'failed';
  dateRange: {
    startDate: string;
    endDate: string;
    days: number;
  };
  executiveSummary: {
    summary: string;
    keyHighlights: string[];
  };
  unifiedRecommendations: Array<{
    title: string;
    description: string;
    type: 'sem' | 'seo' | 'hybrid';
    impact: 'high' | 'medium' | 'low';
    effort: 'high' | 'medium' | 'low';
    actionItems: string[];
  }>;
  generatedAt: string;
  tokensUsed?: number;
  processingTimeMs?: number;
}

export function useInterplayReport(clientId: string) {
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

### Task 3: Update ClientDetail.tsx Tab System

**File**: `apps/web/src/pages/ClientDetail.tsx`

1. Add `'reports'` to the `TabType` union:
```typescript
type TabType = 'overview' | 'recommendations' | 'query-data' | 'search-console' | 'ga4' | 'analysis' | 'reports';
```

2. Import the FileText icon from lucide-react:
```typescript
import { ArrowLeft, RefreshCw, FileText } from 'lucide-react';
```

3. Add reports tab to the `tabs` array:
```typescript
const tabs = [
  { id: 'overview' as const, label: 'Overview' },
  { id: 'recommendations' as const, label: 'Recommendations', badge: recommendations?.summary.total },
  { id: 'query-data' as const, label: 'Query Data' },
  { id: 'search-console' as const, label: 'Search Console', badge: searchConsoleData?.totalQueries },
  { id: 'ga4' as const, label: 'GA4 Analytics', badge: ga4Data?.totalMetrics },
  { id: 'analysis' as const, label: 'Analysis' },
  { id: 'reports' as const, label: 'Reports', icon: FileText },
];
```

4. Add conditional rendering for reports tab:
```typescript
{activeTab === 'reports' && (
  <ReportsTab clientId={clientId} client={client} />
)}
```

5. Import the ReportsTab component:
```typescript
import { ReportsTab } from '@/components/clients/ReportsTab';
```

### Task 4: Create ReportsTab Component

**File**: `apps/web/src/components/clients/ReportsTab.tsx`

This is the main container component that:
- Fetches report data using `useInterplayReport`
- Handles loading, empty, and error states
- Renders the report preview

```typescript
import { useInterplayReport } from '@/hooks/useInterplayReport';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert } from '@/components/ui/alert';
import { ReportHeader } from './reports/ReportHeader';
import { ReportPreviewContainer } from './reports/ReportPreviewContainer';
import { InterplayReportView } from './reports/templates/InterplayReportView';
import { ExportActions } from './reports/ExportActions';

interface ReportsTabProps {
  clientId: string;
  client: {
    id: string;
    name: string;
    // ... other client fields
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
        <p>Error loading report: {error?.message || 'Unknown error'}</p>
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

  // Report still generating
  if (report.status !== 'completed') {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <div className="animate-spin text-blue-500 mb-4">
            <RefreshCw className="h-12 w-12 mx-auto" />
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

  // Report failed
  if (report.status === 'failed') {
    return (
      <Alert variant="destructive">
        <p>Report generation failed. Please try syncing the client data again.</p>
      </Alert>
    );
  }

  // Completed report - render the full view
  return (
    <div className="space-y-6">
      <ReportHeader
        title="SEO/SEM Interplay Report"
        generatedAt={report.generatedAt}
        dateRange={report.dateRange}
        trigger={report.trigger}
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

### Task 5: Create Report Header Component

**File**: `apps/web/src/components/clients/reports/ReportHeader.tsx`

```typescript
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';

interface ReportHeaderProps {
  title: string;
  generatedAt: string;
  dateRange: {
    startDate: string;
    endDate: string;
    days: number;
  };
  trigger: 'client_creation' | 'manual' | 'scheduled';
}

export function ReportHeader({ title, generatedAt, dateRange, trigger }: ReportHeaderProps) {
  const formatDate = (dateStr: string) => {
    return format(new Date(dateStr), 'MMM d, yyyy');
  };

  const triggerLabel = {
    client_creation: 'Initial Analysis',
    manual: 'Manual',
    scheduled: 'Scheduled',
  };

  return (
    <div className="flex items-center justify-between">
      <div>
        <h2 className="text-2xl font-bold text-slate-900">{title}</h2>
        <p className="text-sm text-slate-500 mt-1">
          Analyzing {formatDate(dateRange.startDate)} - {formatDate(dateRange.endDate)} ({dateRange.days} days)
        </p>
      </div>
      <div className="text-right">
        <p className="text-sm text-slate-500">
          Generated {formatDate(generatedAt)}
        </p>
        <Badge variant="outline" className="mt-1">
          {triggerLabel[trigger]}
        </Badge>
      </div>
    </div>
  );
}
```

### Task 6: Create Export Actions Component

**File**: `apps/web/src/components/clients/reports/ExportActions.tsx`

```typescript
import { Button } from '@/components/ui/button';
import { Download, FileSpreadsheet } from 'lucide-react';

interface ExportActionsProps {
  report: any; // Will be typed properly with InterplayReportResponse
  clientName: string;
}

export function ExportActions({ report, clientName }: ExportActionsProps) {
  // PDF generation will be implemented in Phase 2
  const handleDownloadPDF = async () => {
    console.log('PDF download - to be implemented in Phase 2');
    // TODO: Implement in Phase 2
  };

  // CSV export will be implemented in Phase 3
  const handleExportCSV = () => {
    console.log('CSV export - to be implemented in Phase 3');
    // TODO: Implement in Phase 3
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

### Task 7: Create Report Preview Container

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

### Task 8: Create Read-Only Presentational Components

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
  // Group by impact for visual hierarchy
  const highImpact = recommendations.filter(r => r.impact === 'high');
  const mediumImpact = recommendations.filter(r => r.impact === 'medium');
  const lowImpact = recommendations.filter(r => r.impact === 'low');

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-slate-900">
          Unified Recommendations ({recommendations.length})
        </h2>
        <div className="flex gap-2 text-sm text-slate-500">
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

### Task 9: Create InterplayReportView Template

**File**: `apps/web/src/components/clients/reports/templates/InterplayReportView.tsx`

```typescript
import { ReportExecutiveSummary } from '../components/ReportExecutiveSummary';
import { ReportUnifiedRecommendations } from '../components/ReportUnifiedRecommendations';

interface InterplayReportViewProps {
  report: {
    executiveSummary: {
      summary: string;
      keyHighlights: string[];
    };
    unifiedRecommendations: Array<{
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
      <ReportExecutiveSummary
        summary={report.executiveSummary.summary}
        keyHighlights={report.executiveSummary.keyHighlights}
      />

      {/* Divider */}
      <hr className="border-slate-200" />

      {/* Unified Recommendations Section */}
      <ReportUnifiedRecommendations
        recommendations={report.unifiedRecommendations}
      />
    </div>
  );
}
```

## File Structure Summary

After completing this phase, you should have:

```
packages/shared/src/types/
├── index.ts                          # Updated: export * from './reports.types'
└── reports.types.ts                  # NEW

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

## Testing Checklist

- [ ] Reports tab appears in ClientDetail navigation
- [ ] Clicking Reports tab shows loading skeleton initially
- [ ] Empty state displays when no report exists (404 from API)
- [ ] "Generating" state shows when report status is pending/researching/analyzing
- [ ] Completed report displays executive summary correctly
- [ ] Key highlights render as numbered list
- [ ] Recommendations display with correct type badges (SEM/SEO/Hybrid)
- [ ] Impact badges show correct colors (High=red, Medium=yellow, Low=slate)
- [ ] Action items expand/collapse correctly
- [ ] Report header shows correct date range and generation date
- [ ] Trigger badge shows "Initial Analysis" for client_creation reports
- [ ] Export buttons are visible (functionality in later phases)

## Mock Data for Testing

If Phase 4 is not complete, use this mock data in `useInterplayReport`:

```typescript
const mockReport = {
  id: 'mock-report-1',
  clientAccountId: clientId,
  trigger: 'client_creation' as const,
  status: 'completed' as const,
  dateRange: {
    startDate: '2024-11-01',
    endDate: '2024-11-30',
    days: 30,
  },
  executiveSummary: {
    summary: 'This account shows strong organic presence but significant paid/organic cannibalization on brand terms. Immediate action on 3 high-impact recommendations could save approximately $2,400/month while maintaining conversion volume.',
    keyHighlights: [
      '42% of ad spend is on queries where you already rank #1-3 organically',
      '3 critical landing pages have bounce rates above 70%',
      'Competitor "example.com" has increased impression share by 15% this month',
    ],
  },
  unifiedRecommendations: [
    {
      title: 'Pause ads on brand keywords',
      description: 'You are ranking #1 organically for your brand terms with 45% CTR. Paid ads are cannibalizing organic clicks.',
      type: 'sem' as const,
      impact: 'high' as const,
      effort: 'low' as const,
      actionItems: [
        'Pause campaigns targeting exact match brand terms',
        'Monitor organic traffic for 2 weeks to confirm no drop',
        'Reallocate budget to non-brand campaigns',
      ],
    },
    {
      title: 'Optimize landing page for "services" keywords',
      description: 'High paid conversions but 78% bounce rate indicates poor landing page experience.',
      type: 'seo' as const,
      impact: 'high' as const,
      effort: 'medium' as const,
      actionItems: [
        'Add clear value proposition above the fold',
        'Reduce page load time (currently 4.2s)',
        'Add social proof and testimonials',
      ],
    },
  ],
  generatedAt: '2024-12-01T10:30:00Z',
  tokensUsed: 15000,
  processingTimeMs: 45000,
};
```

## Notes for Implementation

1. **Import paths**: The web app uses `@/` aliases. Ensure all imports use the correct alias pattern.

2. **Shared package imports**: If importing from `@advergent/shared` doesn't work, you may need to:
   - Add `"@advergent/shared": "workspace:*"` to `apps/web/package.json` dependencies
   - Or define types locally in the web app temporarily

3. **Icon imports**: Import icons from `lucide-react` as needed.

4. **Styling**: Follow existing Tailwind patterns in the codebase. Use slate colors for text, blue for accents.

5. **Error boundaries**: Consider adding error boundaries around the report components for production robustness.
