# Phase 3: CSV Export + Additional Features

## Objective

Add CSV export capability for the SEO/SEM Interplay Report data, allowing users to download tabular data for further analysis in spreadsheets. Also add print-friendly styles for browser printing.

## Prerequisites

- Phase 1 (Reports Tab UI) must be completed
- The `ExportActions` component exists with a placeholder `handleExportCSV` function

## Context

### Current State
- `ExportActions.tsx` has an "Export CSV" button with a placeholder handler
- Report data contains `unifiedRecommendations` array that can be exported

### Target State
- Clicking "Export CSV" downloads a CSV file with recommendations data
- CSV filename follows pattern: `{ClientName}-Recommendations-{Date}.csv`
- Export dropdown allows section-specific exports (future enhancement)
- Print-friendly styles hide UI controls when printing

## Tasks

### Task 1: Install Dependencies

```bash
cd apps/web
npm install papaparse
npm install -D @types/papaparse
```

Add to `apps/web/package.json`:
```json
{
  "dependencies": {
    "papaparse": "^5.4.1"
  },
  "devDependencies": {
    "@types/papaparse": "^5.3.14"
  }
}
```

### Task 2: Create CSV Export Utility

**File**: `apps/web/src/lib/exportCSV.ts`

```typescript
import Papa from 'papaparse';

/**
 * Downloads data as a CSV file
 */
export function downloadCSV(data: object[], filename: string): void {
  const csv = Papa.unparse(data);
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Formats a filename for CSV download
 */
export function formatCSVFilename(clientName: string, dataType: string): string {
  const date = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
  const sanitizedClientName = clientName.replace(/[^a-zA-Z0-9]/g, '-');
  const sanitizedDataType = dataType.replace(/[^a-zA-Z0-9]/g, '-');
  return `${sanitizedClientName}-${sanitizedDataType}-${date}.csv`;
}

/**
 * Transforms recommendations data for CSV export
 */
export interface RecommendationForExport {
  title: string;
  description: string;
  type: 'sem' | 'seo' | 'hybrid';
  impact: 'high' | 'medium' | 'low';
  effort: 'high' | 'medium' | 'low';
  actionItems: string[];
}

export function transformRecommendationsForCSV(
  recommendations: RecommendationForExport[]
): object[] {
  return recommendations.map((rec, index) => ({
    'Priority': index + 1,
    'Title': rec.title,
    'Description': rec.description,
    'Type': rec.type.toUpperCase(),
    'Impact': rec.impact.charAt(0).toUpperCase() + rec.impact.slice(1),
    'Effort': rec.effort.charAt(0).toUpperCase() + rec.effort.slice(1),
    'Action Items': rec.actionItems.join('; '),
    'Action Items Count': rec.actionItems.length,
  }));
}

/**
 * Transforms executive summary data for CSV export
 */
export interface ExecutiveSummaryForExport {
  summary: string;
  keyHighlights: string[];
}

export function transformExecutiveSummaryForCSV(
  summary: ExecutiveSummaryForExport,
  reportMetadata: {
    clientName: string;
    dateRange: { startDate: string; endDate: string };
    generatedAt: string;
  }
): object[] {
  return [
    {
      'Section': 'Report Info',
      'Content': `Client: ${reportMetadata.clientName}`,
    },
    {
      'Section': 'Report Info',
      'Content': `Date Range: ${reportMetadata.dateRange.startDate} to ${reportMetadata.dateRange.endDate}`,
    },
    {
      'Section': 'Report Info',
      'Content': `Generated: ${reportMetadata.generatedAt}`,
    },
    {
      'Section': 'Executive Summary',
      'Content': summary.summary,
    },
    ...summary.keyHighlights.map((highlight, index) => ({
      'Section': `Key Highlight ${index + 1}`,
      'Content': highlight,
    })),
  ];
}

/**
 * Exports the full report as a comprehensive CSV
 */
export function exportFullReportCSV(
  clientName: string,
  report: {
    dateRange: { startDate: string; endDate: string };
    generatedAt: string;
    executiveSummary: ExecutiveSummaryForExport;
    unifiedRecommendations: RecommendationForExport[];
  }
): void {
  const recommendationsData = transformRecommendationsForCSV(report.unifiedRecommendations);
  const filename = formatCSVFilename(clientName, 'Recommendations');
  downloadCSV(recommendationsData, filename);
}

/**
 * Exports only recommendations as CSV
 */
export function exportRecommendationsCSV(
  clientName: string,
  recommendations: RecommendationForExport[]
): void {
  const data = transformRecommendationsForCSV(recommendations);
  const filename = formatCSVFilename(clientName, 'Recommendations');
  downloadCSV(data, filename);
}

/**
 * Exports recommendations with expanded action items (one row per action item)
 */
export function exportRecommendationsExpandedCSV(
  clientName: string,
  recommendations: RecommendationForExport[]
): void {
  const expandedData: object[] = [];

  recommendations.forEach((rec, index) => {
    if (rec.actionItems.length === 0) {
      // No action items - single row
      expandedData.push({
        'Priority': index + 1,
        'Title': rec.title,
        'Description': rec.description,
        'Type': rec.type.toUpperCase(),
        'Impact': rec.impact.charAt(0).toUpperCase() + rec.impact.slice(1),
        'Effort': rec.effort.charAt(0).toUpperCase() + rec.effort.slice(1),
        'Action Item': '',
        'Action Item #': '',
      });
    } else {
      // One row per action item
      rec.actionItems.forEach((action, actionIndex) => {
        expandedData.push({
          'Priority': index + 1,
          'Title': rec.title,
          'Description': actionIndex === 0 ? rec.description : '', // Only show description on first row
          'Type': rec.type.toUpperCase(),
          'Impact': rec.impact.charAt(0).toUpperCase() + rec.impact.slice(1),
          'Effort': rec.effort.charAt(0).toUpperCase() + rec.effort.slice(1),
          'Action Item': action,
          'Action Item #': actionIndex + 1,
        });
      });
    }
  });

  const filename = formatCSVFilename(clientName, 'Recommendations-Expanded');
  downloadCSV(expandedData, filename);
}
```

