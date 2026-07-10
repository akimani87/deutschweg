#!/usr/bin/env node
/**
 * Guards against the exact bug this script was written to catch: a
 * scoring pass-threshold hardcoded in two places that quietly drift apart
 * (Exam Whisperer's backend checked 75% while its frontend displayed 60%
 * for months before an audit caught it — see scoring-reconciliation-plan.md).
 *
 * Run manually: node scripts/check-scoring-consistency.js
 * Exits non-zero (and prints what's wrong) if anything fails, so it can
 * also be wired into CI/pre-commit later.
 */
'use strict';

const fs   = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
let failures = 0;

function fail(msg) {
  console.error('✗ ' + msg);
  failures++;
}
function ok(msg) {
  console.log('✓ ' + msg);
}
function read(relPath) {
  return fs.readFileSync(path.join(ROOT, relPath), 'utf8');
}

// ── 1. scoring-config.js loads and behaves as expected ──────────────────
let dwScoring;
try {
  dwScoring = require(path.join(ROOT, 'scoring-config.js'));
  ok('scoring-config.js loads via require()');
} catch (e) {
  fail('scoring-config.js failed to load: ' + e.message);
  process.exit(1);
}

const CASES = [
  { fn: 'passed', args: [24, 40], expect: true,  label: '24/40 (60%) should pass' },
  { fn: 'passed', args: [23, 40], expect: false, label: '23/40 (57.5%) should fail' },
  { fn: 'passed', args: [60, 100], expect: true, label: '60/100 (60%) should pass' },
  { fn: 'passed', args: [59, 100], expect: false, label: '59/100 (59%) should fail' },
  { fn: 'sprechenPassed', args: [3], expect: true,  label: 'Sprechen overall 3/5 (60%) should pass' },
  { fn: 'sprechenPassed', args: [2], expect: false, label: 'Sprechen overall 2/5 (40%) should fail' },
];
CASES.forEach(function (c) {
  var actual = dwScoring[c.fn].apply(null, c.args);
  if (actual === c.expect) {
    ok(c.label);
  } else {
    fail(c.label + ' — got ' + actual + ', expected ' + c.expect);
  }
});

if (dwScoring.PASS_THRESHOLD_PCT !== 60) {
  fail('PASS_THRESHOLD_PCT is ' + dwScoring.PASS_THRESHOLD_PCT + ', expected 60 — if this is intentional, update this script\'s expectations too.');
} else {
  ok('PASS_THRESHOLD_PCT is 60, as documented in scoring-reconciliation-plan.md');
}

// ── 2. Every file that checks a pass/fail threshold actually loads the
//      shared config, instead of only hardcoding a number locally ───────
var WIRING = [
  { file: 'exam-vault.html',      needle: 'scoring-config.js' },
  { file: 'exam-whisperer.html',  needle: 'scoring-config.js' },
  { file: 'hoerverstehen.html',   needle: 'scoring-config.js' },
  { file: 'sprechen.html',        needle: 'scoring-config.js' },
  { file: 'server.js',            needle: "require('./scoring-config.js')" },
];
WIRING.forEach(function (w) {
  var content = read(w.file);
  if (content.indexOf(w.needle) === -1) {
    fail(w.file + ' no longer references scoring-config.js (' + w.needle + ' not found) — a threshold may have been re-hardcoded locally.');
  } else {
    ok(w.file + ' references scoring-config.js');
  }
});

// ── 3. The exact drift pattern that caused the original bug doesn't
//      reappear: a bare ratio/fraction pass-check that bypasses
//      scoring-config.js. Scoped narrowly (not "any /NN string") to avoid
//      false-positiving on legitimate raw-score displays like "10 / 10".
var DANGEROUS_PATTERNS = [
  { re: />=\s*0\.6\b/,           desc: 'hardcoded ">= 0.6" pass check' },
  { re: />=\s*0\.75\b/,          desc: 'hardcoded ">= 0.75" pass check' },
  { re: />=\s*0\.5\b/,           desc: 'hardcoded ">= 0.5" pass check' },
  { re: /passing\s*=\s*30\/40/i, desc: 'the old "passing = 30/40" (75%) prompt text' },
];
['exam-vault.html', 'exam-whisperer.html', 'server.js'].forEach(function (file) {
  var content = read(file);
  DANGEROUS_PATTERNS.forEach(function (p) {
    if (p.re.test(content)) {
      fail(file + ' contains ' + p.desc + ' — this looks like a re-hardcoded threshold. Route it through scoring-config.js instead.');
    }
  });
});
if (failures === 0) ok('no re-hardcoded pass-threshold patterns found outside scoring-config.js');

// ── Result ────────────────────────────────────────────────────────────
console.log('');
if (failures > 0) {
  console.error(failures + ' check(s) failed.');
  process.exit(1);
} else {
  console.log('All scoring-consistency checks passed.');
}
