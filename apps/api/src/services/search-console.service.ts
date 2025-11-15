export async function fetchSearchConsoleData(clientId: string, startDate: string, endDate: string) {
  if (process.env.USE_MOCK_GOOGLE_APIS === 'true') {
    const data = await import('./search-console.service.mock');
    return data.fetchSearchConsoleDataMock(clientId, startDate, endDate);
  }

  // TODO: integrate googleapis client
  return [];
}
