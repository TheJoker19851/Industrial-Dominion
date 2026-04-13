insert into resources (
  id,
  name_key,
  category,
  tier,
  base_price,
  tradable,
  storable
)
values (
  'plank',
  'resources.plank.name',
  'processed',
  2,
  26,
  true,
  true
)
on conflict (id) do update
set
  name_key = excluded.name_key,
  category = excluded.category,
  tier = excluded.tier,
  base_price = excluded.base_price,
  tradable = excluded.tradable,
  storable = excluded.storable;

insert into recipes (
  id,
  input_resource_id,
  output_resource_id,
  input_amount,
  output_amount,
  duration_seconds
)
values
  ('greenhaven_plank_batch', 'wood', 'plank', 12, 6, 1800),
  ('plank_from_wood', 'wood', 'plank', 2, 1, 1)
on conflict (id) do update
set
  input_resource_id = excluded.input_resource_id,
  output_resource_id = excluded.output_resource_id,
  input_amount = excluded.input_amount,
  output_amount = excluded.output_amount,
  duration_seconds = excluded.duration_seconds;

create or replace function create_production_job(
  p_player_id uuid,
  p_recipe_key text,
  p_runs integer
)
returns table (
  job_id uuid,
  building_id uuid,
  recipe_key text,
  runs integer,
  input_resource_id text,
  input_amount bigint,
  input_inventory_quantity bigint,
  output_resource_id text,
  output_amount bigint,
  output_inventory_quantity bigint,
  completed_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_building_id uuid;
  v_recipe record;
  v_total_input bigint;
  v_total_output bigint;
  v_input_inventory_quantity bigint;
  v_output_inventory_quantity bigint;
  v_job_id uuid;
  v_completed_at timestamptz;
begin
  if p_runs is null or p_runs < 1 then
    raise exception 'Production runs must be at least 1.';
  end if;

  select b.id
  into v_building_id
  from buildings b
  where b.player_id = p_player_id
  order by b.created_at asc
  limit 1;

  if v_building_id is null then
    raise exception 'Production structure not found for player.';
  end if;

  select
    r.id,
    r.input_resource_id,
    r.output_resource_id,
    r.input_amount,
    r.output_amount
  into v_recipe
  from recipes r
  where r.id = p_recipe_key;

  if v_recipe.id is null then
    raise exception 'Production recipe not found.';
  end if;

  v_total_input := v_recipe.input_amount * p_runs;
  v_total_output := v_recipe.output_amount * p_runs;
  v_completed_at := now();

  update inventories
  set
    quantity = quantity - v_total_input,
    updated_at = v_completed_at
  where player_id = p_player_id
    and resource_id = v_recipe.input_resource_id
    and quantity >= v_total_input
  returning quantity into v_input_inventory_quantity;

  if v_input_inventory_quantity is null then
    raise exception 'Not enough input inventory to start production.';
  end if;

  insert into inventories (
    player_id,
    resource_id,
    quantity,
    updated_at
  )
  values (
    p_player_id,
    v_recipe.output_resource_id,
    v_total_output,
    v_completed_at
  )
  on conflict (player_id, resource_id)
  do update set
    quantity = inventories.quantity + excluded.quantity,
    updated_at = excluded.updated_at
  returning quantity into v_output_inventory_quantity;

  insert into production_jobs (
    building_id,
    player_id,
    started_at,
    completes_at,
    claimed_at,
    job_kind,
    recipe_id,
    input_resource_id,
    input_amount,
    output_resource_id,
    output_amount
  )
  values (
    v_building_id,
    p_player_id,
    v_completed_at,
    v_completed_at,
    v_completed_at,
    'transform',
    v_recipe.id,
    v_recipe.input_resource_id,
    v_total_input,
    v_recipe.output_resource_id,
    v_total_output
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
    'production_completed',
    v_total_output,
    v_recipe.output_resource_id,
    jsonb_build_object(
      'jobId', v_job_id,
      'buildingId', v_building_id,
      'recipeKey', v_recipe.id,
      'runs', p_runs,
      'inputResourceId', v_recipe.input_resource_id,
      'inputAmount', v_total_input,
      'outputResourceId', v_recipe.output_resource_id,
      'outputAmount', v_total_output,
      'instantCompletion', true
    )
  );

  return query
  select
    v_job_id,
    v_building_id,
    v_recipe.id,
    p_runs,
    v_recipe.input_resource_id,
    v_total_input,
    v_input_inventory_quantity,
    v_recipe.output_resource_id,
    v_total_output,
    v_output_inventory_quantity,
    v_completed_at;
end;
$$;

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

  if v_building.building_type_id = 'ironridge_iron_extractor' and v_recipe.id <> 'ironridge_iron_ingot_batch' then
    raise exception 'Building cannot run this transform recipe.';
  end if;

  if v_building.building_type_id = 'greenhaven_timber_extractor' and v_recipe.id <> 'greenhaven_plank_batch' then
    raise exception 'Building cannot run this transform recipe.';
  end if;

  if v_building.building_type_id not in ('ironridge_iron_extractor', 'greenhaven_timber_extractor') then
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
