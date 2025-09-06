const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.REACT_APP_SUPABASE_URL;
const supabaseAnonKey = process.env.REACT_APP_SUPABASE_ANON_KEY;

async function testUserAccess() {
  console.log('🧪 Testing User Access to Workspace\n');
  console.log('=' .repeat(60));
  
  // Create client with anon key (as the app would)
  const supabase = createClient(supabaseUrl, supabaseAnonKey);
  
  // Sign in as test user
  console.log('1️⃣ Signing in as test user...');
  const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
    email: 'test123@gmail.com',
    password: 'test123456'
  });
  
  if (authError) {
    console.log('   ❌ Auth error:', authError.message);
    return;
  }
  
  console.log('   ✅ Signed in successfully');
  console.log('   User ID:', authData.user.id);
  
  // Test workspace query as the app does
  console.log('\n2️⃣ Testing workspace query (like the app)...');
  const workspaceId = '38d8d2e1-fd55-48b9-bca2-91033ba55bda';
  
  const { data: workspace, error: wsError } = await supabase
    .from('workspaces')
    .select('*')
    .eq('id', workspaceId)
    .single();
  
  if (wsError) {
    console.log('   ❌ Workspace query error:', wsError.message);
    console.log('   Error code:', wsError.code);
    console.log('   Error details:', wsError.details);
  } else {
    console.log('   ✅ Workspace query successful!');
    console.log('   Workspace name:', workspace.name);
    console.log('   Owner ID:', workspace.owner_id);
  }
  
  // Also test listing all workspaces
  console.log('\n3️⃣ Testing list all user workspaces...');
  const { data: allWorkspaces, error: listError } = await supabase
    .from('workspaces')
    .select('*');
  
  if (listError) {
    console.log('   ❌ List error:', listError.message);
  } else {
    console.log(`   ✅ Can access ${allWorkspaces.length} workspace(s)`);
    allWorkspaces.forEach(ws => {
      console.log(`      - ${ws.name} (${ws.id})`);
    });
  }
  
  // Test other critical tables
  console.log('\n4️⃣ Testing other critical tables...');
  
  // User profile
  const { data: profile, error: profileError } = await supabase
    .from('user_profiles')
    .select('*')
    .eq('auth_user_id', authData.user.id)
    .single();
  
  if (profileError) {
    console.log('   ❌ Profile error:', profileError.message);
  } else {
    console.log('   ✅ Can access user profile');
  }
  
  // Bank accounts
  const { data: accounts, error: accountsError } = await supabase
    .from('bank_accounts')
    .select('*');
  
  if (accountsError) {
    console.log('   ❌ Bank accounts error:', accountsError.message);
  } else {
    console.log(`   ✅ Can access bank_accounts (${accounts.length} found)`);
  }
  
  // Transactions
  const { data: transactions, error: txError } = await supabase
    .from('feed_transactions')
    .select('*')
    .limit(5);
  
  if (txError) {
    console.log('   ❌ Transactions error:', txError.message);
  } else {
    console.log(`   ✅ Can access feed_transactions (${transactions.length} found)`);
  }
  
  console.log('\n' + '=' .repeat(60));
  console.log('📊 TEST SUMMARY:\n');
  
  if (!wsError && !profileError) {
    console.log('✅ All critical queries working!');
    console.log('✅ The app should now function properly.');
  } else {
    console.log('❌ Some issues remain. Check errors above.');
  }
  
  // Sign out
  await supabase.auth.signOut();
}

testUserAccess();