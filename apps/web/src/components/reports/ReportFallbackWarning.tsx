import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertTriangle } from 'lucide-react';

interface ReportFallbackWarningProps {
  originalType: string;
  fallbackType: string;
}

export function ReportFallbackWarning({
  originalType,
  fallbackType,
}: ReportFallbackWarningProps) {
  return (
    <Alert className="mb-4 border-amber-200 bg-amber-50">
      <AlertTriangle className="h-4 w-4 text-amber-600" />
      <AlertTitle className="text-amber-900">Limited Analysis</AlertTitle>
      <AlertDescription className="text-amber-800">
        Full {originalType} skills are not yet available. This report was generated using{' '}
        {fallbackType} skills as a fallback. Some recommendations may not be fully tailored
        to {originalType} businesses.
      </AlertDescription>
    </Alert>
  );
}
