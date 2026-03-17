# Industrial Dominion — Ultimate Final Pack

This is the current source of truth for the project.

## Final stack

Frontend

- React
- Vite
- TypeScript
- Tailwind
- Hosting: Vercel

Backend

- Fastify + TypeScript
- Hosting: Railway

Platform

- Supabase (Postgres, Auth, Realtime, Storage)

Payments

- Stripe

Languages

- English
- French

## Device strategy

V1 must be fully playable on mobile for core gameplay loops.
Advanced analytics and dense management screens may remain desktop-first.

## Key principle

The Fastify backend is the authoritative game engine.
Supabase provides the platform services (DB/Auth/Realtime).
