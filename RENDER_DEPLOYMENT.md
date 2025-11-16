# Render Deployment Guide for Advergent

This guide will help you deploy the Advergent SEO-PPC optimization platform to Render.

## Project Overview

Advergent is a monorepo with:
- **Frontend**: React + Vite app (`apps/web`)
- **Backend API**: Express + TypeScript (`apps/api`)
- **Worker Process**: BullMQ worker for background jobs (`apps/api/src/workers`)
- **Database**: Neon Postgres (with Drizzle ORM)
- **Queue**: Upstash Redis (for BullMQ)
- **Auth**: Clerk
- **AI**: Anthropic Claude API

## Prerequisites

Before deploying to Render, ensure you have:

1. **Neon Database** - Create a Neon Postgres database and get the connection string
2. **Upstash Redis** - Create an Upstash Redis instance and get URL + token
3. **Clerk Account** - Set up Clerk authentication and get API keys
4. **Anthropic API Key** - Get Claude API key from Anthropic
5. **Google OAuth Credentials** - Set up Google OAuth app for Ads & Search Console access
6. **AWS KMS** - Set up KMS for token encryption (optional for MVP, can use placeholder)

## Step 1: Database Migration

Before deploying, run migrations on your Neon database:

```bash
cd apps/api
export DATABASE_URL="your-neon-connection-string"
npm run db:push
```

This will create all necessary tables including the new Search Console columns (page, device, country, search_appearance, search_type).

## Step 2: Create Render Blueprint

Create a `render.yaml` file in the project root:

```yaml
services:
  # Web API Service
  - type: web
    name: advergent-api
    runtime: node
    region: oregon
    plan: starter
    buildCommand: cd apps/api && npm install && npm run build
    startCommand: cd apps/api && node dist/server.js
    envVars:
      - key: NODE_ENV
        value: production
      - key: PORT
        value: 3001
      - key: DATABASE_URL
        sync: false
      - key: UPSTASH_REDIS_URL
        sync: false
      - key: UPSTASH_REDIS_TOKEN
        sync: false
      - key: CLERK_PUBLISHABLE_KEY
        sync: false
      - key: CLERK_SECRET_KEY
        sync: false
      - key: CLERK_WEBHOOK_SECRET
        sync: false
      - key: FRONTEND_URL
        value: https://advergent.onrender.com
      - key: GOOGLE_CLIENT_ID
        sync: false
      - key: GOOGLE_CLIENT_SECRET
        sync: false
      - key: GOOGLE_REDIRECT_URI
        value: https://advergent-api.onrender.com/api/google/callback
      - key: GOOGLE_ADS_DEVELOPER_TOKEN
        sync: false
      - key: ANTHROPIC_API_KEY
        sync: false
      - key: AWS_REGION
        value: ap-southeast-2
      - key: AWS_ACCESS_KEY_ID
        sync: false
      - key: AWS_SECRET_ACCESS_KEY
        sync: false
      - key: KMS_KEY_ID
        sync: false
      - key: USE_MOCK_GOOGLE_APIS
        value: false
      - key: RUN_SCHEDULER
        value: false
    healthCheckPath: /api/health

  # Background Worker Service
  - type: worker
    name: advergent-worker
    runtime: node
    region: oregon
    plan: starter
    buildCommand: cd apps/api && npm install && npm run build
    startCommand: cd apps/api && node dist/workers/index.js
    envVars:
      - key: NODE_ENV
        value: production
      - key: DATABASE_URL
        sync: false
      - key: UPSTASH_REDIS_URL
        sync: false
      - key: UPSTASH_REDIS_TOKEN
        sync: false
      - key: CLERK_PUBLISHABLE_KEY
        sync: false
      - key: CLERK_SECRET_KEY
        sync: false
      - key: GOOGLE_CLIENT_ID
        sync: false
      - key: GOOGLE_CLIENT_SECRET
        sync: false
      - key: GOOGLE_ADS_DEVELOPER_TOKEN
        sync: false
      - key: ANTHROPIC_API_KEY
        sync: false
      - key: AWS_REGION
        value: ap-southeast-2
      - key: AWS_ACCESS_KEY_ID
        sync: false
      - key: AWS_SECRET_ACCESS_KEY
        sync: false
      - key: KMS_KEY_ID
        sync: false
      - key: RUN_SCHEDULER
        value: true

  # Frontend Static Site
  - type: web
    name: advergent
    runtime: static
    region: oregon
    buildCommand: cd apps/web && npm install && npm run build
    staticPublishPath: apps/web/dist
    envVars:
      - key: VITE_API_URL
        value: https://advergent-api.onrender.com
      - key: VITE_ENV
        value: production
    routes:
      - type: rewrite
        source: /*
        destination: /index.html
```

