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
