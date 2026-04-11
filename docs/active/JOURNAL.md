# JOURNAL.md

## Purpose

Implementation journal for Codex and future contributors.

## Entries

### 2026-03-15 - TASK-001

- Initialized the frontend app shell so `apps/web` has a working Vite entry, Tailwind/PostCSS config, and a coherent routed shell layout.
- Wired the web app to the shared UI package correctly and added the missing React type dependency in `packages/ui`.
- Ran `corepack pnpm typecheck`, `corepack pnpm build`, and `corepack pnpm test`.

### 2026-03-15 - TASK-002

- Replaced placeholder tooling scripts with working ESLint, Prettier, Vitest, and package-level typecheck commands across the workspace.
- Added baseline tests for shared formulas, config defaults, and the Fastify health/root endpoints.
- Fixed the web build so it no longer emits generated JavaScript into `src`, then verified lint, format, typecheck, build, and test all pass.

### 2026-03-15 - TASK-003

- Finalized the Fastify backend workspace in `apps/api` as a minimal runnable service package.
- Added explicit module registration for the root and health routes so the backend shell has a clearer growth path without adding extra infrastructure.
- Ran `corepack pnpm lint`, `corepack pnpm typecheck`, `corepack pnpm build`, and `corepack pnpm test`, plus `corepack pnpm format:write`.

### 2026-03-15 - TASK-004

- Expanded the Supabase scaffold with a fuller local `config.toml`, a Supabase-specific `.env.example`, a scaffold README, and a default seed file placeholder.
- Improved the seed and policy docs and updated the root README to point at all required env example files.
- Replaced the placeholder env verification script with real required-variable checks for web, API, and Supabase setup.

### 2026-03-15 - TASK-005

- Expanded the shared domain model in `packages/shared` with language-neutral starter IDs and core interfaces for player settings, regions, resources, buildings, inventory, world events, and ledger entries.
- Kept the definitions aligned with the project docs for content model, world seed, and ledger requirements.
- Added tests that lock the starter region and starter resource constants to the documented world seed values.

### 2026-03-15 - TASK-006

- Promoted the web i18n setup into a small framework with reusable locale config and resource modules.
- Added a real locale consistency script and a web test that verifies English and French expose the same translation keys.
- Re-ran formatting, lint, typecheck, build, test, and the dedicated `check:i18n` verification step.

### 2026-03-15 - TASK-007

- Added locale-aware formatting helpers and a small formatter hook for number, currency, percentage, and date output in the web app.
- Wired the dashboard placeholders through the new helpers so the formatting layer is exercised in the UI.
- Added locale-formatting unit tests and stabilized date formatting with an explicit UTC timezone for deterministic output.

### 2026-03-15 - TASK-008

- Added persistent language selection using local storage with locale resolution that prefers saved choice, then browser locale, then the configured default.
- Introduced a shared web language-switcher hook and reused it in the shell and settings page to avoid duplicated toggle logic.
- Added tests for locale resolution and toggle behavior, and re-ran formatting, lint, typecheck, build, test, and `check:i18n`.

### 2026-03-15 - TASK-009

- Replaced the placeholder Supabase migration with an initial schema that covers the documented core tables for players, content, economy, messaging, corporations, events, news, ledger, and subscriptions.
- Added conservative constraints, indexes, and starter-region/category checks to keep the schema aligned with the current design without inventing extra systems.
- Enabled row level security across the created tables so later policy work starts from a strict default-deny baseline.

### 2026-03-15 - TASK-010

- Added frontend Supabase auth integration with a shared browser client and auth provider so the web app can observe session state.
- Added a localized settings-panel flow for email magic-link sign-in and sign-out without introducing protected backend behavior yet.
- Added locale persistence/auth config tests and re-ran formatting, lint, typecheck, build, test, and `check:i18n`.

### 2026-03-15 - TASK-011

- Added backend auth verification middleware that reads bearer tokens, verifies them through Supabase, and attaches the authenticated user to the Fastify request.
- Added a minimal protected `/auth/session` route and API tests that cover both unauthorized and valid-token flows.
- Re-ran the required workspace checks: `corepack pnpm lint`, `corepack pnpm typecheck`, `corepack pnpm build`, and `corepack pnpm test`.

### 2026-03-15 - TASK-012

