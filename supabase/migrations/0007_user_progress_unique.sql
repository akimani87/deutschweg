-- DeutschWeg — make user_progress upsertable per (user, lesson) and per (user, exercise)
-- Run in the Supabase SQL editor. Idempotent.
--
-- Without this, writing "lesson completed" on every Weiter click would
-- accumulate duplicate rows. The partial unique indexes mean we can
-- upsert with onConflict and the same lesson can't be marked completed
-- twice for the same user. Same idea for exercises.

create unique index if not exists user_progress_user_lesson_uidx
  on public.user_progress (user_id, lesson_id)
  where lesson_id is not null;

create unique index if not exists user_progress_user_exercise_uidx
  on public.user_progress (user_id, exercise_id)
  where exercise_id is not null;
