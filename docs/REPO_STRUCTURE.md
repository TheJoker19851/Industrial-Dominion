# REPO_STRUCTURE.md

## Recommended monorepo

```text
industrial-dominion/
├─ docs/
│  ├─ active/
│  ├─ specialized/
│  ├─ archive/
│  ├─ AI_ENTRYPOINT.md
│  ├─ AGENTS.md
│  ├─ PROJECT_MEMORY.md
│  ├─ ARCHITECTURE.md
│  ├─ REPO_STRUCTURE.md
│  ├─ WORKFLOW_RULES.md
│  ├─ TASK_BACKLOG.md
│  └─ CURRENT_TASK.md
├─ apps/
│  ├─ web/
│  └─ api/
├─ packages/
│  ├─ shared/
│  ├─ ui/
│  └─ config/
├─ supabase/
│  ├─ migrations/
│  ├─ seeds/
│  ├─ policies/
│  └─ config.toml
├─ scripts/
├─ .github/workflows/
├─ package.json
├─ pnpm-workspace.yaml
└─ turbo.json
```

## Notes

- apps/web = Vercel frontend
- apps/api = Railway Fastify backend
- packages/shared = shared ids, schemas, economics, types
- packages/ui = reusable UI components
- packages/config = centralized game config
- supabase = migrations, seeds, policies
