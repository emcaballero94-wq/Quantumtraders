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

-- Trade Audit — AUTO RECORD fields (populated by MT5 later) + MANUAL RECORD
-- tagging (available today via the entry form). `source` distinguishes the
-- two so Trade Audit can eventually cross-reference them, per the product
-- direction: auto-captured execution data vs. trader-logged context.
alter table quantumtraders.trade_journal_entries
  add column if not exists lot_size double precision null,
  add column if not exists exit_price double precision null,
  add column if not exists commission double precision not null default 0,
  add column if not exists swap double precision not null default 0,
  add column if not exists closed_at timestamptz null,
  add column if not exists source text not null default 'manual' check (source in ('manual', 'mt5'));

alter table quantumtraders.trade_journal_checklists
  add column if not exists emotion_tag text null,
  add column if not exists mistake_tag text null;

-- Order Flow AI briefs — one row per generated brief (every ~60s while the
-- page is open, per symbol). Key signals are pulled out into their own
-- columns so the backtest endpoint can do numeric analysis without parsing
-- jsonb on every row; the full snapshot is kept in `snapshot` for reference.
create table if not exists quantumtraders.orderflow_briefs (
  id uuid primary key default gen_random_uuid(),
  symbol text not null,
  brief_text text not null,
  price double precision null,
  cvd double precision null,
  funding_rate double precision null,
  open_interest double precision null,
  book_imbalance double precision null,
  liquidation_long_notional double precision null,
  liquidation_short_notional double precision null,
  snapshot jsonb not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_orderflow_briefs_symbol_created_at on quantumtraders.orderflow_briefs (symbol, created_at);

-- CVD and liquidation notionals are client-side accumulators that reset to
-- zero whenever the Order Flow page (re)loads — they are NOT a homogeneous
-- time series across browser sessions. These markers record which "session"
-- each row's cvd/liquidation values belong to, so M.A.N.U. can tell a real
-- change in flow apart from a reset, instead of silently diffing values that
-- may not be comparable. Null on rows written before this column existed —
-- those are treated as "unknown session" (never compared across time).
alter table quantumtraders.orderflow_briefs
  add column if not exists cvd_session_started_at timestamptz null,
  add column if not exists liquidations_session_started_at timestamptz null;

-- M.A.N.U. market events — only HIGH/CRITICAL severity events are inserted
-- here (see app/api/manu/analyze/route.ts), so the intraday timeline
-- ("¿cuándo apareció el primer aumento de OI?", "¿cuántos eventos de
-- liquidación tuvimos?") can be reconstructed without re-running change
-- detection over the full orderflow_briefs history on every query. LOW/MEDIUM
-- events are still shown live in the UI, just not persisted.
create table if not exists quantumtraders.market_events (
  id uuid primary key default gen_random_uuid(),
  symbol text not null,
  type text not null,
  severity text not null check (severity in ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL')),
  evidence text not null,
  values jsonb not null,
  previous_values jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

-- One row per (asset_class, symbol, snapshot_date) — a daily close-of-day GEX
-- snapshot across the nearest N expirations, written by the
-- /api/cron/gex-snapshot job (see app/api/cron/gex-snapshot/route.ts). This is
-- what lets the GEX page eventually compare "today vs. the prior session"
-- (walls/flip/regime shift) and replay a past day's heatmap — neither is
-- possible from the live-only /api/market/gex endpoint, which has no memory.
-- `matrix` holds the full GexMatrixResult (lib/gex/matrix.ts) as jsonb; the
-- handful of scalar columns are pulled out for cheap day-over-day diffing
-- without parsing jsonb on every comparison query.
create table if not exists quantumtraders.gex_snapshots (
  id uuid primary key default gen_random_uuid(),
  asset_class text not null check (asset_class in ('equity', 'crypto')),
  symbol text not null,
  snapshot_date date not null,
  underlying_price double precision not null,
  net_gex double precision not null,
  call_wall_strike double precision null,
  put_wall_strike double precision null,
  gamma_flip double precision null,
  matrix jsonb not null,
  captured_at timestamptz not null default now(),
  unique (asset_class, symbol, snapshot_date)
);

create index if not exists idx_gex_snapshots_symbol_date on quantumtraders.gex_snapshots (asset_class, symbol, snapshot_date);

create index if not exists idx_market_events_symbol_created_at on quantumtraders.market_events (symbol, created_at);

-- One row per generated M.A.N.U. GEX & Options brief (app/api/manu/gex-analyze)
-- — unlike orderflow_briefs this isn't written on a fixed cadence, only
-- whenever someone opens/refreshes the GEX page, since options chains don't
-- move tick-by-tick. Lets the page show "briefs anteriores" the same way
-- Order Flow does, instead of losing the narrative on every page reload.
create table if not exists quantumtraders.gex_briefs (
  id uuid primary key default gen_random_uuid(),
  asset_class text not null check (asset_class in ('equity', 'crypto')),
  symbol text not null,
  status text not null,
  key_change text not null,
  narrative text not null,
  narrative_source text not null check (narrative_source in ('ai', 'deterministic')),
  facts jsonb not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_gex_briefs_symbol_created_at on quantumtraders.gex_briefs (asset_class, symbol, created_at);
