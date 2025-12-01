# Phase 2: PDF Generation Implementation Prompt

You are implementing Phase 2 of the Advergent AI Reporting system - PDF Generation with `@react-pdf/renderer`. This phase adds the ability to download professionally formatted PDF reports from the Reports Tab.

## Prerequisites Completed

- **Phase 0**: CSV upload infrastructure with `auction_insights`, `csv_uploads` tables ✅
- **Phase 4**: Multi-agent interplay report system with Scout, Researcher, SEM, SEO, and Director agents ✅
- **Phase 1**: Reports Tab UI with report display, trigger badges, and export button stubs ✅

The frontend Reports Tab is complete and displays reports correctly. The "Download PDF" button currently logs to console.

---

## Project Structure

This is a monorepo with:
- `apps/web` - React + Vite frontend (TypeScript)
- `apps/api` - Express backend (TypeScript, ES modules)
- `packages/shared` - Shared types and utilities

### Key Frontend Patterns

1. **Path Aliases**: Use `@/` for imports (e.g., `@/components/ui/button`)
2. **State Management**: TanStack Query v5 for server state
3. **UI Components**: shadcn/ui (Radix primitives + Tailwind)
4. **Shared Types**: Import from `@advergent/shared` for report types
5. **Styling**: Tailwind CSS with slate colors for text, blue for accents

---

## Current State

### ExportActions Component (Stub)

**File**: `apps/web/src/components/clients/reports/ExportActions.tsx`

```typescript
import { Button } from '@/components/ui/button';
import { Download, FileSpreadsheet } from 'lucide-react';
import type { InterplayReportResponse } from '@advergent/shared';

interface ExportActionsProps {
  report: InterplayReportResponse;
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

### Shared Types (from @advergent/shared)

**File**: `packages/shared/src/types/reports.types.ts`

```typescript
export type ReportStatus = 'pending' | 'researching' | 'analyzing' | 'completed' | 'failed';
export type ReportTrigger = 'client_creation' | 'manual' | 'scheduled';
export type RecommendationCategory = 'sem' | 'seo' | 'hybrid';
export type ImpactLevel = 'high' | 'medium' | 'low';
export type EffortLevel = 'high' | 'medium' | 'low';

export interface UnifiedRecommendation {
  title: string;
  description: string;
  type: RecommendationCategory;
  impact: ImpactLevel;
  effort: EffortLevel;
  actionItems: string[];
}

export interface ExecutiveSummary {
  summary: string;
  keyHighlights: string[];
}

export interface InterplayReportDateRange {
  start: string;  // ISO date string "2024-11-01"
  end: string;
  days: number;
}

export interface InterplayReportMetadata {
  tokensUsed?: number;
  processingTimeMs?: number;
  createdAt: string;  // ISO timestamp
  completedAt?: string;
}

export interface InterplayReportResponse {
  id: string;
  clientAccountId: string;
  status: ReportStatus;
  trigger: ReportTrigger;
  dateRange: InterplayReportDateRange;
  executiveSummary?: ExecutiveSummary;
  recommendations?: UnifiedRecommendation[];
  metadata: InterplayReportMetadata;
  error?: string;
}
```

---

## Target State

- Clicking "Download PDF" generates a PDF on the client side using `@react-pdf/renderer`
- PDF layout closely mirrors the HTML preview (executive summary + recommendations)
- Loading state shown during PDF generation ("Generating PDF..." with spinner)
- PDF downloads with filename format: `{ClientName}-SEO-SEM-Interplay-Report-{YYYY-MM-DD}.pdf`
- Professional styling with Advergent branding, correct color badges, page numbers

---

## Implementation Tasks

### Task 1: Install Dependencies

Install `@react-pdf/renderer` in the web app:

```bash
cd apps/web
npm install @react-pdf/renderer
```

### Task 2: Create PDF Style Definitions

**File**: `apps/web/src/components/clients/reports/pdf/styles.ts`

Create a centralized styles file for consistent PDF styling:

```typescript
import { StyleSheet } from '@react-pdf/renderer';

