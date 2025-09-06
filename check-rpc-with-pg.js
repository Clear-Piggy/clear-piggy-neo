const { Client } = require('pg');

// Database connection
const connectionString = 'postgresql://postgres.rnevebffhtplbixdmbgq:Z6eFLC6NTamJb*Z@aws-1-us-east-1.pooler.supabase.com:5432/postgres';

async function checkRPCSecuritySettings() {
  const client = new Client({ connectionString });
  
  try {
    await client.connect();
    console.log('✅ Connected to database\n');
    console.log('=' .repeat(70));
    console.log('RPC FUNCTION SECURITY ANALYSIS');
    console.log('=' .repeat(70));

    // 1. Check all public functions and their security mode
    console.log('\n📋 PUBLIC FUNCTIONS WITH SECURITY SETTINGS:\n');
    const functionsQuery = `
      SELECT 
        proname AS function_name,
        pronargs AS num_args,
        CASE prosecdef 
          WHEN true THEN '✅ SECURITY DEFINER'
          ELSE '❌ SECURITY INVOKER'
        END AS security_mode
      FROM pg_proc p
      JOIN pg_namespace n ON p.pronamespace = n.oid
      WHERE n.nspname = 'public'
        AND p.prokind = 'f'
      ORDER BY proname;
    `;
    
    const { rows: functions } = await client.query(functionsQuery);
    
    console.log('Function Name                    | Args | Security Mode');
    console.log('-'.repeat(70));
    functions.forEach(func => {
      console.log(`${func.function_name.padEnd(32)} | ${func.num_args.toString().padEnd(4)} | ${func.security_mode}`);
    });

    // 2. Get specific function definitions
    console.log('\n' + '=' .repeat(70));
    console.log('KEY FUNCTION DEFINITIONS:');
    console.log('=' .repeat(70));
    
    const keyFunctions = ['setup_user_profile', 'get_institutions_for_sync'];
    
    for (const funcName of keyFunctions) {
      console.log(`\n📌 ${funcName}:`);
      console.log('-'.repeat(50));
      
      const defQuery = `
        SELECT pg_get_functiondef(oid) as definition
        FROM pg_proc 
        WHERE proname = $1
        LIMIT 1;
      `;
      
      try {
        const { rows } = await client.query(defQuery, [funcName]);
        if (rows.length > 0) {
          const def = rows[0].definition;
          // Extract just the signature and security clause
          const lines = def.split('\n');
          const relevantLines = lines.filter(line => 
            line.includes('CREATE') || 
            line.includes('FUNCTION') || 
            line.includes('SECURITY') ||
            line.includes('RETURNS') ||
            line.includes('LANGUAGE')
          ).slice(0, 5);
          console.log(relevantLines.join('\n'));
        } else {
          console.log('Function not found');
        }
      } catch (e) {
        console.log(`Error getting definition: ${e.message}`);
      }
    }

    // 3. Check RLS status on tables
    console.log('\n' + '=' .repeat(70));
    console.log('TABLE RLS STATUS:');
    console.log('=' .repeat(70) + '\n');
    
    const rlsQuery = `
      SELECT 
        tablename,
        CASE rowsecurity 
          WHEN true THEN '✅ ENABLED'
          ELSE '❌ DISABLED'
        END AS rls_status,
        CASE 
          WHEN rowsecurity = false AND EXISTS (
            SELECT 1 FROM pg_policies 
            WHERE schemaname = 'public' 
            AND tablename = t.tablename
          ) THEN '⚠️  HAS POLICIES BUT RLS OFF!'
          ELSE ''
        END AS warning
      FROM pg_tables t
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
    `;
    
    const { rows: tables } = await client.query(rlsQuery);
    
    console.log('Table Name            | RLS Status   | Warning');
    console.log('-'.repeat(70));
    tables.forEach(table => {
      console.log(`${table.tablename.padEnd(20)} | ${table.rls_status} | ${table.warning}`);
    });

    // 4. Count policies per table
    console.log('\n' + '=' .repeat(70));
    console.log('POLICY COUNT PER TABLE:');
    console.log('=' .repeat(70) + '\n');
    
    const policyCountQuery = `
      SELECT 
        tablename,
        COUNT(*) as policy_count
      FROM pg_policies
      WHERE schemaname = 'public'
      GROUP BY tablename
      ORDER BY policy_count DESC, tablename;
    `;
    
    const { rows: policyCounts } = await client.query(policyCountQuery);
    
    console.log('Table Name            | Policies');
    console.log('-'.repeat(40));
    policyCounts.forEach(pc => {
      console.log(`${pc.tablename.padEnd(20)} | ${pc.policy_count}`);
    });

    // 5. Summary and recommendations
    console.log('\n' + '=' .repeat(70));
    console.log('🔍 ANALYSIS SUMMARY:');
    console.log('=' .repeat(70) + '\n');

    // Check for critical issues
    const criticalFunctions = functions.filter(f => 
      ['setup_user_profile', 'get_institutions_for_sync'].includes(f.function_name) &&
      f.security_mode.includes('INVOKER')
    );

    const tablesWithoutRLS = tables.filter(t => t.rls_status.includes('DISABLED'));
    const tablesWithPoliciesButNoRLS = tables.filter(t => t.warning.includes('HAS POLICIES'));

    if (criticalFunctions.length > 0) {
      console.log('⚠️  CRITICAL: The following functions need SECURITY DEFINER:');
      criticalFunctions.forEach(f => {
        console.log(`   - ${f.function_name}`);
      });
      console.log('');
    }

    if (tablesWithPoliciesButNoRLS.length > 0) {
      console.log('🚨 SECURITY ISSUE: Tables with policies but RLS disabled:');
      tablesWithPoliciesButNoRLS.forEach(t => {
        console.log(`   - ${t.tablename}`);
      });
      console.log('');
    }

    if (tablesWithoutRLS.length > 0) {
      console.log('❌ Tables without RLS enabled:');
      tablesWithoutRLS.forEach(t => {
        console.log(`   - ${t.tablename}`);
      });
    }

    console.log('\n' + '=' .repeat(70));
    console.log('📝 RECOMMENDATIONS:');
    console.log('=' .repeat(70) + '\n');
    
    if (criticalFunctions.length === 0) {
      console.log('✅ RPC functions appear to be properly configured');
      console.log('✅ Safe to enable RLS on tables');
    } else {
      console.log('1. Update critical functions to use SECURITY DEFINER');
      console.log('2. Then enable RLS on all public tables');
    }
    
    console.log('\nTo enable RLS, run these commands for each table:');
    tablesWithoutRLS.forEach(t => {
      console.log(`ALTER TABLE public.${t.tablename} ENABLE ROW LEVEL SECURITY;`);
    });

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await client.end();
    console.log('\n✅ Database connection closed');
  }
}

checkRPCSecuritySettings();