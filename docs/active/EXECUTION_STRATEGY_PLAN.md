# EXECUTION_STRATEGY_PLAN.md

## 1. Overview

### Current Limitations

The decision engine evaluates four economic strategies for any given resource/quantity/region combination:

| Strategy                          | Preview                                                  | Execution                                                         |
| --------------------------------- | -------------------------------------------------------- | ----------------------------------------------------------------- |
| `SELL_LOCAL`                      | Full breakdown with slippage, fee, net                   | **Fully executable** via atomic RPC `execute_decision_sell_local` |
| `PROCESS_AND_SELL_LOCAL`          | Full breakdown with processing margin                    | Preview only — recorded as `"recorded"` status                    |
| `TRANSPORT_AND_SELL`              | Full breakdown with arbitrage delta, transport cost/time | Preview only — recorded as `"recorded"` status                    |
| `PROCESS_THEN_TRANSPORT_AND_SELL` | Full breakdown combining both                            | Preview only — recorded as `"recorded"` status                    |

Only 1 of 4 strategies is executable. The decision panel already shows "Preview only" badges on non-SELL_LOCAL strategies, but the player cannot act on them.

### Expansion Goal

Make all four strategies incrementally executable without breaking the economic system, without duplicating logic, and without compromising backend authority.

### Design Philosophy

1. **Incremental** — one strategy at a time, each fully validated before the next
2. **Safe** — every execution is atomic, idempotent where possible, and reversible via ledger
3. **Deterministic** — preview results must match execution results within slippage tolerance
4. **Player-controlled** — the player explicitly confirms every multi-step action; nothing auto-triggers without consent
5. **No new economic logic** — reuse slippage (TASK-055), arbitrage (TASK-056), decision engine (TASK-057) exactly as-is

---

## 2. Strategy Breakdown

### 2.1 PROCESS_AND_SELL_LOCAL

**Description**: Transform input resource into output resource via a processing recipe, then sell the output locally.

**Required Systems**:

- Production system (instant recipe lookup, `create_production_job` RPC)
- Market sell system (pricing, fee, slippage)
- Inventory system (deduct input, add output)
- Decision log system
- Ledger system

**Execution Flow**:

1. Look up recipe for input resource (e.g., `wood → plank`, 2:1 ratio)
2. Validate sufficient input inventory
3. Deduct input inventory
4. Compute output quantity
5. Add output inventory (temporary — consumed by sell)
6. Compute sell quote for output resource (slippage + fee)
7. Credit player net amount
8. Deduct output inventory
9. Write market order, ledger entries, decision_log

**Execution Complexity**: **Low**

- All steps are synchronous
- Instant recipes have no time delay
- Can be a single atomic RPC
- No multi-region coordination

**Dependencies**:

- `create_production_job` RPC (already exists — handles instant production atomically)
- `sell_inventory_resource_at_location` RPC (already exists)
- Recipe catalog in shared package (already exists)
- Market context pricing (already exists)

**Risks**:

- Pricing inconsistency between preview and execution (slippage drift if prices change between preview and execute)
- Output resource must be tradable (currently `plank`, `iron_ingot`, `fuel` all tradable)
- Must enforce input:output ratio strictly server-side

---

### 2.2 TRANSPORT_AND_SELL

**Description**: Transport resource from origin region to destination region, then sell at the destination market.

**Required Systems**:

- Logistics system (transport cost, transport time, `create_logistics_transfer` RPC)
- Market sell system at destination region (pricing, fee, slippage with destination context)
- Inventory system (location-aware: deduct at origin, add at destination)
- Decision log system
- Ledger system

**Execution Flow**:

1. Validate sufficient inventory at origin location
2. Compute transport cost and time (shared logistics module)
3. Deduct inventory at origin
4. Add inventory at destination (or create logistics transfer job)
5. Compute sell quote at destination (destination market context + slippage + fee)
6. Credit player net amount (minus transport cost)
7. Write logistics transfer record, market order, ledger entries, decision_log

**Execution Complexity**: **Medium**

