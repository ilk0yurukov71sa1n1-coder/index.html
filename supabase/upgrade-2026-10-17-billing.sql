-- Billing upgrade (added 2026-10-17). Safe to run more than once.
-- Links each account to its Stripe customer and subscription.
alter table public.accounts add column if not exists stripe_customer_id text unique;
alter table public.accounts add column if not exists stripe_subscription_id text;
alter table public.accounts add column if not exists plan_status text;
alter table public.accounts add column if not exists plan_renews_at timestamptz;
alter table public.accounts add column if not exists plan_cancel_at_period_end boolean not null default false;
