# Übungssatz 2 (A1) — Human Review Pack

Status: **DRAFT, UNPUBLISHED, UNCERTIFIED.** Nothing in this document is visible to learners. Every row below has `is_published = false` and `is_certified_mock_exam = false` (or is a `mock_exam_sets` row with `is_published = false`). Nothing goes live until Angela reviews this pack and explicitly approves.

- `mock_exam_sets.id` = `9c78bc87-9c38-4472-ac55-f54c9ca3dcfd`
- Hören `exams.id` = `1204664c-f3b9-4cc2-90fa-1e1c2a5c0e47`
- Lesen `exams.id` = `1de5a685-cdc3-453a-9cdb-7f3eeedfa3aa`
- Schreiben `exams.id` = `d14c2b26-093d-4b96-82be-f2fc49007d5e`
- Validator report: `uebungssatz-2-validation-report.json` (47 PASS / 3 WARNING / 0 FAIL — see §6)

---

## 1. HÖREN — full scripts, questions, answers, audio

Real production ElevenLabs TTS (`eleven_turbo_v2_5`, `language_code: 'de'` — the same pipeline server.js uses for live Hören content). Two human-review correction rounds since the initial draft, both closed out:

1. **Speaker-identity fix** (`scripts/fix-uebungssatz-2-speaker-voices.js`) — the two dialogue clips' male-named speakers (Lukas, Herr Neumann) were originally voiced by a female ElevenLabs voice (both established `HOEREN_VOICE_A`/`HOEREN_VOICE_B` are documented female in server.js). Speaker 1 in both clips now uses a real male voice ("Adam", `pNInz6obpgDQGcFmaJgB`); Speaker 2 (Sofia, Mitarbeiterin — genuinely female) kept the existing voice.
2. **Content-validity fix** (`scripts/fix-uebungssatz-2-clip1-name.js`) — Clip 1's Q3 asked for the caller's name ("Lukas"), but "Lukas" was only ever a transcript *label* (labels are stripped before synthesis) — never actually spoken. Fixed by having Sofia greet him back by name, the smallest natural change. Q1/Q2/options/correct answers unchanged; only Q3's explanation was tightened to cite the new exact clue.

Naturalness/pronunciation/pacing/volume for the 3 untouched clips (Teil 2, Teil 3 both clips) still needs a real human listen — I have no audio-playback capability myself; see §7.

### Teil 1 (6 items, played twice each)

**Clip 1 — coffee meetup** — audio: https://udmunxzzuqoynlftapwh.supabase.co/storage/v1/object/public/hoerverstehen-audio/conversation/1784015931339-ohw5i9.mp3 *(regenerated twice — see corrections above)*

> Lukas: Hallo Sofia! Hast du morgen Zeit für einen Kaffee?
> Sofia: Hallo Lukas! Ja klar, ich habe Zeit. Wo treffen wir uns?
> Lukas: Wie wäre es im Café Sonne? Das ist in der Bahnhofstraße.
> Sofia: Gute Idee! Um wie viel Uhr denn?
> Lukas: Passt dir zehn Uhr?
> Sofia: Zehn Uhr ist perfekt. Bis morgen!
> Lukas: Bis morgen, Sofia!

| # | Question | a | b | c | Answer | Explanation |
|---|---|---|---|---|---|---|
| 1 | Wo treffen sich die zwei Freunde? | Im Café Sonne | Am Bahnhof | In der Schule | **a** | Lukas sagt "Wie wäre es im Café Sonne?" — die Bahnhofstraße ist nur der Straßenname. |
| 2 | Um wie viel Uhr treffen sie sich? | Um neun Uhr | Um zehn Uhr | Um elf Uhr | **b** | Lukas fragt "Passt dir zehn Uhr?", Sofia bestätigt. |
| 3 | Wer schlägt vor, ins Café Sonne zu gehen? | Sofia | Lukas | Beide zusammen | **b** | Sofia begrüßt ihn direkt mit "Hallo Lukas!" — er ist der Sprecher, der danach vorschlägt: "Wie wäre es im Café Sonne?"; Sofia stimmt zu ("Gute Idee!"). |

**Clip 2 — washing machine repair call** — audio: https://udmunxzzuqoynlftapwh.supabase.co/storage/v1/object/public/hoerverstehen-audio/conversation/1784015497877-if7kva.mp3 *(regenerated — speaker-identity fix only, no text change)*

