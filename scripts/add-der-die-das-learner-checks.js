/**
 * Fixes a real content gap found during a Module 5 A1 (Der, Die, Das) sync
 * verification: the local approved file (module-a1-5-der-die-das.html) has
 * one "learner-check" self-test prompt per lesson (6 total) that was never
 * ported when the module was originally synced to content_json.
 *
 * Adds each one as a `tip` block (an existing, already-supported type —
 * no renderer changes needed) positioned immediately before the lesson's
 * final `recap` block, matching its position in the local file (right
 * before the "Continue" button, at the end of the lesson content).
 *
 * Scope: content_json only, on the same 6 lesson rows already used by this
 * module. No lesson IDs, order_index, titles, module_id, or lesson_exercises
 * are touched.
 *
 * Usage:
 *   node scripts/add-der-die-das-learner-checks.js         (dry run)
 *   node scripts/add-der-die-das-learner-checks.js --yes    (writes)
 */
require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

const LEARNER_CHECKS = {
  'df6e9e70-3a0a-49d3-89bd-f3213851a120': 'Check yourself: Cover the examples. Which article belongs with Frau? Which indefinite article belongs with Kind? Say both answers aloud before continuing.',
  '4dfd7b79-0cc6-4339-a34f-05118db04759': 'Check yourself: Choose quickly — Wohnung, Frühling, and Mädchen — which one is die, which is der, and which is das?',
  '9550bcd5-dbcf-4d6c-bbf5-a22f119a3460': 'Check yourself: Recall without looking. What are the articles for Haus, Wohnung, and Kaffee? Then tap the cards to check.',
  '835fc7f9-3a4c-44aa-a63b-81586c99ce45': 'Check yourself: Compare. Say the masculine and feminine forms for doctor, then name the articles for Bahnhof and Büro.',
  '4df40c99-c996-416b-b3b5-8fe6e4429d76': 'Check yourself: Change to plural — der Tisch, das Kind, and die Frau. Say the three plural forms before checking the examples.',
  '05d17b40-ad89-4d15-b149-8c6909511b9a': 'Check yourself: Listen and identify. Play one sentence above. Is the key noun der, die, or das — and which spoken article proves it?',
};

async function main() {
  const yes = process.argv.includes('--yes');
  const ids = Object.keys(LEARNER_CHECKS);

  const { data: lessons, error } = await sb.from('lessons').select('id, order_index, title, content_json').in('id', ids);
  if (error) { console.error('Failed to read lessons:', error.message); process.exit(1); }
  if (lessons.length !== ids.length) { console.error(`Expected ${ids.length} rows, found ${lessons.length} — aborting.`); process.exit(1); }

  console.log('=== DIFF (inserting 1 tip block before recap, per lesson) ===\n');
  const updates = [];
  for (const lesson of lessons.sort((a, b) => a.order_index - b.order_index)) {
    const blocks = lesson.content_json;
    const recapIdx = blocks.findIndex((b) => b.type === 'recap');
    if (recapIdx === -1) { console.error(`Lesson ${lesson.id} has no recap block — aborting, unexpected shape.`); process.exit(1); }
    const alreadyHasCheck = blocks.some((b) => b.type === 'tip' && String(b.content).startsWith('Check yourself:'));
    if (alreadyHasCheck) {
      console.log(`[${lesson.order_index}] ${lesson.title} — already has a "Check yourself" tip, skipping.`);
      continue;
    }
    const newBlocks = blocks.slice();
    newBlocks.splice(recapIdx, 0, { type: 'tip', content: LEARNER_CHECKS[lesson.id] });
    console.log(`[${lesson.order_index}] ${lesson.title}: ${blocks.length} -> ${newBlocks.length} blocks (insert tip at index ${recapIdx})`);
    updates.push({ id: lesson.id, content_json: newBlocks });
  }

  if (!updates.length) {
    console.log('\nNothing to do — every lesson already has its learner-check tip.');
    return;
  }

  if (!yes) {
    console.log(`\nDry run only — ${updates.length} lesson(s) would be updated. Re-run with --yes to write.`);
    return;
  }

  console.log('\nWriting...');
  for (const u of updates) {
    const { error: updErr } = await sb.from('lessons').update({ content_json: u.content_json }).eq('id', u.id);
    if (updErr) { console.error(`FAILED on ${u.id}:`, updErr.message); process.exit(1); }
    console.log(`  updated ${u.id}`);
  }
  console.log(`\nDone. ${updates.length} lesson row(s) updated (content_json only).`);
}

main().catch((e) => { console.error('CRASHED:', e); process.exit(1); });
