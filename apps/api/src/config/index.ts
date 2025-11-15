export const config = {
  env: process.env.NODE_ENV ?? 'development',
  port: Number(process.env.PORT ?? 3001),
  databaseUrl: process.env.DATABASE_URL ?? '',
  redisUrl: process.env.UPSTASH_REDIS_URL ?? '',
  redisToken: process.env.UPSTASH_REDIS_TOKEN ?? '',
  jwtSecret: process.env.JWT_SECRET ?? 'secret',
  cookieSecret: process.env.COOKIE_SECRET ?? 'cookie-secret',
  encryptionMasterKey: process.env.ENCRYPTION_MASTER_KEY ?? '',
  frontendUrl: process.env.FRONTEND_URL ?? 'http://localhost:5173',
  anthropicKey: process.env.ANTHROPIC_API_KEY ?? '',
  google: {
    clientId: process.env.GOOGLE_CLIENT_ID ?? '',
    clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? '',
    redirectUri: process.env.GOOGLE_REDIRECT_URI ?? 'http://localhost:3001/api/google/callback',
    adsDevToken: process.env.GOOGLE_ADS_DEVELOPER_TOKEN ?? ''
  },
  resend: {
    apiKey: process.env.RESEND_API_KEY ?? ''
  },
  featureFlags: {
    useMockGoogleApis: process.env.USE_MOCK_GOOGLE_APIS === 'true',
    runScheduler: process.env.RUN_SCHEDULER !== 'false'
  }
};