- Involves two regions (origin + destination)
- Transport has a time component (60–360 seconds depending on distance)
- Location-aware inventory management required
- Two possible models: instant (ignore time) or deferred (respect time)

**Dependencies**:

- `create_logistics_transfer` RPC (already exists — handles cross-location transfer)
- `get_primary_location_id` RPC (already exists)
- Destination market context pricing (already exists via `getMarketContextPrice`)
- Shared logistics module (`calculateTransportCost`, `calculateTransportTime` — already exist)

**Risks**:

- **Timing mismatch**: preview shows transport time, but instant execution ignores it — breaks player trust
- **Price volatility**: destination price may change during transport delay
- **Inventory race**: another action might consume inventory during transport
- **Partial failure**: transport succeeds but sell fails (or vice versa)

---

### 2.3 PROCESS_THEN_TRANSPORT_AND_SELL

**Description**: Transform input resource into output resource, transport output to destination region, then sell at destination market. Combines processing + logistics + sell.

**Required Systems**:

- All systems from PROCESS_AND_SELL_LOCAL (production, market, inventory)
- All systems from TRANSPORT_AND_SELL (logistics, cross-region, location-aware inventory)
- Multi-step orchestration

**Execution Flow**:

1. Look up recipe for input resource
2. Validate sufficient input inventory
3. Deduct input inventory
4. Compute output quantity
5. Compute transport cost and time for output to destination
6. Add output inventory at destination (or create logistics transfer)
7. Compute sell quote at destination for output resource
8. Credit player net amount (minus transport cost)
9. Write production record, logistics record, market order, ledger entries, decision_log

**Execution Complexity**: **High**

- Combines all three sub-operations
- Multi-region coordination
- Time component from both processing (if batch) and transport
- Most state mutations of any strategy
- Highest number of failure points

**Dependencies**:

- All dependencies from both PROCESS_AND_SELL_LOCAL and TRANSPORT_AND_SELL
- Requires both sub-systems to be validated independently first
- Order-dependent: processing must complete before transport can begin

**Risks**:

- All risks from both sub-strategies, compounded
- If batch processing has a time delay, execution becomes a multi-hour pipeline
- Most sensitive to price changes across the entire chain
- Highest economic impact if calculation is wrong

---

## 3. Execution Model Options

### 3.1 Atomic Execution

**Model**: Single PostgreSQL RPC function executes all steps in one transaction. Either everything succeeds or everything rolls back.

**Pros**:

- Strongest consistency guarantee — no partial states
- Simplest error handling — single success/failure
- Matches existing `execute_decision_sell_local` pattern
- No job tracking infrastructure needed
- Deterministic — same inputs always produce same outputs

**Cons**:

- Cannot handle time delays (transport, batch processing)
- Long-running transactions if many steps
- Less flexible — adding steps requires RPC migration
- Requires "instant" execution even for strategies with time components

**Impact on Gameplay**:

- TRANSPORT_AND_SELL would execute instantly (transport cost applied but no real delay)
- PROCESS_THEN_TRANSPORT_AND_SELL with batch recipes would ignore batch time
- Preview shows time estimates that execution doesn't honor — **trust problem**

**Best Fit**: PROCESS_AND_SELL_LOCAL (instant recipes only)

---

### 3.2 Job-Based Execution

**Model**: Execution creates a strategy job record with multiple stages. Each stage completes independently. The player can track progress. Final settlement occurs when all stages complete.

**Pros**:

- Respects time delays naturally
- Player can observe progress (processing... transporting... selling...)
- Matches real game systems (production jobs, logistics transfers already work this way)
- Supports cancellation between stages
- Preview timing matches execution timing

**Cons**:

- Requires new `strategy_jobs` table and job state machine
- More complex failure handling (what if step 2 of 3 fails?)
- Requires periodic job processing or event triggers
- Player must return to claim/complete final step
- More complex UX — player sees "in progress" instead of instant result

**Impact on Gameplay**:

- Strategies feel real — processing takes time, transport takes time
- Player must plan around execution delays
- Adds strategic depth — timing matters
- Risk of abandonment — player starts strategy but doesn't return to complete it

