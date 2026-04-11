insert into building_types (id, name_key, category)
values (
  'starter_processing_installation',
  'buildingTypes.starter_processing_installation.name',
  'processing'
)
on conflict (id) do update
set
  name_key = excluded.name_key,
  category = excluded.category;