> Herr Neumann: Guten Tag, hier ist Neumann. Meine Waschmaschine ist kaputt. Können Sie einen Techniker schicken?
> Mitarbeiterin: Guten Tag, Herr Neumann. Kein Problem. Sind Sie am Donnerstag zu Hause?
> Herr Neumann: Donnerstag geht leider nicht, ich arbeite. Geht es auch Freitag?
> Mitarbeiterin: Freitag ist möglich. Der Techniker kommt zwischen 14 und 16 Uhr.
> Herr Neumann: Perfekt, danke schön.
> Mitarbeiterin: Gern geschehen. Bis Freitag!

| # | Question | a | b | c | Answer | Explanation |
|---|---|---|---|---|---|---|
| 4 | Was ist kaputt? | Der Fernseher | Die Waschmaschine | Der Kühlschrank | **b** | "Meine Waschmaschine ist kaputt." |
| 5 | An welchem Tag kommt der Techniker? | Am Donnerstag | Am Freitag | Am Samstag | **b** | Donnerstag geht nicht; sie einigen sich auf Freitag. |
| 6 | Wann genau kommt der Techniker? | 10–12 Uhr | 12–14 Uhr | 14–16 Uhr | **c** | "Der Techniker kommt zwischen 14 und 16 Uhr." |

### Teil 2 (4 items, played once)

**Announcement — train platform change** — audio: https://udmunxzzuqoynlftapwh.supabase.co/storage/v1/object/public/hoerverstehen-audio/announcement/1784012443850-rh41xu.mp3

> Ihre Aufmerksamkeit bitte! Der Regionalzug nach München, Abfahrt 15:20 Uhr, fährt heute nicht von Gleis 3, sondern von Gleis 7. Wir bitten um Entschuldigung für die Verspätung von zehn Minuten. Der nächste Zug nach München fährt um 16:00 Uhr von Gleis 3. Reisende mit Fahrrädern nutzen bitte den hinteren Wagen. Vielen Dank für Ihr Verständnis.

| # | Statement | Answer | Explanation |
|---|---|---|---|
| 1 | Der Zug nach München fährt heute von Gleis 3. | **Falsch** | Fährt von Gleis 7, nicht Gleis 3. |
| 2 | Der Zug hat zehn Minuten Verspätung. | **Richtig** | "Verspätung von zehn Minuten." |
| 3 | Der nächste Zug nach München fährt um 16 Uhr. | **Richtig** | "fährt um 16:00 Uhr von Gleis 3." |
| 4 | Fahrräder sind in diesem Zug nicht erlaubt. | **Falsch** | Fahrräder sind im hinteren Wagen erlaubt. |

### Teil 3 (5 items, played twice each)

**Clip 1 — dentist reminder voicemail** — audio: https://udmunxzzuqoynlftapwh.supabase.co/storage/v1/object/public/hoerverstehen-audio/voicemail/1784012444604-1l8u5h.mp3

> Hallo, hier ist die Zahnarztpraxis Dr. Wagner. Wir rufen an, um Sie an Ihren Termin morgen um 9 Uhr 30 zu erinnern. Bitte bringen Sie Ihre Versichertenkarte mit. Wenn Sie den Termin nicht wahrnehmen können, rufen Sie uns bitte unter 030 44 55 66 an. Bis morgen!

| # | Question | a | b | c | Answer | Explanation |
|---|---|---|---|---|---|---|
| 1 | Warum ruft die Praxis an? | Neuen Termin vereinbaren | An einen Termin erinnern | Rechnung schicken | **b** | "um Sie an Ihren Termin ... zu erinnern." |
| 2 | Um wie viel Uhr ist der Termin? | 9:30 Uhr | 10:30 Uhr | 9:00 Uhr | **a** | "um 9 Uhr 30." |
| 3 | Was soll man mitbringen? | Personalausweis | Versichertenkarte | Bargeld | **b** | "Bitte bringen Sie Ihre Versichertenkarte mit." |

**Clip 2 — spare key voicemail** — audio: https://udmunxzzuqoynlftapwh.supabase.co/storage/v1/object/public/hoerverstehen-audio/voicemail/1784012447289-tbyryd.mp3

> Hi, hier ist Maria. Ich bin heute Nachmittag nicht zu Hause. Der Schlüssel für die Wohnung liegt bei meiner Nachbarin, Frau Kaya, in der zweiten Etage. Sie ist meistens ab 16 Uhr da. Ruf mich an, wenn es Probleme gibt. Danke!

| # | Question | a | b | c | Answer | Explanation |
|---|---|---|---|---|---|---|
| 4 | Wo liegt der Schlüssel? | Bei Maria | Bei Frau Kaya | Im Briefkasten | **b** | "liegt bei meiner Nachbarin, Frau Kaya." |
| 5 | Ab wann ist Frau Kaya normalerweise da? | 14 Uhr | 16 Uhr | 18 Uhr | **b** | "meistens ab 16 Uhr da." |