**Best Fit**: TRANSPORT_AND_SELL (with real transport delay), PROCESS_THEN_TRANSPORT_AND_SELL

---

### 3.3 Hybrid Model

**Model**: Instant steps are executed atomically. Timed steps create tracked jobs. Each strategy uses the appropriate combination.

**Pros**:

- Best of both worlds — instant when possible, deferred when necessary
- PROCESS_AND_SELL_LOCAL stays atomic (no time component with instant recipes)
- TRANSPORT_AND_SELL can be instant (Phase 1) then upgraded to job-based (Phase 2)
- Gradual complexity introduction — start atomic, add jobs only when needed
- Matches player expectations: fast for simple, tracked for complex

**Cons**:

- Two code paths to maintain
- Need to define clear boundaries between atomic and job-based steps
- Testing complexity increases with two models

**Impact on Gameplay**:

- PROCESS_AND_SELL_LOCAL feels snappy and satisfying
- TRANSPORT_AND_SELL feels weighty and strategic
- PROCESS_THEN_TRANSPORT_AND_SELL feels like a real industrial operation
- Player learns to distinguish quick flips from long-term plays

**Best Fit**: Overall system — recommended approach

---

## 4. Recommended Implementation Order

### Order

| Priority | Strategy                        | Task     | Model                                           | Reason                                                                      |
| -------- | ------------------------------- | -------- | ----------------------------------------------- | --------------------------------------------------------------------------- |
| 1st      | PROCESS_AND_SELL_LOCAL          | TASK-065 | Atomic                                          | Simplest; no time delay; single-region; reuses existing RPCs                |
| 2nd      | TRANSPORT_AND_SELL              | TASK-066 | Hybrid (instant MVP → job later)                | Medium complexity; introduces cross-region; validates logistics integration |
| 3rd      | PROCESS_THEN_TRANSPORT_AND_SELL | TASK-067 | Hybrid (composed from validated sub-strategies) | Hardest; depends on both prior strategies being validated in production     |

### Why This Order Is Optimal

**PROCESS_AND_SELL_LOCAL first** because:

- It is the smallest extension beyond SELL_LOCAL — same region, same sell logic
- All required atomic RPCs already exist (`create_production_job` for instant recipes, sell RPC)
- No time delay means no job infrastructure needed
- No cross-region coordination means no logistics complexity
- Validates the pattern of "multi-step atomic execution" in isolation
- If something breaks, the blast radius is limited to single-region processing

**TRANSPORT_AND_SELL second** because:

- It introduces exactly one new dimension (cross-region) without the processing layer
- The logistics system (`create_logistics_transfer`, transport cost/time) is already validated
- It can start as instant execution (Phase 1) and upgrade to real logistics later
- It validates that the system can handle destination-region pricing correctly
- It is a prerequisite for PROCESS_THEN_TRANSPORT_AND_SELL (must prove cross-region works before combining with processing)

**PROCESS_THEN_TRANSPORT_AND_SELL last** because:

- It composes both validated sub-strategies — if the parts work, the whole should work
- It has the highest risk and most complex failure modes
- By the time it's implemented, both processing execution and transport execution will have been battle-tested
- Any bugs found in the first two strategies will already be fixed

---

## 5. MVP Definition per Strategy

### 5.1 PROCESS_AND_SELL_LOCAL — MVP

**Included**:

- Instant recipe execution only (no batch/timed transforms)
- Single atomic RPC: `execute_decision_process_and_sell_local`
- Validates input inventory, deducts input, computes output, sells output locally
- Uses existing slippage and market fee calculations
- Writes production + sell ledger entries + decision_log in one transaction
- Frontend: Execute button activates for PROCESS_AND_SELL_LOCAL strategies
- Confirmation checklist: "X input → Y output → sell locally"

**Excluded**:

- Batch/timed processing recipes (e.g., `sunbarrel_fuel_batch` with 2400s duration)
- Non-tradable output resources
- Recipe selection (auto-selects the matching recipe for the resource)

**Simulated vs Real**:

