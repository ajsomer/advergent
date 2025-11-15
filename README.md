# Advergent

Advergent is an SEO-PPC optimization platform for agencies. This repo is a monorepo housing the React frontend, Express API, and shared packages described in `PROMPT.md`.

## Structure

- `apps/web` – React + Vite frontend scaffold
- `apps/api` – Express + TypeScript backend scaffold
- `packages/shared` – Shared types and utilities
- `docker-compose.yml` – Local Postgres + Redis for development
- `render.yaml` – Render deployment manifest
- `PROMPT.md` – Full implementation brief for future automation/agents

## Getting Started

1. Install dependencies
   ```bash
   npm install
   ```
2. Copy environment examples and update values.
   ```bash
   cp apps/api/.env.example apps/api/.env
   cp apps/web/.env.example apps/web/.env
   ```
3. Start the local dev stack (Postgres + Redis):
   ```bash
   docker-compose up -d
   ```
4. Run both apps:
   ```bash
   npm run dev
   ```

See `PROMPT.md` for the full build roadmap.
