# Mock Exam Set Workflow

Exact commands for the full lifecycle of a mock exam set (Übungssatz),
from an empty draft to a published, live set — and back down again for
cleanup. All scripts live in `scripts/`, require `.env` (`SUPABASE_URL`,
`SUPABASE_SERVICE_ROLE_KEY`), and are run with plain `node`.

For what "gold-standard" content actually looks like, see
[uebungssatz-2-gold-standard.md](uebungssatz-2-gold-standard.md). For what
"certified" means, see
[mock-exam-certification-checklist.md](mock-exam-certification-checklist.md).

## 1. Create a draft set

```
node scripts/create-draft-mock-exam-set.js --level A1 --title "A1 — Übungssatz 3"
```

Creates one `mock_exam_sets` row + 3 empty exam shells (Hören/Lesen/
Schreiben) with zero `exam_tasks` rows. Nothing is copied from any other
set — no questions, no answers, no learner data. Sprechen is left
disconnected (dynamic, by design — see the gold-standard doc §5).
`is_published=false` and `is_certified_mock_exam=false` on everything it
creates, so it is invisible to learners immediately. Refuses to run if the
`(level, set_number)` pair already exists. Prints the 3 exam IDs — you'll
need them for the next step.

Optional: `--set-number N` to pin a specific number instead of
auto-incrementing.

## 2. Author content

Not scripted — insert `exam_tasks` rows for each of the 3 exam IDs printed
in step 1, following the real shapes documented in
[uebungssatz-2-gold-standard.md §3](uebungssatz-2-gold-standard.md).
`scripts/seed-uebungssatz-2-final.js` and `scripts/seed-hoeren-a1.js` are
worked examples of the insert shape if you want a script to copy from —
just point a new script at the new exam IDs, never at an existing set's
IDs.

## 3. Run validation

```
node scripts/validate-mock-exams.js --set <mock_exam_sets.id>
```

Read-only. Reports PASS/WARNING/FAIL across structure, answer keys,
explanations, publish/certify consistency, and **certification content
drift** (`exam.certified_content_unchanged` — whether a certified exam's
current content still matches the content hash recorded at its last
certification; see step 5 and
[uebungssatz-2-gold-standard.md §6](uebungssatz-2-gold-standard.md)). Exits
1 if any FAIL was found. Add `--json` (or `--json=path.json`) for a
machine-readable report.

**`--set` scope only compares duplicate content within the target set's
own tasks — it does NOT catch duplication against other sets.** This was
previously (incorrectly) documented here as covering "duplicate content
(cross-set)"; it doesn't, and that gap is exactly what let Übungssatz 3's
Lesen Teil 2 Item 9 go out byte-identical to Übungssatz 2's own Item 4
before being caught and reworded. Before certifying (step 5), also run:

```
node scripts/validate-mock-exams.js --level <level>
```

and manually review any `duplicates.exact_question_text` /
`duplicates.normalized_question_text` / `duplicates.exact_instructions`
finding that involves the set you're certifying — see
[mock-exam-certification-checklist.md §3](mock-exam-certification-checklist.md)
for why this is a required step, not an optional extra one.

Other useful filters:
```
node scripts/validate-mock-exams.js --level A1        # every A1 set — required before certifying (see above)
node scripts/validate-mock-exams.js --published        # every published set, any level
node scripts/validate-mock-exams.js --exam <exams.id>   # one exam standalone, outside any set
node scripts/validate-mock-exams.js --unlinked --level A1   # exams not linked to any set
```

## 4. Check missing audio/content

```
node scripts/check-mock-exam-content.js --set <mock_exam_sets.id>
```

A focused lens over the same validator output — filters down to just the
content-completeness findings (missing audio references, missing
transcripts, missing source text, missing writing prompts/content-points).
Shells out to the real validator rather than re-implementing checks, so it
can't drift out of sync with what the validator actually checks. Exits 1
only if a FAIL-severity content-completeness item exists.

## 5. Certify

```
node scripts/certify-mock-exam-set.js --set <mock_exam_sets.id>
```

Re-runs the validator; **refuses to certify if it finds any *blocking*
FAIL** (no `--force`, by design — see mock-exam-certification-checklist.md
for why this gate exists). The one FAIL category that does NOT block
certification is `exam.certified_content_unchanged` — that finding means
"this exam was certified before, and its content has changed since," which
is exactly what re-running this script resolves. Any other FAIL still
blocks certification.