- Processing: **Real** — uses actual recipe ratios from shared config
- Pricing: **Real** — uses actual market context + slippage + fee
- Inventory: **Real** — actual deduction and ledger entries
- No simulation anywhere — fully real execution

---

### 5.2 TRANSPORT_AND_SELL — MVP

**Included**:

- Instant execution with transport cost applied (Phase 1 — no real time delay)
- Single atomic RPC: `execute_decision_transport_and_sell`
- Validates origin inventory, computes transport cost, deducts at origin, sells at destination
- Uses destination region market context for pricing
- Transport cost deducted from net revenue
- Writes transfer + sell ledger entries + decision_log in one transaction
- Frontend: Execute button activates for TRANSPORT_AND_SELL strategies
- Confirmation checklist: "Transport to [region] → Sell at [region]"

**Excluded**:

- Real-time logistics transfer (deferred to Phase 2)
- Job tracking for transport progress
- Cancellation of in-transit goods
- Multi-hop transport

**Simulated vs Real**:

- Transport cost: **Real** — uses actual `calculateTransportCost` from shared module
- Transport time: **Simulated** — cost applied but execution is instant (acknowledged limitation)
- Destination pricing: **Real** — uses actual destination market context + slippage + fee
- Inventory: **Real** — actual deduction at origin, credited at destination, sold

---

### 5.3 PROCESS_THEN_TRANSPORT_AND_SELL — MVP

**Included**:

- Instant processing + instant transport (Phase 1)
- Single atomic RPC: `execute_decision_process_transport_and_sell`
- Combines processing + transport + sell in one transaction
- Validates input inventory, processes, computes output, transports, sells at destination
- Deducts input, credits net revenue minus transport cost
- Writes production + transfer + sell ledger entries + decision_log

**Excluded**:

- Batch/timed processing
- Real-time logistics transfer
- Partial execution (no "process now, transport later" split)
- Recipe selection

**Simulated vs Real**:

- Processing: **Real** — actual recipe ratios
- Transport cost: **Real** — actual calculation
- Transport time: **Simulated** — instant (same as TRANSPORT_AND_SELL MVP)
- Destination pricing: **Real**
- Inventory: **Real**

---

## 6. Backend Requirements

### 6.1 Required RPCs

**`execute_decision_process_and_sell_local`** (TASK-065):

- Parameters: `p_player_id`, `p_resource_id` (input), `p_quantity`, `p_origin_region`, `p_fee_rate`
- Steps: validate input inventory → look up recipe → deduct input → compute output → get output price → apply slippage → compute fee → credit player → create market order → write ledger entries (production + sell) → write decision_log
- Returns: decision_id, order_id, input_consumed, output_produced, output_resource_id, price_per_unit, gross_amount, fee_amount, transport_cost (0), net_amount, inventory_quantity, player_credits

**`execute_decision_transport_and_sell`** (TASK-066):

- Parameters: `p_player_id`, `p_resource_id`, `p_quantity`, `p_origin_region`, `p_destination_region`, `p_fee_rate`
- Steps: validate origin inventory → compute transport cost → get destination price → apply slippage → compute fee → deduct origin inventory → credit player (net - transport) → create logistics record → create market order → write ledger entries (transport + sell) → write decision_log
- Returns: decision_id, order_id, price_per_unit, gross_amount, fee_amount, transport_cost, net_amount, origin_inventory_quantity, player_credits, destination_region

**`execute_decision_process_transport_and_sell`** (TASK-067):

- Parameters: `p_player_id`, `p_resource_id` (input), `p_quantity`, `p_origin_region`, `p_destination_region`, `p_fee_rate`
- Steps: validate input inventory → look up recipe → deduct input → compute output → compute transport cost → get destination price for output → apply slippage → compute fee → credit player (net - transport) → create logistics record → create market order → write ledger entries (production + transport + sell) → write decision_log
- Returns: decision_id, order_id, input_consumed, output_produced, output_resource_id, price_per_unit, gross_amount, fee_amount, transport_cost, net_amount, origin_inventory_quantity, player_credits, destination_region

### 6.2 Required Data Structures

