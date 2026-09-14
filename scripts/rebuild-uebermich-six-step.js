// Über mich — rebuild to the approved six-step guided journey.
// Replaces the earlier five-item structure (which re-pointed to Greetings
// L1-L3 + Personal Pronouns L4) with six freshly-authored/adapted lessons,
// all living in ONE hidden module so module.html's existing lesson-to-lesson
// sequencing gives continuous Continue flow for free — no new cross-module
// redirect logic needed in module.html.
//
// Order of operations matters: lessons_module_order_uidx is a unique index
// on (module_id, order_index), so existing rows are moved OFF the slots the
// new rows need before anything is inserted there.
require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

const TOPIC_ID = '4bf7abfd-0147-4a83-b8c2-df60a263c24d';
const HIDDEN_MODULE_ID = 'b7267868-5cad-4d6d-8755-f2347ca843d3'; // Über mich — Topic Extras
const SIMPLE_PROFILE_ID = '3b7b66be-3a67-4188-a897-48c47738b5cc';
const CHECK_LESSON_ID = '3dd3e983-fdd6-4e19-9f06-db865be3c248';

// ── Step 1: Mein Name ───────────────────────────────────────────────────
const meinNameContent = [
  { type: 'dialogue', label: 'A first conversation', lines: [
    { stem: 'Hallo!', audio: 'Hallo' },
    { subject: 'Ich', verb: ' heiße', change: ' Amina', rest: '.', audio: 'Ich heiße Amina' },
    { stem: 'Hallo!', audio: 'Hallo' },
    { subject: 'Ich', verb: ' bin', change: ' Daniel', rest: '.', audio: 'Ich bin Daniel' }
  ] },
  { type: 'text', content: 'Amina and Daniel just told each other their name — in two different ways. Ich heiße … and Ich bin … both mean "My name is …" here.' },
  { type: 'text', content: 'heißen literally means "to be called" — Ich heiße Amina is like saying "I am called Amina." Ich bin … is simpler: "I am …", used for names just as naturally as in English.' },
  { type: 'example', german: 'Ich heiße Kwame.', english: 'My name is Kwame.' },
  { type: 'example', german: 'Ich bin Fatima.', english: 'My name is Fatima.' },
  { type: 'tip', content: 'Quick check: which line introduces a name? A. "Guten Morgen!"  B. "Ich heiße Amina." — Answer: B.' },
  { type: 'text', content: 'To ask someone else, use Wie heißt du? — "What is your name?" (informally, one person).' },
  { type: 'example', german: 'Wie heißt du?', english: "What's your name?" },
  { type: 'example', german: 'Ich heiße Amina. Und du? Wie heißt du?', english: "My name is Amina. And you? What's your name?" },
  { type: 'write-prompt', prompt: "Now it's your turn. Write: Ich heiße _____.", example: 'Ich heiße Daniel.' },
  { type: 'recap', content: "You can say your name two ways — Ich heiße … and Ich bin … — and ask someone else's with Wie heißt du?" }
];

// ── Step 2: Woher kommst du? ────────────────────────────────────────────
const woherContent = [
  { type: 'dialogue', label: 'Meeting someone new', lines: [
    { subject: 'Ich', verb: ' heiße', change: ' Amina', rest: '.', audio: 'Ich heiße Amina' },
    { subject: 'Ich', verb: ' komme aus', change: ' Nigeria', rest: '.', audio: 'Ich komme aus Nigeria' }
  ] },
  { type: 'text', content: 'After her name, Amina says where she\'s from: Ich komme aus Nigeria — "I come from Nigeria."' },
  { type: 'text', content: 'kommen means "to come." Ich komme aus … always names your country or city of origin — aus means "from."' },
  { type: 'example', german: 'Ich komme aus Ghana.', english: 'I come from Ghana.' },
  { type: 'example', german: 'Ich komme aus Kenia.', english: 'I come from Kenya.' },
  { type: 'tip', content: 'Quick check: Ich ___ aus Äthiopien. A. komme  B. heiße  C. bin — Answer: A, komme.' },
  { type: 'text', content: 'To ask, use Woher kommst du? — "Where are you from?"' },
  { type: 'example', german: 'Woher kommst du?', english: 'Where are you from?' },
  { type: 'write-prompt', prompt: 'Write: Ich komme aus _____.', example: 'Ich komme aus Südafrika.' },
  { type: 'recap', content: "You can say where you're from with Ich komme aus … and ask with Woher kommst du?" }
];

