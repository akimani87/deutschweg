/**
 * One-shot: seed A1 Hören Übungssatz 1 — the first real 3-Teil, audio-paced
 * Hören section (hoeren-a1-restructure-plan.md, Steps 2-4).
 *
 * Content is copied from hoerverstehen_exercises rows already generated and
 * curated for this restructure (see the Step 1 content-review conversation)
 * into exam_tasks, one row per Teil. Teil 1 and 3 combine 2 clips each
 * (2 x 3 questions = 6, matching Teil 1's official item count exactly;
 * Teil 3 lands at 6 vs. the official 5 — a deliberate simplification using
 * clean multiples of the existing 3-question-per-clip generation format
 * rather than splitting a clip's questions, flagged in the Step 4 report).
 *
 * Not idempotent — runs unconditional INSERTs. Run once.
 */
require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

// Copied verbatim from hoerverstehen_exercises (ids in the comment above
// each clip) — not queried live so this script has no runtime dependency
// on those rows still existing.
const TEIL2_ANNOUNCEMENT = { // id 270496bb-dbca-467a-9922-af0d9829f3bd
  audio_url: 'https://udmunxzzuqoynlftapwh.supabase.co/storage/v1/object/public/hoerverstehen-audio/announcement/1781611017367-p4hihc.mp3',
  scenario: 'Supermarket announcement in Germany',
  questions: [
    { type: 'true_false', options: ['Richtig', 'Falsch'], question_text: 'Die Äpfel kosten heute zwei Euro pro Kilo.', correct_answer: 'Falsch', explanation: "Die Äpfel kosten nur einen Euro pro Kilo, nicht zwei Euro." },
    { type: 'true_false', options: ['Richtig', 'Falsch'], question_text: 'Die Äpfel sind in Gang drei.', correct_answer: 'Richtig', explanation: "Der Ansager sagt: 'Sie finden die Äpfel in Gang drei.'" },
    { type: 'true_false', options: ['Richtig', 'Falsch'], question_text: 'Der Supermarkt schließt heute um 18 Uhr.', correct_answer: 'Falsch', explanation: 'Der Supermarkt schließt um 20 Uhr. Die Bäckerei schließt um 18 Uhr.' },
    { type: 'true_false', options: ['Richtig', 'Falsch'], question_text: 'Kasse drei ist heute geschlossen.', correct_answer: 'Richtig', explanation: "Der Ansager sagt: 'Kasse drei ist heute geschlossen.'" },
  ],
};

const TEIL1_CLIP_A = { // id c558571e-7ee8-4f51-804a-e295582c2a56 — lost umbrella
  audio_url: 'https://udmunxzzuqoynlftapwh.supabase.co/storage/v1/object/public/hoerverstehen-audio/conversation/1783702142447-9mikzc.mp3',
  scenario: 'Two women are talking about a lost item — one has lost her umbrella and is asking her neighbour for help.',
  questions: [
    { type: 'multiple_choice', options: ['Ihren Schlüssel', 'Ihren Regenschirm', 'Ihre Tasche'], question_text: 'Was hat die Frau verloren?', correct_answer: 'Ihren Regenschirm', explanation: "Speaker 1 says 'Ich suche meinen Regenschirm' — she is looking for her umbrella." },
    { type: 'multiple_choice', options: ['Im Supermarkt', 'Im Bus', 'Im Park'], question_text: 'Wo glaubt die Frau, dass sie den Gegenstand verloren hat?', correct_answer: 'Im Bus', explanation: "Speaker 1 says 'Ich glaube, im Bus. Ich war heute Morgen im Bus Nummer 7.'" },
    { type: 'multiple_choice', options: ['Er ist rot mit einem braunen Griff.', 'Er ist grün und klein.', 'Er ist blau mit einem schwarzen Griff.'], question_text: 'Wie sieht der Regenschirm aus?', correct_answer: 'Er ist blau mit einem schwarzen Griff.', explanation: "Speaker 1 describes her umbrella as 'blau' with a 'schwarzen Griff' — blue with a black handle." },
  ],
};

