const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.REACT_APP_SUPABASE_URL;
const supabaseAnonKey = process.env.REACT_APP_SUPABASE_ANON_KEY;
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJuZXZlYmZmaHRwbGJpeGRtYmdxIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NjY2Mjk4NCwiZXhwIjoyMDcyMjM4OTg0fQ.s2sWaR-21kbs5lN7amLhSjac7mPMb10EH6dJqFxeiK4';

async function testProductionFix() {
  console.log('🚀 Testing Production Fix for Workspace RLS\n');
  console.log('=' .repeat(60));
  
  const workspaceId = '38d8d2e1-fd55-48b9-bca2-91033ba55bda';
  const userId = 'b0c577aa-8fbf-4e75-b8cc-0eabbd327a9b';
  
  // 1. Test the helper functions directly via service role
  console.log('\n1️⃣ Testing helper functions with service role...');
  const supabaseService = createClient(supabaseUrl, supabaseServiceKey);
  
  // Test get_user_profile_id
  const { data: profileId, error: profileError } = await supabaseService
    .rpc('get_user_profile_id', { user_auth_id: userId });
  
  if (profileError) {
    console.log('   ❌ get_user_profile_id error:', profileError.message);
  } else {
    console.log('   ✅ get_user_profile_id returns:', profileId);
  }
  
  // Test user_has_workspace_access
  const { data: hasAccess, error: accessError } = await supabaseService
    .rpc('user_has_workspace_access', { 
      workspace_id: workspaceId,
      user_auth_id: userId 
    });
  
  if (accessError) {
    console.log('   ❌ user_has_workspace_access error:', accessError.message);
  } else {
    console.log('   ✅ user_has_workspace_access returns:', hasAccess);
  }
  
  // 2. Test workspace query with service role
  console.log('\n2️⃣ Testing workspace query with service role...');
  const { data: serviceData, error: serviceError } = await supabaseService
    .from('workspaces')
    .select('*')
    .eq('id', workspaceId)
    .single();
  
  if (serviceError) {
    console.log('   ❌ Service role error:', serviceError.message);
  } else {
    console.log('   ✅ Service role can access workspace:', serviceData.name);
  }
  
  // 3. Test with authenticated user
  console.log('\n3️⃣ Testing with authenticated user...');
  const supabaseAuth = createClient(supabaseUrl, supabaseAnonKey);
  
  // Sign in
  const { data: authData, error: authError } = await supabaseAuth.auth.signInWithPassword({
    email: 'test123@gmail.com',
    password: 'test123456'
  });
  
  if (authError) {
    console.log('   ❌ Auth error:', authError.message);
    return;
  }
  
  console.log('   ✅ Signed in as:', authData.user.email);
  
  // Test workspace query
  const { data: workspace, error: wsError } = await supabaseAuth
    .from('workspaces')
    .select('*')
    .eq('id', workspaceId)
    .single();
  
  if (wsError) {
    console.log('   ❌ Workspace query error:', wsError.message);
    console.log('      Error code:', wsError.code);
    console.log('      Error details:', wsError.details);
  } else {
    console.log('   ✅ Authenticated user can access workspace:', workspace.name);
  }
  
  // 4. Test listing all workspaces
  console.log('\n4️⃣ Testing list all workspaces for user...');
  const { data: allWorkspaces, error: listError } = await supabaseAuth
    .from('workspaces')
    .select('*');
  
  if (listError) {
    console.log('   ❌ List error:', listError.message);
  } else {
    console.log(`   ✅ User has access to ${allWorkspaces.length} workspace(s)`);
    allWorkspaces.forEach(ws => {
      console.log(`      - ${ws.name}`);
    });
  }
  
  // 5. Test edge cases
  console.log('\n5️⃣ Testing edge cases...');
  
  // Test with non-existent workspace
  const { data: notFound, error: notFoundError } = await supabaseAuth
    .from('workspaces')
    .select('*')
    .eq('id', '00000000-0000-0000-0000-000000000000')
    .single();
  
  if (notFoundError && notFoundError.code === 'PGRST116') {
    console.log('   ✅ Correctly returns no rows for non-existent workspace');
  } else if (notFoundError) {
    console.log('   ❌ Unexpected error for non-existent workspace:', notFoundError.message);
  } else {
    console.log('   ⚠️ Unexpectedly found non-existent workspace');
  }
  
  console.log('\n' + '=' .repeat(60));
  console.log('📊 PRODUCTION FIX TEST RESULTS:\n');
  
  if (!serviceError && !wsError && hasAccess === true) {
    console.log('✅ ALL TESTS PASSED!');
    console.log('✅ Production fix is working correctly');
    console.log('✅ Both service role and authenticated users have proper access');
    console.log('\n🎯 Ready for production deployment');
  } else {
    console.log('❌ Some tests failed - review errors above');
    console.log('\n💡 Troubleshooting steps:');
    console.log('   1. Ensure the production fix SQL was applied');
    console.log('   2. Check that functions were created with SECURITY DEFINER');
    console.log('   3. Verify user_profiles table has correct data');
  }
  
  // Sign out
  await supabaseAuth.auth.signOut();
}

testProductionFix();