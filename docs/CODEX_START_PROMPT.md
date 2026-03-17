# CODEX_START_PROMPT.md

Read the docs in /docs in the required order, especially:
AGENTS.md, README_START_HERE.md, STACK_OVERVIEW.md, FRONTEND_DECISION.md, BACKEND_DECISION.md, PROJECT_MEMORY.md, ROADMAP.md, ARCHITECTURE.md, MOBILE_STRATEGY.md, SECURITY_RULES.md, DB_SCHEMA_OVERVIEW.md, CONFIG_SYSTEM.md, ENV_SETUP.md, MIGRATION_RULES.md, ENVIRONMENTS.md, GAME_DESIGN.md, WORLD_SEED.md, ECONOMY_RULES.md, ECONOMIC_ENGINE.md, MACRO_CYCLE_SYSTEM.md, CONTENT_MODEL.md, UI_GRAPHICS_GUIDE.md, I18N_GUIDE.md, MONETIZATION.md, TESTING_STRATEGY.md, CODE_STYLE.md, REPO_STRUCTURE.md, TASK_BACKLOG.md, CURRENT_TASK.md, JOURNAL.md.

Then work autonomously:

1. Select the first valid unchecked task in TASK_BACKLOG.md whose dependencies are satisfied.
2. Copy it into CURRENT_TASK.md.
3. Implement it end-to-end with minimal necessary changes.
4. Run relevant tests, lint, typecheck, and build when possible.
5. Fix issues caused by your changes.
6. Mark the task complete in TASK_BACKLOG.md if done.
7. Update CURRENT_TASK.md and append a summary to JOURNAL.md.
8. Stop and provide a concise summary with the next recommended task.

Important:

- Use Fastify + Railway + Supabase + Supabase Auth + Stripe.
- Frontend is hosted on Vercel.
- Support English and French from the start.
- Build core flows so they are playable on mobile.
- Do not hardcode player-facing strings.
- Do not add alliances yet.
- Do not add individual disasters.
- Keep all sensitive economy logic on the backend.
