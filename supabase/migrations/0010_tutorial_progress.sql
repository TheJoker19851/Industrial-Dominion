alter table player_tutorial_progress
  add column if not exists current_step text;

update player_tutorial_progress
set completed_step_ids = (
  with legacy_steps as (
    select jsonb_array_elements_text(completed_step_ids) as step_id
  ),
  mapped_steps as (
    select
      case step_id
        when 'place_extractor' then 'extract_resource'
        when 'claim_production' then 'claim_resource'
        when 'view_inventory' then 'open_inventory'
        when 'sell_resource' then 'sell_resource'
        when 'extract_resource' then 'extract_resource'
        when 'claim_resource' then 'claim_resource'
        when 'open_inventory' then 'open_inventory'
        when 'buy_resource' then 'buy_resource'
        when 'produce_resource' then 'produce_resource'
        when 'transfer_resource' then 'transfer_resource'
        else null
      end as mapped_step
    from legacy_steps
  )
  select coalesce(jsonb_agg(mapped_step), '[]'::jsonb)
  from mapped_steps
  where mapped_step is not null
);

update player_tutorial_progress
set current_step = case
  when completed_at is not null then 'complete'
  when completed_step_ids @> '["transfer_resource"]'::jsonb then 'complete'
  when completed_step_ids @> '["produce_resource"]'::jsonb then 'transfer_resource'
  when completed_step_ids @> '["buy_resource"]'::jsonb then 'produce_resource'
  when completed_step_ids @> '["sell_resource"]'::jsonb then 'buy_resource'
  when completed_step_ids @> '["open_inventory"]'::jsonb then 'sell_resource'
  when completed_step_ids @> '["claim_resource"]'::jsonb then 'open_inventory'
  else 'extract_resource'
end
where current_step is null;

alter table player_tutorial_progress
  alter column current_step set default 'extract_resource';

update player_tutorial_progress
set current_step = 'extract_resource'
where current_step is null;

alter table player_tutorial_progress
  alter column current_step set not null;

alter table player_tutorial_progress
  drop constraint if exists player_tutorial_progress_current_step_check;

alter table player_tutorial_progress
  add constraint player_tutorial_progress_current_step_check
  check (
    current_step in (
      'extract_resource',
      'claim_resource',
      'open_inventory',
      'sell_resource',
      'buy_resource',
      'produce_resource',
      'transfer_resource',
      'complete'
    )
  );
