-- DeutschWeg — add content_json column to lessons (Step 4 of content reset)
-- Run in the Supabase SQL editor. Idempotent: safe to re-run.
--
-- Each lesson stores structured content blocks here:
--   [
--     { "type": "intro",   "content": "..." },
--     { "type": "text",    "content": "..." },
--     { "type": "example", "german": "...", "english": "..." },
--     { "type": "tip",     "content": "..." },
--     { "type": "warning", "content": "..." }
--   ]
--
-- This replaces the broken plain-text content_text approach. Old content_text
-- column is left in place for now so module.html can fall back gracefully
-- while content is being rebuilt lesson-by-lesson.

alter table public.lessons
  add column if not exists content_json jsonb;
