/**
 * DeutschWeg — extract lesson content_json from module-*.html files.
 *
 * Modes:
 *   node scripts/migrate-content.js --file module1-numbers.html
 *       Dry-run on one file. Prints extracted content_json for every lesson
 *       in the file. No DB writes.
 *
 *   node scripts/migrate-content.js --file module1-numbers.html --lesson 1
 *       Dry-run on a single lesson within a file. Useful for fast review.
 *
 *   node scripts/migrate-content.js --all
 *       Walk every module-*.html file, extract content_json, upsert to
 *       Supabase lessons. NEVER overwrites existing content_json — uses an
 *       IS NULL filter on the UPDATE so populated rows are left alone.
 *
 *   --insert (with --file) actually writes; default is dry-run.
 *
 * Block types emitted: intro · text · example · audio · tip · warning ·
 * infobox · table.
 *
 * Mapping (HTML class → block type):
 *   <p class="body-text">           → text  (first one is intro)
 *   <div class="info-box">          → infobox  (gold accent in source)
 *   <div class="warn-box">          → infobox  (blue/info-style)
 *   <div class="success-box">       → tip      (green)
 *   <div class="danger-box">        → warning  (red)
 *   <div class="num-grid">          → table    (Number/German/Phonetic)
 *   <div class="time-grid">         → table    (Clock/German)
 *   <div class="ord-grid">          → table    (Number/German/Note)
 *   <div class="trap-pair">         → table row (teen vs tens)
 *   <div class="listen-card">       → example + audio
 *   <table class="dtable">          → table
 *   <button class="speak-btn" onclick="speakSentence(this,'X')">  → audio
 *   <div class="num-cell" onclick="speakNum(this,'X')">           → table row
 *   <div class="sec-label">         → text  (short heading line)
 *   <div class="yt"> / <div class="nav-row"> / <button class="btn ...">
 *                                   → SKIP (placeholders, navigation)
 */

'use strict';

const fs    = require('fs');
const path  = require('path');

require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });

// ── Args ────────────────────────────────────────────────────────────────────
const args = (() => {
  const out = { file: null, lesson: null, all: false, insert: false };
  const a = process.argv.slice(2);
  for (let i = 0; i < a.length; i++) {
    if (a[i] === '--file')      out.file   = a[++i];
    else if (a[i] === '--lesson') out.lesson = parseInt(a[++i], 10);
    else if (a[i] === '--all')    out.all    = true;
    else if (a[i] === '--insert') out.insert = true;
  }
  return out;
})();

const ROOT = path.resolve(__dirname, '..');

// ── HTML helpers ────────────────────────────────────────────────────────────
function decodeEntities(s) {
  return String(s)
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g,  '&')
    .replace(/&lt;/g,   '<')
    .replace(/&gt;/g,   '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g,  "'")
    .replace(/&ndash;/g,'–')
    .replace(/&mdash;/g,'—');
}

function stripTags(html) {
  if (html == null) return '';
  return decodeEntities(String(html).replace(/<[^>]+>/g, '')).replace(/\s+/g, ' ').trim();
}

// Extract a balanced container starting at `startIdx` (which points to `<tag`).
// Counts opens and closes for the same tag name. Returns { content, end }.
function extractBalanced(html, startIdx, tag) {
  const openRe  = new RegExp('<' + tag + '\\b', 'g');
  const closeRe = new RegExp('</' + tag + '>',   'g');
  let depth = 0, i = startIdx;
  while (i < html.length) {
    const nextOpen  = html.indexOf('<' + tag, i);
    const nextClose = html.indexOf('</' + tag + '>', i);
    if (nextClose < 0) break;
    if (nextOpen >= 0 && nextOpen < nextClose) {
      // Verify it's truly an opening of THIS tag (not <divider> etc.).
      const ch = html.charAt(nextOpen + 1 + tag.length);
      if (ch === ' ' || ch === '>' || ch === '\t' || ch === '\n') {
        depth++;
        i = nextOpen + 1 + tag.length;
        continue;
      } else {
        i = nextOpen + 1;
        continue;
      }
    }
    depth--;
    i = nextClose + ('</' + tag + '>').length;
    if (depth === 0) return { content: html.slice(startIdx, i), end: i };
  }
  return { content: html.slice(startIdx), end: html.length };
}

// ── Lesson + step discovery ─────────────────────────────────────────────────
function findLessonPanes(html) {
  // <div id="lesson-N" class="lesson-pane" ...>
  const re = /<div\s+id="lesson-(\d+)"\s+class="lesson-pane"[^>]*>/g;
  const out = [];
  let m;
  while ((m = re.exec(html)) !== null) {
    const idx       = parseInt(m[1], 10);
    const startTag  = m.index;
    const innerStart = m.index + m[0].length;
    const balanced  = extractBalanced(html, startTag, 'div');
    out.push({
      idx,
      lessonNo: idx + 1,                          // 0-indexed in HTML, 1-indexed in DB
      html: html.slice(innerStart, balanced.end - 6) // strip outer <div>...</div>
    });
  }
  return out;
}

