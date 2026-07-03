-- DeutschWeg — Wörterbuch cache index + uniqueness guard
-- Run in the Supabase SQL editor. Idempotent: safe to re-run.
--
-- Why:
--   The /api/dictionary/:word endpoint looks up words with
--   ILIKE (case-insensitive). Without an index, every lookup is
--   a full table scan — fine at 17 rows, degrades at 1 000+.
--
--   An expression index on lower(word) serves two purposes:
--   1. Postgres can use it to satisfy `word ILIKE 'anmeldung'`
--      in O(log n) instead of O(n) once the normalised input is
--      already lowercase (which normalizeDictWord now enforces).
--   2. The UNIQUE constraint prevents case-variant duplicates:
--      "Haus" and "haus" can never both exist in the table.
--
--   Existing 17 rows are unaffected — their stored word values
--   remain as Claude generated them (proper German casing like
--   "Anmeldung"). The index operates on lower() at query time.

CREATE UNIQUE INDEX IF NOT EXISTS dictionary_word_lower_idx
  ON public.dictionary (lower(word));
