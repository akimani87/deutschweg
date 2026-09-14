// Über mich — focused refinement pass on the six existing guided-journey
// lessons. Does NOT touch the architecture (still 6 steps, same lesson ids,
// same topic_items order), does not add/remove lessons, does not touch
// Pronunciation or Numbers. Goal: fewer/fuller screens (merge adjacent
// text+example blocks via the new 'example-set' block and grouped
// 'dialogue'), a situational Du oder Sie? lesson (new 'scenario-check'
// block + a comparison-table of real contexts), and light "listen and
// repeat once" pronunciation nudges on the topic's key phrases.
require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

const MEIN_NAME_ID = '8e9af2ab-d32d-4f39-aef1-8724e513d1b0';
const WOHER_ID = '8141a8c8-d169-4c70-843e-c26d76e65655';
const WOHNST_ID = '97d0677b-c7f1-4e77-ac9f-1f746a1a672b';
const DU_SIE_ID = 'e925ddaa-4d02-43ce-98a4-5389526babaa';
const PROFILE_ID = '3b7b66be-3a67-4188-a897-48c47738b5cc';
const STELL_DICH_VOR_ID = 'b8c642c9-2c15-40be-8fa3-1740a6c15269';

// ── Step 1: Mein Name — 11 blocks -> 7 ──────────────────────────────────
const meinNameContent = [
  { type: 'dialogue', label: 'A first conversation', lines: [
    { stem: 'Hallo!', audio: 'Hallo' },
    { subject: 'Ich', verb: ' heiße', change: ' Amina', rest: '.', audio: 'Ich heiße Amina' },
    { stem: 'Hallo!', audio: 'Hallo' },
    { subject: 'Ich', verb: ' bin', change: ' Daniel', rest: '.', audio: 'Ich bin Daniel' }
  ] },
  { type: 'text', content: 'Amina and Daniel just told each other their name — in two different ways. Ich heiße … and Ich bin … both mean "My name is …" here. heißen literally means "to be called," so Ich heiße Amina is like saying "I am called Amina." Ich bin … is simpler — just "I am …" — used for names as naturally as in English. Both are completely normal, native ways to introduce yourself; neither is more correct than the other.' },
  { type: 'example-set', label: 'Try it with different names:', items: [
    { german: 'Ich heiße Kwame.', english: 'My name is Kwame.', audio: 'Ich heiße Kwame' },
    { german: 'Ich bin Fatima.', english: 'My name is Fatima.', audio: 'Ich bin Fatima' }
  ] },
  { type: 'tip', content: 'Quick check: which line introduces a name? A. "Guten Morgen!"  B. "Ich heiße Amina." — Answer: B.' },
  { type: 'example-set', label: 'To ask someone else’s name, use Wie heißt du? — "What is your name?" (informally, to one person).', items: [
    { german: 'Wie heißt du?', english: "What's your name?", audio: 'Wie heißt du' },
    { german: 'Ich heiße Amina. Und du? Wie heißt du?', english: "My name is Amina. And you? What's your name?", audio: 'Ich heiße Amina. Und du? Wie heißt du?' }
  ] },
  { type: 'write-prompt', prompt: "Now it's your turn. Write: Ich heiße _____.", example: 'Ich heiße Daniel.' },
  { type: 'recap', content: "You can say your name two ways — Ich heiße … and Ich bin … — and ask someone else's with Wie heißt du?" }
];

// ── Step 2: Woher kommst du? — 10 blocks -> 7 ───────────────────────────
const woherContent = [
  { type: 'dialogue', label: 'Meeting someone new', lines: [
    { subject: 'Ich', verb: ' heiße', change: ' Amina', rest: '.', audio: 'Ich heiße Amina' },
    { subject: 'Ich', verb: ' komme aus', change: ' Nigeria', rest: '.', audio: 'Ich komme aus Nigeria' }
  ] },
  { type: 'text', content: 'After her name, Amina says where she’s from: Ich komme aus Nigeria — "I come from Nigeria." kommen means "to come," and aus means "from" — together, Ich komme aus … always names your country or city of origin.' },
  { type: 'example-set', label: 'A few more ways to say it:', items: [
    { german: 'Ich komme aus Ghana.', english: 'I come from Ghana.', audio: 'Ich komme aus Ghana' },
    { german: 'Ich komme aus Kenia.', english: 'I come from Kenya.', audio: 'Ich komme aus Kenia' }
  ] },
  { type: 'tip', content: 'Quick check: Ich ___ aus Äthiopien. A. komme  B. heiße  C. bin — Answer: A, komme.' },
  { type: 'example-set', label: 'To ask, use Woher kommst du? — "Where are you from?"', items: [
    { german: 'Woher kommst du?', english: 'Where are you from?', audio: 'Woher kommst du' }
  ] },
  { type: 'write-prompt', prompt: 'Write: Ich komme aus _____.', example: 'Ich komme aus Südafrika.' },
  { type: 'recap', content: "You can say where you're from with Ich komme aus … and ask with Woher kommst du?" }
];

