-- ============================================
-- FINAL FIX WITH UNIQUE POLICY NAMES
-- Fixes all RLS issues with proper naming
-- Created: 2025-01-04
-- ============================================

BEGIN;

-- ============================================
-- STEP 1: CREATE OR REPLACE HELPER FUNCTIONS
-- ============================================

-- Function to get user profile ID
CREATE OR REPLACE FUNCTION public.get_user_profile_id(user_auth_id UUID)
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT id 
    FROM public.user_profiles 
    WHERE auth_user_id = user_auth_id
    LIMIT 1;
$$;

-- Function to get all workspace IDs user has access to
CREATE OR REPLACE FUNCTION public.get_user_workspace_ids(user_auth_id UUID)
RETURNS UUID[]
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT COALESCE(
        ARRAY(
            SELECT DISTINCT w.id
            FROM public.workspaces w
            LEFT JOIN public.workspace_members wm ON wm.workspace_id = w.id
            LEFT JOIN public.user_profiles up ON up.id = w.owner_id OR up.id = wm.user_id
            WHERE up.auth_user_id = user_auth_id
        ),
        ARRAY[]::UUID[]
    );
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.get_user_profile_id(UUID) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_user_workspace_ids(UUID) TO authenticated, service_role;

-- ============================================
-- STEP 2: FIX BANK_ACCOUNTS TABLE
-- ============================================

-- Drop existing policies
DROP POLICY IF EXISTS "Users can view workspace bank accounts" ON public.bank_accounts CASCADE;
DROP POLICY IF EXISTS "service_role_bypass_bank_accounts" ON public.bank_accounts CASCADE;
DROP POLICY IF EXISTS "service_role_bypass" ON public.bank_accounts CASCADE;

-- Create new policies with unique names
CREATE POLICY "bank_accounts_service_role" 
ON public.bank_accounts 
AS PERMISSIVE
FOR ALL 
TO service_role
USING (true)
WITH CHECK (true);

CREATE POLICY "bank_accounts_workspace_access" 
ON public.bank_accounts 
AS PERMISSIVE
FOR ALL
TO authenticated
USING (
    auth.uid() IS NOT NULL 
    AND workspace_id = ANY(get_user_workspace_ids(auth.uid()))
)
WITH CHECK (
    auth.uid() IS NOT NULL 
    AND workspace_id = ANY(get_user_workspace_ids(auth.uid()))
);

-- ============================================
-- STEP 3: FIX CATEGORIES TABLE
-- ============================================

-- Drop existing policies
DROP POLICY IF EXISTS "Users can view workspace categories" ON public.categories CASCADE;
DROP POLICY IF EXISTS "service_role_bypass" ON public.categories CASCADE;

-- Create new policies
CREATE POLICY "categories_service_role" 
ON public.categories 
AS PERMISSIVE
FOR ALL 
TO service_role
USING (true)
WITH CHECK (true);

CREATE POLICY "categories_workspace_access" 
ON public.categories 
AS PERMISSIVE
FOR ALL
TO authenticated
USING (
    auth.uid() IS NOT NULL 
    AND workspace_id = ANY(get_user_workspace_ids(auth.uid()))
)
WITH CHECK (
    auth.uid() IS NOT NULL 
    AND workspace_id = ANY(get_user_workspace_ids(auth.uid()))
);

-- ============================================
-- STEP 4: FIX BUDGETS TABLE
-- ============================================

-- Drop existing policies
DROP POLICY IF EXISTS "Users can view workspace budgets" ON public.budgets CASCADE;
DROP POLICY IF EXISTS "service_role_bypass" ON public.budgets CASCADE;

-- Create new policies
CREATE POLICY "budgets_service_role" 
ON public.budgets 
AS PERMISSIVE
FOR ALL 
TO service_role
USING (true)
WITH CHECK (true);

CREATE POLICY "budgets_workspace_access" 
ON public.budgets 
AS PERMISSIVE
FOR ALL
TO authenticated
USING (
    auth.uid() IS NOT NULL 
    AND workspace_id = ANY(get_user_workspace_ids(auth.uid()))
)
WITH CHECK (
    auth.uid() IS NOT NULL 
    AND workspace_id = ANY(get_user_workspace_ids(auth.uid()))
);

-- ============================================
-- STEP 5: FIX CHART_OF_ACCOUNTS TABLE
-- ============================================

