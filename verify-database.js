const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://rnevebffhtplbixdmbgq.supabase.co';
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJuZXZlYmZmaHRwbGJpeGRtYmdxIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NjY2Mjk4NCwiZXhwIjoyMDcyMjM4OTg0fQ.s2sWaR-21kbs5lN7amLhSjac7mPMb10EH6dJqFxeiK4';

console.log('🔍 VERIFYING DATABASE CONNECTION');
console.log('================================');
console.log('URL:', supabaseUrl);
console.log('Project ID:', 'rnevebffhtplbixdmbgq');
console.log('');

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function verifyDatabase() {
  // First, let's check what tables exist
  console.log('📊 Checking for WORKSPACES table (should exist):');
  const { count: wsCount, error: wsError } = await supabase
    .from('workspaces')
    .select('*', { count: 'exact', head: true });
  
  if (wsError) {
    console.log('❌ workspaces table:', wsError.message);
  } else {
    console.log(`✅ workspaces table EXISTS with ${wsCount || 0} records`);
  }

  console.log('\n📊 Checking for HOUSEHOLDS table (should NOT exist):');
  const { count: hhCount, error: hhError } = await supabase
    .from('households')
    .select('*', { count: 'exact', head: true });
  
  if (hhError) {
    console.log('❌ households table:', hhError.message);
  } else {
    console.log(`⚠️  households table EXISTS with ${hhCount || 0} records - THIS IS WRONG DATABASE!`);
  }

  console.log('\n📊 Checking for USER_PROFILES table (should exist):');
  const { count: upCount, error: upError } = await supabase
    .from('user_profiles')
    .select('*', { count: 'exact', head: true });
  
  if (upError) {
    console.log('❌ user_profiles table:', upError.message);
  } else {
    console.log(`✅ user_profiles table EXISTS with ${upCount || 0} records`);
  }

  console.log('\n📊 Checking for USERS table (should NOT be main table):');
  const { count: uCount, error: uError } = await supabase
    .from('users')
    .select('*', { count: 'exact', head: true });
  
  if (uError) {
    console.log('❌ users table:', uError.message);
  } else {
    console.log(`⚠️  users table EXISTS with ${uCount || 0} records`);
  }

  // Check auth users
  console.log('\n👤 Checking auth.users:');
  const { data: authUsers } = await supabase.auth.admin.listUsers();
  if (authUsers && authUsers.users) {
    console.log(`Found ${authUsers.users.length} auth users`);
    authUsers.users.forEach(u => {
      console.log(`  • ${u.email} (${u.id})`);
    });
  }

  console.log('\n⚠️  SUMMARY:');
  console.log('This appears to be the WRONG database or the schema has been changed!');
  console.log('Expected: workspaces, user_profiles, bank_accounts');
  console.log('Found: households, users, accounts');
}

verifyDatabase();