import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';
import { AlertTriangle } from 'lucide-react';

interface BusinessTypeMismatchAlertProps {
  message?: string;
  clientId: string;
}

export function BusinessTypeMismatchAlert({
  message,
  clientId,
}: BusinessTypeMismatchAlertProps) {
  return (
    <Alert className="mb-4 border-amber-200 bg-amber-50">
      <AlertTriangle className="h-4 w-4 text-amber-600" />
      <AlertTitle className="text-amber-900">Business Type Review Suggested</AlertTitle>
      <AlertDescription className="space-y-3">
        <p className="text-amber-800">
          {message || "The detected signals don't match the selected business type."}
        </p>
        <Button variant="outline" size="sm" asChild>
          <Link to={`/clients/${clientId}?tab=settings`}>Review Settings</Link>
        </Button>
      </AlertDescription>
    </Alert>
  );
}
