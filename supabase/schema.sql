-- Quantum Traders IA — shares this Supabase project (and its auth.users)
-- with other apps, so everything lives in its own schema instead of `public`
-- to avoid clashing with tables those apps already have.
create schema if not exists quantumtraders;

-- All table access from this app goes through the service_role key
-- (lib/supabase/admin.ts), which bypasses RLS — these grants just make the
-- schema visible to that role. IMPORTANT: after running this, also add
-- "quantumtraders" to Settings -> API -> Exposed schemas in the Supabase
-- dashboard, or PostgREST will 404 on every request regardless of grants.
grant usage on schema quantumtraders to service_role;
alter default privileges in schema quantumtraders grant all on tables to service_role;

create table if not exists quantumtraders.oracle_alerts (
  id text primary key,
  type text not null,
  severity text not null,
  title text not null,
  message text not null,
  symbol text null,
  timestamp timestamptz not null default now(),
  is_read boolean not null default false,
  zone_top double precision null,
  zone_bottom double precision null,
  zone_label text null
);

create index if not exists idx_oracle_alerts_timestamp on quantumtraders.oracle_alerts (timestamp desc);
create index if not exists idx_oracle_alerts_is_read on quantumtraders.oracle_alerts (is_read);

create table if not exists quantumtraders.trade_journal_entries (
  id uuid primary key default gen_random_uuid(),
  symbol text not null,
  side text not null check (side in ('BUY', 'SELL')),
  result text not null default 'OPEN',
  profit double precision not null default 0,
  entry_price double precision null,
  stop_loss double precision null,
  take_profit double precision null,
  notes text null,
  created_at timestamptz not null default now()
);

create index if not exists idx_trade_journal_entries_created_at on quantumtraders.trade_journal_entries (created_at desc);
create index if not exists idx_trade_journal_entries_symbol on quantumtraders.trade_journal_entries (symbol);

create table if not exists quantumtraders.trade_journal_checklists (
  trade_id uuid primary key references quantumtraders.trade_journal_entries(id) on delete cascade,
  pre_structure boolean not null default false,
  pre_zone boolean not null default false,
  pre_timing boolean not null default false,
  pre_risk boolean not null default false,
  post_plan_followed boolean not null default false,
  post_execution_quality boolean not null default false,
  post_emotion_stable boolean not null default false,
  post_lesson_logged boolean not null default false,
  setup_score integer null check (setup_score between 0 and 100),
  setup_bias text null,
  confluence_count integer null check (confluence_count between 0 and 4),
  setup_rules jsonb null,
  notes text null,
  updated_at timestamptz not null default now()
);

create table if not exists quantumtraders.academy_block_progress (
  learner_id text not null,
  route_id text not null,
  block_id text not null,
  best_score integer not null default 0 check (best_score between 0 and 100),
  passed boolean not null default false,
  attempts integer not null default 0,
  completed_at timestamptz null,
  updated_at timestamptz not null default now(),
  primary key (learner_id, route_id, block_id)
);

create index if not exists idx_academy_block_progress_route on quantumtraders.academy_block_progress (route_id);
create index if not exists idx_academy_block_progress_passed on quantumtraders.academy_block_progress (passed);

create table if not exists quantumtraders.academy_badges (
  id uuid primary key default gen_random_uuid(),
  badge_code text not null unique,
  learner_id text not null,
  route_id text not null,
  route_title text not null,
  issued_at timestamptz not null default now(),
  metadata jsonb null
);

create index if not exists idx_academy_badges_learner on quantumtraders.academy_badges (learner_id);
create index if not exists idx_academy_badges_route on quantumtraders.academy_badges (route_id);

create table if not exists quantumtraders.crypto_payment_charges (
  id uuid primary key default gen_random_uuid(),
  provider text not null check (provider in ('coinbase-commerce')),
  provider_charge_id text not null unique,
  plan_id text not null,
  plan_name text not null,
  pricing_amount double precision not null default 0,
  pricing_currency text not null default 'USD',
  requested_currency text not null default 'USDC',
  status text not null default 'pending' check (status in ('pending', 'confirmed', 'failed', 'expired', 'delayed')),
  timeline_status text not null default 'NEW',
  hosted_url text not null,
  customer_email text null,
  expires_at timestamptz null,
  last_event_type text null,
  metadata jsonb null,
  confirmed_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_crypto_payment_charges_created_at on quantumtraders.crypto_payment_charges (created_at desc);
create index if not exists idx_crypto_payment_charges_status on quantumtraders.crypto_payment_charges (status);
create index if not exists idx_crypto_payment_charges_provider_charge_id on quantumtraders.crypto_payment_charges (provider_charge_id);

create table if not exists quantumtraders.crypto_payment_events (
  id bigint generated always as identity primary key,
  provider text not null check (provider in ('coinbase-commerce')),
  provider_event_id text null,
  provider_event_type text not null,
  provider_charge_id text not null,
  charge_status text not null check (charge_status in ('pending', 'confirmed', 'failed', 'expired', 'delayed')),
  timeline_status text not null,
  payload jsonb not null,
  created_at timestamptz not null default now(),
  unique (provider, provider_event_id)
);

create index if not exists idx_crypto_payment_events_created_at on quantumtraders.crypto_payment_events (created_at desc);
create index if not exists idx_crypto_payment_events_provider_charge_id on quantumtraders.crypto_payment_events (provider_charge_id);
