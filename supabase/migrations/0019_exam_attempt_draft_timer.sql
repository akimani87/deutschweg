-- DeutschWeg — Exam Vault per-section timer persistence (Part 2).
-- The countdown deadline is an absolute timestamp (computed once when the
-- section starts) rather than a "seconds remaining" number, so a reload
-- can recompute the true remaining time from wall-clock time instead of
-- drifting based on how often autosave last ran.

ALTER TABLE public.exam_attempt_drafts
  ADD COLUMN IF NOT EXISTS timer_ends_at timestamptz;