### Task 3: Update ExportActions with CSV Functionality

**File**: `apps/web/src/components/clients/reports/ExportActions.tsx`

Replace with enhanced version including dropdown menu:

```typescript
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from '@/components/ui/dropdown-menu';
import { Download, FileSpreadsheet, Loader2, ChevronDown, Printer } from 'lucide-react';
import { generateInterplayReportPDF, downloadBlob, formatPDFFilename } from '@/lib/generatePDF';
import {
  exportRecommendationsCSV,
  exportRecommendationsExpandedCSV,
} from '@/lib/exportCSV';

interface ExportActionsProps {
  report: {
    dateRange: {
      startDate: string;
      endDate: string;
    };
    generatedAt: string;
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
  clientName: string;
}

export function ExportActions({ report, clientName }: ExportActionsProps) {
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);

  const handleDownloadPDF = async () => {
    setIsGeneratingPDF(true);
    try {
      const blob = await generateInterplayReportPDF({
        clientName,
        report,
      });

      const filename = formatPDFFilename(clientName, 'SEO-SEM-Interplay-Report');
      downloadBlob(blob, filename);
    } catch (error) {
      console.error('Failed to generate PDF:', error);
      // TODO: Show toast notification for error
    } finally {
      setIsGeneratingPDF(false);
    }
  };

  const handleExportRecommendationsCSV = () => {
    exportRecommendationsCSV(clientName, report.unifiedRecommendations);
  };

  const handleExportExpandedCSV = () => {
    exportRecommendationsExpandedCSV(clientName, report.unifiedRecommendations);
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="flex gap-3">
      {/* PDF Download Button */}
      <Button
        onClick={handleDownloadPDF}
        disabled={isGeneratingPDF}
        className="gap-2"
      >
        {isGeneratingPDF ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            Generating PDF...
          </>
        ) : (
          <>
            <Download className="h-4 w-4" />
            Download PDF
          </>
        )}
      </Button>

      {/* CSV Export Dropdown */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" className="gap-2">
            <FileSpreadsheet className="h-4 w-4" />
            Export CSV
            <ChevronDown className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuLabel>Export Options</DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={handleExportRecommendationsCSV}>
            <FileSpreadsheet className="h-4 w-4 mr-2" />
            Recommendations (Summary)
          </DropdownMenuItem>
          <DropdownMenuItem onClick={handleExportExpandedCSV}>
            <FileSpreadsheet className="h-4 w-4 mr-2" />
            Recommendations (Expanded)
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Print Button */}
      <Button variant="ghost" onClick={handlePrint} className="gap-2">
        <Printer className="h-4 w-4" />
        Print
      </Button>
    </div>
  );
}
```

