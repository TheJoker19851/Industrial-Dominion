# TASK_BACKLOG.md

Legend:

- [ ] todo
- [x] done
- [~] blocked
- [/] optional/later

## Phase 0 - foundation

### [x] TASK-001 - Initialize frontend app shell

Priority: P0
Depends on: none

### [x] TASK-002 - Set up lint, typecheck, formatting, and tests

Priority: P0
Depends on: TASK-001

### [x] TASK-003 - Initialize Fastify backend workspace

Priority: P0
Depends on: none

### [x] TASK-004 - Add Supabase project scaffold and env placeholders

Priority: P0
Depends on: TASK-003

### [x] TASK-005 - Define shared domain types

Priority: P0
Depends on: TASK-001, TASK-003

### [x] TASK-006 - Create i18n framework with en/fr locale files

Priority: P0
Depends on: TASK-001

### [x] TASK-007 - Add locale-aware formatting helpers

Priority: P0
Depends on: TASK-006

### [x] TASK-008 - Add language switcher and preference persistence

Priority: P0
Depends on: TASK-006

### [x] TASK-009 - Create initial SQL schema and migrations

Priority: P0
Depends on: TASK-004, TASK-005

### [x] TASK-010 - Add Supabase Auth integration

Priority: P0
Depends on: TASK-004, TASK-001

### [x] TASK-011 - Add backend auth verification middleware

Priority: P0
Depends on: TASK-003, TASK-010

### [x] TASK-012 - Seed starter content data

Priority: P0
Depends on: TASK-009

### [x] TASK-013 - Add Railway deployment baseline

Priority: P0
Depends on: TASK-003

### [x] TASK-014 - Add Vercel frontend deployment baseline

Priority: P0
Depends on: TASK-001

### [x] TASK-015 - Add responsive app shell and mobile navigation baseline

Priority: P0
Depends on: TASK-001, TASK-006

## Phase 1 - first playable loop

### [x] TASK-020 - Region selection UI

Priority: P0
Depends on: TASK-005, TASK-006, TASK-012, TASK-015

### [x] TASK-021 - Starter package grant service

Priority: P0
Depends on: TASK-005, TASK-009

### [x] TASK-022 - Player bootstrap flow

Priority: P0
Depends on: TASK-020, TASK-021, TASK-010

### [x] TASK-023 - Starter extractor content and catalog

Priority: P0
Depends on: TASK-012

### [x] TASK-024 - Backend route to place first extractor

Priority: P0
Depends on: TASK-011, TASK-023, TASK-022

### [x] TASK-025 - Production math utilities

Priority: P0
Depends on: TASK-005, TASK-023

### [x] TASK-026 - Backend claim production route

Priority: P0
Depends on: TASK-024, TASK-025

### [x] TASK-027 - Inventory model and dashboard MVP

Priority: P0
Depends on: TASK-026, TASK-006, TASK-007, TASK-015

### [x] TASK-028 - Sell resource route and simple market MVP

Priority: P0
Depends on: TASK-026, TASK-015

### [x] TASK-029 - Ledger feed MVP

Priority: P1
Depends on: TASK-028

### [x] TASK-030 - System news feed MVP

Priority: P1
Depends on: TASK-027

### [x] TASK-031 - Localize starter gameplay screens

Priority: P0
Depends on: TASK-027, TASK-028, TASK-030

### [x] TASK-032 - Validate starter loop on mobile viewport

Priority: P0
Depends on: TASK-020, TASK-027, TASK-028, TASK-030, TASK-031

### [~] TASK-033 - Economic Tutorial System (Starter Loop)

Priority: P1
Depends on: TASK-034, TASK-035, TASK-036

Blocked by:

- TASK-036 - Logistics Transfer MVP

### [x] TASK-033A - Starter Tutorial MVP (Current Real Loop)

Priority: P1
Depends on: TASK-024, TASK-026, TASK-027, TASK-028

### [x] TASK-033B - MVP Coverage Audit

Priority: P1
Depends on: TASK-033A

### [x] TASK-034 - Market Buy MVP

Priority: P0
Depends on: TASK-027, TASK-028

### [x] TASK-034A - First Playable Smoke Test On Live Dev Database

Priority: P0
Depends on: TASK-034

Notes:

- Validate the current starter loop against the live Supabase development database using the existing local web and API apps.
- Confirm what works, what fails, and whether any launch-critical corrective task must be inserted before the next gameplay expansion task.

### [x] TASK-034B - Fix API production runtime entrypoint

Priority: P0
Depends on: TASK-034A

Notes:

- Fix the built Fastify server runtime so `node dist/server.js` works in the deployed production shape, not only in `pnpm dev`.
- Keep the fix conservative and aligned with the existing Railway baseline rather than redesigning the backend build pipeline.

### [x] TASK-035 - Basic Production Transform MVP

Priority: P0
Depends on: TASK-034B

### [ ] TASK-036 - Logistics Transfer MVP

Priority: P0
Depends on: TASK-035

## MVP Coverage Gaps

### Domain audit

#### 1. Onboarding / tutorial

