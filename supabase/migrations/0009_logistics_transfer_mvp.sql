create table if not exists player_locations (
  id uuid primary key default gen_random_uuid(),
  player_id uuid not null references players(id) on delete cascade,
  key text not null,
  name_key text not null,
  created_at timestamptz not null default now(),
  unique (player_id, key),
  check (key in ('primary_storage', 'remote_storage'))
);

insert into player_locations (
  player_id,
  key,
  name_key
)
select
  p.id,
  location_seed.key,
  location_seed.name_key
from players p
cross join (
  values
    ('primary_storage', 'locations.primary_storage.name'),
    ('remote_storage', 'locations.remote_storage.name')
) as location_seed(key, name_key)
on conflict (player_id, key) do nothing;

alter table inventories
  add column if not exists location_id uuid references player_locations(id) on delete cascade;

update inventories i
set location_id = pl.id
from player_locations pl
where pl.player_id = i.player_id
  and pl.key = 'primary_storage'
  and i.location_id is null;

alter table inventories
  drop constraint if exists inventories_pkey;

alter table inventories
  alter column location_id set not null;

alter table inventories
  add constraint inventories_pkey primary key (player_id, location_id, resource_id);

create index if not exists idx_inventories_player_location
  on inventories(player_id, location_id);

create table if not exists logistics_transfers (
  id uuid primary key default gen_random_uuid(),
  player_id uuid not null references players(id) on delete cascade,
  from_location_id uuid not null references player_locations(id) on delete cascade,
  to_location_id uuid not null references player_locations(id) on delete cascade,
  resource_id text not null references resources(id),
  quantity bigint not null check (quantity > 0),
  created_at timestamptz not null default now(),
  check (from_location_id <> to_location_id)
);

create index if not exists idx_logistics_transfers_player_created
  on logistics_transfers(player_id, created_at desc);

alter table player_locations enable row level security;
alter table logistics_transfers enable row level security;

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
      'logistics_transfer_out',
      'logistics_transfer_in',
      'market_purchase',
      'market_sell',
      'market_fee',
      'maintenance'
    )
  );

create or replace function get_primary_location_id(
  p_player_id uuid
)
returns uuid
language sql
security definer
set search_path = public
as $$
  select id
  from player_locations
  where player_id = p_player_id
    and key = 'primary_storage'
  limit 1;
$$;

