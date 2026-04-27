/**
 * DeutschWeg — seed Supabase from supabase-data/all-modules.json
 *
 * Reads the extracted module JSON, inserts modules → lessons → lesson_exercises
 * using the service role key (bypasses RLS).
 *
 * Run:
 *   node scripts/seed-modules.js          # aborts if the modules table already has rows
 *   node scripts/seed-modules.js --force  # seed anyway (will create duplicates)
 *
 * Required .env entries:
 *   SUPABASE_URL=https://<project>.supabase.co
 *   SUPABASE_SERVICE_ROLE_KEY=<service role key, NOT the anon key>
 *
 * Run the migration in supabase/migrations/0002_modules.sql before seeding.
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

const FORCE = process.argv.includes('--force');

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const DATA_PATH = path.resolve(__dirname, '..', 'supabase-data', 'all-modules.json');

// Lessons store content as a string in the JSON; the schema column is jsonb.
// Wrap strings in { text: ... } so the column always holds valid JSON.
function toContentJson(content) {
  if (content === null || content === undefined) return null;
  if (typeof content === 'string') return { text: content };
  return content;
}

async function preflight() {
  const { count, error } = await supabase
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

  if (count && count > 0 && !FORCE) {
    console.error(`✗ modules already has ${count} rows. Pass --force to seed anyway (will duplicate).`);
    process.exit(1);
  }
}

async function seedModule(m, idx, total) {
  const label = `[${String(idx + 1).padStart(2, '0')}/${total}] ${m.level} · ${m.title || m.slug || '(untitled)'}`;
  process.stdout.write(label.padEnd(64, ' ') + '… ');

  const { data: insertedModule, error: modErr } = await supabase
    .from('modules')
    .insert({
      level:        m.level,
      title:        m.title || m.slug || 'Untitled',
      order_index:  m.order_index,
      description:  m.description || null,
      icon:         null,
      is_published: true,
    })
    .select('id')
    .single();

  if (modErr) {
    console.log('FAIL');
    console.error(`  module insert error: ${modErr.message}`);
    return { lessons: 0, exercises: 0, warnings: 1, failed: true };
  }

  const moduleId = insertedModule.id;
  const lessons  = Array.isArray(m.lessons) ? m.lessons : [];

  let lessonCount   = 0;
  let exerciseCount = 0;
  let warnings      = 0;

  for (const l of lessons) {
    const { data: insertedLesson, error: lessonErr } = await supabase
      .from('lessons')
      .insert({
        module_id:    moduleId,
        title:        l.title || null,
        order_index:  l.order_index,
        content_json: toContentJson(l.content),
      })
      .select('id')
      .single();

    if (lessonErr) {
      warnings++;
      console.log('');
      console.error(`  lesson insert error (order ${l.order_index}): ${lessonErr.message}`);
      continue;
    }

    lessonCount++;
    const lessonId  = insertedLesson.id;
    const exercises = Array.isArray(l.exercises) ? l.exercises : [];

    // Batch-insert exercises per lesson (one round-trip instead of N).
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

      const { error: exErr } = await supabase
        .from('lesson_exercises')
        .insert(rows);

      if (exErr) {
        warnings++;
        console.log('');
        console.error(`  exercise batch insert error (lesson order ${l.order_index}): ${exErr.message}`);
      } else {
        exerciseCount += rows.length;
      }
    }
  }

  console.log(`OK (${lessonCount} lessons, ${exerciseCount} exercises${warnings ? `, ${warnings} warnings` : ''})`);
  return { lessons: lessonCount, exercises: exerciseCount, warnings, failed: false };
}

async function main() {
  console.log(`Reading ${DATA_PATH}…`);

  if (!fs.existsSync(DATA_PATH)) {
    console.error(`✗ ${DATA_PATH} not found.`);
    process.exit(1);
  }

  const modules = JSON.parse(fs.readFileSync(DATA_PATH, 'utf-8'));
  console.log(`Loaded ${modules.length} modules.\n`);

  await preflight();

  let totalLessons   = 0;
  let totalExercises = 0;
  let totalWarnings  = 0;
  let failed         = 0;

  for (let i = 0; i < modules.length; i++) {
    const r = await seedModule(modules[i], i, modules.length);
    totalLessons   += r.lessons;
    totalExercises += r.exercises;
    totalWarnings  += r.warnings;
    if (r.failed) failed++;
  }

  console.log('');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log(`Seeded:    ${modules.length - failed} / ${modules.length} modules`);
  console.log(`           ${totalLessons} lessons`);
  console.log(`           ${totalExercises} exercises`);
  if (totalWarnings) console.log(`Warnings:  ${totalWarnings} (see logs above)`);
  if (failed)        console.log(`Failed:    ${failed} module(s) — see errors above`);
  console.log('═══════════════════════════════════════════════════════════════');
}

main().catch((err) => {
  console.error('✗ Fatal error:', err);
  process.exit(1);
});
