/**
 * A1 Mock Exam 3 — Hören audio generation (all 15 items).
 *
 * Standalone script, same pattern as scripts/fix-uebungssatz-2-speaker-
 * voices.js: calls ElevenLabs directly (eleven_turbo_v2_5, language_code
 * 'de', same voice_settings as server.js's hoerenTTS), uploads to the
 * hoerverstehen-audio bucket, writes the resulting public URL into
 * exam_tasks.stimulus.clips[].audio_url. Does not touch server.js or any
 * live endpoint.
 *
 * Voice plan (per the certified content's audio-production package):
 *   HOEREN_VOICE_A (female, established) — "Frau" in Teil 1 dialogues;
 *     Sofia/Lisa in Teil 3; Item 7's announcement.
 *   HOEREN_VOICE_B (female, established, distinguishable from A) —
 *     "Empfang" in Teil 1 dialogues (incl. Item 6, which pairs Empfang
 *     with Frau — the brief explicitly requires two distinguishable
 *     female voices there, satisfied by A+B); Item 8's announcement;
 *     the Praxis Dr. Wolf voicemail (Item 13).
 *   ADAM (male, established — "confirmed usable on this account" per
 *     fix-uebungssatz-2-speaker-voices.js) — "Mann" in Teil 1 dialogues;
 *     Item 9's announcement; Markus (Item 12) and the Sprachschule
 *     voicemail (Item 14).
 *   Item 10 ("warmer live-announcement voice" per the brief) reuses
 *     HOEREN_VOICE_A with adjusted voice_settings (lower stability,
 *     added style) rather than a 4th, unverified voice ID — this repo
 *     only has 3 confirmed-usable voices; introducing an untested one for
 *     a graded asset was judged too risky. Flagged for Angela's listen-
 *     through pass — see the script's final console output.
 *
 * Pronunciation conventions applied to the TTS INPUT text only (the
 * stored transcript in exam_tasks is never modified by this script):
 *   - Item 2: "Zimmer 305" -> "Zimmer drei null fünf" (both occurrences)
 *   - Item 13: "9 Uhr" -> "neun Uhr", "9:30 Uhr" -> "neun Uhr dreißig",
 *     "10 Minuten" -> "zehn Minuten"
 *   - Item 15: "Linie 12" -> "Linie zwölf" (both occurrences),
 *     "Linie 21" -> "Linie einundzwanzig"
 * All other numbers (14 Uhr, 10 Uhr, fünf Minuten, etc.) are left as-is —
 * per the brief, ordinary quantities read naturally as complete numbers.
 *
 * File naming follows the certified brief's file-segmentation list
 * exactly (hoeren_t1_item_01 .. hoeren_t3_item_15), under a
 * mock-exam-3/ prefix in the existing bucket for namespacing.
 *
 * This produces machine-generated audio only. The certified content's
 * own "Human listen-through checklist" still requires an actual human
 * pass before this is certification-ready — this script doesn't and
 * can't satisfy that step.
 */
require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const admin = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

const HOEREN_BUCKET = 'hoerverstehen-audio';
const MODEL_ID = process.env.ELEVENLABS_MODEL_ID || 'eleven_turbo_v2_5';
const VOICE_A = process.env.HOEREN_VOICE_A || 'rKiu7lQ4c5P3az3745s3'; // female
const VOICE_B = process.env.HOEREN_VOICE_B || 'EXAVITQu4vr4xnSDxMaL'; // female, distinguishable from A
const VOICE_MALE = 'pNInz6obpgDQGcFmaJgB'; // ElevenLabs premade "Adam"

const HOEREN_ID = 'c148c664-84e5-42a0-90b4-76b59cd1e64d';

async function hoerenTTS(text, voiceId, settingsOverride) {
  const r = await fetch(
    `https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(voiceId)}?output_format=mp3_22050_32`,
    {
      method: 'POST',
      headers: { 'xi-api-key': process.env.ELEVENLABS_API_KEY, 'Content-Type': 'application/json', 'Accept': 'audio/mpeg' },
      body: JSON.stringify({
        text, model_id: MODEL_ID, language_code: 'de',
        voice_settings: Object.assign({ stability: 0.5, similarity_boost: 0.75 }, settingsOverride || {}),
      }),
    }
  );
  if (!r.ok) { const e = await r.text().catch(() => ''); throw new Error('ElevenLabs ' + r.status + ' ' + e.slice(0, 300)); }
  return Buffer.from(await r.arrayBuffer());
}

// Splits a "Label: text" transcript into ordered turns for dialogue clips.
function splitTurns(transcript) {
  const turns = [];
  transcript.split(/\r?\n/).forEach((line) => {
    const m = line.match(/^(Frau|Mann|Empfang):\s*(.*)$/);
    if (m) turns.push({ speaker: m[1], text: m[2] });
  });
  return turns;
}

const SPEAKER_VOICE = { Frau: VOICE_A, Mann: VOICE_MALE, Empfang: VOICE_B };

