export type BusinessType = 'ecommerce' | 'lead-gen' | 'saas' | 'local';

export interface ClientAccount {
  id: string;
  name: string;
  industry?: string;
  businessType?: BusinessType;
  googleAdsStatus: string;
  searchConsoleStatus: string;
}
