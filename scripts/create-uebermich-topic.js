// Über mich — first-release topic content.
// Creates the two topic-native lessons (Simple profile; the independent
// performance check) inside the hidden "Über mich — Topic Extras" module
// (level A1, order_index 901 — created by supabase/migrations/0025_topics.sql),
// then creates the DRAFT topics row (is_published:false) and its
// topic_items, re-pointing to four existing, already-refined lessons rather
// than duplicating them:
//   1. Hello                                  -> Greetings L1 (Begrüßungen)
//   2. My name                                -> Greetings L2 (Ich heiße)
//   3. Where are you from? / Where do you live? -> Greetings L3 (komme aus / wohne in)
//   4. Asking another person (du vs Sie)      -> Personal Pronouns L4
//   5. Simple profile                         -> new lesson (this script)
// performance_check_lesson_id points at a sixth, separate new lesson — never
// a topic_item, so "lessons complete" and "independent performance" can
// never be conflated (see topic_progress vs topic_performance_checks).
//
// Uses the write-prompt block type (prompt + reveal-example, no AI scoring
// in v1) — module.html doesn't render it yet; that lands in the next step
// alongside the &lesson= deep-link param. content_json is just data, so
// authoring it now is safe regardless of render-order.
require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const GREETINGS_L1   = '564b2e3c-6315-4102-8d89-ab2111bf0b0d'; // Hello
const GREETINGS_L2   = '89113c62-536f-43e3-ad05-27b7e8391621'; // My name
const GREETINGS_L3   = 'e2b63d8f-ac9c-4bda-bbd4-d6ea147b3184'; // Where from / where live
const PRONOUNS_L4    = 'a6ce691e-6663-4a80-9675-6e075d5d81df'; // Asking another person

const simpleProfileContent = [
  { type: 'text', content: "Put it all together — read two short profiles, then write your own the same way." },
  { type: 'dialogue', label: "Kwame's profile", lines: [
    { stem: 'Hallo!', audio: 'Hallo' },
    { subject: 'Ich', verb: ' heiße',     change: ' Kwame',   rest: '.',          audio: 'Ich heiße Kwame' },
    { subject: 'Ich', verb: ' komme aus', change: ' Ghana',   rest: '.',          audio: 'Ich komme aus Ghana' },
    { subject: 'Ich', verb: ' wohne in',  change: ' Hamburg', rest: '.',          audio: 'Ich wohne in Hamburg' },
    { subject: 'Ich', verb: ' bin',       change: ' 27',      rest: ' Jahre alt.', audio: 'Ich bin 27 Jahre alt' }
  ] },
  { type: 'dialogue', label: "Fatima's profile", lines: [
    { stem: 'Hallo!', audio: 'Hallo' },
    { subject: 'Ich', verb: ' heiße',     change: ' Fatima',  rest: '.',          audio: 'Ich heiße Fatima' },
    { subject: 'Ich', verb: ' komme aus', change: ' Nigeria', rest: '.',          audio: 'Ich komme aus Nigeria' },
    { subject: 'Ich', verb: ' wohne in',  change: ' München', rest: '.',          audio: 'Ich wohne in München' },
    { subject: 'Ich', verb: ' bin',       change: ' 24',      rest: ' Jahre alt.', audio: 'Ich bin 24 Jahre alt' }
  ] },
  { type: 'text', content: 'Both profiles use the exact same pattern: heiße → komme aus → wohne in → bin … Jahre alt. Only the details change.' },
  { type: 'vocab-grid', items: [
    { word: 'Ghana',      translation: 'Ghana' },
    { word: 'Nigeria',    translation: 'Nigeria' },
    { word: 'Kenia',      translation: 'Kenya' },
    { word: 'Südafrika',  translation: 'South Africa' },
    { word: 'Äthiopien',  translation: 'Ethiopia' }
  ] },
  { type: 'write-prompt',
    prompt: "Now write your own profile: your name, where you're from, where you live, and your age.",
    example: 'Ich heiße Amara. Ich komme aus Kenia. Ich wohne in Frankfurt. Ich bin 22 Jahre alt.' },
  { type: 'recap', content: 'You can read a simple profile and write your own — name, origin, residence, and age, all in one short paragraph.' }
];

