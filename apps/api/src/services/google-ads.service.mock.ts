import { readFileSync } from 'fs';
import path from 'path';

const fixturePath = path.resolve(__dirname, '../../fixtures/google-ads-sample.json');
const fixture = JSON.parse(readFileSync(fixturePath, 'utf-8'));

export async function fetchGoogleAdsDataMock(_clientId: string, _startDate: string, _endDate: string) {
  return fixture.searchTerms;
}
