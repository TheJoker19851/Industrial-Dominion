create unique index if not exists idx_production_jobs_building_window_unique
  on production_jobs(building_id, started_at, completes_at);