// Color palette matching Tailwind/shadcn
export const colors = {
  // Slate palette
  slate50: '#f8fafc',
  slate100: '#f1f5f9',
  slate200: '#e2e8f0',
  slate400: '#94a3b8',
  slate500: '#64748b',
  slate600: '#475569',
  slate700: '#334155',
  slate800: '#1e293b',
  slate900: '#0f172a',

  // Blue palette
  blue50: '#eff6ff',
  blue200: '#bfdbfe',
  blue600: '#2563eb',
  blue800: '#1e40af',
  blue900: '#1e3a8a',

  // Badge colors
  purple100: '#f3e8ff',
  purple800: '#6b21a8',
  green100: '#dcfce7',
  green800: '#166534',
  orange100: '#ffedd5',
  orange800: '#9a3412',
  red100: '#fee2e2',
  red800: '#991b1b',
  red600: '#dc2626',
  yellow100: '#fef9c3',
  yellow800: '#854d0e',
  yellow600: '#ca8a04',
  green600: '#16a34a',
};

export const pdfStyles = StyleSheet.create({
  // Page layout
  page: {
    padding: 40,
    paddingBottom: 60, // Space for footer
    fontSize: 10,
    fontFamily: 'Helvetica',
    color: colors.slate800,
  },

  // Header styles
  header: {
    marginBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: colors.slate200,
    paddingBottom: 15,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  logo: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.blue600,
    marginBottom: 3,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: colors.slate900,
    marginBottom: 3,
  },
  subtitle: {
    fontSize: 12,
    color: colors.slate500,
  },
  metaText: {
    fontSize: 9,
    color: colors.slate400,
  },

  // Section styles
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 10,
    color: colors.slate900,
  },

  // Executive summary card
  summaryCard: {
    backgroundColor: colors.blue50,
    borderWidth: 1,
    borderColor: colors.blue200,
    borderRadius: 8,
    padding: 15,
    marginBottom: 20,
  },
  summaryTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: colors.blue900,
    marginBottom: 10,
  },
  summaryText: {
    fontSize: 11,
    lineHeight: 1.6,
    color: colors.slate700,
    marginBottom: 12,
  },
  highlightsTitle: {
    fontSize: 10,
    fontWeight: 'bold',
    color: colors.slate600,
    marginBottom: 8,
  },
  highlightItem: {
    flexDirection: 'row',
    marginBottom: 6,
    paddingLeft: 5,
  },
  highlightNumber: {
    width: 20,
    fontSize: 9,
    fontWeight: 'bold',
    color: colors.blue600,
  },
  highlightText: {
    flex: 1,
    fontSize: 9,
    color: colors.slate600,
    lineHeight: 1.4,
  },

  // Recommendation card
  recCard: {
    backgroundColor: colors.slate50,
    borderWidth: 1,
    borderColor: colors.slate200,
    borderRadius: 8,
    padding: 12,
    marginBottom: 10,
  },
  recHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  recBadgeRow: {
    flexDirection: 'row',
    marginBottom: 5,
  },
  recBadge: {
    fontSize: 7,
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 3,
    marginRight: 5,
    fontWeight: 'bold',
  },
  recTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  recIndex: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: colors.slate100,
    textAlign: 'center',
    fontSize: 9,
    lineHeight: 18,
    marginRight: 8,
    color: colors.slate600,
  },
  recTitle: {
    fontSize: 11,
    fontWeight: 'bold',
    color: colors.slate900,
    flex: 1,
  },
  recEffort: {
    fontSize: 8,
  },
  recDescription: {
    fontSize: 9,
    color: colors.slate600,
    lineHeight: 1.5,
    marginBottom: 8,
  },
  actionItemsTitle: {
    fontSize: 9,
    fontWeight: 'bold',
    color: colors.slate600,
    marginBottom: 5,
  },
  actionItem: {
    flexDirection: 'row',
    marginBottom: 4,
    paddingLeft: 10,
  },
  actionBullet: {
    width: 10,
    fontSize: 8,
    color: colors.slate400,
  },
  actionText: {
    flex: 1,
    fontSize: 8,
    color: colors.slate500,
    lineHeight: 1.4,
  },

  // Impact summary row
  impactSummary: {
    flexDirection: 'row',
    marginBottom: 12,
  },
  impactDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 4,
    marginTop: 2,
  },
  impactText: {
    fontSize: 9,
    color: colors.slate500,
    marginRight: 12,
  },

  // Footer
  footer: {
    position: 'absolute',
    bottom: 30,
    left: 40,
    right: 40,
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: colors.slate200,
    paddingTop: 10,
  },
  footerText: {
    fontSize: 8,
    color: colors.slate400,
  },
  pageNumber: {
    fontSize: 8,
    color: colors.slate500,
  },
});