// ── Step 3: Wo wohnst du? — 10 blocks -> 7 ──────────────────────────────
const wohnstContent = [
  { type: 'dialogue', label: 'Amina keeps going', lines: [
    { subject: 'Ich', verb: ' komme aus', change: ' Nigeria', rest: '.', audio: 'Ich komme aus Nigeria' },
    { subject: 'Ich', verb: ' wohne in', change: ' Berlin', rest: '.', audio: 'Ich wohne in Berlin' }
  ] },
  { type: 'text', content: "Ich komme aus … is where you're originally from. Ich wohne in … is where you live now — Amina is from Nigeria, but lives in Berlin. Both can be true at once, and it's completely normal for them to be different places. wohnen means \"to live\"; Ich wohne in … names the city you live in now." },
  { type: 'example-set', label: 'A few more ways to say it:', items: [
    { german: 'Ich wohne in Hamburg.', english: 'I live in Hamburg.', audio: 'Ich wohne in Hamburg' },
    { german: 'Ich komme aus Ghana, aber ich wohne in Frankfurt.', english: 'I come from Ghana, but I live in Frankfurt.', audio: 'Ich komme aus Ghana, aber ich wohne in Frankfurt' }
  ] },
  { type: 'tip', content: 'Quick check: Ich ___ in Köln. A. komme  B. wohne  C. heiße — Answer: B, wohne.' },
  { type: 'example-set', label: 'To ask, use Wo wohnst du? — "Where do you live?"', items: [
    { german: 'Wo wohnst du?', english: 'Where do you live?', audio: 'Wo wohnst du' }
  ] },
  { type: 'write-prompt', prompt: 'Write: Ich wohne in _____.', example: 'Ich wohne in Leipzig.' },
  { type: 'recap', content: "You can say where you live with Ich wohne in … and ask with Wo wohnst du? — and you know it's different from where you're from." }
];

// ── Step 4: Du oder Sie? — 9 blocks -> 7, now situational ───────────────
const duSieContent = [
  { icon: '🤝', type: 'rule-card', title: 'du vs Sie', description: '(informal / formal "you")' },
  { type: 'text', content: 'German has two words for "you" — du and Sie — and choosing the right one is one of the most important social skills in the language. du is informal and personal. Sie is formal and respectful, and always written with a capital S to tell it apart from sie meaning "she" or "they."' },
  { type: 'comparison-table', headers: ['du — informal', 'Sie — formal'], rows: [
    ['Friends', 'Your doctor'],
    ['Family', 'A teacher or professor'],
    ['Children', 'Your employer or supervisor'],
    ['Classmates', 'Customer-service situations'],
    ['People you know well', "Adults you don't know yet"]
  ] },
  { type: 'example-set', label: 'The same question, asked two ways:', items: [
    { german: 'Wie heißt du?', english: 'What is your name? (informal)', audio: 'Wie heißt du' },
    { german: 'Wie heißen Sie?', english: 'What is your name? (formal)', audio: 'Wie heißen Sie' }
  ] },
  { type: 'common-mistake', content: 'Switching from Sie to du without being invited is considered rude in German-speaking countries — when in doubt, stay with Sie until the other person offers du.' },
  { type: 'scenario-check', intro: 'Quick check — du or Sie?', items: [
    { situation: 'You are speaking to your close friend.', answer: 'du', note: 'Friends always get du.' },
    { situation: 'You meet your doctor for the first time.', answer: 'Sie', note: 'A new, professional relationship — stay formal.' },
    { situation: "You speak to your child's teacher.", answer: 'Sie', note: "An adult you don't know yet, in a professional role." },
    { situation: 'You meet someone your age at a party, and they say "Wir können du sagen" (let’s use du).', answer: 'du', note: "Once someone offers you du, it's polite to accept and switch." }
  ] },
  { type: 'recap', content: 'du = friends, family, children, people you know well. Sie = strangers, professionals, and formal situations — always a capital S. When unsure, start with Sie.' }
];