### Task 4: Add Print-Friendly Styles

**File**: `apps/web/src/index.css` (or main CSS file)

Add the following print styles at the end of the file:

```css
/* Print-friendly styles for Reports */
@media print {
  /* Hide navigation and UI controls */
  header,
  nav,
  .no-print,
  button,
  [role="navigation"] {
    display: none !important;
  }

  /* Reset page margins */
  @page {
    margin: 0.75in;
    size: A4;
  }

  /* Ensure report content is visible */
  .print-content {
    display: block !important;
  }

  /* Remove shadows and borders that don't print well */
  .shadow,
  .shadow-lg,
  .shadow-md,
  .shadow-sm {
    box-shadow: none !important;
  }

  /* Ensure text is black for readability */
  body {
    color: #000 !important;
    background: #fff !important;
  }

  /* Prevent page breaks inside cards */
  .card,
  [data-no-break] {
    break-inside: avoid;
    page-break-inside: avoid;
  }

  /* Ensure links show their URLs */
  a[href]:after {
    content: " (" attr(href) ")";
    font-size: 0.8em;
    color: #666;
  }

  /* Hide expanded action items toggle - show all by default */
  .action-items-toggle {
    display: none !important;
  }

  .action-items-content {
    display: block !important;
    max-height: none !important;
  }
}

/* Utility class to hide elements when printing */
.no-print {
  /* Normal display */
}

@media print {
  .no-print {
    display: none !important;
  }
}

/* Utility class to only show when printing */
.print-only {
  display: none !important;
}

@media print {
  .print-only {
    display: block !important;
  }
}
```

### Task 5: Update ReportsTab for Print Support

**File**: `apps/web/src/components/clients/ReportsTab.tsx`

Update to add print-friendly class names:

```typescript
// In the completed report render section, wrap export actions in no-print
<div className="no-print">
  <ExportActions
    report={report}
    clientName={client.name}
  />
</div>

// Add print header that only shows when printing
<div className="print-only mb-6">
  <h1 className="text-2xl font-bold">{client.name}</h1>
  <p className="text-sm text-slate-500">SEO/SEM Interplay Report</p>
  <p className="text-xs text-slate-400">
    Generated: {new Date(report.generatedAt).toLocaleDateString()}
  </p>
</div>
```

### Task 6: Update ReportRecommendationCard for Print

**File**: `apps/web/src/components/clients/reports/components/ReportRecommendationCard.tsx`

