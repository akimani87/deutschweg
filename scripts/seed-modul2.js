/**
 * DeutschWeg — Seed Modul 2: Pronunciation & Sounds (L1–L5)
 * ==========================================================
 * AMENDED structure (2026-07-03):
 *   L1 = 2.1 Alphabet & Vowels (NEW — opening lesson)
 *   L2 = 2.2 German says what it sees (was spec 2.1)
 *   L3 = 2.3 Umlauts — framing builds on L1 ("You know A,O,U...")
 *   L4 = 2.4 Letter teams (was spec 2.3)
 *   L5 = 2.5 ß + long/short + MODULE COMPLETION (was spec 2.4)
 *   L6 = Rhythm & Stress (existing content, kept — shifted oi:4→6)
 *
 * Audio gate: all German letter names A–Z + Ä/Ö/Ü/ß use on-demand
 * /api/tts (ElevenLabs, language_code:'de'). Distinctive letter names
 * (Fau/Weh/Jot/Üpsilon/Zet) passed as German words, not raw letters.
 *
 * Run: node scripts/seed-modul2.js
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

// ── Lesson content ─────────────────────────────────────────────────────────

const LESSONS = [

  // ─── L1: 2.1 Alphabet & Vowels (NEW OPENING LESSON) ──────────────────────
  {
    order_index: 1,
    title: '2.1 — The Alphabet & the Five Vowels',
    lernziel_intro: 'Learn the five German vowel sounds and spot the seven letters whose names surprise English speakers.',
    lernziel_completion: 'You can say the German alphabet and spell your name — a real Goethe A1 task.',
    content_json: [

      // Screen 1 — Pattern: the five vowel anchors (no amber — all equal)
      // These carry everything else: umlauts, ei/ie, long/short.
      {
        type: 'pattern-table',
        variant: 'suffix',
        label: 'The five vowel sounds — learn these first',
        rows: [
          { stem: 'A', change: '', rest: '', digits: '"ah" — Apfel',  audio: 'A'  },
          { stem: 'E', change: '', rest: '', digits: '"eh" — essen',  audio: 'Eh' },
          { stem: 'I', change: '', rest: '', digits: '"ee" — ich',    audio: 'Ih' },
          { stem: 'O', change: '', rest: '', digits: '"oh" — Oma',    audio: 'O'  },
          { stem: 'U', change: '', rest: '', digits: '"oo" — und',    audio: 'U'  },
        ]
      },

      // Screen 2 — Pattern: full A–Z grid
      // Plain letters in stem (no amber). Surprise letters in change (amber).
      // Amber = E, I, J, V, W, Y, Z — their German names differ from English.
      {
        type: 'pattern-table',
        variant: 'suffix',
        label: 'The full alphabet — 7 surprises in amber',
        rows: [
          { stem: 'A', change: '', rest: '', digits: 'ah',              audio: 'A'       },
          { stem: 'B', change: '', rest: '', digits: 'beh',             audio: 'B'       },
          { stem: 'C', change: '', rest: '', digits: 'tseh',            audio: 'C'       },
          { stem: 'D', change: '', rest: '', digits: 'deh',             audio: 'D'       },
          { stem: '', change: 'E', rest: '', digits: '"EH" — not "EE"', audio: 'Eh'      },
          { stem: 'F', change: '', rest: '', digits: 'eff',             audio: 'F'       },
          { stem: 'G', change: '', rest: '', digits: 'geh',             audio: 'G'       },
          { stem: 'H', change: '', rest: '', digits: 'hah',             audio: 'H'       },
          { stem: '', change: 'I', rest: '', digits: '"EE" — not "EYE"', audio: 'Ih'    },
          { stem: '', change: 'J', rest: '', digits: '"YOT"',           audio: 'Jot'     },
          { stem: 'K', change: '', rest: '', digits: 'kah',             audio: 'K'       },
          { stem: 'L', change: '', rest: '', digits: 'ell',             audio: 'L'       },
          { stem: 'M', change: '', rest: '', digits: 'emm',             audio: 'M'       },
          { stem: 'N', change: '', rest: '', digits: 'enn',             audio: 'N'       },
          { stem: 'O', change: '', rest: '', digits: 'oh',              audio: 'O'       },
          { stem: 'P', change: '', rest: '', digits: 'peh',             audio: 'P'       },
          { stem: 'Q', change: '', rest: '', digits: 'ku',              audio: 'Q'       },
          { stem: 'R', change: '', rest: '', digits: 'err',             audio: 'R'       },
          { stem: 'S', change: '', rest: '', digits: 'ess',             audio: 'S'       },
          { stem: 'T', change: '', rest: '', digits: 'teh',             audio: 'T'       },
          { stem: 'U', change: '', rest: '', digits: 'oo',              audio: 'U'       },
          { stem: '', change: 'V', rest: '', digits: '"FAU" (like F)',  audio: 'Fau'     },
          { stem: '', change: 'W', rest: '', digits: '"VEH" (like V)',  audio: 'Weh'     },
          { stem: 'X', change: '', rest: '', digits: 'iks',             audio: 'X'       },
          { stem: '', change: 'Y', rest: '', digits: '"ÜPSILON"',       audio: 'Üpsilon' },
          { stem: '', change: 'Z', rest: '', digits: '"TSET" (ts+et)',  audio: 'Zet'     },
        ]
      },

      // Screen 3 — Rule: one sentence
      {
        type: 'text',
        content: 'Most letters you already know — learn the seven surprises and the five vowel sounds, and the alphabet is yours.'
      },

      // Screen 4 — Practice: hear letter name → tap the right letter
      // 8 rounds, weighted toward the 7 amber traps (esp. E vs I)
      {
        type: 'clock-quiz',
        mode: 'listening',
        variant: 'quiz',
        items: [
          { time: '🔊', sentence: 'E', audio: 'Eh',      options: ['E', 'A', 'I', 'O'] },
          { time: '🔊', sentence: 'I', audio: 'Ih',      options: ['I', 'E', 'Y', 'J'] },
          { time: '🔊', sentence: 'V', audio: 'Fau',     options: ['V', 'F', 'W', 'B'] },
          { time: '🔊', sentence: 'W', audio: 'Weh',     options: ['W', 'V', 'U', 'B'] },
          { time: '🔊', sentence: 'J', audio: 'Jot',     options: ['J', 'Y', 'Z', 'G'] },
          { time: '🔊', sentence: 'Z', audio: 'Zet',     options: ['Z', 'S', 'C', 'T'] },
          { time: '🔊', sentence: 'Y', audio: 'Üpsilon', options: ['Y', 'Ü', 'U', 'I'] },
          { time: '🔊', sentence: 'E', audio: 'Eh',      options: ['E', 'A', 'I', 'O'] },
        ]
      },

      // Screen 5 — Practice: Buchstabieren (spelling names from letter tiles)
      // Audio = the name spelled aloud letter by letter.
      // Tiles include the correct letters + plausible distractors.
      {
        type: 'tile-assembly',
        prompt_label: 'Spell the name',
        rounds: [
          {
            prompt: 'Amina',
            tiles: ['A', 'M', 'I', 'N', 'A', 'E', 'L'],
            answer: ['A', 'M', 'I', 'N', 'A'],
            audio: 'A, M, I, N, A'
          },
          {
            prompt: 'Raj',
            tiles: ['R', 'A', 'J', 'K', 'T', 'P'],
            answer: ['R', 'A', 'J'],
            audio: 'R, A, J'
          },
          {
            prompt: 'Lena',
            tiles: ['L', 'E', 'N', 'A', 'I', 'U'],
            answer: ['L', 'E', 'N', 'A'],
            audio: 'L, E, N, A'
          },
          {
            prompt: 'Timo',
            tiles: ['T', 'I', 'M', 'O', 'R', 'U'],
            answer: ['T', 'I', 'M', 'O'],
            audio: 'T, I, M, O'
          },
        ]
      },

      // Screen 5b — Closing prompt (no interaction)
      {
        type: 'text',
        content: 'Now spell YOUR name out loud, letter by letter — the Goethe examiner will ask you to do exactly this: "Wie schreibt man das?"'
      },

      // Screen 6 — Completion
      {
        type: 'intro',
        content: 'You can say the alphabet and spell your name for the examiner — a real Goethe A1 task, done. Next: why German spelling is more honest than English (5 min).'
      },
    ]
  },

  // ─── L2: 2.2 German says what it sees ────────────────────────────────────
  {
    order_index: 2,
    title: '2.2 — German Says What It Sees',
    lernziel_intro: 'Learn the four letters that surprise English speakers — and why German spelling is actually a gift.',
    lernziel_completion: 'You can read German W, V, Z, and S correctly and spot them in any new word.',
    content_json: [
      {
        type: 'pattern-table',
        variant: 'suffix',
        label: 'Letters that don\'t do what English expects',
        rows: [
          { stem: '', change: 'W', rest: 'ein',  digits: 'W sounds like V',      audio: 'Wein'   },
          { stem: '', change: 'V', rest: 'ater', digits: 'V sounds like F',      audio: 'Vater'  },
          { stem: '', change: 'Z', rest: 'eit',  digits: 'Z = "ts"',             audio: 'Zeit'   },
          { stem: '', change: 'S', rest: 'onne', digits: 'S before vowel = "z"', audio: 'Sonne'  },
        ]
      },
      {
        type: 'text',
        content: 'German letters keep their promises — learn each letter\'s one sound and every word reads itself.'
      },
      {
        type: 'clock-quiz',
        mode: 'listening',
        variant: 'quiz',
        items: [
          { time: '🔊', sentence: 'Wein',   audio: 'Wein',   options: ['Vein', 'Wein', 'Bein', 'Kein']     },
          { time: '🔊', sentence: 'Vater',  audio: 'Vater',  options: ['Fater', 'Mater', 'Vater', 'Water']  },
          { time: '🔊', sentence: 'Zeit',   audio: 'Zeit',   options: ['Seit', 'Weit', 'Heit', 'Zeit']      },
          { time: '🔊', sentence: 'Sonne',  audio: 'Sonne',  options: ['Zone', 'Tonne', 'Wonne', 'Sonne']   },
          { time: '🔊', sentence: 'Vier',   audio: 'Vier',   options: ['Fier', 'Wier', 'Bier', 'Vier']      },
          { time: '🔊', sentence: 'Winter', audio: 'Winter', options: ['Vinter', 'Binter', 'Winter', 'Minter'] },
        ]
      },
      {
        type: 'intro',
        content: 'You can already read German more honestly than English. Next: the two dots that change everything (5 min).'
      },
    ]
  },

  // ─── L3: 2.3 Umlauts — framing builds on L1 vowels ───────────────────────
  {
    order_index: 3,
    title: '2.3 — Umlauts: the Two Dots (ä ö ü)',
    lernziel_intro: 'You know A, O, U from Lesson 2.1 — the two dots turn them into brand-new vowels.',
    lernziel_completion: 'You can hear and identify ä, ö, and ü distinctly from their undotted pairs.',
    content_json: [
      {
        type: 'pattern-table',
        variant: 'suffix',
        label: 'Two dots — tap both and hear what changes',
        rows: [
          { stem: 'sch', change: 'o',  rest: 'n',    digits: '→ already',   audio: 'schon'   },
          { stem: 'sch', change: 'ö',  rest: 'n',    digits: '→ beautiful', audio: 'schön'   },
          { stem: 'M',   change: 'u',  rest: 'tter', digits: '→ mother',    audio: 'Mutter'  },
          { stem: 'M',   change: 'ü',  rest: 'tter', digits: '→ mothers',   audio: 'Mütter'  },
          { stem: '',    change: 'A',  rest: 'pfel',  digits: '→ apple',     audio: 'Apfel'   },
          { stem: '',    change: 'Ä',  rest: 'pfel',  digits: '→ apples',    audio: 'Äpfel'   },
        ]
      },
      {
        type: 'text',
        content: 'Two dots = a new vowel, not decoration — and sometimes the dots are the only difference between two words.'
      },
      {
        type: 'clock-quiz',
        mode: 'listening',
        variant: 'quiz',
        items: [
          { time: '🔊', sentence: 'schon',  audio: 'schon',  options: ['schön', 'schon', 'schoen', 'schönn']   },
          { time: '🔊', sentence: 'schön',  audio: 'schön',  options: ['schon', 'scheen', 'schoen', 'schön']   },
          { time: '🔊', sentence: 'Mutter', audio: 'Mutter', options: ['Mütter', 'Mutter', 'Müter', 'Muttar']  },
          { time: '🔊', sentence: 'Mütter', audio: 'Mütter', options: ['Mutter', 'Müter', 'Mütter', 'Muttar']  },
          { time: '🔊', sentence: 'Apfel',  audio: 'Apfel',  options: ['Äpfel', 'Apfal', 'Apfel', 'Äpfal']    },
          { time: '🔊', sentence: 'Äpfel',  audio: 'Äpfel',  options: ['Apfel', 'Äpfal', 'Apfal', 'Äpfel']    },
          { time: '🔊', sentence: 'schon',  audio: 'schon',  options: ['schön', 'scheen', 'schon', 'schoen']   },
          { time: '🔊', sentence: 'schön',  audio: 'schön',  options: ['schon', 'schön', 'schonn', 'scheen']   },
        ]
      },
      { type: 'intro', content: 'You can hear the dots. Next: the letter teams that work as one sound (5 min).' },
    ]
  },

  // ─── L4: 2.4 Letter teams (sch, ch, ei, ie) ──────────────────────────────
  {
    order_index: 4,
    title: '2.4 — Letter Teams (sch, ch, ei, ie)',
    lernziel_intro: 'Learn the four most important letter combinations — and the one trick that makes ei/ie unforgettable.',
    lernziel_completion: 'You can read sch, ch, ei, and ie correctly and never confuse ei with ie again.',
    content_json: [
      {
        type: 'pattern-table',
        variant: 'suffix',
        label: 'Letters that act as a team',
        rows: [
          { stem: '',   change: 'Sch', rest: 'ule', digits: 'like English "sh"',  audio: 'Schule' },
          { stem: 'i',  change: 'ch',  rest: '',     digits: 'soft ch (after i/e)', audio: 'ich'    },
          { stem: 'Bu', change: 'ch',  rest: '',     digits: 'hard ch (after a/o)', audio: 'Buch'   },
        ]
      },
      {
        type: 'pattern-table',
        variant: 'suffix',
        label: 'ei vs ie — say the second letter\'s English name',
        rows: [
          { stem: 'dr', change: 'ei', rest: '',   digits: '"eye" sound — three', audio: 'drei' },
          { stem: 'n',  change: 'ei', rest: 'n',  digits: '"eye" sound — no',   audio: 'nein' },
          { stem: 's',  change: 'ie', rest: '',   digits: '"ee" sound — she',   audio: 'sie'  },
          { stem: 'v',  change: 'ie', rest: 'r',  digits: '"ee" sound — four',  audio: 'vier' },
        ]
      },
      { type: 'text', content: 'ei and ie: say the English name of the SECOND letter — ei → "I", ie → "E".' },
      {
        type: 'clock-quiz',
        mode: 'listening',
        variant: 'quiz',
        items: [
          { time: '🔊', sentence: 'nein',  audio: 'nein',  options: ['nien', 'neen', 'nein', 'nayn']       },
          { time: '🔊', sentence: 'vier',  audio: 'vier',  options: ['feer', 'vier', 'veer', 'fier']        },
          { time: '🔊', sentence: 'Schule',audio: 'Schule',options: ['Schule', 'Schhule', 'Schulle', 'Shule'] },
          { time: '🔊', sentence: 'drei',  audio: 'drei',  options: ['dree', 'drai', 'drei', 'drey']        },
          { time: '🔊', sentence: 'sie',   audio: 'sie',   options: ['sei', 'sien', 'see', 'sie']           },
          { time: '🔊', sentence: 'Buch',  audio: 'Buch',  options: ['Bux', 'Busch', 'Buch', 'Buck']        },
          { time: '🔊', sentence: 'nein',  audio: 'nein',  options: ['nie', 'nee', 'nine', 'nein']          },
          { time: '🔊', sentence: 'vier',  audio: 'vier',  options: ['vier', 'feer', 'veer', 'fier']        },
        ]
      },
      { type: 'intro', content: 'You know the teams. Next: ß and why vowel length matters (5 min).' },
    ]
  },

  // ─── L5: 2.5 ß + long/short + module completion ───────────────────────────
  {
    order_index: 5,
    title: '2.5 — ß and the Long/Short Game',
    lernziel_intro: 'Understand ß and how vowel length works — the final piece of reading German out loud.',
    lernziel_completion: 'You can read ß, long vowels, and short vowels correctly in any German word.',
    content_json: [
      {
        type: 'pattern-table',
        variant: 'suffix',
        label: 'ß = a sharp double-s',
        rows: [
          { stem: 'drei',  change: 'ß', rest: 'ig', digits: '→ thirty',       audio: 'dreißig' },
          { stem: 'hei',   change: 'ß', rest: 'en', digits: '→ to be called', audio: 'heißen'  },
          { stem: 'Stra',  change: 'ß', rest: 'e',  digits: '→ street',       audio: 'Straße'  },
        ]
      },
      {
        type: 'pattern-table',
        variant: 'suffix',
        label: 'Same letters, different length — different word',
        rows: [
          { stem: 'St', change: 'a',  rest: 'dt',   digits: '→ city (short a)',  audio: 'Stadt'  },
          { stem: 'St', change: 'aa', rest: 't',    digits: '→ state (long a)',  audio: 'Staat'  },
          { stem: '',   change: 'o',  rest: 'ffen', digits: '→ open (short o)',  audio: 'offen'  },
          { stem: '',   change: 'O',  rest: 'fen',  digits: '→ oven (long o)',   audio: 'Ofen'   },
        ]
      },
      { type: 'text', content: 'Double consonant after a vowel = short vowel; double vowel or vowel+h = long.' },
      {
        type: 'clock-quiz',
        mode: 'listening',
        variant: 'quiz',
        items: [
          { time: '🔊', sentence: 'dreißig', audio: 'dreißig', options: ['dreissig', 'dreizig', 'dreißig', 'dreizich']     },
          { time: '🔊', sentence: 'Staat',   audio: 'Staat',   options: ['Stadt', 'Statt', 'Staat', 'Stahdt']              },
          { time: '🔊', sentence: 'schön',   audio: 'schön',   options: ['schon', 'scheen', 'schoen', 'schön']             },
          { time: '🔊', sentence: 'Wasser',  audio: 'Wasser',  options: ['Vasser', 'Basser', 'Wasser', 'Rasser']           },
          { time: '🔊', sentence: 'Ofen',    audio: 'Ofen',    options: ['offen', 'Oven', 'Ohfen', 'Ofen']                 },
          { time: '🔊', sentence: 'Vier',    audio: 'Vier',    options: ['Fier', 'Wier', 'Vier', 'Beer']                   },
          { time: '🔊', sentence: 'dreißig', audio: 'dreißig', options: ['dreißig', 'dreissig', 'dreizig', 'dreizich']     },
          { time: '🔊', sentence: 'schon',   audio: 'schon',   options: ['schön', 'scheen', 'shon', 'schon']               },
        ]
      },
      {
        type: 'intro',
        content: 'Modul 2 complete — You can now read German out loud — the skill under every Goethe Hören and Sprechen task.\n\nProof: read this out loud, then tap ▶ to check yourself:'
      },
      {
        type: 'audio',
        text: 'Ich heiße Müller und wohne in der Schillerstraße.'
      },
      {
        type: 'text',
        content: 'Next: Modul 3 — Numbers & Time, the most pattern-friendly German there is (15 min).'
      },
    ]
  },

];

// ── Seed ──────────────────────────────────────────────────────────────────

async function run() {
  // Find module
  const { data: mods, error: modErr } = await supabase
    .from('modules').select('id, title, order_index').eq('level', 'A1').order('order_index', { ascending: true });

  if (modErr) { console.error('✗ modules query failed:', modErr.message); process.exit(1); }

  const mod = (mods || []).find(function(m) { return (m.title || '').toLowerCase().includes('pronunc'); });
  if (!mod || !/(pronunc)/i.test(mod.title)) {
    console.error('✗ Safety abort — Pronunciation module not found');
    console.error('  Titles:', (mods||[]).map(function(m){return 'oi:'+m.order_index+' '+m.title;}).join(', '));
    process.exit(1);
  }
  console.log('✓ Module:', mod.title, '| oi:' + mod.order_index, '| id:', mod.id, '\n');

  // Step 1: Shift existing L4 (Rhythm) oi:4 → oi:6 to make room for L4+L5
  console.log('── Shifting L4 Rhythm & Stress → oi:6 ──');
  const { data: rhythmLesson } = await supabase
    .from('lessons').select('id, order_index, title').eq('module_id', mod.id).eq('order_index', 4).maybeSingle();

  if (rhythmLesson) {
    const { error: shiftErr } = await supabase
      .from('lessons').update({ order_index: 6 }).eq('id', rhythmLesson.id);
    if (shiftErr) { console.error('  ✗ Shift failed:', shiftErr.message); process.exit(1); }
    console.log('  ✓ Shifted "' + rhythmLesson.title + '" → oi:6\n');
  } else {
    console.log('  No existing L4 to shift (already clear)\n');
  }

  // Step 2: Replace/insert L1–L5
  for (const lesson of LESSONS) {
    console.log('── L' + lesson.order_index + ': ' + lesson.title + ' ──');

    const { data: existing } = await supabase
      .from('lessons').select('id, order_index, title, content_json, lernziel_intro, lernziel_completion')
      .eq('module_id', mod.id).eq('order_index', lesson.order_index).maybeSingle();

    if (existing) {
      const backupFile = path.resolve(__dirname, '../.seed-modul2-l' + lesson.order_index + '-backup.json');
      fs.writeFileSync(backupFile, JSON.stringify({ module: mod, lesson: existing }, null, 2));
      console.log('  Backed up → .seed-modul2-l' + lesson.order_index + '-backup.json');
      console.log('  Previous: "' + existing.title + '"');
      const { error: delErr } = await supabase.from('lessons').delete().eq('id', existing.id);
      if (delErr) { console.error('  ✗ Delete failed:', delErr.message); process.exit(1); }
    } else {
      console.log('  Clean insert (no lesson at oi:' + lesson.order_index + ')');
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
    console.log('  ✓ Inserted (' + lesson.content_json.length + ' blocks)\n');
  }

  console.log('Done. L6 (Rhythm & Stress) untouched — content preserved, shifted to oi:6.');
}

run().catch(function(e) { console.error('Fatal:', e.message); process.exit(1); });
