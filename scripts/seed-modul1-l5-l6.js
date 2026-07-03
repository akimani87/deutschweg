/**
 * DeutschWeg — Seed Modul 1, Lessons 5 & 6
 * ==========================================
 * L5: Warum Deutsch + Polite phrases
 * L6: Wie geht's? + Module completion (full Goethe self-introduction)
 *
 * L5 replaces old L5 (Saying goodbye). Goodbye content now lives in L1.
 * L6 replaces old L6 (Polite phrases) and is the module completion screen.
 * L1–L4 untouched.
 *
 * New block type used in L6: 'dialogue' — module-completion mini-script
 * with per-line role colors (subject green, verb pink-red, change amber)
 * and per-line audio. Requires module.html to have the dialogue case in
 * renderContent() — ship the module.html change first.
 *
 * Run: node scripts/seed-modul1-l5-l6.js
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

const LESSONS = [

  // ─── L5: Warum Deutsch + Polite phrases ──────────────────────────────
  {
    order_index: 5,
    title: '1.5 — Why German + Polite Phrases',
    lernziel_intro: 'Say why you\'re learning German — and add the three polite phrases that make every interaction smoother.',
    lernziel_completion: 'You can state your reason for learning German using a fixed frame, and use Bitte, Danke, and Entschuldigung correctly.',
    content_json: [

      // Screen 1 — Pattern: Warum Deutsch fixed frames
      // subject green, verb pink-red, purpose slot amber
      {
        type: 'pattern-table',
        variant: 'suffix',
        label: 'Ich lerne Deutsch für ___',
        rows: [
          { subject: 'Ich', verb: ' lerne', stem: ' Deutsch für ', change: 'meine Arbeit',    digits: '→ my job',                audio: 'Ich lerne Deutsch für meine Arbeit'    },
          { subject: 'Ich', verb: ' lerne', stem: ' Deutsch für ', change: 'die Ausbildung',  digits: '→ vocational training',   audio: 'Ich lerne Deutsch für die Ausbildung'  },
          { subject: 'Ich', verb: ' lerne', stem: ' Deutsch für ', change: 'meine Familie',   digits: '→ my family',             audio: 'Ich lerne Deutsch für meine Familie'   },
          { subject: 'Ich', verb: ' lerne', stem: ' Deutsch für ', change: 'mein Studium',    digits: '→ my studies',            audio: 'Ich lerne Deutsch für mein Studium'    },
        ]
      },

      // Screen 2 — Rule: one sentence
      {
        type: 'text',
        content: 'Ich lerne Deutsch für ___ — pick your reason, keep the frame.'
      },

      // Screen 3 — Pattern: polite phrases + exam-ending line
      {
        type: 'table',
        headers: ['🇩🇪 German', 'When to use it'],
        rows: [
          ['Bitte',                       'please / here you go'],
          ['Danke / Danke schön',         'thank you / thanks very much'],
          ['Entschuldigung',              'excuse me / sorry'],
          ['Vielen Dank. Auf Wiedersehen!', 'end every Goethe exam with this ← important'],
        ]
      },

      // Screen 4 — Practice: tile-assembly — build Warum Deutsch sentences
      {
        type: 'tile-assembly',
        prompt_label: 'Build the sentence',
        rounds: [
          {
            prompt: 'Say: for my job',
            tiles: ['Ich', 'lerne', 'Deutsch für', 'meine Arbeit', 'meine Familie', 'mein Studium'],
            answer: ['Ich', 'lerne', 'Deutsch für', 'meine Arbeit'],
            audio: 'Ich lerne Deutsch für meine Arbeit'
          },
          {
            prompt: 'Say: for vocational training',
            tiles: ['Ich', 'lerne', 'Deutsch für', 'die Ausbildung', 'mein Studium', 'meine Arbeit'],
            answer: ['Ich', 'lerne', 'Deutsch für', 'die Ausbildung'],
            audio: 'Ich lerne Deutsch für die Ausbildung'
          },
          {
            prompt: 'Say: for my family',
            tiles: ['Ich', 'lerne', 'Deutsch für', 'meine Familie', 'die Ausbildung', 'meine Arbeit'],
            answer: ['Ich', 'lerne', 'Deutsch für', 'meine Familie'],
            audio: 'Ich lerne Deutsch für meine Familie'
          },
          {
            prompt: 'Say: for my studies',
            tiles: ['Ich', 'lerne', 'Deutsch für', 'mein Studium', 'meine Arbeit', 'meine Familie'],
            answer: ['Ich', 'lerne', 'Deutsch für', 'mein Studium'],
            audio: 'Ich lerne Deutsch für mein Studium'
          },
          {
            prompt: 'Say: for my job',
            tiles: ['Ich', 'lerne', 'Deutsch für', 'meine Arbeit', 'mein Studium', 'habe'],
            answer: ['Ich', 'lerne', 'Deutsch für', 'meine Arbeit'],
            audio: 'Ich lerne Deutsch für meine Arbeit'
          },
          {
            prompt: 'Say: for my family',
            tiles: ['Ich', 'lerne', 'Deutsch für', 'meine Familie', 'die Ausbildung', 'bin'],
            answer: ['Ich', 'lerne', 'Deutsch für', 'meine Familie'],
            audio: 'Ich lerne Deutsch für meine Familie'
          },
        ]
      },

      // Screen 5 — Completion
      {
        type: 'intro',
        content: "You now have all six pieces of the Goethe self-introduction. Next: see them work together as a complete script (5 min)."
      },
    ]
  },

  // ─── L6: Wie geht's? + Module completion ─────────────────────────────
  {
    order_index: 6,
    title: '1.6 — How are you? + Module Complete',
    lernziel_intro: 'Learn the Wie geht\'s? question and scale of answers — then see your full Goethe self-introduction come together.',
    lernziel_completion: 'You can ask and answer "How are you?" and deliver a complete 6-topic Goethe A1 self-introduction.',
    content_json: [

      // Screen 1 — Pattern: the answer scale
      // Emoji in stem, mood phrase in amber — scale order conveys meaning
      {
        type: 'pattern-table',
        variant: 'suffix',
        label: 'How you\'re doing — four answers on a scale',
        rows: [
          { stem: '😄  ', change: 'Sehr gut!',    digits: '→ very good',  audio: 'Sehr gut'        },
          { stem: '🙂  ', change: 'Gut.',          digits: '→ good',       audio: 'Gut'             },
          { stem: '😐  ', change: 'Es geht.',      digits: '→ okay / so-so', audio: 'Es geht'      },
          { stem: '😕  ', change: 'Nicht so gut.', digits: '→ not great',  audio: 'Nicht so gut'   },
        ]
      },

      // Screen 2 — Rule: one sentence
      {
        type: 'text',
        content: 'One question, four answers on a scale — point at how you feel.'
      },

      // Screen 3 — Pattern: casual vs polite question
      // Amber highlights what changes between the two versions
      {
        type: 'pattern-table',
        variant: 'suffix',
        label: 'Asking — pick the right mode',
        rows: [
          { stem: 'Wie geht', change: "'s?",        rest: '  🤝', digits: 'casual',  audio: 'Wie geht es dir'   },
          { stem: 'Wie geht ', change: 'es Ihnen?', rest: '  👔', digits: 'polite',  audio: 'Wie geht es Ihnen' },
        ]
      },

      // Screen 4 — Practice: emoji mood → answer; situation → question
      {
        type: 'clock-quiz',
        style: 'scenario',
        variant: 'quiz',
        items: [
          {
            time: '😄',
            sentence: 'Sehr gut!',
            audio: 'Sehr gut',
            options: ['Sehr gut!', 'Es geht.', 'Nicht so gut.']
          },
          {
            time: '😕',
            sentence: 'Nicht so gut.',
            audio: 'Nicht so gut',
            options: ['Gut.', 'Sehr gut!', 'Nicht so gut.']
          },
          {
            time: '😐',
            sentence: 'Es geht.',
            audio: 'Es geht',
            options: ['Sehr gut!', 'Es geht.', 'Gut.']
          },
          {
            time: '😄',
            sentence: 'Sehr gut!',
            audio: 'Sehr gut',
            options: ['Nicht so gut.', 'Es geht.', 'Sehr gut!']
          },
          {
            time: 'New colleague at work 👔',
            sentence: 'Wie geht es Ihnen?',
            audio: 'Wie geht es Ihnen',
            options: ["Wie geht's?", 'Wie geht es Ihnen?', 'Sehr gut!']
          },
          {
            time: 'Your friend at lunch 🤝',
            sentence: "Wie geht's?",
            audio: 'Wie geht es dir',
            options: ["Wie geht's?", 'Wie geht es Ihnen?', 'Nicht so gut.']
          },
        ]
      },

      // Screen 5 — Practice: listen to answer → pick matching emoji
      {
        type: 'clock-quiz',
        mode: 'listening',
        variant: 'quiz',
        items: [
          {
            time: '🔊',
            sentence: '😄 Sehr gut!',
            audio: 'Sehr gut',
            options: ['😄 Sehr gut!', '🙂 Gut.', '😕 Nicht so gut.', '😐 Es geht.']
          },
          {
            time: '🔊',
            sentence: '😕 Nicht so gut.',
            audio: 'Nicht so gut',
            options: ['😄 Sehr gut!', '🙂 Gut.', '😐 Es geht.', '😕 Nicht so gut.']
          },
          {
            time: '🔊',
            sentence: '😐 Es geht.',
            audio: 'Es geht',
            options: ['😕 Nicht so gut.', '😐 Es geht.', '😄 Sehr gut!', '🙂 Gut.']
          },
          {
            time: '🔊',
            sentence: '🙂 Gut.',
            audio: 'Gut',
            options: ['🙂 Gut.', '😄 Sehr gut!', '😕 Nicht so gut.', '😐 Es geht.']
          },
        ]
      },

      // Screen 6 — Module completion dialogue
      // Full 6-topic Goethe self-introduction with role colors + audio per line.
      // subject green (Ich), verb pink-red (bin/heiße/komme/etc), change amber
      {
        type: 'dialogue',
        label: 'Modul 1 complete — this is the Goethe A1 self-introduction you just built:',
        lines: [
          {
            stem: 'Guten Tag!',
            audio: 'Guten Tag'
          },
          {
            subject: 'Ich',  verb: ' heiße',     change: ' Amina',              rest: '.',
            audio: 'Ich heiße Amina'
          },
          {
            subject: 'Ich',  verb: ' komme aus',  change: ' Nairobi',            rest: '.',
            audio: 'Ich komme aus Nairobi'
          },
          {
            subject: 'Ich',  verb: ' wohne in',   change: ' Berlin',             rest: '.',
            audio: 'Ich wohne in Berlin'
          },
          {
            subject: 'Ich',  verb: ' bin',         change: ' Krankenschwester',   rest: ' von Beruf.',
            audio: 'Ich bin Krankenschwester von Beruf'
          },
          {
            subject: 'Ich',  verb: ' habe',        change: ' zwei Kinder',        rest: '.',
            audio: 'Ich habe zwei Kinder'
          },
          {
            subject: 'Ich',  verb: ' lerne',       stem: ' Deutsch für ',         change: 'meine Arbeit', rest: '.',
            audio: 'Ich lerne Deutsch für meine Arbeit'
          },
        ]
      },

      // Screen 7 — Completion
      {
        type: 'intro',
        content: "That's a real German exchange, and you built it in one module. Next: Modul 2 — sounds and pronunciation (15 min)."
      },
    ]
  }

];

// ── Seed ─────────────────────────────────────────────────────────────────

async function run() {
  const { data: mods, error: modErr } = await supabase
    .from('modules').select('id, title, order_index').eq('level', 'A1').order('order_index', { ascending: true });

  if (modErr) { console.error('✗ modules query failed:', modErr.message); process.exit(1); }

  const mod = (mods || []).find(function(m) { return (m.title || '').toLowerCase().includes('greet'); });
  if (!mod || !/(greet|begrüß)/i.test(mod.title)) {
    console.error('✗ Safety abort — Greetings module not found'); process.exit(1);
  }
  console.log('✓ Module:', mod.title, '| id:', mod.id, '\n');

  for (const lesson of LESSONS) {
    console.log('── L' + lesson.order_index + ': ' + lesson.title + ' ──');

    const { data: existing } = await supabase
      .from('lessons').select('id, order_index, title, content_json, lernziel_intro, lernziel_completion')
      .eq('module_id', mod.id).eq('order_index', lesson.order_index).maybeSingle();

    if (existing) {
      const backupFile = path.resolve(__dirname, '../.seed-modul1-l' + lesson.order_index + '-backup.json');
      fs.writeFileSync(backupFile, JSON.stringify({ module: mod, lesson: existing }, null, 2));
      console.log('  Backed up to .seed-modul1-l' + lesson.order_index + '-backup.json');
      console.log('  Previous title:', existing.title);
      const { error: delErr } = await supabase.from('lessons').delete().eq('id', existing.id);
      if (delErr) { console.error('  ✗ Delete failed:', delErr.message); process.exit(1); }
      console.log('  Deleted\n');
    } else {
      console.log('  No existing lesson — clean insert\n');
    }

    const { error: insErr } = await supabase.from('lessons').insert({
      module_id:           mod.id,
      order_index:         lesson.order_index,
      title:               lesson.title,
      content_json:        lesson.content_json,
      lernziel_intro:      lesson.lernziel_intro,
      lernziel_completion: lesson.lernziel_completion,
    });

    if (insErr) { console.error('  ✗ Insert failed:', insErr.message); process.exit(1); }
    console.log('  ✓ Inserted:', lesson.title, '(' + lesson.content_json.length + ' blocks)\n');
  }

  console.log('Done. L1–L4 untouched.');
}

run().catch(function(e) { console.error('Fatal:', e.message); process.exit(1); });
