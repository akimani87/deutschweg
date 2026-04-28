-- DeutschWeg — XP storage + atomic increment + module-completion uniqueness
-- Run in the Supabase SQL editor. Idempotent: safe to re-run.

-- 1. xp column on profiles. Defaults to 0 for existing rows.
alter table public.profiles
  add column if not exists xp integer not null default 0;

-- 2. Atomic XP increment. Use this from the client instead of read+update —
--    avoids a race where two simultaneous lesson completions overwrite each
--    other's XP delta.
create or replace function public.increment_xp(uid uuid, amt integer)
returns integer as $$
declare new_xp integer;
begin
  update public.profiles
     set xp = coalesce(xp, 0) + amt
   where id = uid
   returning xp into new_xp;
  return new_xp;
end;
$$ language plpgsql security definer;

revoke all on function public.increment_xp(uuid, integer) from public;
grant execute on function public.increment_xp(uuid, integer) to authenticated;

-- 3. Module-level completion row uniqueness. Module-completion rows are
--    stored in user_progress with lesson_id IS NULL — this partial unique
--    index lets us upsert by (user_id, module_id) for those rows without
--    conflicting with the existing per-lesson partial index.
create unique index if not exists user_progress_user_module_completion_uidx
  on public.user_progress (user_id, module_id)
  where lesson_id is null;
