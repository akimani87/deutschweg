/**
 * A1 Mock Exam 3 — reword Lesen Teil 2 Item 9's situational prompt so it's
 * no longer verbatim identical to Übungssatz 2's equivalent item.
 *
 * Before: "Sie möchten wissen, wann der nächste Deutschkurs für Anfänger
 *          beginnt." — byte-identical to Übungssatz 2 Lesen Teil 2 item 4
 *          (task 1b5ca722-d97b-487a-b96d-0d61e9441f65), caught by
 *          validate-mock-exams.js's duplicates.exact_question_text check
 *          at --level scope.
 * After:   Same underlying need (find a beginner course's start date),
 *          same information target (Kurstermine page has the date, Preise
 *          page doesn't — correct_answer stays "b"), same A1 difficulty —
 *          only the scenario phrasing changes.
 *
 * Not certified yet (is_certified_mock_exam=false) — safe to edit
 * directly, no recertification/hash implications.
 */
require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const LESEN_T2_TASK_ID = 'c397ba55-f11f-400d-94ee-1fd0b2161b5a'; // A1 Mock Exam 3, Lesen task_number=2
const OLD_Q = 'Sie möchten wissen, wann der nächste Deutschkurs für Anfänger beginnt.';
const NEW_Q = 'Sie möchten Deutsch lernen und suchen den Starttermin für den nächsten Anfängerkurs.';

(async () => {
  const { data: task, error: readErr } = await sb.from('exam_tasks').select('stimulus').eq('id', LESEN_T2_TASK_ID).single();
  if (readErr) { console.error('Read FAILED:', readErr); process.exit(1); }

  const questions = task.stimulus.questions;
  const idx = questions.findIndex((q) => q.q === OLD_Q);
  if (idx === -1) { console.error('Guard: expected old question text not found — aborting without writing.'); process.exit(1); }
  if (questions[idx].answer !== 'b') { console.error('Guard: correct answer is not "b" as expected — aborting without writing.'); process.exit(1); }

  questions[idx].q = NEW_Q;
  // options/answer/explanation deliberately untouched — only the
  // situational-prompt sentence changes.

  const { error: writeErr } = await sb.from('exam_tasks').update({ stimulus: task.stimulus }).eq('id', LESEN_T2_TASK_ID);
  if (writeErr) { console.error('Write FAILED:', writeErr); process.exit(1); }

  console.log('Reworded. Before:', JSON.stringify(OLD_Q));
  console.log('           After:', JSON.stringify(NEW_Q));
})();