// Per-item TTS-input phonetic substitutions (display transcript unchanged).
const PHONETICS = {
  2:  [[/Zimmer 305/g, 'Zimmer drei null fünf']],
  13: [[/9:30 Uhr/g, 'neun Uhr dreißig'], [/9 Uhr/g, 'neun Uhr'], [/10 Minuten/g, 'zehn Minuten']],
  15: [[/Linie 12/g, 'Linie zwölf'], [/Linie 21/g, 'Linie einundzwanzig']],
};
function phoneticize(itemNumber, text) {
  const rules = PHONETICS[itemNumber];
  if (!rules) return text;
  return rules.reduce((t, [pattern, replacement]) => t.replace(pattern, replacement), text);
}

// itemNumber -> { taskNumber, clipIndex, teil, type } — matches the
// certified brief's global 1-15 item numbering across all 3 Teile.
const ITEM_MAP = [
  { item: 1,  task: 1, clip: 0, teil: 1 }, { item: 2,  task: 1, clip: 1, teil: 1 },
  { item: 3,  task: 1, clip: 2, teil: 1 }, { item: 4,  task: 1, clip: 3, teil: 1 },
  { item: 5,  task: 1, clip: 4, teil: 1 }, { item: 6,  task: 1, clip: 5, teil: 1 },
  { item: 7,  task: 2, clip: 0, teil: 2, voice: VOICE_A },
  { item: 8,  task: 2, clip: 1, teil: 2, voice: VOICE_B },
  { item: 9,  task: 2, clip: 2, teil: 2, voice: VOICE_MALE },
  { item: 10, task: 2, clip: 3, teil: 2, voice: VOICE_A, settings: { stability: 0.35, style: 0.4 } },
  { item: 11, task: 3, clip: 0, teil: 3, voice: VOICE_A },
  { item: 12, task: 3, clip: 1, teil: 3, voice: VOICE_MALE },
  { item: 13, task: 3, clip: 2, teil: 3, voice: VOICE_B },
  { item: 14, task: 3, clip: 3, teil: 3, voice: VOICE_MALE },
  { item: 15, task: 3, clip: 4, teil: 3, voice: VOICE_A },
];

function pad2(n) { return String(n).padStart(2, '0'); }

(async () => {
  const { data: tasks, error: fetchErr } = await admin.from('exam_tasks').select('id, task_number, stimulus')
    .eq('exam_id', HOEREN_ID).order('task_number');
  if (fetchErr) { console.error('Fetch FAILED:', fetchErr); process.exit(1); }
  const byTaskNumber = {};
  tasks.forEach((t) => { byTaskNumber[t.task_number] = t; });

  const results = [];

  for (const m of ITEM_MAP) {
    const task = byTaskNumber[m.task];
    const clip = task.stimulus.clips[m.clip];
    console.log(`Item ${pad2(m.item)} (Teil ${m.teil}) — "${clip.scenario}"`);

    let audio;
    if (m.teil === 1) {
      const turns = splitTurns(clip.transcript);
      const buffers = [];
      for (const turn of turns) {
        const text = phoneticize(m.item, turn.text);
        buffers.push(await hoerenTTS(text, SPEAKER_VOICE[turn.speaker]));
      }
      audio = Buffer.concat(buffers);
    } else {
      const text = phoneticize(m.item, clip.transcript);
      audio = await hoerenTTS(text, m.voice, m.settings);
    }

    const path = `mock-exam-3/hoeren_t${m.teil}_item_${pad2(m.item)}.mp3`;
    const up = await admin.storage.from(HOEREN_BUCKET).upload(path, audio, { contentType: 'audio/mpeg', upsert: true });
    if (up.error) { console.error(`  UPLOAD FAILED (item ${m.item}):`, up.error.message); process.exit(1); }
    const publicUrl = admin.storage.from(HOEREN_BUCKET).getPublicUrl(path).data.publicUrl;
    console.log(`  -> ${publicUrl} (${(audio.length / 1024).toFixed(0)} KB)`);

    clip.audio_url = publicUrl;
    results.push({ item: m.item, task: m.task, url: publicUrl });
  }

  for (const taskNumber of [1, 2, 3]) {
    const task = byTaskNumber[taskNumber];
    const { error: updErr } = await admin.from('exam_tasks').update({ stimulus: task.stimulus }).eq('id', task.id);
    if (updErr) { console.error(`Task ${taskNumber} update FAILED:`, updErr); process.exit(1); }
    console.log(`Task ${taskNumber} (${task.stimulus.clips.length} clips) updated.`);
  }

  console.log(`\nDone. ${results.length} audio files generated and linked.`);
  console.log('\nSTILL REQUIRED before certification: a human listen-through pass');
  console.log('(the certified brief\'s own checklist) — script accuracy, voice');
  console.log('assignment (especially Item 6\'s two-female-voice distinction and');
  console.log('Item 10\'s reused-voice "warmth" substitute), numeral pronunciation');
  console.log('(Items 2/13/15), and natural pacing. Nothing here substitutes for that.');
})().catch((e) => { console.error('CRASHED:', e); process.exit(1); });