// ── Step 5: Profile verstehen — 7 blocks -> 5 ───────────────────────────
const profileContent = [
  { type: 'text', content: 'Put it together — read and listen to two short profiles, then check what you understood.' },
  { type: 'dialogue', groups: [
    { label: "Kwame's profile", lines: [
      { stem: 'Hallo!', audio: 'Hallo' },
      { subject: 'Ich', verb: ' heiße', change: ' Kwame', rest: '.', audio: 'Ich heiße Kwame' },
      { subject: 'Ich', verb: ' komme aus', change: ' Ghana', rest: '.', audio: 'Ich komme aus Ghana' },
      { subject: 'Ich', verb: ' wohne in', change: ' Hamburg', rest: '.', audio: 'Ich wohne in Hamburg' },
      { subject: 'Ich', verb: ' bin', change: ' 27', rest: ' Jahre alt.', audio: 'Ich bin 27 Jahre alt' }
    ] },
    { label: "Fatima's profile", lines: [
      { stem: 'Hallo!', audio: 'Hallo' },
      { subject: 'Ich', verb: ' heiße', change: ' Fatima', rest: '.', audio: 'Ich heiße Fatima' },
      { subject: 'Ich', verb: ' komme aus', change: ' Nigeria', rest: '.', audio: 'Ich komme aus Nigeria' },
      { subject: 'Ich', verb: ' wohne in', change: ' München', rest: '.', audio: 'Ich wohne in München' },
      { subject: 'Ich', verb: ' bin', change: ' 24', rest: ' Jahre alt.', audio: 'Ich bin 24 Jahre alt' }
    ] }
  ] },
  { type: 'vocab-grid', label: 'Both profiles follow the exact same pattern: heiße → komme aus → wohne in → bin … Jahre alt. Only the details change. A few more countries you might hear:', items: [
    { word: 'Ghana', translation: 'Ghana' },
    { word: 'Nigeria', translation: 'Nigeria' },
    { word: 'Kenia', translation: 'Kenya' },
    { word: 'Südafrika', translation: 'South Africa' },
    { word: 'Äthiopien', translation: 'Ethiopia' }
  ] },
  { type: 'tip', content: "Quick check: What's Kwame's name, and which country is he from? — Answer: Kwame, from Ghana." },
  { type: 'recap', content: 'You can read and listen to a simple profile and pick out the key facts: name, origin, residence, age.' }
];

// ── Step 6: Stell dich vor — 6 blocks -> 5 ──────────────────────────────
const stellDichVorContent = [
  { type: 'text', content: "Now put it all together. You know how to say your name, where you're from, and where you live — time to introduce yourself in one go. The shape is always the same: name, then origin, then residence — just your own details each time." },
  { type: 'example-set', items: [
    { german: 'Ich heiße Amina. Ich komme aus Nigeria. Ich wohne in Berlin.', english: "My name is Amina. I'm from Nigeria. I live in Berlin.", audio: 'Ich heiße Amina. Ich komme aus Nigeria. Ich wohne in Berlin.' }
  ] },
  { type: 'tip', content: 'Say it out loud first — to yourself, or using Sprechen practice. Hearing yourself say it makes the next step easier.' },
  { type: 'write-prompt', prompt: 'Now write your own: Ich heiße … Ich komme aus … Ich wohne in …', example: 'Ich heiße Daniel. Ich komme aus Kenia. Ich wohne in Frankfurt.' },
  { type: 'recap', content: "That's a complete self-introduction — the exact shape you'll use for the independent check next, and at the start of the Goethe A1 Sprechen exam." }
];

(async () => {
  const updates = [
    [MEIN_NAME_ID, meinNameContent, 'Mein Name'],
    [WOHER_ID, woherContent, 'Woher kommst du?'],
    [WOHNST_ID, wohnstContent, 'Wo wohnst du?'],
    [DU_SIE_ID, duSieContent, 'Du oder Sie?'],
    [PROFILE_ID, profileContent, 'Profile verstehen'],
    [STELL_DICH_VOR_ID, stellDichVorContent, 'Stell dich vor']
  ];
  for (const [id, content, label] of updates) {
    const { error } = await sb.from('lessons').update({ content_json: content }).eq('id', id);
    if (error) { console.error('UPDATE FAILED for', label, error); process.exit(1); }
    console.log('Updated:', label, '(' + content.length + ' blocks)');
  }
  console.log('\nDone.');
})();