**`strategy_jobs` table** (deferred — for Phase 2 timed execution):

- id, player_id, strategy, status (pending/processing/transporting/selling/completed/failed), stages JSONB, result JSONB, created_at, updated_at
- Not needed for MVP (all strategies execute atomically)
- Required when real-time logistics integration is added

**`decision_log` table** — already exists, no changes needed:

- The `destination_region` column already supports NULL (used for SELL_LOCAL) and non-NULL (for transport strategies)
- The `result` JSONB column can store strategy-specific result data
- The `status` column already has `executed`, `recorded`, `failed` states

### 6.3 Required Endpoints

All endpoints already exist. Modifications needed:

**`POST /economics/decision-execute`** — extend `executeDecision()` service:

- Currently branches on `SELL_LOCAL` vs everything-else
- Add branches for `PROCESS_AND_SELL_LOCAL`, `TRANSPORT_AND_SELL`, `PROCESS_THEN_TRANSPORT_AND_SELL`
- Each branch calls the corresponding new RPC
- Request payload extension: add optional `destinationRegion` field (required for transport strategies)

**`GET /economics/decision-history`** — no changes needed:

- Already returns all fields including `destinationRegion` and `result` JSONB

### 6.4 Shared Package Changes

**`decision.ts`** — no logic changes, but the existing `StrategyBreakdownProcessAndSellLocal`, `StrategyBreakdownTransportAndSell`, and `StrategyBreakdownProcessThenTransportAndSell` interfaces will be referenced by the new RPC return types to ensure consistency.

No new economic logic. All calculations remain in the shared package.

---

## 7. UX Impact

### 7.1 How UI Should Evolve

**Phase 1 — PROCESS_AND_SELL_LOCAL executable**:

- Remove "Preview only" badge from PROCESS_AND_SELL_LOCAL strategy cards
- Add Execute button with same Prepare → Confirm → Execute flow as SELL_LOCAL
- Confirmation checklist shows processing steps: "Convert X [input] → Y [output] → Sell Y locally"
- Execution result shows: input consumed, output produced, sell price, fee, net

**Phase 2 — TRANSPORT_AND_SELL executable**:

- Remove "Preview only" badge from TRANSPORT_AND_SELL strategy cards
- Add Execute button with Prepare → Confirm → Execute flow
- Confirmation checklist shows transport steps: "Transport X [resource] to [destination] → Sell at [destination]"
- Execution result shows: transport cost, destination price, fee, net after transport
- Player must select/confirm destination region (already shown in preview)

**Phase 3 — PROCESS_THEN_TRANSPORT_AND_SELL executable**:

- Remove "Preview only" badge from PROCESS_THEN_TRANSPORT_AND_SELL strategy cards
- Most complex confirmation: "Convert X [input] → Y [output] → Transport to [destination] → Sell at [destination]"
- Execution result shows: all combined steps

### 7.2 Avoiding Confusion

- **Clear status badges**: SELL_LOCAL and PROCESS_AND_SELL_LOCAL show "Executable" badge; TRANSPORT_AND_SELL and PROCESS_THEN_TRANSPORT_AND_SELL continue showing "Preview only" until their respective tasks are complete
- **Progressive disclosure**: only one strategy becomes executable per release, giving players time to learn
- **Consistent flow**: every executable strategy uses the same Prepare → Confirm → Execute pattern established by SELL_LOCAL
- **Result consistency**: execution result structure matches preview breakdown structure (same fields, same labels)

### 7.3 Presenting Executable vs Preview

- **Executable strategies**: amber/gold highlight, "Execute" button visible, full Prepare flow available
- **Preview-only strategies**: muted/grey styling, "Preview only" badge, hint text explaining the strategy will become executable in a future update
- **Transition**: when a strategy becomes executable, its card automatically gains the Execute flow without layout changes — same card, more functionality

---

## 8. Risks & Safeguards

### 8.1 Economic Risks