Update to always show action items when printing:

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
    <Card className="hover:shadow-md transition-shadow" data-no-break>
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
            {/* Toggle button - hidden when printing */}
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className="action-items-toggle flex items-center gap-1 text-sm text-blue-600 hover:text-blue-800 font-medium no-print"
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

            {/* Action items - always visible when printing */}
            <div className={`action-items-content ${isExpanded ? '' : 'hidden'} print:block`}>
              <p className="text-sm font-medium text-slate-700 mt-3 mb-2 print-only">
                Action Items:
              </p>
              <ul className="mt-3 space-y-2 pl-4 border-l-2 border-slate-200">
                {actionItems.map((item, idx) => (
                  <li key={idx} className="text-sm text-slate-600">
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
```

## File Structure Summary

After completing this phase, you should have:

```
apps/web/src/
├── lib/
│   ├── generatePDF.ts                # From Phase 2
│   └── exportCSV.ts                  # NEW
├── index.css                         # MODIFIED (print styles)
└── components/clients/
    ├── ReportsTab.tsx                # MODIFIED (print classes)
    └── reports/
        ├── ExportActions.tsx         # MODIFIED (CSV export)
        └── components/
            └── ReportRecommendationCard.tsx  # MODIFIED (print support)
```

## Testing Checklist

### CSV Export
- [ ] `npm install papaparse @types/papaparse` completes without errors
- [ ] "Export CSV" button shows dropdown menu
- [ ] "Recommendations (Summary)" exports single CSV with one row per recommendation
- [ ] "Recommendations (Expanded)" exports CSV with one row per action item
- [ ] CSV filename follows pattern: `{ClientName}-Recommendations-{Date}.csv`
- [ ] CSV opens correctly in Excel/Google Sheets
- [ ] CSV columns are properly formatted (Priority, Title, Description, Type, Impact, Effort, Action Items)
- [ ] Special characters in text are properly escaped

### Print Support
- [ ] "Print" button opens browser print dialog
- [ ] Export buttons are hidden when printing
- [ ] Report header is visible when printing
- [ ] Action items are always expanded when printing
- [ ] Cards don't break across pages
- [ ] Colors are readable in print preview
- [ ] Page margins are appropriate

## CSV Output Format

### Summary Export (Recommendations)

| Priority | Title | Description | Type | Impact | Effort | Action Items | Action Items Count |
|----------|-------|-------------|------|--------|--------|--------------|-------------------|
| 1 | Pause ads on brand keywords | You are ranking #1... | SEM | High | Low | Pause campaigns...; Monitor organic...; Reallocate budget... | 3 |
| 2 | Optimize landing page | High paid conversions... | SEO | High | Medium | Add clear value...; Reduce page load...; Add social proof... | 3 |

### Expanded Export (One row per action item)

| Priority | Title | Description | Type | Impact | Effort | Action Item | Action Item # |
|----------|-------|-------------|------|--------|--------|-------------|--------------|
| 1 | Pause ads on brand keywords | You are ranking #1... | SEM | High | Low | Pause campaigns targeting exact match brand terms | 1 |
| 1 | Pause ads on brand keywords | | SEM | High | Low | Monitor organic traffic for 2 weeks | 2 |
| 1 | Pause ads on brand keywords | | SEM | High | Low | Reallocate budget to non-brand campaigns | 3 |
| 2 | Optimize landing page | High paid conversions... | SEO | High | Medium | Add clear value proposition above the fold | 1 |

## Notes for Implementation

1. **PapaParse Configuration**: The default `Papa.unparse()` handles most cases well. For special requirements:
   ```typescript
   Papa.unparse(data, {
     quotes: true, // Force quotes around all fields
     delimiter: ',', // Use comma (default)
     header: true, // Include header row (default)
   });
   ```

2. **Character Encoding**: The CSV is generated with UTF-8 encoding, which should handle most special characters. If issues arise with Excel, consider adding BOM:
   ```typescript
   const bom = '\uFEFF';
   const csv = bom + Papa.unparse(data);
   ```

3. **Print Media Query**: The `@media print` styles will only apply when printing. Test thoroughly in different browsers as print handling varies.

4. **Tailwind Print Modifier**: Tailwind provides `print:` modifier for print-specific styles. Use `print:hidden` or `print:block` for quick adjustments.

5. **DropdownMenu**: Ensure the shadcn/ui dropdown menu component is installed. If not:
   ```bash
   npx shadcn-ui@latest add dropdown-menu
   ```
