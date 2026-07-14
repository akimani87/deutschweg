/**
 * Read-only validator for mock_exam_sets / exams / exam_tasks content.
 *
 * Does NOT edit, certify, publish, repair, or delete anything — every
 * query in this file is a SELECT. It only reads and reports.
 *
 * Usage:
 *   node scripts/validate-mock-exams.js --set <mock_exam_sets.id>
 *   node scripts/validate-mock-exams.js --level A1
 *   node scripts/validate-mock-exams.js --published
 *   node scripts/validate-mock-exams.js                (default: all sets)
 *   node scripts/validate-mock-exams.js --exam <exams.id>      (single exam, standalone)
 *   node scripts/validate-mock-exams.js --unlinked [--level A1] (exams not referenced by any set)
 *
 * Add --json[=path] to also write a machine-readable report
 * (default path: mock-exam-validation-report.json in the repo root).
 *
 * Exit code: 1 if any FAIL was produced, 0 otherwise (WARNINGs don't fail the run).
 */
require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

const LEVELS = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];
const SECTIONS = ['hoeren', 'lesen', 'schreiben', 'sprechen'];

// Official Start Deutsch 1 structure, per mock-exam-certification-checklist.md.
// Used to grade set-linked (mock exam) exams strictly; unlinked/practice-pool
// exams are checked against the same shape but mismatches are WARNING, not
// FAIL, per the checklist's own scoping ("this gate applies only to Mock
// Exam content").
const EXPECTED = {
  hoeren:    { taskCount: 3, questionsByTaskNumber: { 1: 6, 2: 4, 3: 5 }, totalMaxScore: 15 },
  lesen:     { taskCount: 3, questionsByTaskNumber: { 1: 5, 2: 5, 3: 5 }, totalMaxScore: 15 },
  schreiben: { taskCount: 2, totalMaxScore: 15 },
};

// ── CLI args ────────────────────────────────────────────────────────────
function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--set') out.set = argv[++i];
    else if (a === '--level') out.level = argv[++i];
    else if (a === '--published') out.published = true;
    else if (a === '--exam') out.exam = argv[++i];
    else if (a === '--unlinked') out.unlinked = true;
    else if (a.startsWith('--json')) out.json = a.includes('=') ? a.split('=')[1] : 'mock-exam-validation-report.json';
  }
  return out;
}

// ── Text helpers ────────────────────────────────────────────────────────
function normalize(s) {
  return (s || '')
    .toString()
    .toLowerCase()
    .normalize('NFKD').replace(/[̀-ͯ]/g, '') // strip diacritics for the *normalized* comparison only
    .replace(/[^\p{L}\p{N}\s]/gu, '')
    .replace(/\s+/g, ' ')
    .trim();
}

// ── Finding collector ───────────────────────────────────────────────────
function makeCollector() {
  const findings = [];
  function add(severity, category, scope, message) {
    findings.push({ severity, category, scope, message });
  }
  return { findings, add };
}

