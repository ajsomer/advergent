import { View, Text } from '@react-pdf/renderer';
import { pdfStyles } from './styles';
import type { ReportTrigger } from '@advergent/shared';

interface PDFHeaderProps {
  clientName: string;
  reportTitle: string;
  dateRange: {
    start: string;
    end: string;
  };
  generatedAt: string;
  trigger: ReportTrigger;
}

const triggerLabels: Record<ReportTrigger, string> = {
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
