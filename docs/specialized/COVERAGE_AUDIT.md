# COVERAGE_AUDIT.md

Moved from the legacy backlog for ongoing reference.

## MVP Coverage Gaps

### Domain audit

#### 1. Onboarding / tutorial

- Implemented: auth-backed bootstrap, region selection, starter grant, skip support, per-player tutorial persistence, and a backend-authoritative economic tutorial that tracks extract, claim, inventory, sell, buy, produce, and logistics.
- Partially implemented: the tutorial is intentionally a thin dashboard layer rather than a broader help or coaching system.
- Missing: no launch-critical tutorial gaps for the current MVP slice.
- Launch blocker: no
- Smallest conservative next task(s): none before future expansion work.

#### 2. Installations / player-owned structures

- Implemented: first extractor catalog, backend placement, dashboard placement CTA, persisted building record, and a minimal two-location storage model for logistics transfers.
- Partially implemented: only one player-owned starter installation is supported, and logistics currently moves inventory between player storage locations rather than broader world infrastructure.
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

- Implemented: backend-owned inventory table, dashboard inventory view, market sell integration, tutorial inventory-view progression, and backend-authoritative transfers between player locations.
- Partially implemented: inventory is surfaced through the dashboard rather than a dedicated inventory screen.
- Missing: broader world-scale inventory movement beyond the conservative storage-to-storage MVP.
- Launch blocker: no
- Smallest conservative next task(s): TASK-036.

#### 5. Market

- Implemented: market snapshot, real buy and quick-sell flows, wallet updates, inventory integration, ledger entries, and localized market UI.
- Partially implemented: market uses conservative system offers and base-price quick sales rather than a deeper player-driven order book.
- Missing: broader market depth and cross-region market behavior.
- Launch blocker: no
- Smallest conservative next task(s): none before TASK-036.

#### 6. Ledger / news / dashboard

- Implemented: dashboard snapshot, recent ledger feed, system news feed, tutorial panel, mobile-friendly critical actions, and logistics-specific transfer controls plus transfer ledger visibility.
- Partially implemented: dashboard now covers the conservative starter economy loop, but not broader post-MVP economic management.
- Missing: dedicated logistics history/news surfaces beyond the dashboard and ledger feed.
- Launch blocker: no
- Smallest conservative next task(s): TASK-036.

#### 7. Regions / economic world model

- Implemented: starter region definitions, persisted player region choice, region-locked starter extractor mapping, and a conservative multi-location inventory model that can support later regional transport.
- Partially implemented: regions still affect starting extractor choice more than ongoing economic behavior.
- Missing: explicit inter-region routing and region-driven logistics gameplay beyond the two-location MVP.
- Launch blocker: no
- Smallest conservative next task(s): TASK-033.

#### 8. Auth / player state

- Implemented: Supabase auth on web, backend bearer verification, durable player/bootstrap state, tutorial progress persistence.
- Partially implemented: player state is sufficient for the starter loop but not yet broadened for later systems.
- Missing: nothing launch-critical for the current MVP slice.
- Launch blocker: no
- Smallest conservative next task(s): none before TASK-036.

#### 9. Mobile + desktop UX for critical actions

- Implemented: responsive shell, mobile-safe navigation, onboarding/dashboard/market flows, tutorial panel, mobile-readable production actions, and a minimal mobile-friendly logistics transfer panel.
- Partially implemented: the UX now supports the conservative starter economy loop, but not broader post-starter economic management.
- Missing: larger post-MVP logistics and planning surfaces.
- Launch blocker: no
- Smallest conservative next task(s): TASK-033.

#### 10. Backend + Supabase persistence coverage

- Implemented: persisted players, buildings, production jobs, location-scoped inventory, market buy/sell results, logistics transfer records, ledger/news, tutorial progress, and transform completion persistence.
- Partially implemented: persistence is authoritative for the current MVP slice, but broader regional logistics is still intentionally narrow.
- Missing: no additional launch-critical persistence gaps for the current MVP slice.
- Launch blocker: no
- Smallest conservative next task(s): TASK-033.

### Hidden integration gaps

- The current starter economy loop is now coherent for extract -> claim -> inventory -> sell -> buy -> produce -> transfer at the conservative MVP level.
- Regions exist as content and player state, but logistics still operates across player storage locations rather than explicit region-to-region world routing.
- The dashboard is the de facto inventory and logistics surface; that is acceptable for now, but later logistics expansion may need dedicated views.

### UI or backend mismatches

- Backend feature not yet broadly surfaced: the standalone tutorial API exists mainly through the shell panel and is not yet exposed in settings or a dedicated help screen.
- Backend feature not yet broadly surfaced: separate ledger/news endpoints exist, while the player mostly experiences them through the dashboard snapshot.
- UI without backend-authoritative support: none identified in the current starter loop; the visible critical actions are backend-backed.

### Launch-critical tasks in conservative order

- none currently identified before the broader tutorial follow-up

### Future-update candidates

- broader installation management beyond the first extractor
- advanced market depth, analytics, automation, corporations, and non-starter economic systems
