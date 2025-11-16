/**
 * Service Factory
 * Exports appropriate service implementation based on USE_MOCK_GOOGLE_APIS flag
 */

import { config } from '@/config/index.js';

// Import real services
import * as GoogleAdsServiceReal from './google-ads.service.js';
import * as SearchConsoleServiceReal from './search-console.service.js';

// Import mock services
import * as GoogleAdsServiceMock from './google-ads.service.mock.js';
import * as SearchConsoleServiceMock from './search-console.service.mock.js';

/**
 * Google Ads Service
 * Returns mock implementation if USE_MOCK_GOOGLE_APIS=true, otherwise returns real implementation
 */
export const googleAdsService = config.useMockGoogleApis
  ? GoogleAdsServiceMock
  : GoogleAdsServiceReal;

/**
 * Search Console Service
 * Returns mock implementation if USE_MOCK_GOOGLE_APIS=true, otherwise returns real implementation
 */
export const searchConsoleService = config.useMockGoogleApis
  ? SearchConsoleServiceMock
  : SearchConsoleServiceReal;

// Re-export types from real services
export type { GoogleAdsQuery } from './google-ads.service.js';
export type { SearchConsoleQuery } from './search-console.service.js';