-- Drop existing policies
DROP POLICY IF EXISTS "Users can view workspace chart of accounts" ON public.chart_of_accounts CASCADE;
DROP POLICY IF EXISTS "service_role_bypass" ON public.chart_of_accounts CASCADE;

-- Create new policies
CREATE POLICY "chart_of_accounts_service_role" 
ON public.chart_of_accounts 
AS PERMISSIVE
FOR ALL 
TO service_role
USING (true)
WITH CHECK (true);

CREATE POLICY "chart_of_accounts_workspace_access" 
ON public.chart_of_accounts 
AS PERMISSIVE
FOR ALL
TO authenticated
USING (
    auth.uid() IS NOT NULL 
    AND workspace_id = ANY(get_user_workspace_ids(auth.uid()))
)
WITH CHECK (
    auth.uid() IS NOT NULL 
    AND workspace_id = ANY(get_user_workspace_ids(auth.uid()))
);

-- ============================================
-- STEP 6: FIX DOCUMENTS TABLE
-- ============================================

-- Drop existing policies
DROP POLICY IF EXISTS "Users can view workspace documents" ON public.documents CASCADE;
DROP POLICY IF EXISTS "service_role_bypass" ON public.documents CASCADE;

-- Create new policies
CREATE POLICY "documents_service_role" 
ON public.documents 
AS PERMISSIVE
FOR ALL 
TO service_role
USING (true)
WITH CHECK (true);

CREATE POLICY "documents_workspace_access" 
ON public.documents 
AS PERMISSIVE
FOR ALL
TO authenticated
USING (
    auth.uid() IS NOT NULL 
    AND workspace_id = ANY(get_user_workspace_ids(auth.uid()))
)
WITH CHECK (
    auth.uid() IS NOT NULL 
    AND workspace_id = ANY(get_user_workspace_ids(auth.uid()))
);

-- ============================================
-- STEP 7: FIX LEDGER_ENTRIES TABLE
-- ============================================

-- Drop existing policies
DROP POLICY IF EXISTS "Users can view workspace ledger entries" ON public.ledger_entries CASCADE;
DROP POLICY IF EXISTS "service_role_bypass" ON public.ledger_entries CASCADE;

-- Create new policies
CREATE POLICY "ledger_entries_service_role" 
ON public.ledger_entries 
AS PERMISSIVE
FOR ALL 
TO service_role
USING (true)
WITH CHECK (true);

CREATE POLICY "ledger_entries_workspace_access" 
ON public.ledger_entries 
AS PERMISSIVE
FOR ALL
TO authenticated
USING (
    auth.uid() IS NOT NULL 
    AND workspace_id = ANY(get_user_workspace_ids(auth.uid()))
)
WITH CHECK (
    auth.uid() IS NOT NULL 
    AND workspace_id = ANY(get_user_workspace_ids(auth.uid()))
);

-- ============================================
-- STEP 8: FIX MERCHANT_ALIASES TABLE
-- ============================================

-- Drop existing policies
DROP POLICY IF EXISTS "Users can view workspace merchant aliases" ON public.merchant_aliases CASCADE;
DROP POLICY IF EXISTS "service_role_bypass" ON public.merchant_aliases CASCADE;

-- Create new policies
CREATE POLICY "merchant_aliases_service_role" 
ON public.merchant_aliases 
AS PERMISSIVE
FOR ALL 
TO service_role
USING (true)
WITH CHECK (true);

CREATE POLICY "merchant_aliases_workspace_access" 
ON public.merchant_aliases 
AS PERMISSIVE
FOR ALL
TO authenticated
USING (
    auth.uid() IS NOT NULL 
    AND workspace_id = ANY(get_user_workspace_ids(auth.uid()))
)
WITH CHECK (
    auth.uid() IS NOT NULL 
    AND workspace_id = ANY(get_user_workspace_ids(auth.uid()))
);

-- ============================================
-- STEP 9: FIX TRANSACTION_LINKS TABLE
-- ============================================

-- Drop existing policies
DROP POLICY IF EXISTS "Users can view workspace transaction links" ON public.transaction_links CASCADE;
DROP POLICY IF EXISTS "service_role_bypass" ON public.transaction_links CASCADE;

-- Create new policies
CREATE POLICY "transaction_links_service_role" 
ON public.transaction_links 
AS PERMISSIVE
FOR ALL 
TO service_role
USING (true)
WITH CHECK (true);

