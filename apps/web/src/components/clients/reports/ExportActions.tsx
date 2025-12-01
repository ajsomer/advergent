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