- Replaced the placeholder Supabase seed with repeatable starter inserts for the four documented regions and seven documented raw resources.
- Kept the seed conservative so it only covers the content needed by the next starter-loop tasks and does not pre-scaffold extractor or event systems.
- Added a shared-package test that validates the seed SQL against the documented starter IDs, then re-ran `corepack pnpm lint`, `corepack pnpm typecheck`, `corepack pnpm build`, and `corepack pnpm test`.

### 2026-03-15 - TASK-013

- Added a Railway config-as-code baseline in `apps/api/railway.json` for the Fastify backend using workspace-aware `pnpm` build and start commands.
- Included a `/health` deployment healthcheck, conservative restart policy, and monorepo watch patterns so shared workspace changes can trigger backend redeploys.
- Added an API test that validates the Railway config shape and re-ran `corepack pnpm lint`, `corepack pnpm typecheck`, `corepack pnpm build`, and `corepack pnpm test`.

### 2026-03-15 - TASK-014

- Added a Vercel deployment baseline in `apps/web/vercel.json` for the Vite frontend and included a rewrite for SPA deep links so React Router routes resolve in production.
- Documented that the Vercel project should use `apps/web` as its Root Directory and source frontend variables from `apps/web/.env.example`.
- Added a web test that validates the deployment config shape and re-ran `corepack pnpm lint`, `corepack pnpm typecheck`, `corepack pnpm build`, and `corepack pnpm test`.

### 2026-03-15 - TASK-015

- Refined the web app shell into a shared responsive navigation baseline with a single route config used by both desktop and mobile navigation.
- Added active-state styling for shell navigation and extra main-content spacing so the fixed mobile tab bar does not cover core content.
- Added a lightweight navigation config test and re-ran `corepack pnpm lint`, `corepack pnpm typecheck`, `corepack pnpm build`, and `corepack pnpm test`.

### 2026-03-15 - TASK-020

- Replaced the onboarding placeholder with a fuller region selection screen built from shared starter region IDs and mobile-friendly selection cards.
- Added localized region descriptions plus a selected-region summary panel that previews the next bootstrap steps without implementing backend account setup yet.
- Added an onboarding region-options test, linked the web app to the shared workspace package, and re-ran `corepack pnpm lint`, `corepack pnpm typecheck`, `corepack pnpm build`, and `corepack pnpm test`.

### 2026-03-15 - TASK-021

- Added a backend starter package service that reads starter values from centralized config, checks whether a player has already received the grant, and records the grant in the ledger.
- Kept the starter package conservative to the current schema by applying starter credits and storing plot and warehouse counts in starter-grant metadata for later bootstrap steps.
- Added API unit tests for starter-package idempotency and re-ran `corepack pnpm lint`, `corepack pnpm typecheck`, `corepack pnpm build`, and `corepack pnpm test`.

### 2026-03-15 - TASK-022

- Added authenticated bootstrap endpoints plus backend service logic so player onboarding now creates durable player state, stores region choice, persists player settings, and grants the starter package through the backend.
- Updated the onboarding screen to read bootstrap status from the API and complete the selected region through a React Query mutation instead of local-only preview state.
- Re-ran `corepack pnpm lint`, `corepack pnpm typecheck`, `corepack pnpm build`, and `corepack pnpm test`; local Supabase migration validation was not possible here because the Supabase CLI and Docker are unavailable in this environment.

### 2026-03-15 - TASK-023

- Added a shared starter extractor catalog that defines the first extractor content for each starter region, including output resource and baseline production, maintenance, and energy metadata.
- Seeded the matching extractor building types into Supabase and added aligned English and French locale entries for extractor names and descriptions.
- Added shared tests for extractor catalog alignment and re-ran `corepack pnpm lint`, `corepack pnpm typecheck`, `corepack pnpm build`, `corepack pnpm test`, and `corepack pnpm check:i18n`.

### 2026-03-15 - TASK-024

- Added a protected backend route for placing the first extractor and backed it with a buildings service that validates bootstrap completion, region compatibility, and one-time first placement.
- Reused the shared starter extractor catalog to determine which extractor can be placed for a bootstrapped player and logged the placement in the ledger.
- Added building service tests plus an API route test and re-ran `corepack pnpm lint`, `corepack pnpm typecheck`, `corepack pnpm build`, and `corepack pnpm test`.

