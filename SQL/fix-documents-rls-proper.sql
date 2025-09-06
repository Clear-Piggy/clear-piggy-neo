-- ============================================
-- Fix Documents Table RLS Policies Properly
-- With Full Workspace Security
-- ============================================

BEGIN;

-- First, ensure RLS is enabled
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;

-- Drop all existing policies to start fresh
DROP POLICY IF EXISTS "documents_service_role" ON public.documents;
DROP POLICY IF EXISTS "documents_workspace_access" ON public.documents;
DROP POLICY IF EXISTS "authenticated_users_all_access" ON public.documents;
DROP POLICY IF EXISTS "service_role_bypass" ON public.documents;

-- ============================================
-- 1. Service Role Policy (Always needed)
-- ============================================
CREATE POLICY "documents_service_role_full_access"
ON public.documents
AS PERMISSIVE
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- ============================================
-- 2. Authenticated Users - INSERT Policy
-- Users can insert documents into their workspace
-- ============================================
CREATE POLICY "documents_insert_own_workspace"
ON public.documents
AS PERMISSIVE
FOR INSERT
TO authenticated
WITH CHECK (
    -- User must be authenticated
    auth.uid() IS NOT NULL
    -- Workspace must be one they have access to
    AND workspace_id IN (
        SELECT w.id
        FROM public.workspaces w
        LEFT JOIN public.workspace_members wm ON wm.workspace_id = w.id
        LEFT JOIN public.user_profiles up ON up.id = w.owner_id OR up.id = wm.user_id
        WHERE up.auth_user_id = auth.uid()
    )
    -- created_by must match a user_profile id for this auth user
    AND created_by IN (
        SELECT id 
        FROM public.user_profiles 
        WHERE auth_user_id = auth.uid()
    )
);

-- ============================================
-- 3. Authenticated Users - SELECT Policy
-- Users can view documents from their workspace
-- ============================================
CREATE POLICY "documents_select_own_workspace"
ON public.documents
AS PERMISSIVE
FOR SELECT
TO authenticated
USING (
    auth.uid() IS NOT NULL
    AND workspace_id IN (
        SELECT w.id
        FROM public.workspaces w
        LEFT JOIN public.workspace_members wm ON wm.workspace_id = w.id
        LEFT JOIN public.user_profiles up ON up.id = w.owner_id OR up.id = wm.user_id
        WHERE up.auth_user_id = auth.uid()
    )
);

-- ============================================
-- 4. Authenticated Users - UPDATE Policy
-- Users can update documents in their workspace
-- ============================================
CREATE POLICY "documents_update_own_workspace"
ON public.documents
AS PERMISSIVE
FOR UPDATE
TO authenticated
USING (
    auth.uid() IS NOT NULL
    AND workspace_id IN (
        SELECT w.id
        FROM public.workspaces w
        LEFT JOIN public.workspace_members wm ON wm.workspace_id = w.id
        LEFT JOIN public.user_profiles up ON up.id = w.owner_id OR up.id = wm.user_id
        WHERE up.auth_user_id = auth.uid()
    )
)
WITH CHECK (
    auth.uid() IS NOT NULL
    AND workspace_id IN (
        SELECT w.id
        FROM public.workspaces w
        LEFT JOIN public.workspace_members wm ON wm.workspace_id = w.id
        LEFT JOIN public.user_profiles up ON up.id = w.owner_id OR up.id = wm.user_id
        WHERE up.auth_user_id = auth.uid()
    )
    -- updated_by must match a user_profile id for this auth user
    AND updated_by IN (
        SELECT id 
        FROM public.user_profiles 
        WHERE auth_user_id = auth.uid()
    )
);

-- ============================================
-- 5. Authenticated Users - DELETE Policy
-- Users can delete documents from their workspace
-- ============================================
CREATE POLICY "documents_delete_own_workspace"
ON public.documents
AS PERMISSIVE
FOR DELETE
TO authenticated
USING (
    auth.uid() IS NOT NULL
    AND workspace_id IN (
        SELECT w.id
        FROM public.workspaces w
        LEFT JOIN public.workspace_members wm ON wm.workspace_id = w.id
        LEFT JOIN public.user_profiles up ON up.id = w.owner_id OR up.id = wm.user_id
        WHERE up.auth_user_id = auth.uid()
    )
);

-- ============================================
-- Storage Policies Update (if needed)
-- ============================================

-- Drop old storage policies
DROP POLICY IF EXISTS "Users can upload receipts" ON storage.objects;
DROP POLICY IF EXISTS "Users can view workspace receipts" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete own receipts" ON storage.objects;
DROP POLICY IF EXISTS "Service role bypass storage" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload receipts" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can view receipts" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete receipts" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can update receipts" ON storage.objects;
DROP POLICY IF EXISTS "Service role full access to receipts" ON storage.objects;

-- Create workspace-scoped storage policies
CREATE POLICY "storage_insert_workspace_scoped"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
    bucket_id = 'receipts'
    AND auth.uid() IS NOT NULL
    -- Path must start with a workspace ID the user has access to
    AND (storage.foldername(name))[1] IN (
        SELECT w.id::text
        FROM public.workspaces w
        LEFT JOIN public.workspace_members wm ON wm.workspace_id = w.id
        LEFT JOIN public.user_profiles up ON up.id = w.owner_id OR up.id = wm.user_id
        WHERE up.auth_user_id = auth.uid()
    )
);