// ── Per-task text/answer extraction (task_type-aware) ──────────────────
// Returns { questionTexts: [{text, explanation, hasAnswer}], sourceTexts: [string], audioUrls: [string] }
function extractTaskContent(task) {
  const stim = task.stimulus || {};
  const out = { questionTexts: [], sourceTexts: [], audioUrls: [], playCounts: [], transcriptsMissing: 0, totalClips: 0, totalClipItems: 0 };

  if (task.task_type === 'listening_multiple_choice' || task.task_type === 'listening_true_false') {
    const clips = Array.isArray(stim.clips) ? stim.clips : [];
    if (typeof stim.play_count === 'number') out.playCounts.push(stim.play_count);
    clips.forEach((clip) => {
      out.totalClips++;
      if (clip.audio_url) out.audioUrls.push(clip.audio_url);
      if (clip.scenario) out.sourceTexts.push(clip.scenario);
      if (!clip.transcript && !clip.full_script) out.transcriptsMissing++;
      (clip.questions || []).forEach((q) => {
        out.totalClipItems++;
        out.questionTexts.push({
          text: q.question_text || '',
          explanation: q.explanation || '',
          hasAnswer: Boolean(q.correct_answer),
        });
      });
    });
  } else if (task.task_type === 'true_false') {
    (stim.texts || []).forEach((t) => { if (t.text) out.sourceTexts.push(t.text); });
    if (stim.text) out.sourceTexts.push(stim.text);
    (stim.statements || []).forEach((s) => {
      out.questionTexts.push({
        text: s.s || '',
        explanation: s.explanation || '',
        hasAnswer: typeof s.answer === 'boolean',
      });
    });
  } else if (task.task_type === 'multiple_choice') {
    if (stim.text) out.sourceTexts.push(stim.text);
    (stim.questions || []).forEach((q) => {
      const opts = q.options || {};
      out.questionTexts.push({
        text: q.q || '',
        explanation: q.explanation || '',
        hasAnswer: Boolean(q.answer) && Object.prototype.hasOwnProperty.call(opts, q.answer),
      });
    });
  } else if (task.task_type === 'form_fill') {
    if (stim.text) out.sourceTexts.push(stim.text);
    const fields = Array.isArray(stim.fields) ? stim.fields : [];
    const answers = Array.isArray(stim.answers) ? stim.answers : [];
    fields.forEach((f, i) => {
      out.questionTexts.push({
        text: f || '',
        explanation: '',
        hasAnswer: Boolean(answers[i]) && String(answers[i]).trim().length > 0,
      });
    });
    out._fieldAnswerLenMismatch = fields.length !== answers.length;
  } else if (task.task_type === 'short_message' || task.task_type === 'discussion_post') {
    if (stim.message) out.sourceTexts.push(stim.message);
    if (stim.text) out.sourceTexts.push(stim.text);
    out.questionTexts.push({
      text: stim.message || stim.topic || '',
      explanation: '',
      hasAnswer: Boolean(stim.example_answer),
    });
    out._wordTarget = stim.word_target;
    out._wordMin = stim.word_min;
  } else {
    // matching / matching_adverts / people_matching / gap_fill / headline_matching / section_matching —
    // not part of the certified A1 structure today; extract generically so
    // duplicate/answer checks still see *something* rather than silently
    // skipping unrecognized types.
    const arr = stim.people || stim.paragraphs || stim.headlines || stim.gaps || stim.statements || [];
    (Array.isArray(arr) ? arr : []).forEach((item) => {
      out.questionTexts.push({
        text: (item && (item.text || item.s || item.title)) || '',
        explanation: '',
        hasAnswer: null, // unknown shape — not scored here
      });
    });
  }
  return out;
}

