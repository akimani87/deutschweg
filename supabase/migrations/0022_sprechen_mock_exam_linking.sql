-- DeutschWeg — Sprechen ↔ Complete Mock Exam linking (Phase B, server lifecycle).
-- Additive only. Standalone Sprechen practice is completely unaffected —
-- these columns default to NULL/false and nothing in the standalone path
-- reads or writes them.
--
-- Design context (not re-derived here): combined-mock-exam-architecture-
-- review.md, scoring-reconciliation-plan.md, and this phase's own
-- server-lifecycle review (mock_exam_attempts.sprechen_session_id already
-- existed as a forward pointer from migration 0020 — these columns are
-- what make that pointer safely fillable).

-- Which mock-exam attempt (if any) a session belongs to, and why it ended.
-- Deliberately NOT unique on mock_exam_attempt_id alone — one verified
-- technical-failure row and its one authorized restart row legitimately
-- share the same attempt id (see the partial unique index below instead,
-- which only constrains *currently live* sessions).
ALTER TABLE public.sprechen_sessions
  ADD COLUMN IF NOT EXISTS mock_exam_attempt_id uuid REFERENCES public.mock_exam_attempts(id),
  ADD COLUMN IF NOT EXISTS end_reason text,
  ADD COLUMN IF NOT EXISTS feedback_attempts integer NOT NULL DEFAULT 0;

-- Values sourced directly from the 5 real finalize(reason) call sites in
-- server.js's Sprechen WebSocket handler — nothing invented.
ALTER TABLE public.sprechen_sessions
  DROP CONSTRAINT IF EXISTS sprechen_sessions_end_reason_check;
ALTER TABLE public.sprechen_sessions
  ADD CONSTRAINT sprechen_sessions_end_reason_check
  CHECK (end_reason IS NULL OR end_reason IN
    ('client_end', 'timeout', 'upstream_closed', 'ws_error', 'ws_closed'));

-- Closes the double-start race at the database layer: at most one *live*
-- (end_reason IS NULL) session per mock-exam attempt at any moment. Historical
-- (ended) rows for the same attempt are unconstrained by this index — that's
-- what allows the one-restart row to coexist with its failed predecessor.
CREATE UNIQUE INDEX IF NOT EXISTS sprechen_sessions_one_live_per_attempt
  ON public.sprechen_sessions (mock_exam_attempt_id)
  WHERE mock_exam_attempt_id IS NOT NULL AND end_reason IS NULL;

CREATE INDEX IF NOT EXISTS sprechen_sessions_mock_exam_attempt_idx
  ON public.sprechen_sessions (mock_exam_attempt_id)
  WHERE mock_exam_attempt_id IS NOT NULL;

-- Tracks whether this attempt's one allowed technical-failure restart has
-- already been used, so a second failure can't be restarted again.
ALTER TABLE public.mock_exam_attempts
  ADD COLUMN IF NOT EXISTS sprechen_restart_used boolean NOT NULL DEFAULT false;