CREATE POLICY "storage_select_workspace_scoped"
ON storage.objects
FOR SELECT
TO authenticated
USING (
    bucket_id = 'receipts'
    AND auth.uid() IS NOT NULL
    AND (storage.foldername(name))[1] IN (
        SELECT w.id::text
        FROM public.workspaces w
        LEFT JOIN public.workspace_members wm ON wm.workspace_id = w.id
        LEFT JOIN public.user_profiles up ON up.id = w.owner_id OR up.id = wm.user_id
        WHERE up.auth_user_id = auth.uid()
    )
);

CREATE POLICY "storage_update_workspace_scoped"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
    bucket_id = 'receipts'
    AND auth.uid() IS NOT NULL
    AND (storage.foldername(name))[1] IN (
        SELECT w.id::text
        FROM public.workspaces w
        LEFT JOIN public.workspace_members wm ON wm.workspace_id = w.id
        LEFT JOIN public.user_profiles up ON up.id = w.owner_id OR up.id = wm.user_id
        WHERE up.auth_user_id = auth.uid()
    )
)
WITH CHECK (
    bucket_id = 'receipts'
    AND auth.uid() IS NOT NULL
    AND (storage.foldername(name))[1] IN (
        SELECT w.id::text
        FROM public.workspaces w
        LEFT JOIN public.workspace_members wm ON wm.workspace_id = w.id
        LEFT JOIN public.user_profiles up ON up.id = w.owner_id OR up.id = wm.user_id
        WHERE up.auth_user_id = auth.uid()
    )
);

CREATE POLICY "storage_delete_workspace_scoped"
ON storage.objects
FOR DELETE
TO authenticated
USING (
    bucket_id = 'receipts'
    AND auth.uid() IS NOT NULL
    AND (storage.foldername(name))[1] IN (
        SELECT w.id::text
        FROM public.workspaces w
        LEFT JOIN public.workspace_members wm ON wm.workspace_id = w.id
        LEFT JOIN public.user_profiles up ON up.id = w.owner_id OR up.id = wm.user_id
        WHERE up.auth_user_id = auth.uid()
    )
);

CREATE POLICY "storage_service_role_bypass"
ON storage.objects
FOR ALL
TO service_role
USING (bucket_id = 'receipts')
WITH CHECK (bucket_id = 'receipts');

-- ============================================
-- Verification Queries
-- ============================================

DO $$
DECLARE
    doc_rls_enabled BOOLEAN;
    doc_policy_count INTEGER;
    storage_policy_count INTEGER;
BEGIN
    -- Check if RLS is enabled on documents
    SELECT relrowsecurity INTO doc_rls_enabled
    FROM pg_class
    WHERE relname = 'documents' 
    AND relnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public');
    
    -- Count policies on documents table
    SELECT COUNT(*) INTO doc_policy_count
    FROM pg_policies
    WHERE tablename = 'documents'
    AND schemaname = 'public';
    
    -- Count policies on storage.objects for receipts
    SELECT COUNT(*) INTO storage_policy_count
    FROM pg_policies
    WHERE tablename = 'objects'
    AND schemaname = 'storage'
    AND policyname LIKE '%receipts%' OR policyname LIKE '%storage%';
    
    RAISE NOTICE '';
    RAISE NOTICE '✅ Documents RLS Configuration Complete!';
    RAISE NOTICE '=====================================';
    RAISE NOTICE 'Documents Table:';
    RAISE NOTICE '  - RLS Enabled: %', doc_rls_enabled;
    RAISE NOTICE '  - Policy Count: %', doc_policy_count;
    RAISE NOTICE '';
    RAISE NOTICE 'Storage Policies:';
    RAISE NOTICE '  - Policy Count: %', storage_policy_count;
    RAISE NOTICE '';
    RAISE NOTICE 'Security Features Active:';
    RAISE NOTICE '  ✓ Workspace-scoped document access';
    RAISE NOTICE '  ✓ User must belong to workspace';
    RAISE NOTICE '  ✓ created_by/updated_by validation';
    RAISE NOTICE '  ✓ Storage path workspace validation';
    RAISE NOTICE '  ✓ Service role bypass for n8n';
    RAISE NOTICE '';
    RAISE NOTICE 'Users can now:';
    RAISE NOTICE '  - Upload receipts to their workspace';
    RAISE NOTICE '  - View only their workspace documents';
    RAISE NOTICE '  - Update/delete their workspace documents';
    RAISE NOTICE '';
END $$;

COMMIT;

-- ============================================
-- IMPORTANT: After running this SQL
-- ============================================
-- 1. Set storage bucket back to PRIVATE:
--    UPDATE storage.buckets 
--    SET public = false 
--    WHERE id = 'receipts';
--
-- 2. Test upload with a real user account
-- 3. Check browser console for any errors
-- 4. Verify document appears in documents table