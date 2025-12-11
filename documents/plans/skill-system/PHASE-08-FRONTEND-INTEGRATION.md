# Phase 8: Frontend Integration

## Goal

Add business type selection to the client onboarding flow and client settings, allowing users to manually specify the business type for each client.

## Files to Modify/Create

### 1. Business Type Selector Component

**`apps/web/src/components/clients/BusinessTypeSelector.tsx`**

```tsx
import { useState } from 'react';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { InfoCircledIcon } from '@radix-ui/react-icons';
import { BusinessType, BusinessTypeOption } from '@advergent/shared';

interface BusinessTypeSelectorProps {
  value: BusinessType;
  onChange: (value: BusinessType) => void;
  options: BusinessTypeOption[];
  disabled?: boolean;
}

export function BusinessTypeSelector({
  value,
  onChange,
  options,
  disabled = false,
}: BusinessTypeSelectorProps) {
  return (
    <div className="space-y-3">
      <Label className="text-sm font-medium">Business Type</Label>
      <p className="text-sm text-muted-foreground">
        Select the type of business for this client. This affects how recommendations are generated.
      </p>

      <RadioGroup
        value={value}
        onValueChange={(v) => onChange(v as BusinessType)}
        disabled={disabled}
        className="grid grid-cols-1 gap-3 sm:grid-cols-2"
      >
        {options.map((option) => (
          <div key={option.value} className="relative">
            <RadioGroupItem
              value={option.value}
              id={`business-type-${option.value}`}
              className="peer sr-only"
            />
            <Label
              htmlFor={`business-type-${option.value}`}
              className="flex cursor-pointer flex-col rounded-lg border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary"
            >
              <div className="flex items-center justify-between">
                <span className="font-medium">{option.label}</span>
                {!option.isFullySupported && (
                  <Tooltip>
                    <TooltipTrigger>
                      <Badge variant="secondary" className="text-xs">
                        Beta
                      </Badge>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>{option.fallbackNote}</p>
                    </TooltipContent>
                  </Tooltip>
                )}
              </div>
              <span className="mt-1 text-sm text-muted-foreground">
                {option.description}
              </span>
            </Label>
          </div>
        ))}
      </RadioGroup>
    </div>
  );
}
```

### 2. Update Onboarding Flow

**`apps/web/src/pages/Onboarding.tsx`**

Add business type selection as a step in the onboarding wizard.

```tsx
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import { BusinessTypeSelector } from '@/components/clients/BusinessTypeSelector';
import { api } from '@/lib/api';
import { BusinessType, BusinessTypeOption } from '@advergent/shared';

// ... existing imports and code

export function Onboarding() {
  const [step, setStep] = useState(1);
  const [clientData, setClientData] = useState({
    name: '',
    websiteUrl: '',
    businessType: 'ecommerce' as BusinessType,
  });

  // Fetch available business types
  const { data: businessTypesData } = useQuery({
    queryKey: ['business-types'],
    queryFn: async () => {
      const response = await api.get('/clients/business-types');
      return response.data.types as BusinessTypeOption[];
    },
  });

  // ... existing mutation and handlers

  return (
    <div className="container max-w-2xl py-8">
      <div className="space-y-8">
        {/* Step indicator */}
        <StepIndicator current={step} total={4} />

        {/* Step 1: Client Info */}
        {step === 1 && (
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-bold">Add a New Client</h2>
              <p className="text-muted-foreground">
                Enter the basic information for your client account.
              </p>
            </div>

            <div className="space-y-4">
              <div>
                <Label htmlFor="name">Client Name</Label>
                <Input
                  id="name"
                  value={clientData.name}
                  onChange={(e) => setClientData({ ...clientData, name: e.target.value })}
                  placeholder="Acme Corp"
                />
              </div>

              <div>
                <Label htmlFor="websiteUrl">Website URL</Label>
                <Input
                  id="websiteUrl"
                  value={clientData.websiteUrl}
                  onChange={(e) => setClientData({ ...clientData, websiteUrl: e.target.value })}
                  placeholder="https://example.com"
                />
              </div>
            </div>

            <Button onClick={() => setStep(2)}>Continue</Button>
          </div>
        )}

        {/* Step 2: Business Type Selection */}
        {step === 2 && (
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-bold">What type of business is this?</h2>
              <p className="text-muted-foreground">
                This helps us provide more accurate recommendations tailored to your client's business model.
              </p>
            </div>

            {businessTypesData && (
              <BusinessTypeSelector
                value={clientData.businessType}
                onChange={(value) => setClientData({ ...clientData, businessType: value })}
                options={businessTypesData}
              />
            )}

            <div className="flex gap-3">
              <Button variant="outline" onClick={() => setStep(1)}>Back</Button>
              <Button onClick={() => setStep(3)}>Continue</Button>
            </div>
          </div>
        )}

        {/* Step 3: Google Ads Connection */}
        {step === 3 && (
          // ... existing Google Ads OAuth flow
        )}

        {/* Step 4: Search Console Connection */}
        {step === 4 && (
          // ... existing Search Console OAuth flow
        )}
      </div>
    </div>
  );
}
```