const performanceCheckContent = [
  { type: 'text', content: "No model this time. In your own words, introduce yourself: your name, where you're from, and where you live." },
  { type: 'tip', content: "This isn't graded on grammar. You pass if someone reading or listening can tell your name, where you're from, and where you live — a wrong verb ending or article doesn't fail you." },
  { type: 'write-prompt',
    prompt: 'Write your introduction here (or say it out loud first, then write a short summary).',
    example: 'Ich heiße … . Ich komme aus … . Ich wohne in … .' },
  { type: 'recap', content: "That's a complete self-introduction — the same shape you'll use at the start of the Goethe A1 Sprechen exam." }
];

(async () => {
  const { data: extrasMod, error: modLookupErr } = await sb.from('modules')
    .select('id').eq('level', 'A1').eq('order_index', 901).maybeSingle();
  if (modLookupErr || !extrasMod) { console.error('Could not find "Über mich — Topic Extras" module (run 0025_topics.sql first)', modLookupErr); process.exit(1); }
  console.log('Found hidden module:', extrasMod.id);

  const { data: profileLesson, error: profErr } = await sb.from('lessons').insert({
    module_id: extrasMod.id,
    title: 'Simple profile',
    order_index: 1,
    content_json: simpleProfileContent,
    lernziel_intro: 'Read two example profiles, then write your own the same way.',
    lernziel_completion: 'You can read and write a simple personal profile in German.'
  }).select().single();
  if (profErr) { console.error('SIMPLE PROFILE LESSON INSERT FAILED', profErr); process.exit(1); }
  console.log('Created "Simple profile" lesson:', profileLesson.id);

  const { data: checkLesson, error: checkErr } = await sb.from('lessons').insert({
    module_id: extrasMod.id,
    title: 'Introduce yourself — independent check',
    order_index: 2,
    content_json: performanceCheckContent,
    lernziel_intro: null,
    lernziel_completion: null
  }).select().single();
  if (checkErr) { console.error('PERFORMANCE CHECK LESSON INSERT FAILED', checkErr); process.exit(1); }
  console.log('Created "Introduce yourself — independent check" lesson:', checkLesson.id);

  const { data: topic, error: topicErr } = await sb.from('topics').insert({
    level: 'A1',
    order_index: 1,
    title_de: 'Über mich',
    title_en: 'About me',
    outcome_line: "Learn how to say your name and where you're from.",
    description: 'Introduce yourself, exchange name / origin / residence, ask the same of another person, and understand a simple introduction.',
    performance_check_lesson_id: checkLesson.id,
    is_published: false
  }).select().single();
  if (topicErr) { console.error('TOPIC INSERT FAILED', topicErr); process.exit(1); }
  console.log('Created draft topic "Über mich":', topic.id);

  const items = [
    { topic_id: topic.id, order_index: 1, lesson_id: GREETINGS_L1, display_title: 'Hello' },
    { topic_id: topic.id, order_index: 2, lesson_id: GREETINGS_L2, display_title: 'My name' },
    { topic_id: topic.id, order_index: 3, lesson_id: GREETINGS_L3, display_title: 'Where are you from? / Where do you live?' },
    { topic_id: topic.id, order_index: 4, lesson_id: PRONOUNS_L4,  display_title: 'Asking another person' },
    { topic_id: topic.id, order_index: 5, lesson_id: profileLesson.id, display_title: 'Simple profile' }
  ];
  const { error: itemsErr } = await sb.from('topic_items').insert(items);
  if (itemsErr) { console.error('TOPIC ITEMS INSERT FAILED', itemsErr); process.exit(1); }
  console.log('Created ' + items.length + ' topic_items.');

  console.log('\nDraft topic id:', topic.id, '(is_published:false — flip at launch, per build order step 8)');
})();
