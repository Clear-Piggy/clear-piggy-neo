-- ============================================
-- Setup Receipt Storage Bucket and Policies
-- Created: 2025-01-04
-- ============================================

-- Note: Storage buckets must be created via Supabase Dashboard or Admin API
-- This script provides the SQL for RLS policies once the bucket exists

-- Instructions:
-- 1. Go to Supabase Dashboard > Storage
-- 2. Create a new bucket named "receipts" with:
--    - Public: No (private bucket)
--    - File size limit: 10MB
--    - Allowed MIME types: image/jpeg, image/jpg, image/png, image/gif, image/webp

-- Once the bucket is created, run this SQL to set up policies:

BEGIN;

-- ============================================
-- Storage Policies for Receipts Bucket
-- ============================================

-- Policy: Users can upload receipts to their workspace
CREATE POLICY "Users can upload receipts"
ON storage.objects
FOR INSERT
TO authenticated
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

-- Policy: Users can view receipts from their workspace
CREATE POLICY "Users can view workspace receipts"
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

-- Policy: Users can delete their own uploaded receipts
CREATE POLICY "Users can delete own receipts"
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

-- Policy: Service role has full access
CREATE POLICY "Service role bypass storage"
ON storage.objects
FOR ALL
TO service_role
USING (bucket_id = 'receipts')
WITH CHECK (bucket_id = 'receipts');

-- ============================================
-- Ensure Documents Table RLS is Configured
-- ============================================

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "documents_service_role" ON public.documents CASCADE;
DROP POLICY IF EXISTS "documents_workspace_access" ON public.documents CASCADE;

-- Service role bypass for documents
CREATE POLICY "documents_service_role"
ON public.documents
AS PERMISSIVE
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- Users can manage documents in their workspace
CREATE POLICY "documents_workspace_access"
ON public.documents
AS PERMISSIVE
FOR ALL
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
);

-- ============================================
-- Ensure Document Attachments RLS is Configured
-- ============================================

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "document_attachments_service_role" ON public.document_attachments CASCADE;
DROP POLICY IF EXISTS "document_attachments_workspace_access" ON public.document_attachments CASCADE;

-- Service role bypass for document_attachments
CREATE POLICY "document_attachments_service_role"
ON public.document_attachments
AS PERMISSIVE
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- Users can manage document attachments in their workspace
CREATE POLICY "document_attachments_workspace_access"
ON public.document_attachments
AS PERMISSIVE
FOR ALL
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
);

-- ============================================
-- Grant Permissions
-- ============================================

GRANT SELECT, INSERT, UPDATE, DELETE ON public.documents TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.document_attachments TO authenticated;
GRANT ALL ON public.documents TO service_role;
GRANT ALL ON public.document_attachments TO service_role;

-- ============================================
-- Create Index for Performance
-- ============================================

-- Index for faster receipt queries
CREATE INDEX IF NOT EXISTS idx_documents_receipts 
ON public.documents(workspace_id, document_type, processing_status) 
WHERE document_type = 'receipt';

-- Index for attachment lookups
CREATE INDEX IF NOT EXISTS idx_attachments_transaction 
ON public.document_attachments(attached_to_id, attached_to_type) 
WHERE attached_to_type = 'feed_transaction';

DO $$
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '✅ Receipt storage setup complete!';
    RAISE NOTICE '';
    RAISE NOTICE 'Next steps:';
    RAISE NOTICE '  1. Create "receipts" bucket in Supabase Dashboard > Storage';
    RAISE NOTICE '  2. Set bucket to private with 10MB limit';
    RAISE NOTICE '  3. Storage policies are now configured';
    RAISE NOTICE '  4. Document tables have proper RLS policies';
    RAISE NOTICE '';
END $$;

COMMIT;

-- ============================================
-- Receipt Storage Setup Complete
-- ============================================