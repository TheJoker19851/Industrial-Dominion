alter table ledger_entries
  drop constraint if exists ledger_entries_action_type_check;

alter table ledger_entries
  add constraint ledger_entries_action_type_check
  check (
    action_type in (
      'starter_grant',
      'build',
      'upgrade',
      'claim_production',
      'market_purchase',
      'market_sell',
      'market_fee',
      'maintenance'
    )
  );

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
begin
  if p_quantity <= 0 then
    raise exception 'Quantity must be greater than zero.';
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
    resource_id,
    quantity,
    updated_at
  )
  values (
    p_player_id,
    p_resource_id,
    p_quantity,
    now()
  )
  on conflict (player_id, resource_id)
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
      'totalCost', total_cost
    )
  );

  price_per_unit := v_base_price;
  return next;
end;
$$;

revoke all on function public.buy_market_resource(uuid, text, bigint) from public;
