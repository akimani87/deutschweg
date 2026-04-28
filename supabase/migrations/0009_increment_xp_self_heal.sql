-- DeutschWeg — make increment_xp self-healing
-- Run in the Supabase SQL editor. Idempotent.
--
-- Problem 0008 left in place: increment_xp ran an UPDATE, which silently
-- affected 0 rows for any auth user that had no public.profiles row yet
-- (e.g. accounts created before the signup-flow profile insert was wired
-- up, or accounts created out-of-band via magic link / admin / SSO).
--
-- This version turns the body into an INSERT...ON CONFLICT DO UPDATE,
-- so it lazily creates the profile row on the first XP award. The new
-- row's email is pulled from auth.users (best-effort — NULL if missing).

create or replace function public.increment_xp(uid uuid, amt integer)
returns integer as $$
declare new_xp integer;
begin
  insert into public.profiles (id, xp, email)
  values (
    uid,
    amt,
    (select email from auth.users where id = uid)
  )
  on conflict (id) do update
    set xp = coalesce(public.profiles.xp, 0) + amt
  returning xp into new_xp;
  return new_xp;
end;
$$ language plpgsql security definer;

revoke all on function public.increment_xp(uuid, integer) from public;
grant execute on function public.increment_xp(uuid, integer) to authenticated;
