// Über mich — SEO static-page generator (first release of the SEO/AEO
// audit's "minimum first release", Section J of a1-topic-architecture-audit).
//
// Reads the topic + its 6 lessons live from Supabase and writes real static
// HTML files at the clean public URLs:
//   a1/ueber-mich/index.html
//   a1/ueber-mich/<slug>/index.html   (x6)
//
// Cloudflare Pages serves a directory's index.html at the clean path
// natively (same mechanism that already serves a1.html at /a1) — no
// _redirects rewrite needed, and unlike a rewrite, the crawler gets real
// baked-in HTML instead of a client-rendered shell.
//
// No DB schema change: for a single-topic pilot, a 7-line literal config
// below is simpler and safer than a migration + admin UI for columns
// nothing yet needs to edit without a deploy. Revisit (move slug/seo_title/
// meta_description onto topics/topic_items — see audit Section J.2) once a
// second topic makes the hardcoded map awkward.
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');
const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

const SITE = 'https://deutschweg.de';
const TOPIC_ID = '4bf7abfd-0147-4a83-b8c2-df60a263c24d';
const HIDDEN_MODULE_ID = 'b7267868-5cad-4d6d-8755-f2347ca843d3'; // Über mich — Topic Extras

// order matches topic_items.order_index 1-6. `headings` is consumed
// left-to-right by renderLessonBody's heading triggers (see below) — hand
// -authored rather than derived, since 6 lessons is too few to be worth a
// clever heuristic, and a wrong guess would ship a worse heading than one
// written with the actual content in view.
const LESSON_SEO = [
  { slug: 'mein-name', titleEn: 'My Name in German',
    metaDescription: "Learn two natural ways to say your name in German — Ich heiße … and Ich bin … — and how to ask someone else's name with Wie heißt du?",
    headings: ['How to say your name', "How to ask someone else's name"] },
  { slug: 'woher-kommst-du', titleEn: 'Where Are You From? — German for Beginners',
    metaDescription: "Learn how to say where you're from in German with Ich komme aus …, and how to ask with Woher kommst du?",
    headings: ["How to say where you're from", "How to ask where someone's from"] },
  { slug: 'wo-wohnst-du', titleEn: 'Where Do You Live? — German for Beginners',
    metaDescription: 'Learn how to say where you live in German with Ich wohne in …, and the difference between coming from a place and living in one.',
    headings: ['How to say where you live', 'How to ask where someone lives'] },
  { slug: 'du-oder-sie', titleEn: "Du or Sie? Formal and Informal 'You' in German",
    metaDescription: "When to use du vs. Sie in German, with real situations — friends and family vs. your doctor, a teacher, or someone you don't know yet.",
    headings: ['When to use each', 'In practice'] },
  { slug: 'profile-verstehen', titleEn: 'Understanding a German Self-Introduction',
    metaDescription: 'Read and listen to two example German self-introductions and learn to pick out the key facts: name, origin, residence, age.',
    headings: ['Reading a profile', 'Vocabulary'] },
  { slug: 'stell-dich-vor', titleEn: 'How to Introduce Yourself in German',
    metaDescription: "Put it all together: a complete German self-introduction — your name, where you're from, and where you live — in three simple sentences.",
    headings: ['Putting it together'] }
];

const TOPIC_SEO = {
  slug: 'ueber-mich',
  titleEn: 'About Me — Introduce Yourself in German (A1)'
};