// Badge color helpers
export const getTypeBadgeStyle = (type: 'sem' | 'seo' | 'hybrid') => {
  switch (type) {
    case 'sem':
      return { backgroundColor: colors.purple100, color: colors.purple800 };
    case 'seo':
      return { backgroundColor: colors.green100, color: colors.green800 };
    case 'hybrid':
      return { backgroundColor: colors.orange100, color: colors.orange800 };
  }
};

export const getImpactBadgeStyle = (impact: 'high' | 'medium' | 'low') => {
  switch (impact) {
    case 'high':
      return { backgroundColor: colors.red100, color: colors.red800 };
    case 'medium':
      return { backgroundColor: colors.yellow100, color: colors.yellow800 };
    case 'low':
      return { backgroundColor: colors.slate100, color: colors.slate600 };
  }
};

export const getEffortColor = (effort: 'high' | 'medium' | 'low') => {
  switch (effort) {
    case 'high':
      return colors.red600;
    case 'medium':
      return colors.yellow600;
    case 'low':
      return colors.green600;
  }
};
```

### Task 3: Create PDF Header Component

**File**: `apps/web/src/components/clients/reports/pdf/PDFHeader.tsx`

```typescript
import { View, Text } from '@react-pdf/renderer';
import { pdfStyles } from './styles';

interface PDFHeaderProps {
  clientName: string;
  reportTitle: string;
  dateRange: {
    start: string;
    end: string;
  };
  generatedAt: string;
  trigger: 'client_creation' | 'manual' | 'scheduled';
}

const triggerLabels = {
  client_creation: 'Auto-Generated',
  manual: 'Manual Regeneration',
  scheduled: 'Scheduled Run',
};

export function PDFHeader({ clientName, reportTitle, dateRange, generatedAt, trigger }: PDFHeaderProps) {
  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  return (
    <View style={pdfStyles.header}>
      <View style={{ flex: 1 }}>
        <Text style={pdfStyles.logo}>Advergent</Text>
        <Text style={pdfStyles.title}>{reportTitle}</Text>
        <Text style={pdfStyles.subtitle}>{clientName}</Text>
        <Text style={{ ...pdfStyles.metaText, marginTop: 3 }}>
          {formatDate(dateRange.start)} - {formatDate(dateRange.end)}
        </Text>
      </View>
      <View style={{ textAlign: 'right' }}>
        <Text style={pdfStyles.metaText}>Generated: {formatDate(generatedAt)}</Text>
        <Text style={{ ...pdfStyles.metaText, marginTop: 2 }}>{triggerLabels[trigger]}</Text>
      </View>
    </View>
  );
}
```

### Task 4: Create PDF Footer Component

**File**: `apps/web/src/components/clients/reports/pdf/PDFFooter.tsx`

```typescript
import { View, Text } from '@react-pdf/renderer';
import { pdfStyles } from './styles';

interface PDFFooterProps {
  clientName: string;
}

