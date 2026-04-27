-- DeutschWeg — renumber modules.order_index to level-relative + correct mini_test_id
-- Run in the Supabase SQL editor. Idempotent: safe to re-run.
--
-- The initial seed wrote the JSON's global order_index (A1: 1-13, A2: 14-25,
-- B1: 26-38, B2: 39-52). The dashboard, the mini_test_id convention, and the
-- per-level UI all expect level-relative numbering (each level restarts at 1).
-- This migration renumbers existing rows in-place, then re-derives mini_test_id
-- with the correct mock-exam exclusions.
--
-- Already applied at runtime via scripts/seed-modules.js + a one-off renumber
-- pass on 2026-04-27. This file exists so a fresh DB rebuild gets the same
-- end state without depending on the seed script's order.

-- 1. Renumber order_index per-level using row_number(). Each level becomes 1..N.
with ranked as (
  select id,
         row_number() over (partition by level order by order_index) as new_idx
    from public.modules
)
update public.modules m
   set order_index = r.new_idx
  from ranked r
 where m.id = r.id
   and m.order_index <> r.new_idx;

-- 2. Re-derive mini_test_id from the new (level, order_index).
update public.modules
   set mini_test_id = 'mini-test-' || lower(level) || '-' || order_index || '.html';

-- 3. NULL out mini_test_id for mock-exam modules (no Quick Test exists).
update public.modules
   set mini_test_id = null
 where title ilike '%mock exam%'
    or title ilike '%prüfungssimulation%';
