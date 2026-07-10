/**
 * DeutschWeg — Scoring Config (single source of truth for pass thresholds)
 *
 * Same idea as paywall.js: one file, one place to edit a number, loaded
 * everywhere that number is used — so a threshold can never quietly drift
 * between two files the way Exam Whisperer's did (backend said 60/40=75%
 * "passing", the frontend independently displayed pass at 60%, and nobody
 * noticed the two disagreed until an audit found it).
 *
 * Unlike paywall.js (browser-only), this file is loaded from BOTH runtimes:
 *   - Frontend pages: <script src="./scoring-config.js?v=1"></script>,
 *     exposes window.dwScoring.
 *   - server.js (Node/CommonJS): const { dwScoring } = require('./scoring-config.js')
 * The UMD wrapper below is what makes one file work in both places.
 *
 * FOLLOW-UP (flagged, not resolved here): PASS_THRESHOLD_PCT is applied
 * per skill (Lesen/Hören/Schreiben each pass or fail independently, plus
 * Sprechen separately — never blended), matching how the real Goethe exam
 * evaluates. Once feedback-copy work happens, re-check that presenting
 * three independent 60% bars (rather than one combined written score)
 * doesn't read as harsher than the real A1/A2 exam, where some formats
 * combine Lesen+Hören+Schreiben into one written total rather than gating
 * each individually. See scoring-reconciliation-plan.md §3b.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.dwScoring = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // ── The one number every skill's pass/fail check reads ──────────────────
  // 60% matches the Goethe Institut's actual published pass standard
  // (uniform across every CEFR level and every exam part) and is now what
  // every skill below uses — previously Lesen/Schreiben used 50% at A1
  // only (no stated reason found in git history — treated as an
  // unintentional outlier, not a deliberate design choice), and Exam
  // Whisperer's backend checked 75% while its frontend displayed 60%.
  var PASS_THRESHOLD_PCT = 60;

  // Sprechen is scored on a 1–5 AI rating (Aussprache/Kommunikation/
  // Grammatik/Wortschatz + Overall), not a points-out-of-N tally like the
  // other three skills. SPRECHEN_SCALE_MAX converts that rating to the
  // same 0–100 percentage space so PASS_THRESHOLD_PCT can still apply to
  // it — but the result is NEVER combined with Lesen/Hören/Schreiben; it
  // is its own separate pass/fail, matching how the real oral exam works.
  var SPRECHEN_SCALE_MAX = 5;

  function pct(total, max) {
    if (typeof total !== 'number' || typeof max !== 'number' || max <= 0) return null;
    return Math.round((total / max) * 100);
  }

  // Generic pass check for any points-out-of-N skill (Lesen, Hören,
  // Schreiben). Returns null (not true/false) if total/max aren't usable
  // numbers, so callers can distinguish "no score yet" from "failed".
  function passed(total, max) {
    var p = pct(total, max);
    return p === null ? null : p >= PASS_THRESHOLD_PCT;
  }

  // Sprechen-specific: converts the 1–5 overall rating to the same
  // percentage space (1->20%, 5->100%) and applies the identical
  // threshold. Kept as separate functions (not reused inside passed())
  // so a caller can never accidentally blend a Sprechen rating into a
  // Lesen/Hören/Schreiben total by calling the wrong function.
  function sprechenPct(overallScore) {
    if (typeof overallScore !== 'number') return null;
    return Math.round((overallScore / SPRECHEN_SCALE_MAX) * 100);
  }
  function sprechenPassed(overallScore) {
    var p = sprechenPct(overallScore);
    return p === null ? null : p >= PASS_THRESHOLD_PCT;
  }

  // How many raw points are still needed to cross the pass line, for
  // "X points to pass" style copy (e.g. Exam Whisperer's verdict text).
  // Rounds up — being one point under is still "under".
  function pointsToPass(total, max) {
    if (typeof total !== 'number' || typeof max !== 'number' || max <= 0) return null;
    var needed = Math.ceil(max * PASS_THRESHOLD_PCT / 100) - total;
    return Math.max(0, needed);
  }

  return {
    PASS_THRESHOLD_PCT: PASS_THRESHOLD_PCT,
    SPRECHEN_SCALE_MAX: SPRECHEN_SCALE_MAX,
    pct: pct,
    passed: passed,
    sprechenPct: sprechenPct,
    sprechenPassed: sprechenPassed,
    pointsToPass: pointsToPass
  };
});
