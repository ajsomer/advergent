import { useState, useEffect } from 'react';
import { useApiClient } from '@/lib/api';
import { BusinessTypeSelector, type BusinessType, type BusinessTypeOption } from '../BusinessTypeSelector';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, AlertTriangle } from 'lucide-react';

interface ClientSettingsProps {
  clientId: string;
  currentBusinessType: BusinessType;
  onUpdate?: (newBusinessType: BusinessType) => void;
}

export function ClientSettings({
  clientId,
  currentBusinessType,
  onUpdate,
}: ClientSettingsProps) {
  const api = useApiClient();
  const [businessType, setBusinessType] = useState<BusinessType>(currentBusinessType);
  const [businessTypeOptions, setBusinessTypeOptions] = useState<BusinessTypeOption[]>([]);
  const [hasChanges, setHasChanges] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch available business types on mount
  useEffect(() => {
    async function fetchBusinessTypes() {
      try {
        const response = await api.get('/api/clients/business-types');
        setBusinessTypeOptions(response.data.types);
      } catch (err) {
        console.error('Failed to fetch business types:', err);
        // Fallback to default options
        setBusinessTypeOptions([
          { value: 'ecommerce', label: 'Ecommerce', description: 'Online retail, product sales, marketplaces, D2C brands', isFullySupported: true },
          { value: 'lead-gen', label: 'Lead Generation', description: 'Lead generation, form submissions, B2B services, agencies', isFullySupported: true },
          { value: 'saas', label: 'SaaS', description: 'Software as a Service, subscription products', isFullySupported: false, fallbackNote: 'Uses Lead Generation skills' },
          { value: 'local', label: 'Local Business', description: 'Local businesses with physical presence (restaurants, dentists, etc.)', isFullySupported: false, fallbackNote: 'Uses Ecommerce skills' },
        ]);
      }
    }
    fetchBusinessTypes();
  }, [api]);

  // Reset state when currentBusinessType prop changes
  useEffect(() => {
    setBusinessType(currentBusinessType);
    setHasChanges(false);
  }, [currentBusinessType]);

  const handleBusinessTypeChange = (value: BusinessType) => {
    setBusinessType(value);
    setHasChanges(value !== currentBusinessType);
    setSaveSuccess(false);
  };

  const handleSave = async () => {
    setLoading(true);
    setError(null);
    setSaveSuccess(false);

    try {
      await api.patch(`/api/clients/${clientId}`, {
        businessType,
      });

      setHasChanges(false);
      setSaveSuccess(true);
      onUpdate?.(businessType);

      // Clear success message after 3 seconds
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to update business type. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    setBusinessType(currentBusinessType);
    setHasChanges(false);
    setError(null);
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium">Business Type</h3>
        <p className="text-sm text-slate-500">
          The business type determines how AI recommendations are generated for this client.
        </p>
      </div>

      {businessTypeOptions.length > 0 && (
        <BusinessTypeSelector
          value={businessType}
          onChange={handleBusinessTypeChange}
          options={businessTypeOptions}
          disabled={loading}
        />
      )}

      {hasChanges && (
        <Alert className="border-amber-200 bg-amber-50">
          <AlertTriangle className="h-4 w-4 text-amber-600" />
          <AlertDescription className="text-amber-800">
            Changing the business type will affect how future reports are generated.
            Existing reports will retain their original analysis.
          </AlertDescription>
        </Alert>
      )}

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {saveSuccess && (
        <Alert className="border-green-200 bg-green-50">
          <AlertDescription className="text-green-800">
            Business type updated successfully. Future reports will use the new settings.
          </AlertDescription>
        </Alert>
      )}

      <div className="flex gap-3">
        <Button
          onClick={handleSave}
          disabled={!hasChanges || loading}
        >
          {loading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Saving...
            </>
          ) : (
            'Save Changes'
          )}
        </Button>
        {hasChanges && (
          <Button
            variant="outline"
            onClick={handleCancel}
            disabled={loading}
          >
            Cancel
          </Button>
        )}
      </div>
    </div>
  );
}
