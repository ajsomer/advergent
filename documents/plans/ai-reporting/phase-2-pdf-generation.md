# Phase 2: PDF Generation with @react-pdf/renderer

## Objective

Implement PDF generation for the SEO/SEM Interplay Report using `@react-pdf/renderer`. Users should be able to click "Download PDF" and receive a professionally formatted PDF document that mirrors the HTML preview.

## Prerequisites

- Phase 1 (Reports Tab UI) must be completed
- Report data structure and types are defined
- The `ExportActions` component exists with a placeholder `handleDownloadPDF` function

## Context

### Current State
- `ExportActions.tsx` has a "Download PDF" button with a placeholder handler
- Report data is available via `useInterplayReport` hook
- HTML preview components exist in `reports/components/` and `reports/templates/`

### Target State
- Clicking "Download PDF" generates a PDF on the client side
- PDF layout closely mirrors the HTML preview
- Loading state shown during PDF generation
- PDF downloads with filename: `{ClientName}-SEO-SEM-Report-{Date}.pdf`

## Tasks

### Task 1: Install Dependencies

```bash
cd apps/web
npm install @react-pdf/renderer
```

Add to `apps/web/package.json`:
```json
{
  "dependencies": {
    "@react-pdf/renderer": "^3.4.0"
  }
}
```

### Task 2: Create PDF Base Components

**File**: `apps/web/src/components/clients/reports/pdf/PDFDocument.tsx`

```typescript
import { Document, Page, StyleSheet, Font } from '@react-pdf/renderer';
import { ReactNode } from 'react';

// Register fonts (optional - for custom fonts)
// Font.register({
//   family: 'Inter',
//   src: 'https://fonts.gstatic.com/s/inter/v12/UcCO3FwrK3iLTeHuS_fvQtMwCp50KnMw2boKoduKmMEVuLyfAZ9hiJ-Ek-_EeA.woff2',
// });

// Global styles for PDF
export const pdfStyles = StyleSheet.create({
  page: {
    padding: 40,
    fontSize: 10,
    fontFamily: 'Helvetica',
    color: '#1e293b', // slate-800
  },
  header: {
    marginBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0', // slate-200
    paddingBottom: 15,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 5,
    color: '#0f172a', // slate-900
  },
  subtitle: {
    fontSize: 12,
    color: '#64748b', // slate-500
  },
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 10,
    color: '#0f172a',
  },
  text: {
    fontSize: 10,
    lineHeight: 1.5,
    color: '#475569', // slate-600
  },
  badge: {
    fontSize: 8,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginRight: 6,
  },
  badgeSem: {
    backgroundColor: '#f3e8ff', // purple-100
    color: '#6b21a8', // purple-800
  },
  badgeSeo: {
    backgroundColor: '#dcfce7', // green-100
    color: '#166534', // green-800
  },
  badgeHybrid: {
    backgroundColor: '#ffedd5', // orange-100
    color: '#9a3412', // orange-800
  },
  badgeHighImpact: {
    backgroundColor: '#fee2e2', // red-100
    color: '#991b1b', // red-800
  },
  badgeMediumImpact: {
    backgroundColor: '#fef9c3', // yellow-100
    color: '#854d0e', // yellow-800
  },
  badgeLowImpact: {
    backgroundColor: '#f1f5f9', // slate-100
    color: '#475569', // slate-600
  },
  card: {
    backgroundColor: '#f8fafc', // slate-50
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 8,
    padding: 15,
    marginBottom: 10,
  },
  highlightCard: {
    backgroundColor: '#eff6ff', // blue-50
    borderWidth: 1,
    borderColor: '#bfdbfe', // blue-200
    borderRadius: 8,
    padding: 15,
    marginBottom: 15,
  },
  listItem: {
    flexDirection: 'row',
    marginBottom: 6,
  },
  bullet: {
    width: 15,
    fontSize: 10,
    color: '#64748b',
  },
  footer: {
    position: 'absolute',
    bottom: 30,
    left: 40,
    right: 40,
    textAlign: 'center',
    fontSize: 8,
    color: '#94a3b8', // slate-400
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
    paddingTop: 10,
  },
});

interface PDFDocumentWrapperProps {
  children: ReactNode;
  title: string;
}

export function PDFDocumentWrapper({ children, title }: PDFDocumentWrapperProps) {
  return (
    <Document title={title} author="Advergent">
      {children}
    </Document>
  );
}
```

**File**: `apps/web/src/components/clients/reports/pdf/PDFHeader.tsx`

