export const config = {
  env: process.env.NODE_ENV ?? 'development',
  port: Number(process.env.PORT ?? 3001),
  databaseUrl: process.env.DATABASE_URL ?? '',
  redisUrl: process.env.UPSTASH_REDIS_URL ?? '',
  redisToken: process.env.UPSTASH_REDIS_TOKEN ?? '',
  jwtSecret: process.env.JWT_SECRET ?? 'secret',
  cookieSecret: process.env.COOKIE_SECRET ?? 'cookie-secret',
  frontendUrl: process.env.FRONTEND_URL ?? 'http://localhost:5173',
  anthropicKey: process.env.ANTHROPIC_API_KEY ?? '',
  kms: {
    region: process.env.AWS_REGION ?? 'ap-southeast-2',
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    keyId: process.env.KMS_KEY_ID
  },
  featureFlags: {
    useMockGoogleApis: process.env.USE_MOCK_GOOGLE_APIS === 'true',
    runScheduler: process.env.RUN_SCHEDULER !== 'false'
  }
};
