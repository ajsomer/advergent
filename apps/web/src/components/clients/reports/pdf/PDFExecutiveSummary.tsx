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
