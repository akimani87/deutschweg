-- DeutschWeg — add mini_test_id column to modules
-- Run this in the Supabase SQL editor.
-- Idempotent: safe to re-run.
--
-- Stores the filename of the per-module Quick Test page, e.g.
-- 'mini-test-a1-1.html'. The dashboard currently sources Quick Test
-- buttons from a hardcoded level+order_index → filename map in the
-- client JS; this column is the future home for that mapping once
-- we backfill it.

alter table public.modules
  add column if not exists mini_test_id text;
