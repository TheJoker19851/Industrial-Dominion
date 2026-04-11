# MIGRATION_RULES.md

## Rules

1. All schema changes must go through versioned SQL migrations.
2. Never rely on manual production-only schema edits.
3. Seed data is separate from migrations when possible.
4. Migrations must be reviewable and reproducible.
5. Backward compatibility matters for live systems.
