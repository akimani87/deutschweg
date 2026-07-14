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

### 1.0 Which A1 variant — must state this explicitly

Goethe publishes **two structurally different A1 exams**: **Start Deutsch 1**
(general adult exam) and **Fit in Deutsch 1** (youth-oriented) — they are
not interchangeable and must not be mixed within one Übungssatz. Fit in
Deutsch 1's Hören is 2 Teile / 12 items, all played twice — a different
shape from Start Deutsch 1's 3 Teile / 15 items / mixed play counts (below).

**DeutschWeg's Mock Exam content is Start Deutsch 1.** Our existing Hören
content (3 Teile, Teil 1 & 3 played twice, Teil 2 once) already matches
Start Deutsch 1's pattern, not Fit in Deutsch 1's — confirming this
explicitly here so no future content generation accidentally mixes in the
other variant's structure.

Primary sources:
- **Durchführungsbestimmungen** ("Terms and Conditions for Exam
  Administration"), "Stand: 1. September 2025" — per-level timing, already
  cited in `exam-vault.html:1343-1347` (`SECTION_MINUTES`).
- **Prüfungsziele/Testbeschreibung A1 Start Deutsch 1** (Goethe-Institut):
  https://www.goethe.de/pro/relaunch/prf/de/Pruefungsziele_Testbeschreibung_A1_SD1.pdf
  — read directly this session via `pdftotext` (the PDF has a real text
  layer on its descriptive pages, unlike the Modellsatz's scanned sample
  sheets). Section/task structure below is quoted/paraphrased from this
  document.
- **Modellsatz, Start Deutsch 1** — the official sample exam, now read
  directly and used to confirm the exact per-Teil Hören item split (§1.1)
  that the Testbeschreibung's descriptive text alone doesn't state.
- **Official complete sample exam ("Übungssatz 01")**, with candidate
  sheets, examiner sheets, model answers, and full transcripts:
  https://www.goethe.de/pro/relaunch/prf/materialien/A1_sd1/sd_1_uebungssatz01.pdf
  — reference for structure and quality bar (task phrasing style,
  answer-key rigor, item difficulty) only. **Must not be copied or closely
  paraphrased** — copyright.

### 1.1 Hören (Start Deutsch 1) — confirmed structure

Quoted/paraphrased directly from the Prüfungsziele/Testbeschreibung PDF
(§4 Prüfungsformen → Hören):

> "Die Prüfung besteht aus drei Teilen mit insgesamt 15 Aufgaben... Die
> Hörtexte in Teil 1 und 3 werden zweimal vorgespielt, in Teil 2 hört man
> jeden Text nur einmal."

| Teil | Content | Task format | Items | Plays |
|---|---|---|---|---|
| 1 | Kurze Alltagsgespräche (short everyday dialogues, 2 people) | 3-option (dreigliedrig), picture-supported multiple choice | **6** | Twice |
| 2 | Öffentliche Lautsprecherdurchsagen (public PA announcements) | Richtig/Falsch | **4** | Once |
| 3 | Telefonansagen (voicemail/answering-machine messages) | 3-option multiple choice | **5** | Twice |

Total 15 Aufgaben, max 15 points (1 per correct answer), ~20 minutes to
play + ~3 minutes to transfer answers to the answer sheet. The per-Teil
6/4/5 split is now **primary-sourced** — confirmed directly against the
Modellsatz's numbered sample items, not deduced or carried over from a
secondary source. §1.5's earlier open question is resolved.

### 1.2 Lesen (Start Deutsch 1) — confirmed structure

Quoted/paraphrased from the same document (§4 → Lesen):

| Teil | Content | Task format | Items |
|---|---|---|---|
| 1 | Kurznotizen — **two** short texts (Notizzettel/E-Mails: Mitteilungen, Handlungsanweisungen, Einladungen) | Richtig/Falsch | 5 |
| 2 | Kleinanzeigen — 10 classified ads, paired against 5 situations | Matching/Zuordnung (pick which of a pair fits the situation) | 5 |
| 3 | Hinweisschilder/Aushänge — 5 very short sign/notice texts | Richtig/Falsch | 5 |

Total 15 Aufgaben, max 15 points, ~25 minutes. Teil 2's item range is
stated explicitly in the document's own sample-task header ("Teil 2 Lesen
Sie die Texte und die Aufgaben 6 bis 10"), confirming Teil 1 = items 1–5;
Teil 3's "5" is stated explicitly ("Zu fünf sehr kurzen Texten"); Teil 1's
5 follows by subtraction (15 − 5 − 5 = 5). This is now a **confirmed,
primary-sourced structure**, not an estimate.

**Note:** no Teil in official A1 Start Deutsch 1 Lesen uses plain
multiple-choice (a/b/c on a single text) — every Teil is either
Richtig/Falsch or matching. This directly informs the Step 3 audit below.

### 1.3 Schreiben (Start Deutsch 1) — confirmed structure

Quoted/paraphrased from the same document (§4 → Schreiben):

| Teil | Content | Scoring |
|---|---|---|
| 1 | Fill in a form (Anmeldung/Bestellung etc.) — 5 blanks, using info from an intro text | 1 point per correctly filled field, max **5** (official) |
| 2 | Write a short message (Kurzmitteilung — e.g. an apology note/email) covering 3 given Leitpunkte, ~30 words, with appropriate greeting/closing for the text type | 3 points per content point (×3) + 1 for text-type fit, max **10** (official) |

Official total 15 points, ~20 minutes, two independent examiners score and reconcile — this is the *Goethe* model.

**DeutschWeg's actual runtime model differs from the official 5+10 split, confirmed by reading `server.js`'s `/api/exam-grade` handler directly (not the DB-declared `exam_tasks.max_score`, which is display-only for this task type):**
- Teil 1 (form_fill) is scored deterministically server-side via `scoreFormFill()` against the exam's own `exam_tasks.max_score` for that task (real max, actually used) — currently **5** for both Übungssatz 1 and Übungssatz 2.
- Teil 2 (short_message) is scored by Claude against a hardcoded A1 rubric (Erfüllung max 3 + Kommunikative Gestaltung max 3, raw total ×2) — this always produces a **max of 12**, regardless of whatever value is stored in that task's `exam_tasks.max_score` column (10, in both Übungssatz 1 and 2 today — that stored value is only ever used for the pre-submission UI's points badge, never read by the scoring/saving code path).
- **Real runtime total: 5 + 12 = 17, not 15.** This is not a defect — the written-skills `/25` scaling in `exam-vault.html` (`(total_score / max_score) * 25`) reads the real `max_score` the grading response returns, so the learner-facing scaled result is mathematically correct. Only this document's "15 points" framing was wrong. Confirmed both Übungssatz 1 and Übungssatz 2 go through the identical `/api/exam-grade` code path with the identical hardcoded rubric — same model, same discrepancy, same correctness of the actual learner-facing result.

