-- DeutschWeg — module error-category tags (weakness -> module mapping)
-- Run in the Supabase SQL editor. Idempotent: safe to re-run.
--
-- Confirmed in feedback-audit.md: modules/lessons had no structured
-- skill/error-type taxonomy at all, only free-text titles. error_tags
-- lets a module be matched against the 11-key taxonomy in taxonomy.js
-- (e.g. 'case_and_declension', 'register_mismatch') so Exam Vault results
-- can recommend a specific module to revise for a specific weakness.
--
-- Left NULL/empty on modules that don't clearly fit any category — per
-- the tagging pass in Part B step 3, an untagged module is the correct,
-- honest result for content that isn't really "about" one of these error
-- types (e.g. a pure vocabulary-topic module like "Food & Drink").

ALTER TABLE public.modules
  ADD COLUMN IF NOT EXISTS error_tags TEXT[] NOT NULL DEFAULT '{}';

-- Quick lookup: "which modules cover this weakness" (used by the Exam
-- Vault results screen's "recommended module" pick).
CREATE INDEX IF NOT EXISTS modules_error_tags_gin_idx
  ON public.modules USING GIN (error_tags);
