/**
 * Übungssatz 2 (A1) — complete unpublished draft.
 *
 * Creates one Hören exam, one Lesen exam, one Schreiben exam (each
 * is_published=false, is_certified_mock_exam=false), their exam_tasks, and
 * one mock_exam_sets row (set_number=2, is_published=false). Nothing here
 * is learner-visible until a human reviews it and explicitly certifies +
 * publishes — this script never sets either flag to true.
 *
 * Lesen Teil 1 is adapted from the strongest existing A1 Lesen draft
 * ("A1 Lesen — Übungssatz 10", exam id de7a9f7f-880f-4705-93fa-4c1c12b04593)
 * — its Olivia/picnic-café WhatsApp text, lightly trimmed, paired with a
 * freshly authored second text. Teil 2 and Teil 3 are original content
 * (the source draft's Teil 2 was a 3-option Kleinanzeigen-matching task,
 * which is exactly the format Teil 2 must NOT use per the approved
 * structure, so it wasn't reusable as-is).
 *
 * Hören audio: real ElevenLabs production TTS (eleven_turbo_v2_5,
 * language_code 'de' — the same pipeline/model server.js's own
 * hoerenTTS()/hoerenSynthesize() use for live content), not a placeholder.
 * Reflects two human-review correction rounds after the initial draft:
 *   1. Speaker-identity fix — HOEREN_VOICE_A/B are both documented female
 *      in server.js; the two dialogue clips' male-named speakers (Lukas,
 *      Herr Neumann) were originally voiced female. Both now use a real
 *      male ElevenLabs voice ("Adam", pNInz6obpgDQGcFmaJgB) for Speaker 1;
 *      Speaker 2 (Sofia, Mitarbeiterin — both female) kept HOEREN_VOICE_B.
 *   2. Content-validity fix — Teil 1 Clip 1's Q3 asked for the caller's
 *      name ("Lukas"), but "Lukas" was only ever a transcript label
 *      (labels are stripped before synthesis), never actually spoken.
 *      Fixed by having Sofia greet him back by name ("Hallo Lukas!") —
 *      smallest natural change, no question/answer/option text changed,
 *      only Q3's explanation was tightened to cite the new exact clue.
 * The URLs below are the final, corrected audio actually live in
 * production storage today — not what a fresh run of this script would
 * itself generate (it has no TTS call left in it; see
 * scripts/fix-uebungssatz-2-speaker-voices.js and
 * scripts/fix-uebungssatz-2-clip1-name.js for the actual regeneration
 * code, kept as an audit trail of how each fix was produced).
 *
 * Not idempotent — already run once against production; re-running would
 * create duplicate exams/tasks, not update the existing ones.
 */
require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
// Final, corrected audio — matches what's actually live in
// production storage after both human-review fix rounds.
const audioUrls = {
  'teil1-clip-a.wav': 'https://udmunxzzuqoynlftapwh.supabase.co/storage/v1/object/public/hoerverstehen-audio/conversation/1784015931339-ohw5i9.mp3',
  'teil1-clip-b.wav': 'https://udmunxzzuqoynlftapwh.supabase.co/storage/v1/object/public/hoerverstehen-audio/conversation/1784015497877-if7kva.mp3',
  'teil2-announcement.wav': 'https://udmunxzzuqoynlftapwh.supabase.co/storage/v1/object/public/hoerverstehen-audio/announcement/1784012443850-rh41xu.mp3',
  'teil3-clip-a.wav': 'https://udmunxzzuqoynlftapwh.supabase.co/storage/v1/object/public/hoerverstehen-audio/voicemail/1784012444604-1l8u5h.mp3',
  'teil3-clip-b.wav': 'https://udmunxzzuqoynlftapwh.supabase.co/storage/v1/object/public/hoerverstehen-audio/voicemail/1784012447289-tbyryd.mp3',
};
const fs = require('fs');
const path = require('path');

