-- Defense upgrade (added 2026-10-17). Safe to run more than once.

-- Per-key defenses: IP allow-list, blocked countries, a per-request token
-- ceiling, an expiry date, automatic locking, and a lock that can be undone.
alter table public.gateway_keys add column if not exists ip_allowlist text[];
alter table public.gateway_keys add column if not exists blocked_countries text[];
alter table public.gateway_keys add column if not exists max_tokens integer check (max_tokens is null or max_tokens between 1 and 1000000);
alter table public.gateway_keys add column if not exists expires_at timestamptz;
alter table public.gateway_keys add column if not exists auto_lock boolean not null default true;
alter table public.gateway_keys add column if not exists suspended_at timestamptz;

-- Where alerts go. Slack, Discord and webhook URLs are encrypted by the
-- server (AES-256-GCM) before they reach the database.
create table if not exists public.alert_channels (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts (id) on delete cascade,
  kind text not null check (kind in ('email', 'slack', 'discord', 'webhook')),
  label text check (char_length(label) <= 60),
  target text not null,
  target_hint text,
  secret text,
  events text[] not null default '{}',
  created_at timestamptz not null default now(),
  last_sent_at timestamptz,
  last_ok boolean
);
create index if not exists alert_channels_account_idx on public.alert_channels (account_id);

-- Security log: who changed which setting, and what Shield did on its own.
create table if not exists public.audit_events (
  id bigint generated always as identity primary key,
  account_id uuid not null references public.accounts (id) on delete cascade,
  action text not null,
  detail text check (char_length(detail) <= 300),
  created_at timestamptz not null default now()
);
create index if not exists audit_events_account_idx on public.audit_events (account_id, created_at desc);

alter table public.alert_channels enable row level security;
alter table public.audit_events enable row level security;
revoke all on public.alert_channels, public.audit_events from anon, authenticated;
