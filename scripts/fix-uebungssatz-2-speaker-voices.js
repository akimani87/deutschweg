/**
 * Übungssatz 2 (A1) Hören — audit-trail fix #1 (human-review round 1).
 *
 * Human review found both dialogue clips' male-named speakers (Lukas,
 * Herr Neumann) were voiced by a female ElevenLabs voice — server.js's
 * two established Hören voices (HOEREN_VOICE_A/B) are both documented
 * female, so a male speaker was always going to land on one of them.
 *
 * Fix: Speaker 1 in each of these 2 clips now uses a real male ElevenLabs
 * voice ("Adam", pNInz6obpgDQGcFmaJgB); Speaker 2 (Sofia, Mitarbeiterin —
 * both genuinely female) keeps the existing HOEREN_VOICE_B unchanged.
 * No transcript/question/answer/explanation text changed in this round.
 *
 * Already run once against production — kept as a record of how the fix
 * was produced, not meant to be re-run (the old URLs it deletes are
 * already gone).
 */
require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs'); const path = require('path');
const admin = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

const HOEREN_BUCKET = 'hoerverstehen-audio';
const HOEREN_VOICE_MALE = 'pNInz6obpgDQGcFmaJgB'; // ElevenLabs premade "Adam" — confirmed usable on this account
const HOEREN_VOICE_B = process.env.HOEREN_VOICE_B || 'EXAVITQu4vr4xnSDxMaL'; // unchanged — Sprecher 2's existing female voice
const MODEL_ID = process.env.ELEVENLABS_MODEL_ID || 'eleven_turbo_v2_5';

async function hoerenTTS(text, voiceId) {
  const r = await fetch(
    `https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(voiceId)}?output_format=mp3_22050_32`,
    {
      method: 'POST',
      headers: { 'xi-api-key': process.env.ELEVENLABS_API_KEY, 'Content-Type': 'application/json', 'Accept': 'audio/mpeg' },
      body: JSON.stringify({ text, model_id: MODEL_ID, language_code: 'de', voice_settings: { stability: 0.5, similarity_boost: 0.75 } }),
    }
  );
  if (!r.ok) { const e = await r.text().catch(() => ''); throw new Error('ElevenLabs ' + r.status + ' ' + e.slice(0, 300)); }
  return Buffer.from(await r.arrayBuffer());
}

// Same regex server.js uses — Sprecher 1 -> male voice, Sprecher 2 -> HOEREN_VOICE_B (unchanged).
function segments(script) {
  const segs = [];
  let voice = HOEREN_VOICE_MALE, buf = [];
  const flush = () => { const t = buf.join(' ').trim(); if (t) segs.push({ voice, text: t }); buf = []; };
  script.split(/\r?\n/).forEach((line) => {
    const m = line.match(/^\s*(?:Speaker|Sprecher(?:in)?|Person)\s*([12AB])\s*[:\-]\s*(.*)$/i);
    if (m) {
      flush();
      const who = m[1].toUpperCase();
      voice = (who === '2' || who === 'B') ? HOEREN_VOICE_B : HOEREN_VOICE_MALE;
      if (m[2]) buf.push(m[2]);
    } else if (line.trim()) buf.push(line.trim());
  });
  flush();
  return segs;
}

async function synthesizeConversation(script) {
  const segs = segments(script);
  const buffers = [];
  for (const s of segs) buffers.push(await hoerenTTS(s.text, s.voice));
  return Buffer.concat(buffers);
}

const CLIPS_TO_FIX = [
  {
    key: 'teil1-clip-a', folder: 'conversation',
    oldUrl: 'https://udmunxzzuqoynlftapwh.supabase.co/storage/v1/object/public/hoerverstehen-audio/conversation/1784012440597-sjao5e.mp3',
    script:
      'Sprecher 1: Hallo Sofia! Hast du morgen Zeit für einen Kaffee?\n' +
      'Sprecher 2: Ja klar! Wo treffen wir uns?\n' +
      'Sprecher 1: Wie wäre es im Café Sonne? Das ist in der Bahnhofstraße.\n' +
      'Sprecher 2: Gute Idee! Um wie viel Uhr denn?\n' +
      'Sprecher 1: Passt dir zehn Uhr?\n' +
      'Sprecher 2: Zehn Uhr ist perfekt. Bis morgen!\n' +
      'Sprecher 1: Bis morgen, Sofia!',
  },
  {
    key: 'teil1-clip-b', folder: 'conversation',
    oldUrl: 'https://udmunxzzuqoynlftapwh.supabase.co/storage/v1/object/public/hoerverstehen-audio/conversation/1784012442972-nn5np7.mp3',
    script:
      'Sprecher 1: Guten Tag, hier ist Neumann. Meine Waschmaschine ist kaputt. Können Sie einen Techniker schicken?\n' +
      'Sprecher 2: Guten Tag, Herr Neumann. Kein Problem. Sind Sie am Donnerstag zu Hause?\n' +
      'Sprecher 1: Donnerstag geht leider nicht, ich arbeite. Geht es auch Freitag?\n' +
      'Sprecher 2: Freitag ist möglich. Der Techniker kommt zwischen vierzehn und sechzehn Uhr.\n' +
      'Sprecher 1: Perfekt, danke schön.\n' +
      'Sprecher 2: Gern geschehen. Bis Freitag!',
  },
];

const HOEREN_ID = '1204664c-f3b9-4cc2-90fa-1e1c2a5c0e47';

function pathFromUrl(url) {
  const marker = '/' + HOEREN_BUCKET + '/';
  const i = url.indexOf(marker);
  return i >= 0 ? url.slice(i + marker.length) : null;
}

(async () => {
  const newUrls = {};
  for (const clip of CLIPS_TO_FIX) {
    console.log('Regenerating', clip.key, '...');
    const audio = await synthesizeConversation(clip.script);
    const remoteName = `${clip.folder}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.mp3`;
    const { error } = await admin.storage.from(HOEREN_BUCKET).upload(remoteName, audio, { contentType: 'audio/mpeg' });
    if (error) { console.error('UPLOAD FAILED', clip.key, error.message); process.exit(1); }
    const { data: pub } = admin.storage.from(HOEREN_BUCKET).getPublicUrl(remoteName);
    console.log('  ->', pub.publicUrl, `(${(audio.length / 1024).toFixed(0)} KB)`);
    newUrls[clip.key] = pub.publicUrl;
  }

  const { data: task, error: fetchErr } = await admin.from('exam_tasks').select('id, stimulus').eq('exam_id', HOEREN_ID).eq('task_number', 1).single();
  if (fetchErr) { console.error(fetchErr); process.exit(1); }
  task.stimulus.clips[0].audio_url = newUrls['teil1-clip-a'];
  task.stimulus.clips[1].audio_url = newUrls['teil1-clip-b'];
  const { error: updErr } = await admin.from('exam_tasks').update({ stimulus: task.stimulus }).eq('id', task.id);
  console.log('task_number 1 update:', updErr || 'ok');

  const removePaths = CLIPS_TO_FIX.map((c) => pathFromUrl(c.oldUrl)).filter(Boolean);
  const { error: rmErr } = await admin.storage.from(HOEREN_BUCKET).remove(removePaths);
  console.log('old file cleanup:', rmErr || 'ok', removePaths);

  console.log('\nDone.');
})().catch((e) => { console.error('CRASHED', e); process.exit(1); });
