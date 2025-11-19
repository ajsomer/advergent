# Project: Advergent

## Project Overview

Advergent is a full SaaS platform that helps digital marketing agencies optimize their clients' Google Ads spend by identifying overlap with organic search rankings and delivering AI-powered recommendations. This is a monorepo containing the React frontend, Express API, and shared packages.

**Key Technologies:**

*   **Frontend:** React, Vite, TypeScript, Tailwind CSS, shadcn/ui, TanStack Query, React Router
*   **Backend:** Node.js, Express, TypeScript, Drizzle ORM, Clerk (authentication)
*   **Database:** Neon Postgres
*   **External APIs:** Google Ads, Google Search Console, Anthropic Claude Sonnet 4
*   **Infrastructure:** Render, Docker

## Building and Running

### Prerequisites

*   Node.js (v20+)
*   Docker

### Getting Started

1.  **Install dependencies:**
    ```bash
    npm install
    ```

2.  **Copy environment examples and update values:**
    ```bash
    cp apps/api/.env.example apps/api/.env
    cp apps/web/.env.example apps/web/.env
    ```
    *Note: You will need to populate the `.env` files with your own credentials for services like Clerk, Google, and Neon.*

3.  **Start the local development stack (Postgres):**
    ```bash
    docker-compose up -d
    ```

4.  **Run both apps in development mode:**
    ```bash
    npm run dev
    ```
    This will start the API server on `http://localhost:3001` and the web server on `http://localhost:5173`.

### Other Commands

*   **Build for production:**
    ```bash
    npm run build
    ```

*   **Run linters:**
    ```bash
    npm run lint
    ```

*   **Run type checking:**
    ```bash
    npm run type-check
    ```

*   **Database migrations (API):**
    ```bash
    # Generate a new migration
    npm run db:generate --workspace=api

    # Apply migrations
    npm run db:migrate --workspace=api
    ```

## Development Conventions

*   **Monorepo:** The project is structured as a monorepo using npm workspaces. The `apps` directory contains the `web` (frontend) and `api` (backend) applications. The `packages` directory contains shared code.
*   **TypeScript:** The entire codebase is written in TypeScript with strict mode enabled.
*   **Coding Style:** The project uses ESLint and Prettier to enforce a consistent coding style.
*   **Logging:** The project uses Pino for structured logging on both the frontend and backend.
*   **Authentication:** Authentication is handled by Clerk.
*   **Validation:** Zod is used for data validation on both the frontend and backend.
*   **Mocking:** The backend includes mock services for Google APIs to facilitate development without requiring real credentials. This is controlled by the `USE_MOCK_GOOGLE_APIS` feature flag in `apps/api/.env`.
