create or replace function public.buy_market_resource_at_location(
  p_player_id uuid,
  p_location_id uuid,
  p_market_context_key text,
  p_resource_id text,
  p_quantity bigint,
  p_price_per_unit bigint
)
returns table(
  order_id uuid,
  price_per_unit bigint,
  total_cost bigint,
  inventory_quantity bigint,
  player_credits bigint,
  location_id uuid,
  market_context_key text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tradable boolean;
  v_player_credits bigint;
begin
  if p_quantity <= 0 then
    raise exception 'Quantity must be greater than zero.';
  end if;

  if p_price_per_unit <= 0 then
    raise exception 'Price must be greater than zero.';
  end if;

  if p_market_context_key not in ('region_anchor', 'trade_hub') then
    raise exception 'Market context is invalid.';
  end if;

  if not exists (
    select 1
    from player_locations
    where id = p_location_id
      and player_id = p_player_id
  ) then
    raise exception 'Market location not found.';
  end if;

  select tradable
  into v_tradable
  from resources
  where id = p_resource_id;

  if v_tradable is null then
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

  total_cost := p_price_per_unit * p_quantity;

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
    p_location_id,
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
    p_price_per_unit,
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
      'pricePerUnit', p_price_per_unit,
      'quantityPurchased', p_quantity,
      'totalCost', total_cost,
      'locationId', p_location_id,
      'marketContextKey', p_market_context_key
    )
  );

  price_per_unit := p_price_per_unit;
  location_id := p_location_id;
  market_context_key := p_market_context_key;
  return next;
end;
$$;

create or replace function public.sell_inventory_resource_at_location(
  p_player_id uuid,
  p_location_id uuid,
  p_market_context_key text,
  p_resource_id text,
  p_quantity bigint,
  p_price_per_unit bigint,
  p_fee_rate numeric
)
returns table(
  order_id uuid,
  price_per_unit bigint,
  gross_amount bigint,
  fee_amount bigint,
  net_amount bigint,
  inventory_quantity bigint,
  player_credits bigint,
  location_id uuid,
  market_context_key text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tradable boolean;
  v_inventory_quantity bigint;
begin
  if p_quantity <= 0 then
    raise exception 'Quantity must be greater than zero.';
  end if;

  if p_price_per_unit <= 0 then
    raise exception 'Price must be greater than zero.';
  end if;

  if p_market_context_key not in ('region_anchor', 'trade_hub') then
    raise exception 'Market context is invalid.';
  end if;

  if not exists (
    select 1
    from player_locations
    where id = p_location_id
      and player_id = p_player_id
  ) then
    raise exception 'Market location not found.';
  end if;

  select tradable
  into v_tradable
  from resources
  where id = p_resource_id;

  if v_tradable is null then
    raise exception 'Resource not found.';
  end if;

  if not v_tradable then
    raise exception 'Resource is not tradable.';
  end if;

  select quantity
  into v_inventory_quantity
  from inventories
  where player_id = p_player_id
    and location_id = p_location_id
    and resource_id = p_resource_id
  for update;

  if v_inventory_quantity is null or v_inventory_quantity < p_quantity then
    raise exception 'Not enough inventory to sell.';
  end if;

  gross_amount := p_price_per_unit * p_quantity;
  fee_amount := round(gross_amount * p_fee_rate)::bigint;
  net_amount := gross_amount - fee_amount;

  update inventories
  set quantity = quantity - p_quantity,
      updated_at = now()
  where player_id = p_player_id
    and location_id = p_location_id
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
    p_price_per_unit,
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
      'pricePerUnit', p_price_per_unit,
      'quantitySold', p_quantity,
      'grossAmount', gross_amount,
      'feeAmount', fee_amount,
      'locationId', p_location_id,
      'marketContextKey', p_market_context_key
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
      'pricePerUnit', p_price_per_unit,
      'quantitySold', p_quantity,
      'grossAmount', gross_amount,
      'locationId', p_location_id,
      'marketContextKey', p_market_context_key
    )
  );

  price_per_unit := p_price_per_unit;
  location_id := p_location_id;
  market_context_key := p_market_context_key;
  return next;
end;
$$;

revoke all on function public.buy_market_resource_at_location(uuid, uuid, text, text, bigint, bigint) from public;
revoke all on function public.sell_inventory_resource_at_location(uuid, uuid, text, text, bigint, bigint, numeric) from public;