export function PDFFooter({ clientName }: PDFFooterProps) {
  return (
    <View style={pdfStyles.footer} fixed>
      <Text style={pdfStyles.footerText}>
        {clientName} | Powered by Advergent
      </Text>
      <Text
        style={pdfStyles.pageNumber}
        render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`}
      />
    </View>
  );
}
```

### Task 5: Create PDF Executive Summary Component

**File**: `apps/web/src/components/clients/reports/pdf/PDFExecutiveSummary.tsx`

```typescript
import { View, Text } from '@react-pdf/renderer';
import { pdfStyles } from './styles';

interface PDFExecutiveSummaryProps {
  summary: string;
  keyHighlights: string[];
}

export function PDFExecutiveSummary({ summary, keyHighlights }: PDFExecutiveSummaryProps) {
  return (
    <View style={pdfStyles.summaryCard}>
      <Text style={pdfStyles.summaryTitle}>Executive Summary</Text>
      <Text style={pdfStyles.summaryText}>{summary}</Text>

      {keyHighlights.length > 0 && (
        <View>
          <Text style={pdfStyles.highlightsTitle}>Key Highlights</Text>
          {keyHighlights.map((highlight, index) => (
            <View key={index} style={pdfStyles.highlightItem}>
              <Text style={pdfStyles.highlightNumber}>{index + 1}.</Text>
              <Text style={pdfStyles.highlightText}>{highlight}</Text>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}
```

### Task 6: Create PDF Recommendation Card Component

**File**: `apps/web/src/components/clients/reports/pdf/PDFRecommendationCard.tsx`

```typescript
import { View, Text } from '@react-pdf/renderer';
import { pdfStyles, getTypeBadgeStyle, getImpactBadgeStyle, getEffortColor } from './styles';
import type { RecommendationCategory, ImpactLevel, EffortLevel } from '@advergent/shared';

interface PDFRecommendationCardProps {
  index: number;
  title: string;
  description: string;
  type: RecommendationCategory;
  impact: ImpactLevel;
  effort: EffortLevel;
  actionItems: string[];
}

export function PDFRecommendationCard({
  index,
  title,
  description,
  type,
  impact,
  effort,
  actionItems,
}: PDFRecommendationCardProps) {
  return (
    <View style={pdfStyles.recCard} wrap={false}>
      <View style={pdfStyles.recHeader}>
        <View style={{ flex: 1 }}>
          <View style={pdfStyles.recBadgeRow}>
            <Text style={[pdfStyles.recBadge, getTypeBadgeStyle(type)]}>
              {type.toUpperCase()}
            </Text>
            <Text style={[pdfStyles.recBadge, getImpactBadgeStyle(impact)]}>
              {impact.toUpperCase()} IMPACT
            </Text>
          </View>
          <View style={pdfStyles.recTitleRow}>
            <Text style={pdfStyles.recIndex}>{index + 1}</Text>
            <Text style={pdfStyles.recTitle}>{title}</Text>
          </View>
        </View>
        <Text style={[pdfStyles.recEffort, { color: getEffortColor(effort) }]}>
          {effort.charAt(0).toUpperCase() + effort.slice(1)} Effort
        </Text>
      </View>

      <Text style={pdfStyles.recDescription}>{description}</Text>

      {actionItems.length > 0 && (
        <View>
          <Text style={pdfStyles.actionItemsTitle}>Action Items:</Text>
          {actionItems.map((item, idx) => (
            <View key={idx} style={pdfStyles.actionItem}>
              <Text style={pdfStyles.actionBullet}>•</Text>
              <Text style={pdfStyles.actionText}>{item}</Text>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}
```

### Task 7: Create Main PDF Template

**File**: `apps/web/src/components/clients/reports/pdf/InterplayReportPDF.tsx`

```typescript
import { Document, Page, View, Text } from '@react-pdf/renderer';
import { PDFHeader } from './PDFHeader';
import { PDFFooter } from './PDFFooter';
import { PDFExecutiveSummary } from './PDFExecutiveSummary';
import { PDFRecommendationCard } from './PDFRecommendationCard';
import { pdfStyles, colors } from './styles';
import type { InterplayReportResponse } from '@advergent/shared';

interface InterplayReportPDFProps {
  clientName: string;
  report: InterplayReportResponse;
}

export function InterplayReportPDF({ clientName, report }: InterplayReportPDFProps) {
  const recommendations = report.recommendations || [];
  const highCount = recommendations.filter(r => r.impact === 'high').length;
  const mediumCount = recommendations.filter(r => r.impact === 'medium').length;
  const lowCount = recommendations.filter(r => r.impact === 'low').length;

  return (
    <Document title={`${clientName} - SEO/SEM Interplay Report`} author="Advergent">
      <Page size="A4" style={pdfStyles.page}>
        <PDFHeader
          clientName={clientName}
          reportTitle="SEO/SEM Interplay Report"
          dateRange={report.dateRange}
          generatedAt={report.metadata.createdAt}
          trigger={report.trigger}
        />

        {report.executiveSummary && (
          <PDFExecutiveSummary
            summary={report.executiveSummary.summary}
            keyHighlights={report.executiveSummary.keyHighlights}
          />
        )}

        {recommendations.length > 0 && (
          <View style={pdfStyles.section}>
            <Text style={pdfStyles.sectionTitle}>
              Unified Recommendations ({recommendations.length})
            </Text>
            <View style={pdfStyles.impactSummary}>
              <View style={[pdfStyles.impactDot, { backgroundColor: '#f87171' }]} />
              <Text style={pdfStyles.impactText}>High: {highCount}</Text>
              <View style={[pdfStyles.impactDot, { backgroundColor: '#facc15' }]} />
              <Text style={pdfStyles.impactText}>Medium: {mediumCount}</Text>
              <View style={[pdfStyles.impactDot, { backgroundColor: colors.slate400 }]} />
              <Text style={pdfStyles.impactText}>Low: {lowCount}</Text>
            </View>

            {recommendations.map((rec, index) => (
              <PDFRecommendationCard
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
          </View>
        )}

        {recommendations.length === 0 && (
          <View style={{ textAlign: 'center', marginTop: 40 }}>
            <Text style={{ color: colors.slate500 }}>
              No recommendations generated for this report.
            </Text>
          </View>
        )}

        <PDFFooter clientName={clientName} />
      </Page>
    </Document>
  );
}
```

### Task 8: Create PDF Generation Utility

**File**: `apps/web/src/lib/generatePDF.ts`

```typescript
import { pdf } from '@react-pdf/renderer';
import { InterplayReportPDF } from '@/components/clients/reports/pdf/InterplayReportPDF';
import type { InterplayReportResponse } from '@advergent/shared';

interface GeneratePDFOptions {
  clientName: string;
  report: InterplayReportResponse;
}

/**
 * Generates a PDF blob for the Interplay Report
 */
export async function generateInterplayReportPDF(options: GeneratePDFOptions): Promise<Blob> {
  const { clientName, report } = options;

  const blob = await pdf(
    <InterplayReportPDF clientName={clientName} report={report} />
  ).toBlob();

  return blob;
}

/**
 * Downloads a PDF file to the user's device
 */
export function downloadBlob(blob: Blob, filename: string): void {
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
 * Formats a filename for the PDF download
 * Output: ClientName-SEO-SEM-Interplay-Report-2024-12-01.pdf
 */
export function formatPDFFilename(clientName: string): string {
  const date = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
  const sanitizedClientName = clientName.replace(/[^a-zA-Z0-9]/g, '-').replace(/-+/g, '-');
  return `${sanitizedClientName}-SEO-SEM-Interplay-Report-${date}.pdf`;
}
```

### Task 9: Update ExportActions Component

**File**: `apps/web/src/components/clients/reports/ExportActions.tsx`

Replace the existing stub with the full implementation:

```typescript
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Download, FileSpreadsheet, Loader2 } from 'lucide-react';
import { generateInterplayReportPDF, downloadBlob, formatPDFFilename } from '@/lib/generatePDF';
import type { InterplayReportResponse } from '@advergent/shared';

interface ExportActionsProps {
  report: InterplayReportResponse;
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

      const filename = formatPDFFilename(clientName);
      downloadBlob(blob, filename);
    } catch (error) {
      console.error('Failed to generate PDF:', error);
      // TODO: Show toast notification for error
    } finally {
      setIsGeneratingPDF(false);
    }
  };

  // CSV export will be implemented in Phase 3
  const handleExportCSV = () => {
    console.log('CSV export - to be implemented in Phase 3', { report, clientName });
  };

  return (
    <div className="flex gap-3">
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
      <Button variant="outline" onClick={handleExportCSV} className="gap-2">
        <FileSpreadsheet className="h-4 w-4" />
        Export CSV
      </Button>
    </div>
  );
}
```

### Task 10: Create PDF Components Index

**File**: `apps/web/src/components/clients/reports/pdf/index.ts`

```typescript
export { InterplayReportPDF } from './InterplayReportPDF';
export { PDFHeader } from './PDFHeader';
export { PDFFooter } from './PDFFooter';
export { PDFExecutiveSummary } from './PDFExecutiveSummary';
export { PDFRecommendationCard } from './PDFRecommendationCard';
export { pdfStyles, colors, getTypeBadgeStyle, getImpactBadgeStyle, getEffortColor } from './styles';
```

---

## File Structure Summary

After completing this phase, you should have:

```
apps/web/src/
├── lib/
│   └── generatePDF.ts                        # NEW
└── components/clients/reports/
    ├── ExportActions.tsx                     # MODIFIED
    └── pdf/
        ├── index.ts                          # NEW
        ├── styles.ts                         # NEW
        ├── PDFHeader.tsx                     # NEW
        ├── PDFFooter.tsx                     # NEW
        ├── PDFExecutiveSummary.tsx           # NEW
        ├── PDFRecommendationCard.tsx         # NEW
        └── InterplayReportPDF.tsx            # NEW
```

---

## Testing Checklist

After implementation, verify:

- [ ] `npm install @react-pdf/renderer` completes without errors in apps/web
- [ ] `npm run type-check` passes with no TypeScript errors
- [ ] Click "Download PDF" shows loading state ("Generating PDF..." with spinner)
- [ ] PDF downloads with correct filename format: `{ClientName}-SEO-SEM-Interplay-Report-{YYYY-MM-DD}.pdf`
- [ ] PDF opens correctly in PDF viewers (Preview, Adobe Reader, Chrome)
- [ ] PDF header shows:
  - Advergent logo/branding
  - "SEO/SEM Interplay Report" title
  - Client name
  - Date range
  - "Generated" date
  - Trigger badge text (Auto-Generated, Manual Regeneration, or Scheduled Run)
- [ ] Executive summary section renders with:
  - Blue background card
  - Summary text
  - Numbered key highlights
- [ ] Recommendation cards show:
  - Type badges with correct colors (SEM=purple, SEO=green, Hybrid=orange)
  - Impact badges with correct colors (High=red, Medium=yellow, Low=slate)
  - Effort level text with correct colors
  - Numbered index
  - Title and description
  - Action items as bulleted list
- [ ] Impact summary shows counts for High/Medium/Low
- [ ] Page numbers appear in footer ("Page X of Y")
- [ ] Footer shows client name and "Powered by Advergent"
- [ ] Multi-page reports paginate correctly (recommendations don't split mid-card)
- [ ] PDF generation completes within 5 seconds
- [ ] Error handling works (button re-enables after error)
- [ ] Button is disabled during PDF generation (prevents double-clicks)

---

## Troubleshooting

### Common Issues

1. **"Cannot find module '@react-pdf/renderer'"**
   - Run `npm install @react-pdf/renderer` in apps/web directory
   - Restart the dev server

2. **Fonts not rendering correctly**
   - @react-pdf/renderer uses Helvetica by default, which works cross-platform
   - Custom fonts need explicit registration with `Font.register()`

3. **PDF not downloading**
   - Check browser console for errors
   - Ensure blob URL is being created correctly
   - Some browsers block downloads - check popup blocker

4. **Styles not applying**
   - @react-pdf/renderer uses its own StyleSheet, not CSS
   - Flexbox works but not all CSS properties are supported
   - Only use properties listed in react-pdf documentation

5. **Cards splitting across pages**
   - Use `wrap={false}` on View components that shouldn't break
   - This is already applied to PDFRecommendationCard

6. **TypeScript errors with JSX in generatePDF.ts**
   - The file uses JSX syntax, ensure it has proper TypeScript/JSX handling
   - May need to rename to `.tsx` if errors occur

---

## Notes

1. **@react-pdf/renderer Style System**: Uses its own StyleSheet similar to React Native. Not all CSS properties are supported - stick to documented ones.

2. **Color Consistency**: The `styles.ts` file defines colors matching the Tailwind palette used in the HTML components for visual consistency.

3. **Page Breaks**: The `wrap={false}` prop prevents components from splitting across pages. Applied to recommendation cards to keep them together.

4. **Performance**: PDF generation happens client-side and is typically fast (< 3 seconds). The loading state handles the brief delay.

5. **Shared Types**: The PDF components import types from `@advergent/shared` to ensure type consistency with the rest of the app.

6. **Trigger Display**: The PDF header shows the trigger type (Auto-Generated, Manual, Scheduled) matching the web UI badge.

---

## Commands

Install dependencies:
```bash
cd apps/web && npm install @react-pdf/renderer
```

Run the dev server to test:
```bash
npm run dev
```

Type check:
```bash
npm run type-check
```
