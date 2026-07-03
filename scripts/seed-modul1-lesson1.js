/**
 * DeutschWeg — Seed Modul 1, Lesson 1: Greetings (Begrüßungen)
 * =============================================================
 * Replaces ONLY Lesson 1 of the Greetings module. Lessons 2–6 are
 * untouched. The existing L1 ("Sie vs du") is backed up to
 * .seed-modul1-lesson1-backup.json before deletion.
 *
 * Safety pattern matches seed-modul3.js:
 *   - Title-based module lookup (no hard-coded order_index)
 *   - Abort guard if wrong module found
 *   - Pre-delete backup of ONLY the lesson being replaced
 *
 * Run:  node scripts/seed-modul1-lesson1.js
 *
 * Required .env:
 *   SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 */

'use strict';

const path = require('path');
const fs   = require('fs');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });

const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false, autoRefreshToken: false } }
);

// ── Lesson 1.1 content ────────────────────────────────────────────────────
// 8 screens, all using existing block types.
// pattern-table  — amber on the changing word
// text           — one-sentence rules
// table          — two-column formal/casual layout (Screen 4)
// clock-quiz     — pick-the-phrase (Screens 3 & 6), listening mode (Screen 7)

const LESSON = {
  order_index: 1,
  title: '1.1 — Greetings (Begrüßungen)',
  lernziel_intro: 'Learn 5 greetings from 2 patterns in under 7 minutes.',
  lernziel_completion: 'You can greet and say goodbye in German — for the right moment and the right person.',
  content_json: [

    // ── Screen 1: Pattern — "Guten ___" ──────────────────────────────────
    // Amber on the changing word only. "Guten" stays plain.
    // Learner sees: ONE frame + ONE swap = THREE greetings.
    {
      type: 'pattern-table',
      variant: 'suffix',
      label: 'Guten ___ — one word does the work',
      rows: [
        { stem: 'Guten ', change: 'Morgen', digits: '→ morning 🌅',  audio: 'Guten Morgen' },
        { stem: 'Guten ', change: 'Tag',    digits: '→ daytime ☀️',  audio: 'Guten Tag'    },
        { stem: 'Guten ', change: 'Abend',  digits: '→ evening 🌙',  audio: 'Guten Abend'  },
      ]
    },

    // ── Screen 2: Rule — exactly one sentence ─────────────────────────────
    {
      type: 'text',
      content: 'One word changes with the time of day — everything else stays the same.'
    },

    // ── Screen 3: Practice #1 — time of day → pick greeting ──────────────
    // clock-quiz pick-the-phrase. "time" field = emoji prompt.
    // 6 rounds, each emoji maps unambiguously to one greeting.
    {
      type: 'clock-quiz',
      style: 'emoji',
      variant: 'quiz',
      items: [
        {
          time: '🌅',
          sentence: 'Guten Morgen',
          audio: 'Guten Morgen',
          options: ['Guten Morgen', 'Guten Tag', 'Guten Abend']
        },
        {
          time: '☀️',
          sentence: 'Guten Tag',
          audio: 'Guten Tag',
          options: ['Guten Morgen', 'Guten Tag', 'Guten Abend']
        },
        {
          time: '🌙',
          sentence: 'Guten Abend',
          audio: 'Guten Abend',
          options: ['Guten Abend', 'Guten Tag', 'Guten Morgen']
        },
        {
          time: '🌅',
          sentence: 'Guten Morgen',
          audio: 'Guten Morgen',
          options: ['Guten Abend', 'Guten Morgen', 'Guten Tag']
        },
        {
          time: '☀️',
          sentence: 'Guten Tag',
          audio: 'Guten Tag',
          options: ['Guten Tag', 'Guten Morgen', 'Guten Abend']
        },
        {
          time: '🌙',
          sentence: 'Guten Abend',
          audio: 'Guten Abend',
          options: ['Guten Morgen', 'Guten Abend', 'Guten Tag']
        },
      ]
    },

    // ── Screen 4: Pattern — hello & goodbye, casual vs. polite ───────────
    // Two-column table. No "du/Sie" terminology — the columns carry the meaning.
    // Icons + 2 words max per header.
    {
      type: 'table',
      headers: ['🤝 With friends', '👔 Polite / official'],
      rows: [
        ['Hallo 🔊',       'Guten Tag 🔊'      ],
        ['Tschüss 🔊',     'Auf Wiedersehen 🔊' ],
      ]
    },

    // ── Screen 4b: Context line below the table ───────────────────────────
    // No grammar terminology. One plain sentence.
    {
      type: 'text',
      content: "Germans switch between two modes: relaxed with friends, polite with strangers and officials. You'll learn the full system later — for now, just pick the right column."
    },

    // ── Screen 5: Rule — exactly one sentence ─────────────────────────────
    {
      type: 'text',
      content: 'Two situations, two sets — pick the column that matches the moment.'
    },

    // ── Screen 6: Practice #2 — scenario → pick fitting phrase ───────────
    // Arrival AND departure cases so Tschüss/Auf Wiedersehen get practiced.
    {
      type: 'clock-quiz',
      style: 'scenario',
      variant: 'quiz',
      items: [
        {
          time: 'Your friend 🤝',
          sentence: 'Hallo',
          audio: 'Hallo',
          options: ['Hallo', 'Guten Tag', 'Auf Wiedersehen']
        },
        {
          time: "Doctor's office 🏥",
          sentence: 'Guten Tag',
          audio: 'Guten Tag',
          options: ['Hallo', 'Guten Tag', 'Tschüss']
        },
        {
          time: 'Leaving a friend 🤝',
          sentence: 'Tschüss',
          audio: 'Tschüss',
          options: ['Tschüss', 'Auf Wiedersehen', 'Hallo']
        },
        {
          time: 'Leaving the Amt 🏢',
          sentence: 'Auf Wiedersehen',
          audio: 'Auf Wiedersehen',
          options: ['Tschüss', 'Hallo', 'Auf Wiedersehen']
        },
        {
          time: 'New colleague 👔',
          sentence: 'Guten Tag',
          audio: 'Guten Tag',
          options: ['Guten Tag', 'Hallo', 'Tschüss']
        },
        {
          time: 'End of work call 📞',
          sentence: 'Auf Wiedersehen',
          audio: 'Auf Wiedersehen',
          options: ['Hallo', 'Auf Wiedersehen', 'Tschüss']
        },
      ]
    },

    // ── Screen 7: Practice #3 — train the ear ────────────────────────────
    // clock-quiz in listening mode: audio auto-plays, face = tap-to-replay.
    // Learner picks which greeting they heard from 4 options.
    // NOT type-what-you-hear — recognition is enough on day 1.
    {
      type: 'clock-quiz',
      mode: 'listening',
      variant: 'quiz',
      items: [
        {
          time: '🔊',
          sentence: 'Guten Morgen',
          audio: 'Guten Morgen',
          options: ['Guten Tag', 'Guten Morgen', 'Tschüss', 'Guten Abend']
        },
        {
          time: '🔊',
          sentence: 'Auf Wiedersehen',
          audio: 'Auf Wiedersehen',
          options: ['Hallo', 'Guten Tag', 'Auf Wiedersehen', 'Tschüss']
        },
        {
          time: '🔊',
          sentence: 'Tschüss',
          audio: 'Tschüss',
          options: ['Guten Abend', 'Auf Wiedersehen', 'Hallo', 'Tschüss']
        },
        {
          time: '🔊',
          sentence: 'Guten Abend',
          audio: 'Guten Abend',
          options: ['Guten Morgen', 'Guten Abend', 'Guten Tag', 'Hallo']
        },
      ]
    },

    // ── Screen 8: Completion moment ───────────────────────────────────────
    // Names the achievement + previews Lesson 2 + states time cost.
    // The module's existing "Next lesson →" navigation is the CTA.
    {
      type: 'intro',
      content: "Lesson 1 done — You just learned 5 greetings from 2 patterns. Next: introduce yourself — 'Ich heiße...' (5 min)"
    },

  ]
};

