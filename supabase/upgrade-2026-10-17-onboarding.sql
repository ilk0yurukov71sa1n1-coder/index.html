-- Shield check (added 2026-10-17). Safe to run more than once.
-- Stores each account's answers to the sign-up assessment.
alter table public.accounts add column if not exists profile jsonb;
alter table public.accounts add column if not exists profile_at timestamptz;

-- Any OpenAI-compatible provider (added 2026-10-17): one more provider kind.
alter table public.provider_keys drop constraint if exists provider_keys_provider_check;
alter table public.provider_keys add constraint provider_keys_provider_check check (provider in ('openai', 'anthropic', 'compat'));
