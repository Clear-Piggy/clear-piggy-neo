const { createClient } = require('@supabase/supabase-js');
const { Client } = require('pg');

const supabaseUrl = 'https://rnevebffhtplbixdmbgq.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJuZXZlYmZmaHRwbGJpeGRtYmdxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTY2NjI5ODQsImV4cCI6MjA3MjIzODk4NH0.VNnnzLLo2Pi5IxAy2-ZPVAbnbrIQLe9xi7tKcPnWOLw';

// Database connection
const connectionString = 'postgresql://postgres.rnevebffhtplbixdmbgq:Z6eFLC6NTamJb*Z@aws-1-us-east-1.pooler.supabase.com:5432/postgres';

async function debugWorkspaceError() {
  console.log('🔍 Debugging Workspace 500 Error\n');
  console.log('=' .repeat(60));

  const client = new Client({ connectionString });
  await client.connect();

  // First, let's see exactly what error is happening
  console.log('1️⃣ Checking PostgreSQL logs for errors...\n');
  
  // Check if there's an infinite recursion in the policies
  const policyCheckQuery = `
    -- Get the actual policy definitions
    SELECT 
      polname as policyname,
      polcmd as command,
      pg_get_expr(polqual, polrelid) as using_expression,
      pg_get_expr(polwithcheck, polrelid) as with_check_expression,
      polpermissive as is_permissive
    FROM pg_policy
    WHERE polrelid = 'public.workspaces'::regclass
    ORDER BY polname;
  `;

  const { rows: policies } = await client.query(policyCheckQuery);
  
  console.log('Current Workspace Policies:\n');
  policies.forEach((policy, i) => {
    console.log(`${i + 1}. ${policy.policyname}`);
    console.log(`   Command: ${policy.command || 'ALL'}`);
    console.log(`   Permissive: ${policy.is_permissive ? 'YES' : 'NO'}`);
    console.log(`   USING: ${policy.using_expression || 'true'}`);
    if (policy.with_check_expression) {
      console.log(`   WITH CHECK: ${policy.with_check_expression}`);
    }
    console.log('');
  });

  // Check if the subqueries in policies might be causing issues
  console.log('2️⃣ Testing policy subqueries directly...\n');
  
  const testUserId = 'b0c577aa-8fbf-4e75-b8cc-0eabbd327a9b';
  
  // Test the user_profiles lookup
  const profileTest = `
    SELECT 
      COUNT(*) as profile_count,
      array_agg(id) as profile_ids
    FROM public.user_profiles 
    WHERE auth_user_id = $1;
  `;
  
  const { rows: profileResult } = await client.query(profileTest, [testUserId]);
  console.log('User Profile Test:');
  console.log(`   Profile count: ${profileResult[0].profile_count}`);
  console.log(`   Profile IDs: ${profileResult[0].profile_ids}`);
  console.log('');

  // Test workspace membership query
  const membershipTest = `
    SELECT 
      COUNT(*) as workspace_count,
      array_agg(workspace_id) as workspace_ids
    FROM public.workspace_members 
    WHERE user_id IN (
      SELECT id FROM public.user_profiles WHERE auth_user_id = $1
    );
  `;
  
  const { rows: memberResult } = await client.query(membershipTest, [testUserId]);
  console.log('Workspace Membership Test:');
  console.log(`   Workspace count: ${memberResult[0].workspace_count}`);
  console.log(`   Workspace IDs: ${memberResult[0].workspace_ids}`);
  console.log('');

  // Try to simulate what the policy would do
  console.log('3️⃣ Simulating RLS policy check...\n');
  
  const simulatePolicy = `
    WITH user_profile AS (
      SELECT id FROM public.user_profiles WHERE auth_user_id = $1 LIMIT 1
    )
    SELECT 
      w.id,
      w.name,
      w.owner_id,
      up.id as user_profile_id,
      w.owner_id = up.id as is_owner,
      EXISTS (
        SELECT 1 FROM workspace_members wm 
        WHERE wm.workspace_id = w.id 
        AND wm.user_id = up.id
      ) as is_member
    FROM public.workspaces w
    CROSS JOIN user_profile up
    WHERE w.id = $2;
  `;
  
  try {
    const { rows: simResult } = await client.query(simulatePolicy, [
      testUserId,
      '38d8d2e1-fd55-48b9-bca2-91033ba55bda'
    ]);
    
    if (simResult.length > 0) {
      console.log('Policy Simulation Result:');
      console.log(`   Workspace: ${simResult[0].name}`);
      console.log(`   Is Owner: ${simResult[0].is_owner}`);
      console.log(`   Is Member: ${simResult[0].is_member}`);
      console.log(`   Should have access: ${simResult[0].is_owner || simResult[0].is_member}`);
    } else {
      console.log('   No results from simulation');
    }
  } catch (e) {
    console.log('   Simulation error:', e.message);
  }

  // Let's try a direct query with the actual JWT auth context
  console.log('\n4️⃣ Testing with anon key through Supabase client...\n');
  
  const supabase = createClient(supabaseUrl, supabaseAnonKey);
  
  // Create a custom JWT that mimics what the app sends
  const customHeaders = {
    Authorization: `Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJodHRwczovL3JuZXZlYmZmaHRwbGJpeGRtYmdxLnN1cGFiYXNlLmNvL2F1dGgvdjEiLCJzdWIiOiJiMGM1NzdhYS04ZmJmLTRlNzUtYjhjYy0wZWFiYmQzMjdhOWIiLCJhdWQiOiJhdXRoZW50aWNhdGVkIiwiZXhwIjoxNzU2OTk4MzI2LCJpYXQiOjE3NTY5OTQ3MjYsImVtYWlsIjoidGVzdDEyM0BnbWFpbC5jb20iLCJwaG9uZSI6IiIsImFwcF9tZXRhZGF0YSI6eyJwcm92aWRlciI6ImVtYWlsIiwicHJvdmlkZXJzIjpbImVtYWlsIl19LCJ1c2VyX21ldGFkYXRhIjp7fSwicm9sZSI6ImF1dGhlbnRpY2F0ZWQiLCJhYWwiOiJhYWwxIiwiYW1yIjpbeyJtZXRob2QiOiJwYXNzd29yZCIsInRpbWVzdGFtcCI6MTc1Njk5NDcyNn1dLCJzZXNzaW9uX2lkIjoiYzFkNjBlMTgtYWFiNS00OGQ5LTljNjUtY2M1OWZkOGJlNzg0In0.lVARSzBHb2PHNJCPQXBxA6vD5nGRQJa30vF5r1CuoFI`
  };
  
  // Try a simple fetch with error details
  const response = await fetch(`${supabaseUrl}/rest/v1/workspaces?select=*&id=eq.38d8d2e1-fd55-48b9-bca2-91033ba55bda`, {
    headers: {
      'apikey': supabaseAnonKey,
      'Authorization': customHeaders.Authorization,
      'Accept': 'application/json',
      'Content-Type': 'application/json'
    }
  });
  
  console.log('Direct API Response:');
  console.log(`   Status: ${response.status} ${response.statusText}`);
  
  if (response.status !== 200) {
    const errorText = await response.text();
    console.log(`   Error body: ${errorText}`);
  } else {
    const data = await response.json();
    console.log(`   Success! Got data:`, data);
  }

  await client.end();
  
  console.log('\n' + '=' .repeat(60));
  console.log('📊 DIAGNOSIS:\n');
  console.log('The 500 error is likely caused by:');
  console.log('1. Policy using auth.uid() but auth context not properly set');
  console.log('2. OR subquery in policy causing performance issues');
  console.log('3. OR LIMIT 1 in subquery returning null unexpectedly');
}

debugWorkspaceError();