// ── Exam-level checks (works for both set-linked and standalone exams) ──
function checkExam(exam, tasks, add, opts) {
  const scope = { type: 'exam', id: exam.id, title: exam.title };
  const strict = Boolean(opts && opts.strict); // true when this exam is claimed as mock-exam-certified content

  if (SECTIONS.includes(exam.section)) {
    add('PASS', 'exam.section_valid', scope, `section "${exam.section}" is a recognized value`);
  } else {
    add('FAIL', 'exam.section_valid', scope, `section "${exam.section}" is not one of ${SECTIONS.join('/')}`);
  }

  const sorted = tasks.slice().sort((a, b) => a.order_index - b.order_index);
  const orderIndexes = sorted.map((t) => t.order_index);
  const expectedOrder = orderIndexes.slice().sort((a, b) => a - b);
  const isSequential = expectedOrder.every((v, i) => v === i + 1);
  const hasDupOrder = new Set(orderIndexes).size !== orderIndexes.length;
  if (tasks.length === 0) {
    add('FAIL', 'exam.task_order_complete', scope, 'exam has zero exam_tasks rows');
  } else if (hasDupOrder) {
    add('FAIL', 'exam.task_order_complete', scope, `duplicate order_index values: ${orderIndexes.join(',')}`);
  } else if (!isSequential) {
    add('WARNING', 'exam.task_order_complete', scope, `order_index is not a clean 1..N sequence: ${orderIndexes.join(',')}`);
  } else {
    add('PASS', 'exam.task_order_complete', scope, `order_index is a complete 1..${tasks.length} sequence`);
  }

  const expected = EXPECTED[exam.section];
  if (expected) {
    const sev = tasks.length === expected.taskCount ? 'PASS' : (strict ? 'FAIL' : 'WARNING');
    add(sev, 'exam.task_count_matches_expected', scope,
      `expected ${expected.taskCount} tasks for ${exam.section}, found ${tasks.length}` + (strict ? '' : ' (not certified — checked informationally, not enforced)'));
  }

  // Answer keys + explanations, aggregated across all tasks in this exam.
  let missingAnswers = 0, totalQuestions = 0, missingExplanations = 0, explanationApplicable = 0;
  let totalScore = 0;
  let hoerenTranscriptsMissing = 0, hoerenTotalClips = 0, hoerenTotalClipItems = 0;
  const audioUrlsInExam = [];
  const fieldAnswerMismatchTasks = [];

  tasks.forEach((task) => {
    totalScore += (typeof task.max_score === 'number' ? task.max_score : 0);
    if (typeof task.max_score !== 'number' || task.max_score <= 0) {
      add('FAIL', 'exam.scoring_valid', { type: 'task', id: task.id, exam: exam.id, task_number: task.task_number },
        `max_score is missing or non-positive (${task.max_score})`);
    }
    const extracted = extractTaskContent(task);
    audioUrlsInExam.push(...extracted.audioUrls);
    hoerenTranscriptsMissing += extracted.transcriptsMissing;
    hoerenTotalClips += extracted.totalClips;
    hoerenTotalClipItems += extracted.totalClipItems;
    if (extracted._fieldAnswerLenMismatch) fieldAnswerMismatchTasks.push(task.task_number);

    extracted.questionTexts.forEach((q) => {
      totalQuestions++;
      if (q.hasAnswer === false) missingAnswers++;
      if (['listening_multiple_choice', 'listening_true_false', 'true_false', 'multiple_choice'].includes(task.task_type)) {
        explanationApplicable++;
        if (!q.explanation) missingExplanations++;
      }
    });

    if (expected && expected.questionsByTaskNumber) {
      const want = expected.questionsByTaskNumber[task.task_number];
      const got = extracted.questionTexts.length;
      if (want != null) {
        const sev = got === want ? 'PASS' : (strict ? 'FAIL' : 'WARNING');
        add(sev, 'exam.audio_question_counts_align', { type: 'task', id: task.id, exam: exam.id, task_number: task.task_number },
          `Teil ${task.task_number}: expected ${want} items, found ${got}`);
      }
    }
  });

  if (totalQuestions === 0) {
    add('FAIL', 'exam.answer_keys_present', scope, 'no scoreable question/field items found across all tasks');
  } else if (missingAnswers > 0) {
    add('FAIL', 'exam.answer_keys_present', scope, `${missingAnswers}/${totalQuestions} question/field items have no correct answer defined`);
  } else {
    add('PASS', 'exam.answer_keys_present', scope, `all ${totalQuestions} question/field items have a correct answer defined`);
  }

  if (fieldAnswerMismatchTasks.length) {
    add('FAIL', 'exam.form_fill_fields_answers_length', scope, `form_fill fields[]/answers[] length mismatch in task_number ${fieldAnswerMismatchTasks.join(',')}`);
  }

  if (explanationApplicable > 0) {
    const sev = missingExplanations === 0 ? 'PASS' : 'WARNING';
    add(sev, 'exam.explanations_present', scope,
      missingExplanations === 0
        ? `all ${explanationApplicable} MC/true-false items have an explanation`
        : `${missingExplanations}/${explanationApplicable} MC/true-false items have no explanation`);
  }

  if (expected && expected.totalMaxScore != null) {
    if (exam.section === 'schreiben') {
      // The DB-declared max_score sum is NOT what actually gets scored for
      // A1: server.js's /api/exam-grade hardcodes the short_message ceiling
      // to 12 (Erfüllung max 3 + Kommunikative max 3, doubled) regardless
      // of what's stored here, and adds the real (DB-driven) form_fill max
      // on top. So the TRUE runtime max for a 1-form_fill+1-short_message
      // A1 Schreiben exam is (form_fill max_score) + 12, not necessarily 15 —
      // comparing the raw DB sum to 15 is informational only, not a defect.
      add('WARNING', 'exam.scoring_totals_valid', scope,
        `total max_score declared across tasks is ${totalScore}. Note: A1 Schreiben's REAL runtime max is (form_fill max_score) + 12 ` +
        `(server.js hardcodes the short_message ceiling to 12 regardless of this task's declared max_score) — the declared total here is ` +
        `informational/UI-badge only, not what actually gets scored or saved.`);
    } else {
      const sev = totalScore === expected.totalMaxScore ? 'PASS' : 'WARNING';
      add(sev, 'exam.scoring_totals_valid', scope,
        `total max_score across tasks is ${totalScore} (official structure totals ${expected.totalMaxScore} — mismatch is non-fatal, scores are scaled proportionally, but worth reviewing)`);
    }
  }

  // Hören-specific: audio references + transcripts + playback metadata.
  if (exam.section === 'hoeren') {
    const missingAudio = tasks.some((t) => {
      const clips = (t.stimulus && t.stimulus.clips) || [];
      return clips.some((c) => !c.audio_url);
    });
    add(missingAudio ? 'FAIL' : 'PASS', 'hoeren.audio_references_exist', scope,
      missingAudio ? 'one or more clips have no audio_url' : 'every clip has an audio_url');

    if (hoerenTotalClips > 0) {
      if (hoerenTranscriptsMissing === 0) {
        add('PASS', 'hoeren.transcripts_exist', scope, `all ${hoerenTotalClips} clips have a stored full transcript field`);
      } else {
        add('WARNING', 'hoeren.transcripts_exist', scope,
          `${hoerenTranscriptsMissing}/${hoerenTotalClips} clips have no stored full transcript field — ` +
          `this is a schema-wide gap (no "transcript"/"full_script" field exists in stimulus.clips by default), not necessarily specific to this exam. ` +
          `Without it, only a short English "scenario" line + per-question "explanation" fragments exist for reviewer verification.`);
      }
    }

    const missingPlayCount = tasks.some((t) => typeof (t.stimulus && t.stimulus.play_count) !== 'number');
    add(missingPlayCount ? 'FAIL' : 'PASS', 'hoeren.playback_metadata_present', scope,
      missingPlayCount ? 'one or more tasks are missing stimulus.play_count' : 'every task has stimulus.play_count');
  }

  // Lesen-specific.
  if (exam.section === 'lesen') {
    const missingSource = tasks.some((t) => {
      const s = t.stimulus || {};
      if (Boolean(s.text) || (Array.isArray(s.texts) && s.texts.some((x) => x.text))) return false;
      // Kleinanzeigen-style multiple_choice: each question's own options ARE
      // the source text (short ad snippets) rather than one shared passage —
      // legitimate, not missing content.
      if (t.task_type === 'multiple_choice' && Array.isArray(s.questions) && s.questions.length) {
        return !s.questions.every((q) => q.options && Object.values(q.options).some((v) => v && String(v).trim()));
      }
      return true;
    });
    add(missingSource ? 'FAIL' : 'PASS', 'lesen.source_text_exists', scope,
      missingSource ? 'one or more tasks have no source text' : 'every task has source text');
  }

  // Schreiben-specific.
  if (exam.section === 'schreiben') {
    tasks.forEach((task) => {
      const s = task.stimulus || {};
      const taskScope = { type: 'task', id: task.id, exam: exam.id, task_number: task.task_number };
      if (task.task_type === 'form_fill') {
        add(s.text ? 'PASS' : 'FAIL', 'schreiben.prompt_exists', taskScope, s.text ? 'form_fill has intro text' : 'form_fill has no intro text');
      } else if (task.task_type === 'short_message' || task.task_type === 'discussion_post') {
        add(s.message || s.topic ? 'PASS' : 'FAIL', 'schreiben.prompt_exists', taskScope, 'writing prompt present');
        // stim.bullet_points is a real, already-wired convention — the
        // renderer displays it to the learner as the visible content-points
        // list (renderShortMessage()'s bulletsHtml). Only genuinely absent
        // content points are a gap; the field itself is not a schema gap.
        const hasBulletPoints = Array.isArray(s.bullet_points) && s.bullet_points.length >= 2;
        add(hasBulletPoints ? 'PASS' : 'WARNING', 'schreiben.content_points_structured', taskScope,
          hasBulletPoints
            ? `${s.bullet_points.length} content points defined in bullet_points (shown to the learner)`
            : 'no bullet_points array (or fewer than 2 items) — content points are only implied inside free-text instructions, not structured');
        // register/communication_purpose/evaluation_criteria have no
        // renderer or grading hook (server.js's A1 grading prompt hardcodes
        // an informal-only expectation for every A1 short_message task) —
        // these are review-only metadata conventions, not read by any code.
        add(s.register ? 'PASS' : 'WARNING', 'schreiben.register_defined', taskScope,
          s.register
            ? `register documented as "${s.register}" (review-only metadata — the grading prompt does not read this field; A1 grading currently hardcodes an informal/du-form expectation regardless)`
            : 'no register documented — implied inside free-text instructions only');
        const usesExplicitLength = s.word_target != null || s.word_min != null;
        add('PASS', 'schreiben.expected_length_exists', taskScope,
          usesExplicitLength
            ? `explicit word_target=${s.word_target} / word_min=${s.word_min}`
            : 'no explicit word_target/word_min — falls back to app defaults (target 40 / min 20), which is a legitimate but implicit choice');
        add(s.example_answer ? 'PASS' : 'WARNING', 'schreiben.evaluation_configuration_exists', taskScope,
          s.example_answer
            ? 'example_answer present' + (Array.isArray(s.evaluation_criteria) && s.evaluation_criteria.length ? ` + ${s.evaluation_criteria.length} documented evaluation_criteria (review-only — grading itself uses its own fixed server-side rubric, unaffected by this field)` : ' (used as informal grading reference) — no separate evaluation_criteria list present')
            : 'no example_answer and no structured rubric — grading has no stored reference at all');
      }
    });
  }

  return { audioUrlsInExam, totalScore };
}

