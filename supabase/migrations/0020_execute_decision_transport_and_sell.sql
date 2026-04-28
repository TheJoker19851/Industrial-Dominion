create or replace function public.execute_decision_transport_and_sell(
  p_player_id uuid,
  p_resource_id text,
  p_quantity bigint,
  p_origin_region text,
  p_destination_region text,
  p_fee_rate numeric,
  p_price_per_unit numeric,
  p_transport_cost bigint
)
returns table(
  decision_id uuid,
  order_id uuid,
  price_per_unit bigint,
  gross_amount bigint,
  fee_amount bigint,
  transport_cost bigint,
  net_amount bigint,
  inventory_quantity bigint,
  player_credits bigint,
  destination_region text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_decision_id uuid;
  v_order_id uuid;
  v_price_per_unit bigint;
  v_gross_amount bigint;
  v_fee_amount bigint;
  v_net_amount bigint;
  v_inventory_quantity bigint;
  v_player_credits bigint;
  v_base_price bigint;
  v_tradable boolean;
  v_inventory_quantity_before bigint;
begin
  if p_quantity <= 0 then
    raise exception 'Quantity must be greater than zero.';
  end if;

  if p_origin_region = p_destination_region then
    raise exception 'Origin and destination regions must be different.';
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
  into v_inventory_quantity_before
  from inventories
  where player_id = p_player_id
    and resource_id = p_resource_id
  for update;

  if v_inventory_quantity_before is null or v_inventory_quantity_before < p_quantity then
    raise exception 'Not enough inventory to execute decision.';
  end if;

  v_price_per_unit := round(p_price_per_unit)::bigint;
  v_gross_amount := round(p_price_per_unit * p_quantity)::bigint;
  v_fee_amount := round(v_gross_amount * p_fee_rate)::bigint;
  v_net_amount := v_gross_amount - v_fee_amount - p_transport_cost;

  update inventories
  set quantity = quantity - p_quantity,
      updated_at = now()
  where player_id = p_player_id
    and resource_id = p_resource_id
  returning quantity into v_inventory_quantity;

  update players
  set credits = credits + v_net_amount,
      updated_at = now()
  where id = p_player_id
  returning credits into v_player_credits;

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
    v_price_per_unit,
    p_quantity,
    0,
    'filled'
  )
  returning id into v_order_id;

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
    v_net_amount,
    p_resource_id,
    jsonb_build_object(
      'orderId', v_order_id,
      'pricePerUnit', v_price_per_unit,
      'basePrice', v_base_price,
      'quantitySold', p_quantity,
      'grossAmount', v_gross_amount,
      'feeAmount', v_fee_amount,
      'transportCost', p_transport_cost,
      'originRegion', p_origin_region,
      'destinationRegion', p_destination_region,
      'source', 'decision_execute_transport',
      'priceBasis', 'market_context'
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
    v_fee_amount,
    p_resource_id,
    jsonb_build_object(
      'orderId', v_order_id,
      'pricePerUnit', v_price_per_unit,
      'quantitySold', p_quantity,
      'grossAmount', v_gross_amount,
      'source', 'decision_execute_transport'
    )
  );

  insert into decision_log (
    player_id,
    strategy,
    resource_id,
    quantity,
    origin_region,
    destination_region,
    result,
    status
  )
  values (
    p_player_id,
    'TRANSPORT_AND_SELL',
    p_resource_id,
    p_quantity,
    p_origin_region,
    p_destination_region,
    jsonb_build_object(
      'orderId', v_order_id,
      'pricePerUnit', v_price_per_unit,
      'basePrice', v_base_price,
      'grossAmount', v_gross_amount,
      'feeAmount', v_fee_amount,
      'transportCost', p_transport_cost,
      'netAmount', v_net_amount,
      'creditsBefore', v_player_credits - v_net_amount,
      'creditsAfter', v_player_credits,
      'originRegion', p_origin_region,
      'destinationRegion', p_destination_region,
      'priceBasis', 'market_context'
    ),
    'executed'
  )
  returning id into v_decision_id;

  decision_id := v_decision_id;
  order_id := v_order_id;
  price_per_unit := v_price_per_unit;
  gross_amount := v_gross_amount;
  fee_amount := v_fee_amount;
  transport_cost := p_transport_cost;
  net_amount := v_net_amount;
  inventory_quantity := v_inventory_quantity;
  player_credits := v_player_credits;
  destination_region := p_destination_region;
  return next;
end;
$$;

revoke all on function public.execute_decision_transport_and_sell(uuid, text, bigint, text, text, numeric, numeric, bigint) from public;
