import { readFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleAdsQuery } from './google-ads.service.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const fixturePath = path.resolve(__dirname, '../../fixtures/google-ads-sample.json');
const fixture = JSON.parse(readFileSync(fixturePath, 'utf-8'));

/**
 * Mock Google Ads account data for development
 */
export interface MockGoogleAdsAccount {
  customerId: string;
  name: string;
  isManager: boolean;
  currency: string;
}

/**
 * Returns mock Google Ads accounts for account selection
 */
export async function listAccessibleAccountsMock(): Promise<MockGoogleAdsAccount[]> {
  return [
    {
      customerId: '1234567890',
      name: 'Acme Corp - Main Account',
      isManager: false,
      currency: 'USD',
    },
    {
      customerId: '9876543210',
      name: 'Demo Client - Campaigns',
      isManager: false,
      currency: 'USD',
    },
    {
      customerId: '5555555555',
      name: 'Agency Manager Account',
      isManager: true,
      currency: 'EUR',
    },
  ];
}

/**
 * Verifies that a mock account exists (always returns true for any valid-looking ID)
 */
export async function verifyAccountAccessMock(customerId: string): Promise<boolean> {
  // Accept any 10-digit customer ID
  return /^\d{10}$/.test(customerId);
}

/**
 * Returns mock search query data from fixtures
 */
export async function fetchGoogleAdsDataMock(
  _clientId: string,
  _startDate: string,
  _endDate: string
): Promise<GoogleAdsQuery[]> {
  return fixture.searchTerms;
}

/**
 * Returns mock auction insights data (empty for now)
 */
export async function fetchAuctionInsightsMock(
  _clientId: string,
  _startDate: string,
  _endDate: string
): Promise<any[]> {
  return [];
}
