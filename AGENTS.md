# Repository Guidelines

## Project Structure & Module Organization
- `apps/web`: Vite/React frontend. Organize UI by feature folders (auth, onboarding, dashboard, etc.). Shared hooks live in `src/hooks`, API helpers in `src/lib`, and pages in `src/pages`.
- `apps/api`: Express/TypeScript backend. Routes under `src/routes`, services/orchestrators under `src/services`, middleware in `src/middleware`, and BullMQ workers inside `src/workers`. Database helpers reside in `src/db`.
- `packages/shared`: Cross-cutting types and utilities imported by both apps. Publish any shared models here before duplicating.
- Infra/config roots include `docker-compose.yml` (local Postgres + Redis), `render.yaml` (deployment), and `PROMPT.md` (full build brief). Keep secrets in `.env` files only.

## Build, Test, and Development Commands
- `npm install`: Installs all workspace dependencies.
- `npm run dev`: Runs both web (`apps/web`) and API (`apps/api`) in watch mode via `concurrently`.
- `npm run dev:web` / `npm run dev:api`: Start only the frontend or backend.
- `npm run build`: Executes each workspace build (Vite bundle, `tsc` for API/shared).
- `npm run type-check`, `npm run lint`: Delegates to workspace-level scripts.
- Spin up local services with `docker-compose up -d`.

## Coding Style & Naming Conventions
- TypeScript everywhere; strict mode enabled. Prefer composable modules over monoliths—split files approaching 500 lines into hooks/orchestrators/services.
- Naming: `camelCase` for variables/functions, `PascalCase` for React components, `snake_case` only inside SQL or env keys.
- Formatting via workspace-specific ESLint + Prettier configs; Tailwind used on the web app. Log using Pino utilities (`logger`, `log`) rather than `console`.

## Testing Guidelines
- Unit tests expected for non-trivial services (query matching, encryption, AI parsing). Favor Jest/Vitest for frontend and backend as needed; ensure mocks cover external APIs.
- Place tests adjacent to source (`*.test.ts`) or in `__tests__` folders. Aim for meaningful coverage on business-critical paths before PR approval.

## Commit & Pull Request Guidelines
- Commits should be scoped and descriptive (e.g., `feat(api): add recommendation worker`). Avoid bundling unrelated changes.
- PRs must include: summary, testing evidence (command output or screenshots), and references to issues/spec sections (e.g., `PROMPT.md`). Highlight migrations or env variable changes explicitly.
- Request review when CI/lint/type-check pass locally; attach screenshots for UI work and link any relevant dashboards for infra updates.