// ── Set-level checks ─────────────────────────────────────────────────────
async function checkSet(set, allSetsAtLevel, add) {
  const scope = { type: 'set', id: set.id, title: set.title };
  add('PASS', 'set.set_exists', scope, 'row fetched successfully');

  if (LEVELS.includes(set.level)) {
    add('PASS', 'set.level_valid', scope, `level "${set.level}" recognized`);
  } else {
    add('FAIL', 'set.level_valid', scope, `level "${set.level}" is not a recognized level`);
  }

  const sameLevelSameNumber = allSetsAtLevel.filter((s) => s.set_number === set.set_number);
  if (sameLevelSameNumber.length > 1) {
    add('FAIL', 'set.set_number_unique', scope, `set_number ${set.set_number} is used by ${sameLevelSameNumber.length} sets at level ${set.level}: ${sameLevelSameNumber.map((s) => s.id).join(', ')}`);
  } else {
    add('PASS', 'set.set_number_unique', scope, `set_number ${set.set_number} is unique within level ${set.level}`);
  }

  const links = [
    ['hoeren', set.hoeren_exam_id],
    ['lesen', set.lesen_exam_id],
    ['schreiben', set.schreiben_exam_id],
  ];
  const linkedExams = {};
  for (const [section, examId] of links) {
    if (!examId) {
      add('FAIL', `set.${section}_exam_linked`, scope, `${section}_exam_id is null`);
      continue;
    }
    const { data: exam, error } = await sb.from('exams').select('*').eq('id', examId).maybeSingle();
    if (error || !exam) {
      add('FAIL', `set.${section}_exam_linked`, scope, `${section}_exam_id (${examId}) does not resolve to an existing exams row`);
      continue;
    }
    add('PASS', `set.${section}_exam_linked`, scope, `${section}_exam_id resolves to "${exam.title}"`);
    linkedExams[section] = exam;

    if (exam.level !== set.level) {
      add('FAIL', 'set.linked_exams_level_match', { ...scope, section }, `${section} exam level "${exam.level}" != set level "${set.level}"`);
    } else {
      add('PASS', 'set.linked_exams_level_match', { ...scope, section }, `${section} exam level matches set level`);
    }
    if (exam.section !== section) {
      add('FAIL', 'set.linked_exams_section_match', { ...scope, section }, `${section}_exam_id points to an exam whose section is "${exam.section}", not "${section}"`);
    } else {
      add('PASS', 'set.linked_exams_section_match', { ...scope, section }, `${section} exam's own section field matches`);
    }
  }

  if (set.is_published) {
    const unpublished = Object.entries(linkedExams).filter(([, e]) => !e.is_published);
    if (unpublished.length) {
      add('FAIL', 'set.published_set_exams_published', scope, `set is published but these linked exams are NOT: ${unpublished.map(([s]) => s).join(', ')}`);
    } else {
      add('PASS', 'set.published_set_exams_published', scope, 'set is published and all linked exams are published');
    }
    const uncertified = Object.entries(linkedExams).filter(([, e]) => !e.is_certified_mock_exam);
    if (uncertified.length) {
      add('FAIL', 'set.published_set_exams_certified', scope, `set is published but these linked exams are NOT certified: ${uncertified.map(([s]) => s).join(', ')}`);
    } else {
      add('PASS', 'set.published_set_exams_certified', scope, 'set is published and all linked exams are certified');
    }
  } else {
    add('PASS', 'set.published_set_exams_published', scope, 'set is not published — publication-consistency checks not applicable');
    add('PASS', 'set.published_set_exams_certified', scope, 'set is not published — certification-consistency checks not applicable');
  }

  if (set.sprechen_topic_ids == null || (Array.isArray(set.sprechen_topic_ids) && set.sprechen_topic_ids.length === 0)) {
    add('WARNING', 'set.sprechen_topic_ids', scope, 'sprechen_topic_ids is null/empty — Sprechen content for this set is entirely dynamic (generated fresh per session), not tied to this set at all');
  } else {
    add('PASS', 'set.sprechen_topic_ids', scope, `sprechen_topic_ids has ${set.sprechen_topic_ids.length} entries`);
  }

  return linkedExams;
}

