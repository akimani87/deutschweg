// DeutschWeg — Phase B server-side test fixtures, part 2: seeded
// sprechen_sessions rows covering the named valid-conversation classification
// dimensions (examiner-only, too-few-turns, insufficient-speech, startup
// failure, feedback-already-failed, genuinely-valid-pending). Requires
// phaseb-sprechen-fixtures.js to have run first (reads its output for userA
// and the shared written-module attempt ids).
//
// Run from the repo root: node scripts/phaseb-sprechen-classification-fixtures.js

const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const admin = createClient('https://udmunxzzuqoynlftapwh.supabase.co', process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const fixtures = JSON.parse(fs.readFileSync(path.join(__dirname, 'phaseb-sprechen-fixtures.json'), 'utf8'));

const HOEREN_EXAM = '90bfdfdd-e3db-4f03-a05e-f1de88069451';
const LESEN_EXAM = '3b37d46f-cf4c-4d9b-a518-d56d33cb162c';
const SCHREIBEN_EXAM = '86a62193-de5f-46ee-bfa1-1c49fdaadfab';

let setCounter = 9100;
async function makeSet() {
  setCounter++;
  const { data, error } = await admin.from('mock_exam_sets').insert({
    level: 'A1', set_number: setCounter, title: 'PhaseB classification test set ' + setCounter,
    hoeren_exam_id: HOEREN_EXAM, lesen_exam_id: LESEN_EXAM, schreiben_exam_id: SCHREIBEN_EXAM,
    is_published: false,
  }).select('id').single();
  if (error) throw new Error('set insert failed: ' + error.message);
  return data.id;
}
async function makeAttempt(setId) {
  const { data, error } = await admin.from('mock_exam_attempts').insert({
    user_id: fixtures.userA.userId, set_id: setId, current_section: 'sprechen',
    hoeren_attempt_id: fixtures.hoerenId, lesen_attempt_id: fixtures.lesenId, schreiben_attempt_id: fixtures.schreibenId,
  }).select('id').single();
  if (error) throw new Error('attempt insert failed: ' + error.message);
  return data.id;
}
async function seedSession(attemptId, { entries, durationSeconds, endReason, feedbackAttempts }) {
  const transcript = entries.map((e) => (e.role === 'examiner' ? 'Examiner (Prüfer): ' : 'Candidate (Kandidat): ') + e.text).join('\n');
  const { data, error } = await admin.from('sprechen_sessions').insert({
    user_id: fixtures.userA.userId, level: 'A1', feedback_language: 'english', completed: false,
    mock_exam_attempt_id: attemptId, transcript, duration_seconds: durationSeconds,
    end_reason: endReason, feedback_attempts: feedbackAttempts || 0,
  }).select('id').single();
  if (error) throw new Error('session seed failed: ' + error.message);
  return data.id;
}

const VALID_CONVO = [
  { role: 'examiner', text: 'Guten Tag! Wie heißen Sie und woher kommen Sie?' },
  { role: 'candidate', text: 'Ich heiße Amara. Ich komme aus Ghana und wohne in Berlin.' },
  { role: 'examiner', text: 'Schön. Was sehen Sie auf dem Bild?' },
  { role: 'candidate', text: 'Ich sehe eine Familie in der Küche. Sie kochen zusammen und lachen viel.' },
  { role: 'examiner', text: 'Gut. Wollen wir zusammen einen Ausflug planen?' },
  { role: 'candidate', text: 'Ja gerne. Wir können am Samstag in den Park gehen und ein Picknick machen.' },
  { role: 'examiner', text: 'Welche Uhrzeit passt Ihnen?' },
  { role: 'candidate', text: 'Vielleicht um zehn Uhr morgens, wenn das Wetter gut ist.' },
];

async function main() {
  const out = {};

  const setA = await makeSet(); const attA = await makeAttempt(setA);
  await seedSession(attA, {
    entries: [
      { role: 'examiner', text: 'Guten Tag! Wie heißen Sie?' },
      { role: 'examiner', text: 'Können Sie mich hören?' },
      { role: 'examiner', text: 'Hallo? Sind Sie noch da?' },
    ],
    durationSeconds: 45, endReason: 'client_end',
  });
  out.attemptExaminerOnly = attA;

  const setB = await makeSet(); const attB = await makeAttempt(setB);
  await seedSession(attB, {
    entries: [
      { role: 'examiner', text: 'Guten Tag! Wie heißen Sie?' },
      { role: 'candidate', text: 'Ich heiße Bello.' },
      { role: 'examiner', text: 'Erzählen Sie mehr von sich.' },
      { role: 'candidate', text: 'Ich komme aus Nigeria und wohne seit drei Jahren in München mit meiner Familie und meinen Kindern.' },
    ],
    durationSeconds: 120, endReason: 'timeout',
  });
  out.attemptTooFewTurns = attB;

  const setC = await makeSet(); const attC = await makeAttempt(setC);
  await seedSession(attC, {
    entries: [
      { role: 'examiner', text: 'Wie heißen Sie?' }, { role: 'candidate', text: 'Ja.' },
      { role: 'examiner', text: 'Woher kommen Sie?' }, { role: 'candidate', text: 'Nein danke.' },
      { role: 'examiner', text: 'Was machen Sie beruflich?' }, { role: 'candidate', text: 'Gut.' },
      { role: 'examiner', text: 'Wie finden Sie Deutschland?' }, { role: 'candidate', text: 'Okay.' },
      { role: 'examiner', text: 'Möchten Sie noch etwas sagen?' }, { role: 'candidate', text: 'Ähm ja.' },
    ],
    durationSeconds: 180, endReason: 'client_end',
  });
  out.attemptInsufficientSpeech = attC;

  const setD = await makeSet(); const attD = await makeAttempt(setD);
  await seedSession(attD, { entries: [], durationSeconds: 8, endReason: 'upstream_closed' });
  out.attemptStartupFailure = attD;

  const setE = await makeSet(); const attE = await makeAttempt(setE);
  await seedSession(attE, { entries: VALID_CONVO, durationSeconds: 300, endReason: 'client_end', feedbackAttempts: 1 });
  const sessE = await admin.from('sprechen_sessions').select('id').eq('mock_exam_attempt_id', attE).single();
  out.attemptFeedbackFailed = attE;
  out.sessionFeedbackFailed = sessE.data.id;

  const setF = await makeSet(); const attF = await makeAttempt(setF);
  await seedSession(attF, { entries: VALID_CONVO, durationSeconds: 300, endReason: 'client_end', feedbackAttempts: 0 });
  const sessF = await admin.from('sprechen_sessions').select('id').eq('mock_exam_attempt_id', attF).single();
  out.attemptValidPending = attF;
  out.sessionValidPending = sessF.data.id;

  fs.writeFileSync(path.join(__dirname, 'phaseb-sprechen-classification-fixtures.json'), JSON.stringify(out, null, 2));
  console.log('CLASSIFICATION FIXTURES WRITTEN to scripts/phaseb-sprechen-classification-fixtures.json');
}

main().then(() => process.exit(0)).catch((e) => { console.error('SETUP FAILED', e); process.exit(1); });
