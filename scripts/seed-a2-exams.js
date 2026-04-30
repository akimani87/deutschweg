/**
 * One-shot: seed A2 Lesen Übungssatz 1 (4 tasks) + A2 Schreiben
 * Übungssatz 1 (2 tasks). Idempotent? No — runs unconditional INSERTs.
 *
 * Verification at the end shows every A1+A2 exam_task in the DB.
 */
require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

(async () => {
  // ════════════════════════════════════════════════════════════════
  // A2 Lesen — Prüfungsvorbereitung
  // ════════════════════════════════════════════════════════════════
  const lesen = await sb.from('exams').insert({
    level: 'A2', title: 'A2 Lesen — Prüfungsvorbereitung',
    section: 'lesen', is_published: true
  }).select('id, level, title, section').single();
  if (lesen.error) throw lesen.error;
  const LESEN_ID = lesen.data.id;
  console.log('A2 Lesen exam:', lesen.data);

  // ── Lesen Task 1 — article about David Kimani / Nairobi Kitchen ──
  const lT1 = await sb.from('exam_tasks').insert({
    exam_id: LESEN_ID, task_number: 1, task_type: 'multiple_choice',
    difficulty_tag: 'a2_basic', order_index: 1, max_score: 5,
    instructions:
      '🇩🇪 Lies den Text. Wähle die richtige Antwort: a, b oder c.\n' +
      '🇬🇧 Read the text. Choose the correct answer: a, b or c.',
    stimulus: {
      text:
        'Der kenianische Koch David Kimani lebt seit fünf Jahren in Berlin. Dort führt er ein kleines afrikanisches Restaurant mit dem Namen "Nairobi Kitchen". David hat immer neue Ideen für seine Speisekarte. Gäste müssen einen Tisch per E-Mail reservieren, sonst bekommen sie keinen Platz. Ein zweites Restaurant möchte er nicht öffnen, weil die Arbeit dann zu viel wird. Seine Ausbildung als Koch hat David in Nairobi gemacht. Danach ist er zwei Jahre durch Europa gereist. In Berlin ist er bekannt geworden durch eine Kochvideo-Serie auf YouTube.',
      questions: [
        { q: 'Wer ist David Kimani?',
          options: { a: 'ein Kellner aus Berlin', b: 'ein Koch aus Kenia', c: 'ein Schauspieler aus Deutschland' },
          answer: 'b' },
        { q: 'Wo arbeitet David?',
          options: { a: 'in einem Hotel', b: 'in einem afrikanischen Restaurant', c: 'auf einem Schiff' },
          answer: 'b' },
        { q: 'Wie können Gäste einen Tisch reservieren?',
          options: { a: 'per Telefon', b: 'per E-Mail', c: 'sie müssen nicht reservieren' },
          answer: 'b' },
        { q: 'Was möchte David in Zukunft NICHT tun?',
          options: { a: 'ein zweites Restaurant öffnen', b: 'neue Gerichte kochen', c: 'in Berlin bleiben' },
          answer: 'a' },
        { q: 'Wie ist David in Berlin bekannt geworden?',
          options: { a: 'durch eine Zeitungsannonce', b: 'durch eine YouTube-Serie', c: 'durch das Fernsehen' },
          answer: 'b' }
      ]
    }
  }).select('task_number, task_type, max_score').single();
  if (lT1.error) throw lT1.error;
  console.log('  Lesen T1:', lT1.data);

  // ── Lesen Task 2 — Kaufhaus Zentral information board ──
  const lT2 = await sb.from('exam_tasks').insert({
    exam_id: LESEN_ID, task_number: 2, task_type: 'multiple_choice',
    difficulty_tag: 'a2_basic', order_index: 2, max_score: 5,
    instructions:
      '🇩🇪 Schau auf den Plan. Wähle die richtige Antwort: a, b oder c.\n' +
      '🇬🇧 Look at the information board. Choose the correct answer: a, b or c.',
    stimulus: {
      text:
        'Kaufhaus Zentral\n\n' +
        '4. Stock: Bücher, Spielzeug, Café, Reisebüro\n' +
        '3. Stock: Elektronik, Computer, Handys, Sportkleidung\n' +
        '2. Stock: Herrenmode, Möbel, Teppiche, Lampen\n' +
        '1. Stock: Damenmode, Schuhe, Kinderbekleidung, Geschirr\n' +
        'EG: Information, Schmuck, Parfüm, Schreibwaren, Blumenladen\n' +
        'UG: Supermarkt, Bäcker, Fotoservice, Geldautomat',
      questions: [
        { q: 'Du suchst eine neue Hose für deinen Mann. In welchem Stock?',
          options: { a: '1. Stock', b: '2. Stock', c: '3. Stock' },
          answer: 'b' },
        { q: 'Du brauchst Brot. Wo gehst du hin?',
          options: { a: 'Erdgeschoss', b: '4. Stock', c: 'Untergeschoss' },
          answer: 'c' },
        { q: 'Du möchtest Geld abheben. Wohin?',
          options: { a: '1. Stock', b: 'Untergeschoss', c: '3. Stock' },
          answer: 'b' },
        { q: 'Wo bekommt man Bücher und Spielzeug?',
          options: { a: '4. Stock', b: '3. Stock', c: '1. Stock' },
          answer: 'a' },
        { q: 'Du möchtest einen Computer kaufen. Wohin?',
          options: { a: '1. Stock', b: '3. Stock', c: '4. Stock' },
          answer: 'b' }
      ]
    }
  }).select('task_number, task_type, max_score').single();
  if (lT2.error) throw lT2.error;
  console.log('  Lesen T2:', lT2.data);

  // ── Lesen Task 3 — email from Amara to Kofi ──
  const lT3 = await sb.from('exam_tasks').insert({
    exam_id: LESEN_ID, task_number: 3, task_type: 'multiple_choice',
    difficulty_tag: 'a2_basic', order_index: 3, max_score: 5,
    instructions:
      '🇩🇪 Lies die E-Mail. Wähle die richtige Antwort: a, b oder c.\n' +
      '🇬🇧 Read the email. Choose the correct answer: a, b or c.',
    stimulus: {
      text:
        'Lieber Kofi!\n\n' +
        'Ich studiere jetzt seit drei Monaten in Hamburg. Es gefällt mir hier sehr. Ich wohne in einem Studentenwohnheim mit Studenten aus Nigeria, Kenia und Brasilien. Jeden Samstag kocht eine Person Essen aus seinem Land — das ist immer sehr lecker.\n\n' +
        'Mein Wirtschaftskurs ist schwer, aber meine Professorin ist nett. Ich freue mich, dass du im April kommst! Du kannst im Zimmer von Emeka schlafen — er ist mein Mitbewohner aus Nigeria und fährt zu Ostern nach Hause.\n\n' +
        'Schreib mir bald! Liebe Grüße, Amara',
      questions: [
        { q: 'Seit wann studiert Amara in Hamburg?',
          options: { a: 'seit einem Monat', b: 'seit drei Monaten', c: 'seit einem Jahr' },
          answer: 'b' },
        { q: 'Mit wem wohnt Amara?',
          options: { a: 'mit ihrer Familie', b: 'mit Studenten aus verschiedenen Ländern', c: 'allein' },
          answer: 'b' },
        { q: 'Was passiert jeden Samstag?',
          options: { a: 'sie gehen ins Restaurant', b: 'eine Person kocht Essen aus ihrem Land', c: 'sie haben Unterricht' },
          answer: 'b' },
        { q: 'Wie findet Amara ihr Wirtschaftsstudium?',
          options: { a: 'leicht', b: 'langweilig', c: 'schwer' },
          answer: 'c' },
        { q: 'Wo schläft Kofi, wenn er Amara besucht?',
          options: { a: 'in einem Hotel', b: 'in Emekas Zimmer', c: 'in Amaras Zimmer' },
          answer: 'b' }
      ]
    }
  }).select('task_number, task_type, max_score').single();
  if (lT3.error) throw lT3.error;
  console.log('  Lesen T3:', lT3.data);

  // ── Lesen Task 4 — matching_adverts (5 people, 6 adverts) ──
  const lT4 = await sb.from('exam_tasks').insert({
    exam_id: LESEN_ID, task_number: 4, task_type: 'matching_adverts',
    difficulty_tag: 'a2_basic', order_index: 4, max_score: 5,
    instructions:
      '🇩🇪 Welche Anzeige passt zu welcher Person? Eine Anzeige passt zu keiner Person. Markiere X für keine passende Anzeige.\n' +
      '🇬🇧 Which advert matches which person? One advert matches no one. Mark X for no matching advert.',
    stimulus: {
      people: [
        { name: 'Yemi',   text: 'möchte am Wochenende mit ihrer Familie draußen frühstücken gehen.' },
        { name: 'Kwame',  text: 'sucht einen Ort für seine Geburtstagsfeier mit 30 Freunden.' },
        { name: 'Fatima', text: 'möchte guten Wein kaufen und nach Hause liefern lassen.' },
        { name: 'Kofi',   text: 'lädt Geschäftspartner zum Mittagessen ein, möchte ruhige Atmosphäre.' },
        { name: 'Amara',  text: 'möchte Kuchen und Eis mit ihrer kleinen Tochter essen.' }
      ],
      adverts: [
        { letter: 'a', title: 'Café Sonnenschein',     text: 'Selbstgemachte Kuchen und Eis. Großer Garten mit Spielplatz. Di–So 13–19 Uhr.' },
        { letter: 'b', title: 'Restaurant Akropolis',   text: 'Internationale Küche. Ruhige Atmosphäre. Businesslunch täglich 12–15 Uhr. Tischreservierung empfohlen.' },
        { letter: 'c', title: 'Weinhaus Müller',        text: 'Beste Weine aus aller Welt. Lieferservice im Stadtgebiet. Mo–Sa 10–20 Uhr.' },
        { letter: 'd', title: 'Eventlocation Metropol', text: 'Feiern mit bis zu 200 Personen. Geburtstage, Hochzeiten, Firmenfeiern. Catering inklusive.' },
        { letter: 'e', title: 'Café am See',            text: 'Frühstück täglich ab 9 Uhr. Große Terrasse direkt am Wasser. Auch am Wochenende.' },
        { letter: 'f', title: 'Pizzeria Bella Roma',    text: 'Günstige Pizza und Pasta. Täglich geöffnet. Schnelle Lieferung nach Hause.' }
      ],
      answers: { Yemi: 'e', Kwame: 'd', Fatima: 'c', Kofi: 'b', Amara: 'a' }
    }
  }).select('task_number, task_type, max_score').single();
  if (lT4.error) throw lT4.error;
  console.log('  Lesen T4:', lT4.data);

  // ════════════════════════════════════════════════════════════════
  // A2 Schreiben — Prüfungsvorbereitung
  // ════════════════════════════════════════════════════════════════
  const schr = await sb.from('exams').insert({
    level: 'A2', title: 'A2 Schreiben — Prüfungsvorbereitung',
    section: 'schreiben', is_published: true
  }).select('id, level, title, section').single();
  if (schr.error) throw schr.error;
  const SCHREIBEN_ID = schr.data.id;
  console.log('A2 Schreiben exam:', schr.data);

  // ── Schreiben Task 1 — SMS to Jonas (target 20-30 words) ──
  const sT1 = await sb.from('exam_tasks').insert({
    exam_id: SCHREIBEN_ID, task_number: 1, task_type: 'short_message',
    difficulty_tag: 'a2_writing', order_index: 1, max_score: 10,
    instructions:
      '🇩🇪 Du bist in der Stadt und schreibst eine SMS an deinen Freund Jonas. Schreibe 20–30 Wörter. Schreibe zu allen drei Punkten.\n' +
      '🇬🇧 You are in town and write an SMS to your friend Jonas. Write 20–30 words. Cover all three points.',
    stimulus: {
      message: 'Entschuldige dich, dass du zu spät kommst. Schreibe, warum. Nenne einen neuen Treffpunkt und eine neue Uhrzeit.',
      bullet_points: [
        'Entschuldigung für die Verspätung',
        'Grund für die Verspätung',
        'Neuer Treffpunkt und neue Uhrzeit'
      ],
      word_target: 30,
      word_min: 10
    }
  }).select('task_number, task_type, max_score').single();
  if (sT1.error) throw sT1.error;
  console.log('  Schreiben T1:', sT1.data);

  // ── Schreiben Task 2 — semi-formal email to boss (target 30-40 words) ──
  const sT2 = await sb.from('exam_tasks').insert({
    exam_id: SCHREIBEN_ID, task_number: 2, task_type: 'short_message',
    difficulty_tag: 'a2_writing', order_index: 2, max_score: 10,
    instructions:
      '🇩🇪 Dein Chef Herr Mensah hat bald Geburtstag und hat dich eingeladen. Schreibe ihm eine E-Mail. Schreibe 30–40 Wörter. Schreibe zu allen drei Punkten.\n' +
      '🇬🇧 Your boss Mr Mensah has a birthday soon and has invited you. Write him an email. Write 30–40 words. Cover all three points.',
    stimulus: {
      message: 'Herr Mensah hat dir eine Einladung zu seiner Geburtstagsfeier geschickt.',
      bullet_points: [
        'Bedanke dich und sage, dass du kommst',
        'Informiere, dass du jemanden mitbringst',
        'Frage nach dem Weg'
      ],
      word_target: 40,
      word_min: 15
    }
  }).select('task_number, task_type, max_score').single();
  if (sT2.error) throw sT2.error;
  console.log('  Schreiben T2:', sT2.data);

  // ════════════════════════════════════════════════════════════════
  // Verification — show every A1+A2 task
  // ════════════════════════════════════════════════════════════════
  const verify = await sb.from('exams')
    .select('level, title, section, exam_tasks(task_number, task_type, max_score, order_index)')
    .in('level', ['A1', 'A2'])
    .order('level').order('section').order('title');
  if (verify.error) throw verify.error;

  console.log('\nVerification — A1 + A2 exams + tasks:');
  const W = '─'.repeat(96);
  console.log(W);
  console.log('LEVEL '.padEnd(7) + 'TITLE'.padEnd(40) + 'SECTION'.padEnd(12) + 'T#  TYPE'.padEnd(20) + 'MAX  ORDER');
  console.log(W);
  verify.data.forEach(exam => {
    const tasks = (exam.exam_tasks || []).slice().sort((a,b) => a.order_index - b.order_index);
    if (!tasks.length) {
      console.log(exam.level.padEnd(7) + exam.title.padEnd(40) + exam.section.padEnd(12) + '(no tasks)');
    }
    tasks.forEach(t => {
      console.log(
        exam.level.padEnd(7) +
        exam.title.padEnd(40) +
        exam.section.padEnd(12) +
        String(t.task_number).padEnd(4) +
        t.task_type.padEnd(20) +
        String(t.max_score).padEnd(5) +
        String(t.order_index)
      );
    });
  });
  console.log(W);
  console.log('\nIDs:');
  console.log('  A2 Lesen     = ' + LESEN_ID);
  console.log('  A2 Schreiben = ' + SCHREIBEN_ID);
})();
