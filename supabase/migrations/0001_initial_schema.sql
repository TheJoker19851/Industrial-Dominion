create extension if not exists pgcrypto;

create table if not exists regions (
  id text primary key,
  name_key text not null unique,
  description_key text not null,
  created_at timestamptz not null default now(),
  check (id in ('ironridge', 'greenhaven', 'sunbarrel', 'riverplain'))
);

create table if not exists resources (
  id text primary key,
  name_key text not null unique,
  category text not null,
  tier integer not null check (tier >= 1),
  base_price bigint not null check (base_price >= 0),
  tradable boolean not null default true,
  storable boolean not null default true,
  created_at timestamptz not null default now(),
  check (category in ('raw', 'processed', 'component', 'finished', 'energy'))
);

create table if not exists building_types (
  id text primary key,
  name_key text not null unique,
  category text not null,
  created_at timestamptz not null default now(),
  check (category in ('extraction', 'processing', 'energy', 'storage', 'logistics', 'advanced'))
);

create table if not exists players (
  id uuid primary key,
  locale text not null default 'en' check (locale in ('en', 'fr')),
  credits bigint not null default 2500 check (credits >= 0),
  region_id text references regions(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists player_settings (
  player_id uuid primary key references players(id) on delete cascade,
  locale text not null default 'en' check (locale in ('en', 'fr')),
  mobile_notifications_enabled boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists recipes (
  id text primary key,
  input_resource_id text not null references resources(id),
  output_resource_id text not null references resources(id),
  input_amount bigint not null check (input_amount > 0),
  output_amount bigint not null check (output_amount > 0),
  duration_seconds integer not null check (duration_seconds > 0),
  created_at timestamptz not null default now()
);

create table if not exists buildings (
  id uuid primary key default gen_random_uuid(),
  player_id uuid not null references players(id) on delete cascade,
  region_id text not null references regions(id),
  building_type_id text not null references building_types(id),
  level integer not null default 1 check (level >= 1),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists production_jobs (
  id uuid primary key default gen_random_uuid(),
  building_id uuid not null references buildings(id) on delete cascade,
  player_id uuid not null references players(id) on delete cascade,
  started_at timestamptz not null default now(),
  completes_at timestamptz not null,
  claimed_at timestamptz,
  created_at timestamptz not null default now(),
  check (completes_at >= started_at),
  check (claimed_at is null or claimed_at >= started_at)
);

create table if not exists inventories (
  player_id uuid not null references players(id) on delete cascade,
  resource_id text not null references resources(id),
  quantity bigint not null default 0 check (quantity >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (player_id, resource_id)
);

create table if not exists market_orders (
  id uuid primary key default gen_random_uuid(),
  player_id uuid not null references players(id) on delete cascade,
  resource_id text not null references resources(id),
  side text not null check (side in ('buy', 'sell')),
  price_per_unit bigint not null check (price_per_unit > 0),
  quantity bigint not null check (quantity > 0),
  remaining_quantity bigint not null check (remaining_quantity >= 0),
  status text not null default 'open' check (status in ('open', 'filled', 'cancelled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (remaining_quantity <= quantity)
);

create table if not exists market_trades (
  id uuid primary key default gen_random_uuid(),
  buy_order_id uuid references market_orders(id),
  sell_order_id uuid references market_orders(id),
  resource_id text not null references resources(id),
  buyer_player_id uuid references players(id),
  seller_player_id uuid references players(id),
  quantity bigint not null check (quantity > 0),
  price_per_unit bigint not null check (price_per_unit > 0),
  executed_at timestamptz not null default now()
);

create table if not exists contracts (
  id uuid primary key default gen_random_uuid(),
  creator_player_id uuid not null references players(id) on delete cascade,
  counterparty_player_id uuid references players(id) on delete set null,
  status text not null default 'draft' check (status in ('draft', 'pending', 'accepted', 'rejected', 'cancelled')),
  terms jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists corporations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  ticker text not null unique,
  owner_player_id uuid not null references players(id) on delete restrict,
  created_at timestamptz not null default now()
);

create table if not exists corporation_members (
  corporation_id uuid not null references corporations(id) on delete cascade,
  player_id uuid not null references players(id) on delete cascade,
  role text not null default 'member' check (role in ('owner', 'officer', 'member')),
  joined_at timestamptz not null default now(),
  primary key (corporation_id, player_id)
);

create table if not exists corporation_channels (
  id uuid primary key default gen_random_uuid(),
  corporation_id uuid not null references corporations(id) on delete cascade,
  key text not null,
  created_at timestamptz not null default now(),
  unique (corporation_id, key)
);

create table if not exists corporation_messages (
  id uuid primary key default gen_random_uuid(),
  channel_id uuid not null references corporation_channels(id) on delete cascade,
  player_id uuid not null references players(id) on delete cascade,
  body text not null,
  created_at timestamptz not null default now()
);

create table if not exists private_conversations (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now()
);

create table if not exists private_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references private_conversations(id) on delete cascade,
  sender_player_id uuid not null references players(id) on delete cascade,
  body text not null,
  created_at timestamptz not null default now()
);

create table if not exists events (
  id text primary key,
  headline_key text not null,
  body_key text not null,
  scope text not null check (scope in ('global', 'regional')),
  polarity text not null check (polarity in ('positive', 'neutral', 'negative')),
  created_at timestamptz not null default now()
);

create table if not exists active_event_modifiers (
  id uuid primary key default gen_random_uuid(),
  event_id text not null references events(id) on delete cascade,
  region_id text references regions(id) on delete cascade,
  modifier_key text not null,
  modifier_value numeric(12, 4) not null,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  created_at timestamptz not null default now(),
  check (ends_at >= starts_at)
);

create table if not exists news_items (
  id uuid primary key default gen_random_uuid(),
  headline_key text not null,
  body_key text not null,
  scope text not null check (scope in ('system', 'global', 'regional', 'corporation')),
  region_id text references regions(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists ledger_entries (
  id uuid primary key default gen_random_uuid(),
  player_id uuid not null references players(id) on delete cascade,
  action_type text not null check (action_type in ('starter_grant', 'build', 'upgrade', 'claim_production', 'market_sell', 'market_fee', 'maintenance')),
  amount bigint not null default 0,
  resource_id text references resources(id),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists subscriptions (
  id uuid primary key default gen_random_uuid(),
  player_id uuid not null unique references players(id) on delete cascade,
  stripe_customer_id text unique,
  stripe_subscription_id text unique,
  plan_code text not null,
  status text not null default 'inactive' check (status in ('inactive', 'trialing', 'active', 'past_due', 'cancelled')),
  current_period_end timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_players_region_id on players(region_id);
create index if not exists idx_buildings_player_id on buildings(player_id);
create index if not exists idx_buildings_region_id on buildings(region_id);
create index if not exists idx_production_jobs_player_id on production_jobs(player_id);
create index if not exists idx_production_jobs_building_id on production_jobs(building_id);
create index if not exists idx_market_orders_resource_id on market_orders(resource_id);
create index if not exists idx_market_orders_player_id on market_orders(player_id);
create index if not exists idx_market_trades_resource_id on market_trades(resource_id);
create index if not exists idx_contracts_creator_player_id on contracts(creator_player_id);
create index if not exists idx_corporation_members_player_id on corporation_members(player_id);
create index if not exists idx_corporation_messages_channel_id on corporation_messages(channel_id);
create index if not exists idx_private_messages_conversation_id on private_messages(conversation_id);
create index if not exists idx_active_event_modifiers_event_id on active_event_modifiers(event_id);
create index if not exists idx_news_items_scope on news_items(scope);
create index if not exists idx_ledger_entries_player_id on ledger_entries(player_id);

alter table players enable row level security;
alter table player_settings enable row level security;
alter table regions enable row level security;
alter table resources enable row level security;
alter table building_types enable row level security;
alter table recipes enable row level security;
alter table buildings enable row level security;
alter table production_jobs enable row level security;
alter table inventories enable row level security;
alter table market_orders enable row level security;
alter table market_trades enable row level security;
alter table contracts enable row level security;
alter table corporations enable row level security;
alter table corporation_members enable row level security;
alter table corporation_channels enable row level security;
alter table corporation_messages enable row level security;
alter table private_conversations enable row level security;
alter table private_messages enable row level security;
alter table events enable row level security;
alter table active_event_modifiers enable row level security;
alter table news_items enable row level security;
alter table ledger_entries enable row level security;
alter table subscriptions enable row level security;
