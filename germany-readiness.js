/**
 * DeutschWeg — Germany Readiness Bar
 * =============================================================
 * Reusable component. Phase 1: renders on homepage with demo data.
 * Phase 2: wire real user progress from Supabase (see "PHASE 2" comments).
 *
 * Public API:
 *   dwReadinessBar.render(containerEl, { a1Pct, a2Pct, b1Pct })
 *
 * Parameters:
 *   containerEl — any DOM element; component replaces its innerHTML
 *   a1Pct/a2Pct/b1Pct — completion % for each level (0–100)
 *
 * Formula:
 *   overallScore = (a1Pct × 0.33) + (a2Pct × 0.33) + (b1Pct × 0.34)
 *   → 0 to 100 weighted score representing total Germany readiness
 *
 * PHASE 2 wiring:
 *   1. After auth, fetch user_progress rows from Supabase for the signed-in user
 *   2. Compute per-level completion: count completed lessons / total lessons × 100
 *   3. Call dwReadinessBar.render(el, { a1Pct, a2Pct, b1Pct }) with real values
 *   4. The component handles the rest — no other changes needed
 *
 * Styling: self-contained (injects a single <style> tag, keyed to avoid duplicates).
 * All colors use existing DeutschWeg design tokens (var(--blue) etc.) + two inline
 * values already present in index.html: #818CF8 (indigo, from hc-fill gradient) and
 * #059669 (green-dark, from deutschweg-theme.css dw-success rule). No new values.
 */
(function (global) {
  'use strict';

  var STYLE_ID = 'dw-readiness-bar-styles';

  // Segment definitions: key → pctKey, display label, fill color, weight.
  // Colors deliberately use values already present in the DeutschWeg codebase.
  var SEGS = [
    { key: 'a1', label: 'A1',         fillColor: '#3B82F6', weight: 0.33 }, // var(--blue)
    { key: 'a2', label: 'A2',         fillColor: '#818CF8', weight: 0.33 }, // indigo — already in hc-fill gradient
    { key: 'b1', label: 'B1',         fillColor: '#059669', weight: 0.34 }, // green-dark — already in dw-success
  ];

  // Inject shared styles once per page load.
  function injectStyles() {
    if (document.getElementById(STYLE_ID)) return;
    var el = document.createElement('style');
    el.id = STYLE_ID;
    el.textContent =
      '.drb{font-family:"Plus Jakarta Sans",system-ui,sans-serif;background:#fff;border:1px solid #E5E7EB;border-radius:16px;padding:20px 22px;box-shadow:0 1px 3px rgba(0,0,0,.08),0 4px 16px rgba(0,0,0,.06);}' +
      '.drb-header{display:flex;align-items:center;justify-content:space-between;margin-bottom:14px;}' +
      '.drb-title{font-size:12px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:#9CA3AF;}' +
      '.drb-score-wrap{display:flex;align-items:baseline;gap:4px;}' +
      '.drb-score{font-size:22px;font-weight:800;color:#1F2937;line-height:1;}' +
      '.drb-score-label{font-size:11px;font-weight:600;color:#9CA3AF;}' +
      '.drb-bar{display:flex;height:10px;border-radius:99px;overflow:hidden;background:#F1F5F9;gap:2px;margin-bottom:10px;}' +
      '.drb-seg-track{height:100%;overflow:hidden;border-radius:99px;background:#F1F5F9;position:relative;}' +
      '.drb-seg-fill{height:100%;border-radius:99px;transition:width .6s ease;}' +
      '.drb-labels{display:flex;margin-bottom:4px;}' +
      '.drb-seg-label-wrap{display:flex;flex-direction:column;gap:3px;}' +
      '.drb-seg-name{font-size:11px;font-weight:700;color:#4B5563;}' +
      '.drb-seg-pct{font-size:11px;color:#9CA3AF;}' +
      '.drb-divider{width:2px;flex-shrink:0;background:#F1F5F9;}' +
      '.drb-hint{font-size:12px;color:#9CA3AF;line-height:1.55;margin-top:10px;border-top:1px solid #F1F5F9;padding-top:10px;}' +
      '.drb-hint strong{color:#4B5563;}';
    document.head.appendChild(el);
  }

  function clamp(n) {
    var v = parseFloat(n);
    return isNaN(v) ? 0 : Math.max(0, Math.min(100, v));
  }

  function pctLabel(n) {
    return Math.round(n) + '%';
  }

  /**
   * Render the Germany Readiness Bar into the given container element.
   * @param {Element} container - DOM element whose content will be replaced
   * @param {{ a1Pct: number, a2Pct: number, b1Pct: number }} data - completion %
   */
  function render(container, data) {
    if (!container) return;
    injectStyles();

    var a1 = clamp((data || {}).a1Pct);
    var a2 = clamp((data || {}).a2Pct);
    var b1 = clamp((data || {}).b1Pct);

    // Weighted overall score (0–100)
    var overall = Math.round(a1 * 0.33 + a2 * 0.33 + b1 * 0.34);

    var pcts = { a1: a1, a2: a2, b1: b1 };

    // Build the bar HTML
    var barHtml = '<div class="drb-bar">';
    var labelsHtml = '<div class="drb-labels">';

    for (var i = 0; i < SEGS.length; i++) {
      var seg = SEGS[i];
      var pct = pcts[seg.key];
      var flexBasis = (seg.weight * 100).toFixed(1) + '%';

      if (i > 0) {
        barHtml += '<div class="drb-divider"></div>';
        labelsHtml += '<div style="width:2px;flex-shrink:0;"></div>';
      }

      barHtml +=
        '<div class="drb-seg-track" style="flex:0 0 ' + flexBasis + ';min-width:0;">' +
          '<div class="drb-seg-fill" style="width:' + pct + '%;background:' + seg.fillColor + ';"></div>' +
        '</div>';

      labelsHtml +=
        '<div class="drb-seg-label-wrap" style="flex:0 0 ' + flexBasis + ';min-width:0;overflow:hidden;">' +
          '<span class="drb-seg-name">' + seg.label + '</span>' +
          '<span class="drb-seg-pct">' + pctLabel(pct) + '</span>' +
        '</div>';
    }

    barHtml += '</div>';
    labelsHtml += '</div>';

    var hintHtml =
      overall >= 100
        ? '<p class="drb-hint"><strong>🇩🇪 Germany Ready!</strong> You have completed the full A1–B1 pathway.</p>'
        : '<p class="drb-hint">Complete <strong>A1 → A2 → B1</strong> to reach Germany-ready status. A1 is free.</p>';

    container.innerHTML =
      '<div class="drb">' +
        '<div class="drb-header">' +
          '<span class="drb-title">Germany Readiness</span>' +
          '<div class="drb-score-wrap">' +
            '<span class="drb-score">' + overall + '</span>' +
            '<span class="drb-score-label">/ 100</span>' +
          '</div>' +
        '</div>' +
        barHtml +
        labelsHtml +
        hintHtml +
      '</div>';
  }

  global.dwReadinessBar = { render: render };

}(window));