// Inside a lesson pane, find each step. Returns ordered { stepNum, html, isQuiz }
function findSteps(lessonHtml) {
  const re = /<div\s+(?:class="step(?:\s+active)?"\s+)?id="l(\d+)-s(\d+)"(?:\s+class="step(?:\s+active)?")?[^>]*>/g;
  const out = [];
  let m;
  while ((m = re.exec(lessonHtml)) !== null) {
    const stepNum    = parseInt(m[2], 10);
    const startTag   = m.index;
    const innerStart = m.index + m[0].length;
    const balanced   = extractBalanced(lessonHtml, startTag, 'div');
    const inner      = lessonHtml.slice(innerStart, balanced.end - 6);
    const isQuiz     = /<div\s+id="qz-/.test(inner);
    out.push({ stepNum, html: inner, isQuiz });
  }
  return out;
}

// ── Block extractors ────────────────────────────────────────────────────────
//
// Strategy: scan the step's HTML linearly, recognising known wrappers in
// document order, emitting blocks as we go. We track positions so blocks come
// out in the same order as the source.

function extractStepBlocks(stepHtml) {
  const blocks = [];

  // Each entry: { idx, len, type, ...payload }. We build a list, sort by idx,
  // skip overlaps, then convert.
  const found = [];

  // Helper to scan globally and record all matches of a given pattern.
  function scanRegex(re, kind, capture) {
    const r = new RegExp(re.source, re.flags.includes('g') ? re.flags : re.flags + 'g');
    let m;
    while ((m = r.exec(stepHtml)) !== null) {
      found.push({ idx: m.index, len: m[0].length, kind, capture: capture(m) });
    }
  }

  // Helper for balanced wrappers.
  function scanBalanced(opener, kind, transform) {
    const re = new RegExp(opener.source, opener.flags.includes('g') ? opener.flags : opener.flags + 'g');
    let m;
    while ((m = re.exec(stepHtml)) !== null) {
      const startTag = m.index;
      const balanced = extractBalanced(stepHtml, startTag, opener.tag || 'div');
      const innerStart = startTag + m[0].length;
      const innerEnd   = balanced.end - ('</' + (opener.tag || 'div') + '>').length;
      const inner = stepHtml.slice(innerStart, innerEnd);
      const len   = balanced.end - startTag;
      found.push({ idx: startTag, len, kind, capture: transform(inner, m) });
      r_advance(re, balanced.end);
    }
    function r_advance(re, end) {
      // Move regex lastIndex past balanced block to avoid overlap.
      re.lastIndex = end;
    }
  }

  // ── Simple flat patterns ────────────────────────────────────────────────
  // <p class="body-text">...</p>  (no nested <p> in source)
  scanRegex(/<p\s+class="body-text"[^>]*>([\s\S]*?)<\/p>/g, 'text', (m) => stripTags(m[1]));

  // <div class="sec-label">...</div>  — short heading-style line
  scanRegex(/<div\s+class="sec-label"[^>]*>([\s\S]*?)<\/div>/g, 'sec-label', (m) => stripTags(m[1]));

  // speak-btn:  onclick="speakSentence(this,'X')" or onclick="speakSentence(this,&quot;X&quot;)"
  scanRegex(/<button\s+class="speak-btn"[^>]*onclick="speakSentence\(this,\s*'([^']+)'\)"[^>]*>[^<]*<\/button>/g,
            'audio',
            (m) => decodeEntities(m[1]));

  // ── Balanced (may contain nested divs) ──────────────────────────────────
  const opener = (re, tag) => Object.assign(re, { tag: tag || 'div' });

  scanBalanced(opener(/<div\s+class="info-box"[^>]*>/g),    'infobox',  (inner) => stripTags(inner));
  scanBalanced(opener(/<div\s+class="warn-box"[^>]*>/g),    'infobox',  (inner) => stripTags(inner));
  scanBalanced(opener(/<div\s+class="success-box"[^>]*>/g), 'tip',      (inner) => stripTags(inner));
  scanBalanced(opener(/<div\s+class="danger-box"[^>]*>/g),  'warning',  (inner) => stripTags(inner));

  // num-grid: convert num-cells to a Number/German/Phonetic table
  scanBalanced(opener(/<div\s+class="num-grid"[^>]*>/g), 'num-grid', (inner) => {
    const cells = [];
    const cellRe = /<div\s+class="num-cell"[^>]*>([\s\S]*?)<\/div>(?=\s*(?:<div\s+class="num-cell"|<\/div>))/g;
    let cm;
    while ((cm = cellRe.exec(inner)) !== null) {
      const cellInner = cm[1];
      const digit = (cellInner.match(/<div\s+class="num-digit"[^>]*>([\s\S]*?)<\/div>/) || [, ''])[1];
      const word  = (cellInner.match(/<div\s+class="num-word"[^>]*>([\s\S]*?)<\/div>/)  || [, ''])[1];
      const ph    = (cellInner.match(/<div\s+class="num-ph"[^>]*>([\s\S]*?)<\/div>/)    || [, ''])[1];
      cells.push([stripTags(digit), stripTags(word), stripTags(ph)].filter(x => x.length > 0));
    }
    if (cells.length === 0) return { rows: [] };
    // Pick headers by row width
    const width = Math.max(...cells.map(r => r.length));
    let headers;
    if (width === 3) headers = ['#', 'German', 'Phonetic'];
    else if (width === 2) headers = ['German', 'Phonetic'];
    else headers = Array.from({ length: width }, (_, i) => 'Col ' + (i + 1));
    // Normalise rows to width
    const rows = cells.map(r => {
      while (r.length < width) r.push('');
      return r;
    });
    return { headers, rows };
  });

  // time-grid: similar
  scanBalanced(opener(/<div\s+class="time-grid"[^>]*>/g), 'time-grid', (inner) => {
    const cells = [];
    const cellRe = /<div\s+class="time-card"[^>]*>([\s\S]*?)<\/div>(?=\s*(?:<div\s+class="time-card"|<\/div>))/g;
    let cm;
    while ((cm = cellRe.exec(inner)) !== null) {
      const ci = cm[1];
      const digital = (ci.match(/<div\s+class="time-digital"[^>]*>([\s\S]*?)<\/div>/) || [, ''])[1];
      const formal  = (ci.match(/<div\s+class="time-formal"[^>]*>([\s\S]*?)<\/div>/)  || [, ''])[1];
      cells.push([stripTags(digital), stripTags(formal)].filter(x => x.length > 0));
    }
    if (cells.length === 0) return { rows: [] };
    return { headers: ['Clock', 'German'], rows: cells };
  });

  // ord-grid: ordinal cells
  scanBalanced(opener(/<div\s+class="ord-grid"[^>]*>/g), 'ord-grid', (inner) => {
    const cells = [];
    const cellRe = /<div\s+class="ord-cell(?:\s+[^"]*)?"[^>]*>([\s\S]*?)<\/div>(?=\s*(?:<div\s+class="ord-cell|<\/div>))/g;
    let cm;
    while ((cm = cellRe.exec(inner)) !== null) {
      const ci = cm[1];
      const num  = (ci.match(/<div\s+class="ord-num"[^>]*>([\s\S]*?)<\/div>/)  || [, ''])[1];
      const word = (ci.match(/<div\s+class="ord-word"[^>]*>([\s\S]*?)<\/div>/) || [, ''])[1];
      const note = (ci.match(/<div\s+class="ord-note"[^>]*>([\s\S]*?)<\/div>/) || [, ''])[1];
      cells.push([stripTags(num), stripTags(word), stripTags(note)]);
    }
    if (cells.length === 0) return { rows: [] };
    return { headers: ['Number', 'German', 'Note'], rows: cells };
  });

  // trap-pair: two divs side by side (.trap-teen and .trap-tens). Aggregate
  // consecutive trap-pair blocks into one combined table — caller does that
  // via the post-processing pass.
  scanBalanced(opener(/<div\s+class="trap-pair"[^>]*>/g), 'trap-pair', (inner) => {
    const teen = (inner.match(/<div\s+class="trap-teen"[^>]*>([\s\S]*?)<\/div>(?=\s*<div\s+class="trap-tens")/) || [, ''])[1];
    const tens = (inner.match(/<div\s+class="trap-tens"[^>]*>([\s\S]*?)<\/div>(?=\s*<\/div>|\s*$)/) || [, ''])[1];
    const grab = (h, cls) => stripTags((h.match(new RegExp('<div\\s+class="' + cls + '"[^>]*>([\\s\\S]*?)</div>')) || [, ''])[1]);
    const teenNum = grab(teen, 'trap-num');
    const teenDe  = grab(teen, 'trap-de');
    const teenPh  = grab(teen, 'trap-ph');
    const tensNum = grab(tens, 'trap-num');
    const tensDe  = grab(tens, 'trap-de');
    const tensPh  = grab(tens, 'trap-ph');
    return {
      teen: teenNum + ' ' + teenDe + (teenPh ? ' (' + teenPh + ')' : ''),
      tens: tensNum + ' ' + tensDe + (tensPh ? ' (' + tensPh + ')' : '')
    };
  });

  // listen-card: example with optional audio button inside
  scanBalanced(opener(/<div\s+class="listen-card"[^>]*>/g), 'listen-card', (inner) => {
    const transcript = (inner.match(/<div\s+class="transcript"[^>]*>([\s\S]*?)<\/div>/) || [, ''])[1];
    const speakMatch = inner.match(/onclick="speakSentence\(this,\s*'([^']+)'\)"/);
    const audioText  = speakMatch ? decodeEntities(speakMatch[1]) : null;

    // Pull title + answer + tip text out for the english side
    const lTitle = stripTags((inner.match(/<div\s+class="l-title"[^>]*>([\s\S]*?)<\/div>/) || [, ''])[1]);
    const lSub   = stripTags((inner.match(/<div\s+class="l-sub"[^>]*>([\s\S]*?)<\/div>/)   || [, ''])[1]);
    const aLabel = stripTags((inner.match(/<div\s+class="a-label"[^>]*>([\s\S]*?)<\/div>/) || [, ''])[1]);
    const aVal   = stripTags((inner.match(/<div\s+class="a-val"[^>]*>([\s\S]*?)<\/div>/)   || [, ''])[1]);
    const tLabel = stripTags((inner.match(/<div\s+class="t-label"[^>]*>([\s\S]*?)<\/div>/) || [, ''])[1]);
    const tText  = stripTags((inner.match(/<div\s+class="t-text"[^>]*>([\s\S]*?)<\/div>/)  || [, ''])[1]);

    const englishParts = [];
    if (lTitle) englishParts.push(lTitle + (lSub ? ' (' + lSub + ')' : ''));
    if (aLabel && aVal) englishParts.push(aLabel.toLowerCase() + ': ' + aVal);
    if (tLabel && tText) englishParts.push(tLabel.toLowerCase() + ': ' + tText);

    return {
      german:  stripTags(transcript),
      english: englishParts.join(' — ').trim() || stripTags(inner).slice(0, 240),
      audio:   audioText
    };
  });

  // verb-grid: A1/A2 verb sample cards. Each card has vc-de (verb), vc-en
  // (translation), vc-ex (example), and onclick="speakVerb(this,'sentence')".
  scanBalanced(opener(/<div\s+class="verb-grid"[^>]*>/g), 'verb-grid', (inner) => {
    const cards = [];
    const cardRe = /<div\s+class="verb-card"[^>]*?(?:onclick="speakVerb\(this,\s*'([^']+)'\)")?[^>]*>([\s\S]*?)<\/div>(?=\s*(?:<div\s+class="verb-card"|<\/div>))/g;
    let cm;
    while ((cm = cardRe.exec(inner)) !== null) {
      const audio = cm[1] ? decodeEntities(cm[1]) : null;
      const ci = cm[2];
      const de = stripTags((ci.match(/<div\s+class="vc-de"[^>]*>([\s\S]*?)<\/div>/) || [, ''])[1]);
      const en = stripTags((ci.match(/<div\s+class="vc-en"[^>]*>([\s\S]*?)<\/div>/) || [, ''])[1]);
      const ex = stripTags((ci.match(/<div\s+class="vc-ex"[^>]*>([\s\S]*?)<\/div>/) || [, ''])[1]);
      if (de) cards.push({ de, en, ex, audio });
    }
    return cards;
  });

  // prep-pair-wrap: A2 two-way preposition pairs. Each has pp-prep-title,
  // pp-prep-eng, pp-akk-row (with pp-sent + pp-eng), pp-dat-row.
  scanBalanced(opener(/<div\s+class="prep-pair-wrap"[^>]*>/g), 'prep-pair', (inner) => {
    const title  = stripTags((inner.match(/<div\s+class="pp-prep-title"[^>]*>([\s\S]*?)<\/div>/)  || [, ''])[1]);
    const engLab = stripTags((inner.match(/<div\s+class="pp-prep-eng"[^>]*>([\s\S]*?)<\/div>/)    || [, ''])[1]);
    const akkRow = (inner.match(/<div\s+class="pp-akk-row"[^>]*>([\s\S]*?)<\/div>\s*<div\s+class="pp-dat-row"/) || [, ''])[1];
    const datRow = (inner.match(/<div\s+class="pp-dat-row"[^>]*>([\s\S]*?)<\/div>\s*<\/div>\s*<\/div>\s*$/) || [, ''])[1] ||
                   (inner.match(/<div\s+class="pp-dat-row"[^>]*>([\s\S]*?)$/) || [, ''])[1];
    const pickSent = (h) => stripTags((h.match(/<div\s+class="pp-sent"[^>]*>([\s\S]*?)<\/div>/) || [, ''])[1]);
    const pickEng  = (h) => stripTags((h.match(/<div\s+class="pp-eng"[^>]*>([\s\S]*?)<\/div>/)  || [, ''])[1]);
    return {
      title, engLab,
      akkSent: pickSent(akkRow), akkEng: pickEng(akkRow),
      datSent: pickSent(datRow), datEng: pickEng(datRow),
    };
  });

  // transform-box: B1/B2 source→transformed pair (e.g. RELATIV → PARTIZ.).
  // Each trn-row has the fixed shape:
  //   <div class="trn-row"><div class="trn-label">LAB</div><div class="trn-text">TXT</div></div>
  // We match that whole shape directly (a non-greedy outer regex would stop
  // at the first nested </div> because the nested divs aren't balanced).
  scanBalanced(opener(/<div\s+class="transform-box"[^>]*>/g), 'transform-box', (inner) => {
    const rows  = [];
    const rowRe = /<div\s+class="trn-row"[^>]*><div\s+class="trn-label"[^>]*>([\s\S]*?)<\/div>\s*<div\s+class="trn-text"[^>]*>([\s\S]*?)<\/div>\s*<\/div>/g;
    let rm;
    while ((rm = rowRe.exec(inner)) !== null) {
      const lab = stripTags(rm[1]);
      const txt = stripTags(rm[2]);
      if (txt) rows.push({ lab, txt });
    }
    const arrow = stripTags((inner.match(/<div\s+class="trn-arrow"[^>]*>([\s\S]*?)<\/div>/) || [, ''])[1]);
    return { rows, arrow };
  });

  // ex-card: B1/B2 example markup. <div class="ex-card"><div class="ex-de">DE</div><div class="ex-note">EN/note</div></div>
  scanBalanced(opener(/<div\s+class="ex-card"[^>]*>/g), 'ex-card', (inner) => {
    const de   = stripTags((inner.match(/<div\s+class="ex-de"[^>]*>([\s\S]*?)<\/div>/)   || [, ''])[1]);
    const note = stripTags((inner.match(/<div\s+class="ex-note"[^>]*>([\s\S]*?)<\/div>/) || [, ''])[1]);
    return { german: de, english: note };
  });

  // comp-table: B1/B2 alternative to dtable, same structure
  scanBalanced(opener(/<table\s+class="comp-table"[^>]*>/g, 'table'), 'comp-table', (inner) => {
    const rows = [];
    const trRe = /<tr[^>]*>([\s\S]*?)<\/tr>/g;
    let tm;
    while ((tm = trRe.exec(inner)) !== null) {
      const cells = [];
      const cellRe = /<(th|td)[^>]*>([\s\S]*?)<\/\1>/g;
      let cm;
      while ((cm = cellRe.exec(tm[1])) !== null) cells.push({ tag: cm[1], text: stripTags(cm[2]) });
      rows.push(cells);
    }
    if (rows.length === 0) return { rows: [] };
    let headers = [];
    let dataRows = rows;
    if (rows[0].some(c => c.tag === 'th')) {
      headers = rows[0].map(c => c.text);
      dataRows = rows.slice(1);
    }
    return { headers, rows: dataRows.map(r => r.map(c => c.text)) };
  });

  // <table class="dtable">...</table>
  scanBalanced(opener(/<table\s+class="dtable"[^>]*>/g, 'table'), 'dtable', (inner) => {
    const rows = [];
    const trRe = /<tr[^>]*>([\s\S]*?)<\/tr>/g;
    let tm;
    while ((tm = trRe.exec(inner)) !== null) {
      const cells = [];
      const cellRe = /<(th|td)[^>]*>([\s\S]*?)<\/\1>/g;
      let cm;
      while ((cm = cellRe.exec(tm[1])) !== null) cells.push({ tag: cm[1], text: stripTags(cm[2]) });
      rows.push(cells);
    }
    if (rows.length === 0) return { rows: [] };
    let headers = [];
    let dataRows = rows;
    if (rows[0].some(c => c.tag === 'th')) {
      headers = rows[0].map(c => c.text);
      dataRows = rows.slice(1);
    }
    return { headers, rows: dataRows.map(r => r.map(c => c.text)) };
  });

  // ── Sort by document position; convert to blocks ────────────────────────
  found.sort((a, b) => a.idx - b.idx);

  // Drop any item whose span is entirely inside a previously-emitted item.
  // (E.g. a speak-btn nested inside a listen-card we've already captured.)
  const accepted = [];
  let lastEnd = -1;
  let lastWindow = -1;
  const ranges = [];
  for (const f of found) {
    const start = f.idx;
    const end   = f.idx + f.len;
    const overlapped = ranges.some(r => start >= r[0] && end <= r[1]);
    if (!overlapped) {
      accepted.push(f);
      ranges.push([start, end]);
    }
  }

  // Convert accepted entries into clean content_json blocks.
  let firstText = true;
  let pendingTrapRows = null;
  function flushTrap() {
    if (!pendingTrapRows) return;
    if (pendingTrapRows.length > 0) {
      blocks.push({
        type: 'table',
        headers: ['Teen (-zehn)', 'Tens (-zig)'],
        rows: pendingTrapRows
      });
    }
    pendingTrapRows = null;
  }

  for (const f of accepted) {
    if (f.kind !== 'trap-pair' && pendingTrapRows) flushTrap();

    const c = f.capture;
    if (f.kind === 'text') {
      if (!c) continue;
      // sec-labels and one-liners stay 'text'; the very first prose block becomes intro.
      const block = { type: firstText ? 'intro' : 'text', content: c };
      firstText = false;
      blocks.push(block);
    } else if (f.kind === 'sec-label') {
      if (c) blocks.push({ type: 'text', content: c });
    } else if (f.kind === 'audio') {
      if (c) blocks.push({ type: 'audio', text: c });
    } else if (f.kind === 'infobox') {
      if (c) blocks.push({ type: 'infobox', content: c });
    } else if (f.kind === 'tip') {
      if (c) blocks.push({ type: 'tip', content: c });
    } else if (f.kind === 'warning') {
      if (c) blocks.push({ type: 'warning', content: c });
    } else if (f.kind === 'num-grid' || f.kind === 'time-grid' || f.kind === 'ord-grid' || f.kind === 'dtable') {
      if (c && c.rows && c.rows.length > 0) {
        blocks.push({ type: 'table', headers: c.headers, rows: c.rows });
        // Synthesise sweep audio for the German column on num/time/ord grids
        // (skip dtable — column meanings vary too much). Chunk at 12 so very
        // long sequences split into two reasonable buttons.
        if (f.kind !== 'dtable') {
          let germanColIdx = 0;
          if (f.kind === 'num-grid')  germanColIdx = c.headers.length >= 3 ? 1 : 0;
          if (f.kind === 'time-grid') germanColIdx = 1;
          if (f.kind === 'ord-grid')  germanColIdx = 1;
          var germanWords = c.rows.map(r => r[germanColIdx]).filter(w => w && w.length > 0);
          var CHUNK = 12;
          for (var gi = 0; gi < germanWords.length; gi += CHUNK) {
            var chunk = germanWords.slice(gi, gi + CHUNK).join(', ');
            blocks.push({ type: 'audio', text: chunk });
          }
        }
      }
    } else if (f.kind === 'trap-pair') {
      if (!pendingTrapRows) pendingTrapRows = [];
      pendingTrapRows.push([c.teen, c.tens]);
    } else if (f.kind === 'listen-card') {
      if (c.german) {
        blocks.push({ type: 'example', german: c.german, english: c.english || '' });
        if (c.audio) blocks.push({ type: 'audio', text: c.audio });
      }
    } else if (f.kind === 'ex-card') {
      if (c.german) blocks.push({ type: 'example', german: c.german, english: c.english || '' });
    } else if (f.kind === 'comp-table') {
      if (c && c.rows && c.rows.length > 0) blocks.push({ type: 'table', headers: c.headers, rows: c.rows });
    } else if (f.kind === 'verb-grid') {
      // One example block per verb-card, with audio if the speakVerb handler captured a sentence.
      (c || []).forEach(card => {
        if (card.de) {
          blocks.push({
            type: 'example',
            german: card.ex || card.de,
            english: card.de + (card.en ? ' — ' + card.en : '')
          });
          if (card.audio) blocks.push({ type: 'audio', text: card.audio });
        }
      });
    } else if (f.kind === 'prep-pair') {
      // Each preposition pair → one short text block (heading) + 2 example
      // blocks (Akkusativ + Dativ usage).
      if (c.title) {
        blocks.push({
          type: 'text',
          content: c.title + (c.engLab ? ' — ' + c.engLab : '')
        });
        if (c.akkSent) blocks.push({ type: 'example', german: c.akkSent, english: 'WOHIN? AKK' + (c.akkEng ? ' — ' + c.akkEng : '') });
        if (c.datSent) blocks.push({ type: 'example', german: c.datSent, english: 'WO? DAT'    + (c.datEng ? ' — ' + c.datEng : '') });
      }
    } else if (f.kind === 'transform-box') {
      // Pairs like RELATIV: ... → PARTIZ.: ... combined into a single example.
      if (c && c.rows && c.rows.length >= 2) {
        const a = c.rows[0], b = c.rows[1];
        const german  = (a.lab ? a.lab + ': ' : '') + a.txt + ' → ' + (b.lab ? b.lab + ': ' : '') + b.txt;
        const english = c.arrow || '';
        blocks.push({ type: 'example', german, english });
      }
    }
  }
  flushTrap();

  return blocks;
}

