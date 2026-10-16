-- Run once in Supabase: SQL Editor > New query > paste > Run.
-- Creates the tables /api/waitlist and /api/questions write to.
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