## Step 3: Deploy to Render

### Option A: Using Render Dashboard

1. Go to [Render Dashboard](https://dashboard.render.com/)
2. Click "New" → "Blueprint"
3. Connect your GitHub repository
4. Render will detect `render.yaml` and create all services
5. Add environment variables (sync: false values) in each service's settings:
   - DATABASE_URL
   - UPSTASH_REDIS_URL
   - UPSTASH_REDIS_TOKEN
   - CLERK_PUBLISHABLE_KEY
   - CLERK_SECRET_KEY
   - CLERK_WEBHOOK_SECRET
   - GOOGLE_CLIENT_ID
   - GOOGLE_CLIENT_SECRET
   - GOOGLE_ADS_DEVELOPER_TOKEN
   - ANTHROPIC_API_KEY
   - AWS_ACCESS_KEY_ID
   - AWS_SECRET_ACCESS_KEY
   - KMS_KEY_ID

### Option B: Using Render CLI

```bash
# Install Render CLI
npm install -g @render/cli

# Login
render login

# Deploy blueprint
render blueprint deploy
```

## Step 4: Post-Deployment Configuration

### 1. Update Clerk Settings
- Add production domain to allowed origins: `https://advergent.onrender.com`
- Add webhook endpoint: `https://advergent-api.onrender.com/api/webhooks/clerk`

### 2. Update Google OAuth
- Add authorized redirect URI: `https://advergent-api.onrender.com/api/google/callback`
- Add authorized JavaScript origins: `https://advergent.onrender.com`

### 3. Verify Services
- Check API health: `https://advergent-api.onrender.com/api/health`
- Check frontend: `https://advergent.onrender.com`
- Check worker logs for BullMQ connection

## Step 5: Test the Deployment

1. **Test Authentication**
   - Visit `https://advergent.onrender.com`
   - Sign up with Clerk
   - Verify you can log in

2. **Test Client Creation**
   - Create a new client
   - Connect Google Ads and Search Console via OAuth

3. **Test Data Sync**
   - Click "Refresh Data" button on client detail page
   - Check worker logs to see sync job processing
   - Verify Search Console data appears with new dimensions (page, device, country, search_appearance, search_type)
   - **IMPORTANT**: Click on a query row in the Search Console table to verify the expandable details work correctly

4. **Test AI Analysis**
   - Run analysis for a client
   - Verify recommendations are generated

## Troubleshooting

### Worker Not Processing Jobs

**Issue**: Sync jobs are queued but not processed

**Solution**:
- Check worker service logs in Render dashboard
- Verify `UPSTASH_REDIS_URL` and `UPSTASH_REDIS_TOKEN` are set correctly
- Ensure `RUN_SCHEDULER=true` only on worker service (not API service)

### Search Console Rows Not Clickable

**Issue**: Query rows in Search Console table don't expand when clicked

**Solution**:
1. Check that the migration added new columns: `page`, `device`, `country`, `search_appearance`, `search_type`
2. Verify sync worker is fetching data with all 7 dimensions
3. Check browser console for JavaScript errors
4. Ensure `SearchConsoleTable.tsx` has the click handler properly attached to `<tr>` elements
5. Test with Chrome DevTools to verify onClick events are firing
6. Check that `hasAdditionalData` logic correctly identifies rows with new dimensional data

**Debug steps**:
```bash
# Check database for new columns
psql $DATABASE_URL -c "SELECT page, device, country, search_appearance, search_type FROM search_console_queries LIMIT 5;"

# Check sync worker logs
# Look for: "Fetching Search Console data" and "Search Console data stored"

# Check frontend console
# Look for: onClick events, expandedQueryId state changes
```

### Database Connection Issues

**Issue**: API can't connect to Neon database

**Solution**:
- Verify `DATABASE_URL` includes `?sslmode=require`
- Check Neon database is not paused (free tier)
- Verify IP whitelist allows Render's IP ranges

### Build Failures

**Issue**: Build fails on Render

**Solution**:
- Check build logs for specific error
- Verify `package.json` has correct build scripts
- Ensure TypeScript compiles without errors locally first
- Check node version matches (`node -v` should be 20+)

## Environment Variables Reference

### API Service

| Variable | Required | Description |
|----------|----------|-------------|
| NODE_ENV | Yes | `production` |
| PORT | Yes | `3001` |
| DATABASE_URL | Yes | Neon Postgres connection string |
| UPSTASH_REDIS_URL | Yes | Upstash Redis URL |
| UPSTASH_REDIS_TOKEN | Yes | Upstash Redis token |
| CLERK_PUBLISHABLE_KEY | Yes | Clerk publishable key |
| CLERK_SECRET_KEY | Yes | Clerk secret key |
| CLERK_WEBHOOK_SECRET | Yes | Clerk webhook secret |
| FRONTEND_URL | Yes | Frontend URL |
| GOOGLE_CLIENT_ID | Yes | Google OAuth client ID |
| GOOGLE_CLIENT_SECRET | Yes | Google OAuth client secret |
| GOOGLE_REDIRECT_URI | Yes | Google OAuth redirect URI |
| GOOGLE_ADS_DEVELOPER_TOKEN | Yes | Google Ads developer token |
| ANTHROPIC_API_KEY | Yes | Claude API key |
| AWS_REGION | Yes | AWS region for KMS |
| AWS_ACCESS_KEY_ID | Yes | AWS access key |
| AWS_SECRET_ACCESS_KEY | Yes | AWS secret key |
| KMS_KEY_ID | Yes | KMS key ID for encryption |
| USE_MOCK_GOOGLE_APIS | No | `false` for production |
| RUN_SCHEDULER | Yes | `false` for API service |

### Worker Service

Same as API service, except:
- `RUN_SCHEDULER` should be `true`

### Frontend Service

| Variable | Required | Description |
|----------|----------|-------------|
| VITE_API_URL | Yes | Backend API URL |
| VITE_ENV | Yes | `production` |

## Monitoring

### Logs
- **API Logs**: Render Dashboard → advergent-api → Logs
- **Worker Logs**: Render Dashboard → advergent-worker → Logs
- **Frontend Logs**: Check browser console

### Key Metrics to Monitor
- Sync job completion rate (should be ~100%)
- API response times
- Worker queue depth (BullMQ)
- Database connection pool usage
- Claude API usage and costs

## Scaling Considerations

### When to Scale Up

1. **API Service**: Upgrade from Starter when:
   - Response times > 1s consistently
   - CPU usage > 80%
   - More than 10 concurrent clients

2. **Worker Service**: Upgrade when:
   - Sync jobs take > 5 minutes
   - Queue depth growing
   - Multiple clients syncing simultaneously

3. **Database**: Upgrade Neon plan when:
   - Storage > 500MB
   - Query performance degrades
   - Need more concurrent connections

## Cost Estimate (Monthly)

- **Render**:
  - API Service (Starter): $7
  - Worker Service (Starter): $7
  - Frontend (Static): Free
- **Neon Database** (Free tier): $0 (up to 500MB)
- **Upstash Redis** (Free tier): $0 (up to 10K commands/day)
- **Clerk** (Free tier): $0 (up to 10K MAU)
- **Anthropic Claude**: Variable (based on usage)

**Total**: ~$14-50/month depending on usage

## Support

For issues specific to:
- **Render**: https://render.com/docs
- **Neon**: https://neon.tech/docs
- **Clerk**: https://clerk.com/docs
- **Upstash**: https://upstash.com/docs

## Critical Post-Deployment Checks

1. ✅ All three services (API, Worker, Frontend) are running
2. ✅ Database migrations applied successfully
3. ✅ Worker is connected to Redis and processing jobs
4. ✅ Search Console sync fetches data with all 7 dimensions
5. ✅ **Query rows in Search Console table are clickable and expand correctly**
6. ✅ OAuth flow works for Google Ads and Search Console
7. ✅ AI analysis generates recommendations
8. ✅ Clerk webhooks are being received

---

**Last Updated**: 2025-11-16

**Important Note**: The Search Console table expandable rows feature is a key part of the UX. After deployment, immediately test this by:
1. Navigate to a client with Search Console connected
2. Click the "Search Console" tab
3. Click on any query row
4. Verify it expands to show: Page, Device, Country, Search Type, and Search Appearance
5. If rows are not clickable, check the troubleshooting section above and review the `SearchConsoleTable.tsx` component implementation.