// ── Duplicate detection (scans the full exam_tasks table, cross-set) ────
function runDuplicateChecks(allExams, allTasks, add) {
  const examById = new Map(allExams.map((e) => [e.id, e]));

  function scopeFor(task) {
    const exam = examById.get(task.exam_id);
    return { type: 'task', id: task.id, exam: task.exam_id, exam_title: exam ? exam.title : '(unknown)', task_number: task.task_number };
  }

  // 1. Duplicate instructions text (exact + normalized).
  const byInstructionsExact = new Map();
  const byInstructionsNorm = new Map();
  allTasks.forEach((t) => {
    const raw = (t.instructions || '').trim();
    if (!raw) return;
    if (!byInstructionsExact.has(raw)) byInstructionsExact.set(raw, []);
    byInstructionsExact.get(raw).push(t);
    const norm = normalize(raw);
    if (norm) {
      if (!byInstructionsNorm.has(norm)) byInstructionsNorm.set(norm, []);
      byInstructionsNorm.get(norm).push(t);
    }
  });
  byInstructionsExact.forEach((tasks, text) => {
    if (tasks.length > 1) {
      add('WARNING', 'duplicates.exact_instructions', tasks.map(scopeFor),
        `${tasks.length} tasks share byte-identical instructions text: "${text.slice(0, 80)}${text.length > 80 ? '…' : ''}"`);
    }
  });
  byInstructionsNorm.forEach((tasks, norm) => {
    const distinctRaw = new Set(tasks.map((t) => (t.instructions || '').trim()));
    if (tasks.length > 1 && distinctRaw.size > 1) {
      add('WARNING', 'duplicates.normalized_instructions', tasks.map(scopeFor),
        `${tasks.length} tasks share normalized-identical instructions (different punctuation/casing only)`);
    }
  });

  // 2. Duplicate audio references (exact URL reused across clips/tasks).
  const byAudioUrl = new Map();
  allTasks.forEach((t) => {
    const clips = (t.stimulus && t.stimulus.clips) || [];
    clips.forEach((c) => {
      if (!c.audio_url) return;
      if (!byAudioUrl.has(c.audio_url)) byAudioUrl.set(c.audio_url, []);
      byAudioUrl.get(c.audio_url).push(t);
    });
  });
  byAudioUrl.forEach((tasks, url) => {
    if (tasks.length > 1) {
      add('FAIL', 'duplicates.audio_references', tasks.map(scopeFor), `audio_url reused across ${tasks.length} clips: ${url}`);
    }
  });

  // 3. Duplicate question/statement text (exact + normalized) — the direct
  //    proxy for "same task reused with just changed names."
  const byQuestionExact = new Map();
  const byQuestionNorm = new Map();
  allTasks.forEach((t) => {
    const extracted = extractTaskContent(t);
    extracted.questionTexts.forEach((q) => {
      const raw = (q.text || '').trim();
      if (!raw || raw.length < 8) return; // skip trivially short strings (noise)
      if (!byQuestionExact.has(raw)) byQuestionExact.set(raw, []);
      byQuestionExact.get(raw).push(t);
      const norm = normalize(raw);
      if (norm) {
        if (!byQuestionNorm.has(norm)) byQuestionNorm.set(norm, []);
        byQuestionNorm.get(norm).push({ text: raw, task: t });
      }
    });
  });
  byQuestionExact.forEach((tasks, text) => {
    const distinctTaskIds = new Set(tasks.map((t) => t.id));
    if (distinctTaskIds.size > 1) {
      add('WARNING', 'duplicates.exact_question_text', tasks.map(scopeFor),
        `question/statement text repeated verbatim across ${distinctTaskIds.size} tasks: "${text.slice(0, 80)}${text.length > 80 ? '…' : ''}"`);
    }
  });
  byQuestionNorm.forEach((entries, norm) => {
    const distinctRawTexts = new Set(entries.map((e) => e.text));
    // Only worth reporting when the raw text actually differs (otherwise
    // it's already covered by the exact-match check above) — this is the
    // "same content, different punctuation/casing" case specifically.
    if (distinctRawTexts.size > 1) {
      add('WARNING', 'duplicates.normalized_question_text', entries.map((e) => scopeFor(e.task)),
        `${entries.length} question/statement items are identical once normalized (case/punctuation differences only): ${[...distinctRawTexts].map((t) => '"' + t.slice(0, 60) + '"').join(' / ')}`);
    }
  });

  // 4. Duplicate explanations (exact) — copy-pasted reasoning across items.
  const byExplanation = new Map();
  allTasks.forEach((t) => {
    const extracted = extractTaskContent(t);
    extracted.questionTexts.forEach((q) => {
      const raw = (q.explanation || '').trim();
      if (!raw || raw.length < 10) return;
      if (!byExplanation.has(raw)) byExplanation.set(raw, []);
      byExplanation.get(raw).push(t);
    });
  });
  byExplanation.forEach((tasks, text) => {
    const distinctTaskIds = new Set(tasks.map((t) => t.id));
    if (distinctTaskIds.size > 1) {
      add('WARNING', 'duplicates.explanations', tasks.map(scopeFor),
        `identical explanation text reused across ${distinctTaskIds.size} tasks: "${text.slice(0, 80)}${text.length > 80 ? '…' : ''}"`);
    }
  });

  // 5. Duplicate exam_tasks ids (should be impossible with a PK, but the
  //    brief explicitly asks for it — cheap to confirm).
  const idCounts = new Map();
  allTasks.forEach((t) => { idCounts.set(t.id, (idCounts.get(t.id) || 0) + 1); });
  const dupIds = [...idCounts.entries()].filter(([, n]) => n > 1);
  if (dupIds.length) {
    add('FAIL', 'duplicates.task_ids', dupIds.map(([id]) => ({ type: 'task', id })), `duplicate exam_tasks.id values found: ${dupIds.map(([id]) => id).join(', ')}`);
  } else {
    add('PASS', 'duplicates.task_ids', null, 'no duplicate exam_tasks.id values in the whole table');
  }
}

