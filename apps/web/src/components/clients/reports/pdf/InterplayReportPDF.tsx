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
