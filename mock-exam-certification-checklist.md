# Mock Exam Certification Checklist

Defines what "certified" means before an `exams` row (and all its
`exam_tasks`) may be flagged `is_certified_mock_exam = true` and become
eligible to be linked into a `mock_exam_sets` row
(`hoeren_exam_id`/`lesen_exam_id`/`schreiben_exam_id`).

This gate applies **only** to Mock Exam content. Practice Pool content
(the same `exams`/`exam_tasks` tables, used by "Generate new" and
standalone practice) is unaffected — it is never required to pass this
checklist, and this document does not change how Practice Pool works.

Draft — not yet applied to any content. Items marked **[UNCERTAIN]** are
flagged because I don't have solid grounding for them from this project's
history and don't want to guess at a requirement that hasn't been stated.

---

## 1. Structure matches the official Goethe Teil/task structure and timing

- **Timing** (Lesen/Schreiben, all levels): sourced from the Goethe-Institut's
  own Durchführungsbestimmungen ("Terms and Conditions for Exam
  Administration"), "Stand: 1. September 2025," § 1.4 Zeitliche Organisation
  — cited in `exam-vault.html:1343-1347` (`SECTION_MINUTES`). This is a
  primary-source citation and can be checked directly against it.
- **Hören structure** (A1 only, today's only Hören content): sourced in
  `hoeren-a1-restructure-plan.md` — Teil 1 (6 items, dialogues, MC, played
  **twice**), Teil 2 (4 items, announcements, true/false, played **once**),
  Teil 3 (5 items, monologues, MC, played **twice**), totaling 15 raw
  points. That document itself flags a caveat worth repeating here: the
  per-Teil item/play-count breakdown came from a secondary source
  (a Goethe-affiliated practice site) cross-checked against independent
  search results that agreed, **not** the primary Modellsatz PDF directly
  (it's image-based and didn't extract as text). The ~20-minute total
  duration *is* confirmed from the primary Durchführungsbestimmungen text.
  **[UNCERTAIN]** whether "two independent secondary sources agreeing" is
  a high enough bar for certification-grade evidence, or whether the
  primary Modellsatz PDF should be manually reviewed (e.g. via OCR or a
  manual read-through) before any Hören exam can be certified. Flagging
  rather than deciding this myself.
- **Lesen/Schreiben per-Teil item counts**: **[UNCERTAIN]** — I could not
  find a primary-source citation anywhere in this project for the official
  number of Teile or items-per-Teil for Lesen/Schreiben at any level (only
  timing is confirmed). This checklist item can't be fully evaluated for
  Lesen/Schreiben content until that's sourced. Flagging as a gap rather
  than inventing numbers.
- The `exam_tasks.task_type` shape (`form_fill`, `short_message`, etc.) is
  a DeutschWeg-internal representation, not itself an official structure —
  what needs verifying is that the *count and nature* of tasks under an
  `exams` row matches the real exam's Teile for that level/section.

## 2. Hören-specific: play_count and end-to-end verification

- `stimulus.play_count` per task must match the officially-sourced play
  count for that Teil (see §1).
- Must be confirmed working end-to-end with no carry-over bugs and no dead
  play buttons — i.e., the exact defect fixed in this session
  (`hoerenPlaysUsed` not resetting between clips/Teile, commit `4672dfb`).
  A certified Hören exam must have been walked through fully, per-clip,
  confirming each clip's play button is enabled with its own correct
  remaining-plays count on arrival — not just "the code was patched."
- **[UNCERTAIN]** whether this needs re-verification every time the Hören
  renderer code changes (regression risk), or only once per exam content
  row at certification time. Leaning toward "the checklist gates content,
  not code" — but a code regression here would silently un-certify
  everything already flagged true, which the flag alone can't detect.
  Flagging as a process question, not something I should decide.

## 3. No repeated premises/scenarios within the same Übungssatz

Every task within one `exams` row (and every clip within a Hören task's
`stimulus.clips`) must use a distinct premise/scenario — no two tasks or
clips in the same Übungssatz should reuse the same situation (e.g. two
"lost umbrella" scenarios, as happened during this session's Hören content
generation before the anti-repetition fix).

This is scoped explicitly to **within one Übungssatz's own tasks**, per
your wording. Repetition *across different* Übungssätze of the same
level+section (e.g. Übungssatz 1 and Übungssatz 2 both using a similar
premise) is a related but different question — not covered by this
checklist item, flagging only because it will start to matter once a 2nd
Übungssatz exists.

## 4. Every answer key manually verified against its own content

- **Lesen/Schreiben** (text-based): every `correct_answer`/`answer` value
  must be checked by actually reading the stimulus text and confirming the
  marked answer is the one the text supports — not just trusting the
  generation output.
- **Hören**: this is a stricter bar than it looks. Every question's
  `stimulus.clips[].questions[].correct_answer` needs to be checked against
  the **actual audio**, not just the AI-generated `explanation` field.
  An explanation string can be internally consistent with its own
  `correct_answer` (I verified this text-to-text consistency for the
  current A1 Hören content in the Step 3 audit below) while still being
  wrong about what the audio actually says, if nobody has listened to
  confirm the transcript/explanation matches the real clip. Certification
  requires someone to have actually listened, not just read the paired
  text fields.
- Not just generated and trusted — this implies a human review pass is
  mandatory even for content that passed automated/self-consistency checks.

## 5. Bilingual instructions accurate and complete (where applicable)

Every task's `instructions` field (🇩🇪/🇬🇧 pair) must accurately describe
the actual task content — matching task type (MC vs. true/false vs.
short-message), item count, and play count where relevant (Hören) — and
both language versions must be complete, not just the German half.

## 6. Explicit review and approval by Angela

Passing every automated/structural check above is necessary but **not
sufficient**. `is_certified_mock_exam = true` may only be set after Angela
has explicitly reviewed and approved the content — this is a deliberate
human gate, not something a script or Claude can grant on the checklist's
behalf even if every other item above passes clean.

---

## Open questions **[UNCERTAIN]**, not resolved by this document

- Should there be a minimum content-volume bar per level/section (e.g. "at
  least N Übungssätze exist before any is certified") to avoid every
  learner getting an identical mock exam? Not stated as a requirement —
  flagging since it's adjacent to §3.
- Is there a re-certification trigger if `exam_tasks` rows under an already
  `is_certified_mock_exam = true` exam are edited afterward? Right now
  nothing in the schema would catch a post-certification edit silently
  invalidating the flag.
- Does certification need to account for the official raw-score-to-scaled
  conversion mentioned in `hoeren-a1-restructure-plan.md` (Hören: 15 raw
  points ×1.66 → /25), or is DeutschWeg's practice scoring intentionally
  raw-points-only? Not addressed here since I don't know the product intent.
