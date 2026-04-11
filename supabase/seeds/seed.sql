begin;

insert into regions (id, name_key, description_key)
values
  ('ironridge', 'regions.ironridge.name', 'regions.ironridge.description'),
  ('greenhaven', 'regions.greenhaven.name', 'regions.greenhaven.description'),
  ('sunbarrel', 'regions.sunbarrel.name', 'regions.sunbarrel.description'),
  ('riverplain', 'regions.riverplain.name', 'regions.riverplain.description')
on conflict (id) do update
set
  name_key = excluded.name_key,
  description_key = excluded.description_key;

insert into resources (
  id,
  name_key,
  category,
  tier,
  base_price,
  tradable,
  storable
)
values
  ('iron_ore', 'resources.iron_ore.name', 'raw', 1, 18, true, true),
  ('iron_ingot', 'resources.iron_ingot.name', 'processed', 2, 42, false, true),
  ('coal', 'resources.coal.name', 'raw', 1, 14, true, true),
  ('wood', 'resources.wood.name', 'raw', 1, 10, true, true),
  ('crude_oil', 'resources.crude_oil.name', 'raw', 1, 22, true, true),
  ('sand', 'resources.sand.name', 'raw', 1, 8, true, true),
  ('water', 'resources.water.name', 'raw', 1, 6, true, true),
  ('crops', 'resources.crops.name', 'raw', 1, 9, true, true)
on conflict (id) do update
set
  name_key = excluded.name_key,
  category = excluded.category,
  tier = excluded.tier,
  base_price = excluded.base_price,
  tradable = excluded.tradable,
  storable = excluded.storable;

insert into building_types (id, name_key, category)
values
  ('ironridge_iron_extractor', 'buildingTypes.ironridge_iron_extractor.name', 'extraction'),
  ('greenhaven_timber_extractor', 'buildingTypes.greenhaven_timber_extractor.name', 'extraction'),
  ('sunbarrel_oil_extractor', 'buildingTypes.sunbarrel_oil_extractor.name', 'extraction'),
  ('riverplain_water_extractor', 'buildingTypes.riverplain_water_extractor.name', 'extraction'),
  ('starter_processing_installation', 'buildingTypes.starter_processing_installation.name', 'processing')
on conflict (id) do update
set
  name_key = excluded.name_key,
  category = excluded.category;

insert into recipes (
  id,
  input_resource_id,
  output_resource_id,
  input_amount,
  output_amount,
  duration_seconds
)
values
  ('ironridge_iron_ingot_batch', 'iron_ore', 'iron_ingot', 12, 6, 3600)
on conflict (id) do update
set
  input_resource_id = excluded.input_resource_id,
  output_resource_id = excluded.output_resource_id,
  input_amount = excluded.input_amount,
  output_amount = excluded.output_amount,
  duration_seconds = excluded.duration_seconds;

insert into recipes (
  id,
  input_resource_id,
  output_resource_id,
  input_amount,
  output_amount,
  duration_seconds
)
values
  ('iron_ingot_from_iron_ore', 'iron_ore', 'iron_ingot', 2, 1, 1)
on conflict (id) do update set
  input_resource_id = excluded.input_resource_id,
  output_resource_id = excluded.output_resource_id,
  input_amount = excluded.input_amount,
  output_amount = excluded.output_amount,
  duration_seconds = excluded.duration_seconds;

insert into news_items (id, headline_key, body_key, scope)
values
  ('11111111-1111-1111-1111-111111111111', 'news.system.startup.headline', 'news.system.startup.body', 'system'),
  ('22222222-2222-2222-2222-222222222222', 'news.system.market.headline', 'news.system.market.body', 'system')
on conflict (id) do update
set
  headline_key = excluded.headline_key,
  body_key = excluded.body_key,
  scope = excluded.scope;

commit;
