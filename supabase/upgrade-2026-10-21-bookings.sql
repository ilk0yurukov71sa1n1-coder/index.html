-- Run once in Supabase: SQL Editor > New query > paste > Run. Safe to re-run.
-- Bookings from client booking pages (the first one is the demo salon at /book).
create table if not exists public.bookings (
  id bigint generated always as identity primary key,
  business text not null check (char_length(business) <= 60),
  service text not null check (char_length(service) <= 60),
  day date not null,
  start_min smallint not null check (start_min between 0 and 1439),
  duration_min smallint not null check (duration_min between 5 and 600),
  check (start_min + duration_min <= 1440),
  name text not null check (char_length(name) between 2 and 80),
  phone text not null check (char_length(phone) <= 20),
  email text check (char_length(email) <= 254),
  note text check (char_length(note) <= 300),
  lang text not null default 'bg' check (lang in ('bg', 'en')),
  status text not null default 'new' check (status in ('new', 'confirmed', 'cancelled')),
  created_at timestamptz not null default now()
);

-- Two bookings can never overlap, even when sent at the same moment;
-- a cancelled booking frees its time.
create extension if not exists btree_gist;
do $$ begin
  alter table public.bookings add constraint bookings_no_overlap
    exclude using gist (business with =, day with =, int4range(start_min, start_min + duration_min) with &&)
    where (status <> 'cancelled');
exception when duplicate_object or duplicate_table then null;
end $$;
create index if not exists bookings_by_day on public.bookings (business, day);

-- Only the server (service role key in Vercel) can read or write.
alter table public.bookings enable row level security;
revoke all on public.bookings from anon, authenticated;

-- Customer details are kept 90 days after the appointment, then deleted.
create extension if not exists pg_cron;
select cron.schedule('bookings-retention', '30 3 * * *', $$delete from public.bookings where day < current_date - interval '90 days'$$);
