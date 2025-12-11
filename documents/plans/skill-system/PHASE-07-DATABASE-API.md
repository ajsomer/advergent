# Phase 7: Database & API

## Goal

Add business type storage to the database and expose it through the API for client management.

## Database Changes

### 1. Schema Update

**`apps/api/src/db/schema.ts`**

```typescript
import { pgTable, pgEnum, uuid, varchar, timestamp, boolean, text } from 'drizzle-orm/pg-core';

// Business type enum - must match BusinessType in skills/types.ts
export const businessTypeEnum = pgEnum('business_type', [
  'ecommerce',
  'lead-gen',
  'saas',
  'local'
]);

export const clientAccounts = pgTable('client_accounts', {
  id: uuid('id').primaryKey().defaultRandom(),
  agencyId: uuid('agency_id').notNull().references(() => agencies.id),
  name: varchar('name', { length: 255 }).notNull(),
  websiteUrl: varchar('website_url', { length: 500 }),
  googleAdsCustomerId: varchar('google_ads_customer_id', { length: 50 }),
  searchConsoleProperty: varchar('search_console_property', { length: 500 }),
  industry: varchar('industry', { length: 100 }),

  // NEW: Business type for skill loading
  businessType: businessTypeEnum('business_type').default('ecommerce').notNull(),

  isActive: boolean('is_active').default(true).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});
```

### 2. Migration File

**`apps/api/drizzle/migrations/XXXX_add_business_type.sql`**

```sql
-- Add business_type enum and column to client_accounts

-- Create the enum type
DO $$ BEGIN
  CREATE TYPE business_type AS ENUM('ecommerce', 'lead-gen', 'saas', 'local');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Add the column with default value
ALTER TABLE client_accounts
ADD COLUMN IF NOT EXISTS business_type business_type NOT NULL DEFAULT 'ecommerce';

-- Create index for filtering by business type
CREATE INDEX IF NOT EXISTS idx_client_accounts_business_type
ON client_accounts(business_type);

-- Add comment for documentation
COMMENT ON COLUMN client_accounts.business_type IS 'Business type used for loading appropriate skill bundle during report generation';
```

## API Changes

### 1. Update Client Routes

**`apps/api/src/routes/clients.routes.ts`**

```typescript
import { Router } from 'express';
import { z } from 'zod';
import { BusinessType } from '../services/interplay-report/skills/types';
import { getAvailableBusinessTypes, isBusinessTypeSupported } from '../services/interplay-report/skills';

const router = Router();

// Zod schema for business type validation
const businessTypeSchema = z.enum(['ecommerce', 'lead-gen', 'saas', 'local']);

// Schema for creating a client
const createClientSchema = z.object({
  name: z.string().min(1).max(255),
  websiteUrl: z.string().url().optional(),
  googleAdsCustomerId: z.string().optional(),
  searchConsoleProperty: z.string().optional(),
  industry: z.string().max(100).optional(),
  businessType: businessTypeSchema.default('ecommerce'),
});

// Schema for updating a client
const updateClientSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  websiteUrl: z.string().url().optional(),
  googleAdsCustomerId: z.string().optional(),
  searchConsoleProperty: z.string().optional(),
  industry: z.string().max(100).optional(),
  businessType: businessTypeSchema.optional(),
});

// GET /api/clients/business-types
// Returns available business types for selection
router.get('/business-types', async (req, res) => {
  const allTypes = ['ecommerce', 'lead-gen', 'saas', 'local'] as const;

  const types = allTypes.map(type => ({
    value: type,
    label: getBusinessTypeLabel(type),
    description: getBusinessTypeDescription(type),
    isFullySupported: isBusinessTypeSupported(type),
    fallbackNote: !isBusinessTypeSupported(type)
      ? `Uses ${getFallbackType(type)} skills`
      : undefined,
  }));

  res.json({ types });
});

// POST /api/clients
router.post('/', authenticate, async (req, res) => {
  const validation = createClientSchema.safeParse(req.body);

  if (!validation.success) {
    return res.status(400).json({ error: validation.error.flatten() });
  }

  const { name, websiteUrl, googleAdsCustomerId, searchConsoleProperty, industry, businessType } = validation.data;

  const client = await createClient({
    agencyId: req.user.agencyId,
    name,
    websiteUrl,
    googleAdsCustomerId,
    searchConsoleProperty,
    industry,
    businessType,
  });

  res.status(201).json({ client });
});

// PATCH /api/clients/:id
router.patch('/:id', authenticate, async (req, res) => {
  const { id } = req.params;
  const validation = updateClientSchema.safeParse(req.body);

  if (!validation.success) {
    return res.status(400).json({ error: validation.error.flatten() });
  }

  const client = await updateClient(id, req.user.agencyId, validation.data);

  if (!client) {
    return res.status(404).json({ error: 'Client not found' });
  }

  res.json({ client });
});

// GET /api/clients/:id
router.get('/:id', authenticate, async (req, res) => {
  const { id } = req.params;
  const client = await getClient(id, req.user.agencyId);

  if (!client) {
    return res.status(404).json({ error: 'Client not found' });
  }

  // Include business type support info
  const response = {
    ...client,
    businessTypeSupport: {
      isFullySupported: isBusinessTypeSupported(client.businessType),
      fallbackNote: !isBusinessTypeSupported(client.businessType)
        ? `Using ${getFallbackType(client.businessType)} skills as fallback`
        : undefined,
    },
  };

  res.json({ client: response });
});

// Helper functions
function getBusinessTypeLabel(type: BusinessType): string {
  const labels: Record<BusinessType, string> = {
    'ecommerce': 'Ecommerce',
    'lead-gen': 'Lead Generation',
    'saas': 'SaaS',
    'local': 'Local Business',
  };
  return labels[type];
}

function getBusinessTypeDescription(type: BusinessType): string {
  const descriptions: Record<BusinessType, string> = {
    'ecommerce': 'Online retail, product sales, marketplaces, D2C brands',
    'lead-gen': 'Lead generation, form submissions, B2B services, agencies',
    'saas': 'Software as a Service, subscription products',
    'local': 'Local businesses with physical presence (restaurants, dentists, etc.)',
  };
  return descriptions[type];
}

function getFallbackType(type: BusinessType): BusinessType {
  const fallbacks: Partial<Record<BusinessType, BusinessType>> = {
    'saas': 'lead-gen',
    'local': 'ecommerce',
  };
  return fallbacks[type] || type;
}

export default router;
```

