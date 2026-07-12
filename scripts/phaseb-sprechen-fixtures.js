// DeutschWeg — Phase B (Sprechen + Complete Mock Exam) server-side test
// fixtures, part 1: disposable users, written-module attempts, and the
// core set of mock_exam_attempts states (ready / completed / wrong-section
// / reserved-for-restart) needed by phaseb-sprechen-server-tests.js.
//
// Run from the repo root: node scripts/phaseb-sprechen-fixtures.js
// Requires SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY in .env (same as
// server.js). Writes fixtures.json next to this script — never commit that
// file (it contains real, if disposable, user access tokens).
//
// All rows created here are deleted by phaseb-sprechen-cleanup.js.

const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const URL = 'https://udmunxzzuqoynlftapwh.supabase.co';
const ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVkbXVueHp6dXFveW5sZnRhcHdoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQyNTEzMzEsImV4cCI6MjA4OTgyNzMzMX0.CnSrfql7wlUZsvOambviF60tFCXqY0sxi_VomDeScgQ';
const admin = createClient(URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const anon  = createClient(URL, ANON_KEY, { auth: { persistSession: false } });

const SET_ID = '5ee6bc78-d61e-46c6-ad4d-aa9e2f1509d3'; // A1 — Übungssatz 1 (real, published)
const HOEREN_EXAM = '90bfdfdd-e3db-4f03-a05e-f1de88069451';
const LESEN_EXAM = '3b37d46f-cf4c-4d9b-a518-d56d33cb162c';
const SCHREIBEN_EXAM = '86a62193-de5f-46ee-bfa1-1c49fdaadfab';

const stamp = Date.now();
const PASSWORD = 'Test1234!ab';

async function makeUser(tag) {
  const email = `dw-phaseb-${tag}-${stamp}@example.com`;
  const { data: created, error: createErr } = await admin.auth.admin.createUser({
    email, password: PASSWORD, email_confirm: true,
  });
  if (createErr) throw new Error('createUser failed: ' + createErr.message);
  const userId = created.user.id;
  const { data: signIn, error: signInErr } = await anon.auth.signInWithPassword({ email, password: PASSWORD });
  if (signInErr) throw new Error('signIn failed: ' + signInErr.message);
  return { email, userId, accessToken: signIn.session.access_token };
}

async function makeWrittenAttempt(userId, examId) {
  const { data, error } = await admin.from('exam_attempts').insert({
    user_id: userId, exam_id: examId, answers: {}, scores: {},
    total_score: 12, max_score: 15, completed_at: new Date().toISOString(),
  }).select('id').single();
  if (error) throw new Error('exam_attempts insert failed: ' + error.message);
  return data.id;
}

// mock_exam_attempts_one_active only allows one INCOMPLETE (completed_at IS
// NULL) attempt per (user_id, set_id) — correct product behavior, but it
// means concurrent incomplete test attempts for the same user each need
// their own set. Cheap throwaway sets, same underlying exam ids,
// unpublished (never visible to real learners).
let setCounter = 9000;
async function makeTestSet() {
  setCounter++;
  const { data, error } = await admin.from('mock_exam_sets').insert({
    level: 'A1', set_number: setCounter, title: 'PhaseB test set ' + setCounter + ' (' + stamp + ')',
    hoeren_exam_id: HOEREN_EXAM, lesen_exam_id: LESEN_EXAM, schreiben_exam_id: SCHREIBEN_EXAM,
    is_published: false,
  }).select('id').single();
  if (error) throw new Error('mock_exam_sets insert failed: ' + error.message);
  return data.id;
}

async function makeMockAttempt(userId, setId, overrides) {
  const row = Object.assign({ user_id: userId, set_id: setId, current_section: 'sprechen' }, overrides);
  const { data, error } = await admin.from('mock_exam_attempts').insert(row).select('*').single();
  if (error) throw new Error('mock_exam_attempts insert failed: ' + error.message);
  return data;
}

async function main() {
  const userA = await makeUser('a');
  const userB = await makeUser('b');
  console.log('userA', userA.userId, userA.email);
  console.log('userB', userB.userId, userB.email);

  const hoerenId = await makeWrittenAttempt(userA.userId, HOEREN_EXAM);
  const lesenId = await makeWrittenAttempt(userA.userId, LESEN_EXAM);
  const schreibenId = await makeWrittenAttempt(userA.userId, SCHREIBEN_EXAM);

  const setReady = await makeTestSet();
  const setCompleted = await makeTestSet();
  const setWrongSection = await makeTestSet();
  const setRestart = await makeTestSet();

  const attemptReady = await makeMockAttempt(userA.userId, setReady, {
    hoeren_attempt_id: hoerenId, lesen_attempt_id: lesenId, schreiben_attempt_id: schreibenId,
  });
  const attemptCompleted = await makeMockAttempt(userA.userId, setCompleted, {
    hoeren_attempt_id: hoerenId, lesen_attempt_id: lesenId, schreiben_attempt_id: schreibenId,
    current_section: null, completed_at: new Date().toISOString(),
  });
  const attemptWrongSection = await makeMockAttempt(userA.userId, setWrongSection, {
    hoeren_attempt_id: hoerenId, lesen_attempt_id: lesenId, schreiben_attempt_id: null,
    current_section: 'lesen',
  });
  const attemptForRestart = await makeMockAttempt(userA.userId, setRestart, {
    hoeren_attempt_id: hoerenId, lesen_attempt_id: lesenId, schreiben_attempt_id: schreibenId,
  });

  const fixtures = {
    userA, userB, hoerenId, lesenId, schreibenId,
    setReady, setCompleted, setWrongSection, setRestart,
    attemptReady: attemptReady.id,
    attemptCompleted: attemptCompleted.id,
    attemptWrongSection: attemptWrongSection.id,
    attemptForRestart: attemptForRestart.id,
    nonexistentAttempt: '00000000-0000-0000-0000-000000000000',
  };
  fs.writeFileSync(path.join(__dirname, 'phaseb-sprechen-fixtures.json'), JSON.stringify(fixtures, null, 2));
  console.log('FIXTURES WRITTEN to scripts/phaseb-sprechen-fixtures.json');
}

main().then(() => process.exit(0)).catch((e) => { console.error('SETUP FAILED', e); process.exit(1); });
