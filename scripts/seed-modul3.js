/**
 * DeutschWeg — Seed Modul 3: Numbers & Time (lessons 3.1 – 3.4)
 * ==============================================================
 * Inserts (or replaces) the four Modul 3 lessons into Supabase.
 *
 * Pre-condition: the "Numbers, Time & Dates" module already exists in
 * the modules table (level='A1', order_index=2). This script finds it
 * by that key, deletes any existing lessons for that module, then inserts
 * the four new lessons in order.
 *
 * Block types used:  intro, pattern-table, tile-assembly, clock-quiz,
 *                    listening-input, text, audio
 * All block types are rendered by module.html's renderContent().
 *
 * Run:
 *   node scripts/seed-modul3.js
 *
 * Required .env:
 *   SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 */

'use strict';

const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });

const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false, autoRefreshToken: false } }
);

// ── Lesson content ────────────────────────────────────────────────────────

const LESSONS = [
  // ─── 3.1 Numbers 0–12 ────────────────────────────────────────────────
  {
    order_index: 1,
    title: '3.1 — Numbers 0–12',
    lernziel_intro: 'Learn the 13 numbers you just have to memorise — everything else is built from them.',
    lernziel_completion: 'You can recognise and say any number from 0 to 12.',
    content_json: [
      // Screen 1 — Pattern: number grid with audio (no explanation text)
      {
        type: 'pattern-table',
        variant: 'suffix',
        label: '0 – 12  (hear each one)',
        rows: [
          { stem: 'null',    change: '', digits: '0',  audio: 'null'    },
          { stem: 'eins',    change: '', digits: '1',  audio: 'eins'    },
          { stem: 'zwei',    change: '', digits: '2',  audio: 'zwei'    },
          { stem: 'drei',    change: '', digits: '3',  audio: 'drei'    },
          { stem: 'vier',    change: '', digits: '4',  audio: 'vier'    },
          { stem: 'fünf',    change: '', digits: '5',  audio: 'fünf'    },
          { stem: 'sechs',   change: '', digits: '6',  audio: 'sechs'   },
          { stem: 'sieben',  change: '', digits: '7',  audio: 'sieben'  },
          { stem: 'acht',    change: '', digits: '8',  audio: 'acht'    },
          { stem: 'neun',    change: '', digits: '9',  audio: 'neun'    },
          { stem: 'zehn',    change: '', digits: '10', audio: 'zehn'    },
          { stem: 'elf',     change: '', digits: '11', audio: 'elf'     },
          { stem: 'zwölf',   change: '', digits: '12', audio: 'zwölf'   },
        ]
      },
      // Screen 2 — Rule: exactly one line
      {
        type: 'text',
        content: 'These 13 numbers are the only ones you memorise — everything else is built from them.'
      },
    ]
  },

  // ─── 3.2 Numbers 13–99 ───────────────────────────────────────────────
  {
    order_index: 2,
    title: '3.2 — Numbers 13–99',
    lernziel_intro: 'See the pattern — then you can build any number from 13 to 99.',
    lernziel_completion: 'You can say and recognise any number from 13 to 99, including the und-reversal.',
    content_json: [
      // Screen 1 — Pattern: stem + suffix (amber on suffix)
      {
        type: 'pattern-table',
        variant: 'suffix',
        label: 'small number + ending = big number',
        rows: [
          { stem: 'drei',  change: 'zehn', digits: '3 → 13', audio: 'dreizehn'  },
          { stem: 'vier',  change: 'zehn', digits: '4 → 14', audio: 'vierzehn'  },
          { stem: 'fünf',  change: 'zehn', digits: '5 → 15', audio: 'fünfzehn'  },
          { stem: 'sechs', change: 'zehn', digits: '6 → 16', audio: 'sechzehn'  },
          { stem: 'drei',  change: 'ßig',  digits: '3 → 30', audio: 'dreißig'   },
          { stem: 'vier',  change: 'zig',  digits: '4 → 40', audio: 'vierzig'   },
          { stem: 'fünf',  change: 'zig',  digits: '5 → 50', audio: 'fünfzig'   },
          { stem: 'sechs', change: 'zig',  digits: '6 → 60', audio: 'sechzig'   },
          { stem: 'sieb',  change: 'zig',  digits: '7 → 70', audio: 'siebzig'   },
          { stem: 'acht',  change: 'zig',  digits: '8 → 80', audio: 'achtzig'   },
          { stem: 'neun',  change: 'zig',  digits: '9 → 90', audio: 'neunzig'   },
        ]
      },
      // Screen 2 — Pattern: the und-reversal (amber on ones-digit)
      {
        type: 'pattern-table',
        variant: 'reversal',
        label: '21, 47 — German says it backwards',
        rows: [
          { change_part: 'ein',    connector: 'und', tens: 'zwanzig', ones_label: '1', tens_label: '20', equation: '= 21', audio: 'einundzwanzig'      },
          { change_part: 'sieben', connector: 'und', tens: 'vierzig', ones_label: '7', tens_label: '40', equation: '= 47', audio: 'siebenundvierzig'    },
          { change_part: 'drei',   connector: 'und', tens: 'sechzig', ones_label: '3', tens_label: '60', equation: '= 63', audio: 'dreiundsechzig'      },
        ],
        note: 'German says the small number first — then und — then the tens. Backwards from English. 100% consistent.'
      },
      // Screen 3 — Rule: exactly one sentence
      {
        type: 'text',
        content: 'German says the small number first: one-and-twenty. Yes, backwards — and 100% consistent.'
      },
      // Screen 4 — Practice: tile-assembly (build the compound number)
      {
        type: 'tile-assembly',
        rounds: [
          { prompt: '47', tiles: ['sieben', 'und', 'vierzig', 'dreißig', 'drei'],   answer: ['sieben', 'und', 'vierzig'],   audio: 'siebenundvierzig' },
          { prompt: '21', tiles: ['ein', 'und', 'zwanzig', 'dreißig', 'zwei'],       answer: ['ein', 'und', 'zwanzig'],      audio: 'einundzwanzig'    },
          { prompt: '63', tiles: ['drei', 'und', 'sechzig', 'sieben', 'dreißig'],    answer: ['drei', 'und', 'sechzig'],     audio: 'dreiundsechzig'   },
          { prompt: '85', tiles: ['fünf', 'und', 'achtzig', 'neun', 'sechzig'],      answer: ['fünf', 'und', 'achtzig'],     audio: 'fünfundachtzig'   },
          { prompt: '29', tiles: ['neun', 'und', 'zwanzig', 'sieben', 'achtzig'],    answer: ['neun', 'und', 'zwanzig'],     audio: 'neunundzwanzig'   },
          { prompt: '54', tiles: ['vier', 'und', 'fünfzig', 'sieben', 'sechzig'],    answer: ['vier', 'und', 'fünfzig'],     audio: 'vierundfünfzig'   },
          { prompt: '38', tiles: ['acht', 'und', 'dreißig', 'sieben', 'vierzig'],    answer: ['acht', 'und', 'dreißig'],     audio: 'achtunddreißig'   },
          { prompt: '71', tiles: ['ein', 'und', 'siebzig', 'acht', 'dreißig'],       answer: ['ein', 'und', 'siebzig'],      audio: 'einundsiebzig'    },
        ]
      },
      // Screen 5 — Listening practice: hear → type digits
      {
        type: 'listening-input',
        rounds: [
          { audio: 'siebenundvierzig',  answer: '47' },
          { audio: 'dreiundzwanzig',    answer: '23' },
          { audio: 'neunundachtzig',    answer: '89' },
          { audio: 'zweiundfünfzig',    answer: '52' },
          { audio: 'sechsundsechzig',   answer: '66' },
        ]
      }
    ]
  },

  // ─── 3.3 Official clock time (easy win) ──────────────────────────────
  {
    order_index: 3,
    title: '3.3 — Clock Time (Official)',
    lernziel_intro: 'Official German time is just two numbers and a word. If you know numbers, you already know this.',
    lernziel_completion: 'You can tell and understand official German time using the 24-hour format.',
    content_json: [
      // Screen 1 — Pattern: digital clock examples, no explanation
      {
        type: 'clock-quiz',
        style: 'digital',
        variant: 'pattern',
        items: [
          { time: '9:00',  sentence: 'Es ist 9 Uhr.',       audio: 'Es ist neun Uhr.'                },
          { time: '14:30', sentence: 'Es ist 14 Uhr 30.',   audio: 'Es ist vierzehn Uhr dreißig.'    },
          { time: '8:15',  sentence: 'Es ist 8 Uhr 15.',    audio: 'Es ist acht Uhr fünfzehn.'       },
          { time: '20:45', sentence: 'Es ist 20 Uhr 45.',   audio: 'Es ist zwanzig Uhr fünfundvierzig.' },
        ]
      },
      // Screen 2 — Rule: one sentence
      {
        type: 'text',
        content: 'Official time = number + Uhr + number. If you know numbers, you already know this.'
      },
      // Screen 3 — Practice: clock → pick sentence
      {
        type: 'clock-quiz',
        style: 'digital',
        variant: 'quiz',
        items: [
          {
            time: '14:30',
            sentence: 'Es ist 14 Uhr 30.',
            audio: 'Es ist vierzehn Uhr dreißig.',
            options: ['Es ist 4 Uhr 3.', 'Es ist 14 Uhr 30.', 'Es ist 40 Uhr 13.']
          },
          {
            time: '9:15',
            sentence: 'Es ist 9 Uhr 15.',
            audio: 'Es ist neun Uhr fünfzehn.',
            options: ['Es ist 15 Uhr 9.', 'Es ist 9 Uhr 50.', 'Es ist 9 Uhr 15.']
          },
          {
            time: '20:45',
            sentence: 'Es ist 20 Uhr 45.',
            audio: 'Es ist zwanzig Uhr fünfundvierzig.',
            options: ['Es ist 20 Uhr 45.', 'Es ist 2 Uhr 45.', 'Es ist 20 Uhr 54.']
          },
          {
            time: '8:00',
            sentence: 'Es ist 8 Uhr.',
            audio: 'Es ist acht Uhr.',
            options: ['Es ist 18 Uhr.', 'Es ist 8 Uhr 0.', 'Es ist 8 Uhr.']
          },
          {
            time: '13:22',
            sentence: 'Es ist 13 Uhr 22.',
            audio: 'Es ist dreizehn Uhr zweiundzwanzig.',
            options: ['Es ist 3 Uhr 22.', 'Es ist 13 Uhr 22.', 'Es ist 1 Uhr 32.']
          },
          {
            time: '17:50',
            sentence: 'Es ist 17 Uhr 50.',
            audio: 'Es ist siebzehn Uhr fünfzig.',
            options: ['Es ist 7 Uhr 15.', 'Es ist 17 Uhr 50.', 'Es ist 15 Uhr 7.']
          },
        ]
      }
    ]
  },

  // ─── 3.4 Spoken clock time: viertel & halb ───────────────────────────
  {
    order_index: 4,
    title: '3.4 — Clock Time (Spoken)',
    lernziel_intro: 'Spoken German time uses viertel, halb, and vor — and halb points FORWARD.',
    lernziel_completion: 'You can understand and use viertel nach, halb, and viertel vor correctly.',
    content_json: [
      // Screen 1 — Pattern: the three spoken-time phrases
      {
        type: 'pattern-table',
        variant: 'suffix',
        label: 'viertel · halb · vor',
        rows: [
          { stem: 'viertel nach ',  change: 'drei', digits: '3:15', audio: 'viertel nach drei'   },
          { stem: 'halb ',          change: 'vier',  digits: '3:30', audio: 'halb vier'           },
          { stem: 'viertel vor ',   change: 'vier',  digits: '3:45', audio: 'viertel vor vier'   },
          { stem: 'viertel nach ',  change: 'neun',  digits: '9:15', audio: 'viertel nach neun'  },
          { stem: 'halb ',          change: 'zehn',  digits: '9:30', audio: 'halb zehn'          },
          { stem: 'viertel vor ',   change: 'zehn',  digits: '9:45', audio: 'viertel vor zehn'   },
        ]
      },
      // Screen 2 — The halb trap: English vs German comparison
      {
        type: 'pattern-table',
        variant: 'reversal',
        label: 'The halb trap',
        rows: [
          {
            change_part: 'half past three',
            connector: '≠',
            tens: 'halb drei',
            ones_label: 'EN: 3:30 looks back',
            tens_label: 'DE: halb drei = 2:30',
            equation: 'halb VIER = 3:30',
            audio: 'halb vier'
          }
        ],
        note: 'halb always points to the COMING hour: halb vier = half of the way to four = 3:30.'
      },
      // Screen 3 — Rule: one sentence
      {
        type: 'text',
        content: 'halb always points to the coming hour: halb vier = half of the way to four = 3:30.'
      },
      // Screen 4 — Practice: clock quiz (halb overrepresented as spec requires)
      {
        type: 'clock-quiz',
        style: 'digital',
        variant: 'quiz',
        items: [
          {
            time: '3:30',
            sentence: 'halb vier',
            audio: 'halb vier',
            options: ['halb drei', 'halb vier', 'viertel nach drei']
          },
          {
            time: '9:30',
            sentence: 'halb zehn',
            audio: 'halb zehn',
            options: ['halb neun', 'viertel nach neun', 'halb zehn']
          },
          {
            time: '7:15',
            sentence: 'viertel nach sieben',
            audio: 'viertel nach sieben',
            options: ['viertel nach sieben', 'halb sieben', 'viertel vor acht']
          },
          {
            time: '8:30',
            sentence: 'halb neun',
            audio: 'halb neun',
            options: ['halb acht', 'halb neun', 'viertel vor neun']
          },
          {
            time: '6:45',
            sentence: 'viertel vor sieben',
            audio: 'viertel vor sieben',
            options: ['viertel nach sechs', 'halb sieben', 'viertel vor sieben']
          },
          {
            time: '11:30',
            sentence: 'halb zwölf',
            audio: 'halb zwölf',
            options: ['halb elf', 'halb zwölf', 'viertel nach elf']
          },
          {
            time: '2:30',
            sentence: 'halb drei',
            audio: 'halb drei',
            options: ['halb zwei', 'viertel nach zwei', 'halb drei']
          },
          {
            time: '4:45',
            sentence: 'viertel vor fünf',
            audio: 'viertel vor fünf',
            options: ['viertel vor fünf', 'halb fünf', 'viertel nach vier']
          },
        ]
      }
    ]
  }
];

