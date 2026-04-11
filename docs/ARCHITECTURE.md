# ARCHITECTURE.md

## Final architecture

### Stack summary

- Frontend: React + Vite + TypeScript + Tailwind (Vercel)
- Backend: Fastify + TypeScript (Railway)
- Platform: Supabase (Postgres, Auth, Realtime, Storage)
- Payments: Stripe
- Localization: react-i18next (EN/FR)
- Device support: responsive web, mobile-playable core loop

Frontend

- React
- Vite
- TypeScript
- Tailwind
- TanStack Query
- Framer Motion
- Recharts
- React Flow
- react-i18next
- responsive design for mobile and desktop
- hosted on Vercel

Backend

- Fastify
- TypeScript
- route schemas
- service layer
- repository layer
- scheduled jobs / workers
- hosted on Railway

Platform Services

- Supabase Postgres
- Supabase Auth
- Supabase Realtime
- Supabase Storage

Payments

- Stripe

## Data flow

Player
↓
Vercel Frontend
↓
Fastify API (Railway)
↓
Supabase Postgres

Realtime updates
↓
Supabase Realtime
↓
Frontend UI updates

## Responsibilities

Frontend

- UI
- player inputs
- realtime subscriptions
- translations
- locale-aware formatting
- responsive layouts

Backend (Fastify)

- authoritative game logic
- economy calculations
- validation
- rate limiting
- audit logging
- contract execution
- market settlement
- event engine

Supabase

- database
- auth
- realtime
- file storage
- migrations

## Responsive strategy

Core flows must work on phone screens:

- onboarding
- dashboard
- claim production
- inventory view
- basic market sell/buy
- news feed
- private messaging
- corporation chat
- basic building management

Advanced dense screens may be desktop-first:

- deep analytics
- complex comparison dashboards
- advanced market depth screens
