-- DeutschWeg — pal_errors table + RPC for AI Pal dual-layer error tracking
-- Run this in the Supabase SQL editor (or via the Supabase CLI).
-- Idempotent: safe to re-run.

create extension if not exists "pgcrypto";

-- ── TABLE ─────────────────────────────────────────────────────────────────
create table if not exists public.pal_errors (
  id              uuid        primary key default gen_random_uuid(),
  user_id         uuid        not null references auth.users(id) on delete cascade,
  error_category  text        not null,
  count           integer     not null default 0,
  last_seen       timestamptz not null default now(),
  module_id       text,
  user_level      text
);

-- Upsert target — one row per (user, error_category)
create unique index if not exists pal_errors_user_category_idx
  on public.pal_errors (user_id, error_category);

-- ── ROW LEVEL SECURITY ────────────────────────────────────────────────────
alter table public.pal_errors enable row level security;

drop policy if exists "own_pal_errors_select" on public.pal_errors;
create policy "own_pal_errors_select" on public.pal_errors
  for select using (auth.uid() = user_id);

drop policy if exists "own_pal_errors_insert" on public.pal_errors;
create policy "own_pal_errors_insert" on public.pal_errors
  for insert with check (auth.uid() = user_id);

drop policy if exists "own_pal_errors_update" on public.pal_errors;
create policy "own_pal_errors_update" on public.pal_errors
  for update using (auth.uid() = user_id);

-- ── RPC: increment count for an existing (user, category) row ─────────────
-- Called by the AI Pal client after a successful upsert. SECURITY DEFINER
-- so RLS doesn't block the update; the WHERE clause still scopes by user.
create or replace function public.increment_pal_error(
  p_user_id uuid,
  p_category text
) returns void as $$
begin
  update public.pal_errors
     set count     = count + 1,
         last_seen = now()
   where user_id        = p_user_id
     and error_category = p_category;
end;
$$ language plpgsql security definer;

revoke all on function public.increment_pal_error(uuid, text) from public;
grant execute on function public.increment_pal_error(uuid, text) to authenticated;