// ── Timestamp-based re-certification check ───────────────────────────────
function checkTimestamps(allExams, add) {
  const hasUpdatedAt = allExams.length && Object.prototype.hasOwnProperty.call(allExams[0], 'updated_at');
  add('WARNING', 'meta.timestamp_support', null,
    'exam_tasks has no created_at/updated_at columns and exams has no certified_at — ' +
    '"tasks edited after certification" and "certified content modified later" cannot be detected today. ' +
    'This is a schema gap (matches the open question already flagged in mock-exam-certification-checklist.md), not something this validator can check until those columns exist.');
}

// ── Report rendering ─────────────────────────────────────────────────────
function printReport(findings) {
  const bySeverity = { FAIL: [], WARNING: [], PASS: [] };
  findings.forEach((f) => bySeverity[f.severity].push(f));

  console.log('\n=== MOCK EXAM VALIDATION REPORT ===');
  console.log(`Generated: ${new Date().toISOString()}`);
  console.log(`PASS: ${bySeverity.PASS.length}   WARNING: ${bySeverity.WARNING.length}   FAIL: ${bySeverity.FAIL.length}`);

  if (bySeverity.FAIL.length) {
    console.log('\n--- FAIL ---');
    bySeverity.FAIL.forEach((f) => console.log(fmtFinding(f)));
  }
  if (bySeverity.WARNING.length) {
    console.log('\n--- WARNING ---');
    bySeverity.WARNING.forEach((f) => console.log(fmtFinding(f)));
  }
  console.log(`\n(${bySeverity.PASS.length} PASS findings omitted from console — see --json for the full list)`);
}

