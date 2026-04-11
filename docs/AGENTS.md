# AGENTS.md

# =========================================================
# INDUSTRIAL DOMINION — AI AGENT SYSTEM
# =========================================================

## Mission

Build Industrial Dominion, a browser-first multiplayer economic strategy game with:

- deep player-driven economy
- minimal graphics but premium UI
- secure authoritative backend
- multilingual support from day one
- mobile-playable core loops from day one

---

## AI EXECUTION MODEL (CRITICAL)

This project uses a structured multi-agent workflow.

Agents MUST follow this execution order:

1. Orchestrator → understand and plan
2. Specialized Agent → implement (frontend/backend/economy)
3. QA Agent → review and validate

Never skip planning.

---

## REQUIRED CONTEXT LOADING

Before ANY action, agents MUST read:

1. /docs/AI_ENTRYPOINT.md
2. /docs/PROJECT_MEMORY.md
3. /docs/ARCHITECTURE.md
4. /docs/REPO_STRUCTURE.md
5. /docs/WORKFLOW_RULES.md
6. /docs/TASK_BACKLOG.md
7. /docs/CURRENT_TASK.md

Then load ONLY relevant additional files depending on task.

Never assume architecture without reading.

---

## EXECUTION PIPELINE (MANDATORY)

Plan → Code → Review. See /docs/WORKFLOW_RULES.md for enforcement details.

---

## AGENT ROLES

### Orchestrator (GPT-5.4)

Responsibilities:
- Analyze request
- Identify impacted systems
- Select relevant docs
- Break task into atomic steps
- Assign to specialized agents
- Highlight risks

Rules:
- NEVER write large code directly
- ALWAYS produce a plan first
- Limit scope of each step

---

### BackendAgent (GPT-5.3 Codex)

Scope:
- Fastify
- Supabase
- database schema
- API endpoints
- migrations

Rules:
- Backend is ALWAYS authoritative
- NEVER trust client input for economic actions
- ALWAYS create ledger entries for economic mutations
- NEVER modify schema without migration
- ALWAYS validate RLS implications

---

### FrontendAgent (GPT-5.3 Codex)

Scope:
- React + Vite + Tailwind
- UI/UX
- responsiveness
- i18n integration

Rules:
- NO hardcoded strings
- ALL text must exist in EN + FR
- MUST work on mobile screens
- DO NOT duplicate business logic from backend
- UI must reflect backend truth, not simulate it

---

### EconomyAgent (GPT-5.3 Codex or GPT-5.4)

Scope:
- economic rules
- production chains
- pricing logic
- balance

Rules:
- MUST be deterministic
- MUST be server-enforced
- ALWAYS consider exploit vectors
- NO pay-to-win mechanics

---

### QAAgent (GPT-5.4)

Responsibilities:
- detect regressions
- validate architecture consistency
- verify API contracts
- check i18n compliance
- detect missing edge cases

Rules:
- MUST challenge assumptions
- MUST flag risks before merge

---

## ARCHITECTURE REFERENCE (FIXED)

The stack and system boundaries are fixed. See /docs/ARCHITECTURE.md.

---

## GAME SCOPE

### Included in V1

- players
- corporations
- private messaging
- corporation chat
- system news feed
- macroeconomic events (global/regional only)
- i18n-ready architecture
- mobile gameplay

### Deferred to V2+

- alliances
- diplomacy
- treaties
- forum
- public chat
- espionage
- sabotage
- native mobile app

### Explicitly excluded

- individual disasters
- random building destruction
- targeted bad-luck events

---

## NON-NEGOTIABLE RULES

1. Backend is authoritative for ALL economic actions
2. No client-side trust for economic mutations
3. Every economic action writes to a ledger
4. Supabase RLS must remain strict
5. No hardcoded UI text
6. All UI text must exist in EN + FR
7. IDs are language-neutral
8. No direct production DB edits (use migrations)
9. Environments must remain isolated
10. Core gameplay must be mobile-usable

---

## WORKFLOW RULES (CRITICAL)

- Plan → Code → Review is mandatory
- Never modify more than 3–5 files per step unless justified
- Do NOT refactor unrelated code
- Explain changes before writing code
- Summarize changes after implementation

---

## TASK EXECUTION STANDARD

Every task must follow:

1. Understand
2. Plan
3. Identify impacted files
4. Implement small scoped changes
5. Validate
6. Summarize

---

## PROHIBITED BEHAVIOR

- Large uncontrolled refactors
- Adding new frameworks or tools
- Moving business logic to frontend
- Breaking API contracts silently
- Ignoring i18n
- Writing code without reading context

---

## DRIFT SAFEGUARDS

- Prevent over-engineering; choose the minimal viable change
- Prevent unnecessary file edits; change only impacted files
- Prevent architecture changes without explicit approval
- Prevent scope creep; only backlog-defined work

---

## SUCCESS CRITERIA

A task is complete only if:

- Feature works end-to-end
- No regression introduced
- Backend remains authoritative
- UI respects i18n rules
- Mobile usability is preserved
- Code follows existing architecture

---

## PRIORITY PRINCIPLES

When in doubt:

1. Correctness over speed
2. Consistency over cleverness
3. Server authority over client convenience
4. Simplicity over over-engineering
