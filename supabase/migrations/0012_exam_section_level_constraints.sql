-- DeutschWeg — enforce canonical case + values for exams.level + exams.section
-- Run in the Supabase SQL editor. Idempotent: safe to re-run.
--
-- Why: the client filters published exams with .eq('level', 'A1') /
-- .eq('section', 'lesen'). Postgres equality is case-sensitive, so
-- accidental Title-case inserts ('Lesen', 'Schreiben') silently
-- disappear from the UI. Twice now (A2 and B1) seeded rows landed
-- with capital-letter sections and stayed invisible until normalised
-- by hand. These CHECK constraints reject any future insert/update
-- that doesn't match the convention so the bug can't recur.
--
-- The IN-lists also act as a typo guard — values like 'reading',
-- 'A2.1', or '' will be rejected. Extend the lists when you add
-- new CEFR levels (C1/C2) or new exam sections (Hören, Sprechen).
--
-- Convention:
--   level   → uppercase: 'A1', 'A2', 'B1', 'B2', 'C1', 'C2'
--   section → lowercase: 'lesen', 'schreiben', 'hoeren', 'sprechen'

do $$ begin
  if not exists (
    select 1 from pg_constraint where conname = 'exams_level_valid'
  ) then
    alter table public.exams
      add constraint exams_level_valid
      check (level in ('A1', 'A2', 'B1', 'B2', 'C1', 'C2'));
  end if;
end $$;

do $$ begin
  if not exists (
    select 1 from pg_constraint where conname = 'exams_section_valid'
  ) then
    alter table public.exams
      add constraint exams_section_valid
      check (section in ('lesen', 'schreiben', 'hoeren', 'sprechen'));
  end if;
end $$;
