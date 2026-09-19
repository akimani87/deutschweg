-- DeutschWeg — A1 curriculum migration notice
-- Run in the Supabase SQL editor. Idempotent: safe to re-run.
--
-- a1_migration_notice_seen: mirrors profiles.onboarding_completed /
-- go_deeper_tooltip_seen exactly (same table, same one-time boolean-flag
-- idiom). Shown once, only to a learner who has real progress in one of
-- the 11 legacy A1 grammar modules hidden from the main path on
-- 2026-09-18 (see the "Replace the flat 13-module A1 path with
-- foundations + topics" change) -- a brand new learner never saw the old
-- flat structure, so they never see this notice. Purely a communication
-- flag: no data it references is altered by this migration, and nothing
-- about XP or user_progress changes shape here. Dismissing the notice
-- (the "Continue learning" CTA) just sets this to true; the banner never
-- reappears after that, same lifecycle as the other one-time flags above.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS a1_migration_notice_seen BOOLEAN NOT NULL DEFAULT FALSE;
