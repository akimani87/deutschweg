/**
 * DeutschWeg — Seed Modul 1, Lesson 4: Beruf & Familie
 * ======================================================
 * Replaces existing L4 ("Asking about others") with the rebuilt design.
 * Backs up L4 before deletion. L1–L3 and L5–L6 untouched.
 *
 * Role colors used for the first time alongside --dw-change:
 *   subject (Ich) → --dw-subject (green)
 *   verb (bin / habe) → --dw-verb (pink-red)
 *   profession / status → --dw-change (amber)
 *
 * Run: node scripts/seed-modul1-l4.js
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

const LESSON = {
  order_index: 4,
  title: '1.4 — Job & Family (Beruf & Familie)',
  lernziel_intro: 'Say your job and family situation — the examiner asks exactly this.',
  lernziel_completion: 'You can introduce your profession and family in German.',
  content_json: [

    // Screen 1 — Pattern: Beruf
    // subject green, verb pink-red, profession amber, rest plain
    {
      type: 'pattern-table',
      variant: 'suffix',
      label: 'Ich bin ___ von Beruf',
      rows: [
        { subject: 'Ich', verb: ' bin', stem: ' ', change: 'Krankenschwester', rest: ' von Beruf.', digits: '→ nurse',        audio: 'Ich bin Krankenschwester von Beruf' },
        { subject: 'Ich', verb: ' bin', stem: ' ', change: 'Lehrer',           rest: ' von Beruf.', digits: '→ teacher',      audio: 'Ich bin Lehrer von Beruf'           },
        { subject: 'Ich', verb: ' bin', stem: ' ', change: 'Student',          rest: ' von Beruf.', digits: '→ student',      audio: 'Ich bin Student von Beruf'          },
        { subject: 'Ich', verb: ' bin', stem: ' ', change: 'Elektriker',       rest: ' von Beruf.', digits: '→ electrician',  audio: 'Ich bin Elektriker von Beruf'       },
        { subject: 'Ich', verb: ' bin', stem: ' ', change: 'Ärztin',           rest: ' von Beruf.', digits: '→ doctor (f)',   audio: 'Ich bin Ärztin von Beruf'           },
      ]
    },

    // Screen 2 — Rule: one sentence
    {
      type: 'text',
      content: 'Name your job: Ich bin ___ von Beruf. The profession is the only thing that changes.'
    },

    // Screen 3 — Pattern: Familie
    // Two verbs: bin (married/single) and habe (Kinder) — both pink-red
    {
      type: 'pattern-table',
      variant: 'suffix',
      label: 'Status & Kinder',
      rows: [
        { subject: 'Ich', verb: ' bin',  stem: ' ', change: 'verheiratet',  rest: '',            digits: '→ married',         audio: 'Ich bin verheiratet'         },
        { subject: 'Ich', verb: ' bin',  stem: ' ', change: 'ledig',        rest: '',            digits: '→ single',          audio: 'Ich bin ledig'               },
        { subject: 'Ich', verb: ' habe', stem: ' ', change: 'zwei Kinder',  rest: '',            digits: '→ 2 children',      audio: 'Ich habe zwei Kinder'        },
        { subject: 'Ich', verb: ' habe', stem: ' ', change: 'keine Kinder', rest: '',            digits: '→ no children',     audio: 'Ich habe keine Kinder'       },
        { subject: 'Ich', verb: ' habe', stem: ' ', change: 'ein Kind',     rest: '',            digits: '→ 1 child',         audio: 'Ich habe ein Kind'           },
      ]
    },

    // Screen 4 — Rule: one sentence
    {
      type: 'text',
      content: 'Two facts about family: your status (verheiratet / ledig) and whether you have Kinder.'
    },

    // Screen 5 — Practice: tile-assembly mixing Beruf and Familie
    {
      type: 'tile-assembly',
      prompt_label: 'Build the sentence',
      rounds: [
        {
          prompt: 'Say: I am a nurse by profession',
          tiles: ['Ich', 'bin', 'Krankenschwester', 'von Beruf', 'habe', 'Lehrer'],
          answer: ['Ich', 'bin', 'Krankenschwester', 'von Beruf'],
          audio: 'Ich bin Krankenschwester von Beruf'
        },
        {
          prompt: 'Say: I am married',
          tiles: ['Ich', 'bin', 'verheiratet', 'habe', 'ledig', 'von Beruf'],
          answer: ['Ich', 'bin', 'verheiratet'],
          audio: 'Ich bin verheiratet'
        },
        {
          prompt: 'Say: I have two children',
          tiles: ['Ich', 'habe', 'zwei Kinder', 'bin', 'keine Kinder', 'von Beruf'],
          answer: ['Ich', 'habe', 'zwei Kinder'],
          audio: 'Ich habe zwei Kinder'
        },
        {
          prompt: 'Say: I am a teacher by profession',
          tiles: ['Ich', 'bin', 'Lehrer', 'von Beruf', 'habe', 'Student'],
          answer: ['Ich', 'bin', 'Lehrer', 'von Beruf'],
          audio: 'Ich bin Lehrer von Beruf'
        },
        {
          prompt: 'Say: I am single',
          tiles: ['Ich', 'bin', 'ledig', 'habe', 'verheiratet', 'von Beruf'],
          answer: ['Ich', 'bin', 'ledig'],
          audio: 'Ich bin ledig'
        },
        {
          prompt: 'Say: I have no children',
          tiles: ['Ich', 'habe', 'keine Kinder', 'bin', 'zwei Kinder', 'ein Kind'],
          answer: ['Ich', 'habe', 'keine Kinder'],
          audio: 'Ich habe keine Kinder'
        },
        {
          prompt: 'Say: I am a student by profession',
          tiles: ['Ich', 'bin', 'Student', 'von Beruf', 'habe', 'Elektriker'],
          answer: ['Ich', 'bin', 'Student', 'von Beruf'],
          audio: 'Ich bin Student von Beruf'
        },
        {
          prompt: 'Say: I have one child',
          tiles: ['Ich', 'habe', 'ein Kind', 'bin', 'zwei Kinder', 'von Beruf'],
          answer: ['Ich', 'habe', 'ein Kind'],
          audio: 'Ich habe ein Kind'
        },
      ]
    },

    // Screen 6 — Completion
    {
      type: 'intro',
      content: "You can introduce your work and family — the examiner asks exactly this. Next: why you're learning German (5 min)."
    },
  ]
};

async function run() {
  const { data: mods, error: modErr } = await supabase
    .from('modules').select('id, title, order_index').eq('level', 'A1').order('order_index', { ascending: true });

  if (modErr) { console.error('✗ modules query failed:', modErr.message); process.exit(1); }

  const mod = (mods || []).find(function(m) { return (m.title || '').toLowerCase().includes('greet'); });
  if (!mod || !/(greet|begrüß)/i.test(mod.title)) {
    console.error('✗ Safety abort — Greetings module not found'); process.exit(1);
  }
  console.log('✓ Module:', mod.title, '| id:', mod.id, '\n');

  const { data: existing } = await supabase
    .from('lessons').select('id, order_index, title, content_json, lernziel_intro, lernziel_completion')
    .eq('module_id', mod.id).eq('order_index', LESSON.order_index).maybeSingle();

  if (existing) {
    const backupFile = path.resolve(__dirname, '../.seed-modul1-l4-backup.json');
    fs.writeFileSync(backupFile, JSON.stringify({ module: mod, lesson: existing }, null, 2));
    console.log('  Backed up to .seed-modul1-l4-backup.json');
    console.log('  Previous title:', existing.title);

    const { error: delErr } = await supabase.from('lessons').delete().eq('id', existing.id);
    if (delErr) { console.error('  ✗ Delete failed:', delErr.message); process.exit(1); }
    console.log('  Deleted L4\n');
  } else {
    console.log('  No existing L4 — clean insert\n');
  }

  const { error: insErr } = await supabase.from('lessons').insert({
    module_id:           mod.id,
    order_index:         LESSON.order_index,
    title:               LESSON.title,
    content_json:        LESSON.content_json,
    lernziel_intro:      LESSON.lernziel_intro,
    lernziel_completion: LESSON.lernziel_completion,
  });

  if (insErr) { console.error('✗ Insert failed:', insErr.message); process.exit(1); }
  console.log('✓ Inserted:', LESSON.title, '(' + LESSON.content_json.length + ' blocks)');
  console.log('  L1–L3 and L5–L6 untouched.');
}

run().catch(function(e) { console.error('Fatal:', e.message); process.exit(1); });
