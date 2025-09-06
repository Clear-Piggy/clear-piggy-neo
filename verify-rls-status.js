const { Client } = require('pg');

const connectionString = 'postgresql://postgres.rnevebffhtplbixdmbgq:Z6eFLC6NTamJb*Z@aws-1-us-east-1.pooler.supabase.com:5432/postgres';

async function verifyRLSStatus() {
  console.log('🔍 Verifying Current RLS Status\n');
  console.log('=' .repeat(60));

  const client = new Client({ connectionString });
  await client.connect();

  // 1. Check RLS status on all tables
  console.log('\n1️⃣ RLS Status on Critical Tables:\n');
  
  const rlsQuery = `
    SELECT 
      schemaname,
      tablename,
      rowsecurity as rls_enabled,
      (SELECT COUNT(*) FROM pg_policies p 
       WHERE p.schemaname = t.schemaname 
       AND p.tablename = t.tablename) as policy_count
    FROM pg_tables t
    WHERE schemaname = 'public'
    AND tablename IN (
      'workspaces', 'user_profiles', 'workspace_members',
      'bank_accounts', 'feed_transactions', 'categories',
      'budgets', 'budget_categories', 'notifications',
      'plaid_items', 'account_sync_logs', 'transaction_sync_logs',
      'monthly_summaries', 'savings_goals'
    )
    ORDER BY 
      CASE 
        WHEN NOT rowsecurity AND (SELECT COUNT(*) FROM pg_policies p 
                                  WHERE p.schemaname = t.schemaname 
                                  AND p.tablename = t.tablename) > 0 
        THEN 0  -- Security issue: policies but no RLS
        WHEN NOT rowsecurity THEN 1  -- No RLS but also no policies
        ELSE 2  -- RLS enabled
      END,
      tablename;
  `;

  const { rows: tables } = await client.query(rlsQuery);
  
  tables.forEach(table => {
    const status = table.rls_enabled ? '✅' : '❌';
    const warning = !table.rls_enabled && table.policy_count > 0 ? ' ⚠️ POLICIES NOT ACTIVE!' : '';
    console.log(`${status} ${table.tablename.padEnd(25)} RLS: ${table.rls_enabled ? 'ON' : 'OFF'} (${table.policy_count} policies)${warning}`);
  });

  // 2. Check for helper functions
  console.log('\n2️⃣ Helper Functions Status:\n');
  
  const funcQuery = `
    SELECT 
      proname as function_name,
      prosecdef as security_definer
    FROM pg_proc
    WHERE pronamespace = 'public'::regnamespace
    AND proname IN ('get_user_profile_id', 'user_has_workspace_access')
    ORDER BY proname;
  `;

  const { rows: funcs } = await client.query(funcQuery);
  
  if (funcs.length === 0) {
    console.log('❌ No helper functions found - production fix not applied');
  } else {
    funcs.forEach(func => {
      const status = func.security_definer ? '✅' : '⚠️';
      console.log(`${status} ${func.function_name} (SECURITY ${func.security_definer ? 'DEFINER' : 'INVOKER'})`);
    });
  }

  // 3. Check workspace policies specifically
  console.log('\n3️⃣ Current Workspace Policies:\n');
  
  const policyQuery = `
    SELECT 
      polname as policyname,
      CASE polcmd
        WHEN 'r' THEN 'SELECT'
        WHEN 'a' THEN 'INSERT'
        WHEN 'w' THEN 'UPDATE'
        WHEN 'd' THEN 'DELETE'
        WHEN '*' THEN 'ALL'
        ELSE polcmd::text
      END as operation,
      (SELECT array_agg(rolname) FROM pg_roles WHERE oid = ANY(polroles))::text as for_roles,
      polpermissive as permissive
    FROM pg_policy
    WHERE polrelid = 'public.workspaces'::regclass
    ORDER BY polname;
  `;

  const { rows: policies } = await client.query(policyQuery);
  
  if (policies.length === 0) {
    console.log('❌ No policies found on workspaces table');
  } else {
    policies.forEach(policy => {
      const type = policy.permissive === 't' ? 'PERMISSIVE' : 'RESTRICTIVE';
      console.log(`• ${policy.policyname}`);
      console.log(`  Operation: ${policy.operation || 'ALL'}`);
      console.log(`  For: ${policy.for_roles}`);
      console.log(`  Type: ${type}`);
    });
  }

  // 4. Check for common issues
  console.log('\n4️⃣ Checking for Common Issues:\n');
  
  // Check if any policy uses LIMIT 1 in subquery (can cause nulls)
  const limitCheckQuery = `
    SELECT 
      polname as policyname,
      pg_get_expr(polqual, polrelid) as using_expr
    FROM pg_policy
    WHERE polrelid = 'public.workspaces'::regclass
    AND pg_get_expr(polqual, polrelid) LIKE '%LIMIT 1%';
  `;
  
  const { rows: limitPolicies } = await client.query(limitCheckQuery);
  
  if (limitPolicies.length > 0) {
    console.log('⚠️ Found policies using LIMIT 1 in subqueries (can return null):');
    limitPolicies.forEach(p => {
      console.log(`   - ${p.policyname}`);
    });
  } else {
    console.log('✅ No policies using LIMIT 1 in subqueries');
  }

  // Check for recursive policy references
  const recursiveCheckQuery = `
    SELECT COUNT(*) as count
    FROM pg_policy
    WHERE polrelid = 'public.workspaces'::regclass
    AND (pg_get_expr(polqual, polrelid) LIKE '%workspace%workspace%' 
         OR pg_get_expr(polwithcheck, polrelid) LIKE '%workspace%workspace%');
  `;
  
  const { rows: [{ count: recursiveCount }] } = await client.query(recursiveCheckQuery);
  
  if (recursiveCount > 0) {
    console.log(`⚠️ Found ${recursiveCount} potentially recursive policy references`);
  } else {
    console.log('✅ No recursive policy references detected');
  }

  // 5. Summary and recommendations
  console.log('\n' + '=' .repeat(60));
  console.log('📊 SUMMARY & RECOMMENDATIONS:\n');

  const criticalTables = tables.filter(t => !t.rls_enabled && t.policy_count > 0);
  if (criticalTables.length > 0) {
    console.log(`🚨 CRITICAL: ${criticalTables.length} tables have policies but RLS is OFF!`);
    console.log('   This means policies are NOT being enforced!\n');
  }

  if (funcs.length === 0) {
    console.log('📝 RECOMMENDATION: Apply the production fix');
    console.log('   Run: SQL/production-fix-workspace-rls.sql');
    console.log('   This will create helper functions for stable auth handling\n');
  }

  if (limitPolicies.length > 0) {
    console.log('📝 RECOMMENDATION: Replace LIMIT 1 subqueries with IN clauses');
    console.log('   LIMIT 1 can return null and cause 500 errors\n');
  }

  const rlsOffTables = tables.filter(t => !t.rls_enabled);
  if (rlsOffTables.length > 0) {
    console.log(`⚠️ ${rlsOffTables.length} tables have RLS disabled`);
    console.log('   Consider enabling RLS on all tables with sensitive data\n');
  } else {
    console.log('✅ All checked tables have RLS enabled\n');
  }

  await client.end();
}

verifyRLSStatus();