// ── Seed ─────────────────────────────────────────────────────────────────

async function run() {
  // 1. Find the module — title-based lookup is safer than order_index alone
  //    because order_index differs between the local snapshot and the live DB
  //    (live DB has Numbers at order_index=3, not 2). We match by both to be
  //    sure, and print the confirmed title before touching anything.
  const { data: mods, error: modErr } = await supabase
    .from('modules')
    .select('id, title, order_index')
    .eq('level', 'A1')
    .order('order_index', { ascending: true });

  if (modErr) {
    console.error('✗ Could not query modules:', modErr.message);
    process.exit(1);
  }

  // Find the Numbers module by title substring (handles buggy-concatenated DB titles)
  const mod = (mods || []).find(function(m) {
    return (m.title || '').toLowerCase().includes('number');
  });

  if (!mod) {
    console.error('✗ Could not find a Numbers module in A1. Titles found:');
    (mods || []).forEach(function(m) { console.error('  oi:' + m.order_index + ' | ' + m.title); });
    process.exit(1);
  }

  console.log('✓ Target module confirmed:');
  console.log('    title:       ', mod.title);
  console.log('    order_index: ', mod.order_index);
  console.log('    id:          ', mod.id);
  console.log('');

  // Guard: refuse to run if the found module looks like Pronunciation or Greetings
  if (/(pronunc|greet|begrüß)/i.test(mod.title)) {
    console.error('✗ Safety check failed: found module looks like Pronunciation/Greetings, not Numbers.');
    console.error('  Aborting without touching the database.');
    process.exit(1);
  }

  // 2. Fetch and log existing lessons BEFORE deleting (backup to console + JSON file)
  const { data: existing, error: fetchErr } = await supabase
    .from('lessons')
    .select('id, order_index, title, content_json, lernziel_intro, lernziel_completion')
    .eq('module_id', mod.id)
    .order('order_index', { ascending: true });

  if (fetchErr) {
    console.warn('  Warning: could not pre-fetch existing lessons:', fetchErr.message);
  } else if (existing && existing.length > 0) {
    const backupPath = require('path').resolve(__dirname, '../.seed-modul3-backup.json');
    require('fs').writeFileSync(backupPath, JSON.stringify({ module: mod, lessons: existing }, null, 2));
    console.log('  Backed up', existing.length, 'existing lesson(s) to .seed-modul3-backup.json');
    existing.forEach(function(l) {
      console.log('    oi:' + l.order_index + ' | ' + l.title + ' | ' + l.id);
    });
    console.log('');
  } else {
    console.log('  No existing lessons found for this module (clean insert).');
  }

  // 3. Delete existing lessons
  const { error: delErr } = await supabase
    .from('lessons')
    .delete()
    .eq('module_id', mod.id);
  if (delErr) console.warn('  Warning: could not delete old lessons:', delErr.message);
  else console.log('  Cleared existing lessons for module', mod.id);

  // 3. Insert the four new lessons
  for (const lesson of LESSONS) {
    const { error: insErr } = await supabase
      .from('lessons')
      .insert({
        module_id:           mod.id,
        order_index:         lesson.order_index,
        title:               lesson.title,
        content_json:        lesson.content_json,
        lernziel_intro:      lesson.lernziel_intro,
        lernziel_completion: lesson.lernziel_completion,
      });
    if (insErr) {
      console.error('✗ Failed to insert lesson', lesson.order_index, ':', insErr.message);
    } else {
      console.log('  ✓ Lesson', lesson.order_index, '—', lesson.title);
    }
  }

  console.log('\nDone. Run the dashboard and open Module 2 to verify.');
}

run().catch(function(e) { console.error('Fatal:', e.message); process.exit(1); });
