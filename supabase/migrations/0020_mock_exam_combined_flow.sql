-- DeutschWeg — "Complete Mock Exam" combined-flow schema (Phase 1).
-- Wraps the existing per-section exams/exam_tasks/exam_attempts tables
-- rather than replacing them — combined-mock-exam-architecture-review.md
-- Section D. Standalone "Practice by Skill" attempts are completely
-- unaffected; these tables are additive.

-- The parent "set" — links one exam per section for a given level+number.
-- Nullable per-section FKs so a set can exist even if a section (e.g.
-- Sprechen, or a not-yet-seeded Hören Übungssatz) isn't wired in yet.
CREATE TABLE IF NOT EXISTS public.mock_exam_sets (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  level              text NOT NULL,
  set_number         integer NOT NULL,
  title              text NOT NULL,
  hoeren_exam_id     uuid REFERENCES public.exams(id),
  lesen_exam_id      uuid REFERENCES public.exams(id),
  schreiben_exam_id  uuid REFERENCES public.exams(id),
  sprechen_topic_ids uuid[],
  is_published       boolean NOT NULL DEFAULT false,
  created_at         timestamptz NOT NULL DEFAULT now(),
  UNIQUE (level, set_number)
);

ALTER TABLE public.mock_exam_sets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read published mock exam sets"
  ON public.mock_exam_sets FOR SELECT
  USING (is_published = true);

-- The overall attempt — one row per learner per "run" through a set.
-- Tracks which leg they're on; rolls up to the per-section exam_attempts
-- rows via the *_attempt_id FKs rather than duplicating any scoring data.
CREATE TABLE IF NOT EXISTS public.mock_exam_attempts (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id               uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  set_id                uuid NOT NULL REFERENCES public.mock_exam_sets(id),
  current_section       text,
  hoeren_attempt_id     uuid REFERENCES public.exam_attempts(id),
  lesen_attempt_id      uuid REFERENCES public.exam_attempts(id),
  schreiben_attempt_id  uuid REFERENCES public.exam_attempts(id),
  sprechen_session_id   uuid REFERENCES public.sprechen_sessions(id),
  started_at            timestamptz NOT NULL DEFAULT now(),
  completed_at          timestamptz,
  UNIQUE (user_id, set_id, started_at)
);

-- Prevents two simultaneous in-progress runs of the same set by the same
-- learner (a plain UNIQUE constraint can't express the "only when NULL"
-- condition, hence a partial unique index instead).
CREATE UNIQUE INDEX IF NOT EXISTS mock_exam_attempts_one_active
  ON public.mock_exam_attempts (user_id, set_id)
  WHERE completed_at IS NULL;

ALTER TABLE public.mock_exam_attempts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own mock exam attempts"
  ON public.mock_exam_attempts FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own mock exam attempts"
  ON public.mock_exam_attempts FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own mock exam attempts"
  ON public.mock_exam_attempts FOR UPDATE
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
