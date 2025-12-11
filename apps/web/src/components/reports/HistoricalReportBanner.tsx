import { Alert, AlertDescription } from '@/components/ui/alert';
import { Info } from 'lucide-react';

interface HistoricalReportBannerProps {
  currentType: string;
  reportType: string;
}

export function HistoricalReportBanner({
  currentType,
  reportType,
}: HistoricalReportBannerProps) {
  if (currentType === reportType) return null;

  return (
    <Alert className="mb-4 border-blue-200 bg-blue-50">
      <Info className="h-4 w-4 text-blue-600" />
      <AlertDescription className="text-blue-800">
        This report was generated when the client was categorized as <strong>{reportType}</strong>.
        The client is now categorized as <strong>{currentType}</strong>.
      </AlertDescription>
    </Alert>
  );
}