### 3. Client Settings Page

**`apps/web/src/components/clients/ClientSettings.tsx`**

Allow updating business type in client settings.

```tsx
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { BusinessTypeSelector } from './BusinessTypeSelector';
import { api } from '@/lib/api';
import { BusinessType, BusinessTypeOption, ClientAccount } from '@advergent/shared';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { toast } from '@/components/ui/use-toast';

interface ClientSettingsProps {
  client: ClientAccount;
}

export function ClientSettings({ client }: ClientSettingsProps) {
  const queryClient = useQueryClient();
  const [businessType, setBusinessType] = useState(client.businessType);
  const [hasChanges, setHasChanges] = useState(false);

  // Fetch available business types
  const { data: businessTypesData } = useQuery({
    queryKey: ['business-types'],
    queryFn: async () => {
      const response = await api.get('/clients/business-types');
      return response.data.types as BusinessTypeOption[];
    },
  });

  // Mutation for updating client
  const updateMutation = useMutation({
    mutationFn: async (newBusinessType: BusinessType) => {
      const response = await api.patch(`/clients/${client.id}`, {
        businessType: newBusinessType,
      });
      return response.data.client;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['client', client.id] });
      setHasChanges(false);
      toast({
        title: 'Settings saved',
        description: 'Business type has been updated. Future reports will use the new settings.',
      });
    },
    onError: () => {
      toast({
        title: 'Error',
        description: 'Failed to update business type. Please try again.',
        variant: 'destructive',
      });
    },
  });

  const handleBusinessTypeChange = (value: BusinessType) => {
    setBusinessType(value);
    setHasChanges(value !== client.businessType);
  };

  const handleSave = () => {
    updateMutation.mutate(businessType);
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium">Business Type</h3>
        <p className="text-sm text-muted-foreground">
          The business type determines how AI recommendations are generated for this client.
        </p>
      </div>

      {businessTypesData && (
        <BusinessTypeSelector
          value={businessType}
          onChange={handleBusinessTypeChange}
          options={businessTypesData}
        />
      )}

      {hasChanges && (
        <Alert>
          <AlertDescription>
            Changing the business type will affect how future reports are generated.
            Existing reports will retain their original analysis.
          </AlertDescription>
        </Alert>
      )}

      <div className="flex gap-3">
        <Button
          onClick={handleSave}
          disabled={!hasChanges || updateMutation.isPending}
        >
          {updateMutation.isPending ? 'Saving...' : 'Save Changes'}
        </Button>
        {hasChanges && (
          <Button
            variant="outline"
            onClick={() => {
              setBusinessType(client.businessType);
              setHasChanges(false);
            }}
          >
            Cancel
          </Button>
        )}
      </div>
    </div>
  );
}
```

### 4. Report Fallback Warning Banner

**`apps/web/src/components/reports/ReportFallbackWarning.tsx`**

Display warning when report was generated with fallback skills.

```tsx
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { ExclamationTriangleIcon } from '@radix-ui/react-icons';

interface ReportFallbackWarningProps {
  originalType: string;
  fallbackType: string;
}

export function ReportFallbackWarning({
  originalType,
  fallbackType,
}: ReportFallbackWarningProps) {
  return (
    <Alert variant="warning" className="mb-4">
      <ExclamationTriangleIcon className="h-4 w-4" />
      <AlertTitle>Limited Analysis</AlertTitle>
      <AlertDescription>
        Full {originalType} skills are not yet available. This report was generated using{' '}
        {fallbackType} skills as a fallback. Some recommendations may not be fully tailored
        to {originalType} businesses.
      </AlertDescription>
    </Alert>
  );
}
```