create or replace function public.sell_inventory_resource(
  p_player_id uuid,
  p_resource_id text,
  p_quantity bigint,
  p_fee_rate numeric
)
returns table(
  order_id uuid,
  price_per_unit bigint,
  gross_amount bigint,
  fee_amount bigint,
  net_amount bigint,
  inventory_quantity bigint,
  player_credits bigint
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_base_price bigint;
  v_tradable boolean;
  v_inventory_quantity bigint;
  v_location_id uuid;
begin
  if p_quantity <= 0 then
    raise exception 'Quantity must be greater than zero.';
  end if;

  v_location_id := get_primary_location_id(p_player_id);

  if v_location_id is null then
    raise exception 'Player location not found.';
  end if;

  select base_price, tradable
  into v_base_price, v_tradable
  from resources
  where id = p_resource_id;

  if v_base_price is null then
    raise exception 'Resource not found.';
  end if;

  if not v_tradable then
    raise exception 'Resource is not tradable.';
  end if;

  select quantity
  into v_inventory_quantity
  from inventories
  where player_id = p_player_id
    and location_id = v_location_id
    and resource_id = p_resource_id
  for update;

  if v_inventory_quantity is null or v_inventory_quantity < p_quantity then
    raise exception 'Not enough inventory to sell.';
  end if;

  gross_amount := v_base_price * p_quantity;
  fee_amount := round(gross_amount * p_fee_rate)::bigint;
  net_amount := gross_amount - fee_amount;

  update inventories
  set quantity = quantity - p_quantity,
      updated_at = now()
  where player_id = p_player_id
    and location_id = v_location_id
    and resource_id = p_resource_id
  returning quantity into inventory_quantity;

  update players
  set credits = credits + net_amount,
      updated_at = now()
  where id = p_player_id
  returning credits into player_credits;

  insert into market_orders (
    player_id,
    resource_id,
    side,
    price_per_unit,
    quantity,
    remaining_quantity,
    status
  )
  values (
    p_player_id,
    p_resource_id,
    'sell',
    v_base_price,
    p_quantity,
    0,
    'filled'
  )
  returning id into order_id;

  insert into ledger_entries (
    player_id,
    action_type,
    amount,
    resource_id,
    metadata
  )
  values (
    p_player_id,
    'market_sell',
    net_amount,
    p_resource_id,
    jsonb_build_object(
      'orderId', order_id,
      'pricePerUnit', v_base_price,
      'quantitySold', p_quantity,
      'grossAmount', gross_amount,
      'feeAmount', fee_amount,
      'locationId', v_location_id
    )
  );

  insert into ledger_entries (
    player_id,
    action_type,
    amount,
    resource_id,
    metadata
  )
  values (
    p_player_id,
    'market_fee',
    fee_amount,
    p_resource_id,
    jsonb_build_object(
      'orderId', order_id,
      'pricePerUnit', v_base_price,
      'quantitySold', p_quantity,
      'grossAmount', gross_amount,
      'locationId', v_location_id
    )
  );

  price_per_unit := v_base_price;
  return next;
end;
$$;

create or replace function public.buy_market_resource(
  p_player_id uuid,
  p_resource_id text,
  p_quantity bigint
)
returns table(
  order_id uuid,
  price_per_unit bigint,
  total_cost bigint,
  inventory_quantity bigint,
  player_credits bigint
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_base_price bigint;
  v_tradable boolean;
  v_player_credits bigint;
  v_location_id uuid;
begin
  if p_quantity <= 0 then
    raise exception 'Quantity must be greater than zero.';
  end if;

  v_location_id := get_primary_location_id(p_player_id);

  if v_location_id is null then
    raise exception 'Player location not found.';
  end if;

  select base_price, tradable
  into v_base_price, v_tradable
  from resources
  where id = p_resource_id;

  if v_base_price is null then
    raise exception 'Resource not found.';
  end if;

  if not v_tradable then
    raise exception 'Resource is not purchasable.';
  end if;

  select credits
  into v_player_credits
  from players
  where id = p_player_id
  for update;

  total_cost := v_base_price * p_quantity;

  if v_player_credits is null or v_player_credits < total_cost then
    raise exception 'Not enough credits to buy resource.';
  end if;

  update players
  set credits = credits - total_cost,
      updated_at = now()
  where id = p_player_id
  returning credits into player_credits;

  insert into inventories (
    player_id,
    location_id,
    resource_id,
    quantity,
    updated_at
  )
  values (
    p_player_id,
    v_location_id,
    p_resource_id,
    p_quantity,
    now()
  )
  on conflict (player_id, location_id, resource_id)
  do update set
    quantity = inventories.quantity + excluded.quantity,
    updated_at = now()
  returning quantity into inventory_quantity;

  insert into market_orders (
    player_id,
    resource_id,
    side,
    price_per_unit,
    quantity,
    remaining_quantity,
    status
  )
  values (
    p_player_id,
    p_resource_id,
    'buy',
    v_base_price,
    p_quantity,
    0,
    'filled'
  )
  returning id into order_id;

  insert into ledger_entries (
    player_id,
    action_type,
    amount,
    resource_id,
    metadata
  )
  values (
    p_player_id,
    'market_purchase',
    -total_cost,
    p_resource_id,
    jsonb_build_object(
      'orderId', order_id,
      'pricePerUnit', v_base_price,
      'quantityPurchased', p_quantity,
      'totalCost', total_cost,
      'locationId', v_location_id
    )
  );

  price_per_unit := v_base_price;
  return next;
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
  v_location_id uuid;
begin
  v_location_id := get_primary_location_id(p_player_id);

  if v_location_id is null then
    raise exception 'Player location not found.';
  end if;

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
    and location_id = v_location_id
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
      'outputAmount', v_recipe.output_amount,
      'locationId', v_location_id
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
  v_location_id uuid;
begin
  v_location_id := get_primary_location_id(p_player_id);

  if v_location_id is null then
    raise exception 'Player location not found.';
  end if;

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
    location_id,
    resource_id,
    quantity,
    updated_at
  )
  values (
    p_player_id,
    v_location_id,
    v_job.output_resource_id,
    v_job.output_amount,
    now()
  )
  on conflict (player_id, location_id, resource_id)
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
      'recipeId', v_job.recipe_id,
      'locationId', v_location_id
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
  v_location_id uuid;
begin
  if p_runs is null or p_runs < 1 then
    raise exception 'Production runs must be at least 1.';
  end if;

  v_location_id := get_primary_location_id(p_player_id);

  if v_location_id is null then
    raise exception 'Player location not found.';
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
    and location_id = v_location_id
    and resource_id = v_recipe.input_resource_id
    and quantity >= v_total_input
  returning quantity into v_input_inventory_quantity;

  if v_input_inventory_quantity is null then
    raise exception 'Not enough input inventory to start production.';
  end if;

  insert into inventories (
    player_id,
    location_id,
    resource_id,
    quantity,
    updated_at
  )
  values (
    p_player_id,
    v_location_id,
    v_recipe.output_resource_id,
    v_total_output,
    v_completed_at
  )
  on conflict (player_id, location_id, resource_id)
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
      'instantCompletion', true,
      'locationId', v_location_id
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

create or replace function create_logistics_transfer(
  p_player_id uuid,
  p_from_location_id uuid,
  p_to_location_id uuid,
  p_item_key text,
  p_quantity bigint
)
returns table (
  transfer_id uuid,
  from_location_id uuid,
  to_location_id uuid,
  resource_id text,
  quantity bigint,
  from_inventory_quantity bigint,
  to_inventory_quantity bigint,
  created_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_from_inventory_quantity bigint;
  v_to_inventory_quantity bigint;
  v_transfer_id uuid;
  v_created_at timestamptz;
begin
  if p_quantity <= 0 then
    raise exception 'Transfer quantity must be greater than zero.';
  end if;

  if p_from_location_id = p_to_location_id then
    raise exception 'Transfer source and destination must be different.';
  end if;

  if not exists (
    select 1
    from player_locations
    where id = p_from_location_id
      and player_id = p_player_id
  ) then
    raise exception 'Transfer source location not found.';
  end if;

  if not exists (
    select 1
    from player_locations
    where id = p_to_location_id
      and player_id = p_player_id
  ) then
    raise exception 'Transfer destination location not found.';
  end if;

  update inventories
  set
    quantity = quantity - p_quantity,
    updated_at = now()
  where player_id = p_player_id
    and location_id = p_from_location_id
    and resource_id = p_item_key
    and quantity >= p_quantity
  returning quantity into v_from_inventory_quantity;

  if v_from_inventory_quantity is null then
    raise exception 'Not enough inventory in the source location.';
  end if;

  insert into inventories (
    player_id,
    location_id,
    resource_id,
    quantity,
    updated_at
  )
  values (
    p_player_id,
    p_to_location_id,
    p_item_key,
    p_quantity,
    now()
  )
  on conflict (player_id, location_id, resource_id)
  do update set
    quantity = inventories.quantity + excluded.quantity,
    updated_at = excluded.updated_at
  returning quantity into v_to_inventory_quantity;

  insert into logistics_transfers (
    player_id,
    from_location_id,
    to_location_id,
    resource_id,
    quantity
  )
  values (
    p_player_id,
    p_from_location_id,
    p_to_location_id,
    p_item_key,
    p_quantity
  )
  returning id, created_at into v_transfer_id, v_created_at;

  insert into ledger_entries (
    player_id,
    action_type,
    amount,
    resource_id,
    metadata
  )
  values (
    p_player_id,
    'logistics_transfer_out',
    p_quantity,
    p_item_key,
    jsonb_build_object(
      'transferId', v_transfer_id,
      'fromLocationId', p_from_location_id,
      'toLocationId', p_to_location_id
    )
  );

  insert into ledger_entries (
    player_id,
    action_type,
    amount,
    resource_id,
    metadata
  )
  values (
    p_player_id,
    'logistics_transfer_in',
    p_quantity,
    p_item_key,
    jsonb_build_object(
      'transferId', v_transfer_id,
      'fromLocationId', p_from_location_id,
      'toLocationId', p_to_location_id
    )
  );

  return query
  select
    v_transfer_id,
    p_from_location_id,
    p_to_location_id,
    p_item_key,
    p_quantity,
    v_from_inventory_quantity,
    v_to_inventory_quantity,
    v_created_at;
end;
$$;

revoke all on function get_primary_location_id(uuid) from public;
revoke all on function create_logistics_transfer(uuid, uuid, uuid, text, bigint) from public;
