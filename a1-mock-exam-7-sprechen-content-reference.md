# A1 Mock Exam 7 — Sprechen Content (reference only, not wired)

Drafted per Angela's brief for Mock Exam 7 (family life, household
responsibilities, daily routine), covering the Sprechen Teil 2/3 topic
and action cards she specified. **Not entered into any database table
and not wired into any app surface** — same standing decision as
[a1-mock-exam-3-sprechen-content-pending.md](a1-mock-exam-3-sprechen-content-pending.md),
which this file follows exactly. That document's reasoning still
applies unchanged: DeutschWeg's live Sprechen engine
(`server.js` `POST /api/sprechen/topics/generate`, `sprechen.html`) is
3 dynamic parts generated fresh per session, never tied to a specific
mock exam set (`mock_exam_sets.sprechen_topic_ids` stays `null` on every
set by design), and never folded into the combined score. Building the
fixed-card structure below would need a new data model and scoring
wiring shared across every mock exam set — a real feature decision, not
something to improvise while authoring content for one set.

## Current behavior for Mock Exam 7's Sprechen module

Identical to every other A1 set: the dynamic engine, unlinked to this
set, never summed into the combined score.

---

## Teil 2 — Persönliche Fragen zu einem Thema

Eight keyword topic cards (per Angela's brief), each with 3-4 natural
follow-up questions in the family/daily-routine register:

1. **Familie** — Wie viele Personen sind in Ihrer Familie? Wo wohnt
   Ihre Familie? Sehen Sie Ihre Familie oft?
2. **Kinder** — Haben Sie Kinder? Wie alt sind sie? Was machen die
   Kinder gern zu Hause?
3. **Schule** — Wann beginnt die Schule? Wie kommt Ihr Kind zur Schule?
   Was mögen Sie an der Schule Ihres Kindes?
4. **Arbeit** — Wann beginnt Ihre Arbeit? Wer bringt die Kinder, wenn
   Sie arbeiten? Arbeiten Sie jeden Tag?
5. **Frühstück** — Was essen Sie zum Frühstück? Frühstückt die Familie
   zusammen? Wer macht das Frühstück?
6. **Abendessen** — Wann isst Ihre Familie zu Abend? Wer kocht meistens?
   Isst die ganze Familie zusammen?
7. **Haushalt** — Wer macht bei Ihnen zu Hause die Hausarbeit? Was
   machen Sie gern im Haushalt? Was machen Sie nicht gern?
8. **Wochenende** — Was macht Ihre Familie am Wochenende? Besuchen Sie
   oft Verwandte? Haben Sie eine feste Routine am Wochenende?

## Teil 3 — Bitten formulieren und darauf reagieren

Eight request/action cards (per Angela's brief), each with a natural
prompt phrase, mirroring the format
[a1-mock-exam-3-sprechen-content-pending.md](a1-mock-exam-3-sprechen-content-pending.md)
used for its own Teil 3 cards:

1. **Helfen** — Können Sie mir bitte helfen? / Kannst du mir kurz
   helfen?
2. **Tisch decken** — Deck bitte den Tisch. / Kannst du bitte den Tisch
   decken?
3. **Tasche bringen** — Bring mir bitte meine Tasche. / Kannst du mir
   die Tasche bringen? — negative Reaktion: "Tut mir leid, ich finde
   sie gerade nicht."
4. **Müll rausbringen** — Bring bitte den Müll raus. / Kannst du den
   Müll rausbringen?
5. **Fenster schließen** — Schließ bitte das Fenster. / Kannst du das
   Fenster schließen? Es ist kalt.
6. **Warten** — Warte bitte kurz. / Kannst du einen Moment warten?
7. **Etwas holen** — Hol bitte die Milch aus der Küche. / Kannst du mir
   etwas holen?
8. **In den Kühlschrank stellen** — Stell das bitte in den Kühlschrank.
   / Kannst du das in den Kühlschrank stellen?

## Image-asset brief (for when/if this gets built — not used today)

**Global rule (Teil 2):** keyword remains dominant; one simple home/
family icon per card; no narrative scenes, no named characters shown
doing the activity (keeps cards reusable across candidates).

**Teil 3:** each card needs a helper figure and a requester figure,
action not yet completed (matches the brief's existing convention from
Mock Exam 3's Teil 3 image brief — see that document for the exact
per-action visual rules, e.g. "action must not appear completed").
