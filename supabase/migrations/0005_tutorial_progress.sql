create table if not exists player_tutorial_progress (
  player_id uuid primary key references players(id) on delete cascade,
  tutorial_id text not null default 'starter_loop' check (tutorial_id = 'starter_loop'),
  completed_step_ids jsonb not null default '[]'::jsonb,
  inventory_viewed_at timestamptz,
  skipped_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (jsonb_typeof(completed_step_ids) = 'array')
);

create index if not exists idx_player_tutorial_progress_tutorial_id
  on player_tutorial_progress(tutorial_id);

alter table player_tutorial_progress enable row level security;
