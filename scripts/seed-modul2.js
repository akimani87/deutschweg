/**
 * DeutschWeg — Seed Modul 2: Pronunciation & Sounds (L1–L4)
 * ==========================================================
 * Replaces L1, L2, L3 with rebuilt spec designs.
 * Inserts spec 2.4 as new L4.
 * Shifts existing L4 "Rhythm, Stress & Sounding Natural" → L5 (untouched content).
 *
 * Audio: all German words use on-demand /api/tts (ElevenLabs).
 * Minimal pairs confirmed audibly distinct by product owner (audio gate cleared).
 *
 * Practice blocks: clock-quiz with mode:'listening' (hear word → pick
 * correct spelling from 4 options). The listening-input type-digits block
 * is not used here — pronunciation lessons need pick-from-options, not typing.
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

  // ─── L1: 2.1 German says what it sees ───────────────────────────────────
  {
    order_index: 1,
    title: '2.1 — German Says What It Sees',
    lernziel_intro: 'Learn the four letters that surprise English speakers — and why German spelling is actually a gift.',
    lernziel_completion: 'You can read German W, V, Z, and S correctly and spot them in any new word.',
    content_json: [

      // Screen 1 — Pattern: the four trap letters, amber on the letter
      {
        type: 'pattern-table',
        variant: 'suffix',
        label: 'Letters that don\'t do what English expects',
        rows: [
          { stem: '', change: 'W', rest: 'ein',   digits: 'W sounds like V',       audio: 'Wein'   },
          { stem: '', change: 'V', rest: 'ater',  digits: 'V sounds like F',       audio: 'Vater'  },
          { stem: '', change: 'Z', rest: 'eit',   digits: 'Z = "ts"',              audio: 'Zeit'   },
          { stem: '', change: 'S', rest: 'onne',  digits: 'S before vowel = "z"',  audio: 'Sonne'  },
        ]
      },

      // Screen 2 — Rule: one sentence
      {
        type: 'text',
        content: 'German letters keep their promises — learn each letter\'s one sound and every word reads itself.'
      },

      // Screen 3 — Practice: hear word → pick correct German spelling
      // 6 rounds testing the 4 trap letters
      {
        type: 'clock-quiz',
        mode: 'listening',
        variant: 'quiz',
        items: [
          {
            time: '🔊',
            sentence: 'Wein',
            audio: 'Wein',
            options: ['Vein', 'Wein', 'Bein', 'Kein']
          },
          {
            time: '🔊',
            sentence: 'Vater',
            audio: 'Vater',
            options: ['Fater', 'Mater', 'Vater', 'Water']
          },
          {
            time: '🔊',
            sentence: 'Zeit',
            audio: 'Zeit',
            options: ['Seit', 'Weit', 'Heit', 'Zeit']
          },
          {
            time: '🔊',
            sentence: 'Sonne',
            audio: 'Sonne',
            options: ['Zone', 'Tonne', 'Wonne', 'Sonne']
          },
          {
            time: '🔊',
            sentence: 'Vier',
            audio: 'Vier',
            options: ['Fier', 'Wier', 'Bier', 'Vier']
          },
          {
            time: '🔊',
            sentence: 'Winter',
            audio: 'Winter',
            options: ['Vinter', 'Binter', 'Winter', 'Minter']
          },
        ]
      },

      // Screen 4 — Completion
      {
        type: 'intro',
        content: 'You can already read German more honestly than English. Next: the two dots that change everything (5 min).'
      },
    ]
  },

  // ─── L2: 2.2 Umlauts — the two dots ─────────────────────────────────────
  {
    order_index: 2,
    title: '2.2 — Umlauts: the Two Dots (ä ö ü)',
    lernziel_intro: 'Hear the difference two dots make — and recognise umlauts reliably in any German word.',
    lernziel_completion: 'You can hear and identify ä, ö, and ü distinctly from their undotted pairs.',
    content_json: [

      // Screen 1 — Pattern: minimal pairs, amber on the umlaut vowel
      // Pairs show the sound change caused by the two dots
      {
        type: 'pattern-table',
        variant: 'suffix',
        label: 'Tap both — hear the difference',
        rows: [
          { stem: 'sch', change: 'o',  rest: 'n',    digits: '→ already',       audio: 'schon'   },
          { stem: 'sch', change: 'ö',  rest: 'n',    digits: '→ beautiful',     audio: 'schön'   },
          { stem: 'M',   change: 'u',  rest: 'tter', digits: '→ mother',        audio: 'Mutter'  },
          { stem: 'M',   change: 'ü',  rest: 'tter', digits: '→ mothers',       audio: 'Mütter'  },
          { stem: '',    change: 'A',  rest: 'pfel',  digits: '→ apple',         audio: 'Apfel'   },
          { stem: '',    change: 'Ä',  rest: 'pfel',  digits: '→ apples',        audio: 'Äpfel'   },
        ]
      },

      // Screen 2 — Rule: one sentence
      {
        type: 'text',
        content: 'Two dots = a new vowel, not decoration — and sometimes the dots are the only difference between two words.'
      },

      // Screen 3 — Practice: hear one word of a pair → pick which one
      // 8 rounds, all three umlauts covered
      {
        type: 'clock-quiz',
        mode: 'listening',
        variant: 'quiz',
        items: [
          {
            time: '🔊',
            sentence: 'schon',
            audio: 'schon',
            options: ['schön', 'schon', 'schoen', 'schönn']
          },
          {
            time: '🔊',
            sentence: 'schön',
            audio: 'schön',
            options: ['schon', 'scheen', 'schoen', 'schön']
          },
          {
            time: '🔊',
            sentence: 'Mutter',
            audio: 'Mutter',
            options: ['Mütter', 'Mutter', 'Müter', 'Muttar']
          },
          {
            time: '🔊',
            sentence: 'Mütter',
            audio: 'Mütter',
            options: ['Mutter', 'Müter', 'Mütter', 'Muttar']
          },
          {
            time: '🔊',
            sentence: 'Apfel',
            audio: 'Apfel',
            options: ['Äpfel', 'Apfal', 'Apfel', 'Äpfal']
          },
          {
            time: '🔊',
            sentence: 'Äpfel',
            audio: 'Äpfel',
            options: ['Apfel', 'Äpfal', 'Apfal', 'Äpfel']
          },
          {
            time: '🔊',
            sentence: 'schon',
            audio: 'schon',
            options: ['schön', 'scheen', 'schon', 'schoen']
          },
          {
            time: '🔊',
            sentence: 'schön',
            audio: 'schön',
            options: ['schon', 'schön', 'schonn', 'scheen']
          },
        ]
      },

      // Screen 4 — Completion
      {
        type: 'intro',
        content: 'You can hear the dots. Next: the letter teams that work as one sound (5 min).'
      },
    ]
  },

  // ─── L3: 2.3 Letter teams (sch, ch, ei, ie) ─────────────────────────────
  {
    order_index: 3,
    title: '2.3 — Letter Teams (sch, ch, ei, ie)',
    lernziel_intro: 'Learn the four most important letter combinations — and the one trick that makes ei/ie unforgettable.',
    lernziel_completion: 'You can read sch, ch, ei, and ie correctly and never confuse ei with ie again.',
    content_json: [

      // Screen 1 — Pattern: sch and ch, amber on the team
      {
        type: 'pattern-table',
        variant: 'suffix',
        label: 'Letters that act as a team',
        rows: [
          { stem: '', change: 'Sch', rest: 'ule',  digits: 'like English "sh"',  audio: 'Schule'  },
          { stem: 'i', change: 'ch', rest: '',     digits: 'soft ch (after i/e)', audio: 'ich'     },
          { stem: 'Bu', change: 'ch', rest: '',    digits: 'hard ch (after a/o)', audio: 'Buch'    },
        ]
      },

      // Screen 2 — Pattern: ei vs ie, amber on the pair
      {
        type: 'pattern-table',
        variant: 'suffix',
        label: 'ei vs ie — say the second letter\'s English name',
        rows: [
          { stem: 'dr', change: 'ei',  rest: '',     digits: '"eye" sound — three', audio: 'drei'  },
          { stem: 'n',  change: 'ei',  rest: 'n',    digits: '"eye" sound — no',    audio: 'nein'  },
          { stem: 's',  change: 'ie',  rest: '',     digits: '"ee" sound — she',     audio: 'sie'   },
          { stem: 'v',  change: 'ie',  rest: 'r',    digits: '"ee" sound — four',   audio: 'vier'  },
        ]
      },

      // Screen 3 — Rule: the ei/ie trick
      {
        type: 'text',
        content: 'ei and ie: say the English name of the SECOND letter — ei → "I", ie → "E".'
      },

      // Screen 4 — Practice: hear word → pick correct spelling
      // 8 rounds, weighted toward ei/ie (5 of 8)
      {
        type: 'clock-quiz',
        mode: 'listening',
        variant: 'quiz',
        items: [
          {
            time: '🔊',
            sentence: 'nein',
            audio: 'nein',
            options: ['nien', 'neen', 'nein', 'nayn']
          },
          {
            time: '🔊',
            sentence: 'vier',
            audio: 'vier',
            options: ['feer', 'vier', 'veer', 'fier']
          },
          {
            time: '🔊',
            sentence: 'Schule',
            audio: 'Schule',
            options: ['Schule', 'Schhule', 'Schulle', 'Shule']
          },
          {
            time: '🔊',
            sentence: 'drei',
            audio: 'drei',
            options: ['dree', 'drai', 'drei', 'drey']
          },
          {
            time: '🔊',
            sentence: 'sie',
            audio: 'sie',
            options: ['sei', 'sien', 'see', 'sie']
          },
          {
            time: '🔊',
            sentence: 'Buch',
            audio: 'Buch',
            options: ['Bux', 'Busch', 'Buch', 'Buck']
          },
          {
            time: '🔊',
            sentence: 'nein',
            audio: 'nein',
            options: ['nie', 'nee', 'nine', 'nein']
          },
          {
            time: '🔊',
            sentence: 'vier',
            audio: 'vier',
            options: ['vier', 'feer', 'veer', 'fier']
          },
        ]
      },

      // Screen 5 — Completion
      {
        type: 'intro',
        content: 'You know the teams. Next: ß and why vowel length matters (5 min).'
      },
    ]
  },

  // ─── L4: 2.4 ß + long/short + module completion ─────────────────────────
  {
    order_index: 4,
    title: '2.4 — ß and the Long/Short Game',
    lernziel_intro: 'Understand ß and how vowel length works — the final piece of reading German out loud.',
    lernziel_completion: 'You can read ß, long vowels, and short vowels correctly in any German word.',
    content_json: [

      // Screen 1 — Pattern: ß in known words, amber on ß
      {
        type: 'pattern-table',
        variant: 'suffix',
        label: 'ß = a sharp double-s',
        rows: [
          { stem: 'drei',  change: 'ß', rest: 'ig',  digits: '→ thirty',     audio: 'dreißig' },
          { stem: 'hei',   change: 'ß', rest: 'en',  digits: '→ to be called', audio: 'heißen' },
          { stem: 'Stra',  change: 'ß', rest: 'e',   digits: '→ street',     audio: 'Straße'  },
        ]
      },

      // Screen 2 — Pattern: long vs short vowel minimal pairs, amber on the difference
      {
        type: 'pattern-table',
        variant: 'suffix',
        label: 'Same letters, different length — different word',
        rows: [
          { stem: 'St', change: 'a',  rest: 'dt',  digits: '→ city (short a)',  audio: 'Stadt'  },
          { stem: 'St', change: 'aa', rest: 't',   digits: '→ state (long a)',  audio: 'Staat'  },
          { stem: '',   change: 'o',  rest: 'ffen', digits: '→ open (short o)', audio: 'offen'  },
          { stem: '',   change: 'O',  rest: 'fen',  digits: '→ oven (long o)',  audio: 'Ofen'   },
        ]
      },

      // Screen 3 — Rule: one sentence
      {
        type: 'text',
        content: 'Double consonant after a vowel = short vowel; double vowel or vowel+h = long.'
      },

      // Screen 4 — Mixed practice: 8 rounds from all of Modul 2
      {
        type: 'clock-quiz',
        mode: 'listening',
        variant: 'quiz',
        items: [
          {
            time: '🔊',
            sentence: 'dreißig',
            audio: 'dreißig',
            options: ['dreissig', 'dreizig', 'dreißig', 'dreizich']
          },
          {
            time: '🔊',
            sentence: 'Staat',
            audio: 'Staat',
            options: ['Stadt', 'Statt', 'Staat', 'Stahdt']
          },
          {
            time: '🔊',
            sentence: 'schön',
            audio: 'schön',
            options: ['schon', 'scheen', 'schoen', 'schön']
          },
          {
            time: '🔊',
            sentence: 'Wasser',
            audio: 'Wasser',
            options: ['Vasser', 'Basser', 'Wasser', 'Rasser']
          },
          {
            time: '🔊',
            sentence: 'Ofen',
            audio: 'Ofen',
            options: ['offen', 'Oven', 'Ohfen', 'Ofen']
          },
          {
            time: '🔊',
            sentence: 'Vier',
            audio: 'Vier',
            options: ['Fier', 'Wier', 'Vier', 'Beer']
          },
          {
            time: '🔊',
            sentence: 'dreißig',
            audio: 'dreißig',
            options: ['dreißig', 'dreissig', 'dreizig', 'dreizich']
          },
          {
            time: '🔊',
            sentence: 'schon',
            audio: 'schon',
            options: ['schön', 'scheen', 'shon', 'schon']
          },
        ]
      },

      // Screen 5 — Module completion: proof sentence
      // The sentence deliberately contains ß, ü, sch, ei, w — everything just learned
      {
        type: 'intro',
        content: 'Modul 2 complete — You can now read German out loud — the skill under every Goethe Hören and Sprechen task.\n\nProof: read this out loud, then tap ▶ to check yourself:'
      },
      {
        type: 'audio',
        text: 'Ich heiße Müller und wohne in der Schillerstraße.'
      },

      // Screen 6 — Forward bridge to Modul 3
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
    console.error('  Titles found:', (mods||[]).map(function(m){return 'oi:'+m.order_index+' '+m.title;}).join(', '));
    process.exit(1);
  }
  console.log('✓ Module:', mod.title, '| oi:' + mod.order_index, '| id:', mod.id, '\n');

  // Step 1: Shift existing L4 (Rhythm) → L5 to make room for new spec L4
  console.log('── Shifting existing L4 (Rhythm & Stress) → L5 ──');
  const { data: rhythmLesson } = await supabase
    .from('lessons').select('id, order_index, title').eq('module_id', mod.id).eq('order_index', 4).maybeSingle();

  if (rhythmLesson) {
    const { error: shiftErr } = await supabase
      .from('lessons').update({ order_index: 5 }).eq('id', rhythmLesson.id);
    if (shiftErr) { console.error('  ✗ Shift failed:', shiftErr.message); process.exit(1); }
    console.log('  ✓ Shifted "' + rhythmLesson.title + '" → order_index:5\n');
  } else {
    console.log('  No existing L4 to shift\n');
  }

  // Step 2: Replace/insert L1–L4
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
      console.log('  Clean insert (no existing lesson at oi:' + lesson.order_index + ')');
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

  console.log('Done.');
  console.log('L5 (Rhythm & Stress) untouched — content preserved, order_index updated to 5.');
}

run().catch(function(e) { console.error('Fatal:', e.message); process.exit(1); });
