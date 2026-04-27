create table if not exists decision_log (
  id uuid primary key default gen_random_uuid(),
  player_id uuid not null references players(id) on delete cascade,
  strategy text not null check (strategy in ('SELL_LOCAL', 'PROCESS_AND_SELL_LOCAL', 'TRANSPORT_AND_SELL', 'PROCESS_THEN_TRANSPORT_AND_SELL')),
  resource_id text not null references resources(id),
  quantity bigint not null check (quantity > 0),
  origin_region text not null references regions(id),
  destination_region text references regions(id),
  result jsonb not null default '{}'::jsonb,
  status text not null default 'executed' check (status in ('executed', 'recorded', 'failed')),
  created_at timestamptz not null default now()
);

create index if not exists idx_decision_log_player_id on decision_log(player_id);
create index if not exists idx_decision_log_created_at on decision_log(created_at desc);

alter table decision_log enable row level security;

create or replace function public.execute_decision_sell_local(
  p_player_id uuid,
  p_resource_id text,
  p_quantity bigint,
  p_origin_region text,
  p_fee_rate numeric
)
returns table(
  decision_id uuid,
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

  v_gross_amount := v_base_price * p_quantity;
  v_fee_amount := round(v_gross_amount * p_fee_rate)::bigint;
  v_net_amount := v_gross_amount - v_fee_amount;

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
    v_base_price,
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
      'pricePerUnit', v_base_price,
      'quantitySold', p_quantity,
      'grossAmount', v_gross_amount,
      'feeAmount', v_fee_amount,
      'source', 'decision_execute'
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
      'pricePerUnit', v_base_price,
      'quantitySold', p_quantity,
      'grossAmount', v_gross_amount,
      'source', 'decision_execute'
    )
  );

  insert into decision_log (
    player_id,
    strategy,
    resource_id,
    quantity,
    origin_region,
    result,
    status
  )
  values (
    p_player_id,
    'SELL_LOCAL',
    p_resource_id,
    p_quantity,
    p_origin_region,
    jsonb_build_object(
      'orderId', v_order_id,
      'pricePerUnit', v_base_price,
      'grossAmount', v_gross_amount,
      'feeAmount', v_fee_amount,
      'netAmount', v_net_amount,
      'creditsBefore', v_player_credits - v_net_amount,
      'creditsAfter', v_player_credits
    ),
    'executed'
  )
  returning id into v_decision_id;

  decision_id := v_decision_id;
  order_id := v_order_id;
  price_per_unit := v_base_price;
  gross_amount := v_gross_amount;
  fee_amount := v_fee_amount;
  net_amount := v_net_amount;
  inventory_quantity := v_inventory_quantity;
  player_credits := v_player_credits;
  return next;
end;
$$;

revoke all on function public.execute_decision_sell_local(uuid, text, bigint, text, numeric) from public;
