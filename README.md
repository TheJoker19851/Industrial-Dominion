# Industrial Dominion

Browser-first economic MMO monorepo.

## Stack

- Frontend: React + Vite + TypeScript + Tailwind on Vercel
- Backend: Fastify + TypeScript on Railway
- Platform: Supabase (Postgres, Auth, Realtime, Storage)
- Payments: Stripe
- i18n: English + French from day one

## Quick start

1. Copy `/docs` from the final pack if needed or use the included docs.
2. Install dependencies with `pnpm install`
3. Set environment variables using:
   - `apps/web/.env.example`
   - `apps/api/.env.example`
   - `supabase/.env.example`
4. Run `pnpm verify:env` after exporting the required variables
5. Run `pnpm dev`

## Deployment

- Backend deploys to Railway from this shared monorepo.
- The API service baseline lives in `apps/api/railway.json` with workspace-aware build and start commands plus a `/health` healthcheck.
- If Railway does not auto-detect the config file for the API service, point the service config path to `/apps/api/railway.json`.
- Set backend variables in Railway from `apps/api/.env.example`, and keep staging and production values isolated per environment.
- Frontend deploys to Vercel from the same repository with the project Root Directory set to `apps/web`.
- The web deployment baseline lives in `apps/web/vercel.json` and includes the SPA rewrite required for React Router deep links on Vite.
- Set frontend variables in Vercel from `apps/web/.env.example`, and keep staging and production environments separate from Railway and from each other.

## Important

Core game logic belongs in `apps/api`, not in the client.
