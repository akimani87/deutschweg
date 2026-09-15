// Lesson 1.1 (Greetings) — its first clock-quiz block had 6 rounds but only
// 3 genuinely distinct items (morning/day/evening greeting) — items 0-2 and
// 3-5 were exact duplicates (same time/audio/sentence), differing only in
// which order the 3 multiple-choice options were shuffled in. Confirmed via
// a live-data scan of every clock-quiz block in Modules 1-3: this lesson's
// block was the worst case (100% duplicated: distinct=3 of items=6).
// Fix: drop the 3 reshuffled duplicates, keep the original 3 — matching
// "use only the number of rounds needed" rather than inventing new content.
// Scoped to exactly this one block; every other block in this lesson (and
// every other lesson) is untouched.
require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

const LESSON_ID = '564b2e3c-6315-4102-8d89-ab2111bf0b0d'; // 1.1 — Greetings (Begrüßungen)

(async () => {
  const { data: lesson, error: fetchErr } = await sb.from('lessons').select('content_json').eq('id', LESSON_ID).single();
  if (fetchErr) { console.error('FETCH FAILED', fetchErr); process.exit(1); }

  const blocks = lesson.content_json;
  const block = blocks[2];
  if (block.type !== 'clock-quiz' || block.variant !== 'quiz' || block.items.length !== 6) {
    console.error('SAFETY CHECK FAILED — block 2 is not the expected 6-item clock-quiz. Aborting without writing.', block.type, block.items && block.items.length);
    process.exit(1);
  }

  const before = block.items.map(i => i.time + '/' + i.sentence);
  block.items = block.items.slice(0, 3);
  const after = block.items.map(i => i.time + '/' + i.sentence);
  console.log('Before (6):', before);
  console.log('After (3): ', after);

  const { error: writeErr } = await sb.from('lessons').update({ content_json: blocks }).eq('id', LESSON_ID);
  if (writeErr) { console.error('WRITE FAILED', writeErr); process.exit(1); }
  console.log('\nDone — lesson 1.1 block 2 now has 3 rounds instead of 6.');
})();