const TEIL1_CLIP_B = { // id 7d655a2e-d62d-40f1-b2a3-f7767132c049 — park walk
  audio_url: 'https://udmunxzzuqoynlftapwh.supabase.co/storage/v1/object/public/hoerverstehen-audio/conversation/1783702158392-0fq8zh.mp3',
  scenario: 'Two women are talking about their plans to meet for a walk in the park this weekend.',
  questions: [
    { type: 'multiple_choice', options: ['Um zehn Uhr', 'Um elf Uhr', 'Um zwölf Uhr'], question_text: 'Wann treffen sich die zwei Frauen?', correct_answer: 'Um elf Uhr', explanation: "Speaker 1 says 'Um elf Uhr. Am Eingang.' — they meet at eleven o'clock." },
    { type: 'multiple_choice', options: ['Am Bahnhof', 'Im Café', 'Am Eingang vom Stadtpark'], question_text: 'Wo treffen sich die zwei Frauen?', correct_answer: 'Am Eingang vom Stadtpark', explanation: "Speaker 1 says they will meet 'Am Eingang' of 'Der Stadtpark'." },
    { type: 'multiple_choice', options: ['Wasser', 'Essen', 'Eine Jacke'], question_text: 'Was bringt Mia mit?', correct_answer: 'Wasser', explanation: "Speaker 1 suggests bringing water because it will be warm, and Mia agrees: 'ich bringe Wasser mit'." },
  ],
};

const TEIL3_CLIP_A = { // id 746bfaab-91ca-4e39-b13d-148ccda75df2 — parcel/neighbour
  audio_url: 'https://udmunxzzuqoynlftapwh.supabase.co/storage/v1/object/public/hoerverstehen-audio/voicemail/1783702226848-lqm8g2.mp3',
  scenario: 'A man leaves a voicemail for his neighbor asking him to pick up a parcel from the post office.',
  questions: [
    { type: 'multiple_choice', options: ['Im Supermarkt in der Hauptstraße', 'Im Postamt in der Schillerstraße', 'Im Bahnhof in der Goethestraße'], question_text: 'Wo liegt das Paket?', correct_answer: 'Im Postamt in der Schillerstraße', explanation: "Klaus says 'Ein Paket für mich liegt im Postamt in der Schillerstraße.'" },
    { type: 'multiple_choice', options: ['Um achtzehn Uhr', 'Um zwanzig Uhr', 'Um neunzehn Uhr'], question_text: 'Wann schließt das Postamt?', correct_answer: 'Um neunzehn Uhr', explanation: "Klaus says 'Das Postamt schließt um neunzehn Uhr.'" },
    { type: 'multiple_choice', options: ['032, 456, 789', '032, 445, 678', '023, 456, 987'], question_text: 'Was ist die Telefonnummer von Klaus?', correct_answer: '032, 456, 789', explanation: "Klaus gives his number as 'null-drei-zwei, vier-fünf-sechs, sieben-acht-neun', which is 032, 456, 789." },
  ],
};

const TEIL3_CLIP_B = { // id 3c96cd11-2377-401f-88ee-ea50aa9d45f4 — library book
  audio_url: 'https://udmunxzzuqoynlftapwh.supabase.co/storage/v1/object/public/hoerverstehen-audio/voicemail/1783702355642-0zvlwe.mp3',
  scenario: 'A man leaves a voicemail for his friend, reminding her to return a library book and giving details about the deadline and location.',
  questions: [
    { type: 'multiple_choice', options: ['Der blaue Hund', 'Die rote Katze', 'Das grüne Haus'], question_text: 'Wie heißt das Buch?', correct_answer: 'Der blaue Hund', explanation: "Jonas says the book is called 'Der blaue Hund'." },
    { type: 'multiple_choice', options: ['Um sechzehn Uhr', 'Um siebzehn Uhr', 'Um achtzehn Uhr'], question_text: 'Wann schließt die Bibliothek am Freitag?', correct_answer: 'Um siebzehn Uhr', explanation: 'Jonas says the library closes on Friday at seventeen o\'clock (17:00).' },
    { type: 'multiple_choice', options: ['In der Schillerstraße', 'In der Bahnhofstraße', 'In der Gartenstraße'], question_text: 'Wo ist die Bibliothek?', correct_answer: 'In der Gartenstraße', explanation: "Jonas says the library is on Gartenstraße, number twelve." },
  ],
};

