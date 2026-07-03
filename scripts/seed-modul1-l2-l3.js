/**
 * DeutschWeg — Seed Modul 1, Lessons 2 & 3
 * ==========================================
 * L2: "Ich heiße..." — introducing yourself (Design A)
 * L3: "Ich komme aus / Ich wohne in..." — origin + living (Design B)
 *
 * Replaces existing L2 (old Greetings duplicate) and L3 (old full
 * Goethe Sprechen script). Both are backed up before deletion.
 * L1, L4, L5, L6 are untouched.
 *
 * Audio: all German phrases are standard ElevenLabs-compatible strings —
 * no special characters beyond ß/ä/ö/ü which the model handles correctly.
 * Audio is generated on-demand via /api/tts; no pre-built files needed.
 *
 * Run: node scripts/seed-modul1-l2-l3.js
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

// ── Lesson content ────────────────────────────────────────────────────────

const LESSONS = [

  // ─── L2: "Ich heiße..." ───────────────────────────────────────────────
  {
    order_index: 2,
    title: '1.2 — Introducing yourself (Ich heiße)',
    lernziel_intro: 'Learn to say your name — and ask for someone else\'s.',
    lernziel_completion: 'You can introduce yourself and ask someone\'s name in both casual and polite German.',
    content_json: [

      // Screen 1 — Pattern: heißen conjugation with role colors
      // subject → dw-subject (green); ending → dw-change (amber); stem plain
      {
        type: 'pattern-table',
        variant: 'suffix',
        label: 'The ending follows the person',
        rows: [
          { subject: 'Ich',  stem: ' heiß', change: 'e',  rest: ' Anna.',       digits: '→ I',            audio: 'Ich heiße Anna'       },
          { subject: 'Du',   stem: ' heiß', change: 't',  rest: ' Tom.',        digits: '→ you (friend)', audio: 'Du heißt Tom'         },
          { subject: 'Sie',  stem: ' heiß', change: 'en', rest: ' Frau Weber.', digits: '→ you (polite)', audio: 'Sie heißen Frau Weber' },
        ]
      },

      // Screen 2 — Rule: one sentence
      {
        type: 'text',
        content: 'The ending follows the person — that\'s the whole trick.'
      },

      // Screen 3 — Practice: tile-assembly — build own-name sentences
      {
        type: 'tile-assembly',
        prompt_label: 'Build the sentence',
        rounds: [
          { prompt: 'Say: I am called Kwame',    tiles: ['Ich', 'heiße', 'Du', 'heißt', 'Kwame', 'Anna'],        answer: ['Ich', 'heiße', 'Kwame'],          audio: 'Ich heiße Kwame'       },
          { prompt: 'Say: You are called Anna',   tiles: ['Du', 'heißt', 'Ich', 'heiße', 'Anna', 'heiße'],        answer: ['Du', 'heißt', 'Anna'],            audio: 'Du heißt Anna'         },
          { prompt: 'Say: I am called Priya',     tiles: ['Ich', 'heiße', 'Sie', 'heißen', 'Priya', 'heißt'],     answer: ['Ich', 'heiße', 'Priya'],          audio: 'Ich heiße Priya'       },
          { prompt: 'Say: You are called Weber (polite)', tiles: ['Sie', 'heißen', 'Du', 'heißt', 'Weber', 'Ich'], answer: ['Sie', 'heißen', 'Weber'],         audio: 'Sie heißen Weber'      },
          { prompt: 'Say: I am called Dilan',     tiles: ['Ich', 'heiße', 'Du', 'heißt', 'Dilan', 'Sie'],         answer: ['Ich', 'heiße', 'Dilan'],          audio: 'Ich heiße Dilan'       },
          { prompt: 'Say: You are called Amina',  tiles: ['Du', 'heißt', 'Ich', 'heiße', 'Amina', 'heißen'],      answer: ['Du', 'heißt', 'Amina'],           audio: 'Du heißt Amina'        },
        ]
      },

      // Screen 4 — Pattern: asking the name (casual vs polite)
      // Amber on the changing ending (t / en), plain stem
      {
        type: 'pattern-table',
        variant: 'suffix',
        label: 'Asking the name — pick the right mode',
        rows: [
          { stem: 'Wie heiß', change: 't',  rest: ' du? 🤝',  digits: 'casual',        audio: 'Wie heißt du'   },
          { stem: 'Wie heiß', change: 'en', rest: ' Sie? 👔', digits: 'polite',         audio: 'Wie heißen Sie' },
        ]
      },
      {
        type: 'text',
        content: 'Same two modes as greetings — relaxed with friends, polite with strangers.'
      },

      // Screen 5 — Practice: scenario → pick the right question
      {
        type: 'clock-quiz',
        style: 'scenario',
        variant: 'quiz',
        items: [
          {
            time: 'New friend at a party 🤝',
            sentence: 'Wie heißt du?',
            audio: 'Wie heißt du',
            options: ['Wie heißen Sie?', 'Wie heißt du?', 'Ich heiße Kwame.']
          },
          {
            time: 'New colleague on first day 👔',
            sentence: 'Wie heißen Sie?',
            audio: 'Wie heißen Sie',
            options: ['Wie heißt du?', 'Ich heiße Priya.', 'Wie heißen Sie?']
          },
          {
            time: 'Doctor\'s receptionist 🏥',
            sentence: 'Wie heißen Sie?',
            audio: 'Wie heißen Sie',
            options: ['Wie heißen Sie?', 'Wie heißt du?', 'Du heißt Anna.']
          },
          {
            time: 'Classmate in a German course 🤝',
            sentence: 'Wie heißt du?',
            audio: 'Wie heißt du',
            options: ['Wie heißen Sie?', 'Wie heißt du?', 'Sie heißen Weber.']
          },
        ]
      },

      // Screen 6 — Completion
      {
        type: 'intro',
        content: "You can greet someone AND introduce yourself — a real first conversation. Next: where you're from and where you live (5 min)."
      },
    ]
  },

  // ─── L3: "Ich komme aus / Ich wohne in..." ───────────────────────────
  {
    order_index: 3,
    title: '1.3 — Origin & Home (komme aus / wohne in)',
    lernziel_intro: 'Say where you\'re from and where you live — two fixed frames, swap the place.',
    lernziel_completion: 'You can say your origin and current home in German, and understand the same questions from the examiner.',
    content_json: [

      // Screen 1 — Pattern: two fixed frames, amber on verb+preposition chunk
      {
        type: 'pattern-table',
        variant: 'suffix',
        label: 'Two frames — swap the place',
        rows: [
          { stem: 'Ich ', change: 'komme aus', rest: ' Kenia.',   digits: '→ origin (from)', audio: 'Ich komme aus Kenia'   },
          { stem: 'Ich ', change: 'komme aus', rest: ' Lagos.',   digits: '',                audio: 'Ich komme aus Lagos'   },
          { stem: 'Ich ', change: 'komme aus', rest: ' Mumbai.',  digits: '',                audio: 'Ich komme aus Mumbai'  },
          { stem: 'Ich ', change: 'wohne in',  rest: ' Berlin.',  digits: '→ living (now)',  audio: 'Ich wohne in Berlin'   },
          { stem: 'Ich ', change: 'wohne in',  rest: ' Frankfurt.',digits: '',               audio: 'Ich wohne in Frankfurt' },
          { stem: 'Ich ', change: 'wohne in',  rest: ' Colombo.', digits: '',               audio: 'Ich wohne in Colombo'  },
        ]
      },

      // Screen 2 — Rule: one sentence
      {
        type: 'text',
        content: 'Two frames — komme aus for origin, wohne in for now. Swap the place, done.'
      },

      // Screen 3 — Practice: tile-assembly both frame types
      {
        type: 'tile-assembly',
        prompt_label: 'Build the sentence',
        rounds: [
          { prompt: 'Say: I come from Nairobi',    tiles: ['Ich', 'komme aus', 'wohne in', 'Nairobi', 'Berlin'],      answer: ['Ich', 'komme aus', 'Nairobi'],    audio: 'Ich komme aus Nairobi'   },
          { prompt: 'Say: I live in Berlin',        tiles: ['Ich', 'wohne in', 'komme aus', 'Berlin', 'Kenia'],        answer: ['Ich', 'wohne in', 'Berlin'],      audio: 'Ich wohne in Berlin'     },
          { prompt: 'Say: I come from Nigeria',     tiles: ['Ich', 'komme aus', 'wohne in', 'Nigeria', 'Frankfurt'],   answer: ['Ich', 'komme aus', 'Nigeria'],    audio: 'Ich komme aus Nigeria'   },
          { prompt: 'Say: I live in Frankfurt',     tiles: ['Ich', 'wohne in', 'komme aus', 'Frankfurt', 'Mumbai'],    answer: ['Ich', 'wohne in', 'Frankfurt'],   audio: 'Ich wohne in Frankfurt'  },
          { prompt: 'Say: I come from Sri Lanka',   tiles: ['Ich', 'komme aus', 'wohne in', 'Sri Lanka', 'Köln'],      answer: ['Ich', 'komme aus', 'Sri Lanka'],  audio: 'Ich komme aus Sri Lanka' },
          { prompt: 'Say: I live in Cologne',       tiles: ['Ich', 'wohne in', 'komme aus', 'Köln', 'Ghana'],          answer: ['Ich', 'wohne in', 'Köln'],        audio: 'Ich wohne in Köln'       },
        ]
      },

      // Screen 4 — Pattern: question forms
      // Amber on Woher / Wo (the question word is what changes)
      {
        type: 'pattern-table',
        variant: 'suffix',
        label: 'Asking origin and home',
        rows: [
          { stem: '', change: 'Woher', rest: ' kommst du?',  digits: '→ from where?', audio: 'Woher kommst du'  },
          { stem: '', change: 'Wo',    rest: ' wohnst du?',  digits: '→ where?',      audio: 'Wo wohnst du'     },
          { stem: '', change: 'Woher', rest: ' kommen Sie?', digits: '(polite)',       audio: 'Woher kommen Sie' },
          { stem: '', change: 'Wo',    rest: ' wohnen Sie?', digits: '(polite)',       audio: 'Wo wohnen Sie'    },
        ]
      },

      // Screen 5 — Practice: listening — hear question → pick matching answer
      {
        type: 'clock-quiz',
        mode: 'listening',
        variant: 'quiz',
        items: [
          {
            time: '🔊',
            sentence: 'Ich komme aus Kenia.',
            audio: 'Woher kommst du',
            options: ['Ich komme aus Kenia.', 'Ich wohne in Berlin.', 'Ich heiße Anna.']
          },
          {
            time: '🔊',
            sentence: 'Ich wohne in Frankfurt.',
            audio: 'Wo wohnst du',
            options: ['Ich komme aus Nigeria.', 'Ich wohne in Frankfurt.', 'Guten Tag.']
          },
          {
            time: '🔊',
            sentence: 'Ich komme aus Mumbai.',
            audio: 'Woher kommen Sie',
            options: ['Ich wohne in Köln.', 'Ich heiße Priya.', 'Ich komme aus Mumbai.']
          },
          {
            time: '🔊',
            sentence: 'Ich wohne in Berlin.',
            audio: 'Wo wohnen Sie',
            options: ['Ich wohne in Berlin.', 'Ich komme aus Sri Lanka.', 'Auf Wiedersehen.']
          },
        ]
      },

      // Screen 6 — Completion
      {
        type: 'intro',
        content: "You can say who you are, where you're from, and where you live. Next: your job and family (5 min)."
      },
    ]
  }

];

// ── Seed ─────────────────────────────────────────────────────────────────

async function run() {
  // 1. Find module
  const { data: mods, error: modErr } = await supabase
    .from('modules').select('id, title, order_index').eq('level', 'A1').order('order_index', { ascending: true });

  if (modErr) { console.error('✗ modules query failed:', modErr.message); process.exit(1); }

  const mod = (mods || []).find(function(m) { return (m.title || '').toLowerCase().includes('greet'); });
  if (!mod) {
    console.error('✗ Greetings module not found. Titles:', (mods||[]).map(function(m){return m.title;}).join(', '));
    process.exit(1);
  }
  if (!/(greet|begrüß)/i.test(mod.title)) {
    console.error('✗ Safety abort — matched module is not Greetings:', mod.title);
    process.exit(1);
  }

  console.log('✓ Module:', mod.title, '| oi:' + mod.order_index, '| id:', mod.id, '\n');

  // 2. Process each lesson
  for (const lesson of LESSONS) {
    console.log('── L' + lesson.order_index + ': ' + lesson.title + ' ──');

    // Fetch current lesson at this order_index
    const { data: existing } = await supabase
      .from('lessons').select('id, order_index, title, content_json, lernziel_intro, lernziel_completion')
      .eq('module_id', mod.id).eq('order_index', lesson.order_index).maybeSingle();

    if (existing) {
      // Backup
      const backupFile = path.resolve(__dirname, '../.seed-modul1-l' + lesson.order_index + '-backup.json');
      fs.writeFileSync(backupFile, JSON.stringify({ module: mod, lesson: existing }, null, 2));
      console.log('  Backed up to .seed-modul1-l' + lesson.order_index + '-backup.json');
      console.log('  Previous title:', existing.title, '| id:', existing.id);

      // Delete
      const { error: delErr } = await supabase.from('lessons').delete().eq('id', existing.id);
      if (delErr) { console.error('  ✗ Delete failed:', delErr.message); process.exit(1); }
      console.log('  Deleted L' + lesson.order_index);
    } else {
      console.log('  No existing lesson at order_index=' + lesson.order_index + ' — clean insert');
    }

    // Insert
    const { error: insErr } = await supabase.from('lessons').insert({
      module_id:           mod.id,
      order_index:         lesson.order_index,
      title:               lesson.title,
      content_json:        lesson.content_json,
      lernziel_intro:      lesson.lernziel_intro,
      lernziel_completion: lesson.lernziel_completion,
    });

    if (insErr) {
      console.error('  ✗ Insert failed:', insErr.message);
      process.exit(1);
    }
    console.log('  ✓ Inserted:', lesson.title, '(' + lesson.content_json.length + ' blocks)\n');
  }

  console.log('Done. L1 and L4–L6 untouched.');
}

run().catch(function(e) { console.error('Fatal:', e.message); process.exit(1); });
