# AI ENTRYPOINT – INDUSTRIAL DOMINION

## Core (mandatory read, in order):

1. /docs/AGENTS.md
2. /docs/PROJECT_MEMORY.md
3. /docs/ARCHITECTURE.md
4. /docs/REPO_STRUCTURE.md
5. TASK_BACKLOG.md
6. CURRENT_TASK.md
7. WORKFLOW_RULES.md
   You MUST explicitly confirm:

- which task is active
- what the goal is

## Before writing any code.

## HARD REQUIREMENT (CRITICAL)

You MUST read ALL core files above before doing any work.

If you do not read them:

- You are NOT allowed to proceed
- You must STOP and ask for clarification

---

## Active references (read when relevant):

- /docs/active/DB_SCHEMA_OVERVIEW.md (data changes)
- /docs/active/FRONTEND_DECISION.md (UI work)
- /docs/active/BACKEND_DECISION.md (backend work)
- /docs/active/SECURITY_RULES.md (security constraints)
- /docs/active/MIGRATION_RULES.md (schema changes)
- /docs/active/I18N_GUIDE.md (text/UI)
- /docs/active/ENV_SETUP.md, /docs/active/ENVIRONMENTS.md (environment work)
- /docs/active/CONFIG_SYSTEM.md (config changes)
- /docs/active/TESTING_STRATEGY.md (test expectations)
- /docs/active/CODE_STYLE.md (style)
- /docs/active/MOBILE_STRATEGY.md (mobile UX)
- /docs/active/ROADMAP.md, /docs/active/JOURNAL.md (planning/log)

---

## Specialized references (domain-specific):

- /docs/specialized/ECONOMIC_ENGINE.md
- /docs/specialized/ECONOMY_RULES.md
- /docs/specialized/MACRO_CYCLE_SYSTEM.md
- /docs/specialized/CONTENT_MODEL.md
- /docs/specialized/GAME_DESIGN.md
- /docs/specialized/WORLD_SEED.md
- /docs/specialized/MONETIZATION.md
- /docs/specialized/COVERAGE_AUDIT.md

---

## Execution model:

- Orchestrator: GPT-5.4
- Specialized agents: GPT-5.3 Codex
- QA: GPT-5.4

---

## Task System (CRITICAL)

All work must follow:

1. ADMIN_TASK.md → defines high-level goal
2. TASK_BACKLOG.md → structured tasks
3. CURRENT_TASK.md → single active task

---

## STRICT TASK RULES

- You MUST execute ONLY the task defined in CURRENT_TASK.md
- You MUST NOT pick another task
- You MUST NOT anticipate future tasks
- If CURRENT_TASK is missing or unclear → STOP

---

## Execution Flow (MANDATORY)

For every task:

1. Understand context
2. Create a plan
3. Identify impacted files
4. Implement small scoped changes
5. Validate
6. Summarize changes

Never start coding without a plan.

---

## Anti-Drift Rules (VERY IMPORTANT)

- Never modify more than 3–5 files per step unless required
- Never refactor unrelated code
- Never expand scope beyond CURRENT_TASK.md
- Never introduce new architecture without justification
- Always ask before large or unclear changes

---

## Economic Safety Rules (CRITICAL)

The economic system is sensitive and MUST remain coherent.

- NEVER duplicate economic logic
- ALWAYS reuse:
  - slippage (TASK-055)
  - arbitrage (TASK-056)
  - decision engine (TASK-057)

- NEVER:
  - invent new pricing logic
  - bypass slippage or arbitrage
  - hardcode “best strategies”
  - simplify calculations for convenience

---

## Architecture Rules

- shared = pure logic
- api = orchestration
- web = UI only

Frontend MUST NOT compute economics.

---

## Stop Conditions (MANDATORY)

STOP immediately if:

- A required file was not read
- CURRENT_TASK is unclear
- More than 5 files must be modified
- A new economic rule seems required
- A system must be bypassed to make code work

Explain instead of guessing.

---

## Core Rules

- Never assume architecture
- Never create new patterns without checking existing ones
- Always respect naming and structure
- Prefer extension over rewrite

---

## Priority Principles

When in doubt:

1. Correctness over speed
2. Consistency over cleverness
3. Backend authority over client convenience
4. Simplicity over complexity

---

## Autonomous Execution Mode (ENABLED)

You are allowed to execute multiple tasks sequentially WITHOUT waiting for validation.

Rules:

- After completing a task:
  1. Update TASK_BACKLOG.md (mark task as done)
  2. Update CURRENT_TASK.md with the next READY task
  3. Continue execution

- You MUST:
  - Respect dependencies
  - Stop if no READY task exists
  - Stop if a task becomes unclear
  - Stop if architecture impact is detected

- You MUST NOT:
  - Skip tasks
  - Reorder tasks
  - Unlock LOCKED or LATER tasks

- Maximum 2 consecutive tasks per session
- After 2 completed tasks, STOP and summarize everything clearly
