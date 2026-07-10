# Exam Vault → Combined "Complete Mock Exam" — Architectural Review

Investigation only. Nothing built or changed. All findings below are grounded in live queries and current file contents, cited as file:line or table/row evidence.

## A. What currently exists

**Storage model, per section:**

- **Lesen/Schreiben**: `exams` (id, level, section, title, is_published) + `exam_tasks` (exam_id FK, task_number, task_type, instructions, stimulus jsonb, max_score, order_index). Confirmed live: A1 has 10 `exams` rows with `section='lesen'` and 10 with `section='schreiben'` — e.g. "A1 Lesen — Übungssatz 3" (`ad5b4e0c…`) and "A1 Schreiben — Übungssatz 3" (`05c637a8…`) share the identical `created_at` timestamp (2026-04-30 17:37:33.970499+00) and the number "3" in the title, but there is **no foreign key between them** — `exams` has only `exams_pkey`. They're linked *only* by a human-authored title convention and by having been seeded in the same batch.
- **Hören** (post-restructure, this session): same `exams`/`exam_tasks` tables, `section='hoeren'`, exactly 1 row today (`90bfdfdd…`, "A1 Hören — Übungssatz 1"). New `task_type` values (`listening_multiple_choice`, `listening_true_false`) and new `stimulus` keys (`play_count`, `clips[]`) — no schema change was needed since `task_type`/`stimulus` were already unconstrained (confirmed: `pg_constraint` on `exam_tasks` shows only a PK and the `exam_id` FK, no CHECK on `task_type`).
- **Hören (legacy, pre-restructure)**: `hoerverstehen_exercises` + `hoerverstehen_results` + `hoerverstehen_attempt_drafts` — completely separate tables, still live, still used by the standalone `hoerverstehen.html` practice page. Two parallel Hören systems now coexist by design (the old one is the practice-mode content pool; some of its content was copied into the new `exam_tasks` rows, but there's no FK between them).
- **Sprechen**: `sprechen_topics` (level, part, topic_text — prompts), `sprechen_sessions` (transcript, feedback jsonb, 5 score columns, `completed`, `duration_seconds`), `sprechen_session_caps` (user_id, level, `sessions_used`/`max_sessions` default 10), `sprechen_daily_usage` (user_id, usage_date, seconds_used). **None of these reference `exams` or `exam_tasks` at all.** Confirmed live: `sprechen_sessions` rows are free-form conversation transcripts with a WebSocket-driven examiner, not task/question rows.

**Answering Q2 directly**: No, "Übungssatz 1" is not one object anywhere. It is four (really three, since Sprechen has none) independently-created `exams` rows per level that happen to share a title suffix. Confirmed with direct evidence above — this is a naming convention, not a structural relationship.

**Answering Q4 — audit of the specific mechanisms:**

| Mechanism | Lesen/Schreiben (exam-vault.html) | Hören (exam-vault.html, new) | Sprechen (sprechen.html) |
|---|---|---|---|
| Autosave/draft | `exam_attempt_drafts` table, debounced upsert, `flushAutosave()` (`exam-vault.html:1306`) | Same table/mechanism, Hören-shaped payload (`{stepIdx, playsUsed, answers}`) | **None.** No draft table, no resume. A dropped connection just ends the session (`failToPre()`, `sprechen.html:564`). |
| Timer | `SECTION_MINUTES` table + `startSectionTimer()` (`exam-vault.html:1128`, `:1144`), per-level countdown | Deliberately absent — no entry in `SECTION_MINUTES`, so the timer functions no-op | Count-**up** elapsed display, hard cap at 15 min (`sprechen.html`, distinct mechanism, not the same timer system at all) |
| Auto-submit on timeout | `autoSubmitOnTimeout()` (`exam-vault.html:1196`), reuses `submitSchreiben`/`submitLesen` | N/A — Hören auto-submits on last-Teil-answered instead, not timeout | Auto-ends at 15 min via its own `setTimeout`-driven cap, unrelated code path |
| Section locking | `sessionStorage`-based, `isSectionLocked()`/`guardSectionNav()` (`exam-vault.html:1209`, `:1222`) | Same mechanism, `'hoeren'` is just a third section string value | **None.** No lock concept; capped instead by `sprechen_session_caps`/`sprechen_daily_usage` — a usage quota, not a one-way "you finished this, no going back" lock |
| Scoring | `scoreLesen()`/Schreiben's Claude-graded criteria (`exam-vault.html:2787`) | `scoreHoeren()` (`:1746`), mirrors Lesen's per-task pattern | Claude-graded 5 scores (aussprache/kommunikation/grammatik/wortschatz/overall) written straight onto `sprechen_sessions` — different shape, different scale, no `exam_attempts` row at all |
| Results display | Shared `exam_attempts` row, `renderLesenResults`/`renderHoerenResults`, hero + per-task pills | Same | Its own results screen in `sprechen.html`, no shared component |

**Sprechen has no usage-cap equivalent anywhere else in the app** — this matters directly for the combined flow (see Risks).

## B. What can be reused

- **Lesen/Schreiben**: as-is, no changes — this is the mature reference implementation everything else should match.
- **Hören**: fully reusable as-is at the `exam_tasks` level — the restructure this session was built with exactly this kind of reuse in mind (timer/lock/draft machinery already generalized to a `'hoeren'` section string, not hardcoded to two sections). The *content* pool is thin (1 Übungssatz, 6/4/6 items) but structurally nothing new is needed to plug it into a sequence.
- **Autosave/draft, timer, section-lock, `saveAttempt()`, results rendering**: all already section-agnostic dispatch functions (`collectCurrentSectionAnswers()`, `restoreCurrentSectionAnswers()`, `sectionDisplayLabel()`) — built generically enough this session that adding a "combined flow" mode is more plausible without a rewrite than it would have been before the Hören restructure.
- **Sprechen's grading pipeline** (WebSocket + Claude feedback) is reusable *as a black box* — i.e., "start this conversation, get these 5 scores back" — but its state model (caps, no draft, no lock, count-up timer) is not something to extend; it's something to sit *next to*.

## C. What must change

- **Sprechen is the one genuine gap.** It has no `exam_tasks` row, no `exam_attempts` row, no section-lock, no draft/resume, and a hard usage cap (`max_sessions=10`, `dailyCapSeconds=600`) that nothing else in the app has. Folding it into a combined flow means either (a) building a thin adapter that records a "Sprechen leg completed" marker against a new combined-attempt record after `sprechen_sessions` finishes normally, or (b) deeper surgery to make Sprechen section-lockable and resumable like the others. (a) is far smaller and is what I'd recommend — see G/H.
- **Hören content volume.** One Übungssatz exists. A combined flow needs at minimum enough Hören/Lesen/Schreiben Übungssätze at the *same* "set number" to make "A1 Übungssatz 1" mean something across all three — today Lesen/Schreiben have 10 numbered sets each, Hören has 1. The combined flow's first usable set is constrained by Hören's content, not by Lesen/Schreiben.
- **No code changes to Lesen/Schreiben/Hören's actual grading logic** are required — the "must change" is additive (new tables, new orchestration), not a rewrite of what's there.

## D. Database changes (concrete proposal)

```sql
-- The parent "set" — links one exam per section for a given level+number.
-- Nullable per-section FKs so a set can exist even if e.g. Sprechen isn't
-- wired in yet, or a level only has 3 of the 4 sections seeded.
CREATE TABLE public.mock_exam_sets (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  level          text NOT NULL,
  set_number     integer NOT NULL,       -- "Übungssatz 1" -> 1
  title          text NOT NULL,          -- "A1 — Übungssatz 1"
  hoeren_exam_id     uuid REFERENCES public.exams(id),
  lesen_exam_id      uuid REFERENCES public.exams(id),
  schreiben_exam_id  uuid REFERENCES public.exams(id),
  sprechen_topic_ids uuid[],             -- sprechen_topics has no per-set grouping today; array of topic ids for this set, or NULL if Sprechen isn't in this set yet
  is_published   boolean NOT NULL DEFAULT false,
  created_at     timestamptz NOT NULL DEFAULT now(),
  UNIQUE (level, set_number)
);

-- The overall attempt — one row per learner per "run" through a set.
-- Tracks which leg they're on and rolls up a combined score once all
-- attempted legs are done. Does NOT replace exam_attempts/sprechen_sessions
-- — those still get written per-section exactly as today; this is purely
-- an umbrella + progress cursor.
CREATE TABLE public.mock_exam_attempts (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  set_id           uuid NOT NULL REFERENCES public.mock_exam_sets(id),
  current_section  text,                -- 'hoeren' | 'lesen' | 'schreiben' | 'sprechen' | null (done)
  hoeren_attempt_id     uuid REFERENCES public.exam_attempts(id),
  lesen_attempt_id      uuid REFERENCES public.exam_attempts(id),
  schreiben_attempt_id  uuid REFERENCES public.exam_attempts(id),
  sprechen_session_id   uuid REFERENCES public.sprechen_sessions(id),
  started_at       timestamptz NOT NULL DEFAULT now(),
  completed_at     timestamptz,
  UNIQUE (user_id, set_id, started_at)  -- allows retakes, not concurrent duplicate in-progress rows (see below)
);

-- Partial unique index (not expressible as a plain constraint) to actually
-- prevent two simultaneous in-progress runs of the same set:
CREATE UNIQUE INDEX mock_exam_attempts_one_active
  ON public.mock_exam_attempts (user_id, set_id)
  WHERE completed_at IS NULL;
```

Why this shape rather than something heavier:
- It **wraps** the existing per-section tables instead of replacing them — `exam_attempts`/`sprechen_sessions` keep working exactly as they do for standalone practice, satisfying "reuse existing systems" and "don't fake a combined result by linking pages" (the umbrella row is real, with real FKs to each real section attempt, not just a URL sequence).
- `current_section` is the resume cursor — reload mid-flow, look up the one active `mock_exam_attempts` row for this user+set, jump back to `current_section`.
- The existing `exam_attempt_drafts` table (per-section, keyed on `exam_id`) needs **no schema change** — an in-progress Lesen leg of a combined attempt drafts exactly the same way a standalone Lesen attempt does today. The umbrella row just needs to know which section it's currently in; the section itself doesn't need to know it's part of a bigger flow.

## E. Frontend changes

**This is an extension of `exam-vault.html`, not a new page**, for Hören/Lesen/Schreiben — the pill-switching, per-section renderers, timer/lock/draft machinery are already unified in one file and already section-string-driven. Concretely:

- A new top-level mode: "Complete Mock Exam" vs. "Practice by Skill" (the existing pill UI), likely a toggle or a separate entry point that still lands on the same page.
- New state: `currentMockExamAttemptId`, `currentMockExamSetId`. On entering combined mode, look up or create the `mock_exam_attempts` row, then drive `currentSection`/`loadExam()` exactly as today but advancing automatically Hören→Lesen→Schreiben instead of waiting for a pill click, and writing `hoeren_attempt_id` etc. back onto the umbrella row when each section's `saveAttempt()` succeeds.
- Section-lock (`isSectionLocked`) needs a *combined-mode variant*: in standalone practice, leaving a finished section locks it in `sessionStorage` for the browser session. In combined mode, "finished" should auto-advance rather than prompt "continue?" — the confirm-then-lock UX doesn't make sense when there's nowhere else to navigate to except "onward."
- **Sprechen is the one real new UI surface**: either an iframe/redirect to `sprechen.html` with a return hook (simplest, smallest change, but a jarring page transition — a real mobile-navigation cost, see Risks), or a lightweight in-page wrapper that starts a Sprechen session and reports completion back to `exam-vault.html`. I'd recommend the redirect-with-return approach for a first version specifically because it requires no changes to `sprechen.html` itself.
- Final combined-results screen: new, genuinely new work — averaging/combining 4 differently-shaped score records (Lesen/Schreiben's 0–100 exam_attempts, Hören's exam_attempts, Sprechen's 5 separate 0–5(?) scores) into one presentable summary has no existing analogue to extend.

## F. Risks

- **Losing progress mid-flow**: low risk for Hören/Lesen/Schreiben (autosave/draft already solid, per-section). Real risk is losing the *umbrella* pointer — if `mock_exam_attempts.current_section` isn't written reliably (e.g., network failure right after a section's `saveAttempt()` succeeds but before the umbrella row updates), a learner could reload into ambiguity about which section they're "supposed" to be on. Needs the umbrella update to happen as part of the same success path as `saveAttempt()`, not a separate step that can fail independently.
- **Inconsistent scoring across sections**: real risk, not hypothetical — Lesen/Schreiben/Hören all score out of section-specific raw totals (12, 25, 16 etc., no unified scale), Sprechen scores 1–5(ish) per criterion with no raw/max concept at all. A "combined result" needs an explicit, documented conversion (not a silent average of incompatible scales) — this is a design decision, not just an engineering task (see J).
- **Audio failure (Hören)**: today, if `stimulus.audio_url` 404s or ElevenLabs-generated audio fails to load, nothing in the current renderer distinguishes "audio broken" from "user hasn't pressed play yet" — no error state exists. In a combined flow where the learner can't skip forward manually, a broken audio file would strand them with no recovery path. Needs an explicit audio-error state before this ships in a combined flow (not present today even in standalone Hören).
- **Speaking-session failure (Sprechen)**: two distinct risks, not one. (1) The existing `failToPre()` WebSocket-drop handling (`sprechen.html:564`) works for standalone use but has no concept of "you're mid-combined-flow, don't just dump the learner at the pre-session screen." (2) **The usage cap is a real blocker**: `sprechen_session_caps.max_sessions=10` and `sprechen_daily_usage`'s 600-second daily cap exist independently of any combined-flow concept — a learner who's used their daily Sprechen practice minutes, then starts a Complete Mock Exam, could hit the cap mid-flow with no special handling, after already completing Hören/Lesen/Schreiben. This needs an explicit decision (exempt combined-flow attempts from the cap? Warn before starting the flow if the cap is nearly exhausted?).
- **Mobile navigation between sections**: if Sprechen is handled via redirect-to-`sprechen.html`-and-back (recommended above for v1), that's a real page transition on mobile — back-button behavior, losing scroll position, and the visual "am I still in the same exam?" continuity all need explicit UX handling, not just a link.
- **Unfinished/abandoned attempts**: no existing cleanup/expiry concept anywhere in the app (drafts persist indefinitely today, matching "practice, come back whenever" — reasonable for standalone use). A combined `mock_exam_attempts` row with `completed_at IS NULL` sitting for weeks isn't harmful data-wise, but the "one active attempt per set" unique index above means a learner who abandons and later wants to restart the *same* set needs an explicit "abandon and restart" action, not just silence.
- **Resuming an interrupted attempt** — direct answer to your specific question: the section-level resume (draft banner, "Resume where you left off") already works per-section and needs no changes. What's new is *cross-section* resume: reload mid-flow → look up the active `mock_exam_attempts` row → resolve `current_section` → let that section's own existing draft-check (`checkForDraftAndOfferResume`) handle the rest exactly as it does today. Sprechen genuinely cannot resume mid-session (no draft concept, real-time WebSocket) — if a combined-flow Sprechen leg drops, the only honest option is "retry this section from the start," which is consistent with how Sprechen already behaves standalone.

## G. Smallest reliable first version

**Lesen + Schreiben + Hören only, Sprechen deferred** — for the reasons above (no cap system, no draft/lock model, and it's the only section requiring a real UI decision rather than an extension). This also sidesteps the hardest scoring-normalization question (Sprechen's incompatible score shape) for v1, and Hören's thin content (1 Übungssatz) already caps how many complete "3-section" sets can exist yet regardless of Sprechen.

A believable v1: `mock_exam_sets` + `mock_exam_attempts` as designed above, minus the `sprechen_*` columns; a "Complete Mock Exam" entry point in `exam-vault.html` that auto-advances Hören→Lesen→Schreiben using entirely existing per-section machinery; one shared combined-results screen showing the three section scores side by side (not force-averaged into one number yet — see J).

## H. Implementation phases (no code yet — sequencing only)

1. **Schema**: create `mock_exam_sets`/`mock_exam_attempts` (Lesen/Schreiben/Hören columns only), backfill one `mock_exam_sets` row for A1 pointing at existing Übungssatz-1 `exams` rows for all three sections.
2. **Orchestration logic**: umbrella-attempt creation/lookup, `current_section` read/write, wired into the *existing* `saveAttempt()` success paths for each of the three sections (additive, not a rewrite of those functions).
3. **Auto-advance UX**: replace the manual pill-click transition with an automatic "next section" step specific to combined mode, reusing `loadExam()`/`renderTaskCards`/`renderHoerenSection` unchanged.
4. **Combined results screen**: new component, side-by-side section scores, explicit "no single combined number yet" framing pending the scoring-normalization decision (J).
5. **Resume-across-sections**: umbrella lookup on page load, dispatch into the correct section, relying on each section's existing per-section resume.
6. **Content**: more Hören Übungssätze (today's restructure gives exactly 1) so more than one combined set exists to test/ship against.
7. **Sprechen integration** (separate, later phase): redirect-with-return, umbrella-attempt marking on completion, explicit handling for the usage-cap collision described in F.

## I. Recommended technical approach

Wrap, don't rebuild. The single biggest thing this investigation confirmed is that Lesen/Schreiben/Hören already share one page, one draft mechanism, one lock mechanism, and one save path — the "combined exam" is much closer to an orchestration layer on top of what exists than a new system. Sprechen is the one place that genuinely doesn't fit that pattern, and trying to force it into the same shape (giving it a draft table, a lock, a timer to match) would be exactly the kind of "redesign the whole platform" and "duplicate system" the constraints rule out. Keep it separate, bridge it with a completion marker, and treat its usage cap as a first-class constraint to design around rather than an edge case to patch later.

## J. Questions or decisions needed from Angela

1. **Scoring normalization**: do you want a single combined pass/fail number across 4 differently-scaled sections for v1, or is a side-by-side per-section breakdown (no forced averaging) acceptable to start? This is a product decision, not something to default on.
2. **Sprechen's usage cap vs. combined-flow attempts**: exempt combined-flow Sprechen legs from `sessions_used`/daily-seconds caps, or let the cap apply and handle the collision with a warning before the learner starts?
3. **Content volume gate**: are you comfortable shipping "Complete Mock Exam" with exactly 1 Hören Übungssatz until more are generated, or should that block launch?
4. **Retake policy**: when a learner completes (or abandons) a combined attempt, should "take Übungssatz 1 again" always be allowed (mirroring Lesen/Schreiben's unlimited-retake practice model today), or should combined attempts behave more like a real exam booking (limited retakes)? The section-lock model today assumes unlimited practice retakes per section; a combined "real mock exam" framing might reasonably want different rules.
