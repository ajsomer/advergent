/**
 * Business type enum - matches the database enum and skill system types.
 * Determines which skill bundle to load during report generation.
 */
export type BusinessType = 'ecommerce' | 'lead-gen' | 'saas' | 'local';

/**
 * Represents a client account in the system.
 */
export interface ClientAccount {
  id: string;
  agencyId: string;
  name: string;
  googleAdsCustomerId?: string;
  searchConsoleSiteUrl?: string;
  ga4PropertyId?: string;
  syncFrequency: string;
  businessType: BusinessType;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

/**
 * Business type support information returned with client details.
 */
export interface BusinessTypeSupport {
  isFullySupported: boolean;
  fallbackNote?: string;
}

/**
 * Extended client account with business type support info.
 */
export interface ClientAccountWithSupport extends ClientAccount {
  businessTypeSupport: BusinessTypeSupport;
}

/**
 * Business type option for selection UI.
 */
export interface BusinessTypeOption {
  value: BusinessType;
  label: string;
  description: string;
  isFullySupported: boolean;
  fallbackNote?: string;
}

/**
 * Request body for creating a new client.
 */
export interface CreateClientRequest {
  name: string;
  businessType?: BusinessType;
}

/**
 * Request body for updating a client.
 */
export interface UpdateClientRequest {
  name?: string;
  googleAdsCustomerId?: string;
  searchConsoleSiteUrl?: string;
  businessType?: BusinessType;
  isActive?: boolean;
}

/**
 * Legacy shared client account interface for backwards compatibility.
 * @deprecated Use ClientAccount instead.
 */
export interface SharedClientAccount {
  id: string;
  name: string;
  industry?: string;
}
