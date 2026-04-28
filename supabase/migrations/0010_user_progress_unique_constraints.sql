-- DeutschWeg — formal unique constraints on user_progress for PostgREST upserts
-- Run in the Supabase SQL editor. Idempotent (DO blocks check pg_constraint first).
--
-- Why this exists, even though 0007 already created partial unique indexes:
-- PostgREST's onConflict=<cols> parameter requires a NAMED unique constraint
-- (or unique index) whose column list matches *exactly*. Partial indexes
-- with a WHERE predicate aren't accepted — a write with onConflict=user_id,
-- lesson_id against the partial index from 0007 fails with PG 42P10
-- ("there is no unique or exclusion constraint matching the ON CONFLICT
-- specification"). Adding a non-partial UNIQUE constraint fixes this.
--
-- Module-completion rows (lesson_id IS NULL) can't be upserted via
-- onConflict because NULL columns are treated as distinct in unique
-- constraints — a duplicate-NULL row would never trigger a conflict.
-- The application code uses SELECT-then-INSERT for those rows instead.
-- The 3-column constraint below is harmless redundancy that documents
-- the row identity for lesson rows.

do $$ begin
  if not exists (
    select 1 from pg_constraint where conname = 'user_progress_user_lesson_unique'
  ) then
    alter table public.user_progress
      add constraint user_progress_user_lesson_unique unique (user_id, lesson_id);
  end if;
end $$;

do $$ begin
  if not exists (
    select 1 from pg_constraint where conname = 'user_progress_user_module_unique'
  ) then
    alter table public.user_progress
      add constraint user_progress_user_module_unique unique (user_id, module_id, lesson_id);
  end if;
end $$;