(async () => {
  // ── STEP 1: exams row ────────────────────────────────────────────────
  const examIns = await sb.from('exams').insert({
    level: 'A1', title: 'A1 Hören — Übungssatz 1', section: 'hoeren', is_published: true,
  }).select('id, level, title, section, is_published').single();
  if (examIns.error) { console.error('Hören exam insert FAILED:', examIns.error); process.exit(1); }
  const EXAM_ID = examIns.data.id;
  console.log('STEP 1 ✓ Hören exam inserted:', examIns.data);

  // ── STEP 2: Teil 1 — listening_multiple_choice, 2 clips x 3 = 6 items, played twice ──
  const t1 = await sb.from('exam_tasks').insert({
    exam_id: EXAM_ID, task_number: 1, task_type: 'listening_multiple_choice',
    difficulty_tag: 'dialogue_comprehension', max_score: 6, order_index: 1,
    instructions:
      '🇩🇪 Sie hören zwei kurze Gespräche. Wählen Sie bei jeder Frage die richtige Antwort: a, b oder c. Sie hören jeden Text zweimal.\n' +
      '🇬🇧 You will hear two short dialogues. For each question, choose the correct answer: a, b or c. You will hear each text twice.',
    stimulus: { play_count: 2, clips: [TEIL1_CLIP_A, TEIL1_CLIP_B] },
  }).select('id, task_number, task_type, max_score').single();
  if (t1.error) { console.error('Teil 1 insert FAILED:', t1.error); process.exit(1); }
  console.log('STEP 2 ✓ Teil 1 inserted:', t1.data);

  // ── STEP 3: Teil 2 — listening_true_false, 1 clip x 4 items, played once ──
  const t2 = await sb.from('exam_tasks').insert({
    exam_id: EXAM_ID, task_number: 2, task_type: 'listening_true_false',
    difficulty_tag: 'announcement_comprehension', max_score: 4, order_index: 2,
    instructions:
      '🇩🇪 Sie hören eine Durchsage. Sind die Aussagen dazu richtig oder falsch? Sie hören den Text einmal.\n' +
      '🇬🇧 You will hear an announcement. Are the statements about it right or wrong? You will hear the text once.',
    stimulus: { play_count: 1, clips: [TEIL2_ANNOUNCEMENT] },
  }).select('id, task_number, task_type, max_score').single();
  if (t2.error) { console.error('Teil 2 insert FAILED:', t2.error); process.exit(1); }
  console.log('STEP 3 ✓ Teil 2 inserted:', t2.data);

  // ── STEP 4: Teil 3 — listening_multiple_choice, 2 clips x 3 = 6 items, played twice ──
  const t3 = await sb.from('exam_tasks').insert({
    exam_id: EXAM_ID, task_number: 3, task_type: 'listening_multiple_choice',
    difficulty_tag: 'monologue_comprehension', max_score: 6, order_index: 3,
    instructions:
      '🇩🇪 Sie hören zwei Anrufe auf einem Anrufbeantworter. Wählen Sie bei jeder Frage die richtige Antwort: a, b oder c. Sie hören jeden Text zweimal.\n' +
      '🇬🇧 You will hear two voicemail messages. For each question, choose the correct answer: a, b or c. You will hear each text twice.',
    stimulus: { play_count: 2, clips: [TEIL3_CLIP_A, TEIL3_CLIP_B] },
  }).select('id, task_number, task_type, max_score').single();
  if (t3.error) { console.error('Teil 3 insert FAILED:', t3.error); process.exit(1); }
  console.log('STEP 4 ✓ Teil 3 inserted:', t3.data);

  // ── Verification ──────────────────────────────────────────────────────
  const check = await sb.from('exam_tasks')
    .select('task_number, task_type, max_score')
    .eq('exam_id', EXAM_ID).order('task_number');
  console.log('\nFinal A1 Hören Übungssatz 1 (exam_id=' + EXAM_ID + '):');
  console.table(check.data);
  const total = (check.data || []).reduce((acc, t) => acc + (t.max_score || 0), 0);
  console.log('Total raw points:', total, '(official: 15 — this seed lands at ' + total + ', see script header)');
})();
