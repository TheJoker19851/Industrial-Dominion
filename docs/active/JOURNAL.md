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

### 2026-04-13 - TASK-050

First real industrial transformation implemented:

- wood → plank via instant production recipe (2:1 ratio) and timed Greenhaven batch transform (12 wood → 6 planks, 1800s)
- plank introduced as tradable processed resource (tier 2, base_price 26)
- generalized `create_production_job` and `start_transform_job` SQL RPCs (removed iron-only hardcoding)
- production service updated to support multiple processing-installation recipes via Set lookup
- MarketPage type fix (hardcoded literal union → shared `ResourceId` type)

This marks the transition from pure market economy to industrial gameplay.

Validated:

- raw vs processed trade-off exists (wood base_price 10 vs plank base_price 26)
- plank participates in market correctly (tradable, storable, tier 2)
- all 193 tests pass (84 API + 21 shared + 88 web)
- typecheck, build, i18n all clean
- Migration `0014_wood_to_planks.sql` ready for deployment

### 2026-04-13 - TASK-051

Industrial decision validation for the wood → plank chain:

- Quantified processing premium at base prices: ~25% net gain over raw sell (20 credits vs 25 credits per plank-equivalent)
- Confirmed Greenhaven regional context amplifies processing incentive to ~44% (suppressed wood sell price)
- Verified breakeven at plank/wood price ratio of exactly 2.0; current ratio is 2.6 giving healthy margin
- Validated price sensitivity: ±1-credit moves near breakeven flip the decision
- Confirmed thin but positive arbitrage buying wood to process (5-7 credits per plank)
- Plank is the first tradable processed resource (iron_ingot is non-tradable), enabling the game's first real industrial market decision
- Added 32 targeted validation tests in `apps/api/tests/industrial-decision-validation.test.ts`

Verdict: **READY FOR NEXT INDUSTRIAL EXPANSION**

### 2026-04-14 - TASK-052

Second industrial value chain activated: iron_ore → iron_ingot

- Changed iron_ingot from non-tradable to tradable (single DB flag flip)
- All existing infrastructure already in place: recipes, production service, transform RPCs, i18n, market-context premiums (0.18 sell / 0.10 buy at trade hub)
- Migration `0015_iron_ingot_tradable.sql` makes the change deployable
- Updated seed.sql and economic validation tests
- Both processed resources (plank, iron_ingot) now create real raw-vs-processed market decisions
- All 119 API + 21 shared + 88 web tests pass; typecheck, build, i18n clean

### 2026-04-14 - TASK-053

Third industrial value chain: crude_oil → fuel

- Added `fuel` as new tradable processed resource (tier 2, base_price 48)
- Instant production recipe `fuel_from_crude_oil` (2 crude_oil → 1 fuel)
- Batch transform recipe `sunbarrel_fuel_batch` (12 crude_oil → 6 fuel, 2400s) for Sunbarrel oil extractor
- Migration `0016_crude_oil_to_fuel.sql` adds resource, recipes, and updates `start_transform_job` RPC to support sunbarrel buildings
- Added fuel to production service processing installation Set
- EN/FR i18n strings for fuel resource, transform, and production recipe
- All 120 API + 21 shared + 88 web tests pass; typecheck, build, i18n clean

### 2026-04-14 - TASK-054

Multi-chain industrial decision validation across all three chains (wood→plank, iron→ingot, oil→fuel):

- Added 63 targeted validation tests in `multi-chain-industrial-validation.test.ts`
- Confirmed chains are economically differentiated: plank ~25% margin, iron ~17% margin, fuel ~6% margin
- Regional anchor amplifies processing incentive on every chain (sell pressure on raw, no modifier on processed)
- Iron chain has unique trade_hub premiums (+18% sell, +10% buy) creating a third distinct price context
- All chains flip from "process wins" to "raw wins" within ±1 credit of the 2:1 breakeven
- Batch durations differ: wood 1800s < oil 2400s < iron 3600s (time-value tradeoff)
- System is NOT static — regional context, trade hub, order book, and spread create meaningful price variation
- All 183 API + 21 shared + 88 web = 292 total tests pass

