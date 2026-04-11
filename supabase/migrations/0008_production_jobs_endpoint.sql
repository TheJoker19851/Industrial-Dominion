insert into recipes (
  id,
  input_resource_id,
  output_resource_id,
  input_amount,
  output_amount,
  duration_seconds
)
values (
  'iron_ingot_from_iron_ore',
  'iron_ore',
  'iron_ingot',
  2,
  1,
  1
)
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

  if v_recipe.id is null or v_recipe.id <> 'iron_ingot_from_iron_ore' then
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
