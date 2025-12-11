# Skill System Phases 7 & 8 Implementation

**Date:** 2025-12-11
**Author:** Claude Opus 4.5

## Overview

Completed the database and frontend integration phases of the skill system:
- **Phase 7**: Database & API - Add business type storage and expose through API
- **Phase 8**: Frontend Integration - Business type selection in onboarding and client settings

## Phase 7: Database & API

### Database Schema Updates

Added `business_type` enum and column to `client_accounts` table:

```typescript
// schema.ts
export const businessTypeEnum = pgEnum('business_type', [
  'ecommerce',
  'lead-gen',
  'saas',
  'local'
]);

export const clientAccounts = pgTable('client_accounts', {
  // ... existing fields ...
  businessType: businessTypeEnum('business_type').default('ecommerce').notNull(),
  // ...
}, (table) => ({
  // ... existing indexes ...
  businessTypeIdx: index('idx_client_accounts_business_type').on(table.businessType),
}));
```

### Migration Generated

```sql
-- drizzle/0011_solid_sabra.sql
CREATE TYPE "public"."business_type" AS ENUM('ecommerce', 'lead-gen', 'saas', 'local');
ALTER TABLE "client_accounts" ADD COLUMN "business_type" "business_type" DEFAULT 'ecommerce' NOT NULL;
CREATE INDEX "idx_client_accounts_business_type" ON "client_accounts" USING btree ("business_type");
```

### API Endpoints Updated

#### New Endpoint: `GET /api/clients/business-types`

Returns all available business types with support status:

```json
{
  "types": [
    {
      "value": "ecommerce",
      "label": "Ecommerce",
      "description": "Online retail, product sales, marketplaces, D2C brands",
      "isFullySupported": true
    },
    {
      "value": "lead-gen",
      "label": "Lead Generation",
      "description": "Lead generation, form submissions, B2B services, agencies",
      "isFullySupported": true
    },
    {
      "value": "saas",
      "label": "SaaS",
      "description": "Software as a Service, subscription products",
      "isFullySupported": false,
      "fallbackNote": "Uses Lead Generation skills"
    },
    {
      "value": "local",
      "label": "Local Business",
      "description": "Local businesses with physical presence (restaurants, dentists, etc.)",
      "isFullySupported": false,
      "fallbackNote": "Uses Ecommerce skills"
    }
  ]
}
```

#### Updated: `POST /api/clients`

Now accepts `businessType` in request body:

```typescript
const createClientSchema = z.object({
  name: z.string().min(1, 'Client name is required').max(255),
  businessType: businessTypeSchema.default('ecommerce'),
});
```

#### Updated: `PATCH /api/clients/:id`

Now accepts `businessType` for updates:

```typescript
const updateClientSchema = z.object({
  // ... existing fields ...
  businessType: businessTypeSchema.optional(),
});
```

#### Updated: `GET /api/clients/:id`

Returns `businessTypeSupport` info with client data:

```json
{
  "client": {
    "id": "abc123",
    "name": "Acme Corp",
    "businessType": "saas",
    "businessTypeSupport": {
      "isFullySupported": false,
      "fallbackNote": "Using Lead Generation skills as fallback"
    }
  }
}
```

### Shared Types Updated

Added comprehensive types to `packages/shared/src/types/client.types.ts`:

```typescript
export type BusinessType = 'ecommerce' | 'lead-gen' | 'saas' | 'local';

export interface ClientAccount {
  id: string;
  agencyId: string;
  name: string;
  businessType: BusinessType;
  // ... other fields
}

export interface BusinessTypeSupport {
  isFullySupported: boolean;
  fallbackNote?: string;
}

export interface BusinessTypeOption {
  value: BusinessType;
  label: string;
  description: string;
  isFullySupported: boolean;
  fallbackNote?: string;
}

export interface CreateClientRequest {
  name: string;
  businessType?: BusinessType;
}

export interface UpdateClientRequest {
  businessType?: BusinessType;
  // ... other optional fields
}
```

## Phase 8: Frontend Integration

### BusinessTypeSelector Component

New reusable component for selecting business types:

**`apps/web/src/components/clients/BusinessTypeSelector.tsx`**

Features:
- Radio-button style card selector
- Shows all 4 business types with descriptions
- "Beta" badge for unsupported types with fallback notes
- Visual indication of selected state
- Disabled state support

```tsx
<BusinessTypeSelector
  value={businessType}
  onChange={setBusinessType}
  options={businessTypeOptions}
  disabled={loading}
/>
```

### Onboarding Flow Updates

