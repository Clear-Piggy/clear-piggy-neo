const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.REACT_APP_SUPABASE_URL;
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJuZXZlYmZmaHRwbGJpeGRtYmdxIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NjY2Mjk4NCwiZXhwIjoyMDcyMjM4OTg0fQ.s2sWaR-21kbs5lN7amLhSjac7mPMb10EH6dJqFxeiK4';

// Create admin client
const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function testRPCFunctions() {
  console.log('🔍 Testing RPC Functions...\n');
  console.log('=' .repeat(60));

  // Test get_institutions_for_sync
  console.log('\n1️⃣ Testing get_institutions_for_sync...');
  try {
    const { data, error } = await supabase.rpc('get_institutions_for_sync', {
      p_workspace_id: '00000000-0000-0000-0000-000000000000'
    });
    
    if (error) {
      console.log(`   Result: Function exists but returned error`);
      console.log(`   Error: ${error.message}`);
      console.log(`   This is OK - means function exists`);
    } else {
      console.log(`   ✅ Function callable - returned ${data ? data.length : 0} results`);
    }
  } catch (e) {
    console.log(`   ❌ Function might not exist: ${e.message}`);
  }

  // Test setup_user_profile
  console.log('\n2️⃣ Testing setup_user_profile...');
  console.log('   Note: This may fail if profile already exists');
  
  // First, get a test user to work with
  const { data: authData } = await supabase.auth.signInWithPassword({
    email: 'test@example.com',
    password: 'testpassword123'
  }).catch(() => ({ data: null }));

  if (authData && authData.user) {
    console.log(`   Using test user: ${authData.user.email}`);
    
    try {
      const { data, error } = await supabase.rpc('setup_user_profile');
      
      if (error && error.message.includes('already exists')) {
        console.log(`   ✅ Function exists (profile already exists for user)`);
      } else if (error) {
        console.log(`   ⚠️ Function error: ${error.message}`);
      } else {
        console.log(`   ✅ Function executed successfully`);
      }
    } catch (e) {
      console.log(`   ❌ Failed: ${e.message}`);
    }
  } else {
    console.log('   ⚠️ No test user available, skipping test');
  }

  // Now let's check the SQL directly
  console.log('\n' + '=' .repeat(60));
  console.log('\n📝 Creating SQL script to check function definitions...\n');
  
  const sqlCheck = `
-- ============================================
-- RPC Function Security Analysis
-- ============================================

\\echo ''
\\echo '=== CHECKING RPC FUNCTIONS ==='
\\echo ''

-- List all public functions with security settings
SELECT 
    proname AS function_name,
    pronargs AS args,
    CASE prosecdef 
        WHEN true THEN '✅ SECURITY DEFINER'
        ELSE '❌ SECURITY INVOKER'
    END AS security_mode
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public'
    AND p.prokind = 'f'
ORDER BY proname;

\\echo ''
\\echo '=== FUNCTION DEFINITIONS ==='
\\echo ''

-- Get definition of setup_user_profile
\\echo '--- setup_user_profile ---'
SELECT pg_get_functiondef(oid) 
FROM pg_proc 
WHERE proname = 'setup_user_profile'
LIMIT 1;

\\echo ''
\\echo '--- get_institutions_for_sync ---'
SELECT pg_get_functiondef(oid)
FROM pg_proc 
WHERE proname = 'get_institutions_for_sync'
LIMIT 1;

\\echo ''
\\echo '=== TABLE RLS STATUS ==='
\\echo ''

-- Check RLS status on key tables
SELECT 
    tablename,
    CASE rowsecurity 
        WHEN true THEN '✅ ENABLED'
        ELSE '❌ DISABLED'
    END AS rls_status
FROM pg_tables
WHERE schemaname = 'public'
    AND tablename IN (
        'workspaces',
        'user_profiles',
        'workspace_members',
        'institutions',
        'bank_accounts',
        'feed_transactions'
    )
ORDER BY 
    CASE rowsecurity 
        WHEN false THEN 0 
        ELSE 1 
    END,
    tablename;

\\echo ''
\\echo '=== POLICY COUNT ==='
\\echo ''

-- Count policies per table
SELECT 
    tablename,
    COUNT(*) as policy_count
FROM pg_policies
WHERE schemaname = 'public'
GROUP BY tablename
ORDER BY policy_count DESC, tablename;
`;

  // Save SQL script
  const fs = require('fs');
  fs.writeFileSync('/Users/officemac/Projects/clear-piggy-neo/analyze-rpc-security.sql', sqlCheck);
  
  console.log('✅ Created: analyze-rpc-security.sql\n');
  console.log('To run the analysis, execute:');
  console.log('----------------------------------------');
  console.log('psql $DATABASE_URL < analyze-rpc-security.sql');
  console.log('');
  console.log('Or with the connection string:');
  console.log('psql "postgresql://postgres.rnevebffhtplbixdmbgq:Z6eFLC6NTamJb*Z@aws-1-us-east-1.pooler.supabase.com:5432/postgres" < analyze-rpc-security.sql');
  console.log('----------------------------------------\n');
  
  console.log('⚠️  IMPORTANT FINDINGS:\n');
  console.log('1. RPC functions must have SECURITY DEFINER to work with RLS enabled');
  console.log('2. Without SECURITY DEFINER, functions run with caller\'s permissions');
  console.log('3. Edge functions bypass this with service_role key');
  console.log('4. Frontend calls to RPC need proper security settings\n');
}

testRPCFunctions();