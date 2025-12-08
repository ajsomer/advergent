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
