const { Client } = require('pg');

const connectionString = 'postgresql://postgres.rnevebffhtplbixdmbgq:Z6eFLC6NTamJb*Z@aws-1-us-east-1.pooler.supabase.com:5432/postgres';

async function checkAllPolicies() {
  console.log('🔍 Checking ALL Table Policies\n');
  console.log('=' .repeat(60));

  const client = new Client({ connectionString });
  await client.connect();

  // Get all tables with RLS and their policies
  const query = `
    WITH policy_details AS (
      SELECT 
        n.nspname as schema_name,
        c.relname as table_name,
        pol.polname as policy_name,
        CASE pol.polcmd
          WHEN 'r' THEN 'SELECT'
          WHEN 'a' THEN 'INSERT'
          WHEN 'w' THEN 'UPDATE'
          WHEN 'd' THEN 'DELETE'
          WHEN '*' THEN 'ALL'
        END as operation,
        pol.polpermissive as is_permissive,
        pg_get_expr(pol.polqual, pol.polrelid) as using_expr,
        pg_get_expr(pol.polwithcheck, pol.polrelid) as with_check_expr,
        (SELECT array_agg(r.rolname) 
         FROM pg_roles r 
         WHERE r.oid = ANY(pol.polroles))::text as roles
      FROM pg_policy pol
      JOIN pg_class c ON c.oid = pol.polrelid
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public'
    )
    SELECT 
      table_name,
      COUNT(*) as policy_count,
      SUM(CASE WHEN is_permissive THEN 1 ELSE 0 END) as permissive_count,
      SUM(CASE WHEN NOT is_permissive THEN 1 ELSE 0 END) as restrictive_count,
      array_agg(DISTINCT operation) as operations,
      bool_and(is_permissive) as all_permissive
    FROM policy_details
    WHERE table_name IN ('bank_accounts', 'feed_transactions', 'categories', 
                        'budgets', 'user_profiles', 'workspace_members')
    GROUP BY table_name
    ORDER BY 
      CASE WHEN NOT bool_and(is_permissive) THEN 0 ELSE 1 END,
      table_name;
  `;

  const { rows: tables } = await client.query(query);
  
  console.log('\n📊 Policy Summary by Table:\n');
  tables.forEach(table => {
    const status = table.all_permissive ? '✅' : '⚠️';
    const issue = !table.all_permissive ? ' (Has RESTRICTIVE policies!)' : '';
    console.log(`${status} ${table.table_name.padEnd(20)} - ${table.policy_count} policies (${table.permissive_count} permissive, ${table.restrictive_count} restrictive)${issue}`);
    console.log(`   Operations: ${table.operations.join(', ')}`);
  });

  // Now check specific problematic policies
  console.log('\n\n🔴 Tables with RESTRICTIVE Policies (likely causing 500 errors):\n');
  
  const restrictiveQuery = `
    SELECT 
      c.relname as table_name,
      pol.polname as policy_name,
      CASE pol.polcmd
        WHEN 'r' THEN 'SELECT'
        WHEN 'a' THEN 'INSERT' 
        WHEN 'w' THEN 'UPDATE'
        WHEN 'd' THEN 'DELETE'
        WHEN '*' THEN 'ALL'
      END as operation,
      pg_get_expr(pol.polqual, pol.polrelid) as using_expr
    FROM pg_policy pol
    JOIN pg_class c ON c.oid = pol.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
    AND NOT pol.polpermissive
    AND c.relname IN ('bank_accounts', 'feed_transactions', 'categories', 
                      'budgets', 'user_profiles', 'workspace_members')
    ORDER BY c.relname, pol.polname;
  `;

  const { rows: restrictive } = await client.query(restrictiveQuery);
  
  if (restrictive.length > 0) {
    restrictive.forEach(policy => {
      console.log(`❌ ${policy.table_name}.${policy.policy_name} (${policy.operation})`);
      console.log(`   Using: ${policy.using_expr.substring(0, 100)}...`);
    });
  } else {
    console.log('✅ No restrictive policies found');
  }

  // Check for auth.uid() usage patterns
  console.log('\n\n🔍 Checking for problematic auth.uid() patterns:\n');
  
  const authPatternQuery = `
    SELECT 
      c.relname as table_name,
      pol.polname as policy_name,
      CASE 
        WHEN pg_get_expr(pol.polqual, pol.polrelid) LIKE '%LIMIT 1%' THEN 'Uses LIMIT 1'
        WHEN pg_get_expr(pol.polqual, pol.polrelid) NOT LIKE '%IS NOT NULL%' 
         AND pg_get_expr(pol.polqual, pol.polrelid) LIKE '%auth.uid()%' THEN 'No NULL check'
        ELSE 'OK'
      END as issue
    FROM pg_policy pol
    JOIN pg_class c ON c.oid = pol.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
    AND c.relname IN ('bank_accounts', 'feed_transactions', 'categories', 
                      'budgets', 'user_profiles', 'workspace_members')
    AND (
      pg_get_expr(pol.polqual, pol.polrelid) LIKE '%LIMIT 1%'
      OR (pg_get_expr(pol.polqual, pol.polrelid) NOT LIKE '%IS NOT NULL%' 
          AND pg_get_expr(pol.polqual, pol.polrelid) LIKE '%auth.uid()%')
    );
  `;

  const { rows: authIssues } = await client.query(authPatternQuery);
  
  if (authIssues.length > 0) {
    authIssues.forEach(issue => {
      console.log(`⚠️ ${issue.table_name}.${issue.policy_name}: ${issue.issue}`);
    });
  } else {
    console.log('✅ No problematic auth.uid() patterns found');
  }

  await client.end();
  
  console.log('\n' + '=' .repeat(60));
  console.log('\n💡 DIAGNOSIS:');
  console.log('The 500 errors are likely caused by RESTRICTIVE policies on these tables.');
  console.log('Just like workspaces, these need to be changed to PERMISSIVE policies.');
}

checkAllPolicies();