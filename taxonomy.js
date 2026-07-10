/**
 * DeutschWeg — Grammar Error Taxonomy (single source of truth)
 *
 * Same idea as paywall.js / scoring-config.js: one file, one place to
 * edit a category's label, loaded everywhere that label is shown. Before
 * this file existed, the same 6 category keys had TWO independently
 * authored label sets that had already drifted apart:
 *   - server.js's AIPAL_ERROR_LABELS (e.g. "Masculine accusative articles
 *     (der/den, ein/einen confusion)")
 *   - ai-pal-widget.js's PAL_TOPIC_LABELS (e.g. "masculine accusative
 *     articles (der/den)")
 * Both now read from here instead.
 *
 * Detection logic (the regexes that spot these errors in a learner's
 * message) intentionally stays in ai-pal-widget.js — that's browser-only
 * detection mechanics, not shared taxonomy data. This file holds only
 * the stable part: the category keys and how to describe them, which is
 * what Schreiben/Sprechen feedback (see feedback-audit.md, Part B) will
 * also need to reference so all three features name the same mistake
 * the same way.
 *
 * Loaded via <script src="./taxonomy.js?v=1"> in the frontend (exposes
 * window.dwTaxonomy) and via require('./taxonomy.js') in server.js.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.dwTaxonomy = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // ── The 6 categories ─────────────────────────────────────────────────────
  // label: short, for compact UI (chips, bars).
  // description: one clause of extra context, for prose/prompt use where a
  // reader hasn't seen the category key before (e.g. inside an AI prompt).
  var CATEGORIES = [
    {
      key: 'article_masculine_accusative',
      label: 'Masculine accusative articles',
      description: 'der/den, ein/einen confusion in the accusative case'
    },
    {
      key: 'verb_position',
      label: 'Verb position',
      description: 'the finite verb must be 2nd in a main clause'
    },
    {
      key: 'verb_conjugation',
      label: 'Verb conjugation',
      description: 'matching the verb ending to the subject'
    },
    {
      key: 'perfekt_auxiliary',
      label: 'Perfekt auxiliary',
      description: 'choosing haben vs. sein for the Perfekt tense'
    },
    {
      key: 'subordinate_clause_word_order',
      label: 'Subordinate clause word order',
      description: 'the verb must go to the end after weil/dass/wenn/obwohl etc.'
    },
    {
      key: 'preposition_pattern',
      label: 'Preposition patterns',
      description: 'prepositions like in/zu/nach with destinations and places'
    }
  ];

  var BY_KEY = {};
  CATEGORIES.forEach(function (c) { BY_KEY[c.key] = c; });

  function get(key) {
    return BY_KEY[key] || null;
  }
  function label(key) {
    var c = BY_KEY[key];
    return c ? c.label : key;
  }
  function description(key) {
    var c = BY_KEY[key];
    return c ? c.description : '';
  }
  // "Label — description" form, used where server.js's old
  // AIPAL_ERROR_LABELS combined both into one string.
  function longLabel(key) {
    var c = BY_KEY[key];
    if (!c) return key;
    return c.label + ' (' + c.description + ')';
  }
  function keys() {
    return CATEGORIES.map(function (c) { return c.key; });
  }

  return {
    CATEGORIES: CATEGORIES,
    get: get,
    label: label,
    description: description,
    longLabel: longLabel,
    keys: keys
  };
});