### 2026-03-15 - TASK-025

- Expanded the shared economics formulas into production utility helpers for output, maintenance, and energy usage based on the documented level and modifier formulas.
- Added a starter extractor metrics helper that derives a production snapshot directly from the shared starter extractor catalog.
- Added shared formula tests for the new production math and re-ran `corepack pnpm lint`, `corepack pnpm typecheck`, `corepack pnpm build`, and `corepack pnpm test`.

### 2026-03-15 - TASK-026

- Added a protected backend claim-production route that verifies the player owns the placed starter extractor and only claims completed production windows.
- Recorded claimed output in `production_jobs`, incremented the player's inventory on the backend, and logged a `claim_production` ledger entry using shared starter-extractor math.
- Added backend service and route coverage, a small production-job uniqueness migration, and re-ran `corepack pnpm lint`, `corepack pnpm typecheck`, `corepack pnpm build`, and `corepack pnpm test`.

### 2026-03-15 - TASK-027

- Added an authenticated dashboard snapshot endpoint that returns player summary, first extractor status, and current inventory from backend-owned state.
- Replaced the dashboard placeholder with a mobile-friendly MVP that loads live backend data, shows localized inventory/resource names, and lets the player claim ready production.
- Added backend dashboard tests, frontend dashboard-state tests, locale updates, and re-ran `corepack pnpm lint`, `corepack pnpm typecheck`, `corepack pnpm build`, `corepack pnpm test`, and `corepack pnpm check:i18n`.

### 2026-03-15 - TASK-028

- Added a backend market module with an authenticated snapshot route and a quick-sell route that prices inventory at base value, applies the configured market fee, and credits the player on the backend.
- Added an atomic SQL sell function so inventory reduction, credit gain, filled market-order creation, and ledger entries happen together for each sell action.
- Replaced the market placeholder with a mobile-friendly quick-sell screen, added backend and frontend tests, updated locale copy, and re-ran `corepack pnpm lint`, `corepack pnpm typecheck`, `corepack pnpm build`, `corepack pnpm test`, and `corepack pnpm check:i18n`.

### 2026-03-15 - TASK-029

- Added a backend ledger module with an authenticated feed route and extended the dashboard snapshot so recent economic actions can be read without extra frontend scaffolding.
- Surfaced a localized recent-activity panel on the dashboard that reflects starter, production-claim, and market actions already recorded in the ledger.
- Added backend ledger tests, frontend ledger helper tests, updated locale copy, and re-ran `corepack pnpm lint`, `corepack pnpm typecheck`, `corepack pnpm build`, `corepack pnpm test`, and `corepack pnpm check:i18n`.

### 2026-03-15 - TASK-030

- Added a backend system news module, seeded a small starter news feed, and extended the dashboard snapshot so recent news can be read in the same mobile-friendly surface as the rest of the core loop.
- Surfaced a localized system news panel on the dashboard using seeded headline/body translation keys rather than hardcoded copy.
- Added backend news tests, updated dashboard tests and locale copy, and re-ran `corepack pnpm lint`, `corepack pnpm typecheck`, `corepack pnpm build`, `corepack pnpm test`, and `corepack pnpm check:i18n`.

### 2026-03-15 - TASK-031

- Localized the remaining starter gameplay feedback by mapping backend onboarding, dashboard, and market errors to translated gameplay error keys instead of surfacing raw English server messages.
- Kept the change narrow to the existing starter-loop screens and added a small guard test for the gameplay error mapper.
- Re-ran `corepack pnpm lint`, `corepack pnpm typecheck`, `corepack pnpm build`, `corepack pnpm test`, and `corepack pnpm check:i18n`.

### 2026-03-15 - TASK-032

- Tightened the starter loop for small screens by making the fixed mobile navigation safe-area aware and stacking onboarding, dashboard, and market action rows more aggressively on narrow viewports.
- Added a lightweight mobile-layout guard test that checks for the critical responsive protections on the starter-loop screens.
- Re-ran `corepack pnpm lint`, `corepack pnpm typecheck`, `corepack pnpm build`, `corepack pnpm test`, and `corepack pnpm check:i18n`.

### 2026-03-15 - Backlog update for tutorial dependencies

