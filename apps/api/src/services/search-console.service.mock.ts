import { readFileSync } from 'fs';
import path from 'path';

const fixturePath = path.resolve(__dirname, '../../fixtures/search-console-sample.json');
const fixture = JSON.parse(readFileSync(fixturePath, 'utf-8'));

export async function fetchSearchConsoleDataMock(_clientId: string, _startDate: string, _endDate: string) {
  return fixture.queries;
}