If clean, sets `is_certified_mock_exam=true` on all 3 linked exams **and
stores a fresh content hash** for each (`exams.certified_content_hash`,
computed by `scripts/lib/content-hash.js` over that exam's own tasks).
Does not touch `is_published`.

**Recertifying is the only way to restore publish eligibility after
editing certified content.** If you edit a question, answer, explanation,
transcript, or audio reference in an already-certified exam — via any
script or a direct dashboard edit — its stored hash no longer matches,
`validate-mock-exams.js` reports a FAIL for it, and step 6 will refuse to
publish until you re-run this step.

## 6. Publish

```
node scripts/publish-mock-exam-set.js --set <mock_exam_sets.id>
```

Hard safeguards, all enforced, none bypassable from this script:
1. All 3 linked exams must already be certified (step 5) — refuses
   otherwise and tells you which section(s) are missing.
2. Re-validates from scratch at publish time (content may have changed
   since certification) — refuses if any FAIL is found right now. Unlike
   step 5, this check does **not** exempt `exam.certified_content_unchanged`
   — a certified exam whose content drifted is refused here regardless,
   with a message telling you to recertify.

If both pass, publishes the 3 exams first, then the set row — so the set
can never appear publicly linked to an unpublished exam. Once this
returns 0, the set is live in `exam-vault.html`.

## 7. Unpublish

```
node scripts/unpublish-mock-exam-set.js --set <mock_exam_sets.id>
```

Flips `is_published=false` on the set **and** all 3 linked exams together
(symmetric with publish) — this is deliberate: some app surfaces query
`exams` directly by `is_published`/`level`/`section` outside of the
`mock_exam_sets` flow, so unpublishing only the set row would not fully
hide the content. Certification status (`is_certified_mock_exam`) is left
untouched — re-publishing later doesn't require re-certifying, only
re-running step 6 (which re-validates anyway).

## 8. Clean test data

```
node scripts/cleanup-test-data.js --email dw-test-123@example.com          # dry run — prints row counts only
node scripts/cleanup-test-data.js --email dw-test-123@example.com --yes    # actually deletes + removes the auth user
node scripts/cleanup-test-data.js --user-id <uuid> --yes
```

Deletes `mock_exam_attempts`, `exam_attempts`, `sprechen_sessions`,
`exam_attempt_drafts`, `sprechen_session_caps`, `sprechen_daily_usage` for
one user (breaking the `mock_exam_attempts` ↔ `sprechen_sessions` FK cycle
first), then deletes the auth user. Requires exactly one of `--user-id`/
`--email` — there is no bulk "clean up everything" mode. Defaults to a dry
run; you must pass `--yes` to actually delete anything.

## Full round trip, start to finish

```
node scripts/create-draft-mock-exam-set.js --level A1 --title "A1 — Übungssatz 3"
#  ... author content for the 3 printed exam IDs ...
node scripts/validate-mock-exams.js --set <id>
node scripts/check-mock-exam-content.js --set <id>
node scripts/validate-mock-exams.js --level A1   # cross-set duplication check — required, see step 3
node scripts/certify-mock-exam-set.js --set <id>
node scripts/publish-mock-exam-set.js --set <id>
#  ... run a real E2E test through exam-vault.html against a disposable test account ...
node scripts/cleanup-test-data.js --email <test-account-email> --yes
```

This exact sequence (create → author → validate → certify → publish →
E2E-verify → clean up) is what Übungssatz 2 went through, and is verified
working end-to-end as of this writing (a disposable smoke-test set was
created, certified, published, unpublished, and fully deleted using these
scripts, with the validator correctly refusing certification/publication
at every intermediate stage where content was still incomplete). The
certification-content-hash check (step 5/6) was verified separately: an
otherwise-identical disposable set had a question, an answer, an
explanation, a transcript, and an audio reference each edited one at a
time after certification — every edit correctly blocked publishing until
recertified, and recertifying restored eligibility.

## One-time housekeeping: backfilling old certifications

```
node scripts/backfill-certified-content-hash.js            # dry run
node scripts/backfill-certified-content-hash.js --yes       # writes
```

Only relevant if a certified exam has no `certified_content_hash` yet
(e.g. it was certified before this feature existed). Computes and stores
a hash from that exam's *current* content — establishing a first baseline,
not validating anything. Safe to run repeatedly; already-hashed exams are
skipped. Übungssatz 1 and 2 were backfilled this way when the feature
shipped.