- Marked `TASK-033` as blocked because the requested economic tutorial depends on three missing real gameplay systems: market buy, production transform, and logistics transfer.
- Added `TASK-034`, `TASK-035`, and `TASK-036` as the smallest prerequisite MVP tasks in dependency order, then added `TASK-033A` as a separate near-term tutorial limited to currently implemented real actions.
- Updated `CURRENT_TASK.md` to point at `TASK-034 - Market Buy MVP` as the next unblocked task.

### 2026-03-15 - Backlog correction for immediate tutorial work

- Reordered the tutorial follow-up tasks so `TASK-033A` sits as the immediate near-term onboarding task ahead of the missing gameplay prerequisites.
- Updated `CURRENT_TASK.md` to point at `TASK-033A - Starter Tutorial MVP (Current Real Loop)` while keeping `TASK-033` blocked behind `TASK-034`, `TASK-035`, and `TASK-036`.

### 2026-03-15 - TASK-033A

- Added a conservative starter tutorial system backed by persisted `player_tutorial_progress`, a protected tutorial API, and real progression hooks for starter grant, first extractor placement, production claim, inventory viewing, and first market sale.
- Surfaced the tutorial in the web shell with a mobile-friendly panel, skip support, and a small real dashboard action for placing the first extractor so the guided loop is fully playable in the current app.
- Added backend and shared tests, updated English and French tutorial copy, and re-ran `corepack pnpm lint`, `corepack pnpm typecheck`, `corepack pnpm build`, `corepack pnpm test`, and `corepack pnpm check:i18n`.

### 2026-03-16 - TASK-033B

- Audited MVP coverage across onboarding, structures, production, inventory, market, dashboard/news, regions, auth, UX, and persistence to separate implemented systems from launch-critical gaps.
- Confirmed that the current starter loop is coherent and backend-authoritative, but the broader MVP launch promise is still blocked by three missing real gameplay systems: market buy, production transform, and logistics transfer.
- Added an `MVP Coverage Gaps` section to the backlog, kept the analysis conservative, and updated `CURRENT_TASK.md` to the first true launch-critical gap: `TASK-034 - Market Buy MVP`.

### 2026-03-16 - TASK-034

- Added a conservative market buy MVP using backend-authoritative system offers sourced from tradable resources, an atomic purchase RPC, wallet deduction, inventory grant, and a real `market_purchase` ledger event.
- Extended the market page with a mobile-friendly buy section that shows quantity, total cost, post-purchase balance preview, insufficient-funds errors, and immediate credits/inventory refresh after success.
- Added backend, frontend, and shared coverage for market offers, purchase results, ledger tone handling, and route behavior, then re-ran `corepack pnpm lint`, `corepack pnpm typecheck`, `corepack pnpm build`, `corepack pnpm test`, and `corepack pnpm check:i18n`.

### 2026-03-16 - TASK-034A

- Smoke-tested the current starter loop against the live Supabase development database by running the local Fastify dev server and local Vite web app against the real project, then exercising real bootstrap, dashboard, ledger, first extractor placement, production claim, inventory update, and market sell flows with a live auth user.
- Confirmed the market buy flow also works against the live database when using a real seeded market offer, and verified wallet, inventory, building, production job, and ledger persistence directly in the live database.
- Found one launch-critical issue before `TASK-035`: the built API runtime currently fails under `node dist/server.js` because the emitted ESM entrypoint imports `./app` without a file extension, so I inserted `TASK-034B - Fix API production runtime entrypoint` before the production-transform work.
- Did not complete a fully scripted authenticated mobile browser interaction in this environment; the live web app opened successfully and existing responsive guard coverage remains in place, but the browser automation package was not available as a local project dependency for a clean in-repo scripted pass.

### 2026-03-16 - TASK-034B

- Fixed the API production runtime by switching `apps/api` to `NodeNext`, adding explicit `.js` extensions to API relative imports, and aligning the `shared` and `config` workspace packages with built `dist` entrypoints for Node ESM runtime use.
- Verified the full production path with `corepack pnpm build`, `corepack pnpm typecheck`, and a real `node dist/server.js` startup check that returned `{\"ok\":true,\"service\":\"api\"}` from `/health`.

### 2026-03-17 - TASK-035

