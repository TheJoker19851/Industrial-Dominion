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
    raise exception 'Resource is not tradable.';
  end if;

  select quantity
  into v_inventory_quantity
  from inventories
  where player_id = p_player_id
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
      'feeAmount', fee_amount
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
      'grossAmount', gross_amount
    )
  );

  price_per_unit := v_base_price;
  return next;
end;
$$;

revoke all on function public.sell_inventory_resource(uuid, text, bigint, numeric) from public;
