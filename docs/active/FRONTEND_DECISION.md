# FRONTEND_DECISION.md

## Final decision

Frontend hosting: Vercel

## Why Vercel

- excellent Vite support
- fast global CDN
- preview deployments
- easy env var management
- strong Git integration
- simple frontend deployment flow

## Role of Vercel

Vercel only hosts the frontend.

Architecture:
Frontend (Vercel)
↓
Fastify Backend API (Railway)
↓
Supabase (Postgres / Auth / Realtime / Storage)

## Important rule

The frontend must never:

- compute economic results
- modify economic state directly
- bypass backend validation

All critical gameplay mutations go through the backend.
