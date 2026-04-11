# BACKEND_DECISION.md

## Final decision

Use:

- Fastify backend
- Railway for backend hosting
- Supabase Postgres
- Supabase Auth
- Supabase Realtime
- Stripe

## Guiding principle

The game backend is not “just Supabase”.
Supabase is the platform layer.
Fastify is the authoritative game engine.

## Why Railway

- simple deployment flow
- easy environment variable management
- good fit for a single Fastify service at startup
- easy to evolve before heavier infra is needed
