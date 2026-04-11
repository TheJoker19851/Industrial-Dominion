# ENV_SETUP.md

## Frontend env

- VITE_API_BASE_URL
- VITE_SUPABASE_URL
- VITE_SUPABASE_ANON_KEY
- VITE_DEFAULT_LOCALE=en

## Backend env

- NODE_ENV=development
- PORT=3000
- SUPABASE_URL
- SUPABASE_ANON_KEY
- SUPABASE_SERVICE_ROLE_KEY
- SUPABASE_DB_URL
- STRIPE_SECRET_KEY
- STRIPE_WEBHOOK_SECRET
- APP_BASE_URL
- CORS_ORIGIN

## Railway notes

- set backend env vars in Railway
- never expose service role key to frontend

## Local startup order

1. install dependencies
2. configure env files
3. run database migrations
4. run seed script if needed
5. start backend
6. start frontend