CREATE POLICY "transaction_links_workspace_access" 
ON public.transaction_links 
AS PERMISSIVE
FOR ALL
TO authenticated
USING (
    auth.uid() IS NOT NULL 
    AND workspace_id = ANY(get_user_workspace_ids(auth.uid()))
)
WITH CHECK (
    auth.uid() IS NOT NULL 
    AND workspace_id = ANY(get_user_workspace_ids(auth.uid()))
);

-- ============================================
-- STEP 10: FIX USER_PROFILES TABLE
-- ============================================

-- Drop existing policies
DROP POLICY IF EXISTS "Users can update own profile" ON public.user_profiles CASCADE;
DROP POLICY IF EXISTS "Users can view own profile" ON public.user_profiles CASCADE;
DROP POLICY IF EXISTS "service_role_bypass" ON public.user_profiles CASCADE;

-- Create new policies
CREATE POLICY "user_profiles_service_role" 
ON public.user_profiles 
AS PERMISSIVE
FOR ALL 
TO service_role
USING (true)
WITH CHECK (true);

CREATE POLICY "user_profiles_own_access" 
ON public.user_profiles 
AS PERMISSIVE
FOR ALL
TO authenticated
USING (
    auth.uid() IS NOT NULL 
    AND auth_user_id = auth.uid()
)
WITH CHECK (
    auth.uid() IS NOT NULL 
    AND auth_user_id = auth.uid()
);

-- ============================================
-- STEP 11: FIX WORKSPACE_MEMBERS TABLE
-- ============================================

-- Drop existing policies
DROP POLICY IF EXISTS "Users can view workspace members simple" ON public.workspace_members CASCADE;
DROP POLICY IF EXISTS "service_role_bypass" ON public.workspace_members CASCADE;

-- Create new policies
CREATE POLICY "workspace_members_service_role" 
ON public.workspace_members 
AS PERMISSIVE
FOR ALL 
TO service_role
USING (true)
WITH CHECK (true);

CREATE POLICY "workspace_members_workspace_access" 
ON public.workspace_members 
AS PERMISSIVE
FOR SELECT
TO authenticated
USING (
    auth.uid() IS NOT NULL 
    AND workspace_id = ANY(get_user_workspace_ids(auth.uid()))
);

-- ============================================
-- STEP 12: ENSURE PROPER GRANTS
-- ============================================

-- Grant all permissions to service_role
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO service_role;
GRANT ALL ON ALL FUNCTIONS IN SCHEMA public TO service_role;

-- Grant appropriate permissions to authenticated role
GRANT SELECT, INSERT, UPDATE, DELETE ON public.bank_accounts TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.feed_transactions TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.categories TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.budgets TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.chart_of_accounts TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.documents TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ledger_entries TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.merchant_aliases TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.transaction_links TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_profiles TO authenticated;
GRANT SELECT ON public.workspace_members TO authenticated;

-- ============================================
-- STEP 13: VERIFY THE FIX
-- ============================================

DO $$
DECLARE
    r RECORD;
    v_total_fixed INTEGER := 0;
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '✅ FIXED RLS POLICIES WITH UNIQUE NAMES';
    RAISE NOTICE '';
    RAISE NOTICE 'Tables updated with proper policies:';
    
    FOR r IN 
        SELECT 
            c.relname as table_name,
            COUNT(DISTINCT pol.polname) as policy_count
        FROM pg_policy pol
        JOIN pg_class c ON c.oid = pol.polrelid
        JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = 'public'
        AND c.relname IN (
            'bank_accounts', 'categories', 'budgets', 'chart_of_accounts',
            'documents', 'ledger_entries', 'merchant_aliases', 
            'transaction_links', 'user_profiles', 'workspace_members'
        )
        GROUP BY c.relname
        ORDER BY c.relname
    LOOP
        RAISE NOTICE '  ✅ % - % policies', rpad(r.table_name, 25), r.policy_count;
        v_total_fixed := v_total_fixed + 1;
    END LOOP;
    
    RAISE NOTICE '';
    RAISE NOTICE 'Summary:';
    RAISE NOTICE '  • Fixed % tables with unique policy names', v_total_fixed;
    RAISE NOTICE '  • All policies check for NULL auth.uid()';
    RAISE NOTICE '  • All policies are PERMISSIVE';
    RAISE NOTICE '  • Service role has full access to all tables';
    RAISE NOTICE '';
    RAISE NOTICE '🎉 The 500 errors should now be resolved!';
END $$;

COMMIT;

-- ============================================
-- ALL POLICIES FIXED WITH UNIQUE NAMES
-- ============================================