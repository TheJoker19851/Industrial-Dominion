# Supabase Scaffold

This folder contains the local Supabase project scaffold for Industrial Dominion.

## Purpose

- `config.toml` defines the local Supabase services used during development.
- `migrations/` stores versioned SQL schema changes.
- `policies/` stores SQL policy definitions and supporting notes.
- `seeds/` stores repeatable seed inputs for local and staging environments.
- `.env.example` lists the Supabase-specific placeholders needed by local tooling and backend integration.

## Local workflow

1. Copy `supabase/.env.example` values into your local environment as needed.
2. Start the local Supabase stack with the Supabase CLI.
3. Apply migrations from `supabase/migrations`.
4. Load seed data only when a task requires it.

Keep schema changes in migrations and avoid editing production data structures manually.