Verdict: **INDUSTRIAL SYSTEM IS READY FOR EXPANSION**

### 2026-04-23 - TASK-059

Decision Execution & Logging MVP:

- Created `decision_log` table in migration `0017_decision_log.sql` with strategy, resource, quantity, origin/destination regions, result JSONB, and status (executed/recorded/failed)
- Added `execute_decision_sell_local` atomic RPC that validates inventory, deducts resources, credits the player, creates market order, writes ledger entries, and inserts decision_log — all in one transaction
- Added `executeDecision` service: SELL_LOCAL calls the atomic RPC; other strategies are recorded as "recorded" (not yet executable in MVP)
- Added `getDecisionHistory` service: reads from decision_log ordered by most recent
- Added `POST /economics/decision-execute` route with Zod validation + auth
- Added `GET /economics/decision-history` route with auth and optional limit param
- Added frontend API functions `executeDecision` and `getDecisionHistory` in dashboard-api.ts
- Updated `EconomicDecisionPanel` with Execute button in Prepare flow, execution result display (net, fee, credits), and error handling
- Added EN/FR i18n keys for execute, executing, executed, fee, credits labels
- Added 4 integration tests: SELL_LOCAL execution, non-SELL_LOCAL recording, invalid payload, history read
- All 10 economics tests pass (6 existing + 4 new), 36 shared tests pass, 11 frontend tests pass
- TypeScript typecheck clean for both API and web projects
- No duplicated economic logic — reuses slippage, arbitrage, and decision engine from shared package

### 2026-04-25 - TASK-058

- Completed the player-facing decision UX layer in `EconomicDecisionPanel.tsx`
- Added executable vs preview-only distinction: SELL_LOCAL strategies show Prepare → Execute flow; other strategies show "Preview only" badge with hint text
- Added decision history section using `useQuery` to fetch `GET /economics/decision-history`, with status badges (Executed/Recorded) and timestamps
- History auto-refreshes after successful execution via `queryClient.invalidateQueries`
- Added 7 new i18n keys in EN and FR: decisionPreviewOnly, decisionPreviewOnlyHint, decisionStatusExecuted, decisionStatusRecorded, decisionHistoryTitle, decisionHistoryEmpty, decisionHistoryEntry
- All 11 decision-format tests pass; TypeScript typecheck clean
- No duplicated economic logic; frontend consumes backend outputs only
- Files modified: EconomicDecisionPanel.tsx, en/common.json, fr/common.json, CURRENT_TASK.md, TASK_BACKLOG.md

### 2026-04-25 - TASK-060

- Added 5 integration tests for `POST /economics/batch-analysis` endpoint
- Created `createBatchAnalysisMock` factory with optional non-tradable resource override
- Tests cover: valid multi-region multi-quantity request (4 analyses), correct entry shape, invalid payload (empty quantities), non-tradable resource rejection, deterministic results
- All 15 economics tests pass (6 decision-preview + 5 batch-analysis + 4 execute/history)
- No duplicated economic logic; tests mock Supabase and verify endpoint behavior only
- Files modified: economics-decision.test.ts, CURRENT_TASK.md, TASK_BACKLOG.md

### 2026-04-25 - TASK-061

- Added 5 integration tests for `POST /economics/market-signals` endpoint
- Tests cover: valid request with signal output, correct signal shape (key/severity/params), invalid payload rejection, non-tradable resource rejection, EXCEEDS_LIQUIDITY_DEPTH trigger with high quantity
- Reused existing mock factories (`createDecisionMock`, `createBatchAnalysisMock`)
- All 20 economics tests pass (6 preview + 5 batch-analysis + 4 execute/history + 5 market-signals)
- No duplicated economic logic; tests verify endpoint behavior only
- No signals drifting into recommendations — signals are environmental hints (slippage, liquidity, margin)
- Files modified: economics-decision.test.ts, CURRENT_TASK.md, TASK_BACKLOG.md

### 2026-04-26 - TASK-065

Execute PROCESS_AND_SELL_LOCAL MVP — first strategy expansion beyond SELL_LOCAL:

- Created atomic PostgreSQL RPC `execute_decision_process_and_sell_local` in migration `0018_execute_decision_process_and_sell_local.sql`
- RPC: validates output resource tradable → locks input inventory → deducts input → computes output gross/fee/net → credits player → creates market order for output → writes market_sell + market_fee ledger entries → writes decision_log with PROCESS_AND_SELL_LOCAL strategy — all in one transaction
- Service layer looks up recipe from `starterTransformRecipes` (shared package), computes batches and output quantities, passes derived values to RPC
- Extended `DecisionExecutionResult` interface with optional `outputResourceId`, `inputConsumed`, `outputProduced` fields
- Frontend: PROCESS_AND_SELL_LOCAL now shows Execute button (same Prepare → Confirm → Execute flow as SELL_LOCAL); execution result shows processing details (input consumed → output produced)
- Added EN/FR i18n key `decisionProcessedLabel`
- TRANSPORT_AND_SELL and PROCESS_THEN_TRANSPORT_AND_SELL remain "Preview only" (recorded as pending)
- Added 4 new integration tests: PROCESS_AND_SELL_LOCAL execution with RPC verification, quantity-below-threshold validation (400), TRANSPORT_AND_SELL recorded, PROCESS_THEN_TRANSPORT_AND_SELL recorded, history with mixed strategy entries
- All 24 economics tests pass (6 preview + 5 batch-analysis + 5 market-signals + 8 execute/history), 287 API tests total, 495 across workspace
- TypeScript typecheck clean, build clean, i18n aligned
- No duplicated economic logic — reuses `starterTransformRecipes` from shared package; execution uses base_price consistent with SELL_LOCAL pattern
- Files modified: 0018 migration (new), economics.service.ts, economics.routes.ts, dashboard-api.ts, EconomicDecisionPanel.tsx, en/common.json, fr/common.json, economics-decision.test.ts

### 2026-04-27 - TASK-066

Local Execution Consistency Pass:

- Replaced raw base_price execution with market-context-aware pricing using `computeExecutionSellQuote` helper for both SELL_LOCAL and PROCESS_AND_SELL_LOCAL
- Helper applies regional modifier → instant trade spread (5%) → slippage, matching preview pipeline
- Updated RPCs to accept `p_price_per_unit` from service layer (migration `0019_execution_price_consistency.sql`)
- Added `priceBasis: 'market_context'` to execution results
- Frontend shows gross amount in execution result display
- Added EN/FR i18n key `decisionGrossLabel`
- Added consistency tests: both strategies pass market-context price to RPC
- All 26 economics tests pass; no regressions
- Files modified: 0019 migration, economics.service.ts, economics.routes.ts, EconomicDecisionPanel.tsx, en/common.json, fr/common.json, economics-decision.test.ts

### 2026-04-27 - TASK-067

Execute TRANSPORT_AND_SELL MVP:

- Created atomic RPC `execute_decision_transport_and_sell` in migration `0020_execute_decision_transport_and_sell.sql`
- Service uses shared `calculateTransportCost` + `computeExecutionSellQuote` for destination
- Frontend: TRANSPORT_AND_SELL shows Execute; result shows transport cost + destination
- Added EN/FR i18n keys `decisionTransportCostLabel`, `decisionDestinationLabel`
- All 29 economics tests pass; no regressions
- Files modified: 0020 migration, economics.service.ts, economics.routes.ts, dashboard-api.ts, EconomicDecisionPanel.tsx, en/common.json, fr/common.json, economics-decision.test.ts

### 2026-04-27 - TASK-068

Execute PROCESS_THEN_TRANSPORT_AND_SELL MVP:

- Created atomic RPC `execute_decision_process_transport_and_sell` in migration `0021_execute_decision_process_transport_and_sell.sql`
- Combines recipe lookup + transport cost + destination sell quote — no duplicated logic
- Frontend: PROCESS_THEN_TRANSPORT_AND_SELL shows Execute; result shows processing + transport + destination
- All 30 economics tests pass; 501 total workspace tests pass (2 pre-existing failures unrelated)
- Files modified: 0021 migration, economics.service.ts, economics.routes.ts, EconomicDecisionPanel.tsx, economics-decision.test.ts