```typescript
import { View, Text, StyleSheet } from '@react-pdf/renderer';
import { pdfStyles } from './PDFDocument';

const styles = StyleSheet.create({
  container: {
    ...pdfStyles.header,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  logoSection: {
    flex: 1,
  },
  metaSection: {
    textAlign: 'right',
  },
  logo: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#2563eb', // blue-600
    marginBottom: 3,
  },
  reportTitle: {
    ...pdfStyles.title,
    marginBottom: 3,
  },
  clientName: {
    fontSize: 14,
    color: '#475569',
    marginBottom: 3,
  },
  dateRange: {
    fontSize: 10,
    color: '#64748b',
  },
  generatedDate: {
    fontSize: 9,
    color: '#94a3b8',
    marginTop: 5,
  },
});

interface PDFHeaderProps {
  clientName: string;
  reportTitle: string;
  dateRange: {
    startDate: string;
    endDate: string;
  };
  generatedAt: string;
}

export function PDFHeader({ clientName, reportTitle, dateRange, generatedAt }: PDFHeaderProps) {
  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  return (
    <View style={styles.container}>
      <View style={styles.logoSection}>
        <Text style={styles.logo}>Advergent</Text>
        <Text style={styles.reportTitle}>{reportTitle}</Text>
        <Text style={styles.clientName}>{clientName}</Text>
        <Text style={styles.dateRange}>
          {formatDate(dateRange.startDate)} - {formatDate(dateRange.endDate)}
        </Text>
      </View>
      <View style={styles.metaSection}>
        <Text style={styles.generatedDate}>Generated: {formatDate(generatedAt)}</Text>
      </View>
    </View>
  );
}
```

**File**: `apps/web/src/components/clients/reports/pdf/PDFFooter.tsx`

```typescript
import { View, Text, StyleSheet } from '@react-pdf/renderer';

const styles = StyleSheet.create({
  footer: {
    position: 'absolute',
    bottom: 30,
    left: 40,
    right: 40,
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
    paddingTop: 10,
  },
  text: {
    fontSize: 8,
    color: '#94a3b8',
  },
  pageNumber: {
    fontSize: 8,
    color: '#64748b',
  },
});

interface PDFFooterProps {
  clientName: string;
}

export function PDFFooter({ clientName }: PDFFooterProps) {
  return (
    <View style={styles.footer} fixed>
      <Text style={styles.text}>
        {clientName} | Powered by Advergent
      </Text>
      <Text
        style={styles.pageNumber}
        render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`}
      />
    </View>
  );
}
```

### Task 3: Create PDF Content Components

**File**: `apps/web/src/components/clients/reports/pdf/PDFExecutiveSummary.tsx`

```typescript
import { View, Text, StyleSheet } from '@react-pdf/renderer';
import { pdfStyles } from './PDFDocument';

const styles = StyleSheet.create({
  container: {
    ...pdfStyles.highlightCard,
    marginBottom: 20,
  },
  title: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#1e40af', // blue-800
    marginBottom: 10,
  },
  summary: {
    fontSize: 11,
    lineHeight: 1.6,
    color: '#334155', // slate-700
    marginBottom: 15,
  },
  highlightsTitle: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#475569',
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
    color: '#2563eb',
  },
  highlightText: {
    flex: 1,
    fontSize: 9,
    color: '#475569',
    lineHeight: 1.4,
  },
});

interface PDFExecutiveSummaryProps {
  summary: string;
  keyHighlights: string[];
}