function fmtFinding(f) {
  const scope = Array.isArray(f.scope)
    ? f.scope.map((s) => `${s.type}:${s.id}`).join(', ')
    : (f.scope ? `${f.scope.type}:${f.scope.id}${f.scope.title ? ' "' + f.scope.title + '"' : ''}` : '(global)');
  return `[${f.category}] ${scope} — ${f.message}`;
}

// ── Main ──────────────────────────────────────────────────────────────
async function main() {
  const args = parseArgs(process.argv.slice(2));
  const { findings, add } = makeCollector();

  // Standalone single-exam mode — bypasses set logic entirely.
  if (args.exam) {
    const { data: exam, error } = await sb.from('exams').select('*').eq('id', args.exam).maybeSingle();
    if (error || !exam) { console.error('Exam not found:', args.exam); process.exit(1); }
    const { data: tasks } = await sb.from('exam_tasks').select('*').eq('exam_id', exam.id);
    checkExam(exam, tasks || [], add, { strict: exam.is_certified_mock_exam });
    runDuplicateChecks([exam], tasks || [], add);
    checkTimestamps([exam], add);
    finish(findings, args);
    return;
  }

  // Unlinked-exams audit mode (Part 3 support).
  if (args.unlinked) {
    const { data: allSets } = await sb.from('mock_exam_sets').select('hoeren_exam_id, lesen_exam_id, schreiben_exam_id');
    const linkedIds = new Set();
    (allSets || []).forEach((s) => { [s.hoeren_exam_id, s.lesen_exam_id, s.schreiben_exam_id].forEach((id) => id && linkedIds.add(id)); });

    let examQuery = sb.from('exams').select('*');
    if (args.level) examQuery = examQuery.eq('level', args.level);
    const { data: allExams } = await examQuery;
    const unlinked = (allExams || []).filter((e) => !linkedIds.has(e.id));

    const allTasksFlat = [];
    for (const exam of unlinked) {
      const { data: tasks } = await sb.from('exam_tasks').select('*').eq('exam_id', exam.id);
      allTasksFlat.push(...(tasks || []));
      checkExam(exam, tasks || [], add, { strict: false });
    }
    runDuplicateChecks(unlinked, allTasksFlat, add);
    checkTimestamps(unlinked, add);
    finish(findings, args);
    return;
  }

  // Default: set-based validation (--set / --level / --published / all).
  let setQuery = sb.from('mock_exam_sets').select('*');
  if (args.set) setQuery = setQuery.eq('id', args.set);
  else if (args.level) setQuery = setQuery.eq('level', args.level);
  else if (args.published) setQuery = setQuery.eq('is_published', true);
  const { data: sets, error: setsError } = await setQuery;
  if (setsError) { console.error('Failed to fetch mock_exam_sets:', setsError.message); process.exit(1); }
  if (!sets || !sets.length) { console.log('No matching mock_exam_sets rows found for the given filter.'); process.exit(0); }

  const { data: allSetsForLevel } = await sb.from('mock_exam_sets').select('id, level, set_number');

  const allExamsByExamId = new Map();
  const allTasksFlat = [];

  for (const set of sets) {
    const sameLevel = (allSetsForLevel || []).filter((s) => s.level === set.level);
    const linkedExams = await checkSet(set, sameLevel, add);
    for (const [section, exam] of Object.entries(linkedExams)) {
      allExamsByExamId.set(exam.id, exam);
      const { data: tasks } = await sb.from('exam_tasks').select('*').eq('exam_id', exam.id);
      allTasksFlat.push(...(tasks || []));
      checkExam(exam, tasks || [], add, { strict: true });
    }
  }

  runDuplicateChecks([...allExamsByExamId.values()], allTasksFlat, add);
  checkTimestamps([...allExamsByExamId.values()], add);

  finish(findings, args);
}

function finish(findings, args) {
  printReport(findings);
  if (args.json) {
    const report = {
      generated_at: new Date().toISOString(),
      summary: {
        pass: findings.filter((f) => f.severity === 'PASS').length,
        warning: findings.filter((f) => f.severity === 'WARNING').length,
        fail: findings.filter((f) => f.severity === 'FAIL').length,
      },
      findings,
    };
    const outPath = path.resolve(__dirname, '..', args.json);
    fs.writeFileSync(outPath, JSON.stringify(report, null, 2));
    console.log(`\nJSON report written to ${outPath}`);
  }
  const anyFail = findings.some((f) => f.severity === 'FAIL');
  process.exit(anyFail ? 1 : 0);
}

main().catch((e) => { console.error('VALIDATOR CRASHED:', e); process.exit(1); });
