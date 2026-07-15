/**
 * Read-only consistency check for static module-mockup filenames against
 * the live `modules` table. Written after discovering that several
 * module-*.html files (der/die/das, and ~28 others across A1/A2/B1) had
 * drifted from the DB's actual level+order_index — some using a stale
 * pre-renumbering global scheme, others just mislabeled from the start.
 *
 * Only checks files that already follow the established convention
 * `module-<level>-<order_index>-<slug>.html` (e.g. module-a1-5-der-die-das.html,
 * module-b2-3-nominalisierung.html). It cannot detect a *new* mockup built
 * under some other ad hoc naming scheme — the whole point of the
 * convention is that a file announces its own (level, order_index) in its
 * name, so there's nothing to check until a file actually adopts it. Run
 * this after adding or renaming any module-*.html file.
 *
 * Usage:
 *   node scripts/check-static-module-naming.js
 */
require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

const FILENAME_RE = /^module-(a1|a2|b1|b2|c1|c2)-(\d+)-([a-z0-9-]+)\.html$/i;

async function main() {
  const files = fs.readdirSync(path.join(__dirname, '..'))
    .filter((f) => FILENAME_RE.test(f));

  if (!files.length) {
    console.log('No module-<level>-<n>-<slug>.html files found.');
    return;
  }

  const { data: modules, error } = await sb.from('modules').select('level, order_index, title');
  if (error) { console.error('Failed to read modules:', error.message); process.exit(1); }

  const byKey = new Map();
  modules.forEach((m) => byKey.set(m.level.toUpperCase() + '-' + m.order_index, m.title));

  const findings = [];
  const claimed = new Map(); // key -> [files claiming it]

  files.forEach((f) => {
    const m = f.match(FILENAME_RE);
    const level = m[1].toUpperCase();
    const orderIndex = parseInt(m[2], 10);
    const key = level + '-' + orderIndex;
    if (!claimed.has(key)) claimed.set(key, []);
    claimed.get(key).push(f);

    const title = byKey.get(key);
    if (title === undefined) {
      findings.push({ severity: 'FAIL', file: f, message: `no module exists at ${level} order_index=${orderIndex} — filename doesn't match any live module` });
    } else {
      findings.push({ severity: 'PASS', file: f, message: `${level} #${orderIndex} — DB title: "${title}"` });
    }
  });

  claimed.forEach((fileList, key) => {
    if (fileList.length > 1) {
      findings.push({ severity: 'FAIL', file: fileList.join(', '), message: `collision — ${fileList.length} files all claim ${key}` });
    }
  });

  console.log(`=== STATIC MODULE NAMING CHECK (${files.length} files) ===\n`);
  findings.filter((f) => f.severity === 'FAIL').forEach((f) => console.log(`[FAIL] ${f.file} — ${f.message}`));
  findings.filter((f) => f.severity === 'PASS').forEach((f) => console.log(`[PASS] ${f.file} — ${f.message}`));

  const failCount = findings.filter((f) => f.severity === 'FAIL').length;
  console.log(`\n${findings.length - failCount} PASS, ${failCount} FAIL`);
  process.exit(failCount ? 1 : 0);
}

main().catch((e) => { console.error('CRASHED:', e); process.exit(1); });
