-- DeutschWeg — add is_mock_exam column to modules
-- Run in the Supabase SQL editor. Idempotent: safe to re-run.
--
-- Replaces the slug/filename/title regex heuristic the seed script used
-- to detect mock-exam modules. The DB column is the post-seed source of
-- truth: rows with is_mock_exam=true link to bespoke HTML pages with
-- timer/section logic; the dashboard skips Quick Test buttons for them
-- (mini_test_id is also NULL for these rows).
--
-- Already applied to live Supabase on 2026-04-27 (column added + the
-- two mock-exam rows flipped to true). This file exists so a fresh DB
-- rebuild gets the same end state without depending on the seed script.

alter table public.modules
  add column if not exists is_mock_exam boolean not null default false;

-- Backfill: flag the two existing mock-exam rows.
-- Title patterns are stable here (Goethe naming); future mock exams
-- should be flagged explicitly via this column rather than by title.
update public.modules
   set is_mock_exam = true
 where title ilike '%mock exam%'
    or title ilike '%prüfungssimulation%';
