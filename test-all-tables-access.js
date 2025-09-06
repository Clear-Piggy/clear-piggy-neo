const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.REACT_APP_SUPABASE_URL;
const supabaseAnonKey = process.env.REACT_APP_SUPABASE_ANON_KEY;

async function testAllTablesAccess() {
  console.log('🧪 Testing Access to All Tables After Fix\n');
  console.log('=' .repeat(60));
  
  // Create client and sign in
  const supabase = createClient(supabaseUrl, supabaseAnonKey);
  
  console.log('1️⃣ Signing in...');
  const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
    email: 'test123@gmail.com',
    password: 'test123456'
  });
  
  if (authError) {
    console.log('   ❌ Auth error:', authError.message);
    return;
  }
  
  console.log('   ✅ Signed in as:', authData.user.email);
  console.log('   User ID:', authData.user.id);
  
  const workspaceId = '38d8d2e1-fd55-48b9-bca2-91033ba55bda';
  
  // Test each table
  const tests = [
    {
      name: 'Workspaces',
      query: () => supabase
        .from('workspaces')
        .select('*')
        .eq('id', workspaceId)
        .single()
    },
    {
      name: 'Bank Accounts',
      query: () => supabase
        .from('bank_accounts')
        .select('*')
        .eq('workspace_id', workspaceId)
    },
    {
      name: 'Transactions',
      query: () => supabase
        .from('feed_transactions')
        .select('*')
        .eq('workspace_id', workspaceId)
        .limit(5)
    },
    {
      name: 'Categories',
      query: () => supabase
        .from('categories')
        .select('*')
        .eq('workspace_id', workspaceId)
    },
    {
      name: 'Budgets',
      query: () => supabase
        .from('budgets')
        .select('*')
        .eq('workspace_id', workspaceId)
    },
    {
      name: 'User Profile',
      query: () => supabase
        .from('user_profiles')
        .select('*')
        .eq('auth_user_id', authData.user.id)
        .single()
    },
    {
      name: 'Workspace Members',
      query: () => supabase
        .from('workspace_members')
        .select('*')
        .eq('workspace_id', workspaceId)
    }
  ];
  
  console.log('\n2️⃣ Testing table access...\n');
  
  let allPassed = true;
  const results = [];
  
  for (const test of tests) {
    process.stdout.write(`   Testing ${test.name.padEnd(20)}`);
    
    const { data, error } = await test.query();
    
    if (error) {
      console.log(`❌ ERROR: ${error.message} (${error.code})`);
      results.push({ name: test.name, success: false, error: error.message });
      allPassed = false;
    } else {
      const count = Array.isArray(data) ? data.length : (data ? 1 : 0);
      console.log(`✅ SUCCESS (${count} records)`);
      results.push({ name: test.name, success: true, count });
    }
  }
  
  // Summary
  console.log('\n' + '=' .repeat(60));
  console.log('📊 TEST RESULTS:\n');
  
  const passed = results.filter(r => r.success).length;
  const failed = results.filter(r => !r.success).length;
  
  console.log(`✅ Passed: ${passed}/${results.length}`);
  if (failed > 0) {
    console.log(`❌ Failed: ${failed}/${results.length}`);
    console.log('\nFailed tables:');
    results.filter(r => !r.success).forEach(r => {
      console.log(`  - ${r.name}: ${r.error}`);
    });
  }
  
  if (allPassed) {
    console.log('\n🎉 ALL TESTS PASSED!');
    console.log('✅ The app should now work without any 500 errors');
  } else {
    console.log('\n⚠️ Some tests failed. Apply the fix SQL and try again.');
    console.log('\nTo fix:');
    console.log('1. Run SQL/fix-all-tables-auth-null.sql in Supabase');
    console.log('2. Run this test again to verify');
  }
  
  // Sign out
  await supabase.auth.signOut();
}

testAllTablesAccess();