function esc(s) {
  if (s === null || s === undefined) return '';
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

// ── content_json -> static HTML. Deliberately renders only the
// non-interactive blocks (text, example-set, dialogue, comparison-table,
// rule-card, common-mistake, vocab-grid, tip, recap) — write-prompt and
// scenario-check stay app-only, replaced by the single CTA at the page's
// end (audit Section J.4). No audio buttons here either: this page has no
// dependency on the TTS API, by design. ──
function renderBlock(block) {
  switch (block.type) {
    case 'text':
      return '<p class="lp-text">' + esc(block.content) + '</p>';
    case 'dialogue': {
      var groups = Array.isArray(block.groups) ? block.groups : [{ label: block.label, lines: block.lines }];
      return groups.map(function(g) {
        var label = g.label ? '<div class="lp-dl-label">' + esc(g.label) + '</div>' : '';
        var lines = (g.lines || []).map(function(l) {
          var text = (l.stem || '') + (l.subject || '') + (l.verb || '') + (l.change || '') + (l.rest || '');
          return '<div class="lp-dl-line">' + esc(text) + '</div>';
        }).join('');
        return '<div class="lp-dialogue">' + label + lines + '</div>';
      }).join('');
    }
    case 'example-set': {
      var label = block.label ? '<p class="lp-text">' + esc(block.label) + '</p>' : '';
      var items = (block.items || []).map(function(it) {
        return '<div class="lp-example"><span class="de">' + esc(it.german) + '</span><span class="en">' + esc(it.english) + '</span></div>';
      }).join('');
      return label + items;
    }
    case 'rule-card':
      return '<div class="lp-rule"><span class="lp-rule-icon">' + esc(block.icon || '') + '</span><div><div class="lp-rule-title">' + esc(block.title) + '</div><div class="lp-rule-desc">' + esc(block.description) + '</div></div></div>';
    case 'comparison-table': {
      var headers = block.headers || [];
      var rows = block.rows || [];
      var thead = '<thead><tr>' + headers.map(function(h) { return '<th>' + esc(h) + '</th>'; }).join('') + '</tr></thead>';
      var tbody = '<tbody>' + rows.map(function(r) {
        return '<tr>' + r.map(function(c) { return '<td>' + esc(c) + '</td>'; }).join('') + '</tr>';
      }).join('') + '</tbody>';
      return '<table class="lp-table">' + thead + tbody + '</table>';
    }
    case 'common-mistake':
      return '<div class="lp-mistake"><strong>Common mistake:</strong> ' + esc(block.content) + '</div>';
    case 'vocab-grid': {
      var label = block.label ? '<p class="lp-text">' + esc(block.label) + '</p>' : '';
      var items = (block.items || []).map(function(it) {
        return '<span class="lp-vocab-chip">' + esc((it.article ? it.article + ' ' : '') + it.word) + (it.translation ? ' <span class="en">(' + esc(it.translation) + ')</span>' : '') + '</span>';
      }).join('');
      return label + '<div class="lp-vocab-row">' + items + '</div>';
    }
    case 'tip': {
      var content = String(block.content || '');
      var isCheck = /^Quick check:/i.test(content);
      var body = isCheck ? content.replace(/^Quick check:\s*/i, '') : content;
      return '<div class="lp-tip">' + (isCheck ? '<div class="lp-tip-label">Quick check</div>' : '') + '<p>' + esc(body) + '</p></div>';
    }
    case 'recap':
      return '<div class="lp-recap"><div class="lp-recap-label">In short</div><p>' + esc(block.content) + '</p></div>';
    default:
      return '';
  }
}

// H2s mark the start of a new teaching beat. Two trigger conditions, both
// derived from how these 6 lessons are actually structured (verified
// against live content_json, not assumed):
//   1. Every 'text' block opens a new heading (each lesson has exactly
//      one, consumed from the front of the per-lesson `headings` queue).
//   2. An 'example-set'/'vocab-grid' that carries its own `label` opens a
//      new heading too, but ONLY when it's not immediately preceded by a
//      'text' block — when it follows 'text' directly, its label is that
//      text's continuation (more examples of the same point), not a new
//      point, so it shares the heading 'text' just opened.
// 'tip' blocks phrased as "Quick check: …" get their own fixed heading,
// independent of the queue. 'dialogue' never triggers a heading — it's
// the page's context-setting opener and reads as lede continuation.
function renderLessonBody(contentJson, headingQueue) {
  var html = '';
  var headings = headingQueue.slice();
  var prevType = null;

  contentJson.forEach(function(block) {
    if (block.type === 'tip') {
      var content = String(block.content || '');
      if (/^Quick check:/i.test(content)) {
        html += '<h2 class="lp-h2">Quick check</h2>' + renderBlock(block);
      } else {
        html += renderBlock(block);
      }
      prevType = block.type;
      return;
    }
    if (block.type === 'recap') { html += renderBlock(block); prevType = block.type; return; }
    if (block.type === 'write-prompt' || block.type === 'scenario-check') { return; } // app-only, prevType unchanged

    var opensHeading =
      block.type === 'text' ||
      ((block.type === 'example-set' || block.type === 'vocab-grid') && block.label && prevType !== 'text');

    if (opensHeading && headings.length) {
      html += '<h2 class="lp-h2">' + esc(headings.shift()) + '</h2>';
    }
    html += renderBlock(block);
    prevType = block.type;
  });
  return html;
}

function headBlock(opts) {
  return [
    '<meta charset="UTF-8">',
    '<meta name="viewport" content="width=device-width, initial-scale=1.0">',
    '',
    '<title>' + esc(opts.title) + '</title>',
    '<meta name="description" content="' + esc(opts.description) + '">',
    '<meta name="robots" content="index, follow">',
    '<meta name="language" content="English">',
    '<meta name="author" content="DeutschWeg">',
    '<link rel="canonical" href="' + opts.canonical + '">',
    '',
    '<meta property="og:type" content="' + (opts.ogType || 'article') + '">',
    '<meta property="og:url" content="' + opts.canonical + '">',
    '<meta property="og:title" content="' + esc(opts.title) + '">',
    '<meta property="og:description" content="' + esc(opts.description) + '">',
    '<meta property="og:image" content="' + SITE + '/og-image.png">',
    '',
    '<meta name="twitter:card" content="summary_large_image">',
    '<meta name="twitter:title" content="' + esc(opts.title) + '">',
    '<meta name="twitter:description" content="' + esc(opts.description) + '">',
    '<meta name="twitter:image" content="' + SITE + '/og-image.png">',
    '',
    '<script type="application/ld+json">' + JSON.stringify(opts.jsonLd, null, 2) + '</script>',
    '',
    '<link rel="stylesheet" href="/deutschweg-theme.css">',
    '<style>' + SHARED_CSS + '</style>'
  ].join('\n');
}

var SHARED_CSS = '\n' +
  '  .lp-nav{display:flex;align-items:center;padding:0 24px;height:58px;border-bottom:1px solid #E5E7EB;background:#fff;position:sticky;top:0;z-index:50;}\n' +
  '  .lp-logo{display:flex;align-items:center;gap:9px;text-decoration:none;color:#1F2937;font-weight:800;font-size:17px;}\n' +
  '  .lp-logo-icon{width:30px;height:30px;background:#3B82F6;border-radius:8px;display:flex;align-items:center;justify-content:center;color:#fff;font-size:15px;font-weight:800;}\n' +
  '  .lp-logo span{color:#3B82F6;}\n' +
  '  .lp-wrap{max-width:680px;margin:0 auto;padding:36px 24px 80px;}\n' +
  '  .lp-crumb{font-family:"DM Mono",monospace;font-size:11.5px;color:#9CA3AF;margin-bottom:16px;}\n' +
  '  .lp-crumb a{color:#6B7280;text-decoration:none;} .lp-crumb a:hover{color:#3B82F6;}\n' +
  '  .lp-eyebrow{font-size:11px;font-weight:800;letter-spacing:2px;text-transform:uppercase;color:#3B82F6;margin-bottom:10px;}\n' +
  '  .lp-h1{font-size:28px;font-weight:800;margin:0 0 10px;color:#1F2937;letter-spacing:-0.4px;line-height:1.25;}\n' +
  '  .lp-h1 .en{color:#6B7280;font-weight:600;}\n' +
  '  .lp-lede{font-size:15.5px;color:#4B5563;line-height:1.7;margin-bottom:8px;}\n' +
  '  .lp-h2{font-family:"Playfair Display",serif;font-size:19px;font-weight:700;margin:30px 0 12px;color:#1F2937;}\n' +
  '  .lp-text{font-size:14.5px;line-height:1.75;color:#374151;margin:0 0 10px;}\n' +
  '  .lp-example{background:#F0F9FF;border-left:3px solid #3B82F6;padding:10px 14px;margin:8px 0;border-radius:0 8px 8px 0;}\n' +
  '  .lp-example .de{display:block;font-weight:700;color:#1E3A5F;font-size:14.5px;} .lp-example .en{display:block;color:#6B7280;font-size:13px;margin-top:2px;}\n' +
  '  .lp-dialogue{background:#fff;border:1px solid #E5E7EB;border-radius:12px;padding:14px 18px;margin:8px 0 16px;}\n' +
  '  .lp-dl-label{font-size:10.5px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#9CA3AF;margin-bottom:8px;}\n' +
  '  .lp-dl-line{padding:6px 0;font-size:14.5px;font-weight:600;color:#1F2937;border-bottom:1px solid #F1F5F9;} .lp-dl-line:last-child{border-bottom:none;}\n' +
  '  .lp-rule{display:flex;gap:12px;align-items:flex-start;background:#F9FAFB;border:1px solid #E5E7EB;border-radius:12px;padding:14px 16px;margin:8px 0;}\n' +
  '  .lp-rule-icon{font-size:22px;} .lp-rule-title{font-weight:800;font-size:15px;color:#1F2937;} .lp-rule-desc{font-size:13px;color:#6B7280;margin-top:2px;}\n' +
  '  .lp-table{width:100%;border-collapse:collapse;margin:8px 0 16px;font-size:13.5px;}\n' +
  '  .lp-table th{text-align:left;font-size:10.5px;text-transform:uppercase;letter-spacing:0.5px;color:#9CA3AF;padding:8px 10px;border-bottom:1px solid #E5E7EB;}\n' +
  '  .lp-table td{padding:8px 10px;border-bottom:1px solid #F3F4F6;color:#374151;}\n' +
  '  .lp-mistake{background:#FEF2F2;border-left:3px solid #EF4444;border-radius:0 8px 8px 0;padding:10px 14px;margin:8px 0;font-size:13.5px;color:#7F1D1D;}\n' +
  '  .lp-vocab-row{display:flex;flex-wrap:wrap;gap:8px;margin:8px 0 16px;}\n' +
  '  .lp-vocab-chip{background:#F9FAFB;border:1px solid #E5E7EB;border-radius:20px;padding:6px 14px;font-size:13px;font-weight:600;color:#1F2937;} .lp-vocab-chip .en{font-weight:400;color:#9CA3AF;}\n' +
  '  .lp-tip{background:#F0FDF4;border-left:3px solid #22C55E;border-radius:0 8px 8px 0;padding:10px 14px;margin:8px 0;font-size:14px;color:#166534;}\n' +
  '  .lp-tip-label{font-size:10.5px;font-weight:800;text-transform:uppercase;letter-spacing:0.8px;margin-bottom:4px;}\n' +
  '  .lp-recap{background:#FFFBEB;border:1px solid #FDE68A;border-radius:12px;padding:14px 18px;margin:20px 0;}\n' +
  '  .lp-recap-label{font-size:10.5px;font-weight:800;text-transform:uppercase;letter-spacing:0.8px;color:#92400E;margin-bottom:4px;}\n' +
  '  .lp-cta{display:block;text-align:center;background:#3B82F6;color:#fff;text-decoration:none;font-weight:800;font-size:15px;border-radius:50px;padding:15px 22px;margin:28px 0 8px;}\n' +
  '  .lp-cta:hover{background:#2563EB;}\n' +
  '  .lp-pager{display:flex;justify-content:space-between;gap:12px;margin-top:24px;font-size:13px;}\n' +
  '  .lp-pager a{color:#3B82F6;text-decoration:none;font-weight:700;}\n' +
  '  .lp-path{margin-top:32px;padding-top:20px;border-top:1px solid #E5E7EB;}\n' +
  '  .lp-path-label{font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:1px;color:#9CA3AF;margin-bottom:10px;}\n' +
  '  .lp-path-list{display:flex;flex-direction:column;gap:6px;}\n' +
  '  .lp-path-item{font-size:13.5px;color:#6B7280;text-decoration:none;padding:6px 0;}\n' +
  '  .lp-path-item.current{color:#1F2937;font-weight:700;}\n' +
  '  .lp-path-item:hover{color:#3B82F6;}\n';

function navHtml() {
  return '<nav class="lp-nav"><a class="lp-logo" href="/"><span class="lp-logo-icon">D</span>Deutsch<span>Weg</span></a></nav>';
}

function breadcrumbJsonLd(items) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map(function(it, i) {
      return { '@type': 'ListItem', position: i + 1, name: it.name, item: it.url };
    })
  };
}

