-- Run once in Supabase: SQL Editor > New query > paste > Run. Safe to re-run.
-- Creates every table the site, the dashboard and the gateway use.
create table if not exists public.waitlist (
  id bigint generated always as identity primary key,
  email text not null unique check (char_length(email) <= 254),
  source text not null default 'landing',
  country text,
  created_at timestamptz not null default now()
);

-- Only the server (service role key in Vercel) can read or write.
-- RLS on with no policies means the public anon key gets nothing.
alter table public.waitlist enable row level security;
revoke all on public.waitlist from anon, authenticated;

-- Questions people leave in the chat helper.
create table if not exists public.questions (
  id bigint generated always as identity primary key,
  email text not null check (char_length(email) <= 254),
  question text not null check (char_length(question) between 3 and 2000),
  country text,
  answered boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.questions enable row level security;
revoke all on public.questions from anon, authenticated;

-- Added 2026-10-16: signup goal and email verification. Safe to re-run.
alter table public.waitlist add column if not exists goal text check (char_length(goal) <= 60);
alter table public.waitlist add column if not exists verified boolean not null default false;
alter table public.waitlist add column if not exists verified_at timestamptz;

-- ─────────────────────────────────────────────────────────────
-- Shield gateway (added 2026-10-16)

create extension if not exists pgcrypto;

alter table public.waitlist add column if not exists approved_at timestamptz;

-- One row per customer who has been let in.
create table if not exists public.accounts (
  id uuid primary key default gen_random_uuid(),
  email text not null unique check (char_length(email) <= 254),
  plan text not null default 'starter' check (plan in ('starter', 'pro', 'team', 'business')),
  created_at timestamptz not null default now(),
  last_login_at timestamptz
);

-- Keys we give customers (rk_live_...). Only a SHA-256 fingerprint is stored,
-- so a database leak exposes no usable key.
create table if not exists public.gateway_keys (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts (id) on delete cascade,
  name text not null default 'Default' check (char_length(name) between 1 and 60),
  prefix text not null,
  key_hash text not null unique,
  daily_cap_micros bigint check (daily_cap_micros is null or daily_cap_micros >= 0),
  monthly_cap_micros bigint check (monthly_cap_micros is null or monthly_cap_micros >= 0),
  rpm_limit integer not null default 60 check (rpm_limit between 1 and 10000),
  allowed_models text[],
  injection_filter boolean not null default true,
  pii_redaction boolean not null default false,
  created_at timestamptz not null default now(),
  last_used_at timestamptz,
  revoked_at timestamptz
);
create index if not exists gateway_keys_account_idx on public.gateway_keys (account_id);

-- The customer's own OpenAI / Anthropic keys, encrypted with AES-256-GCM by
-- the server before they reach the database. Never returned to the browser.
create table if not exists public.provider_keys (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts (id) on delete cascade,
  provider text not null check (provider in ('openai', 'anthropic')),
  ciphertext text not null,
  last4 text not null,
  created_at timestamptz not null default now(),
  unique (account_id, provider)
);

-- One row per request through the gateway, allowed or blocked.
create table if not exists public.usage_events (
  id bigint generated always as identity primary key,
  account_id uuid not null references public.accounts (id) on delete cascade,
  key_id uuid references public.gateway_keys (id) on delete set null,
  provider text,
  model text,
  status integer not null,
  blocked_reason text,
  input_tokens integer not null default 0,
  output_tokens integer not null default 0,
  cost_micros bigint not null default 0,
  latency_ms integer,
  created_at timestamptz not null default now()
);
create index if not exists usage_events_account_idx on public.usage_events (account_id, created_at desc);
create index if not exists usage_events_key_idx on public.usage_events (key_id, created_at desc);

-- Spend of one key since a moment in time, in millionths of a dollar.
create or replace function public.key_spend(p_key uuid, p_since timestamptz)
returns bigint language sql stable as $$
  select coalesce(sum(cost_micros), 0)::bigint from public.usage_events
  where key_id = p_key and created_at >= p_since;
$$;

alter table public.accounts enable row level security;
alter table public.gateway_keys enable row level security;
alter table public.provider_keys enable row level security;
alter table public.usage_events enable row level security;
revoke all on public.accounts, public.gateway_keys, public.provider_keys, public.usage_events from anon, authenticated;
revoke execute on function public.key_spend(uuid, timestamptz) from anon, authenticated, public;

-- Live view (added 2026-10-16): where each request came from and which of
-- the customer's users sent it. Country and city come from Vercel's IP
-- lookup; the IP address itself is never stored.
alter table public.usage_events add column if not exists country text check (char_length(country) <= 2);
alter table public.usage_events add column if not exists city text check (char_length(city) <= 80);
alter table public.usage_events add column if not exists lat real;
alter table public.usage_events add column if not exists lon real;
alter table public.usage_events add column if not exists end_user text check (char_length(end_user) <= 128);

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

-- Billing upgrade (added 2026-10-17). Safe to run more than once.
-- Links each account to its Stripe customer and subscription.
alter table public.accounts add column if not exists stripe_customer_id text unique;
alter table public.accounts add column if not exists stripe_subscription_id text;
alter table public.accounts add column if not exists plan_status text;
alter table public.accounts add column if not exists plan_renews_at timestamptz;
alter table public.accounts add column if not exists plan_cancel_at_period_end boolean not null default false;

-- Feedback from the website and the dashboard.
create table if not exists public.feedback (
  id bigint generated always as identity primary key,
  rating smallint not null check (rating between 1 and 5),
  message text check (char_length(message) <= 2000),
  email text check (char_length(email) <= 254),
  page text check (char_length(page) <= 60),
  country text,
  created_at timestamptz not null default now()
);
alter table public.feedback enable row level security;
revoke all on public.feedback from anon, authenticated;

-- New Scale plan (added 2026-10-17).
alter table public.accounts drop constraint if exists accounts_plan_check;
alter table public.accounts add constraint accounts_plan_check check (plan in ('starter', 'pro', 'team', 'scale', 'business'));

-- Keep 90 days of request history, so the table does not grow forever.
-- Runs every night at 03:15 UTC inside Supabase.
create extension if not exists pg_cron;
select cron.schedule('shield-usage-retention', '15 3 * * *', $$delete from public.usage_events where created_at < now() - interval '90 days'$$);
