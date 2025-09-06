const { Client } = require('pg');

const connectionString = 'postgresql://postgres.rnevebffhtplbixdmbgq:Z6eFLC6NTamJb*Z@aws-1-us-east-1.pooler.supabase.com:5432/postgres';

async function checkCurrentPolicies() {
  console.log('🔍 Checking Current RLS and Policy Status\n');
  console.log('=' .repeat(60));

  const client = new Client({ connectionString });
  await client.connect();

  // Check all tables with RLS status and policies
  const query = `
    WITH all_policies AS (
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
        pol.polpermissive as is_permissive,
        (SELECT array_agg(r.rolname) FROM pg_roles r WHERE r.oid = ANY(pol.polroles))::text as roles
      FROM pg_policy pol
      JOIN pg_class c ON c.oid = pol.polrelid
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public'
    ),
    all_tables AS (
      SELECT 
        tablename,
        rowsecurity as rls_enabled
      FROM pg_tables
      WHERE schemaname = 'public'
      AND tablename IN (
        'workspaces', 'user_profiles', 'workspace_members',
        'bank_accounts', 'feed_transactions', 'categories', 'budgets',
        'audit_events', 'budget_lines', 'chart_of_accounts', 'classes',
        'document_attachments', 'documents', 'forecasts', 'institutions',
        'journal_batches', 'ledger_entries', 'locations', 'merchant_aliases',
        'notes', 'plaid_enrichment_data', 'projects', 'rule_applications',
        'tasks', 'transaction_links', 'webhook_events'
      )
    )
    SELECT 
      t.tablename,
      t.rls_enabled,
      COUNT(p.policy_name) as policy_count,
      STRING_AGG(DISTINCT p.policy_name, ', ') as policy_names
    FROM all_tables t
    LEFT JOIN all_policies p ON p.table_name = t.tablename
    GROUP BY t.tablename, t.rls_enabled
    ORDER BY 
      CASE WHEN t.rls_enabled AND COUNT(p.policy_name) > 0 THEN 0  -- RLS on with policies
           WHEN NOT t.rls_enabled AND COUNT(p.policy_name) > 0 THEN 1  -- RLS off but has policies (BAD)
           WHEN t.rls_enabled AND COUNT(p.policy_name) = 0 THEN 2  -- RLS on but no policies (blocks all)
           ELSE 3  -- RLS off and no policies
      END,
      t.tablename;
  `;

  const { rows: tables } = await client.query(query);
  
  console.log('📊 Table Security Status:\n');
  console.log('Table Name'.padEnd(25) + 'RLS'.padEnd(8) + 'Policies'.padEnd(10) + 'Policy Names');
  console.log('-'.repeat(80));
  
  tables.forEach(table => {
    const rlsStatus = table.rls_enabled ? '✅ ON' : '❌ OFF';
    const policyStatus = table.policy_count > 0 ? `${table.policy_count}` : '0';
    const warning = !table.rls_enabled && table.policy_count > 0 ? ' ⚠️ POLICIES NOT ACTIVE!' : '';
    const blocked = table.rls_enabled && table.policy_count === 0 ? ' 🔒 BLOCKING ALL ACCESS!' : '';
    
    console.log(
      table.tablename.padEnd(25) + 
      rlsStatus.padEnd(8) + 
      policyStatus.padEnd(10) + 
      (table.policy_names || '-') + 
      warning + 
      blocked
    );
  });

  // Now check for duplicate policy names across tables
  console.log('\n\n🔍 Checking for Duplicate Policy Names:\n');
  
  const dupQuery = `
    SELECT 
      pol.polname as policy_name,
      array_agg(DISTINCT c.relname) as tables,
      COUNT(DISTINCT c.relname) as table_count
    FROM pg_policy pol
    JOIN pg_class c ON c.oid = pol.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
    GROUP BY pol.polname
    HAVING COUNT(DISTINCT c.relname) > 1
    ORDER BY table_count DESC, pol.polname;
  `;

  const { rows: duplicates } = await client.query(dupQuery);
  
  if (duplicates.length > 0) {
    console.log('⚠️ Found duplicate policy names across tables:');
    duplicates.forEach(dup => {
      console.log(`   "${dup.policy_name}" used in: ${dup.tables.join(', ')}`);
    });
    console.log('\n   This is why "service_role_bypass" error occurred!');
  } else {
    console.log('✅ No duplicate policy names found');
  }

  await client.end();
  
  console.log('\n' + '=' .repeat(60));
  console.log('\n💡 RECOMMENDATIONS:');
  console.log('1. Each table needs unique policy names');
  console.log('2. Use format: "tablename_operation" (e.g., "bank_accounts_select")');
  console.log('3. All tables with workspace_id need similar access patterns');
}

checkCurrentPolicies();