(async () => {
  const out = { created_at: new Date().toISOString() };

  // ══════════════════════════════════════════════════════════════════
  // HÖREN
  // ══════════════════════════════════════════════════════════════════
  const hoerenIns = await sb.from('exams').insert({
    level: 'A1', title: 'A1 Hören — Übungssatz 2', section: 'hoeren',
    is_published: false, is_certified_mock_exam: false,
  }).select('id').single();
  if (hoerenIns.error) { console.error('Hören exam insert FAILED:', hoerenIns.error); process.exit(1); }
  const HOEREN_ID = hoerenIns.data.id;
  console.log('Hören exam:', HOEREN_ID);

  const hoerenT1 = {
    exam_id: HOEREN_ID, task_number: 1, task_type: 'listening_multiple_choice',
    difficulty_tag: 'dialogue_comprehension', max_score: 6, order_index: 1,
    instructions:
      '🇩🇪 Sie hören zwei kurze Gespräche. Wählen Sie bei jeder Frage die richtige Antwort: a, b oder c. Sie hören jeden Text zweimal.\n' +
      '🇬🇧 You will hear two short dialogues. For each question, choose the correct answer: a, b or c. You will hear each text twice.',
    stimulus: {
      play_count: 2,
      clips: [
        {
          scenario: 'Two friends arranging to meet for coffee.',
          audio_url: audioUrls['teil1-clip-a.wav'],
          transcript:
            'Lukas: Hallo Sofia! Hast du morgen Zeit für einen Kaffee?\n' +
            'Sofia: Hallo Lukas! Ja klar, ich habe Zeit. Wo treffen wir uns?\n' +
            'Lukas: Wie wäre es im Café Sonne? Das ist in der Bahnhofstraße.\n' +
            'Sofia: Gute Idee! Um wie viel Uhr denn?\n' +
            'Lukas: Passt dir zehn Uhr?\n' +
            'Sofia: Zehn Uhr ist perfekt. Bis morgen!\n' +
            'Lukas: Bis morgen, Sofia!',
          questions: [
            { type: 'multiple_choice', question_text: 'Wo treffen sich die zwei Freunde?', options: ['Im Café Sonne', 'Am Bahnhof', 'In der Schule'], correct_answer: 'Im Café Sonne', explanation: 'Lukas sagt: "Wie wäre es im Café Sonne?" — die Bahnhofstraße ist nur der Straßenname, nicht der Treffpunkt selbst.' },
            { type: 'multiple_choice', question_text: 'Um wie viel Uhr treffen sie sich?', options: ['Um neun Uhr', 'Um zehn Uhr', 'Um elf Uhr'], correct_answer: 'Um zehn Uhr', explanation: 'Lukas fragt "Passt dir zehn Uhr?" und Sofia antwortet: "Zehn Uhr ist perfekt."' },
            { type: 'multiple_choice', question_text: 'Wer schlägt vor, ins Café Sonne zu gehen?', options: ['Sofia', 'Lukas', 'Beide zusammen'], correct_answer: 'Lukas', explanation: 'Sofia begrüßt ihn direkt mit "Hallo Lukas!" — er ist der Sprecher, der danach vorschlägt: "Wie wäre es im Café Sonne?"; Sofia stimmt zu ("Gute Idee!").' },
          ],
        },
        {
          scenario: 'A customer calls a repair service about a broken washing machine.',
          audio_url: audioUrls['teil1-clip-b.wav'],
          transcript:
            'Herr Neumann: Guten Tag, hier ist Neumann. Meine Waschmaschine ist kaputt. Können Sie einen Techniker schicken?\n' +
            'Mitarbeiterin: Guten Tag, Herr Neumann. Kein Problem. Sind Sie am Donnerstag zu Hause?\n' +
            'Herr Neumann: Donnerstag geht leider nicht, ich arbeite. Geht es auch Freitag?\n' +
            'Mitarbeiterin: Freitag ist möglich. Der Techniker kommt zwischen 14 und 16 Uhr.\n' +
            'Herr Neumann: Perfekt, danke schön.\n' +
            'Mitarbeiterin: Gern geschehen. Bis Freitag!',
          questions: [
            { type: 'multiple_choice', question_text: 'Was ist kaputt?', options: ['Der Fernseher', 'Die Waschmaschine', 'Der Kühlschrank'], correct_answer: 'Die Waschmaschine', explanation: 'Herr Neumann sagt: "Meine Waschmaschine ist kaputt."' },
            { type: 'multiple_choice', question_text: 'An welchem Tag kommt der Techniker?', options: ['Am Donnerstag', 'Am Freitag', 'Am Samstag'], correct_answer: 'Am Freitag', explanation: 'Herr Neumann kann Donnerstag nicht ("Donnerstag geht leider nicht"), also einigen sie sich auf Freitag ("Freitag ist möglich").' },
            { type: 'multiple_choice', question_text: 'Wann genau kommt der Techniker?', options: ['Zwischen 10 und 12 Uhr', 'Zwischen 12 und 14 Uhr', 'Zwischen 14 und 16 Uhr'], correct_answer: 'Zwischen 14 und 16 Uhr', explanation: 'Die Mitarbeiterin sagt: "Der Techniker kommt zwischen 14 und 16 Uhr."' },
          ],
        },
      ],
    },
  };

  const hoerenT2 = {
    exam_id: HOEREN_ID, task_number: 2, task_type: 'listening_true_false',
    difficulty_tag: 'announcement_comprehension', max_score: 4, order_index: 2,
    instructions:
      '🇩🇪 Sie hören eine Durchsage. Sind die Aussagen dazu richtig oder falsch? Sie hören den Text einmal.\n' +
      '🇬🇧 You will hear an announcement. Are the statements about it right or wrong? You will hear the text once.',
    stimulus: {
      play_count: 1,
      clips: [
        {
          scenario: 'Train station announcement about a platform change and delay.',
          audio_url: audioUrls['teil2-announcement.wav'],
          transcript:
            'Ihre Aufmerksamkeit bitte! Der Regionalzug nach München, Abfahrt 15:20 Uhr, fährt heute nicht von Gleis 3, sondern von Gleis 7. ' +
            'Wir bitten um Entschuldigung für die Verspätung von zehn Minuten. Der nächste Zug nach München fährt um 16:00 Uhr von Gleis 3. ' +
            'Reisende mit Fahrrädern nutzen bitte den hinteren Wagen. Vielen Dank für Ihr Verständnis.',
          questions: [
            { type: 'true_false', question_text: 'Der Zug nach München fährt heute von Gleis 3.', options: ['Richtig', 'Falsch'], correct_answer: 'Falsch', explanation: 'Der Ansager sagt: "fährt heute nicht von Gleis 3, sondern von Gleis 7."' },
            { type: 'true_false', question_text: 'Der Zug hat zehn Minuten Verspätung.', options: ['Richtig', 'Falsch'], correct_answer: 'Richtig', explanation: '"Wir bitten um Entschuldigung für die Verspätung von zehn Minuten."' },
            { type: 'true_false', question_text: 'Der nächste Zug nach München fährt um 16 Uhr.', options: ['Richtig', 'Falsch'], correct_answer: 'Richtig', explanation: '"Der nächste Zug nach München fährt um 16:00 Uhr von Gleis 3."' },
            { type: 'true_false', question_text: 'Fahrräder sind in diesem Zug nicht erlaubt.', options: ['Richtig', 'Falsch'], correct_answer: 'Falsch', explanation: '"Reisende mit Fahrrädern nutzen bitte den hinteren Wagen" — Fahrräder sind erlaubt, im hinteren Wagen.' },
          ],
        },
      ],
    },
  };

  const hoerenT3 = {
    exam_id: HOEREN_ID, task_number: 3, task_type: 'listening_multiple_choice',
    difficulty_tag: 'monologue_comprehension', max_score: 5, order_index: 3,
    instructions:
      '🇩🇪 Sie hören zwei Anrufe auf einem Anrufbeantworter. Wählen Sie bei jeder Frage die richtige Antwort: a, b oder c. Sie hören jeden Text zweimal.\n' +
      '🇬🇧 You will hear two voicemail messages. For each question, choose the correct answer: a, b or c. You will hear each text twice.',
    stimulus: {
      play_count: 2,
      clips: [
        {
          scenario: 'A dental practice leaves a voicemail reminding a patient of their appointment.',
          audio_url: audioUrls['teil3-clip-a.wav'],
          transcript:
            'Hallo, hier ist die Zahnarztpraxis Dr. Wagner. Wir rufen an, um Sie an Ihren Termin morgen um 9 Uhr 30 zu erinnern. ' +
            'Bitte bringen Sie Ihre Versichertenkarte mit. Wenn Sie den Termin nicht wahrnehmen können, rufen Sie uns bitte unter 030 44 55 66 an. Bis morgen!',
          questions: [
            { type: 'multiple_choice', question_text: 'Warum ruft die Praxis an?', options: ['Um einen neuen Termin zu vereinbaren', 'Um an einen Termin zu erinnern', 'Um eine Rechnung zu schicken'], correct_answer: 'Um an einen Termin zu erinnern', explanation: '"Wir rufen an, um Sie an Ihren Termin morgen zu erinnern."' },
            { type: 'multiple_choice', question_text: 'Um wie viel Uhr ist der Termin?', options: ['Um 9:30 Uhr', 'Um 10:30 Uhr', 'Um 9:00 Uhr'], correct_answer: 'Um 9:30 Uhr', explanation: '"an Ihren Termin morgen um 9 Uhr 30."' },
            { type: 'multiple_choice', question_text: 'Was soll man mitbringen?', options: ['Den Personalausweis', 'Die Versichertenkarte', 'Bargeld'], correct_answer: 'Die Versichertenkarte', explanation: '"Bitte bringen Sie Ihre Versichertenkarte mit."' },
          ],
        },
        {
          scenario: "A friend's voicemail explaining where to find a spare key.",
          audio_url: audioUrls['teil3-clip-b.wav'],
          transcript:
            'Hi, hier ist Maria. Ich bin heute Nachmittag nicht zu Hause. Der Schlüssel für die Wohnung liegt bei meiner Nachbarin, Frau Kaya, in der zweiten Etage. ' +
            'Sie ist meistens ab 16 Uhr da. Ruf mich an, wenn es Probleme gibt. Danke!',
          questions: [
            { type: 'multiple_choice', question_text: 'Wo liegt der Schlüssel?', options: ['Bei Maria', 'Bei der Nachbarin, Frau Kaya', 'Im Briefkasten'], correct_answer: 'Bei der Nachbarin, Frau Kaya', explanation: '"Der Schlüssel für die Wohnung liegt bei meiner Nachbarin, Frau Kaya."' },
            { type: 'multiple_choice', question_text: 'Ab wann ist Frau Kaya normalerweise zu Hause?', options: ['Ab 14 Uhr', 'Ab 16 Uhr', 'Ab 18 Uhr'], correct_answer: 'Ab 16 Uhr', explanation: '"Sie ist meistens ab 16 Uhr da."' },
          ],
        },
      ],
    },
  };

  for (const t of [hoerenT1, hoerenT2, hoerenT3]) {
    const r = await sb.from('exam_tasks').insert(t).select('id, task_number').single();
    if (r.error) { console.error('Hören task insert FAILED:', r.error); process.exit(1); }
    console.log('  Hören task', r.data.task_number, 'inserted:', r.data.id);
  }
  out.hoeren_exam_id = HOEREN_ID;

  // ══════════════════════════════════════════════════════════════════
  // LESEN
  // ══════════════════════════════════════════════════════════════════
  const lesenIns = await sb.from('exams').insert({
    level: 'A1', title: 'A1 Lesen — Übungssatz 2', section: 'lesen',
    is_published: false, is_certified_mock_exam: false,
  }).select('id').single();
  if (lesenIns.error) { console.error('Lesen exam insert FAILED:', lesenIns.error); process.exit(1); }
  const LESEN_ID = lesenIns.data.id;
  console.log('Lesen exam:', LESEN_ID);

  const lesenT1 = {
    exam_id: LESEN_ID, task_number: 1, task_type: 'true_false',
    difficulty_tag: 'basic_comprehension', max_score: 5, order_index: 1,
    instructions:
      '🇩🇪 Lies die zwei Texte. Sind die Aussagen richtig oder falsch?\n' +
      '🇬🇧 Read the two texts. Are the statements right or wrong?',
    stimulus: {
      texts: [
        {
          label: 'Nachricht',
          text: 'WhatsApp von Olivia:\nHallo Mark! Tut mir leid, aber unser Picknick morgen geht leider nicht. Es soll regnen. Können wir Sonntag stattdessen ins Café gehen? Ich kenne ein nettes Café in der Goethestraße. Wir treffen uns um 14 Uhr. Sag bitte Bescheid! Olivia',
        },
        {
          label: 'Aushang',
          text: 'Waschsalon Blitzsauber\nÖffnungszeiten: täglich 7:00–22:00 Uhr\nWaschmaschine: 4 Euro pro Ladung · Trockner: 2 Euro pro 30 Minuten\nBitte eigenes Waschmittel mitbringen\nDer Waschsalon ist am 1. Mai wegen Renovierung geschlossen\nFragen? Rufen Sie an: 030 987 654',
        },
      ],
      statements: [
        { s: 'Olivia und Mark wollten ein Picknick machen.', answer: true, text_index: 0, explanation: 'Olivia schreibt "unser Picknick morgen" — das Picknick war für sie beide geplant.' },
        { s: 'Das Picknick fällt aus, weil es regnen soll.', answer: true, text_index: 0, explanation: 'Olivia schreibt: "geht leider nicht. Es soll regnen."' },
        { s: 'Olivia schlägt vor, sich am Montag zu treffen.', answer: false, text_index: 0, explanation: 'Olivia schlägt Sonntag vor ("Können wir Sonntag stattdessen..."), nicht Montag.' },
        { s: 'Der Waschsalon ist rund um die Uhr (24 Stunden) geöffnet.', answer: false, text_index: 1, explanation: 'Die Öffnungszeiten sind "täglich 7:00–22:00 Uhr", nicht 24 Stunden.' },
        { s: 'Am 1. Mai ist der Waschsalon geschlossen.', answer: true, text_index: 1, explanation: 'Der Aushang sagt: "Der Waschsalon ist am 1. Mai wegen Renovierung geschlossen."' },
      ],
    },
  };

  const lesenT2 = {
    exam_id: LESEN_ID, task_number: 2, task_type: 'multiple_choice',
    difficulty_tag: 'information_location', max_score: 5, order_index: 2,
    instructions:
      '🇩🇪 Sie brauchen bestimmte Informationen. Wo finden Sie diese Information: a oder b?\n' +
      '🇬🇧 You need specific information. Where do you find it: a or b?',
    stimulus: {
      text: '',
      questions: [
        {
          q: 'Sie möchten wissen, wie viel eine Fahrt mit der U-Bahn kostet.',
          options: { a: 'BVG Fahrplan-App: Linienpläne und Abfahrtszeiten für Bus und Bahn in Berlin.', b: 'BVG Preisliste: Einzelfahrschein 3,20 Euro, Tageskarte 9,50 Euro, gültig in Berlin AB.' },
          answer: 'b',
          explanation: 'Die Preisliste (b) nennt die Kosten. Die App (a) zeigt nur Linien und Abfahrtszeiten, keine Preise.',
        },
        {
          q: 'Sie möchten wissen, ob die Bibliothek am Sonntag geöffnet hat.',
          options: { a: 'Stadtbibliothek Öffnungszeiten: Mo–Fr 10–19 Uhr, Sa 10–14 Uhr, sonntags geschlossen.', b: 'Stadtbibliothek Veranstaltungen: Jeden Mittwoch Vorlesestunde für Kinder um 16 Uhr.' },
          answer: 'a',
          explanation: 'Die Öffnungszeiten (a) nennen die Tage. Die Veranstaltungsliste (b) sagt nichts über Sonntagsöffnung.',
        },
        {
          q: 'Sie suchen eine Telefonnummer für einen Notfall beim Zahnarzt am Wochenende.',
          options: { a: 'Zahnarztpraxis Dr. Berg: Termine Mo–Fr 8–17 Uhr, Tel. 030 111 222.', b: 'Zahnärztlicher Notdienst Berlin: Wochenende und Feiertage, Tel. 030 890 04 333.' },
          answer: 'b',
          explanation: 'Der Notdienst (b) ist speziell für Wochenende/Feiertage. Die Praxis (a) hat nur Mo–Fr geöffnet.',
        },
        {
          q: 'Sie möchten wissen, wann der nächste Deutschkurs für Anfänger beginnt.',
          options: { a: 'Volkshochschule Kursprogramm: Deutschkurs A1, Start jeden ersten Montag im Monat.', b: 'Volkshochschule Anmeldeformular: Name, Adresse, Telefonnummer und Kursnummer eintragen.' },
          answer: 'a',
          explanation: 'Das Kursprogramm (a) nennt den Starttermin. Das Anmeldeformular (b) ist nur zum Ausfüllen, ohne Datum.',
        },
        {
          q: 'Sie möchten wissen, was Sie tun müssen, wenn Ihr Personalausweis verloren geht.',
          options: { a: 'Bürgeramt Berlin: Terminvereinbarung online für alle Dienstleistungen.', b: 'Bürgeramt Berlin: Verlust von Ausweisdokumenten sofort persönlich melden, Ersatzausweis dauert ca. 3 Wochen.' },
          answer: 'b',
          explanation: 'Option b beschreibt genau das Vorgehen bei einem verlorenen Ausweis. Option a ist nur die allgemeine Terminbuchung.',
        },
      ],
    },
  };

  const lesenT3 = {
    exam_id: LESEN_ID, task_number: 3, task_type: 'true_false',
    difficulty_tag: 'sign_comprehension', max_score: 5, order_index: 3,
    instructions:
      '🇩🇪 Lies die Schilder. Sind die Aussagen richtig oder falsch?\n' +
      '🇬🇧 Read the signs. Are the statements right or wrong?',
    stimulus: {
      texts: [
        { label: 'Schild', text: 'Fahrstuhl außer Betrieb — Bitte benutzen Sie die Treppe.' },
        { label: 'Schild', text: 'Apotheken-Notdienst heute Nacht: Apotheke Sonnenschein, Bahnhofstraße 5.' },
        { label: 'Schild', text: 'Bitte Schuhe ausziehen — Vielen Dank!' },
        { label: 'Schild', text: 'Geöffnet: Montag Ruhetag · Dienstag – Sonntag 11:00–23:00 Uhr.' },
        { label: 'Schild', text: 'Fotografieren und Filmen im Museum nicht gestattet.' },
      ],
      statements: [
        { s: 'Der Fahrstuhl funktioniert nicht.', answer: true, text_index: 0, explanation: 'Das Schild sagt "außer Betrieb" — der Fahrstuhl funktioniert nicht.' },
        { s: 'Die Apotheke am Markt ist heute Nacht im Notdienst.', answer: false, text_index: 1, explanation: 'Im Notdienst ist heute Nacht die Apotheke Sonnenschein, nicht "die Apotheke am Markt".' },
        { s: 'Man soll die Schuhe anlassen.', answer: false, text_index: 2, explanation: 'Das Schild bittet, die Schuhe auszuziehen, nicht anzulassen.' },
        { s: 'Das Restaurant hat montags geschlossen.', answer: true, text_index: 3, explanation: '"Montag Ruhetag" bedeutet, dass das Restaurant montags geschlossen ist.' },
        { s: 'Man darf im Museum fotografieren.', answer: false, text_index: 4, explanation: 'Das Schild sagt: "Fotografieren und Filmen im Museum nicht gestattet."' },
      ],
    },
  };

  for (const t of [lesenT1, lesenT2, lesenT3]) {
    const r = await sb.from('exam_tasks').insert(t).select('id, task_number').single();
    if (r.error) { console.error('Lesen task insert FAILED:', r.error); process.exit(1); }
    console.log('  Lesen task', r.data.task_number, 'inserted:', r.data.id);
  }
  out.lesen_exam_id = LESEN_ID;

  // ══════════════════════════════════════════════════════════════════
  // SCHREIBEN
  // ══════════════════════════════════════════════════════════════════
  const schreibenIns = await sb.from('exams').insert({
    level: 'A1', title: 'A1 Schreiben — Übungssatz 2', section: 'schreiben',
    is_published: false, is_certified_mock_exam: false,
  }).select('id').single();
  if (schreibenIns.error) { console.error('Schreiben exam insert FAILED:', schreibenIns.error); process.exit(1); }
  const SCHREIBEN_ID = schreibenIns.data.id;
  console.log('Schreiben exam:', SCHREIBEN_ID);

  const schreibenT1 = {
    exam_id: SCHREIBEN_ID, task_number: 1, task_type: 'form_fill',
    difficulty_tag: 'form_completion', max_score: 5, order_index: 1,
    instructions:
      '🇩🇪 Sie möchten an einem Schwimmkurs teilnehmen. Lesen Sie die Informationen und füllen Sie das Anmeldeformular aus.\n' +
      '🇬🇧 You want to join a swimming course. Read the information and fill in the registration form.',
    stimulus: {
      text:
        'Schwimmkurs für Erwachsene "Sicher schwimmen"\n' +
        'Schwimmbad Nordbad\n' +
        'Kursleiter: Herr Keller\n' +
        'Tag: Dienstag\n' +
        'Uhrzeit: 19:00 Uhr\n' +
        'Preis: 60 Euro (10 Termine)',
      fields: ['Kursname:', 'Kursleiter:', 'Tag:', 'Uhrzeit:', 'Preis:'],
      answers: ['Sicher schwimmen', 'Herr Keller', 'Dienstag', '19:00 Uhr', '60 Euro'],
    },
  };

  const schreibenT2 = {
    exam_id: SCHREIBEN_ID, task_number: 2, task_type: 'short_message',
    difficulty_tag: 'simple_sentences', max_score: 12, order_index: 2,
    instructions:
      '🇩🇪 Lies die Situation. Schreibe eine Nachricht an Tom. Nutze die drei Punkte. Schreibe mindestens 20 Wörter.\n' +
      '🇬🇧 Read the situation. Write a message to Tom. Use the three points. Write at least 20 words.',
    stimulus: {
      message: 'Dein Freund Tom feiert am Samstag seinen Geburtstag und hat dich eingeladen. Du kannst leider nicht kommen. Schreib Tom eine Nachricht.',
      bullet_points: [
        'Sag, dass du nicht zur Party kommen kannst.',
        'Sag, warum du nicht kommen kannst.',
        'Schlage vor, euch ein andermal zu treffen.',
      ],
      word_target: 30,
      word_min: 20,
      example_answer:
        'Hallo Tom, vielen Dank für die Einladung zu deiner Geburtstagsparty! Ich kann leider nicht kommen, weil ich am Samstag arbeiten muss. ' +
        'Das tut mir sehr leid. Können wir uns nächste Woche treffen und zusammen Kaffee trinken? Alles Gute zum Geburtstag! Liebe Grüße, Anna',
      // Review-only metadata — not read by the renderer or the grading
      // engine (server.js's A1 grading prompt hardcodes an informal/du-form
      // expectation for every A1 short_message task; there is no per-task
      // register field it reads). Kept here purely so Angela's review pack
      // shows the intended register/purpose/criteria explicitly.
      situation: 'A friend invited you to their birthday party. You cannot attend.',
      recipient: 'Tom (friend)',
      register: 'informal',
      communication_purpose: 'Politely decline an invitation, explain why, and propose an alternative.',
      evaluation_criteria: [
        'All 3 content points present (declines, gives a reason, proposes an alternative)',
        'Consistent informal register (du-form) throughout',
        'Greeting and closing present',
        'Comprehensible German at A1 level',
        'Length roughly 20-40 words',
      ],
    },
  };

  for (const t of [schreibenT1, schreibenT2]) {
    const r = await sb.from('exam_tasks').insert(t).select('id, task_number').single();
    if (r.error) { console.error('Schreiben task insert FAILED:', r.error); process.exit(1); }
    console.log('  Schreiben task', r.data.task_number, 'inserted:', r.data.id);
  }
  out.schreiben_exam_id = SCHREIBEN_ID;

  // ══════════════════════════════════════════════════════════════════
  // MOCK EXAM SET
  // ══════════════════════════════════════════════════════════════════
  const setIns = await sb.from('mock_exam_sets').insert({
    level: 'A1', set_number: 2, title: 'A1 — Übungssatz 2',
    hoeren_exam_id: HOEREN_ID, lesen_exam_id: LESEN_ID, schreiben_exam_id: SCHREIBEN_ID,
    sprechen_topic_ids: null, // Sprechen stays dynamic — no fixed topics, per instructions
    is_published: false,
  }).select('id').single();
  if (setIns.error) { console.error('mock_exam_sets insert FAILED:', setIns.error); process.exit(1); }
  out.set_id = setIns.data.id;
  console.log('mock_exam_sets row:', setIns.data.id);

  fs.writeFileSync(path.join(__dirname, '..', 'uebungssatz-2-ids.json'), JSON.stringify(out, null, 2));
  console.log('\nAll IDs saved to uebungssatz-2-ids.json');
  console.log(JSON.stringify(out, null, 2));
})();
