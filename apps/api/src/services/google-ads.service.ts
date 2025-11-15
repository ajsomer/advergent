export async function fetchGoogleAdsData(clientId: string, startDate: string, endDate: string) {
  if (process.env.USE_MOCK_GOOGLE_APIS === 'true') {
    const data = await import('./google-ads.service.mock');
    return data.fetchGoogleAdsDataMock(clientId, startDate, endDate);
  }

  // TODO: integrate google-ads-api client
  return [];
}

export async function fetchAuctionInsights(clientId: string) {
  if (process.env.USE_MOCK_GOOGLE_APIS === 'true') {
    return [];
  }
  return [];
}
