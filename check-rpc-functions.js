const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.REACT_APP_SUPABASE_URL;
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJuZXZlYmZmaHRwbGJpeGRtYmdxIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NjY2Mjk4NCwiZXhwIjoyMDcyMjM4OTg0fQ.s2sWaR-21kbs5lN7amLhSjac7mPMb10EH6dJqFxeiK4';

// Create admin client with service role key
const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function checkRPCFunctions() {
  console.log('🔍 Checking RPC Functions in Database...\n');
  console.log('=' .repeat(60));

  try {
    // Query to check all functions and their security settings
    const { data: functions, error } = await supabase.rpc('get_function_info', {}, {
      get: true
    }).catch(async () => {
      // If that RPC doesn't exist, try a direct query
      const { data, error } = await supabase
        .from('pg_proc')
        .select('*')
        .limit(1)
        .catch(() => null);
      
      // Fall back to raw SQL query
      const result = await supabase.rpc('sql_query', {
        query: `
          SELECT 
            n.nspname as schema_name,
            p.proname as function_name,
            pg_get_functiondef(p.oid) as function_definition,
            CASE p.prosecdef 
              WHEN true THEN 'SECURITY DEFINER'
              ELSE 'SECURITY INVOKER'
            END as security_type,
            p.provolatile as volatility,
            p.proisstrict as is_strict,
            p.proretset as returns_set
          FROM pg_proc p
          JOIN pg_namespace n ON p.pronamespace = n.oid
          WHERE n.nspname = 'public'
            AND p.prokind = 'f'
            AND p.proname IN (
              'setup_user_profile',
              'get_institutions_for_sync',
              'upsert_institution',
              'upsert_bank_account',
              'upsert_feed_transaction'
            )
          ORDER BY p.proname;
        `
      }).catch(() => null);
      
      return result;
    });

    // Alternative approach - use raw SQL through psql
    console.log('\n📋 Attempting to query function definitions via SQL...\n');

    // Create a SQL script to check functions
    const sqlScript = `
-- Check RPC Functions and their Security Settings
SELECT 
  'FUNCTION ANALYSIS' as report_section,
  current_timestamp as run_time;

SELECT '\\n=== RPC FUNCTIONS IN PUBLIC SCHEMA ===' as section;

SELECT 
  proname as function_name,
  CASE prosecdef 
    WHEN true THEN '✅ SECURITY DEFINER'
    ELSE '❌ SECURITY INVOKER'
  END as security_setting,
  pronargs as num_arguments
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public'
  AND p.prokind = 'f'
ORDER BY proname;

SELECT '\\n=== DETAILED VIEW OF KEY FUNCTIONS ===' as section;

-- Check setup_user_profile
SELECT '\\n--- setup_user_profile ---' as function_check;
SELECT pg_get_functiondef(oid) as definition
FROM pg_proc 
WHERE proname = 'setup_user_profile'
LIMIT 1;

-- Check get_institutions_for_sync
SELECT '\\n--- get_institutions_for_sync ---' as function_check;
SELECT pg_get_functiondef(oid) as definition
FROM pg_proc 
WHERE proname = 'get_institutions_for_sync'
LIMIT 1;

-- Check other key functions
SELECT '\\n--- Other Transaction Functions ---' as function_check;
SELECT 
  proname,
  CASE prosecdef 
    WHEN true THEN 'SECURITY DEFINER'
    ELSE 'SECURITY INVOKER'
  END as security_setting
FROM pg_proc
WHERE proname IN (
  'upsert_institution',
  'upsert_bank_account', 
  'upsert_feed_transaction'
);

-- Check if RLS is enabled on tables
SELECT '\\n=== RLS STATUS ON TABLES ===' as section;
SELECT 
  schemaname,
  tablename,
  CASE rowsecurity 
    WHEN true THEN '✅ RLS ENABLED'
    ELSE '❌ RLS DISABLED'
  END as rls_status,
  CASE 
    WHEN rowsecurity = false AND EXISTS (
      SELECT 1 FROM pg_policies 
      WHERE schemaname = t.schemaname 
      AND tablename = t.tablename
    ) THEN '⚠️  HAS POLICIES BUT RLS DISABLED!'
    ELSE 'OK'
  END as warning
FROM pg_tables t
WHERE schemaname = 'public'
  AND tablename IN (
    'workspaces',
    'user_profiles',
    'institutions',
    'bank_accounts',
    'feed_transactions',
    'workspace_members'
  )
ORDER BY tablename;

-- Count policies per table
SELECT '\\n=== POLICY COUNT PER TABLE ===' as section;
SELECT 
  tablename,
  COUNT(*) as policy_count
FROM pg_policies
WHERE schemaname = 'public'
GROUP BY tablename
ORDER BY tablename;
`;

    // Write SQL script
    const fs = require('fs');
    fs.writeFileSync('/Users/officemac/Projects/clear-piggy-neo/check-rpc-security.sql', sqlScript);
    console.log('✅ Created SQL script: check-rpc-security.sql');
    console.log('\nTo run this script, execute:');
    console.log('psql $DATABASE_URL < check-rpc-security.sql\n');

    // Try to get some basic info via Supabase
    console.log('📊 Attempting basic checks via Supabase client...\n');

    // Check if we can call the functions
    const functionsToTest = [
      'setup_user_profile',
      'get_institutions_for_sync'
    ];

    for (const funcName of functionsToTest) {
      try {
        console.log(`Testing ${funcName}...`);
        
        if (funcName === 'get_institutions_for_sync') {
          // This needs a parameter
          const { data, error } = await supabase.rpc(funcName, {
            p_workspace_id: '00000000-0000-0000-0000-000000000000'
          });
          
          if (error) {
            console.log(`  ❌ Error: ${error.message}`);
          } else {
            console.log(`  ✅ Function exists and is callable`);
          }
        } else {
          // Try calling without params
          const { data, error } = await supabase.rpc(funcName);
          
          if (error && error.message.includes('already exists')) {
            console.log(`  ✅ Function exists (got expected error)`);
          } else if (error) {
            console.log(`  ⚠️  Error: ${error.message}`);
          } else {
            console.log(`  ✅ Function exists and executed`);
          }
        }
      } catch (e) {
        console.log(`  ❌ Failed to test: ${e.message}`);
      }
    }

    console.log('\n' + '=' .repeat(60));
    console.log('\n📝 SUMMARY:\n');
    console.log('1. RPC functions need to be checked for SECURITY DEFINER setting');
    console.log('2. If functions use SECURITY INVOKER, they will fail when RLS is enabled');
    console.log('3. Run the SQL script to get detailed function definitions');
    console.log('4. Edge functions using service_role key will work regardless\n');
    
    console.log('🔧 NEXT STEPS:');
    console.log('1. Run: psql $DATABASE_URL < check-rpc-security.sql');
    console.log('2. Review function security settings');
    console.log('3. Update functions to SECURITY DEFINER if needed');
    console.log('4. Then safely enable RLS on all tables\n');

  } catch (error) {
    console.error('❌ Error checking functions:', error);
  }
}

// Run the check
checkRPCFunctions();