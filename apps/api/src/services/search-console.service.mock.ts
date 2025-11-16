import { readFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const fixturePath = path.resolve(__dirname, '../../fixtures/search-console-sample.json');
const fixture = JSON.parse(readFileSync(fixturePath, 'utf-8'));

/**
 * Mock Search Console property data for development
 */
export interface MockSearchConsoleProperty {
  siteUrl: string;
  permissionLevel: string;
}

/**
 * Returns mock Search Console properties for property selection
 */
export async function listSearchConsolePropertiesMock(): Promise<MockSearchConsoleProperty[]> {
  return [
    {
      siteUrl: 'https://www.example.com/',
      permissionLevel: 'siteFullUser',
    },
    {
      siteUrl: 'https://blog.example.com/',
      permissionLevel: 'siteOwner',
    },
    {
      siteUrl: 'sc-domain:example.com',
      permissionLevel: 'siteOwner',
    },
  ];
}

/**
 * Verifies that a mock property exists
 */
export async function verifyPropertyAccessMock(siteUrl: string): Promise<boolean> {
  // Accept any URL format
  return siteUrl.length > 0;
}

/**
 * Returns mock search console query data from fixtures
 */
export async function fetchSearchConsoleDataMock(_clientId: string, _startDate: string, _endDate: string) {
  return fixture.queries;
}

/**
 * Returns mock Search Console analytics data with date range
 * Generates sample data across the date range with the `date` field required by the schema
 */
export async function getSearchAnalyticsMock(
  _clientId: string,
  startDate: string,
  endDate: string
) {
  const start = new Date(startDate);
  const end = new Date(endDate);
  const results = [];

  // Generate data for each query across the date range
  for (const query of fixture.queries) {
    // Create entries for multiple dates within the range
    const daysInRange = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
    const sampleDays = Math.min(5, daysInRange); // Sample up to 5 days

    for (let i = 0; i < sampleDays; i++) {
      const date = new Date(start.getTime() + (i * (daysInRange / sampleDays)) * 24 * 60 * 60 * 1000);
      const dateStr = date.toISOString().split('T')[0];

      results.push({
        query: query.query,
        date: dateStr,
        impressions: query.impressions,
        clicks: query.clicks,
        ctr: query.ctr,
        position: query.position,
      });
    }
  }

  return results;
}
