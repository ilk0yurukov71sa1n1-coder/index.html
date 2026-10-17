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