// ── Step 3: Wo wohnst du? ───────────────────────────────────────────────
const wohnstContent = [
  { type: 'dialogue', label: 'Amina keeps going', lines: [
    { subject: 'Ich', verb: ' komme aus', change: ' Nigeria', rest: '.', audio: 'Ich komme aus Nigeria' },
    { subject: 'Ich', verb: ' wohne in', change: ' Berlin', rest: '.', audio: 'Ich wohne in Berlin' }
  ] },
  { type: 'text', content: "Ich komme aus … is where you're originally from. Ich wohne in … is where you live now — Amina is from Nigeria, but lives in Berlin. Both can be true at once." },
  { type: 'text', content: 'wohnen means "to live." Ich wohne in … names the city you live in now.' },
  { type: 'example', german: 'Ich wohne in Hamburg.', english: 'I live in Hamburg.' },
  { type: 'example', german: 'Ich komme aus Ghana, aber ich wohne in Frankfurt.', english: 'I come from Ghana, but I live in Frankfurt.' },
  { type: 'tip', content: 'Quick check: Ich ___ in Köln. A. komme  B. wohne  C. heiße — Answer: B, wohne.' },
  { type: 'text', content: 'To ask, use Wo wohnst du? — "Where do you live?"' },
  { type: 'example', german: 'Wo wohnst du?', english: 'Where do you live?' },
  { type: 'write-prompt', prompt: 'Write: Ich wohne in _____.', example: 'Ich wohne in Leipzig.' },
  { type: 'recap', content: 'You can say where you live with Ich wohne in … and ask with Wo wohnst du? — and you know it\'s different from where you\'re from.' }
];

// ── Step 4: Du oder Sie? — adapted from Personal Pronouns L4, trimmed to
// this topic's scope (dropped the "Kannst du/Können Sie mir helfen" pair
// and the exam pathway-card; kept the core rule, examples, and mistake). ──
const duSieContent = [
  { icon: '🤝', type: 'rule-card', title: 'du vs Sie', description: '(informal / formal "you")' },
  { type: 'example', german: 'Wie heißt du?', english: 'What is your name? (informal)' },
  { type: 'example', german: 'Wie heißen Sie?', english: 'What is your name? (formal)' },
  { type: 'comparison-table', headers: ['du (informal)', 'Sie (formal)'], rows: [['Wie heißt du?', 'Wie heißen Sie?']] },
  { type: 'text', content: 'Use du with friends, family, children, and people who invite you to use du. Use Sie with strangers and in formal situations.' },
  { type: 'text', content: 'Sie is always written with a capital S when it means formal "you" — that\'s how you tell it apart from sie meaning "she" or "they."' },
  { type: 'common-mistake', content: 'Switching from Sie to du without being invited is considered rude in German-speaking countries.' },
  { type: 'tip', content: 'Quick check: You meet the Goethe examiner. Which is correct? A. Hallo! Wie heißt du?  B. Guten Morgen. Wie heißen Sie? — Answer: B.' },
  { type: 'recap', content: 'du = friends, family, children. Sie = strangers and formal situations. Always a capital S for formal Sie.' }
];

// ── Step 5: Profile verstehen — revised from "Simple profile": the
// write-prompt is removed (writing belongs in step 6 only) and replaced
// with a purely receptive comprehension check. ──
const profileContent = [
  { type: 'text', content: 'Put it together — read and listen to two short profiles, then check what you understood.' },
  { type: 'dialogue', label: "Kwame's profile", lines: [
    { stem: 'Hallo!', audio: 'Hallo' },
    { subject: 'Ich', verb: ' heiße', change: ' Kwame', rest: '.', audio: 'Ich heiße Kwame' },
    { subject: 'Ich', verb: ' komme aus', change: ' Ghana', rest: '.', audio: 'Ich komme aus Ghana' },
    { subject: 'Ich', verb: ' wohne in', change: ' Hamburg', rest: '.', audio: 'Ich wohne in Hamburg' },
    { subject: 'Ich', verb: ' bin', change: ' 27', rest: ' Jahre alt.', audio: 'Ich bin 27 Jahre alt' }
  ] },
  { type: 'dialogue', label: "Fatima's profile", lines: [
    { stem: 'Hallo!', audio: 'Hallo' },
    { subject: 'Ich', verb: ' heiße', change: ' Fatima', rest: '.', audio: 'Ich heiße Fatima' },
    { subject: 'Ich', verb: ' komme aus', change: ' Nigeria', rest: '.', audio: 'Ich komme aus Nigeria' },
    { subject: 'Ich', verb: ' wohne in', change: ' München', rest: '.', audio: 'Ich wohne in München' },
    { subject: 'Ich', verb: ' bin', change: ' 24', rest: ' Jahre alt.', audio: 'Ich bin 24 Jahre alt' }
  ] },
  { type: 'text', content: 'Both profiles use the exact same pattern: heiße → komme aus → wohne in → bin … Jahre alt. Only the details change.' },
  { type: 'vocab-grid', items: [
    { word: 'Ghana', translation: 'Ghana' },
    { word: 'Nigeria', translation: 'Nigeria' },
    { word: 'Kenia', translation: 'Kenya' },
    { word: 'Südafrika', translation: 'South Africa' },
    { word: 'Äthiopien', translation: 'Ethiopia' }
  ] },
  { type: 'tip', content: "Quick check: What's Kwame's name, and which country is he from? — Answer: Kwame, from Ghana." },
  { type: 'recap', content: 'You can read and listen to a simple profile and pick out the key facts: name, origin, residence, age.' }
];

