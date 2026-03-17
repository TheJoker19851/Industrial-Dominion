# ENVIRONMENTS.md

## Required environments

- local development
- staging
- production

## Rules

1. Never point local development at production secrets.
2. Production must use its own Supabase project.
3. Staging should mirror production structure as much as possible.
4. Stripe test and live keys must stay separated.
5. Railway and Vercel environments should be separated by environment.