### 1.4 Timing (all sections, all levels)

Sourced from the Goethe-Institut's Durchführungsbestimmungen ("Terms and
Conditions for Exam Administration"), "Stand: 1. September 2025," § 1.4
Zeitliche Organisation — cited in `exam-vault.html:1343-1347`
(`SECTION_MINUTES`). Independent primary-source citation, consistent with
the ~20/~25/~20-minute figures above.

### 1.5 Structure summary — all three sections primary-sourced

| Section | Structure | Total |
|---|---|---|
| Hören | Teil 1 = 6 items (dialogues, MC, twice) · Teil 2 = 4 items (announcements, Richtig/Falsch, once) · Teil 3 = 5 items (voicemails, MC, twice) | 15 |
| Lesen | Teil 1 = 5 items (Richtig/Falsch, 2 short texts) · Teil 2 = 5 items (2-option choice matching a situation to one of two options) · Teil 3 = 5 items (Richtig/Falsch, independent short public signs/notices) | 15 |
| Schreiben | Teil 1 = form-fill, 5 points (official + actual) · Teil 2 = short message, 10 points official / **12 points actual runtime max** (see §1.3) | 15 official / **17 actual runtime** |

No remaining `[UNCERTAIN]` items on structure itself — the open items
below are about certification *process*, not the source material. The
Schreiben runtime-vs-official total gap (§1.3) is a confirmed, understood
model difference, not an open question.

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
