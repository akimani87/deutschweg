-- DeutschWeg — Sprechen orientation gate (one-time, before first live session)
-- Run in the Supabase SQL editor. Idempotent: safe to re-run.
--
-- sprechen_orientation_completed: mirrors profiles.onboarding_completed exactly
-- (same table, same boolean-flag idiom) — gates sprechen.html until the user
-- has read the 3-rule orientation and rehearsed their self-introduction once.
--
-- sprechen_intro: the user's own self-intro details (name/country/age/
-- language/hobby), captured once on the orientation screen and reused as a
-- pre-fill on every future visit so they never have to re-type it.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS sprechen_orientation_completed BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS sprechen_intro JSONB;