| Risk                                        | Impact                                     | Safeguard                                                                                                                  |
| ------------------------------------------- | ------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------- |
| Processing margin too high/low              | Players always or never process            | Reuse existing recipe ratios and market context — no new pricing logic                                                     |
| Transport makes all remote sales profitable | Removes regional market differentiation    | Transport cost already validated by TASK-056; slippage scales with quantity                                                |
| Combined strategy always dominates          | Makes simpler strategies obsolete          | Slippage, transport cost, and fee compound — combined strategies naturally have higher drag                                |
| Double-claim on inventory                   | Infinite resource exploit                  | Atomic RPC with `FOR UPDATE` inventory lock (same pattern as `execute_decision_sell_local`)                                |
| Price drift between preview and execution   | Player gets different result than expected | Preview already warns about slippage; execution uses same calculation path; acceptable if within displayed slippage bounds |

### 8.2 Architectural Risks

| Risk                                                  | Impact                    | Safeguard                                                                     |
| ----------------------------------------------------- | ------------------------- | ----------------------------------------------------------------------------- |
| Long-running atomic transaction                       | DB performance under load | PROCESS_AND_SELL_LOCAL is ~5 steps — same as SELL_LOCAL; acceptable for MVP   |
| RPC complexity grows with each strategy               | Hard to maintain          | Each strategy gets its own RPC function; no shared mega-RPC                   |
| Frontend-backend contract drift                       | Broken UI                 | Zod schemas on routes; shared types in dashboard-api.ts mirror API response   |
| Migration failures                                    | Broken production DB      | Each new RPC is additive (new function, no table alterations); safe to deploy |
| Decision log schema can't represent new result shapes | Data loss or corruption   | `result` column is JSONB — already flexible; no schema change needed          |

### 8.3 UX Risks

| Risk                                                                           | Impact                                  | Safeguard                                                                                    |
| ------------------------------------------------------------------------------ | --------------------------------------- | -------------------------------------------------------------------------------------------- |
| Too many steps in confirmation checklist                                       | Player abandons execution               | PROCESS_AND_SELL_LOCAL has 3 steps max (same as SELL_LOCAL); TRANSPORT has 3; combined has 4 |
| Instant transport feels "wrong"                                                | Breaks immersion for TRANSPORT_AND_SELL | Phase 1 acknowledged as instant; Phase 2 adds real logistics; documented in MVP section      |
| Player doesn't understand why some strategies are executable and others aren't | Confusion                               | Clear "Preview only" badges with explanation text; progressive rollout                       |
| Execution fails after confirmation                                             | Frustration                             | Clear error messages; inventory not consumed on failure (atomic rollback); player can retry  |

---

## 9. Final Recommendation

### Next Task: TASK-065 — Execute PROCESS_AND_SELL_LOCAL

**Scope**:

- Create atomic PostgreSQL RPC `execute_decision_process_and_sell_local`
- Extend `executeDecision()` service to handle `PROCESS_AND_SELL_LOCAL` strategy
- Update `POST /economics/decision-execute` route to accept PROCESS_AND_SELL_LOCAL
- Update `EconomicDecisionPanel` to show Execute flow for PROCESS_AND_SELL_LOCAL
- Add i18n keys for process-and-sell execution results (EN + FR)
- Add integration tests: successful execution, insufficient input inventory, non-tradable output, invalid recipe
- Add migration `0018_execute_decision_process_and_sell_local.sql`

**Dependencies**: TASK-059 (execution system — done), TASK-057 (decision engine — done), TASK-055 (slippage — done)

**Scope boundaries**:

- Instant recipes ONLY (no batch transforms)
- Single region (no transport)
- No new economic logic
- No new tables (RPC is a function, decision_log reuses existing schema)
- Frontend change limited to EconomicDecisionPanel + i18n files + dashboard-api types

**Estimated file impact**: 6–8 files (1 migration, 1 service, 1 route, 1 shared type reference, 1 frontend component, 2 i18n files, 1 test file)

**After TASK-065**: Proceed to TASK-066 (TRANSPORT_AND_SELL) using the same pattern, then TASK-067 (PROCESS_THEN_TRANSPORT_AND_SELL) as a composition of validated sub-strategies.
