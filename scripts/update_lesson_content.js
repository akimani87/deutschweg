/**
 * DeutschWeg — backfill lessons.content_text from extracted HTML.
 *
 * Reads supabase-data/content_migration.json (built by the extraction
 * one-liner) and updates the lessons table.
 *
 * Safety: only updates rows where content_text IS NULL. Existing content
 * is never overwritten — enforced server-side via the `.is('content_text', null)`
 * filter so even a bug in this script can't damage populated rows.
 *
 * Run: node scripts/update_lesson_content.js
 */

const fs   = require('fs');
const path = require('path');

require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });

const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL              = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('✗ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env');
  process.exit(1);
}

const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const MIGRATION_PATH = path.resolve(__dirname, '..', 'supabase-data', 'content_migration.json');
const ALL_MODULES    = path.resolve(__dirname, '..', 'supabase-data', 'all-modules.json');

(async () => {
  // ── Load inputs ─────────────────────────────────────────────────────────
  if (!fs.existsSync(MIGRATION_PATH)) {
    console.error('✗ ' + MIGRATION_PATH + ' not found. Generate it first with the extraction one-liner.');
    process.exit(1);
  }
  if (!fs.existsSync(ALL_MODULES)) {
    console.error('✗ ' + ALL_MODULES + ' not found.');
    process.exit(1);
  }

  const migration   = JSON.parse(fs.readFileSync(MIGRATION_PATH, 'utf-8'));
  const allModules  = JSON.parse(fs.readFileSync(ALL_MODULES,    'utf-8'));

  // ── Build filename → (level, level-relative order_index) map ───────────
  // Mirrors the seed-script logic so we look up the DB row that matches each
  // HTML file.
  const byLevel = {};
  allModules.forEach((m) => { (byLevel[m.level] = byLevel[m.level] || []).push(m); });
  Object.keys(byLevel).forEach((level) => {
    byLevel[level].sort((a, b) => (a.order_index || 0) - (b.order_index || 0));
    byLevel[level].forEach((m, i) => { m._levelRelOrder = i + 1; });
  });
  const filenameToKey = {};
  allModules.forEach((m) => {
    filenameToKey[m.filename] = { level: m.level, order_index: m._levelRelOrder };
  });

  // ── Snapshot before ─────────────────────────────────────────────────────
  const before = await snapshot();
  console.log('Before:  ' + before.populated + ' populated · ' + before.nul + ' NULL · ' + before.total + ' total lessons');
  console.log('');

  // ── Walk the migration JSON and apply updates ──────────────────────────
  let updated      = 0;
  let alreadyHad   = 0;     // row exists, content_text was already populated → skipped by .is filter
  let lessonMissing = 0;    // module exists but no lesson at that order_index
  let moduleMissing = 0;    // filename had no DB match

  for (const entry of migration) {
    const info = filenameToKey[entry.filename];
    if (!info) {
      console.warn('  · No DB mapping for ' + entry.filename);
      moduleMissing++;
      continue;
    }

    // Find the module in DB
    const modRes = await sb
      .from('modules')
      .select('id')
      .eq('level',       info.level)
      .eq('order_index', info.order_index)
      .maybeSingle();

    if (modRes.error || !modRes.data) {
      console.warn('  · Module row not found for ' + entry.filename + ' (' + info.level + '-' + info.order_index + ')');
      moduleMissing++;
      continue;
    }
    const moduleId = modRes.data.id;

    // For each extracted lesson, attempt update where content_text IS NULL.
    // Extraction order_index is 0-indexed (HTML ids l0-s0, l1-s0, ...);
    // DB order_index is 1-indexed.
    for (const ext of entry.lessons) {
      const dbOrder = ext.order_index + 1;

      const upd = await sb
        .from('lessons')
        .update({ content_text: ext.content })
        .eq('module_id',   moduleId)
        .eq('order_index', dbOrder)
        .is('content_text', null)
        .select('id');

      if (upd.error) {
        console.error('  · UPDATE error on ' + entry.filename + ' lesson ' + dbOrder + ': ' + upd.error.message);
        continue;
      }

      if (upd.data && upd.data.length > 0) {
        updated++;
      } else {
        // Either the lesson doesn't exist at that order_index, or content_text
        // was already non-NULL (.is filter excluded it). Distinguish so the
        // report makes sense.
        const probe = await sb
          .from('lessons')
          .select('id, content_text')
          .eq('module_id',   moduleId)
          .eq('order_index', dbOrder)
          .maybeSingle();

        if (!probe.data)                              lessonMissing++;
        else if (probe.data.content_text !== null)   alreadyHad++;
        else                                          lessonMissing++;
      }
    }
  }

  // ── Snapshot after ──────────────────────────────────────────────────────
  const after = await snapshot();

  console.log('');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('Updates this run: ' + updated);
  console.log('Skipped (already had content):  ' + alreadyHad);
  console.log('Skipped (no matching lesson):   ' + lessonMissing);
  console.log('Skipped (no matching module):   ' + moduleMissing);
  console.log('───────────────────────────────────────────────────────────────');
  console.log('After:   ' + after.populated + ' populated · ' + after.nul + ' NULL · ' + after.total + ' total lessons');
  console.log('Net change: +' + (after.populated - before.populated) + ' populated, -' + (before.nul - after.nul) + ' NULL');
  console.log('═══════════════════════════════════════════════════════════════');
})().catch((err) => {
  console.error('✗ Fatal:', err);
  process.exit(1);
});

async function snapshot() {
  const [{ count: total }, { count: populated }, { count: nul }] = await Promise.all([
    sb.from('lessons').select('*', { count: 'exact', head: true }),
    sb.from('lessons').select('*', { count: 'exact', head: true }).not('content_text', 'is', null),
    sb.from('lessons').select('*', { count: 'exact', head: true }).is('content_text', null),
  ]);
  return { total, populated, nul };
}
