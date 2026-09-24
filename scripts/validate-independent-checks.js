'use strict';
// Safeguard against the exact bug class that shipped Über mich's task to
// every unconfigured topic: fails loudly (non-zero exit) if any PUBLISHED
// topic is missing a matching entry in either independent-check.html's
// TOPIC_CHECKS (the actual check + grading rubric) or topic.html's
// TOPIC_CHECK_PREVIEW (the topic-home preview card). Run before publishing
// any topic: `node scripts/validate-independent-checks.js`.
//
// Deliberately does NOT check whether the two entries' wording matches --
// that's a human content-quality judgment. It only checks that an entry
// exists at all, since a MISSING entry is what silently falls through to
// TOPIC_CHECKS[topicId] || DEFAULT_CHECK (independent-check.html, now
// removed) or a hardcoded placeholder (topic.html's old static card) --
// both now hard errors instead, but this script catches the gap before a
// learner ever would.

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

const root = path.resolve(__dirname, '..');
const read = (name) => fs.readFileSync(path.join(root, name), 'utf8');

// Extracts the UUID keys of a `var NAME = { '<uuid>': { ... }, ... };`
// object literal by scanning for the object's own top-level keys -- not a
// full JS parse, but robust to reordering/whitespace changes, matching
// this repo's existing static-validation style (see
// validate-a1-exam-vault-static.js).
function extractTopicKeys(source, varName) {
  const startMatch = source.match(new RegExp('var ' + varName + '\\s*=\\s*\\{'));
  if (!startMatch) return null;
  const start = startMatch.index + startMatch[0].length;
  // Find the matching closing brace by depth-counting from `start`.
  let depth = 1;
  let i = start;
  for (; i < source.length && depth > 0; i++) {
    if (source[i] === '{') depth++;
    else if (source[i] === '}') depth--;
  }
  const body = source.slice(start, i);
  const uuidRe = /^\s*'([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})'\s*:/gm;
  const keys = new Set();
  let m;
  while ((m = uuidRe.exec(body))) keys.add(m[1]);
  return keys;
}

(async () => {
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.error('FAIL  SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY not set in .env — cannot look up published topics.');
    process.exitCode = 1;
    return;
  }
  const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
  const { data: topics, error } = await supabase
    .from('topics')
    .select('id, title_de, is_published')
    .eq('is_published', true)
    .order('order_index');
  if (error) {
    console.error('FAIL  could not query topics:', error.message);
    process.exitCode = 1;
    return;
  }

  const checkHtml = read('independent-check.html');
  const topicHtml = read('topic.html');
  const checkKeys = extractTopicKeys(checkHtml, 'TOPIC_CHECKS');
  const previewKeys = extractTopicKeys(topicHtml, 'TOPIC_CHECK_PREVIEW');

  let failed = 0;
  const report = (name, ok) => { console.log(`${ok ? 'PASS' : 'FAIL'} ${name}`); if (!ok) failed++; };

  report('independent-check.html defines TOPIC_CHECKS', !!checkKeys);
  report('topic.html defines TOPIC_CHECK_PREVIEW', !!previewKeys);
  if (!checkKeys || !previewKeys) { console.log(`\n${failed} failure(s)`); process.exitCode = 1; return; }

  // The two silent-fallback code paths this whole task exists to prevent
  // must both actually be gone, not just superseded by this script.
  // Matches the actual fallback pattern, not just the identifier -- a
  // code comment that mentions "DEFAULT_CHECK" (e.g. explaining its
  // removal) must not itself fail this check.
  report('independent-check.html has no silent topic-fallback pattern', !/\|\|\s*DEFAULT_CHECK|var\s+DEFAULT_CHECK\s*=/.test(checkHtml));
  report('topic.html check-card has no hardcoded "Introduce yourself"', !topicHtml.includes('Introduce yourself without help</div>'));

  for (const t of topics) {
    report(`TOPIC_CHECKS has an entry for "${t.title_de}" (${t.id})`, checkKeys.has(t.id));
    report(`TOPIC_CHECK_PREVIEW has an entry for "${t.title_de}" (${t.id})`, previewKeys.has(t.id));
  }

  console.log(`\n${topics.length} published topic(s) checked, ${failed} failure(s).`);
  process.exitCode = failed ? 1 : 0;
})();
