create table if not exists public.oracle_alerts (
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

create index if not exists idx_oracle_alerts_timestamp on public.oracle_alerts (timestamp desc);
create index if not exists idx_oracle_alerts_is_read on public.oracle_alerts (is_read);

create table if not exists public.trade_journal_entries (
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

create index if not exists idx_trade_journal_entries_created_at on public.trade_journal_entries (created_at desc);
create index if not exists idx_trade_journal_entries_symbol on public.trade_journal_entries (symbol);
