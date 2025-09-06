-- ============================================
-- Create Receipts Storage Bucket
-- ============================================
-- Note: Bucket creation must be done via Supabase Dashboard or Admin API
-- This SQL sets up the RLS policies once the bucket exists

BEGIN;

-- First, let's ensure the bucket exists by inserting into storage.buckets
-- This may fail if the bucket already exists, which is fine
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'receipts',
  'receipts', 
  false, -- Private bucket
  10485760, -- 10MB limit
  ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp']::text[]
)
ON CONFLICT (id) DO UPDATE
SET 
  public = false,
  file_size_limit = 10485760,
  allowed_mime_types = ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp']::text[];

-- ============================================
-- Storage Policies for Receipts Bucket
-- ============================================

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can upload receipts" ON storage.objects;
DROP POLICY IF EXISTS "Users can view workspace receipts" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete own receipts" ON storage.objects;
DROP POLICY IF EXISTS "Service role bypass storage" ON storage.objects;

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

DO $$
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '✅ Receipts bucket configuration complete!';
    RAISE NOTICE '';
    RAISE NOTICE 'The receipts bucket has been created/updated with:';
    RAISE NOTICE '  - Private access (not public)';
    RAISE NOTICE '  - 10MB file size limit';
    RAISE NOTICE '  - Image MIME types only';
    RAISE NOTICE '  - Workspace-scoped RLS policies';
    RAISE NOTICE '';
    RAISE NOTICE 'Files will be stored in format:';
    RAISE NOTICE '  /receipts/{workspace_id}/{user_id}/{timestamp}_receipt.jpg';
    RAISE NOTICE '';
END $$;

COMMIT;