export function PDFExecutiveSummary({ summary, keyHighlights }: PDFExecutiveSummaryProps) {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Executive Summary</Text>
      <Text style={styles.summary}>{summary}</Text>

      {keyHighlights.length > 0 && (
        <View>
          <Text style={styles.highlightsTitle}>Key Highlights</Text>
          {keyHighlights.map((highlight, index) => (
            <View key={index} style={styles.highlightItem}>
              <Text style={styles.highlightNumber}>{index + 1}.</Text>
              <Text style={styles.highlightText}>{highlight}</Text>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}
```

**File**: `apps/web/src/components/clients/reports/pdf/PDFRecommendationCard.tsx`

```typescript
import { View, Text, StyleSheet } from '@react-pdf/renderer';
import { pdfStyles } from './PDFDocument';

const styles = StyleSheet.create({
  card: {
    ...pdfStyles.card,
    marginBottom: 12,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 5,
  },
  index: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#f1f5f9',
    textAlign: 'center',
    fontSize: 9,
    lineHeight: 18,
    marginRight: 8,
    color: '#475569',
  },
  badgeRow: {
    flexDirection: 'row',
    marginBottom: 5,
  },
  badge: {
    fontSize: 7,
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 3,
    marginRight: 5,
    fontWeight: 'bold',
  },
  title: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#0f172a',
    marginBottom: 5,
    flex: 1,
  },
  description: {
    fontSize: 9,
    color: '#475569',
    lineHeight: 1.5,
    marginBottom: 10,
  },
  effortText: {
    fontSize: 8,
    color: '#64748b',
  },
  actionItemsTitle: {
    fontSize: 9,
    fontWeight: 'bold',
    color: '#475569',
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
    color: '#94a3b8',
  },
  actionText: {
    flex: 1,
    fontSize: 8,
    color: '#64748b',
    lineHeight: 1.4,
  },
});

interface PDFRecommendationCardProps {
  index: number;
  title: string;
  description: string;
  type: 'sem' | 'seo' | 'hybrid';
  impact: 'high' | 'medium' | 'low';
  effort: 'high' | 'medium' | 'low';
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
  const getTypeBadgeStyle = () => {
    switch (type) {
      case 'sem':
        return { backgroundColor: '#f3e8ff', color: '#6b21a8' };
      case 'seo':
        return { backgroundColor: '#dcfce7', color: '#166534' };
      case 'hybrid':
        return { backgroundColor: '#ffedd5', color: '#9a3412' };
    }
  };

  const getImpactBadgeStyle = () => {
    switch (impact) {
      case 'high':
        return { backgroundColor: '#fee2e2', color: '#991b1b' };
      case 'medium':
        return { backgroundColor: '#fef9c3', color: '#854d0e' };
      case 'low':
        return { backgroundColor: '#f1f5f9', color: '#475569' };
    }
  };

  const getEffortColor = () => {
    switch (effort) {
      case 'high':
        return '#dc2626';
      case 'medium':
        return '#ca8a04';
      case 'low':
        return '#16a34a';
    }
  };

  return (
    <View style={styles.card} wrap={false}>
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <View style={styles.badgeRow}>
            <Text style={[styles.badge, getTypeBadgeStyle()]}>{type.toUpperCase()}</Text>
            <Text style={[styles.badge, getImpactBadgeStyle()]}>
              {impact.toUpperCase()} IMPACT
            </Text>
          </View>
          <View style={styles.titleRow}>
            <Text style={styles.index}>{index + 1}</Text>
            <Text style={styles.title}>{title}</Text>
          </View>
        </View>
        <Text style={[styles.effortText, { color: getEffortColor() }]}>
          {effort.charAt(0).toUpperCase() + effort.slice(1)} Effort
        </Text>
      </View>

      <Text style={styles.description}>{description}</Text>

      {actionItems.length > 0 && (
        <View>
          <Text style={styles.actionItemsTitle}>Action Items:</Text>
          {actionItems.map((item, idx) => (
            <View key={idx} style={styles.actionItem}>
              <Text style={styles.actionBullet}>•</Text>
              <Text style={styles.actionText}>{item}</Text>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}
```

### Task 4: Create Main PDF Template

**File**: `apps/web/src/components/clients/reports/pdf/templates/InterplayReportPDF.tsx`

```typescript
import { Document, Page, View, Text, StyleSheet } from '@react-pdf/renderer';
import { PDFHeader } from '../PDFHeader';
import { PDFFooter } from '../PDFFooter';
import { PDFExecutiveSummary } from '../PDFExecutiveSummary';
import { PDFRecommendationCard } from '../PDFRecommendationCard';
import { pdfStyles } from '../PDFDocument';

const styles = StyleSheet.create({
  page: {
    ...pdfStyles.page,
    paddingBottom: 60, // Space for footer
  },
  recommendationsSection: {
    marginTop: 10,
  },
  recommendationsTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#0f172a',
    marginBottom: 5,
  },
  recommendationsSubtitle: {
    fontSize: 9,
    color: '#64748b',
    marginBottom: 15,
    flexDirection: 'row',
  },
  statDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 4,
    marginTop: 2,
  },
  statText: {
    fontSize: 9,
    color: '#64748b',
    marginRight: 12,
  },
});

interface InterplayReportPDFProps {
  clientName: string;
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
}

export function InterplayReportPDF({ clientName, report }: InterplayReportPDFProps) {
  const recommendations = report.unifiedRecommendations;
  const highCount = recommendations.filter(r => r.impact === 'high').length;
  const mediumCount = recommendations.filter(r => r.impact === 'medium').length;
  const lowCount = recommendations.filter(r => r.impact === 'low').length;

  return (
    <Document title={`${clientName} - SEO/SEM Interplay Report`} author="Advergent">
      <Page size="A4" style={styles.page}>
        <PDFHeader
          clientName={clientName}
          reportTitle="SEO/SEM Interplay Report"
          dateRange={report.dateRange}
          generatedAt={report.generatedAt}
        />

        <PDFExecutiveSummary
          summary={report.executiveSummary.summary}
          keyHighlights={report.executiveSummary.keyHighlights}
        />

        <View style={styles.recommendationsSection}>
          <Text style={styles.recommendationsTitle}>
            Unified Recommendations ({recommendations.length})
          </Text>
          <View style={styles.recommendationsSubtitle}>
            <View style={[styles.statDot, { backgroundColor: '#f87171' }]} />
            <Text style={styles.statText}>High: {highCount}</Text>
            <View style={[styles.statDot, { backgroundColor: '#facc15' }]} />
            <Text style={styles.statText}>Medium: {mediumCount}</Text>
            <View style={[styles.statDot, { backgroundColor: '#94a3b8' }]} />
            <Text style={styles.statText}>Low: {lowCount}</Text>
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

        <PDFFooter clientName={clientName} />
      </Page>
    </Document>
  );
}
```

### Task 5: Create PDF Generation Utility

**File**: `apps/web/src/lib/generatePDF.ts`

```typescript
import { pdf } from '@react-pdf/renderer';
import { InterplayReportPDF } from '@/components/clients/reports/pdf/templates/InterplayReportPDF';

interface GeneratePDFOptions {
  clientName: string;
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
 */
export function formatPDFFilename(clientName: string, reportType: string): string {
  const date = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
  const sanitizedClientName = clientName.replace(/[^a-zA-Z0-9]/g, '-');
  const sanitizedReportType = reportType.replace(/[^a-zA-Z0-9]/g, '-');
  return `${sanitizedClientName}-${sanitizedReportType}-${date}.pdf`;
}
```

### Task 6: Update ExportActions Component

**File**: `apps/web/src/components/clients/reports/ExportActions.tsx`

Replace the existing file with:

```typescript
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Download, FileSpreadsheet, Loader2 } from 'lucide-react';
import { generateInterplayReportPDF, downloadBlob, formatPDFFilename } from '@/lib/generatePDF';

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

  // CSV export will be implemented in Phase 3
  const handleExportCSV = () => {
    console.log('CSV export - to be implemented in Phase 3');
    // TODO: Implement in Phase 3
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

## File Structure Summary

After completing this phase, you should have:

```
apps/web/src/
├── lib/
│   └── generatePDF.ts                     # NEW
└── components/clients/reports/
    ├── ExportActions.tsx                  # MODIFIED
    └── pdf/
        ├── PDFDocument.tsx                # NEW
        ├── PDFHeader.tsx                  # NEW
        ├── PDFFooter.tsx                  # NEW
        ├── PDFExecutiveSummary.tsx        # NEW
        ├── PDFRecommendationCard.tsx      # NEW
        └── templates/
            └── InterplayReportPDF.tsx     # NEW
```

## Testing Checklist

- [ ] `npm install @react-pdf/renderer` completes without errors
- [ ] Click "Download PDF" shows loading state ("Generating PDF...")
- [ ] PDF downloads with correct filename format: `{ClientName}-SEO-SEM-Interplay-Report-{Date}.pdf`
- [ ] PDF opens correctly in PDF viewers
- [ ] PDF header shows Advergent branding, client name, and date range
- [ ] Executive summary section renders with correct styling
- [ ] Key highlights are numbered and readable
- [ ] Recommendation cards show type badges (SEM/SEO/Hybrid)
- [ ] Impact badges show correct colors
- [ ] Effort level is displayed for each recommendation
- [ ] Action items are listed under each recommendation
- [ ] Page numbers appear in footer
- [ ] Multi-page reports paginate correctly
- [ ] PDF generation completes within 5 seconds
- [ ] Error handling works (try with missing data)

## Troubleshooting

### Common Issues

1. **"Cannot find module '@react-pdf/renderer'"**
   - Run `npm install @react-pdf/renderer` in the web app directory
   - Restart the dev server

2. **Fonts not rendering correctly**
   - @react-pdf/renderer uses Helvetica by default
   - Custom fonts need to be registered with `Font.register()`

3. **PDF not downloading**
   - Check browser console for errors
   - Ensure blob URL is being created correctly
   - Some browsers block downloads - check popup blocker

4. **Styles not applying**
   - @react-pdf/renderer uses its own StyleSheet, not CSS
   - Flexbox works but not all CSS properties are supported
   - Check the [react-pdf documentation](https://react-pdf.org/styling) for supported styles

5. **Performance issues with large reports**
   - Use `wrap={false}` on components that shouldn't split across pages
   - Consider chunking large recommendation lists

## Notes for Implementation

1. **Style System**: @react-pdf/renderer has its own StyleSheet system that's similar to React Native. Not all CSS properties are supported.

2. **Fonts**: The default font is Helvetica. Custom fonts need explicit registration.

3. **Images**: To add logos or images, use the `Image` component from @react-pdf/renderer with a URL or base64 source.

4. **Page Breaks**: Use `wrap={false}` on View components to prevent them from breaking across pages.

5. **Dynamic Content**: The PDF is generated at download time, so it always reflects current report data.

6. **Performance**: PDF generation happens client-side and is typically fast (< 3 seconds for most reports).