- Added a conservative transform-production MVP around a single real recipe, `iron_ore -> iron_ingot`, using the existing building and `production_jobs` model instead of introducing a parallel production system.
- Backed transform start and claim with atomic SQL functions so input inventory consumption, job persistence, output inventory grant, and transform ledger entries stay backend-authoritative and duplication-safe.
- Surfaced the transform flow in the dashboard with mobile-readable start and claim actions, added shared/API/web coverage, and re-ran `corepack pnpm lint`, `corepack pnpm typecheck`, `corepack pnpm build`, `corepack pnpm test`, and `corepack pnpm check:i18n`.

### 2026-03-17 - TASK-035 refinement

- Realigned the first processing flow to a more conservative MVP endpoint, `POST /production/jobs`, where the client sends only `recipeKey` and `runs` while all recipe math and inventory updates remain server-side.
- Added a single instant-complete production recipe, `iron_ingot_from_iron_ore`, backed by an atomic SQL function that validates input inventory, deducts iron ore, adds iron ingots, records a `production_jobs` row, and writes the completion ledger entry in one transaction.
- Replaced the dashboard transform controls with a smaller production panel for this route, added targeted API/shared tests for success, insufficient inventory, and invalid payloads, and re-ran `corepack pnpm lint`, `corepack pnpm typecheck`, `corepack pnpm build`, `corepack pnpm test`, and `corepack pnpm check:i18n`.

### 2026-03-17 - TASK-036

- Added a conservative logistics MVP with player-scoped storage locations, location-aware inventory persistence, an atomic `create_logistics_transfer` SQL function, and a dedicated `logistics_transfers` record table.
- Kept the existing starter loop stable by routing current production and market flows through `primary_storage`, then surfaced a minimal dashboard transfer panel plus transfer ledger visibility for the new flow.
- Added backend route/service coverage, updated dashboard and market state handling, and re-ran `corepack pnpm lint`, `corepack pnpm typecheck`, `corepack pnpm build`, `corepack pnpm test`, and `corepack pnpm check:i18n`; I also made a small Turbo dependency fix so root `pnpm typecheck` now builds upstream shared package outputs before downstream type checks.

### 2026-03-17 - TASK-033

- Expanded the existing thin tutorial layer into a full backend-authoritative economic tutorial that progresses through extract, claim, inventory, sell, buy, produce, and logistics using only real gameplay actions.
- Kept the implementation conservative by evolving the existing `player_tutorial_progress` flow instead of creating a parallel quest system, then added migration `0010_tutorial_progress.sql` to add an explicit `current_step` and map legacy tutorial progress safely.
- Wired tutorial progression into market buy, production, and logistics routes, updated the shared tutorial step catalog and dashboard panel copy, and re-ran `corepack pnpm lint`, `corepack pnpm typecheck`, `corepack pnpm build`, `corepack pnpm test`, and `corepack pnpm check:i18n`.

### 2026-03-17 - TASK-037

- Added a conservative market depth MVP with player-created buy and sell limit orders, simple full-quantity matching, and atomic reservation or settlement logic in `create_market_limit_order`.
- Extended the market snapshot and page with recent order visibility plus a minimal order form, while keeping instant market buy and sell flows intact.
- Re-ran `corepack pnpm lint`, `corepack pnpm typecheck`, `corepack pnpm build`, `corepack pnpm test`, and `corepack pnpm check:i18n`; a narrow route-validation bug surfaced during test validation and was fixed by widening market-order resource parsing from starter raw resources to all shared `ResourceId` values.

### 2026-04-03 - TASK-038

- Added a conservative starter processing installation slice with shared content definitions, seed + migration coverage, and backend-authoritative placement via `POST /buildings/first-processing-installation`.
- Reused the extractor placement pattern while keeping scope narrow: bootstrap validation, extractor prerequisite validation, one-time placement validation, build ledger write, and dashboard snapshot visibility for placed processing installation state.
- Extended dashboard API/UI with a mobile-safe processing-installation CTA and installed-state card, added EN/FR i18n keys plus gameplay error mappings, and updated shared/api/web tests for the new snapshot and placement flow.
- Re-ran `corepack pnpm lint`, `corepack pnpm typecheck`, `corepack pnpm build`, `corepack pnpm test`, and `corepack pnpm check:i18n`.
