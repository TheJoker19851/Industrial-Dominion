alter table production_jobs
  add column if not exists job_kind text not null default 'extraction',
  add column if not exists recipe_id text references recipes(id),
  add column if not exists input_resource_id text references resources(id),
  add column if not exists input_amount bigint,
  add column if not exists output_resource_id text references resources(id),
  add column if not exists output_amount bigint;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'production_jobs_job_kind_check'
  ) then
    alter table production_jobs
      add constraint production_jobs_job_kind_check
      check (job_kind in ('extraction', 'transform'));
  end if;
end $$;

alter table production_jobs
  drop constraint if exists production_jobs_transform_payload_check;

alter table production_jobs
  add constraint production_jobs_transform_payload_check
  check (
    (
      job_kind = 'extraction'
      and recipe_id is null
    )
    or (
      job_kind = 'transform'
      and recipe_id is not null
      and input_resource_id is not null
      and input_amount is not null
      and input_amount > 0
      and output_resource_id is not null
      and output_amount is not null
      and output_amount > 0
    )
  );

create index if not exists idx_production_jobs_player_kind_claimed
  on production_jobs(player_id, job_kind, claimed_at);

drop index if exists idx_production_jobs_active_transform_unique;

create unique index idx_production_jobs_active_transform_unique
  on production_jobs(building_id, recipe_id)
  where job_kind = 'transform' and claimed_at is null;

alter table ledger_entries
  drop constraint if exists ledger_entries_action_type_check;

alter table ledger_entries
  add constraint ledger_entries_action_type_check
  check (
    action_type in (
      'starter_grant',
      'build',
      'upgrade',
      'production_transform_started',
      'production_completed',
      'claim_production',
      'market_purchase',
      'market_sell',
      'market_fee',
      'maintenance'
    )
  );

create or replace function start_transform_job(
  p_player_id uuid,
  p_building_id uuid,
  p_recipe_id text
)
returns table (
  job_id uuid,
  building_id uuid,
  recipe_id text,
  input_resource_id text,
  input_inventory_quantity bigint,
  output_resource_id text,
  output_amount bigint,
  completes_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_building record;
  v_recipe record;
  v_inventory_quantity bigint;
  v_job_id uuid;
  v_completes_at timestamptz;
begin
  select b.id, b.player_id, b.building_type_id
  into v_building
  from buildings b
  where b.id = p_building_id
    and b.player_id = p_player_id;

  if v_building.id is null then
    raise exception 'Transform building not found for player.';
  end if;

  select r.id, r.input_resource_id, r.output_resource_id, r.input_amount, r.output_amount, r.duration_seconds
  into v_recipe
  from recipes r
  where r.id = p_recipe_id;

  if v_recipe.id is null then
    raise exception 'Transform recipe not found.';
  end if;

  if v_building.building_type_id <> 'ironridge_iron_extractor' or v_recipe.id <> 'ironridge_iron_ingot_batch' then
    raise exception 'Building cannot run this transform recipe.';
  end if;

  if exists (
    select 1
    from production_jobs pj
    where pj.building_id = p_building_id
      and pj.recipe_id = p_recipe_id
      and pj.job_kind = 'transform'
      and pj.claimed_at is null
  ) then
    raise exception 'A transform job is already active for this building.';
  end if;

  update inventories
  set
    quantity = quantity - v_recipe.input_amount,
    updated_at = now()
  where player_id = p_player_id
    and resource_id = v_recipe.input_resource_id
    and quantity >= v_recipe.input_amount
  returning quantity into v_inventory_quantity;

  if v_inventory_quantity is null then
    raise exception 'Not enough input inventory to start transform.';
  end if;

  v_completes_at := now() + make_interval(secs => v_recipe.duration_seconds);

  insert into production_jobs (
    building_id,
    player_id,
    started_at,
    completes_at,
    job_kind,
    recipe_id,
    input_resource_id,
    input_amount,
    output_resource_id,
    output_amount
  )
  values (
    p_building_id,
    p_player_id,
    now(),
    v_completes_at,
    'transform',
    v_recipe.id,
    v_recipe.input_resource_id,
    v_recipe.input_amount,
    v_recipe.output_resource_id,
    v_recipe.output_amount
  )
  returning id into v_job_id;

  insert into ledger_entries (
    player_id,
    action_type,
    amount,
    resource_id,
    metadata
  )
  values (
    p_player_id,
    'production_transform_started',
    v_recipe.output_amount,
    v_recipe.output_resource_id,
    jsonb_build_object(
      'buildingId', p_building_id,
      'recipeId', v_recipe.id,
      'inputResourceId', v_recipe.input_resource_id,
      'inputAmount', v_recipe.input_amount,
      'outputResourceId', v_recipe.output_resource_id,
      'outputAmount', v_recipe.output_amount
    )
  );

  return query
  select
    v_job_id,
    p_building_id,
    v_recipe.id,
    v_recipe.input_resource_id,
    v_inventory_quantity,
    v_recipe.output_resource_id,
    v_recipe.output_amount,
    v_completes_at;
end;
$$;

create or replace function claim_transform_job(
  p_player_id uuid,
  p_job_id uuid
)
returns table (
  job_id uuid,
  building_id uuid,
  recipe_id text,
  output_resource_id text,
  output_amount bigint,
  inventory_quantity bigint,
  claimed_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_job record;
  v_inventory_quantity bigint;
  v_claimed_at timestamptz;
begin
  select
    pj.id,
    pj.building_id,
    pj.recipe_id,
    pj.output_resource_id,
    pj.output_amount,
    pj.completes_at,
    pj.claimed_at
  into v_job
  from production_jobs pj
  where pj.id = p_job_id
    and pj.player_id = p_player_id
    and pj.job_kind = 'transform';

  if v_job.id is null then
    raise exception 'Transform job not found for player.';
  end if;

  if v_job.claimed_at is not null then
    raise exception 'Transform job has already been claimed.';
  end if;

  if v_job.completes_at > now() then
    raise exception 'Transform job is not ready to claim yet.';
  end if;

  insert into inventories (
    player_id,
    resource_id,
    quantity,
    updated_at
  )
  values (
    p_player_id,
    v_job.output_resource_id,
    v_job.output_amount,
    now()
  )
  on conflict (player_id, resource_id)
  do update set
    quantity = inventories.quantity + excluded.quantity,
    updated_at = excluded.updated_at
  returning quantity into v_inventory_quantity;

  v_claimed_at := now();

  update production_jobs
  set claimed_at = v_claimed_at
  where id = p_job_id;

  insert into ledger_entries (
    player_id,
    action_type,
    amount,
    resource_id,
    metadata
  )
  values (
    p_player_id,
    'production_completed',
    v_job.output_amount,
    v_job.output_resource_id,
    jsonb_build_object(
      'buildingId', v_job.building_id,
      'jobId', p_job_id,
      'recipeId', v_job.recipe_id
    )
  );

  return query
  select
    v_job.id,
    v_job.building_id,
    v_job.recipe_id,
    v_job.output_resource_id,
    v_job.output_amount,
    v_inventory_quantity,
    v_claimed_at;
end;
$$;
