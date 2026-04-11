# AI ENTRYPOINT – INDUSTRIAL DOMINION

## Core (mandatory read, in order):
1. /docs/AGENTS.md
2. /docs/PROJECT_MEMORY.md
3. /docs/ARCHITECTURE.md
4. /docs/REPO_STRUCTURE.md
5. /docs/WORKFLOW_RULES.md
6. /docs/TASK_BACKLOG.md
7. /docs/CURRENT_TASK.md

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

Agents MUST NOT skip this system.

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

To prevent uncontrolled changes:

- Never modify more than 3–5 files per step unless required
- Never refactor unrelated code
- Never expand scope beyond CURRENT_TASK.md
- Never introduce new architecture without justification
- Always ask before large or unclear changes

---

## Core Rules

- Never assume architecture.
- Never create new patterns without checking existing ones.
- Always respect existing naming and structure.
- Prefer extension over rewrite.

---

## Priority Principles

When in doubt:

1. Correctness over speed
2. Consistency over cleverness
3. Backend authority over client convenience
4. Simplicity over complexity