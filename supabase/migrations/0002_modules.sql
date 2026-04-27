-- DeutschWeg — content schema (modules, lessons, lesson_exercises, user_progress)
-- Run this in the Supabase SQL editor before scripts/seed-modules.js.
-- Idempotent: safe to re-run.

create extension if not exists "pgcrypto";

-- ── modules ───────────────────────────────────────────────────────────────
create table if not exists public.modules (
  id           uuid        primary key default gen_random_uuid(),
  level        text        not null,
  title        text        not null,
  order_index  integer     not null,
  description  text,
  icon         text,
  is_published boolean     not null default true,
  created_at   timestamptz not null default now()
);

-- Logical unique key — lets the seed script upsert cleanly on re-runs.
create unique index if not exists modules_level_order_uidx
  on public.modules (level, order_index);

-- ── lessons ───────────────────────────────────────────────────────────────
create table if not exists public.lessons (
  id           uuid        primary key default gen_random_uuid(),
  module_id    uuid        not null references public.modules(id) on delete cascade,
  title        text,
  order_index  integer     not null,
  content_text text,
  created_at   timestamptz not null default now()
);

create unique index if not exists lessons_module_order_uidx
  on public.lessons (module_id, order_index);

-- ── lesson_exercises ──────────────────────────────────────────────────────
create table if not exists public.lesson_exercises (
  id             uuid    primary key default gen_random_uuid(),
  lesson_id      uuid    not null references public.lessons(id) on delete cascade,
  type           text    not null,
  question       text    not null,
  options        jsonb,
  correct_answer text,
  explanation    text,
  rule_hint      text,
  order_index    integer not null
);

create unique index if not exists lesson_exercises_lesson_order_uidx
  on public.lesson_exercises (lesson_id, order_index);

-- ── user_progress ─────────────────────────────────────────────────────────
create table if not exists public.user_progress (
  id           uuid        primary key default gen_random_uuid(),
  user_id      uuid        not null references auth.users(id)             on delete cascade,
  module_id    uuid        not null references public.modules(id)         on delete cascade,
  lesson_id    uuid             references public.lessons(id)             on delete cascade,
  exercise_id  uuid             references public.lesson_exercises(id)    on delete cascade,
  status       text        not null,
  score        integer,
  completed_at timestamptz,
  created_at   timestamptz not null default now()
);

create index if not exists user_progress_user_module_idx
  on public.user_progress (user_id, module_id);

-- ── ROW LEVEL SECURITY ────────────────────────────────────────────────────
alter table public.modules          enable row level security;
alter table public.lessons          enable row level security;
alter table public.lesson_exercises enable row level security;

drop policy if exists "modules_public_read"          on public.modules;
create policy "modules_public_read"          on public.modules          for select using (true);

drop policy if exists "lessons_public_read"          on public.lessons;
create policy "lessons_public_read"          on public.lessons          for select using (true);

drop policy if exists "lesson_exercises_public_read" on public.lesson_exercises;
create policy "lesson_exercises_public_read" on public.lesson_exercises for select using (true);

alter table public.user_progress enable row level security;

drop policy if exists "user_progress_select" on public.user_progress;
create policy "user_progress_select" on public.user_progress
  for select using (auth.uid() = user_id);

drop policy if exists "user_progress_insert" on public.user_progress;
create policy "user_progress_insert" on public.user_progress
  for insert with check (auth.uid() = user_id);

drop policy if exists "user_progress_update" on public.user_progress;
create policy "user_progress_update" on public.user_progress
  for update using (auth.uid() = user_id);
