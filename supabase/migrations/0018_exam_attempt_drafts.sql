-- DeutschWeg — Exam Vault autosave/resume storage (candidate-experience-audit.md
-- Part 1: reloading/closing the tab during a scored mock exam currently loses
-- all in-progress answers on Lesen, Schreiben, and Hoeren; these tables hold a
-- single in-progress snapshot per (user, exam) / per user so the page can
-- offer to resume instead of starting over. They are separate from
-- exam_attempts/hoerverstehen_results (completed, graded rows) on purpose —
-- a draft is provisional scratch state, not a real attempt, and is deleted
-- once the real attempt is saved so history/weakness queries never see it.

-- Lesen + Schreiben (exam-vault.html) — one open draft per (user, exam).
-- A learner can have a Lesen draft and a Schreiben draft open at once (they
-- are different exam_id rows), but only one draft per exam at a time.
CREATE TABLE IF NOT EXISTS public.exam_attempt_drafts (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  exam_id     uuid NOT NULL REFERENCES public.exams(id) ON DELETE CASCADE,
  answers     jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, exam_id)
);

ALTER TABLE public.exam_attempt_drafts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own exam drafts"
  ON public.exam_attempt_drafts FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own exam drafts"
  ON public.exam_attempt_drafts FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own exam drafts"
  ON public.exam_attempt_drafts FOR UPDATE
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own exam drafts"
  ON public.exam_attempt_drafts FOR DELETE
  USING (auth.uid() = user_id);

-- Hoeren (hoerverstehen.html) — one open exercise at a time per user, so this
-- is keyed by user_id alone rather than (user_id, exercise_id). The exercise
-- itself (audio_url, questions, ...) is re-fetched from hoerverstehen_exercises
-- by id on resume rather than duplicated here.
CREATE TABLE IF NOT EXISTS public.hoerverstehen_attempt_drafts (
  user_id       uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  exercise_id   uuid NOT NULL REFERENCES public.hoerverstehen_exercises(id) ON DELETE CASCADE,
  exercise_type text NOT NULL,
  listens_used  int  NOT NULL DEFAULT 0,
  answers       jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.hoerverstehen_attempt_drafts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own hoerverstehen drafts"
  ON public.hoerverstehen_attempt_drafts FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own hoerverstehen drafts"
  ON public.hoerverstehen_attempt_drafts FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own hoerverstehen drafts"
  ON public.hoerverstehen_attempt_drafts FOR UPDATE
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own hoerverstehen drafts"
  ON public.hoerverstehen_attempt_drafts FOR DELETE
  USING (auth.uid() = user_id);
