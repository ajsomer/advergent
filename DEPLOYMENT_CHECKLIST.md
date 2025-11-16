# Advergent Deployment Checklist

This checklist will guide you through deploying Advergent to Render step-by-step.

## Pre-Deployment Verification

### ✅ Build Verification (Completed)
- [x] API builds successfully (`npm run build` in apps/api)
- [x] Frontend builds successfully (`npm run build` in apps/web)
- [x] Health endpoint exists at `/api/health`
- [x] Worker entry point exists at `apps/api/src/workers/index.js`
- [x] `render.yaml` configuration file created

### Environment Variables Collected

You'll need these environment variables for deployment. Based on your local `.env` file:

#### API & Worker Services (both need these):
- `DATABASE_URL`: `postgresql://neondb_owner:npg_jxuVCRN0qQ3l@ep-floral-sun-a7j72kzr-pooler.ap-southeast-2.aws.neon.tech/neondb?sslmode=require`
- `UPSTASH_REDIS_URL`: `https://natural-gopher-32022.upstash.io`
- `UPSTASH_REDIS_TOKEN`: `AX0WAAIncDI2MTA5Y2I0NzE0ZDg0ZDI2ODAyYjMyNzRhNjBiMGEyN3AyMzIwMjI`
- `CLERK_PUBLISHABLE_KEY`: `pk_test_bm9ybWFsLXJhcHRvci04OC5jbGVyay5hY2NvdW50cy5kZXYk`
- `CLERK_SECRET_KEY`: `sk_test_wuz39Y6i6lAoVKhGtRFf3TcArviYrvW1v8y8lUEOsM`
- `CLERK_WEBHOOK_SECRET`: `whsec_padgx8k9fNivbjDN36rn8fEu8kfE0rkH`
- `GOOGLE_CLIENT_ID`: `1091129446858-3q3t6jdnd00utvp9uealbktq6e6d1kp7.apps.googleusercontent.com`
- `GOOGLE_CLIENT_SECRET`: `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`
- `GOOGLE_ADS_DEVELOPER_TOKEN`: `fFQfLwXq76QExj_cVtuApA`
- `ANTHROPIC_API_KEY`: `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`
- `AWS_ACCESS_KEY_ID`: (you'll need to add this)
- `AWS_SECRET_ACCESS_KEY`: (you'll need to add this)
- `KMS_KEY_ID`: (you'll need to add this)

#### Frontend Service:
- `VITE_CLERK_PUBLISHABLE_KEY`: `pk_test_bm9ybWFsLXJhcHRvci04OC5jbGVyay5hY2NvdW50cy5kZXYk`

---

## Deployment Steps

### Step 1: Push Code to GitHub ⏳

```bash
# Commit the render.yaml file
git add render.yaml
git commit -m "Add Render deployment configuration"

# Commit the build fixes
git add apps/api/src/routes/analysis.routes.ts
git add apps/api/src/routes/clients.routes.ts
git add apps/api/src/test-migrations.ts
git add apps/web/src/components/clients/AnalysisRunForm.tsx
git add apps/web/src/pages/SelectAccount.tsx
git commit -m "Fix TypeScript build errors for production deployment"

# Push to GitHub
git push origin main
```

### Step 2: Create Render Blueprint 🚀

1. Go to [Render Dashboard](https://dashboard.render.com/)
2. Click **"New"** → **"Blueprint"**
3. Connect your GitHub repository
4. Render will detect `render.yaml` automatically
5. Click **"Apply"**

Render will create three services:
- `advergent-api` (Web Service)
- `advergent-worker` (Background Worker)
- `advergent` (Static Site)

### Step 3: Configure Environment Variables 🔐

#### For `advergent-api` service:

Go to the service settings and add these environment variables:

```
DATABASE_URL = <your-neon-connection-string>
UPSTASH_REDIS_URL = https://natural-gopher-32022.upstash.io
UPSTASH_REDIS_TOKEN = <your-token>
CLERK_PUBLISHABLE_KEY = pk_test_bm9ybWFsLXJhcHRvci04OC5jbGVyay5hY2NvdW50cy5kZXYk
CLERK_SECRET_KEY = <your-clerk-secret>
CLERK_WEBHOOK_SECRET = whsec_padgx8k9fNivbjDN36rn8fEu8kfE0rkH
GOOGLE_CLIENT_ID = 1091129446858-3q3t6jdnd00utvp9uealbktq6e6d1kp7.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET = <your-google-secret>
GOOGLE_ADS_DEVELOPER_TOKEN = fFQfLwXq76QExj_cVtuApA
ANTHROPIC_API_KEY = <your-anthropic-key>
AWS_ACCESS_KEY_ID = <your-aws-key>
AWS_SECRET_ACCESS_KEY = <your-aws-secret>
KMS_KEY_ID = <your-kms-key>
```

#### For `advergent-worker` service:

Add the same environment variables as the API service.

#### For `advergent` (frontend) service:

```
VITE_CLERK_PUBLISHABLE_KEY = pk_test_bm9ybWFsLXJhcHRvci04OC5jbGVyay5hY2NvdW50cy5kZXYk
```

### Step 4: Run Database Migrations 📊

Once the API service is deployed, run migrations on your Neon database:

```bash
# From your local machine
export DATABASE_URL="<your-neon-production-url>"
cd apps/api
npm run db:push
```

### Step 5: Update Clerk Configuration 🔑

1. Go to [Clerk Dashboard](https://dashboard.clerk.com/)
2. Select your application
3. Go to **API Keys** → **Allowed Origins**
4. Add: `https://advergent.onrender.com`
5. Go to **Webhooks**
6. Create a new webhook endpoint: `https://advergent-api.onrender.com/api/webhooks/clerk`
7. Select events: `user.created`, `user.updated`, `organization.created`, `organization.updated`

### Step 6: Update Google OAuth Configuration 🔐

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Navigate to **APIs & Services** → **Credentials**
3. Select your OAuth 2.0 Client ID
4. Add to **Authorized redirect URIs**:
   - `https://advergent-api.onrender.com/api/google/callback`
5. Add to **Authorized JavaScript origins**:
   - `https://advergent.onrender.com`
6. Click **Save**

### Step 7: Verify Deployment ✅

#### Check Services Status
- [ ] `advergent-api` is **Live**
- [ ] `advergent-worker` is **Live**
- [ ] `advergent` (frontend) is **Live**

#### Test Health Endpoint
```bash
curl https://advergent-api.onrender.com/api/health
# Expected: {"status":"ok","timestamp":"2025-11-16T..."}
```

#### Test Frontend
- [ ] Visit `https://advergent.onrender.com`
- [ ] Homepage loads correctly
- [ ] Can click "Sign In" and Clerk modal appears

#### Test Authentication
- [ ] Sign up with a new account
- [ ] Verify you can log in
- [ ] Check that user is created in Neon database

#### Test Worker
- [ ] Check `advergent-worker` logs in Render dashboard
- [ ] Look for: "Worker started" or similar message
- [ ] Verify Redis connection succeeds

### Step 8: Test Core Features 🧪

#### Create Client
- [ ] Log in to the app
- [ ] Navigate to "Add Client"
- [ ] Fill in client details
- [ ] Click "Create Client"
- [ ] Verify client appears in dashboard

#### Connect Google Ads
- [ ] Click on a client
- [ ] Click "Connect Google Ads"
- [ ] Complete OAuth flow
- [ ] Verify you're redirected back to the app
- [ ] Check that `google_ads_refresh_token_encrypted` is stored in database

#### Connect Search Console
- [ ] Click "Connect Search Console"
- [ ] Complete OAuth flow
- [ ] Verify you're redirected back to the app
- [ ] Check that `search_console_refresh_token_encrypted` is stored in database

#### Test Data Sync
- [ ] Click "Refresh Data" button on client detail page
- [ ] Check worker logs for sync job processing
- [ ] Wait for sync to complete (~30 seconds)
- [ ] Verify Search Console data appears in the table
- [ ] Click on a query row to expand details
- [ ] Verify you see: Page, Device, Country, Search Type, Search Appearance

#### Test AI Analysis
- [ ] Click "Run Analysis" button
- [ ] Wait for analysis to complete
- [ ] Verify recommendations appear
- [ ] Check that recommendations have:
   - Recommendation type (reduce/pause/increase/maintain)
   - Confidence level (high/medium/low)
   - Spend amounts
   - Reasoning

---

## Troubleshooting

### Build Fails on Render

**Symptom**: Deployment fails during build step

**Check**:
1. Look at build logs in Render dashboard
2. Verify `package.json` has correct `build` script
3. Try building locally: `npm run build`
4. Check Node version matches (should be 20+)

### Database Connection Errors

**Symptom**: API logs show database connection errors

**Check**:
1. Verify `DATABASE_URL` is set correctly
2. Ensure connection string includes `?sslmode=require`
3. Check Neon database is not paused (free tier auto-pauses)
4. Verify IP whitelist allows Render's IPs

### Worker Not Processing Jobs

**Symptom**: Sync jobs queued but not processed

**Check**:
1. Check `advergent-worker` logs in Render dashboard
2. Verify `RUN_SCHEDULER=true` is set on worker (not API)
3. Verify `UPSTASH_REDIS_URL` and `UPSTASH_REDIS_TOKEN` are correct
4. Check Redis connection in worker logs

### Clerk Authentication Fails

**Symptom**: Can't sign in or sign up

**Check**:
1. Verify frontend URL is in Clerk allowed origins
2. Check `CLERK_PUBLISHABLE_KEY` matches on frontend and backend
3. Verify `CLERK_SECRET_KEY` is set on API
4. Check browser console for errors

### Google OAuth Redirect Fails

**Symptom**: OAuth flow redirects to error page

**Check**:
1. Verify redirect URI is exact: `https://advergent-api.onrender.com/api/google/callback`
2. Check Google Cloud Console → Credentials → Authorized redirect URIs
3. Verify `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` are correct
4. Check API logs for OAuth errors

### Search Console Table Rows Not Clickable

**Symptom**: Can't expand query rows to see dimensions

**Check**:
1. Verify migration added columns: `page`, `device`, `country`, `search_appearance`, `search_type`
2. Run query: `SELECT page, device, country FROM search_console_queries LIMIT 5`
3. Check sync worker fetched data with all 7 dimensions
4. Look for JavaScript errors in browser console
5. Verify `SearchConsoleTable.tsx` has click handlers attached

---

## Post-Deployment Monitoring

### Key Metrics to Monitor

1. **API Response Times**
   - Should be < 1 second for most requests
   - Check in Render dashboard → Metrics

2. **Worker Queue Depth**
   - Should stay close to 0
   - If growing, consider upgrading worker plan

3. **Database Performance**
   - Monitor query times in Neon dashboard
   - Check connection pool usage

4. **Sync Job Success Rate**
   - Should be ~100%
   - Check worker logs for failures

5. **Claude API Usage**
   - Monitor costs in Anthropic dashboard
   - Track analysis request count

### Logs Access

- **API Logs**: Render Dashboard → advergent-api → Logs
- **Worker Logs**: Render Dashboard → advergent-worker → Logs
- **Frontend Logs**: Browser console (F12)
- **Database Logs**: Neon Dashboard → Operations

---

## Scaling Guide

### When to Scale Up

#### API Service
Upgrade from **Starter** to **Standard** when:
- Response times consistently > 1s
- CPU usage > 80%
- Handling > 10 concurrent clients
- Cost: $7/month → $21/month

#### Worker Service
Upgrade from **Starter** to **Standard** when:
- Sync jobs take > 5 minutes
- Queue depth growing
- Multiple clients syncing simultaneously
- Cost: $7/month → $21/month

#### Database
Upgrade Neon plan when:
- Storage > 500MB (free tier limit)
- Query performance degrades
- Need more concurrent connections
- Cost: Free → $19/month (Pro plan)

---

## Cost Estimate

### Initial Monthly Costs

| Service | Plan | Cost |
|---------|------|------|
| Render API | Starter | $7/month |
| Render Worker | Starter | $7/month |
| Render Frontend | Static | Free |
| Neon Database | Free | $0 (up to 500MB) |
| Upstash Redis | Free | $0 (up to 10K commands/day) |
| Clerk Auth | Free | $0 (up to 10K MAU) |
| Anthropic Claude | Pay-as-you-go | ~$10-30/month |
| **Total** | | **$24-44/month** |

### At Scale (50 clients, high usage)

| Service | Plan | Cost |
|---------|------|------|
| Render API | Standard Plus | $85/month |
| Render Worker | Standard | $21/month |
| Render Frontend | Static | Free |
| Neon Database | Pro | $19/month |
| Upstash Redis | Pay-as-you-go | ~$10/month |
| Clerk Auth | Pro | $25/month |
| Anthropic Claude | Pay-as-you-go | ~$100-200/month |
| **Total** | | **$260-360/month** |

---

## Success Criteria

Deployment is successful when:

- [ ] All three services (API, Worker, Frontend) are **Live** on Render
- [ ] Health endpoint returns `{"status":"ok"}`
- [ ] Can sign up and log in via Clerk
- [ ] Can create clients and view dashboard
- [ ] Google Ads OAuth flow works end-to-end
- [ ] Search Console OAuth flow works end-to-end
- [ ] Data sync populates database with query data
- [ ] Search Console table shows dimensional data (page, device, country, etc.)
- [ ] Query rows are clickable and expand correctly
- [ ] AI analysis generates recommendations
- [ ] Worker processes jobs without errors
- [ ] No errors in API, Worker, or Frontend logs

---

## Support & Resources

- **Render Docs**: https://render.com/docs
- **Neon Docs**: https://neon.tech/docs
- **Clerk Docs**: https://clerk.com/docs
- **Upstash Docs**: https://upstash.com/docs
- **Anthropic Docs**: https://docs.anthropic.com/

---

**Last Updated**: 2025-11-16

**Important**: Keep this checklist updated as you deploy and encounter issues. Document any additional steps or gotchas for future deployments.
