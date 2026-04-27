/**
 * DeutschWeg — seed Supabase from supabase-data/all-modules.json
 *
 * Idempotent: upserts at every level via the (level, order_index),
 * (module_id, order_index), and (lesson_id, order_index) unique indexes.
 * Re-runs replace the same rows — no duplicates.
 *
 * Run: node scripts/seed-modules.js
 *
 * Required .env entries:
 *   SUPABASE_URL=https://<project>.supabase.co
 *   SUPABASE_SERVICE_ROLE_KEY=<service role key, NOT the anon key>
 *
 * Run supabase/migrations/0002_modules.sql in the Supabase SQL editor first.
 */

const path = require('path');
const fs   = require('fs');

require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });

const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL              = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('✗ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const DATA_PATH = path.resolve(__dirname, '..', 'supabase-data', 'all-modules.json');

async function preflight() {
  const { error } = await supabase
    .from('modules')
    .select('*', { count: 'exact', head: true });

  if (error) {
    if (error.message && error.message.toLowerCase().includes('does not exist')) {
      console.error('✗ Table public.modules does not exist.');
      console.error('  Run supabase/migrations/0002_modules.sql in the Supabase SQL editor first.');
      process.exit(1);
    }
    console.error('✗ Could not query modules table:', error.message);
    process.exit(1);
  }
}

async function seedModule(m, idx, total) {
  const label = `[${String(idx + 1).padStart(2, '0')}/${total}] ${m.level} · ${m.title || m.slug || '(untitled)'}`;
  process.stdout.write(label.padEnd(64, ' ') + '… ');

  // ── module: upsert by (level, order_index) ─────────────────────────────
  const { data: insertedModule, error: modErr } = await supabase
    .from('modules')
    .upsert(
      {
        level:        m.level,
        title:        m.title || m.slug || 'Untitled',
        order_index:  m.order_index,
        description:  m.description || null,
        icon:         null,
        is_published: true,
        mini_test_id: m.mini_test_id || null,
      },
      { onConflict: 'level,order_index' }
    )
    .select('id')
    .single();

  if (modErr) {
    console.log('FAIL');
    console.error(`  module upsert error: ${modErr.message}`);
    return { moduleOk: false, lessons: 0, exercises: 0, warnings: 1 };
  }

  const moduleId = insertedModule.id;
  const lessons  = Array.isArray(m.lessons) ? m.lessons : [];

  let lessonCount   = 0;
  let exerciseCount = 0;
  let warnings      = 0;

  for (const l of lessons) {
    // ── lesson: upsert by (module_id, order_index) ───────────────────────
    const contentText =
      typeof l.content === 'string' && l.content.length > 0 ? l.content : null;

    const { data: insertedLesson, error: lessonErr } = await supabase
      .from('lessons')
      .upsert(
        {
          module_id:    moduleId,
          title:        l.title || null,
          order_index:  l.order_index,
          content_text: contentText,
        },
        { onConflict: 'module_id,order_index' }
      )
      .select('id')
      .single();

    if (lessonErr) {
      warnings++;
      console.log('');
      console.error(`  lesson upsert error (order ${l.order_index}): ${lessonErr.message}`);
      continue;
    }

    lessonCount++;
    const lessonId  = insertedLesson.id;
    const exercises = Array.isArray(l.exercises) ? l.exercises : [];

    if (exercises.length > 0) {
      const rows = exercises.map((e, ei) => ({
        lesson_id:      lessonId,
        type:           e.type || 'multiple_choice',
        question:       e.question || '',
        options:        Array.isArray(e.options) ? e.options : null,
        correct_answer: e.correct_answer != null ? String(e.correct_answer) : null,
        explanation:    e.explanation || null,
        rule_hint:      e.rule_hint   || null,
        order_index:    ei + 1,
      }));

      // ── exercises: upsert by (lesson_id, order_index) ──────────────────
      const { error: exErr } = await supabase
        .from('lesson_exercises')
        .upsert(rows, { onConflict: 'lesson_id,order_index' });

      if (exErr) {
        warnings++;
        console.log('');
        console.error(`  exercise upsert error (lesson order ${l.order_index}): ${exErr.message}`);
      } else {
        exerciseCount += rows.length;
      }
    }
  }

  console.log(`OK (${lessonCount} lessons, ${exerciseCount} exercises${warnings ? `, ${warnings} warnings` : ''})`);
  return { moduleOk: true, lessons: lessonCount, exercises: exerciseCount, warnings };
}

async function main() {
  console.log(`Reading ${DATA_PATH}…`);

  if (!fs.existsSync(DATA_PATH)) {
    console.error(`✗ ${DATA_PATH} not found.`);
    process.exit(1);
  }

  const modules = JSON.parse(fs.readFileSync(DATA_PATH, 'utf-8'));
  console.log(`Loaded ${modules.length} modules.\n`);

  // ── Normalise to level-relative order_index + derive mini_test_id ──────
  // The source JSON numbers modules globally (A1: 1-13, A2: 14-25, …).
  // The DB schema and the dashboard use level-relative numbering (each level
  // restarts at 1), and mini_test_id follows the file naming convention
  // 'mini-test-<level>-<n>.html' except for mock-exam modules which have no
  // Quick Test (NULL).
  const isMockExam = (m) =>
    /mock\s*-?\s*exam|prüfungssimulation/i.test(
      (m.slug || '') + ' ' + (m.filename || '') + ' ' + (m.title || '')
    );

  const byLevel = {};
  modules.forEach((m) => { (byLevel[m.level] = byLevel[m.level] || []).push(m); });
  Object.keys(byLevel).forEach((level) => {
    byLevel[level].sort((a, b) => (a.order_index || 0) - (b.order_index || 0));
    byLevel[level].forEach((m, i) => {
      m.order_index  = i + 1;
      m.mini_test_id = isMockExam(m)
        ? null
        : `mini-test-${level.toLowerCase()}-${i + 1}.html`;
    });
  });

  await preflight();

  let totalModules   = 0;
  let totalLessons   = 0;
  let totalExercises = 0;
  let totalWarnings  = 0;

  for (let i = 0; i < modules.length; i++) {
    const r = await seedModule(modules[i], i, modules.length);
    if (r.moduleOk) totalModules++;
    totalLessons   += r.lessons;
    totalExercises += r.exercises;
    totalWarnings  += r.warnings;
  }

  // Final counts straight from the database — authoritative.
  const [{ count: dbModules }, { count: dbLessons }, { count: dbExercises }] = await Promise.all([
    supabase.from('modules').select('*',          { count: 'exact', head: true }),
    supabase.from('lessons').select('*',          { count: 'exact', head: true }),
    supabase.from('lesson_exercises').select('*', { count: 'exact', head: true }),
  ]);

  console.log('');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log(`Upserted this run: ${totalModules} modules, ${totalLessons} lessons, ${totalExercises} exercises`);
  console.log(`Database totals:   ${dbModules} modules, ${dbLessons} lessons, ${dbExercises} exercises`);
  if (totalWarnings) console.log(`Warnings:          ${totalWarnings} (see logs above)`);
  console.log('═══════════════════════════════════════════════════════════════');
}

main().catch((err) => {
  console.error('✗ Fatal error:', err);
  process.exit(1);
});