**`apps/web/src/pages/Onboarding.tsx`**

Added new `select-business-type` step to onboarding wizard:

1. **Step 1**: Enter client name
2. **Step 2**: Select business type (NEW)
3. **Step 3**: Select connection mode (unified/split)
4. **Steps 4-6**: Connect Google services
5. **Complete**: Confirmation

Changes:
- Added `businessType` state with default `'ecommerce'`
- Fetches business type options from API on mount
- Business type included in `POST /api/clients` request
- Updated step indicators for new flow

### ClientSettings Component

New component for managing client settings:

**`apps/web/src/components/clients/settings/ClientSettings.tsx`**

Features:
- Displays current business type with selector
- Warning when changes will affect future reports
- Success/error feedback on save
- Cancel button to revert changes
- Fetches available options from API

### ClientDetail Page Updates

**`apps/web/src/pages/ClientDetail.tsx`**

Added Settings tab:
- New "Settings" tab with gear icon
- URL query param support (`?tab=settings`) for deep linking
- Tab navigation updates URL without full page refresh
- Shows ClientSettings component in Card layout

### Report Warning Components

Three new components for displaying report-related warnings:

**`apps/web/src/components/reports/ReportFallbackWarning.tsx`**
- Shows when report used fallback skills
- Displays original and fallback business types

**`apps/web/src/components/reports/BusinessTypeMismatchAlert.tsx`**
- Shows when detected signals don't match selected type
- Includes link to settings page

**`apps/web/src/components/reports/HistoricalReportBanner.tsx`**
- Shows when report was generated with different business type
- Compares report type to current client type

### Type Updates

Updated frontend types for business type support:

```typescript
// hooks/useClientDetail.ts
export interface Client {
  // ... existing fields
  businessType?: string;
}

// types/client.types.ts
export type BusinessType = 'ecommerce' | 'lead-gen' | 'saas' | 'local';

export interface ClientAccount {
  // ... existing fields
  businessType?: BusinessType;
}
```

## Files Created

| File | Purpose |
|------|---------|
| `apps/api/drizzle/0011_solid_sabra.sql` | Migration for business_type |
| `apps/web/src/components/clients/BusinessTypeSelector.tsx` | Business type selector component |
| `apps/web/src/components/clients/settings/ClientSettings.tsx` | Client settings component |
| `apps/web/src/components/clients/settings/index.ts` | Settings barrel export |
| `apps/web/src/components/reports/ReportFallbackWarning.tsx` | Fallback warning banner |
| `apps/web/src/components/reports/BusinessTypeMismatchAlert.tsx` | Mismatch alert component |
| `apps/web/src/components/reports/HistoricalReportBanner.tsx` | Historical report banner |
| `apps/web/src/components/reports/index.ts` | Reports barrel export |

## Files Modified

| File | Changes |
|------|---------|
| `apps/api/src/db/schema.ts` | Added businessTypeEnum and column |
| `apps/api/src/routes/clients.routes.ts` | Added business-types endpoint, updated CRUD |
| `packages/shared/src/types/client.types.ts` | Added BusinessType and related interfaces |
| `apps/web/src/pages/Onboarding.tsx` | Added business type selection step |
| `apps/web/src/pages/ClientDetail.tsx` | Added Settings tab |
| `apps/web/src/hooks/useClientDetail.ts` | Added businessType to Client interface |
| `apps/web/src/types/client.types.ts` | Added BusinessType type |

## Validation

- [x] `npm run type-check` passes for all workspaces
- [x] `npm run build` passes for API
- [x] Database migration generated successfully
- [x] Migration applied via `npm run db:push`
- [x] Existing clients default to 'ecommerce'
- [x] API validates business type values with Zod
- [x] Frontend components render without errors

## User Experience Flow

### New Client Onboarding
1. User enters client name → Continue
2. User selects business type from 4 options
   - Beta badge shows for unsupported types
   - Info text explains fallback behavior
3. User continues to Google account connection
4. Client created with selected business type

### Existing Client Settings
1. User navigates to client → Settings tab
2. User can change business type
3. Warning explains impact on future reports
4. Save confirms change, Cancel reverts

### Report Viewing
1. If report used fallback skills → ReportFallbackWarning banner
2. If business type mismatch detected → BusinessTypeMismatchAlert
3. If report from before type change → HistoricalReportBanner

## Next Steps

1. Integrate report warning components into InterplayReportView
2. Add business type to report list/table view
3. Consider auto-detection of business type from website analysis
4. Add bulk business type update for agencies