**Structure check:** 6 + 4 + 5 = 15 items, matching the official Start Deutsch 1 split exactly (an improvement over Übungssatz 1's own Teil 3, which lands at 6 items instead of the official 5 — see `seed-hoeren-a1.js`'s own header comment).

---

## 2. LESEN — texts and tasks

**Source draft used:** "A1 Lesen — Übungssatz 10" (`exam_id de7a9f7f-880f-4705-93fa-4c1c12b04593`, currently unpublished/uncertified, not linked to any set). **Why this one:** of the 9 spare A1 Lesen drafts, it had the most natural, fully adult-neutral content (no ages/school framing, unlike several others), no involvement in the one duplicate the validator found (Übungssatz 6 & 8 share a verbatim statement), and its WhatsApp text (Olivia rescheduling a rained-out picnic) needed no rewriting to sound natural. Its own Teil 2 (a 3-option Kleinanzeigen-matching task) was **not** reusable — that's exactly the "generic three-option multiple choice" format the approved structure says not to use for Teil 2 — so Teil 2 here is original content, not adapted.

### Teil 1 (5 Richtig/Falsch, two texts)

**Text 1 — "Nachricht"** (from Übungssatz 10, kept near-verbatim):
> WhatsApp von Olivia: Hallo Mark! Tut mir leid, aber unser Picknick morgen geht leider nicht. Es soll regnen. Können wir Sonntag stattdessen ins Café gehen? Ich kenne ein nettes Café in der Goethestraße. Wir treffen uns um 14 Uhr. Sag bitte Bescheid! Olivia

**Text 2 — "Aushang"** (new):
> Waschsalon Blitzsauber. Öffnungszeiten: täglich 7:00–22:00 Uhr. Waschmaschine: 4 Euro pro Ladung · Trockner: 2 Euro pro 30 Minuten. Bitte eigenes Waschmittel mitbringen. Der Waschsalon ist am 1. Mai wegen Renovierung geschlossen. Fragen? Rufen Sie an: 030 987 654

| # | Statement | Text | Answer | Explanation |
|---|---|---|---|---|
| 1 | Olivia und Mark wollten ein Picknick machen. | 1 | **Richtig** | "unser Picknick morgen" |
| 2 | Das Picknick fällt aus, weil es regnen soll. | 1 | **Richtig** | "Es soll regnen." |
| 3 | Olivia schlägt vor, sich am Montag zu treffen. | 1 | **Falsch** | Sie schlägt Sonntag vor, nicht Montag. |
| 4 | Der Waschsalon ist rund um die Uhr geöffnet. | 2 | **Falsch** | Nur 7:00–22:00 Uhr. |
| 5 | Am 1. Mai ist der Waschsalon geschlossen. | 2 | **Richtig** | Wegen Renovierung geschlossen. |

### Teil 2 (5 items — "Wo finden Sie diese Information?", a/b only)

| # | Situation | a | b | Answer | Explanation |
|---|---|---|---|---|---|
| 1 | Sie möchten wissen, wie viel eine U-Bahn-Fahrt kostet. | BVG Fahrplan-App (Linien/Abfahrtszeiten) | BVG Preisliste (3,20 € / 9,50 €) | **b** | Die App zeigt keine Preise. |
| 2 | Sie möchten wissen, ob die Bibliothek sonntags geöffnet hat. | Öffnungszeiten (Mo–Fr, Sa, sonntags zu) | Veranstaltungen (Mi Vorlesestunde) | **a** | Öffnungszeiten stehen nur in a. |
| 3 | Sie suchen eine Notfall-Zahnarztnummer am Wochenende. | Praxis Dr. Berg (Mo–Fr) | Zahnärztlicher Notdienst (Wochenende) | **b** | Notdienst ist explizit fürs Wochenende. |
| 4 | Sie möchten wissen, wann der nächste A1-Kurs beginnt. | Kursprogramm (Start jeden 1. Montag) | Anmeldeformular (nur Felder) | **a** | Startdatum nur im Kursprogramm. |
| 5 | Sie möchten wissen, was bei Ausweisverlust zu tun ist. | Terminvereinbarung (allgemein) | Verlust-Meldeverfahren (konkret) | **b** | b beschreibt genau das Vorgehen. |

**Note:** this uses the existing `multiple_choice` task_type/renderer (already a clean 2-option a/b UI) rather than the `matching` task_type — no code change was needed to hit the approved a/b format. Flagging so this is a conscious choice, not an oversight.

