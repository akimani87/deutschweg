/**
 * A1 Mock Exam 3 — Hören/Lesen/Schreiben content, authored from the
 * certified source package a1-mock-exam-3-certified-content.md.
 *
 * Exam shells already exist (created by create-draft-mock-exam-set.js,
 * set id 364c5eb6-4269-436b-90ac-0a48d48a5472):
 *   hoeren    = c148c664-84e5-42a0-90b4-76b59cd1e64d
 *   lesen     = bc6d7314-c1eb-4c25-8fc5-a8436b426807
 *   schreiben = d9e5906b-fbb0-4bc1-8109-ff731ad2a3b4
 * This script only inserts exam_tasks rows into those shells. Both exams
 * and the set stay is_published=false / is_certified_mock_exam=false.
 *
 * Content fidelity: every German script, question, option, Richtig/Falsch
 * value, and correct answer is copied verbatim from the certified .md.
 * The only additions beyond the certified text are fields the existing
 * schema requires that the certified doc doesn't cover per-item:
 *   - Hören/Lesen: an "explanation" per question (required for
 *     exam.explanations_present to PASS) — each one factually quotes the
 *     exact clause in the transcript/text that supports the given answer,
 *     never overriding or second-guessing the certified answer.
 *   - Hören: a short English "scenario" line per clip (matches the
 *     Übungssatz 2 convention) — a neutral one-line summary, not new plot.
 * Formatting-only changes (all still exactly the certified wording):
 *   - Hören scripts: "/"-separated turns split onto labeled lines
 *     (Frau:/Mann:/Empfang: etc.) for transcript readability.
 *   - Lesen Teil 3 signs: "/" line-breaks preserved as newlines.
 * No audio_url is set (audio generation is a separate follow-up task) —
 * this intentionally produces a FAIL on hoeren.audio_references_exist in
 * the validator, expected until that task runs.
 *
 * Schreiben Teil 2 max_score is 12 (not the DB-nominal 10/15), matching
 * the real runtime rubric max already live for Übungssatz 1 and 2 (see
 * mock-exam-certification-checklist.md §1.3) — copying Übungssatz 2's
 * actual stored value (5 + 12 = 17), not the official Goethe 5+10=15.
 *
 * Idempotent guard: refuses to run if these exam shells already have
 * exam_tasks rows (prevents duplicate inserts on accidental re-run).
 */
require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const HOEREN_ID    = 'c148c664-84e5-42a0-90b4-76b59cd1e64d';
const LESEN_ID     = 'bc6d7314-c1eb-4c25-8fc5-a8436b426807';
const SCHREIBEN_ID = 'd9e5906b-fbb0-4bc1-8109-ff731ad2a3b4';

function clip(scenario, transcript, questions) {
  return { scenario, transcript, questions };
}
function mc(question_text, options, correct_answer, explanation) {
  return { type: 'multiple_choice', question_text, options, correct_answer, explanation };
}
function tf(question_text, correct_answer, explanation) {
  return { type: 'true_false', question_text, options: ['Richtig', 'Falsch'], correct_answer, explanation };
}

