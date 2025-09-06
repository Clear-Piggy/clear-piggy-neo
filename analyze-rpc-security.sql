
-- ============================================
-- RPC Function Security Analysis
-- ============================================

\echo ''
\echo '=== CHECKING RPC FUNCTIONS ==='
\echo ''

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

\echo ''
\echo '=== FUNCTION DEFINITIONS ==='
\echo ''

-- Get definition of setup_user_profile
\echo '--- setup_user_profile ---'
SELECT pg_get_functiondef(oid) 
FROM pg_proc 
WHERE proname = 'setup_user_profile'
LIMIT 1;

\echo ''
\echo '--- get_institutions_for_sync ---'
SELECT pg_get_functiondef(oid)
FROM pg_proc 
WHERE proname = 'get_institutions_for_sync'
LIMIT 1;

\echo ''
\echo '=== TABLE RLS STATUS ==='
\echo ''

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

\echo ''
\echo '=== POLICY COUNT ==='
\echo ''

-- Count policies per table
SELECT 
    tablename,
    COUNT(*) as policy_count
FROM pg_policies
WHERE schemaname = 'public'
GROUP BY tablename
ORDER BY policy_count DESC, tablename;
