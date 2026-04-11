create index if not exists idx_market_orders_match_lookup
  on market_orders(resource_id, side, status, price_per_unit, created_at);

create or replace function create_market_limit_order(
  p_player_id uuid,
  p_resource_id text,
  p_side text,
  p_price_per_unit bigint,
  p_quantity bigint,
  p_fee_rate numeric
)
returns table (
  order_id uuid,
  resource_id text,
  side text,
  price_per_unit bigint,
  quantity bigint,
  remaining_quantity bigint,
  status text,
  player_credits bigint,
  inventory_quantity bigint,
  matched_order_id uuid,
  trade_id uuid,
  created_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_player_credits bigint;
  v_reserved_total bigint;
  v_match record;
  v_trade_price bigint;
  v_trade_total bigint;
  v_fee_amount bigint;
  v_net_amount bigint;
  v_location_id uuid;
begin
  if p_side not in ('buy', 'sell') then
    raise exception 'Market order side is invalid.';
  end if;

  if p_price_per_unit <= 0 then
    raise exception 'Market order price must be greater than zero.';
  end if;

  if p_quantity <= 0 then
    raise exception 'Market order quantity must be greater than zero.';
  end if;

  v_location_id := get_primary_location_id(p_player_id);

  if v_location_id is null then
    raise exception 'Player location not found.';
  end if;

  if not exists (
    select 1
    from resources
    where id = p_resource_id
      and tradable = true
  ) then
    raise exception 'Resource is not tradable.';
  end if;

  if p_side = 'buy' then
    v_reserved_total := p_price_per_unit * p_quantity;

    select credits
    into v_player_credits
    from players
    where id = p_player_id
    for update;

    if v_player_credits is null or v_player_credits < v_reserved_total then
      raise exception 'Not enough credits to place buy order.';
    end if;

    update players
    set credits = credits - v_reserved_total,
        updated_at = now()
    where id = p_player_id
    returning credits into player_credits;
  else
    update inventories
    set quantity = quantity - p_quantity,
        updated_at = now()
    where player_id = p_player_id
      and location_id = v_location_id
      and resource_id = p_resource_id
      and quantity >= p_quantity
    returning quantity into inventory_quantity;

    if inventory_quantity is null then
      raise exception 'Not enough inventory to place sell order.';
    end if;
  end if;

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
    p_side,
    p_price_per_unit,
    p_quantity,
    p_quantity,
    'open'
  )
  returning id, created_at into order_id, created_at;

  if p_side = 'buy' then
    select *
    into v_match
    from market_orders
    where resource_id = p_resource_id
      and side = 'sell'
      and status = 'open'
      and remaining_quantity = p_quantity
      and price_per_unit <= p_price_per_unit
      and player_id <> p_player_id
    order by price_per_unit asc, created_at asc
    limit 1
    for update;
  else
    select *
    into v_match
    from market_orders
    where resource_id = p_resource_id
      and side = 'buy'
      and status = 'open'
      and remaining_quantity = p_quantity
      and price_per_unit >= p_price_per_unit
      and player_id <> p_player_id
    order by price_per_unit desc, created_at asc
    limit 1
    for update;
  end if;

  if v_match.id is null then
    resource_id := p_resource_id;
    side := p_side;
    price_per_unit := p_price_per_unit;
    quantity := p_quantity;
    remaining_quantity := p_quantity;
    status := 'open';

    if p_side = 'buy' then
      select coalesce((
        select quantity
        from inventories
        where player_id = p_player_id
          and location_id = v_location_id
          and resource_id = p_resource_id
      ), 0)
      into inventory_quantity
      ;
    end if;

    return next;
  end if;

  matched_order_id := v_match.id;
  v_trade_price := v_match.price_per_unit;
  v_trade_total := v_trade_price * p_quantity;
  v_fee_amount := round(v_trade_total * p_fee_rate)::bigint;
  v_net_amount := v_trade_total - v_fee_amount;

  insert into market_trades (
    buy_order_id,
    sell_order_id,
    resource_id,
    buyer_player_id,
    seller_player_id,
    quantity,
    price_per_unit
  )
  values (
    case when p_side = 'buy' then order_id else v_match.id end,
    case when p_side = 'sell' then order_id else v_match.id end,
    p_resource_id,
    case when p_side = 'buy' then p_player_id else v_match.player_id end,
    case when p_side = 'sell' then p_player_id else v_match.player_id end,
    p_quantity,
    v_trade_price
  )
  returning id into trade_id;

  update market_orders
  set remaining_quantity = 0,
      status = 'filled',
      updated_at = now()
  where id in (order_id, v_match.id);

  if p_side = 'buy' then
    if v_reserved_total > v_trade_total then
      update players
      set credits = credits + (v_reserved_total - v_trade_total),
          updated_at = now()
      where id = p_player_id
      returning credits into player_credits;
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
      p_resource_id,
      p_quantity,
      now()
    )
    on conflict (player_id, location_id, resource_id)
    do update set
      quantity = inventories.quantity + excluded.quantity,
      updated_at = excluded.updated_at
    returning quantity into inventory_quantity;

    update players
    set credits = credits + v_net_amount,
        updated_at = now()
    where id = v_match.player_id;

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
      -v_trade_total,
      p_resource_id,
      jsonb_build_object(
        'orderId', order_id,
        'matchedOrderId', v_match.id,
        'tradeId', trade_id,
        'pricePerUnit', v_trade_price,
        'quantityPurchased', p_quantity
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
      v_match.player_id,
      'market_sell',
      v_net_amount,
      p_resource_id,
      jsonb_build_object(
        'orderId', v_match.id,
        'matchedOrderId', order_id,
        'tradeId', trade_id,
        'pricePerUnit', v_trade_price,
        'quantitySold', p_quantity,
        'grossAmount', v_trade_total,
        'feeAmount', v_fee_amount
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
      v_match.player_id,
      'market_fee',
      v_fee_amount,
      p_resource_id,
      jsonb_build_object(
        'orderId', v_match.id,
        'matchedOrderId', order_id,
        'tradeId', trade_id,
        'pricePerUnit', v_trade_price,
        'quantitySold', p_quantity,
        'grossAmount', v_trade_total
      )
    );
  else
    update players
    set credits = credits + v_net_amount,
        updated_at = now()
    where id = p_player_id
    returning credits into player_credits;

    select id
    into v_location_id
    from player_locations
    where player_id = v_match.player_id
      and key = 'primary_storage'
    limit 1;

    insert into inventories (
      player_id,
      location_id,
      resource_id,
      quantity,
      updated_at
    )
    values (
      v_match.player_id,
      v_location_id,
      p_resource_id,
      p_quantity,
      now()
    )
    on conflict (player_id, location_id, resource_id)
    do update set
      quantity = inventories.quantity + excluded.quantity,
      updated_at = excluded.updated_at;

    insert into ledger_entries (
      player_id,
      action_type,
      amount,
      resource_id,
      metadata
    )
    values (
      v_match.player_id,
      'market_purchase',
      -v_trade_total,
      p_resource_id,
      jsonb_build_object(
        'orderId', v_match.id,
        'matchedOrderId', order_id,
        'tradeId', trade_id,
        'pricePerUnit', v_trade_price,
        'quantityPurchased', p_quantity
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
      'market_sell',
      v_net_amount,
      p_resource_id,
      jsonb_build_object(
        'orderId', order_id,
        'matchedOrderId', v_match.id,
        'tradeId', trade_id,
        'pricePerUnit', v_trade_price,
        'quantitySold', p_quantity,
        'grossAmount', v_trade_total,
        'feeAmount', v_fee_amount
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
        'orderId', order_id,
        'matchedOrderId', v_match.id,
        'tradeId', trade_id,
        'pricePerUnit', v_trade_price,
        'quantitySold', p_quantity,
        'grossAmount', v_trade_total
      )
    );

    select coalesce(quantity, 0)
    into inventory_quantity
    from inventories
    where player_id = p_player_id
      and location_id = get_primary_location_id(p_player_id)
      and resource_id = p_resource_id;
  end if;

  resource_id := p_resource_id;
  side := p_side;
  price_per_unit := p_price_per_unit;
  quantity := p_quantity;
  remaining_quantity := 0;
  status := 'filled';
  return next;
end;
$$;

revoke all on function create_market_limit_order(uuid, text, text, bigint, bigint, numeric) from public;
