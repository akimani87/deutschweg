-- DeutschWeg — topic layer (topics, topic_items, topic_progress, topic_performance_checks)
-- Run in the Supabase SQL editor. Idempotent: safe to re-run.
--
-- Purely additive: no existing table (modules, lessons, lesson_exercises,
-- user_progress) is altered. A "topic" is a bilingual, outcome-based grouping
-- that sits above the existing flat grammar-module list; topic_items always
-- point at a real row in public.lessons, so every topic step renders through
-- the existing module.html pipeline unmodified — no new content storage.
--
-- Completion vs. independent performance are deliberately two separate
-- tables (topic_progress / topic_performance_checks), mirroring the existing
-- pattern already used for Hörverstehen (hoerverstehen_results) and Sprechen
-- (sprechen_sessions): each tracks its own signal, never merged into
-- another's status.

create extension if not exists "pgcrypto";

-- ── topics ────────────────────────────────────────────────────────────────
create table if not exists public.topics (
  id                           uuid        primary key default gen_random_uuid(),
  level                        text        not null,
  order_index                  integer     not null,
  title_de                     text        not null,
  title_en                     text        not null,
  outcome_line                 text,
  description                  text,
  icon                         text,
  performance_check_lesson_id  uuid             references public.lessons(id),
  is_published                 boolean     not null default false,
  created_at                   timestamptz not null default now()
);

create unique index if not exists topics_level_order_uidx
  on public.topics (level, order_index);

-- ── topic_items ───────────────────────────────────────────────────────────
-- The topic's required lesson sequence. lesson_id always references a real
-- lessons row — either an existing module's lesson (re-pointed, unedited)
-- or a new lesson authored in a dedicated hidden module (see below).
-- display_title lets the topic frame a step differently from that lesson's
-- own title in its home module, without renaming the underlying lesson.
create table if not exists public.topic_items (
  id            uuid        primary key default gen_random_uuid(),
  topic_id      uuid        not null references public.topics(id)  on delete cascade,
  order_index   integer     not null,
  lesson_id     uuid        not null references public.lessons(id) on delete cascade,
  display_title text        not null,
  created_at    timestamptz not null default now()
);

create unique index if not exists topic_items_topic_order_uidx
  on public.topic_items (topic_id, order_index);

-- ── topic_progress ────────────────────────────────────────────────────────
-- "Lessons complete" only — never conflated with independent performance.
create table if not exists public.topic_progress (
  id            uuid        primary key default gen_random_uuid(),
  user_id       uuid        not null references auth.users(id) on delete cascade,
  topic_id      uuid        not null references public.topics(id) on delete cascade,
  status        text        not null, -- 'in_progress' | 'lessons_complete'
  completed_at  timestamptz,
  created_at    timestamptz not null default now()
);

do $$ begin
  if not exists (
    select 1 from pg_constraint where conname = 'topic_progress_user_topic_unique'
  ) then
    alter table public.topic_progress
      add constraint topic_progress_user_topic_unique unique (user_id, topic_id);
  end if;
end $$;

-- ── topic_performance_checks ──────────────────────────────────────────────
-- One row per attempt (insert-only, like hoerverstehen_results — not an
-- upsert). result is a communication-based pass/fail, never a grammar score.
create table if not exists public.topic_performance_checks (
  id            uuid        primary key default gen_random_uuid(),
  user_id       uuid        not null references auth.users(id) on delete cascade,
  topic_id      uuid        not null references public.topics(id) on delete cascade,
  result        text        not null, -- 'demonstrated' | 'needs_review'
  note          text,
  completed_at  timestamptz not null default now(),
  created_at    timestamptz not null default now()
);

create index if not exists topic_performance_checks_user_topic_idx
  on public.topic_performance_checks (user_id, topic_id);

-- ── ROW LEVEL SECURITY ────────────────────────────────────────────────────
alter table public.topics      enable row level security;
alter table public.topic_items enable row level security;

drop policy if exists "topics_public_read"      on public.topics;
create policy "topics_public_read"      on public.topics      for select using (true);

drop policy if exists "topic_items_public_read" on public.topic_items;
create policy "topic_items_public_read" on public.topic_items for select using (true);

alter table public.topic_progress enable row level security;

drop policy if exists "topic_progress_select" on public.topic_progress;
create policy "topic_progress_select" on public.topic_progress
  for select using (auth.uid() = user_id);

drop policy if exists "topic_progress_insert" on public.topic_progress;
create policy "topic_progress_insert" on public.topic_progress
  for insert with check (auth.uid() = user_id);

drop policy if exists "topic_progress_update" on public.topic_progress;
create policy "topic_progress_update" on public.topic_progress
  for update using (auth.uid() = user_id);

alter table public.topic_performance_checks enable row level security;

drop policy if exists "topic_performance_checks_select" on public.topic_performance_checks;
create policy "topic_performance_checks_select" on public.topic_performance_checks
  for select using (auth.uid() = user_id);

drop policy if exists "topic_performance_checks_insert" on public.topic_performance_checks;
create policy "topic_performance_checks_insert" on public.topic_performance_checks
  for insert with check (auth.uid() = user_id);

-- ── hidden module for topic-native lesson content ────────────────────────
-- Same is_published:false mechanism already proven by the Haben & Sein
-- Deep Dive prototype: invisible in every listing/counting query, reachable
-- only via a direct module.html?id= link. Hosts any Über mich step that
-- can't cleanly re-point to an existing module's lesson.
insert into public.modules (level, title, order_index, description, is_published)
select 'A1', 'Über mich — Topic Extras', 901,
       'Hidden content host for Über mich topic-native lessons. Not part of the flat A1 module list.',
       false
where not exists (
  select 1 from public.modules where level = 'A1' and order_index = 901
);
