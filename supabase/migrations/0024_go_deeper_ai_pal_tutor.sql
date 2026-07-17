-- DeutschWeg — "Go Deeper" lesson-end prompt (AI Pal / AI Tutor discoverability)
-- Run in the Supabase SQL editor. Idempotent: safe to re-run.
--
-- go_deeper_tooltip_seen: mirrors profiles.onboarding_completed /
-- sprechen_orientation_completed exactly (same table, same boolean-flag
-- idiom) — the site-wide, one-time dismissible tooltip shown the first
-- time a learner reaches any lesson-end "Go Deeper" prompt.
--
-- pal_tutor_handoff.lesson_context: the automatically-extracted lesson
-- rule/explanation text carried from the "Explore this properly" button
-- into AI Tutor's opening message, alongside the existing topic/weak_word/
-- last_pal_message fields already used for the AI Pal -> AI Tutor handoff.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS go_deeper_tooltip_seen BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE public.pal_tutor_handoff
  ADD COLUMN IF NOT EXISTS lesson_context TEXT;
