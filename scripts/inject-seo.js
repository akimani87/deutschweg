/**
 * SEO meta injector for DeutschWeg.
 *
 * Walks every *.html in the project root and inserts a standard block
 * of <meta> tags right after the viewport tag (or after <head> if no
 * viewport is present). Each page gets:
 *   - name="title" / "description" / "keywords" / "robots" / "language" / "author"
 *   - canonical link
 *   - Open Graph (og:type, url, title, description, image)
 *   - Twitter card (summary_large_image, title, description, image)
 *
 * Page-specific values:
 *   - <title> kept as-is (used for og:title / twitter:title).
 *   - Existing <meta name="description"> kept; otherwise generic site
 *     description is injected.
 *   - og:url is computed from the filename (special-cased for index,
 *     dashboard, blog index/posts, and the friendly clean URLs the
 *     sitemap exposes).
 *   - admin.html and dashboard.html get robots="noindex, nofollow"
 *     because robots.txt also disallows them.
 *
 * Idempotent: a sentinel comment <!-- DW SEO INJECT --> marks already-
 * processed files. blog-*.html is skipped (those are owned by
 * generate-blog-posts.js, which emits the same block natively).
 */
const fs   = require('fs');
const path = require('path');

const ROOT   = path.resolve(__dirname, '..');
const MARKER = '<!-- DW SEO INJECT -->';

const GENERIC = {
  title:        'DeutschWeg — Goethe Exam Prep for African Learners',
  description:  'Prepare for your Goethe German exam with AI-powered lessons. A1, A2, B1, B2 — built for African learners. Start free today.',
  ogTitle:      'DeutschWeg — Goethe Exam Prep for African Learners',
  ogDesc:       'AI-powered German exam preparation. A1 to B2. Built for African learners. Start free.',
  twitterTitle: 'DeutschWeg — Goethe Exam Prep',
  twitterDesc:  'AI-powered German exam prep for African learners. A1 to B2. Start free.',
  keywords:     'Goethe exam, German exam Africa, learn German Kenya, Goethe A1 B1, German certificate, Ausbildung German, family reunification German',
  ogImage:      'https://deutschweg.de/og-image.png'
};

const NOINDEX = new Set(['admin.html', 'dashboard.html']);

// Pages that should be skipped entirely (e.g. blog posts, owned by their
// own generator).
function shouldSkip(filename) {
  return /^blog-.+\.html$/.test(filename);
}

// Map filename → canonical URL. Most pages just drop the .html suffix.
function urlFor(filename) {
  if (filename === 'index.html') return 'https://deutschweg.de/';
  if (filename === 'blog.html')  return 'https://deutschweg.de/blog';
  return 'https://deutschweg.de/' + filename.replace(/\.html$/, '');
}

function escapeAttr(s) {
  return String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;');
}

function extract(html, regex) {
  const m = html.match(regex);
  return m ? m[1].trim() : null;
}

function build(filename, existingTitle, existingDesc) {
  const url       = urlFor(filename);
  const title     = existingTitle || GENERIC.title;
  const desc      = existingDesc  || GENERIC.description;
  const robotsVal = NOINDEX.has(filename) ? 'noindex, nofollow' : 'index, follow';

  // For og:title we use the existing <title>; if it's the generic
  // fallback we keep it. For twitter, prefer a short variant when the
  // page is using the generic title.
  const twTitle = existingTitle ? title : GENERIC.twitterTitle;
  const twDesc  = existingDesc  ? desc  : GENERIC.twitterDesc;

  const lines = [
    MARKER,
    `<meta name="title" content="${escapeAttr(title)}">`,
    !existingDesc ? `<meta name="description" content="${escapeAttr(desc)}">` : null,
    `<meta name="keywords" content="${GENERIC.keywords}">`,
    `<meta name="robots" content="${robotsVal}">`,
    `<meta name="language" content="English">`,
    `<meta name="author" content="DeutschWeg">`,
    `<link rel="canonical" href="${url}">`,
    ``,
    `<meta property="og:type" content="website">`,
    `<meta property="og:url" content="${url}">`,
    `<meta property="og:title" content="${escapeAttr(title)}">`,
    `<meta property="og:description" content="${escapeAttr(desc)}">`,
    `<meta property="og:image" content="${GENERIC.ogImage}">`,
    ``,
    `<meta name="twitter:card" content="summary_large_image">`,
    `<meta name="twitter:title" content="${escapeAttr(twTitle)}">`,
    `<meta name="twitter:description" content="${escapeAttr(twDesc)}">`,
    `<meta name="twitter:image" content="${GENERIC.ogImage}">`,
    `<!-- /DW SEO INJECT -->`
  ].filter(x => x !== null);

  return lines.join('\n');
}

function inject(html, filename) {
  if (html.includes(MARKER)) return null; // already done
  if (!/<head[^>]*>/i.test(html)) return null;

  const existingTitle = extract(html, /<title>([^<]+)<\/title>/i);
  const existingDesc  = extract(html, /<meta\s+name=["']description["']\s+content=["']([^"']+)["']/i);
  const block         = build(filename, existingTitle, existingDesc);

  // Insert after viewport meta if present, else right after <head>.
  if (/<meta\s+name=["']viewport["']/i.test(html)) {
    return html.replace(/(<meta\s+name=["']viewport["'][^>]*>)/i, '$1\n\n' + block);
  }
  return html.replace(/(<head[^>]*>)/i, '$1\n' + block);
}

const files = fs.readdirSync(ROOT).filter(f => f.endsWith('.html'));
let added = 0, skippedMarker = 0, skippedBlog = 0, skippedNoHead = 0;

for (const f of files) {
  if (shouldSkip(f)) { skippedBlog++; continue; }
  const fp   = path.join(ROOT, f);
  const html = fs.readFileSync(fp, 'utf8');
  const next = inject(html, f);
  if (next === null) {
    if (html.includes(MARKER)) skippedMarker++;
    else                       skippedNoHead++;
    continue;
  }
  fs.writeFileSync(fp, next, 'utf8');
  added++;
}

console.log('Added to ' + added + ' file(s).');
console.log('  skipped (already injected): ' + skippedMarker);
console.log('  skipped (blog post):        ' + skippedBlog);
console.log('  skipped (no <head>):        ' + skippedNoHead);
console.log('Total: ' + files.length);