// ── Step 6: Stell dich vor — new, guided speak+write, still part of the
// required path (distinct from the independent check). ──
const stellDichVorContent = [
  { type: 'text', content: "Now put it all together. You know how to say your name, where you're from, and where you live — time to introduce yourself in one go." },
  { type: 'example', german: 'Ich heiße Amina. Ich komme aus Nigeria. Ich wohne in Berlin.', english: "My name is Amina. I'm from Nigeria. I live in Berlin." },
  { type: 'text', content: "That's the whole shape: name, then origin, then residence — the same three sentences every time, just your own details." },
  { type: 'tip', content: 'Say it out loud first — to yourself, or using Sprechen practice. Hearing yourself say it makes the next step easier.' },
  { type: 'write-prompt', prompt: 'Now write your own: Ich heiße … Ich komme aus … Ich wohne in …', example: 'Ich heiße Daniel. Ich komme aus Kenia. Ich wohne in Frankfurt.' },
  { type: 'recap', content: "That's a complete self-introduction — the exact shape you'll use for the independent check next, and at the start of the Goethe A1 Sprechen exam." }
];

// ── Independent check — lightly revised wording only: honest that it is
// not evaluated by DeutschWeg in this release (see decision on labeling). ──
const checkContent = [
  { type: 'text', content: "No model this time. In your own words, introduce yourself: your name, where you're from, and where you live." },
  { type: 'tip', content: "This isn't graded by DeutschWeg yet — nothing here is automatically checked. It's for you: if you can produce this on your own, you've done what this check is for." },
  { type: 'write-prompt', prompt: 'Write your introduction here (or say it out loud first, then write a short summary).', example: 'Ich heiße … . Ich komme aus … . Ich wohne in … .' },
  { type: 'recap', content: "That's a complete self-introduction — the same shape you'll use at the start of the Goethe A1 Sprechen exam." }
];