### Teil 3 (5 Richtig/Falsch, five independent signs)

| # | Sign | Statement | Answer | Explanation |
|---|---|---|---|---|
| 1 | "Fahrstuhl außer Betrieb — Bitte benutzen Sie die Treppe." | Der Fahrstuhl funktioniert nicht. | **Richtig** | "außer Betrieb" |
| 2 | "Apotheken-Notdienst heute Nacht: Apotheke Sonnenschein, Bahnhofstraße 5." | Die Apotheke am Markt ist heute Nacht im Notdienst. | **Falsch** | Es ist Apotheke Sonnenschein, nicht "am Markt" (a name never used in the sign). |
| 3 | "Bitte Schuhe ausziehen — Vielen Dank!" | Man soll die Schuhe anlassen. | **Falsch** | Sign asks to remove them. |
| 4 | "Geöffnet: Montag Ruhetag · Dienstag – Sonntag 11:00–23:00 Uhr." | Das Restaurant hat montags geschlossen. | **Richtig** | "Montag Ruhetag" |
| 5 | "Fotografieren und Filmen im Museum nicht gestattet." | Man darf im Museum fotografieren. | **Falsch** | Explicitly not allowed. |

**⚠️ Flag for Angela:** item 2's statement says "die Apotheke am Markt," a name that never appears in the sign itself (only "Apotheke Sonnenschein" does) — I did this deliberately so the false statement isn't simply the negation of the true text, but it's worth your judgment call on whether inventing a not-mentioned pharmacy name is clear enough at A1 or reads as confusing. Easy to swap for a plainer false statement if you'd rather.

---

## 3. SCHREIBEN — tasks and expected responses

### Teil 1 — form_fill (5 points)

> Sie möchten an einem Schwimmkurs für Erwachsene teilnehmen. Lesen Sie die Informationen und füllen Sie das Anmeldeformular aus.
>
> Schwimmkurs für Erwachsene "Sicher schwimmen" — Schwimmbad Nordbad — Kursleiter: Herr Keller — Tag: Dienstag — Uhrzeit: 19:00 Uhr — Preis: 60 Euro (10 Termine)

| Field | Expected answer |
|---|---|
| Kursname: | Sicher schwimmen |
| Kursleiter: | Herr Keller |
| Tag: | Dienstag |
| Uhrzeit: | 19:00 Uhr |
| Preis: | 60 Euro |

### Teil 2 — short_message (declared 12 points — see §6 on why 12, not the naive 10)

- **Situation:** A friend invited you to their birthday party; you can't attend.
- **Recipient:** Tom (friend)
- **Register:** informal (du-form) — **required**, see §6 risk note on why this can't be formal for A1 right now.
- **Communication purpose:** Politely decline, explain why, propose an alternative.
- **Required content points** (shown to the learner as a bulleted list via `bullet_points`):
  1. Sag, dass du nicht zur Party kommen kannst.
  2. Sag, warum du nicht kommen kannst.
  3. Schlage vor, euch ein andermal zu treffen.