(async () => {
  // Idempotency guard
  const existing = await sb.from('exam_tasks').select('id').in('exam_id', [HOEREN_ID, LESEN_ID, SCHREIBEN_ID]).limit(1);
  if (existing.error) { console.error('Guard check FAILED:', existing.error); process.exit(1); }
  if (existing.data && existing.data.length) {
    console.error('Refusing: exam_tasks already exist for one or more of these exam shells. Aborting to avoid duplicates.');
    process.exit(1);
  }

  // ══════════════════════════════════════════════════════════════════
  // HÖREN
  // ══════════════════════════════════════════════════════════════════
  const hoerenT1 = {
    exam_id: HOEREN_ID, task_number: 1, task_type: 'listening_multiple_choice',
    difficulty_tag: 'dialogue_comprehension', max_score: 6, order_index: 1,
    instructions:
      '🇩🇪 Sie hören sechs kurze Gespräche. Wählen Sie bei jeder Frage die richtige Antwort: a, b oder c. Sie hören jeden Text zweimal.\n' +
      '🇬🇧 You will hear six short dialogues. For each question, choose the correct answer: a, b or c. You will hear each text twice.',
    stimulus: {
      play_count: 2,
      clips: [
        clip(
          'A woman asks a man for directions to a pharmacy.',
          'Frau: Entschuldigung, wo ist hier eine Apotheke?\nMann: Eine Apotheke? Gehen Sie hier geradeaus, dann an der Ampel links. Die Apotheke ist auf der rechten Seite, neben der Bäckerei.\nFrau: Geradeaus und dann links an der Ampel. Vielen Dank!\nMann: Bitte schön.',
          [mc('Wie kommt die Frau zur Apotheke?',
            ['Geradeaus, dann rechts an der Ampel', 'Geradeaus, dann links an der Ampel', 'Links, dann geradeaus'],
            'Geradeaus, dann links an der Ampel',
            'Der Mann sagt: "Gehen Sie hier geradeaus, dann an der Ampel links."')]
        ),
        clip(
          'A man checks in for an appointment and is told which floor to go to.',
          'Mann: Guten Tag, ich habe einen Termin bei Frau Berger.\nEmpfang: Ah, Frau Berger ist im dritten Stock, Zimmer 305. Nehmen Sie den Aufzug dort hinten.\nMann: Dritter Stock, Zimmer 305. Ist das direkt beim Aufzug?\nEmpfang: Nein, gehen Sie nach dem Aufzug rechts, dann ist es die zweite Tür.\nMann: Alles klar, vielen Dank.',
          [mc('In welchem Stock ist Frau Berger?',
            ['Im zweiten Stock', 'Im dritten Stock', 'Im fünften Stock'],
            'Im dritten Stock',
            'Der Empfang sagt: "Frau Berger ist im dritten Stock, Zimmer 305."')]
        ),
        clip(
          'A man offers to accompany a woman to the post office.',
          'Frau: Ich muss zur Post. Weißt du, wo die ist?\nMann: Ja klar, ich gehe da sowieso vorbei. Ich zeige dir den Weg, komm mit.\nFrau: Oh, das ist nett! Ist es weit?\nMann: Nein, nur fünf Minuten zu Fuß.',
          [mc('Was macht der Mann?',
            ['Er erklärt nur den Weg zur Post', 'Er geht mit der Frau zur Post', 'Er sagt, die Post ist zu weit weg'],
            'Er geht mit der Frau zur Post',
            'Der Mann sagt: "Ich zeige dir den Weg, komm mit." — er geht selbst mit, er erklärt den Weg nicht nur.')]
        ),
        clip(
          'Two friends agree on a time to meet.',
          'Mann: Sollen wir uns morgen treffen?\nFrau: Ja gern. Passt dir 14 Uhr?\nMann: 14 Uhr ist gut für mich.\nFrau: Super, dann bis morgen um 14 Uhr!',
          [mc('Wann treffen sich die beiden?',
            ['Um 4 Uhr', 'Um 14 Uhr', 'Um 12 Uhr'],
            'Um 14 Uhr',
            'Die Frau fragt "Passt dir 14 Uhr?" und der Mann bestätigt: "14 Uhr ist gut für mich."')]
        ),
        clip(
          'A visitor checks in at reception before going upstairs to an appointment.',
          'Mann: Guten Tag, ich habe einen Termin im zweiten Stock.\nEmpfang: Guten Tag. Bevor Sie nach oben gehen, brauchen Sie einen Besucherausweis. Bitte zeigen Sie mir Ihren Personalausweis.\nMann: Ah, verstehe. Hier bitte.\nEmpfang: Danke. Hier ist Ihr Besucherausweis. Jetzt können Sie nach oben gehen.',
          [mc('Was braucht der Mann, bevor er nach oben gehen kann?',
            ['Seinen Terminzettel', 'Einen Besucherausweis', 'Eine Zimmernummer'],
            'Einen Besucherausweis',
            'Der Empfang sagt: "Bevor Sie nach oben gehen, brauchen Sie einen Besucherausweis."')]
        ),
        clip(
          'A receptionist asks a woman her name and where she is from.',
          'Empfang: Guten Tag, wie ist Ihr Name, bitte?\nFrau: Anna Berger.\nEmpfang: Und woher kommen Sie?\nFrau: Ich komme aus Hamburg.\nEmpfang: Aus Hamburg, gut. Und Sie wohnen jetzt hier in München?\nFrau: Ja, seit zwei Wochen.',
          [mc('Woher kommt die Frau?',
            ['Aus München', 'Aus Hamburg', 'Aus Berlin'],
            'Aus Hamburg',
            'Die Frau sagt: "Ich komme aus Hamburg."')]
        ),
      ],
    },
  };

  const hoerenT2 = {
    exam_id: HOEREN_ID, task_number: 2, task_type: 'listening_true_false',
    difficulty_tag: 'announcement_comprehension', max_score: 4, order_index: 2,
    instructions:
      '🇩🇪 Sie hören vier Durchsagen. Sind die Aussagen dazu richtig oder falsch? Sie hören jeden Text einmal.\n' +
      '🇬🇧 You will hear four announcements. Are the statements about them right or wrong? You will hear each text once.',
    stimulus: {
      play_count: 1,
      clips: [
        clip(
          'An announcement tells visitors the main entrance is closed for construction.',
          'Liebe Besucherinnen und Besucher, der Haupteingang ist heute wegen Bauarbeiten geschlossen. Bitte benutzen Sie den Seiteneingang neben der Bibliothek.',
          [tf('Die Besucher sollen heute durch den Seiteneingang gehen.', 'Richtig',
            'Die Ansage sagt: "Bitte benutzen Sie den Seiteneingang neben der Bibliothek."')]
        ),
        clip(
          'An announcement informs guests that reception has moved.',
          'Achtung, liebe Gäste: Die Rezeption ist umgezogen. Sie finden die neue Rezeption jetzt im Erdgeschoss, direkt neben dem Café.',
          [tf('Die Rezeption ist jetzt im ersten Stock.', 'Falsch',
            'Die Ansage sagt, die neue Rezeption ist "im Erdgeschoss", nicht im ersten Stock.')]
        ),
        clip(
          'An announcement redirects visitors to a different exit.',
          'Bitte beachten Sie: Der Ausgang zur Parkstraße ist zurzeit gesperrt. Bitte verlassen Sie das Gebäude durch den Ausgang zur Hauptstraße.',
          [tf('Die Besucher müssen den Ausgang zur Hauptstraße benutzen.', 'Richtig',
            'Die Ansage sagt: "Bitte verlassen Sie das Gebäude durch den Ausgang zur Hauptstraße."')]
        ),
        clip(
          'An announcement gives the meeting point for a city tour.',
          'Liebe Teilnehmerinnen und Teilnehmer der Stadtführung, wir treffen uns um 10 Uhr am Brunnen vor dem Rathaus.',
          [tf('Die Teilnehmer treffen sich hinter dem Rathaus.', 'Falsch',
            'Die Ansage sagt "vor dem Rathaus", nicht hinter dem Rathaus.')]
        ),
      ],
    },
  };

  const hoerenT3 = {
    exam_id: HOEREN_ID, task_number: 3, task_type: 'listening_multiple_choice',
    difficulty_tag: 'monologue_comprehension', max_score: 5, order_index: 3,
    instructions:
      '🇩🇪 Sie hören fünf Anrufe auf einem Anrufbeantworter. Wählen Sie bei jeder Frage die richtige Antwort: a, b oder c. Sie hören jeden Text zweimal.\n' +
      '🇬🇧 You will hear five voicemail messages. For each question, choose the correct answer: a, b or c. You will hear each text twice.',
    stimulus: {
      play_count: 2,
      clips: [
        clip(
          "A voicemail gives directions to a friend's house for a visit.",
          'Hallo, hier ist Sofia. Du kommst doch heute Abend, oder? Also, du gehst von der Bushaltestelle aus nach rechts, dann ist unser Haus das dritte auf der linken Seite. Der Eingang ist hinten, nicht vorne. Bis später!',
          [mc('Wo ist der Eingang?',
            ['Vorne', 'Hinten', 'Neben der Bushaltestelle'],
            'Hinten',
            'Sofia sagt: "Der Eingang ist hinten, nicht vorne."')]
        ),
        clip(
          'A voicemail tells a visitor where to wait upon arrival.',
          'Hi, hier ist Markus. Wenn du ankommst, ruf mich bitte an, dann komme ich runter. Warte am besten am Haupteingang, nicht am Seiteneingang, da ist es einfacher.',
          [mc('Was soll die Person tun, wenn sie ankommt?',
            ['Am Haupteingang warten und Markus anrufen', 'Zum Seiteneingang gehen', 'Direkt nach oben gehen'],
            'Am Haupteingang warten und Markus anrufen',
            'Markus sagt: "ruf mich bitte an, dann komme ich runter. Warte am besten am Haupteingang."')]
        ),
        clip(
          'A dental practice leaves a voicemail changing an appointment time.',
          'Guten Tag, hier ist die Praxis Dr. Wolf. Ihr Termin morgen ist leider nicht um 9 Uhr, sondern erst um 9:30 Uhr. Bitte kommen Sie 10 Minuten früher.',
          [mc('Wann ist der Termin jetzt?',
            ['Um 9:00 Uhr', 'Um 9:30 Uhr', 'Um 9:20 Uhr'],
            'Um 9:30 Uhr',
            'Die Praxis sagt: "Ihr Termin morgen ist leider nicht um 9 Uhr, sondern erst um 9:30 Uhr."')]
        ),
        clip(
          'A language school leaves a voicemail asking for missing information.',
          'Hallo, hier ist die Sprachschule. Ihr Geburtsdatum fehlt noch. Bitte rufen Sie uns zurück und sagen Sie uns Ihr Geburtsdatum.',
          [mc('Welche Information fehlt noch?',
            ['Die Telefonnummer', 'Das Geburtsdatum', 'Die Adresse'],
            'Das Geburtsdatum',
            'Die Ansage sagt: "Ihr Geburtsdatum fehlt noch."')]
        ),
        clip(
          'A voicemail gives bus directions to a party.',
          'Hallo, hier ist Lisa. Für die Party bei mir nimmst du am besten die Linie 12. Bitte nimm nicht die Linie 21. Die Linie 12 hält direkt vor meinem Haus.',
          [mc('Welche Linie soll man nehmen?',
            ['Linie 21', 'Linie 12', 'Linie 2'],
            'Linie 12',
            'Lisa sagt: "nimmst du am besten die Linie 12. Bitte nimm nicht die Linie 21."')]
        ),
      ],
    },
  };

  const hoerenIns = await sb.from('exam_tasks').insert([hoerenT1, hoerenT2, hoerenT3]);
  if (hoerenIns.error) { console.error('Hören insert FAILED:', hoerenIns.error); process.exit(1); }
  console.log('Hören: 3 tasks inserted (6 + 4 + 5 = 15 items).');

  // ══════════════════════════════════════════════════════════════════
  // LESEN
  // ══════════════════════════════════════════════════════════════════
  const lesenT1 = {
    exam_id: LESEN_ID, task_number: 1, task_type: 'true_false',
    max_score: 5, order_index: 1,
    instructions:
      '🇩🇪 Lies die zwei Texte. Sind die Aussagen richtig oder falsch?\n' +
      '🇬🇧 Read the two texts. Are the statements right or wrong?',
    stimulus: {
      texts: [
        {
          label: 'Einladung',
          text: 'Einladung zum Sommerfest\nDas Sommerfest ist am Samstag im Stadtpark. Fahr mit der Linie 5 bis zur Haltestelle "Stadtpark". Geh von der Haltestelle geradeaus und dann am Brunnen links. Der Eingang zum Fest ist neben dem Spielplatz.',
        },
        {
          label: 'Willkommensbrief',
          text: 'Willkommen im Sprachzentrum!\nGuten Tag, Frau Kovac. Willkommen im Sprachzentrum München. Sie kommen aus Kroatien und besuchen ab Montag den Deutschkurs A1. Bitte kommen Sie 15 Minuten früher und melden Sie sich am Empfang im Erdgeschoss. Bringen Sie bitte Ihren Ausweis mit.',
        },
      ],
      statements: [
        { s: 'Man kommt mit der Linie 5 zum Stadtpark.', answer: true, text_index: 0,
          explanation: 'Der Text sagt: "Fahr mit der Linie 5 bis zur Haltestelle \'Stadtpark\'."' },
        { s: 'Von der Haltestelle geht man zuerst nach rechts.', answer: false, text_index: 0,
          explanation: 'Der Text sagt: "Geh von der Haltestelle geradeaus und dann am Brunnen links" — zuerst geradeaus, nicht rechts.' },
        { s: 'Der Eingang ist neben dem Spielplatz.', answer: true, text_index: 0,
          explanation: 'Der Text sagt: "Der Eingang zum Fest ist neben dem Spielplatz."' },
        { s: 'Frau Kovac soll sich im Erdgeschoss melden.', answer: true, text_index: 1,
          explanation: 'Der Text sagt: "melden Sie sich am Empfang im Erdgeschoss."' },
        { s: 'Frau Kovac kommt aus Deutschland.', answer: false, text_index: 1,
          explanation: 'Der Text sagt: "Sie kommen aus Kroatien."' },
      ],
    },
  };

  const lesenT2 = {
    exam_id: LESEN_ID, task_number: 2, task_type: 'multiple_choice',
    max_score: 5, order_index: 2,
    instructions:
      '🇩🇪 Sie brauchen bestimmte Informationen. Wo finden Sie diese Information: a oder b?\n' +
      '🇬🇧 You need specific information. Where do you find it: a or b?',
    stimulus: {
      text: '',
      questions: [
        {
          q: 'Sie sind neu in der Stadt und möchten wissen, wie Sie am besten zum Museum kommen.',
          answer: 'a',
          options: { a: 'Stadtplan München (Karte der Stadt und Routenplaner)', b: 'Museum München (Ausstellungen und Veranstaltungen)' },
          explanation: 'Der Stadtplan (a) mit Routenplaner zeigt den Weg. Die Museumsseite (b) informiert nur über Ausstellungen, nicht über den Weg dorthin.',
        },
        {
          q: 'Die Rezeption Ihres Sprachzentrums ist umgezogen. Sie möchten wissen, wo die neue Rezeption jetzt ist.',
          answer: 'b',
          options: { a: 'Sprachzentrum München — Kurse (Kursangebote und Anmeldung)', b: 'Sprachzentrum München — Aktuelles (Raumnummern und Öffnungszeiten)' },
          explanation: '"Aktuelles" (b) nennt Raumnummern. "Kurse" (a) ist nur für Kursangebote und Anmeldung, nicht für die Rezeptionsadresse.',
        },
        {
          q: 'Sie möchten einen Termin beim Arzt absagen und brauchen die Telefonnummer der Praxis.',
          answer: 'a',
          options: { a: 'Praxis Wolf — Kontakt (Telefonnummer und Adresse der Praxis)', b: 'Praxis Wolf — Team (Informationen über die Ärzte und Ärztinnen)' },
          explanation: '"Kontakt" (a) nennt die Telefonnummer. "Team" (b) informiert nur über die Ärzte selbst, nicht über Kontaktdaten.',
        },
        {
          q: 'Sie möchten wissen, wann der nächste Deutschkurs für Anfänger beginnt.',
          answer: 'b',
          options: { a: 'Sprachschule Berlin — Preise (Preise für alle Kurse)', b: 'Sprachschule Berlin — Kurstermine (Alle Starttermine der Kurse)' },
          explanation: '"Kurstermine" (b) nennt die Starttermine. "Preise" (a) informiert nur über Kosten, nicht über Termine.',
        },
        {
          q: 'Sie möchten wissen, ob die Bibliothek am Samstag geöffnet hat.',
          answer: 'a',
          options: { a: 'Stadtbibliothek München — Öffnungszeiten (Öffnungszeiten aller Standorte)', b: 'Stadtbibliothek München — Katalog (Online-Katalog der Bücher)' },
          explanation: '"Öffnungszeiten" (a) nennt die Tage. Der "Katalog" (b) listet nur Bücher, keine Öffnungstage.',
        },
      ],
    },
  };

  const lesenT3 = {
    exam_id: LESEN_ID, task_number: 3, task_type: 'true_false',
    max_score: 5, order_index: 3,
    instructions:
      '🇩🇪 Lies die Schilder. Sind die Aussagen richtig oder falsch?\n' +
      '🇬🇧 Read the signs. Are the statements right or wrong?',
    stimulus: {
      texts: [
        { label: 'Schild', text: 'Zum Bahnhof →\n300 Meter' },
        { label: 'Schild', text: 'Besuchereingang\nBitte hier klingeln.' },
        { label: 'Schild', text: 'Empfang\n1. Stock, Zimmer 12' },
        { label: 'Schild', text: 'Zutritt nur für Personal' },
        { label: 'Schild', text: 'Parkplatz nur für Kunden' },
      ],
      statements: [
        { s: 'Der Bahnhof ist in dieser Richtung.', answer: true, text_index: 0,
          explanation: 'Das Schild zeigt "Zum Bahnhof →" mit "300 Meter" — der Bahnhof ist in dieser Richtung.' },
        { s: 'Besucher sollen hier klingeln.', answer: true, text_index: 1,
          explanation: 'Das Schild sagt: "Besuchereingang / Bitte hier klingeln."' },
        { s: 'Der Empfang ist im Erdgeschoss.', answer: false, text_index: 2,
          explanation: 'Das Schild sagt "1. Stock, Zimmer 12" — der Empfang ist im ersten Stock, nicht im Erdgeschoss.' },
        { s: 'Besucher dürfen hier hineingehen.', answer: false, text_index: 3,
          explanation: 'Das Schild sagt: "Zutritt nur für Personal" — Besucher dürfen nicht hinein.' },
        { s: 'Jeder darf hier parken.', answer: false, text_index: 4,
          explanation: 'Das Schild sagt: "Parkplatz nur für Kunden" — nicht jeder darf hier parken.' },
      ],
    },
  };

  const lesenIns = await sb.from('exam_tasks').insert([lesenT1, lesenT2, lesenT3]);
  if (lesenIns.error) { console.error('Lesen insert FAILED:', lesenIns.error); process.exit(1); }
  console.log('Lesen: 3 tasks inserted (5 + 5 + 5 = 15 items).');

  // ══════════════════════════════════════════════════════════════════
  // SCHREIBEN
  // ══════════════════════════════════════════════════════════════════
  const schreibenT1 = {
    exam_id: SCHREIBEN_ID, task_number: 1, task_type: 'form_fill',
    max_score: 5, order_index: 1,
    instructions:
      '🇩🇪 Ihr Freund Marco Rossi möchte einen internationalen Kochkurs besuchen. Lesen Sie die Informationen und füllen Sie das Formular für Marco aus.\n' +
      '🇬🇧 Your friend Marco Rossi wants to join an international cooking course. Read the information and fill in the form for Marco.',
    stimulus: {
      text: 'Ihr Freund Marco Rossi möchte einen internationalen Kochkurs besuchen. Der Kurs ist jetzt an einem neuen Ort: im Bürgerzentrum Nord. Marco ist 34 Jahre alt und kommt aus Italien. Er möchte den Kurs am Dienstag und Donnerstag besuchen. Er bezahlt bar.',
      fields: ['Alter:', 'Land:', 'Kurstage:', 'Kursort:', 'Zahlungsweise:'],
      answers: ['34', 'Italien', 'Dienstag und Donnerstag', 'Bürgerzentrum Nord', 'bar'],
    },
  };

  const schreibenT2 = {
    exam_id: SCHREIBEN_ID, task_number: 2, task_type: 'short_message',
    max_score: 12, order_index: 2,
    instructions:
      '🇩🇪 Lies die Situation. Schreibe eine Nachricht an eine Freundin oder einen Freund. Nutze die drei Punkte. Schreibe ungefähr 30 Wörter.\n' +
      '🇬🇧 Read the situation. Write a message to a friend. Use the three points. Write approximately 30 words.',
    stimulus: {
      message: 'Sie wohnen seit kurzem in einer neuen Wohnung. Schreiben Sie eine Nachricht an eine Freundin oder einen Freund.',
      register: 'informal',
      word_min: 20,
      recipient: 'a friend',
      situation: 'You recently moved into a new apartment and are writing to a friend.',
      word_target: 30,
      bullet_points: [
        'Wann soll Ihre Freundin oder Ihr Freund Sie besuchen?',
        'Wie kommt sie oder er zu Ihrer neuen Wohnung?',
        'Fragen Sie, ob sie oder er kommen kann.',
      ],
      example_answer: 'Hallo Tim,\nkannst du mich am Sonntag um 15 Uhr besuchen? Fahr mit dem Bus 4 bis zur Post. Meine Wohnung ist gegenüber der Bank. Kannst du kommen?\nLiebe Grüße\nAnna',
      evaluation_criteria: [
        'All 3 content points present (when to visit, how to get there, asks if they can come)',
        'Consistent informal register (du-form) throughout',
        'Greeting and closing present',
        'Comprehensible German at A1 level',
        'Length roughly 20-40 words',
      ],
      communication_purpose: 'Invite a friend to visit the new apartment, give directions, and ask if they can come.',
    },
  };

  const schreibenIns = await sb.from('exam_tasks').insert([schreibenT1, schreibenT2]);
  if (schreibenIns.error) { console.error('Schreiben insert FAILED:', schreibenIns.error); process.exit(1); }
  console.log('Schreiben: 2 tasks inserted (form_fill max 5, short_message max 12 — real runtime total 17).');

  console.log('\nDone. Set stays is_published=false / is_certified_mock_exam=false.');
  console.log('Next: node scripts/validate-mock-exams.js --set 364c5eb6-4269-436b-90ac-0a48d48a5472');
})();
