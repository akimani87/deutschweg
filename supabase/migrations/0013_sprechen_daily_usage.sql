-- DeutschWeg — daily Sprechen usage cap (10 free minutes/day, A1)
-- Run in the Supabase SQL editor. Idempotent: safe to re-run.
--
-- Why a separate table from sprechen_session_caps: that table caps lifetime
-- session COUNT per level and never resets. This caps cumulative SESSION
-- DURATION per calendar day and resets every day — different dimension,
-- different reset cadence. One row per (user, day); seconds_used accumulates
-- as sessions finalize. usage_date is the server's UTC calendar day (v1 —
-- no per-user timezone).

create table if not exists public.sprechen_daily_usage (
  id           uuid        primary key default gen_random_uuid(),
  user_id      uuid        not null references auth.users(id) on delete cascade,
  usage_date   date        not null,
  seconds_used integer     not null default 0,
  updated_at   timestamptz not null default now()
);

do $$ begin
  if not exists (
    select 1 from pg_constraint where conname = 'sprechen_daily_usage_user_date_unique'
  ) then
    alter table public.sprechen_daily_usage
      add constraint sprechen_daily_usage_user_date_unique unique (user_id, usage_date);
  end if;
end $$;

-- ── ROW LEVEL SECURITY ────────────────────────────────────────────────────
alter table public.sprechen_daily_usage enable row level security;

drop policy if exists "own_sprechen_daily_usage_select" on public.sprechen_daily_usage;
create policy "own_sprechen_daily_usage_select" on public.sprechen_daily_usage
  for select using (auth.uid() = user_id);