- Implemented: auth-backed bootstrap, region selection, starter grant, starter tutorial MVP, skip support, per-player tutorial persistence.
- Partially implemented: onboarding teaches only the currently real starter loop.
- Missing: full economy tutorial coverage for buy, transform, and logistics.
- Launch blocker: no
- Smallest conservative next task(s): TASK-036, then unblock TASK-033.

#### 2. Installations / player-owned structures

- Implemented: first extractor catalog, backend placement, dashboard placement CTA, persisted building record.
- Partially implemented: only one player-owned starter installation is supported.
- Missing: any processing or logistics installation layer, broader structure management, upgrades with gameplay effect.
- Launch blocker: yes
- Smallest conservative next task(s): TASK-036.

#### 3. Extraction / production

- Implemented: hourly starter extraction math, claim-production route, persisted production jobs, a minimal transform recipe, transform job start/claim flow, and processed output persistence.
- Partially implemented: production covers only one conservative processed-goods transform on the starter extractor.
- Missing: broader transform coverage, dedicated processing structures, and logistics-linked production movement.
- Launch blocker: yes
- Smallest conservative next task(s): none before TASK-036.

#### 4. Inventory

- Implemented: backend-owned inventory table, dashboard inventory view, market sell integration, tutorial inventory-view progression.
- Partially implemented: inventory is surfaced through the dashboard rather than a dedicated inventory screen.
- Missing: inventory movement between regions, processed-goods inventory flow.
- Launch blocker: no
- Smallest conservative next task(s): TASK-036.

#### 5. Market

- Implemented: market snapshot, real buy and quick-sell flows, wallet updates, inventory integration, ledger entries, and localized market UI.
- Partially implemented: market uses conservative system offers and base-price quick sales rather than a deeper player-driven order book.
- Missing: broader market depth and cross-region market behavior.
- Launch blocker: no
- Smallest conservative next task(s): none before TASK-036.

#### 6. Ledger / news / dashboard

- Implemented: dashboard snapshot, recent ledger feed, system news feed, tutorial panel, mobile-friendly critical actions.
- Partially implemented: dashboard covers the starter loop plus the first transform flow, but not the broader economy loop.
- Missing: logistics-specific ledger/news/dashboard visibility.
- Launch blocker: no
- Smallest conservative next task(s): TASK-036.

#### 7. Regions / economic world model

- Implemented: starter region definitions, persisted player region choice, region-locked starter extractor mapping.
- Partially implemented: regions currently affect starting extractor choice more than ongoing economic behavior.
- Missing: real inter-region logistics flow and any meaningful regional movement of goods.
- Launch blocker: yes
- Smallest conservative next task(s): TASK-036.

#### 8. Auth / player state

- Implemented: Supabase auth on web, backend bearer verification, durable player/bootstrap state, tutorial progress persistence.
- Partially implemented: player state is sufficient for the starter loop but not yet broadened for later systems.
- Missing: nothing launch-critical for the current MVP slice.
- Launch blocker: no
- Smallest conservative next task(s): none before TASK-036.

#### 9. Mobile + desktop UX for critical actions

- Implemented: responsive shell, mobile-safe navigation, onboarding/dashboard/market flows, tutorial panel, and mobile-readable transform actions on the dashboard.
- Partially implemented: current UX supports buy and the first transform flow, but not the missing logistics action.
- Missing: mobile/desktop UX for logistics actions and any broader post-starter economy surfaces.
- Launch blocker: yes
- Smallest conservative next task(s): TASK-036.

#### 10. Backend + Supabase persistence coverage

- Implemented: persisted players, buildings, production jobs, inventory, market buy/sell results, ledger/news, tutorial progress, and transform completion persistence.
- Partially implemented: persistence is authoritative for the current slice, but logistics movement is still missing.
- Missing: logistics transfer persistence.
- Launch blocker: yes
- Smallest conservative next task(s): TASK-036.

### Hidden integration gaps

- The current game loop is coherent for extract -> claim -> view -> sell, but not yet for the broader economy promise of buy -> produce -> transport -> sell.
- The full tutorial task remains honestly blocked because the missing gameplay systems do not yet exist in backend-authoritative form.
- Regions exist as content and player state, but not yet as active economic movement destinations.
- The dashboard is the de facto inventory surface; that is acceptable for now, but transport and transform features will need explicit surfaced actions.

### UI or backend mismatches

- Backend feature not yet broadly surfaced: the standalone tutorial API exists mainly through the shell panel and is not yet exposed in settings or a dedicated help screen.
- Backend feature not yet broadly surfaced: separate ledger/news endpoints exist, while the player mostly experiences them through the dashboard snapshot.
- UI without backend-authoritative support: none identified in the current starter loop; the visible critical actions are backend-backed.

### Launch-critical tasks in conservative order

- TASK-036 - Logistics Transfer MVP

### Future-update candidates

- TASK-033 - Economic Tutorial System (Starter Loop) after TASK-034 through TASK-036
- broader installation management beyond the first extractor
- advanced market depth, analytics, automation, corporations, and non-starter economic systems