### 2. Update Shared Types

**`packages/shared/src/types/client.ts`**

```typescript
export type BusinessType = 'ecommerce' | 'lead-gen' | 'saas' | 'local';

export interface ClientAccount {
  id: string;
  agencyId: string;
  name: string;
  websiteUrl?: string;
  googleAdsCustomerId?: string;
  searchConsoleProperty?: string;
  industry?: string;
  businessType: BusinessType;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
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
  websiteUrl?: string;
  googleAdsCustomerId?: string;
  searchConsoleProperty?: string;
  industry?: string;
  businessType?: BusinessType;
}

export interface UpdateClientRequest {
  name?: string;
  websiteUrl?: string;
  googleAdsCustomerId?: string;
  searchConsoleProperty?: string;
  industry?: string;
  businessType?: BusinessType;
}
```

### 3. Update Client Service

**`apps/api/src/services/client.service.ts`**

```typescript
import { db } from '@/db';
import { clientAccounts } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import { BusinessType } from './interplay-report/skills/types';

export interface CreateClientData {
  agencyId: string;
  name: string;
  websiteUrl?: string;
  googleAdsCustomerId?: string;
  searchConsoleProperty?: string;
  industry?: string;
  businessType: BusinessType;
}

export async function createClient(data: CreateClientData) {
  const [client] = await db.insert(clientAccounts)
    .values({
      agencyId: data.agencyId,
      name: data.name,
      websiteUrl: data.websiteUrl,
      googleAdsCustomerId: data.googleAdsCustomerId,
      searchConsoleProperty: data.searchConsoleProperty,
      industry: data.industry,
      businessType: data.businessType,
    })
    .returning();

  return client;
}

export async function updateClient(
  clientId: string,
  agencyId: string,
  data: Partial<CreateClientData>
) {
  const [client] = await db.update(clientAccounts)
    .set({
      ...data,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(clientAccounts.id, clientId),
        eq(clientAccounts.agencyId, agencyId)
      )
    )
    .returning();

  return client;
}

export async function getClient(clientId: string, agencyId: string) {
  const [client] = await db.select()
    .from(clientAccounts)
    .where(
      and(
        eq(clientAccounts.id, clientId),
        eq(clientAccounts.agencyId, agencyId)
      )
    );

  return client;
}
```

## API Response Examples

### GET /api/clients/business-types

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
      "fallbackNote": "Uses lead-gen skills"
    },
    {
      "value": "local",
      "label": "Local Business",
      "description": "Local businesses with physical presence (restaurants, dentists, etc.)",
      "isFullySupported": false,
      "fallbackNote": "Uses ecommerce skills"
    }
  ]
}
```

### GET /api/clients/:id

```json
{
  "client": {
    "id": "abc123",
    "name": "Acme Corp",
    "businessType": "lead-gen",
    "businessTypeSupport": {
      "isFullySupported": true
    },
    ...
  }
}
```

## Dependencies

- Phase 1 (Type Definitions)
- Phase 2 (Skill Loader - for `isBusinessTypeSupported`)

## Validation Criteria

- [ ] Migration runs successfully
- [ ] Existing clients default to 'ecommerce'
- [ ] New clients can be created with any business type
- [ ] Business type can be updated via PATCH
- [ ] `/business-types` endpoint returns all types with support status
- [ ] API validates business type values
- [ ] Shared types are available to frontend

## Migration Considerations

- Default value of 'ecommerce' ensures no breaking changes
- Index on business_type enables efficient filtering
- Enum type ensures data integrity

## Estimated Effort

Small - straightforward database and API changes.
