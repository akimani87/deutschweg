// DeutschWeg — deletes every disposable auth user/row created by
// phaseb-sprechen-fixtures.js and phaseb-sprechen-classification-fixtures.js
// (matched by the dw-phaseb-*@example.com email pattern and set_number >=
// 9000 test sets). Run after phaseb-sprechen-server-tests.js.
//
// Run from the repo root: node scripts/phaseb-sprechen-cleanup.js

const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });
const { createClient } = require('@supabase/supabase-js');

const admin = createClient('https://udmunxzzuqoynlftapwh.supabase.co', process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

async function main() {
  const { data: users } = await admin.from('auth.users').select('id').ilike('email', 'dw-phaseb-%@example.com');
  // supabase-js can't query auth.users directly via .from() on most
  // projects' exposed schema — use RPC-free raw fetch of user ids via the
  // admin auth API instead, matching how fixtures were created.
  const { data: listed } = await admin.auth.admin.listUsers({ perPage: 1000 });
  const testUserIds = (listed && listed.users || [])
    .filter((u) => /^dw-phaseb-.*@example\.com$/.test(u.email || ''))
    .map((u) => u.id);

  if (testUserIds.length) {
    await admin.from('mock_exam_attempts').update({ sprechen_session_id: null }).in('user_id', testUserIds);
    await admin.from('sprechen_sessions').delete().in('user_id', testUserIds);
    await admin.from('mock_exam_attempts').delete().in('user_id', testUserIds);
    await admin.from('exam_attempts').delete().in('user_id', testUserIds);
    for (const id of testUserIds) await admin.auth.admin.deleteUser(id);
  }
  await admin.from('mock_exam_sets').delete().gte('set_number', 9000);

  const { data: remainingUsers } = await admin.auth.admin.listUsers({ perPage: 1000 });
  const remaining = (remainingUsers && remainingUsers.users || []).filter((u) => /^dw-phaseb-.*@example\.com$/.test(u.email || ''));
  const { count: remainingSets } = await admin.from('mock_exam_sets').select('id', { count: 'exact', head: true }).gte('set_number', 9000);
  console.log('Cleanup done. Remaining test users:', remaining.length, '| Remaining test sets:', remainingSets);
}

main().then(() => process.exit(0)).catch((e) => { console.error('CLEANUP FAILED', e); process.exit(1); });
