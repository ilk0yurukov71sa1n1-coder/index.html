-- Studio database (Supabase project rollcfluence-studio-db, Frankfurt).
-- Bookings from client booking pages, plus what "Clients who return" needs:
-- the customer's email consent, when each email went out, and opt-outs.
-- Safe to re-run.
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
  status text not null default 'new' check (status in ('new', 'confirmed', 'cancelled', 'no_show')),
  -- Ticked by the customer on the booking form: review request and "time for your next visit".
  email_consent boolean not null default false,
  reminded_at timestamptz,
  review_asked_at timestamptz,
  winback_at timestamptz,
  created_at timestamptz not null default now()
);

create extension if not exists btree_gist;
do $$ begin
  alter table public.bookings add constraint bookings_no_overlap
    exclude using gist (business with =, day with =, int4range(start_min, start_min + duration_min) with &&)
    where (status not in ('cancelled', 'no_show'));
exception when duplicate_object or duplicate_table then null;
end $$;
create index if not exists bookings_by_day on public.bookings (business, day);
create index if not exists bookings_by_email on public.bookings (business, email) where email is not null;

-- People who clicked "stop these emails": stored as a hash of the address, never the address.
create table if not exists public.mail_optout (
  business text not null check (char_length(business) <= 60),
  email_hash text not null check (char_length(email_hash) = 64),
  created_at timestamptz not null default now(),
  primary key (business, email_hash)
);

-- Only the server (service role key in Vercel) can read or write.
alter table public.bookings enable row level security;
alter table public.mail_optout enable row level security;
revoke all on public.bookings from anon, authenticated;
revoke all on public.mail_optout from anon, authenticated;

-- Customer details are kept 90 days after the appointment, then deleted.
create extension if not exists pg_cron;
select cron.schedule('bookings-retention', '30 3 * * *', $$delete from public.bookings where day < current_date - interval '90 days'$$);

-- Daily limits, checked and inserted under one lock per business so parallel requests cannot all pass.
-- The same phone written as "+359 888…", "0888…" or "888…" has the same key (last 9 digits).
alter table public.bookings add column if not exists phone_key text generated always as (right(regexp_replace(phone, '\D', '', 'g'), 9)) stored;
create index if not exists bookings_by_created on public.bookings (business, created_at);

create or replace function public.bookings_limits() returns trigger
language plpgsql security definer set search_path = public as $$
declare since timestamptz := date_trunc('day', now() at time zone 'utc') at time zone 'utc';
begin
  perform pg_advisory_xact_lock(hashtext('bookings:' || new.business));
  if (select count(*) from bookings where business = new.business and created_at >= since) >= 60 then
    raise exception 'limit_business';
  end if;
  if (select count(*) from bookings where business = new.business and created_at >= since
      and phone_key = right(regexp_replace(new.phone, '\D', '', 'g'), 9)) >= 3 then
    raise exception 'limit_phone';
  end if;
  if new.email is not null and (select count(*) from bookings where business = new.business and created_at >= since
      and email = lower(new.email)) >= 3 then
    raise exception 'limit_email';
  end if;
  return new;
end $$;
revoke all on function public.bookings_limits() from public, anon, authenticated;
drop trigger if exists bookings_limits on public.bookings;
create trigger bookings_limits before insert on public.bookings for each row execute function public.bookings_limits();
