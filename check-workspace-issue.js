const { createClient } = require('@supabase/supabase-js');
const { Client } = require('pg');

// Supabase connection
const supabaseUrl = 'https://rnevebffhtplbixdmbgq.supabase.co';
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJuZXZlYmZmaHRwbGJpeGRtYmdxIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NjY2Mjk4NCwiZXhwIjoyMDcyMjM4OTg0fQ.s2sWaR-21kbs5lN7amLhSjac7mPMb10EH6dJqFxeiK4';

// Direct DB connection
const connectionString = 'postgresql://postgres.rnevebffhtplbixdmbgq:Z6eFLC6NTamJb*Z@aws-1-us-east-1.pooler.supabase.com:5432/postgres';

async function diagnoseWorkspaceIssue() {
  console.log('🔍 Diagnosing Workspace 500 Error\n');
  console.log('=' .repeat(60));

  const workspaceId = '38d8d2e1-fd55-48b9-bca2-91033ba55bda';
  const userId = 'b0c577aa-8fbf-4e75-b8cc-0eabbd327a9b';
  
  // First, let's check with service role (bypass RLS)
  const supabase = createClient(supabaseUrl, supabaseServiceKey);
  
  console.log('1️⃣ Testing with service role (bypasses RLS)...');
  const { data: serviceData, error: serviceError } = await supabase
    .from('workspaces')
    .select('*')
    .eq('id', workspaceId);
    
  if (serviceError) {
    console.log('   ❌ Error even with service role:', serviceError.message);
  } else {
    console.log('   ✅ Service role can access workspace');
    console.log('   Workspace exists:', serviceData?.length > 0);
    if (serviceData?.length > 0) {
      console.log('   Owner ID:', serviceData[0].owner_id);
    }
  }

  // Now check direct DB to understand the relationships
  const client = new Client({ connectionString });
  await client.connect();
  
  console.log('\n2️⃣ Checking database relationships...\n');
  
  // Check if user profile exists
  const userProfileQuery = `
    SELECT id, auth_user_id, email 
    FROM user_profiles 
    WHERE auth_user_id = $1;
  `;
  
  const { rows: profiles } = await client.query(userProfileQuery, [userId]);
  console.log('User Profile:');
  if (profiles.length > 0) {
    console.log('   ✅ Profile exists');
    console.log('   Profile ID:', profiles[0].id);
    console.log('   Email:', profiles[0].email);
  } else {
    console.log('   ❌ No profile found for auth user');
  }
  
  // Check workspace details
  const workspaceQuery = `
    SELECT 
      w.id,
      w.name,
      w.owner_id,
      up.auth_user_id as owner_auth_id,
      up.email as owner_email
    FROM workspaces w
    LEFT JOIN user_profiles up ON w.owner_id = up.id
    WHERE w.id = $1;
  `;
  
  const { rows: workspaces } = await client.query(workspaceQuery, [workspaceId]);
  console.log('\nWorkspace Details:');
  if (workspaces.length > 0) {
    const ws = workspaces[0];
    console.log('   ✅ Workspace exists');
    console.log('   Name:', ws.name);
    console.log('   Owner Profile ID:', ws.owner_id);
    console.log('   Owner Auth ID:', ws.owner_auth_id);
    console.log('   Owner Email:', ws.owner_email);
    console.log('   Is Current User Owner?', ws.owner_auth_id === userId);
  } else {
    console.log('   ❌ Workspace not found');
  }
  
  // Check workspace membership
  const membershipQuery = `
    SELECT 
      wm.workspace_id,
      wm.user_id,
      wm.role,
      up.auth_user_id,
      up.email
    FROM workspace_members wm
    JOIN user_profiles up ON wm.user_id = up.id
    WHERE wm.workspace_id = $1 AND up.auth_user_id = $2;
  `;
  
  const { rows: memberships } = await client.query(membershipQuery, [workspaceId, userId]);
  console.log('\nWorkspace Membership:');
  if (memberships.length > 0) {
    console.log('   ✅ User is a member');
    console.log('   Role:', memberships[0].role);
  } else {
    console.log('   ❌ User is NOT a member of this workspace');
  }
  
  // Test the actual RLS policy
  console.log('\n3️⃣ Testing RLS Policy Logic...\n');
  
  const policyTestQuery = `
    SELECT 
      '${workspaceId}'::uuid as workspace_id,
      '${userId}'::uuid as auth_user_id,
      EXISTS (
        SELECT 1 FROM user_profiles 
        WHERE auth_user_id = '${userId}'::uuid
      ) as user_profile_exists,
      EXISTS (
        SELECT 1 FROM workspaces 
        WHERE id = '${workspaceId}'::uuid
        AND owner_id IN (
          SELECT id FROM user_profiles 
          WHERE auth_user_id = '${userId}'::uuid
        )
      ) as is_owner,
      EXISTS (
        SELECT 1 FROM workspace_members wm
        WHERE wm.workspace_id = '${workspaceId}'::uuid
        AND wm.user_id IN (
          SELECT id FROM user_profiles 
          WHERE auth_user_id = '${userId}'::uuid
        )
      ) as is_member;
  `;
  
  const { rows: policyTest } = await client.query(policyTestQuery);
  console.log('Policy Test Results:');
  console.log('   User profile exists:', policyTest[0].user_profile_exists);
  console.log('   Is owner:', policyTest[0].is_owner);
  console.log('   Is member:', policyTest[0].is_member);
  console.log('   Should have access:', policyTest[0].is_owner || policyTest[0].is_member);
  
  await client.end();
  
  console.log('\n' + '=' .repeat(60));
  console.log('📊 DIAGNOSIS SUMMARY:\n');
  
  if (!profiles.length) {
    console.log('❌ PROBLEM: User has no profile in user_profiles table!');
    console.log('   This prevents all RLS policies from working.');
    console.log('   SOLUTION: Need to create user profile.');
  } else if (!policyTest[0].is_owner && !policyTest[0].is_member) {
    console.log('❌ PROBLEM: User is neither owner nor member of workspace!');
    console.log('   SOLUTION: Need to add user as member or fix ownership.');
  } else {
    console.log('🤔 Issue might be with the policy syntax itself.');
    console.log('   Let\'s create a simpler policy.');
  }
}

diagnoseWorkspaceIssue();