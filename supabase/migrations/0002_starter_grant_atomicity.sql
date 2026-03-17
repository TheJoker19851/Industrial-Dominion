alter table players alter column credits set default 0;

create unique index if not exists idx_ledger_entries_starter_grant_player
  on ledger_entries(player_id)
  where action_type = 'starter_grant';

create or replace function grant_starter_package(
  p_player_id uuid,
  p_credits bigint,
  p_plot_count integer,
  p_warehouse_count integer
)
returns jsonb
language plpgsql
security definer
as $$
declare
  v_starter_granted bigint := 0;
begin
  insert into ledger_entries (player_id, action_type, amount, metadata)
  values (
    p_player_id,
    'starter_grant',
    p_credits,
    jsonb_build_object(
      'starterPlotCount',
      p_plot_count,
      'starterWarehouseCount',
      p_warehouse_count
    )
  )
  on conflict (player_id) where (action_type = 'starter_grant') do nothing;

  get diagnostics v_starter_granted = row_count;

  if v_starter_granted = 0 then
    return jsonb_build_object('alreadyGranted', true);
  end if;

  update players
  set
    credits = credits + p_credits,
    updated_at = now()
  where id = p_player_id;

  if not found then
    raise exception 'Player % not found for starter package grant', p_player_id;
  end if;

  return jsonb_build_object('alreadyGranted', false);
end;
$$;