- **Expected length:** 20–40 words (`word_min=20`, `word_target=30`)
- **Evaluation criteria** (review-only — actual grading uses server.js's fixed rubric, unaffected by this list): all 3 content points present; consistent du-form; greeting + closing present; comprehensible A1 German; ~20-40 words.

**Example answer:**
> Hallo Tom, vielen Dank für die Einladung zu deiner Geburtstagsparty! Ich kann leider nicht kommen, weil ich am Samstag arbeiten muss. Das tut mir sehr leid. Können wir uns nächste Woche treffen und zusammen Kaffee trinken? Alles Gute zum Geburtstag! Liebe Grüße, Anna

**Not reused:** the existing 9 spare A1 Schreiben drafts were deliberately not touched — all near-identical "Hallo, ich heiße X, ich bin 12-14 Jahre alt" templates in a child/teen register, missing the required form_fill Teil entirely (see the Phase 1 audit).

---

## 4. All explanations

Every scoreable item across Hören (15), Lesen (15), and the Schreiben form_fill (5) has an explanation tied to specific wording in its own text/audio — none are copy-pasted between items (validator's duplicate checks confirm this; see §6). Schreiben's short_message doesn't use per-item explanations (it's free-text graded, not a defensible single answer) — it has `evaluation_criteria` instead, which serves the equivalent review purpose.

## 5. Unresolved ambiguities / items requiring your explicit approval

1. **Audio naturalness/pacing/volume for 3 clips (Teil 2 announcement, both Teil 3 voicemails) still hasn't had a human listen.** Speaker-identity (resolved) and Teil 1 Clip 1's name-audibility defect (resolved) were both caught by your review and fixed — see corrections log in §1. See §7 for exactly what remains unverified by me.
2. **Lesen Teil 3, item 2** — the false statement names "die Apotheke am Markt," a location name invented for the false option rather than appearing in the sign. Confirm this reads clearly at A1, or tell me to simplify it. **Still awaiting your decision — untouched.**
3. **Lesen Teil 2 uses the existing `multiple_choice` task_type (2 options) rather than a `matching` task_type**, even though it's framed as "Wo finden Sie Informationen?" — functionally identical UI (a/b radio choice), just confirming this is the intended implementation rather than something requiring the `matching` renderer specifically.
4. **Schreiben register is informal only** — a formal-register A1 task is not currently gradable correctly (see §6 risk). Confirm you're fine holding to informal-only for A1 Schreiben until/unless the grading prompt is deliberately extended (out of scope for this content phase).
5. **Sprechen has no fixed content for this set** — by design, per your instructions (dynamic per-session, unchanged). Confirm this is still what you want for Übungssatz 2 specifically, not just as a general default.

## 6. Validator findings (full detail in `uebungssatz-2-validation-report.json`)

**47 PASS, 3 WARNING, 0 FAIL.** All three warnings are non-defects, worth knowing about but not action items against this content specifically:

- `sprechen_topic_ids` is null — expected, Sprechen is dynamic (see item 5 above).
- Schreiben's declared max_score total (17) isn't the real scoring max in a way that matches the naive "5+10=15" official-points assumption — **confirmed pre-existing, true of Übungssatz 1 too, and now written up properly in `mock-exam-certification-checklist.md` §1.3/§1.5** (updated this round — documentation-only change, no scoring code touched). See the separate scoring reconciliation note for the full explanation.
- No re-certification timestamp support exists yet (pre-existing schema gap, unrelated to this draft).

## 7. Audio verification table

| Clip | Speaker(s) | Duration | Transcript matches audio | Question alignment | Mobile playback | Speaker identity | Pronunciation / pacing / volume |
|---|---|---|---|---|---|---|---|
| Teil 1, Clip 1 (coffee) | Lukas = male voice ("Adam"), Sofia = female voice — 2 distinct IDs | 16.9s | ✅ verified | ✅ verified — Q3 fixed, name now genuinely spoken | ✅ verified | ✅ **resolved** (was female, now male) | ⏳ needs human listen — **re-review, audio changed twice** |
| Teil 1, Clip 2 (washing machine) | Herr Neumann = male voice ("Adam"), Mitarbeiterin = female voice — 2 distinct IDs | 20.4s | ✅ verified | ✅ verified | ✅ verified | ✅ **resolved** (was female, now male) | ⏳ needs human listen — **re-review, audio changed** |
| Teil 2 (train announcement) | 1 (neutral, no name/gender in script) | 22.8s | ✅ verified | ✅ verified | ✅ verified | — n/a, neutral | ⏳ still needs original human listen |
| Teil 3, Clip 1 (dentist voicemail) | 1 (neutral, no self-identified gender) | 18.2s | ✅ verified | ✅ verified | ✅ verified | — n/a, neutral | ⏳ still needs original human listen |
| Teil 3, Clip 2 (spare key voicemail) | 1 (Maria, female — matches) | 14.6s | ✅ verified | ✅ verified | ✅ verified | ✅ already correct | ⏳ still needs original human listen |

**Reviewer notes:**
- Two defects your review already caught are resolved: (1) both dialogue clips' male speakers were voiced female — fixed, confirmed via which ElevenLabs voice ID synthesized which line; (2) Clip 1's Q3 asked for a name ("Lukas") that was never actually spoken — fixed by having Sofia greet him by name.
- I still have no audio-playback capability myself — pronunciation, pacing, and volume for all 5 clips (including the 2 just regenerated) remain **genuinely unverified by me**. The 2 regenerated clips need a fresh listen since their audio changed; the other 3 were never listened to in the first place.
- Both established voices (`HOEREN_VOICE_A`/`HOEREN_VOICE_B`) are still female — this only mattered for clips where a speaker's gender is explicitly established (name/title). The 3 single-speaker clips are gender-neutral in their scripts (no self-identifying name/title), so the existing female voice isn't a mismatch there.

---

**Bottom line for Angela:** Both defects from your last review are fixed and re-verified (validator clean, mobile playback confirmed, transcript/question/answer/explanation alignment re-checked). The 2 corrected clips need a fresh listen since the audio changed; the 3 untouched clips still need their first human listen. Nothing else here should need another round unless the listen-through finds something new.
