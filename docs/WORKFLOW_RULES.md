# WORKFLOW_RULES.md

## Required read order

1. /docs/AGENTS.md
2. /docs/README_START_HERE.md
3. /docs/STACK_OVERVIEW.md
4. /docs/FRONTEND_DECISION.md
5. /docs/BACKEND_DECISION.md
6. /docs/PROJECT_MEMORY.md
7. /docs/ROADMAP.md
8. /docs/ARCHITECTURE.md
9. /docs/MOBILE_STRATEGY.md
10. /docs/SECURITY_RULES.md
11. /docs/DB_SCHEMA_OVERVIEW.md
12. /docs/CONFIG_SYSTEM.md
13. /docs/ENV_SETUP.md
14. /docs/MIGRATION_RULES.md
15. /docs/ENVIRONMENTS.md
16. /docs/GAME_DESIGN.md
17. /docs/WORLD_SEED.md
18. /docs/ECONOMY_RULES.md
19. /docs/ECONOMIC_ENGINE.md
20. /docs/MACRO_CYCLE_SYSTEM.md
21. /docs/CONTENT_MODEL.md
22. /docs/UI_GRAPHICS_GUIDE.md
23. /docs/I18N_GUIDE.md
24. /docs/MONETIZATION.md
25. /docs/TESTING_STRATEGY.md
26. /docs/CODE_STYLE.md
27. /docs/REPO_STRUCTURE.md
28. /docs/TASK_BACKLOG.md
29. /docs/CURRENT_TASK.md
30. /docs/JOURNAL.md
31. /docs/CODEX_START_PROMPT.md

## Autonomous loop

1. Select the first valid unchecked task whose dependencies are satisfied.
2. Copy it into CURRENT_TASK.md.
3. Implement it end-to-end.
4. Run relevant checks.
5. Fix issues caused by the change.
6. Mark the task done.
7. Update CURRENT_TASK.md and JOURNAL.md.
8. Stop with a concise summary.