(async () => {
  // 1. New hidden module for the independent check, kept separate from the
  //    six-step module so finishing step 6 doesn't auto-advance into it —
  //    it's reached only as its own distinct action from the topic home.
  const { data: checkMod, error: checkModErr } = await sb.from('modules').insert({
    level: 'A1', title: 'Über mich — Independent Check', order_index: 902,
    description: 'Hidden host for the Über mich independent performance check. Not part of the flat A1 module list.',
    is_published: false
  }).select().single();
  if (checkModErr) { console.error('CHECK MODULE INSERT FAILED', checkModErr); process.exit(1); }
  console.log('Created check module:', checkMod.id);

  // 2. Move the existing check lesson into it (frees hidden-module order_index 2).
  const { error: moveErr } = await sb.from('lessons').update({
    module_id: checkMod.id, order_index: 1, title: 'Introduce yourself — independent check',
    content_json: checkContent
  }).eq('id', CHECK_LESSON_ID);
  if (moveErr) { console.error('MOVE CHECK LESSON FAILED', moveErr); process.exit(1); }
  console.log('Moved + revised independent check lesson');

  // 3. Vacate order_index 1 in the six-step module by moving Simple profile to 5.
  const { error: vacateErr } = await sb.from('lessons').update({ order_index: 5 }).eq('id', SIMPLE_PROFILE_ID);
  if (vacateErr) { console.error('VACATE FAILED', vacateErr); process.exit(1); }
  console.log('Moved Simple profile to order_index 5 (vacated slot 1)');

  // 4-7. Insert the four new lessons at slots 1-4.
  const inserts = [
    { module_id: HIDDEN_MODULE_ID, order_index: 1, title: 'Mein Name', content_json: meinNameContent,
      lernziel_intro: 'Say your name, two ways — and ask someone else\'s.',
      lernziel_completion: 'You can introduce yourself by name and ask another person\'s name.' },
    { module_id: HIDDEN_MODULE_ID, order_index: 2, title: 'Woher kommst du?', content_json: woherContent,
      lernziel_intro: "Say where you're from — and ask someone else.",
      lernziel_completion: 'You can say your country of origin and ask another person\'s.' },
    { module_id: HIDDEN_MODULE_ID, order_index: 3, title: 'Wo wohnst du?', content_json: wohnstContent,
      lernziel_intro: 'Say where you live now — and ask someone else.',
      lernziel_completion: 'You can say where you live and ask another person, and know the difference between komme aus and wohne in.' },
    { module_id: HIDDEN_MODULE_ID, order_index: 4, title: 'Du oder Sie?', content_json: duSieContent,
      lernziel_intro: 'Learn when to say du and when to say Sie.',
      lernziel_completion: 'You can tell informal du from formal Sie, and know which to use with a stranger.' }
  ];
  const { data: newLessons, error: insErr } = await sb.from('lessons').insert(inserts).select();
  if (insErr) { console.error('NEW LESSONS INSERT FAILED', insErr); process.exit(1); }
  console.log('Inserted', newLessons.length, 'new lessons for steps 1-4');
  const byTitle = {}; newLessons.forEach(l => { byTitle[l.title] = l; });

  // 8. Revise Simple profile in place -> step 5 "Profile verstehen".
  const { data: profileLesson, error: profErr } = await sb.from('lessons').update({
    title: 'Profile verstehen', content_json: profileContent,
    lernziel_intro: 'Read and listen to two example profiles, then check what you understood.',
    lernziel_completion: 'You can understand a simple personal introduction and identify the key information in it.'
  }).eq('id', SIMPLE_PROFILE_ID).select().single();
  if (profErr) { console.error('PROFILE REVISE FAILED', profErr); process.exit(1); }
  console.log('Revised Simple profile -> Profile verstehen (order_index 5)');

  // 9. Insert step 6.
  const { data: stellDichVor, error: sdvErr } = await sb.from('lessons').insert({
    module_id: HIDDEN_MODULE_ID, order_index: 6, title: 'Stell dich vor', content_json: stellDichVorContent,
    lernziel_intro: 'Put it all together — introduce yourself out loud and in writing.',
    lernziel_completion: 'You can introduce yourself with a short, connected description: name, origin, residence.'
  }).select().single();
  if (sdvErr) { console.error('STEP 6 INSERT FAILED', sdvErr); process.exit(1); }
  console.log('Inserted step 6: Stell dich vor');

  // 10. Rebuild topic_items: delete the old five, insert the new six.
  const { error: delErr } = await sb.from('topic_items').delete().eq('topic_id', TOPIC_ID);
  if (delErr) { console.error('DELETE OLD TOPIC_ITEMS FAILED', delErr); process.exit(1); }

  const newItems = [
    { topic_id: TOPIC_ID, order_index: 1, lesson_id: byTitle['Mein Name'].id, display_title: 'Mein Name' },
    { topic_id: TOPIC_ID, order_index: 2, lesson_id: byTitle['Woher kommst du?'].id, display_title: 'Woher kommst du?' },
    { topic_id: TOPIC_ID, order_index: 3, lesson_id: byTitle['Wo wohnst du?'].id, display_title: 'Wo wohnst du?' },
    { topic_id: TOPIC_ID, order_index: 4, lesson_id: byTitle['Du oder Sie?'].id, display_title: 'Du oder Sie?' },
    { topic_id: TOPIC_ID, order_index: 5, lesson_id: profileLesson.id, display_title: 'Profile verstehen' },
    { topic_id: TOPIC_ID, order_index: 6, lesson_id: stellDichVor.id, display_title: 'Stell dich vor' }
  ];
  const { error: itemsErr } = await sb.from('topic_items').insert(newItems);
  if (itemsErr) { console.error('NEW TOPIC_ITEMS INSERT FAILED', itemsErr); process.exit(1); }
  console.log('Rebuilt topic_items: 6 steps');

  // 11. performance_check_lesson_id is unchanged (same lesson id, just moved
  //     module_id) — only outcome_line gets refreshed to match the new path.
  const { error: topicErr } = await sb.from('topics').update({
    outcome_line: "Learn how to introduce yourself in German — your name, where you're from, and where you live."
  }).eq('id', TOPIC_ID);
  if (topicErr) { console.error('TOPIC UPDATE FAILED', topicErr); process.exit(1); }

  console.log('\nDone. Six-step module id:', HIDDEN_MODULE_ID, '| Check module id:', checkMod.id);
})();