// ── File-level walk ─────────────────────────────────────────────────────────
function extractFile(filePath) {
  const html = fs.readFileSync(filePath, 'utf-8');
  const lessons = findLessonPanes(html);
  const out = [];
  for (const lesson of lessons) {
    const steps = findSteps(lesson.html);
    const contentSteps = steps.filter(s => !s.isQuiz);
    const allBlocks = [];
    let firstStep = true;
    for (const step of contentSteps) {
      const stepBlocks = extractStepBlocks(step.html);
      if (!firstStep && stepBlocks.length && stepBlocks[0].type === 'intro') {
        // Only the very first block of the lesson should be an intro.
        stepBlocks[0] = { type: 'text', content: stepBlocks[0].content };
      }
      firstStep = false;
      allBlocks.push(...stepBlocks);
    }
    out.push({ lessonNo: lesson.lessonNo, blocks: allBlocks });
  }
  return out;
}

// ── Main ────────────────────────────────────────────────────────────────────
async function main() {
  if (!args.file && !args.all) {
    console.error('Usage: --file <name.html> [--lesson <n>] OR --all');
    process.exit(1);
  }

  if (args.file && !args.all) {
    const filePath = path.resolve(ROOT, args.file);
    if (!fs.existsSync(filePath)) {
      console.error('Not found: ' + filePath);
      process.exit(1);
    }
    const lessons = extractFile(filePath);
    console.log('# DRY RUN — ' + args.file);
    console.log('# extracted ' + lessons.length + ' lesson(s)\n');
    for (const lesson of lessons) {
      if (args.lesson && lesson.lessonNo !== args.lesson) continue;
      console.log('## Lesson ' + lesson.lessonNo + ' — ' + lesson.blocks.length + ' blocks');
      const counts = {};
      lesson.blocks.forEach(b => { counts[b.type] = (counts[b.type] || 0) + 1; });
      console.log('## block types: ' + Object.keys(counts).sort().map(k => k + ':' + counts[k]).join(' · '));
      console.log(JSON.stringify(lesson.blocks, null, 2));
      console.log('');
    }
    return;
  }

  // ── Phase 2: --all ────────────────────────────────────────────────────
  const { createClient } = require('@supabase/supabase-js');
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.error('✗ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env');
    process.exit(1);
  }
  const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // Map filename → (level, DB order_index) deterministically from the filename
  // pattern. We don't trust all-modules.json's `level` field — that snapshot
  // has stale labels for module13/25/26/27 (DB has been re-levelled since the
  // seed). The DB layout is:
  //   module0..12        → A1 order_index 1..13
  //   module13..24       → A2 order_index 1..12
  //   module25..27       → B1 order_index 1..3
  //   module-b1-N-*.html → B1 order_index N
  //   module-b2-N-*.html → B2 order_index N
  function filenameToKey(filename) {
    let m;
    if ((m = filename.match(/^module-b1-(\d+)/))) return { level: 'B1', order_index: parseInt(m[1], 10) };
    if ((m = filename.match(/^module-b2-(\d+)/))) return { level: 'B2', order_index: parseInt(m[1], 10) };
    if ((m = filename.match(/^module(\d+)-/))) {
      const n = parseInt(m[1], 10);
      if (n <= 12) return { level: 'A1', order_index: n + 1 };
      if (n <= 24) return { level: 'A2', order_index: n - 12 };
      if (n <= 27) return { level: 'B1', order_index: n - 24 };
    }
    return null;
  }

  // Walk module-*.html files, excluding mock-exam pages and module.html itself.
  const files = fs.readdirSync(ROOT).filter((f) =>
    /^module/.test(f) && f.endsWith('.html') && f !== 'module.html' && !/mock/i.test(f)
  ).sort();
  console.log('# Phase 2 — extracting from ' + files.length + ' module files');
  console.log('# Mode: ' + (args.insert ? 'INSERT (writes to Supabase, IS NULL guard)' : 'DRY RUN (no DB writes)'));
  console.log('');

  let modulesProcessed   = 0;
  let lessonsConsidered  = 0;
  let lessonsUpdated     = 0;
  let lessonsAlreadyHad  = 0;
  let lessonsMissing     = 0;
  let modulesUnmapped    = 0;
  let lessonsWithAudio   = new Set();
  let lessonsWithTable   = new Set();
  let lessonsLowBlocks   = [];   // { file, lessonNo, blocks }
  const issues = [];

  for (const file of files) {
    const info = filenameToKey(file);
    if (!info) {
      console.warn('  · No filename pattern match for ' + file + ' (skipping)');
      modulesUnmapped++;
      continue;
    }

    let lessons;
    try {
      lessons = extractFile(path.resolve(ROOT, file));
    } catch (e) {
      console.error('  · EXTRACT failed on ' + file + ': ' + e.message);
      issues.push(file + ' (extract failed: ' + e.message + ')');
      continue;
    }

    // Find module row in DB
    const modRes = await sb.from('modules').select('id, title')
      .eq('level', info.level).eq('order_index', info.order_index).maybeSingle();
    if (modRes.error || !modRes.data) {
      console.warn('  · No DB module for ' + file + ' (' + info.level + '-' + info.order_index + ')');
      modulesUnmapped++;
      continue;
    }
    const moduleId = modRes.data.id;

    let perModuleUpdated = 0, perModuleSkipped = 0, perModuleMissing = 0;
    for (const lesson of lessons) {
      lessonsConsidered++;
      if (!lesson.blocks || lesson.blocks.length === 0) continue;

      const lessonRow = await sb.from('lessons')
        .select('id, content_json')
        .eq('module_id', moduleId).eq('order_index', lesson.lessonNo).maybeSingle();
      if (lessonRow.error || !lessonRow.data) {
        perModuleMissing++; lessonsMissing++; continue;
      }

      // Track type stats regardless of insert/skip
      const types = new Set(lesson.blocks.map((b) => b.type));
      const lessonKey = file + '#' + lesson.lessonNo;
      if (types.has('audio')) lessonsWithAudio.add(lessonKey);
      if (types.has('table')) lessonsWithTable.add(lessonKey);
      if (lesson.blocks.length < 3) lessonsLowBlocks.push({ file, lessonNo: lesson.lessonNo, blocks: lesson.blocks.length });

      if (args.insert) {
        // Server-side IS NULL guard: never overwrite existing content.
        const upd = await sb.from('lessons')
          .update({ content_json: lesson.blocks })
          .eq('id', lessonRow.data.id).is('content_json', null).select('id');
        if (upd.error) {
          console.error('  · UPDATE error on ' + lessonKey + ': ' + upd.error.message);
          continue;
        }
        if (upd.data && upd.data.length > 0) {
          lessonsUpdated++; perModuleUpdated++;
        } else {
          // content_json was already non-NULL → skipped by guard
          lessonsAlreadyHad++; perModuleSkipped++;
        }
      } else {
        if (lessonRow.data.content_json !== null) { lessonsAlreadyHad++; perModuleSkipped++; }
        else { lessonsUpdated++; perModuleUpdated++; }   // would-update count
      }
    }

    modulesProcessed++;
    if (modulesProcessed % 10 === 0 || modulesProcessed === files.length) {
      console.log('  [' + modulesProcessed + '/' + files.length + '] ' + file + ' — ' +
        (args.insert ? 'updated ' : 'would update ') + perModuleUpdated +
        ', skipped ' + perModuleSkipped +
        (perModuleMissing ? ', missing ' + perModuleMissing : ''));
    }
  }

  // ── Phase 3: verification ─────────────────────────────────────────────
  const head = { count: 'exact', head: true };
  const [
    totalLessons,
    populated,
    nullCount
  ] = await Promise.all([
    sb.from('lessons').select('*', head),
    sb.from('lessons').select('*', head).not('content_json', 'is', null),
    sb.from('lessons').select('*', head).is('content_json', null),
  ]);

  // Count lessons with fewer than 2 blocks (incomplete)
  const allRows = await sb.from('lessons').select('id, order_index, content_json, modules(level, order_index, title)');
  const fewBlocks = (allRows.data || []).filter((l) => Array.isArray(l.content_json) && l.content_json.length < 2);

  // List modules with 0 lessons populated
  const moduleStats = {};
  (allRows.data || []).forEach((l) => {
    const m = l.modules;
    if (!m) return;
    const key = m.level + '-' + m.order_index;
    if (!moduleStats[key]) moduleStats[key] = { title: m.title, total: 0, populated: 0 };
    moduleStats[key].total++;
    if (Array.isArray(l.content_json) && l.content_json.length > 0) moduleStats[key].populated++;
  });
  const emptyModules = Object.entries(moduleStats).filter(([_, s]) => s.populated === 0);

  console.log('');
  console.log('=== MIGRATION COMPLETE ===');
  console.log('Total modules processed: ' + modulesProcessed);
  console.log('Total lessons migrated: ' + lessonsUpdated);
  console.log('Total lessons skipped: ' + lessonsAlreadyHad + ' (already had content_json)');
  console.log('Total lessons failed: ' + lessonsMissing);
  console.log('Lessons with audio blocks: ' + lessonsWithAudio.size);
  console.log('Lessons with table blocks: ' + lessonsWithTable.size);
  console.log('Lessons still empty after migration: ' + nullCount.count);
  console.log('');
  console.log('DB authoritative counts:');
  console.log('  total lessons:           ' + totalLessons.count);
  console.log('  content_json populated:  ' + populated.count);
  console.log('  content_json NULL:       ' + nullCount.count);
  console.log('  populated with <2 blocks: ' + fewBlocks.length);
  console.log('');
  if (emptyModules.length > 0) {
    console.log('Modules needing manual review (0 lessons populated):');
    emptyModules.forEach(([key, s]) => console.log('  - ' + key + ' "' + s.title + '" (' + s.populated + '/' + s.total + ')'));
  }
  if (lessonsLowBlocks.length > 0) {
    console.log('Lessons with <3 blocks (may be incomplete):');
    lessonsLowBlocks.forEach((l) => console.log('  - ' + l.file + ' lesson ' + l.lessonNo + ': ' + l.blocks + ' blocks'));
  }
  if (issues.length > 0) {
    console.log('Extraction issues:');
    issues.forEach((i) => console.log('  - ' + i));
  }
  console.log('');
  console.log('=== END REPORT ===');
}

main().catch(e => { console.error('Fatal:', e.message); process.exit(1); });
