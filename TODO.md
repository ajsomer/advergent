# Advergent TODO List

## Immediate Issues
- [ ] Review and fix Search Console clickable actions not working

## Week 2 – Google OAuth & Data Sync
- [ ] Implement OAuth credential flow for Google Ads/Search Console
- [ ] Implement token encryption service (environment-based)
- [ ] Build Google Ads + Search Console service skeletons
- [ ] Create mock services + fixtures for offline dev

## Week 3 – Query Matching & AI
- [ ] Implement query normalization + hashing
- [ ] Build Claude integration with Zod validation
- [ ] Implement recommendation storage with encrypted snapshots

## Week 4 – Workers & Scheduling
- [ ] Integrate BullMQ + Upstash Redis
- [ ] Build distributed scheduler with leader election
- [ ] Create sync worker, analysis worker, competitor worker
- [ ] Configure Render worker deployment with RUN_SCHEDULER flag

## Week 5 – Frontend MVP
- [ ] Build onboarding flow, dashboards, recommendation list/detail
- [ ] Hook up TanStack Query + API client interceptors
- [ ] Implement approve/reject recommendation actions

## Week 6 – Polish & Deploy
- [ ] Add error handling, skeleton states, toasts
- [ ] Build and deploy to Render (web/api/worker)
- [ ] Wire Neon + Upstash + Clerk production environments
- [ ] Run smoke tests with real Google accounts

## Completed
- [x] Initialize monorepo + workspaces
- [x] Scaffold Vite frontend, Express backend
- [x] Configure ESLint/Prettier, Pino logging
- [x] Connect to Neon Postgres with Drizzle ORM
- [x] Integrate Clerk authentication (signup/login, organizations, webhooks)
- [x] Protected routes + Clerk middleware
- [x] Fix Upstash Redis connection issue (IORedis configuration)
- [x] Fix worker build issue - add .js extensions to imports for ES modules
