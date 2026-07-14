/**
 * Übungssatz 2 (A1) Hören — audit-trail fix #2 (human-review round 2).
 *
 * Human review found a content-validity defect in Teil 1 Clip 1: Q3 asks
 * "Wer schlägt vor, ins Café Sonne zu gehen?" (correct answer "Lukas"),
 * but "Lukas" was only ever a transcript LABEL — labels are stripped
 * before synthesis (see hoerenConversationSegments in server.js and the
 * same logic in fix-uebungssatz-2-speaker-voices.js) — so his name was
 * never actually spoken in the audio. The item was unanswerable from the
 * recording alone.
 *
 * Smallest safe fix: Sofia now greets him back by name ("Hallo Lukas!"),
 * a natural reciprocal greeting rather than an artificial phone-call-style
 * self-introduction that wouldn't fit this casual dialogue. Q1/Q2 and all
 * options/correct answers are unchanged; only Q3's explanation was
 * tightened to cite the new exact clue.
 *
 * Already run once against production — kept as a record of how the fix
 * was produced, not meant to be re-run.
 */
require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const admin = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

const HOEREN_BUCKET = 'hoerverstehen-audio';
const HOEREN_VOICE_MALE = 'pNInz6obpgDQGcFmaJgB'; // ElevenLabs "Adam" — Lukas, same voice as fix #1
const HOEREN_VOICE_B = process.env.HOEREN_VOICE_B || 'EXAVITQu4vr4xnSDxMaL'; // Sofia — unchanged
const MODEL_ID = process.env.ELEVENLABS_MODEL_ID || 'eleven_turbo_v2_5';
const OLD_AUDIO_URL = 'https://udmunxzzuqoynlftapwh.supabase.co/storage/v1/object/public/hoerverstehen-audio/conversation/1784015496290-wsqu6n.mp3';
const HOEREN_ID = '1204664c-f3b9-4cc2-90fa-1e1c2a5c0e47';

const NEW_SCRIPT =
  'Sprecher 1: Hallo Sofia! Hast du morgen Zeit für einen Kaffee?\n' +
  'Sprecher 2: Hallo Lukas! Ja klar, ich habe Zeit. Wo treffen wir uns?\n' +
  'Sprecher 1: Wie wäre es im Café Sonne? Das ist in der Bahnhofstraße.\n' +
  'Sprecher 2: Gute Idee! Um wie viel Uhr denn?\n' +
  'Sprecher 1: Passt dir zehn Uhr?\n' +
  'Sprecher 2: Zehn Uhr ist perfekt. Bis morgen!\n' +
  'Sprecher 1: Bis morgen, Sofia!';

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

function pathFromUrl(url) {
  const marker = '/' + HOEREN_BUCKET + '/';
  const i = url.indexOf(marker);
  return i >= 0 ? url.slice(i + marker.length) : null;
}

(async () => {
  console.log('Synthesizing corrected clip...');
  const segs = segments(NEW_SCRIPT);
  const buffers = [];
  for (const s of segs) buffers.push(await hoerenTTS(s.text, s.voice));
  const audio = Buffer.concat(buffers);

  const remoteName = `conversation/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.mp3`;
  const { error: upErr } = await admin.storage.from(HOEREN_BUCKET).upload(remoteName, audio, { contentType: 'audio/mpeg' });
  if (upErr) { console.error('UPLOAD FAILED', upErr.message); process.exit(1); }
  const { data: pub } = admin.storage.from(HOEREN_BUCKET).getPublicUrl(remoteName);
  console.log('New audio:', pub.publicUrl, `(${(audio.length / 1024).toFixed(0)} KB)`);

  const { data: task, error: fetchErr } = await admin.from('exam_tasks').select('id, stimulus').eq('exam_id', HOEREN_ID).eq('task_number', 1).single();
  if (fetchErr) { console.error(fetchErr); process.exit(1); }

  const clip = task.stimulus.clips[0];
  clip.audio_url = pub.publicUrl;
  clip.transcript = NEW_SCRIPT.replace(/Sprecher (1|2):/g, (m, n) => n === '1' ? 'Lukas:' : 'Sofia:');
  clip.questions[2].explanation = 'Sofia begrüßt ihn direkt mit "Hallo Lukas!" — er ist der Sprecher, der danach vorschlägt: "Wie wäre es im Café Sonne?"; Sofia stimmt zu ("Gute Idee!").';

  const { error: updErr } = await admin.from('exam_tasks').update({ stimulus: task.stimulus }).eq('id', task.id);
  console.log('DB update:', updErr || 'ok');

  const { error: rmErr } = await admin.storage.from(HOEREN_BUCKET).remove([pathFromUrl(OLD_AUDIO_URL)]);
  console.log('old file cleanup:', rmErr || 'ok');

  console.log('\nDone.');
})().catch((e) => { console.error('CRASHED', e); process.exit(1); });