(async () => {
  const { data: topic, error: topicErr } = await sb.from('topics').select('*').eq('id', TOPIC_ID).single();
  if (topicErr) { console.error(topicErr); process.exit(1); }

  const { data: items, error: itemsErr } = await sb.from('topic_items')
    .select('order_index, display_title, lesson:lessons!lesson_id(id, title, content_json, lernziel_intro)')
    .eq('topic_id', TOPIC_ID).order('order_index');
  if (itemsErr) { console.error(itemsErr); process.exit(1); }
  if (items.length !== LESSON_SEO.length) { console.error('LESSON_SEO length mismatch — expected', items.length, 'got', LESSON_SEO.length); process.exit(1); }

  const topicUrl = SITE + '/a1/' + TOPIC_SEO.slug;
  const levelUrl = SITE + '/a1';

  const outDir = path.join(__dirname, '..', 'a1', TOPIC_SEO.slug);
  fs.mkdirSync(outDir, { recursive: true });

  // ── Topic page ───────────────────────────────────────────────────────
  const topicTitle = topic.title_de + ' — ' + TOPIC_SEO.titleEn + ' · DeutschWeg';
  const topicJsonLd = [
    breadcrumbJsonLd([
      { name: 'A1', url: levelUrl },
      { name: topic.title_de, url: topicUrl }
    ]),
    {
      '@context': 'https://schema.org',
      '@type': 'Course',
      name: topic.title_de + ' — ' + topic.title_en,
      description: topic.outcome_line,
      provider: { '@type': 'Organization', name: 'DeutschWeg', sameAs: SITE },
      url: topicUrl,
      inLanguage: 'en',
      hasCourseInstance: [{ '@type': 'CourseInstance', courseMode: 'Online', courseWorkload: 'PT30M' }]
    }
  ];

  const pathListHtml = items.map(function(it, i) {
    const seo = LESSON_SEO[i];
    return '<a class="lp-path-item" href="/a1/' + TOPIC_SEO.slug + '/' + seo.slug + '">' + (i + 1) + '. ' + esc(it.display_title) + '</a>';
  }).join('');

  const topicHtml = '<!DOCTYPE html>\n<html lang="en">\n<head>\n' + headBlock({
    title: topicTitle,
    description: topic.outcome_line,
    canonical: topicUrl,
    jsonLd: topicJsonLd,
    ogType: 'website'
  }) + '\n</head>\n<body>\n' + navHtml() + '\n<div class="lp-wrap">\n' +
    '<div class="lp-crumb"><a href="/a1">A1</a> &middot; ' + esc(topic.title_de) + '</div>\n' +
    '<div class="lp-eyebrow">A1 &middot; Topic</div>\n' +
    '<h1 class="lp-h1">' + esc(topic.title_de) + ' <span class="en">&mdash; ' + esc(TOPIC_SEO.titleEn) + '</span></h1>\n' +
    '<p class="lp-lede">' + esc(topic.outcome_line) + '</p>\n' +
    '<a class="lp-cta" href="/topic.html?id=' + TOPIC_ID + '">Start learning &mdash; track your progress &rarr;</a>\n' +
    '<div class="lp-path">\n<div class="lp-path-label">The six steps</div>\n<div class="lp-path-list">' + pathListHtml + '</div>\n</div>\n' +
    '</div>\n</body>\n</html>\n';

  fs.writeFileSync(path.join(outDir, 'index.html'), topicHtml, 'utf8');
  console.log('Wrote a1/' + TOPIC_SEO.slug + '/index.html');

  // ── Lesson pages ─────────────────────────────────────────────────────
  items.forEach(function(item, i) {
    const seo = LESSON_SEO[i];
    const lesson = item.lesson;
    const lessonUrl = SITE + '/a1/' + TOPIC_SEO.slug + '/' + seo.slug;
    const prev = items[i - 1] ? LESSON_SEO[i - 1] : null;
    const next = items[i + 1] ? LESSON_SEO[i + 1] : null;

    const lessonJsonLd = [
      breadcrumbJsonLd([
        { name: 'A1', url: levelUrl },
        { name: topic.title_de, url: topicUrl },
        { name: item.display_title, url: lessonUrl }
      ])
    ];

    const lessonDir = path.join(outDir, seo.slug);
    fs.mkdirSync(lessonDir, { recursive: true });

    const pagerHtml =
      '<div class="lp-pager">' +
      (prev ? '<a href="/a1/' + TOPIC_SEO.slug + '/' + prev.slug + '">&larr; Previous</a>' : '<span></span>') +
      (next ? '<a href="/a1/' + TOPIC_SEO.slug + '/' + next.slug + '">Next &rarr;</a>' : '<span></span>') +
      '</div>';

    const lessonTitle = item.display_title + ' — ' + seo.titleEn + ' · DeutschWeg';
    const moduleLessonUrl = '/module.html?id=' + HIDDEN_MODULE_ID + '&lesson=' + item.order_index + '&topic=' + TOPIC_ID;

    const html = '<!DOCTYPE html>\n<html lang="en">\n<head>\n' + headBlock({
      title: lessonTitle,
      description: seo.metaDescription,
      canonical: lessonUrl,
      jsonLd: lessonJsonLd
    }) + '\n</head>\n<body>\n' + navHtml() + '\n<div class="lp-wrap">\n' +
      '<div class="lp-crumb"><a href="/a1">A1</a> &middot; <a href="/a1/' + TOPIC_SEO.slug + '">' + esc(topic.title_de) + '</a> &middot; ' + esc(item.display_title) + '</div>\n' +
      '<div class="lp-eyebrow">' + esc(topic.title_de) + ' &middot; Step ' + item.order_index + ' of ' + items.length + '</div>\n' +
      '<h1 class="lp-h1">' + esc(item.display_title) + ' <span class="en">&mdash; ' + esc(seo.titleEn) + '</span></h1>\n' +
      (lesson.lernziel_intro ? '<p class="lp-lede">' + esc(lesson.lernziel_intro) + '</p>\n' : '') +
      renderLessonBody(lesson.content_json, seo.headings) + '\n' +
      '<a class="lp-cta" href="' + moduleLessonUrl + '">Practice this in the app &rarr;</a>\n' +
      pagerHtml + '\n' +
      '</div>\n</body>\n</html>\n';

    fs.writeFileSync(path.join(lessonDir, 'index.html'), html, 'utf8');
    console.log('Wrote a1/' + TOPIC_SEO.slug + '/' + seo.slug + '/index.html');
  });

  console.log('\nDone — 1 topic page + ' + items.length + ' lesson pages.');
})();
