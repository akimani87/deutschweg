/**
 * One-shot: standardise every A1 exam title to the canonical
 * Prüfungsvorbereitung name, so the page header + attempt history
 * read identically regardless of which Übungssatz the user took.
 * The dropdown surfaces the set choice ("Übungssatz 1/2/...").
 */
require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

(async () => {
  // Show before-state so the change is auditable
  const before = await sb.from('exams').select('id, level, section, title').eq('level', 'A1').order('section').order('created_at');
  if (before.error) throw before.error;
  console.log('BEFORE:');
  before.data.forEach(e => console.log('  ' + e.section.padEnd(10) + ' ' + e.title));

  // Update Schreiben titles
  const schr = await sb.from('exams')
    .update({ title: 'A1 Schreiben — Prüfungsvorbereitung' })
    .eq('level', 'A1').eq('section', 'schreiben')
    .select('id, title');
  if (schr.error) throw schr.error;
  console.log('\nUpdated ' + schr.data.length + ' Schreiben rows');

  // Update Lesen titles
  const les = await sb.from('exams')
    .update({ title: 'A1 Lesen — Prüfungsvorbereitung' })
    .eq('level', 'A1').eq('section', 'lesen')
    .select('id, title');
  if (les.error) throw les.error;
  console.log('Updated ' + les.data.length + ' Lesen rows');

  // After-state
  const after = await sb.from('exams').select('id, level, section, title').eq('level', 'A1').order('section').order('created_at');
  console.log('\nAFTER:');
  after.data.forEach(e => console.log('  ' + e.section.padEnd(10) + ' ' + e.title));
})();