### 5. Update Report Viewer

**`apps/web/src/pages/ReportDetail.tsx`**

Show fallback warning and business type mismatch alerts.

```tsx
import { ReportFallbackWarning } from '@/components/reports/ReportFallbackWarning';
import { BusinessTypeMismatchAlert } from '@/components/reports/BusinessTypeMismatchAlert';

export function ReportDetail() {
  const { reportId } = useParams();
  const { data: report } = useQuery({
    queryKey: ['report', reportId],
    queryFn: () => fetchReport(reportId),
  });

  if (!report) return <Loading />;

  const { metadata } = report;
  const hasFallbackWarning = metadata.warnings?.some(w => w.type === 'skill-fallback');
  const hasMismatchWarning = metadata.warnings?.some(w => w.type === 'business-type-mismatch');

  return (
    <div className="container py-8">
      {/* Fallback warning */}
      {metadata.skillBundle.usingFallback && (
        <ReportFallbackWarning
          originalType={metadata.skillBundle.fallbackFrom || metadata.skillBundle.businessType}
          fallbackType={metadata.skillBundle.businessType}
        />
      )}

      {/* Business type mismatch warning */}
      {hasMismatchWarning && (
        <BusinessTypeMismatchAlert
          message={metadata.warnings.find(w => w.type === 'business-type-mismatch')?.message}
          clientId={report.clientAccountId}
        />
      )}

      {/* Report content */}
      <div className="space-y-8">
        <ReportHeader report={report} />
        <ExecutiveSummary summary={report.directorOutput.executiveSummary} />
        <Highlights highlights={report.directorOutput.highlights} />
        <RecommendationsList recommendations={report.directorOutput.unifiedRecommendations} />
      </div>
    </div>
  );
}
```

### 6. Business Type Mismatch Alert

**`apps/web/src/components/reports/BusinessTypeMismatchAlert.tsx`**

```tsx
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';
import { ExclamationTriangleIcon } from '@radix-ui/react-icons';

interface BusinessTypeMismatchAlertProps {
  message?: string;
  clientId: string;
}

export function BusinessTypeMismatchAlert({
  message,
  clientId,
}: BusinessTypeMismatchAlertProps) {
  return (
    <Alert variant="warning" className="mb-4">
      <ExclamationTriangleIcon className="h-4 w-4" />
      <AlertTitle>Business Type Review Suggested</AlertTitle>
      <AlertDescription className="space-y-2">
        <p>{message || 'The detected signals don\'t match the selected business type.'}</p>
        <Button variant="outline" size="sm" asChild>
          <Link to={`/clients/${clientId}/settings`}>Review Settings</Link>
        </Button>
      </AlertDescription>
    </Alert>
  );
}
```

### 7. Historical Report Indicator

For reports generated before a business type change:

**`apps/web/src/components/reports/HistoricalReportBanner.tsx`**

```tsx
import { Alert, AlertDescription } from '@/components/ui/alert';
import { InfoCircledIcon } from '@radix-ui/react-icons';

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
    <Alert className="mb-4">
      <InfoCircledIcon className="h-4 w-4" />
      <AlertDescription>
        This report was generated when the client was categorized as <strong>{reportType}</strong>.
        The client is now categorized as <strong>{currentType}</strong>.
      </AlertDescription>
    </Alert>
  );
}
```

## Dependencies

- Phase 7 (Database & API)
- Shared types from `packages/shared`

## Validation Criteria

- [ ] Business type selector displays all 4 options
- [ ] Beta badge shows for unsupported types with tooltip
- [ ] Onboarding flow includes business type step
- [ ] Client settings allow changing business type
- [ ] Change warning is shown when modifying business type
- [ ] Fallback warning banner displays on reports
- [ ] Business type mismatch alert displays with link to settings
- [ ] Historical report banner shows for old reports after type change

## User Experience Considerations

1. **Clear descriptions** - Each business type has clear examples
2. **Beta indication** - Users know which types have full vs fallback support
3. **Change warnings** - Users understand impact of changing business type
4. **Non-blocking** - Fallback types still work, just with less tailored analysis

## Estimated Effort

Medium - requires creating new components and updating existing flows.
