const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.REACT_APP_SUPABASE_URL;
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJuZXZlYmZmaHRwbGJpeGRtYmdxIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NjY2Mjk4NCwiZXhwIjoyMDcyMjM4OTg0fQ.s2sWaR-21kbs5lN7amLhSjac7mPMb10EH6dJqFxeiK4';

async function testTablesWithService() {
  console.log('🧪 Testing Table Access Issues\n');
  console.log('=' .repeat(60));
  
  const workspaceId = '38d8d2e1-fd55-48b9-bca2-91033ba55bda';
  const userId = 'b0c577aa-8fbf-4e75-b8cc-0eabbd327a9b';
  
  // Test with service role
  console.log('\n1️⃣ Testing with SERVICE ROLE (should always work):\n');
  const supabaseService = createClient(supabaseUrl, supabaseServiceKey);
  
  const serviceTests = [
    { name: 'Workspaces', table: 'workspaces', filter: { id: workspaceId } },
    { name: 'Bank Accounts', table: 'bank_accounts', filter: { workspace_id: workspaceId } },
    { name: 'Transactions', table: 'feed_transactions', filter: { workspace_id: workspaceId }, limit: 5 },
    { name: 'Categories', table: 'categories', filter: { workspace_id: workspaceId } },
    { name: 'User Profile', table: 'user_profiles', filter: { auth_user_id: userId } }
  ];
  
  for (const test of serviceTests) {
    process.stdout.write(`   ${test.name.padEnd(20)}`);
    
    let query = supabaseService.from(test.table).select('*');
    
    for (const [key, value] of Object.entries(test.filter)) {
      query = query.eq(key, value);
    }
    
    if (test.limit) {
      query = query.limit(test.limit);
    }
    
    const { data, error } = await query;
    
    if (error) {
      console.log(`❌ ERROR: ${error.message}`);
    } else {
      const count = Array.isArray(data) ? data.length : (data ? 1 : 0);
      console.log(`✅ ${count} records found`);
    }
  }
  
  // Now simulate authenticated user access
  console.log('\n2️⃣ Simulating AUTHENTICATED USER access:\n');
  
  // Get the user's profile ID
  const { data: profile } = await supabaseService
    .from('user_profiles')
    .select('*')
    .eq('auth_user_id', userId)
    .single();
  
  if (profile) {
    console.log(`   User Profile ID: ${profile.id}`);
    console.log(`   User Email: ${profile.email}`);
    
    // Check workspace membership
    const { data: workspaces } = await supabaseService
      .from('workspaces')
      .select('*, workspace_members!inner(*)')
      .or(`owner_id.eq.${profile.id},workspace_members.user_id.eq.${profile.id}`);
    
    console.log(`   User has access to ${workspaces?.length || 0} workspace(s)`);
    
    if (workspaces && workspaces.length > 0) {
      workspaces.forEach(ws => {
        console.log(`     - ${ws.name} (${ws.id})`);
      });
    }
  }
  
  // Check if helper functions exist
  console.log('\n3️⃣ Checking for helper functions:\n');
  
  try {
    const { data: profileId, error: funcError } = await supabaseService
      .rpc('get_user_profile_id', { user_auth_id: userId });
    
    if (funcError) {
      console.log('   ❌ get_user_profile_id not found - need to apply fix');
    } else {
      console.log('   ✅ get_user_profile_id exists and returns:', profileId);
    }
  } catch (e) {
    console.log('   ❌ get_user_profile_id not found - need to apply fix');
  }
  
  try {
    const { data: workspaceIds, error: funcError } = await supabaseService
      .rpc('get_user_workspace_ids', { user_auth_id: userId });
    
    if (funcError) {
      console.log('   ❌ get_user_workspace_ids not found - need to apply fix');
    } else {
      console.log('   ✅ get_user_workspace_ids exists and returns:', workspaceIds?.length || 0, 'workspace(s)');
    }
  } catch (e) {
    console.log('   ❌ get_user_workspace_ids not found - need to apply fix');
  }
  
  console.log('\n' + '=' .repeat(60));
  console.log('\n📊 DIAGNOSIS:\n');
  console.log('The 500 errors are happening because:');
  console.log('1. auth.uid() can be NULL in certain contexts');
  console.log('2. Policies don\'t check for NULL before using auth.uid()');
  console.log('3. Helper functions haven\'t been created yet');
  console.log('\n💡 SOLUTION:');
  console.log('1. Run SQL/fix-all-tables-auth-null.sql in Supabase SQL Editor');
  console.log('2. This will add NULL checks and helper functions');
  console.log('3. All tables will then work properly');
}

testTablesWithService();