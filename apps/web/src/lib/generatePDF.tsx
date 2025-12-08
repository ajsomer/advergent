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