// ── Seed ─────────────────────────────────────────────────────────────────

async function run() {
  // 1. Find the Greetings module by title
  const { data: mods, error: modErr } = await supabase
    .from('modules')
    .select('id, title, order_index')
    .eq('level', 'A1')
    .order('order_index', { ascending: true });

  if (modErr) {
    console.error('✗ Could not query modules:', modErr.message);
    process.exit(1);
  }

  const mod = (mods || []).find(function(m) {
    return (m.title || '').toLowerCase().includes('greet');
  });

  if (!mod) {
    console.error('✗ Could not find a Greetings module in A1. Titles found:');
    (mods || []).forEach(function(m) { console.error('  oi:' + m.order_index + ' | ' + m.title); });
    process.exit(1);
  }

  console.log('✓ Target module confirmed:');
  console.log('    title:       ', mod.title);
  console.log('    order_index: ', mod.order_index);
  console.log('    id:          ', mod.id);
  console.log('');

  // Guard: refuse if matched module doesn't look like Greetings
  if (!/(greet|begrüß)/i.test(mod.title)) {
    console.error('✗ Safety check failed: matched module does not look like Greetings.');
    console.error('  Aborting without touching the database.');
    process.exit(1);
  }

  // 2. Find existing Lesson 1 specifically
  const { data: lessons, error: lErr } = await supabase
    .from('lessons')
    .select('id, order_index, title, content_json, lernziel_intro, lernziel_completion')
    .eq('module_id', mod.id)
    .order('order_index', { ascending: true });

  if (lErr) {
    console.error('✗ Could not fetch existing lessons:', lErr.message);
    process.exit(1);
  }

  console.log('Existing lessons in this module:');
  (lessons || []).forEach(function(l) {
    var blocks = Array.isArray(l.content_json) ? l.content_json.length : '?';
    console.log('  L' + l.order_index + ': ' + l.title + ' (' + blocks + ' blocks) id:' + l.id);
  });
  console.log('');

  const lesson1 = (lessons || []).find(function(l) { return l.order_index === 1; });

  if (!lesson1) {
    console.log('  No existing Lesson 1 found — clean insert.');
  } else {
    // 3. Back up Lesson 1 only (not the whole module)
    const backupPath = path.resolve(__dirname, '../.seed-modul1-lesson1-backup.json');
    fs.writeFileSync(backupPath, JSON.stringify({ module: mod, lesson: lesson1 }, null, 2));
    console.log('✓ Backed up existing L1 to .seed-modul1-lesson1-backup.json');
    console.log('  Title:', lesson1.title);
    console.log('  ID:   ', lesson1.id);
    console.log('  (L2–L' + (lessons.length) + ' untouched)');
    console.log('');

    // 4. Delete ONLY Lesson 1
    const { error: delErr } = await supabase
      .from('lessons')
      .delete()
      .eq('id', lesson1.id);

    if (delErr) {
      console.error('✗ Failed to delete existing L1:', delErr.message);
      process.exit(1);
    }
    console.log('  Deleted L1 (id:', lesson1.id + ')');
  }

  // 5. Insert new Lesson 1.1
  const { error: insErr } = await supabase
    .from('lessons')
    .insert({
      module_id:           mod.id,
      order_index:         LESSON.order_index,
      title:               LESSON.title,
      content_json:        LESSON.content_json,
      lernziel_intro:      LESSON.lernziel_intro,
      lernziel_completion: LESSON.lernziel_completion,
    });

  if (insErr) {
    console.error('✗ Failed to insert new Lesson 1.1:', insErr.message);
    console.error('  (Backup is at .seed-modul1-lesson1-backup.json — restore manually if needed)');
    process.exit(1);
  }

  console.log('✓ Inserted: L1 —', LESSON.title);
  console.log('  Blocks:', LESSON.content_json.length, '(screens 1–8)');
  console.log('');
  console.log('Done. Open the Greetings module in the dashboard to verify.');
  console.log('L2–L6 are untouched.');
}

run().catch(function(e) { console.error('Fatal:', e.message); process.exit(1); });
