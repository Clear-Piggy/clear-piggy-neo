# 🔐 Apply Proper Security Fix for Receipt Upload

## Step 1: Apply the SQL Security Policies

1. Go to: https://supabase.com/dashboard/project/lrwvooucggciazmzxqlb/sql/new
2. Copy ALL the SQL from: `SQL/fix-documents-rls-proper.sql`
3. Paste it into the SQL editor
4. Click "Run" button
5. You should see success messages in the output

## Step 2: Set Storage Bucket Back to Private

After the SQL runs successfully:

```bash
node make-bucket-private-secure.js
```

This will:
- Set the receipts bucket back to private
- Ensure proper authentication is required
- Maintain the workspace-scoped security

## What This Fixes

### Documents Table RLS Policies:
✅ **Service role access** - n8n webhook can insert documents  
✅ **Workspace scoping** - Users can only access their workspace documents  
✅ **Insert validation** - Validates workspace_id and created_by  
✅ **Select/Update/Delete** - Only for user's workspace  

### Storage Bucket Policies:
✅ **Workspace path validation** - Files must be in `/receipts/{workspace_id}/`  
✅ **Authenticated access only** - No public access  
✅ **Service role bypass** - n8n can process files  

## Testing After Fix

1. Try uploading a receipt (PDF or image)
2. Check browser console for errors
3. Verify the file appears in Supabase Storage under correct path
4. Check if document record is created in documents table

## If You Still Get Errors

### "new row violates row-level security policy"
- Make sure you're logged in
- Check that your user has a workspace
- Verify the workspace_id is being sent

### "violates foreign key constraint"
- The created_by field needs a valid user_profile ID
- Check if your user_profiles table has your user

### Storage upload fails
- Ensure bucket is properly configured
- Path must match: `/receipts/{workspace_id}/{user_id}/`

## Security Architecture

```
User Upload → Frontend
    ↓
Validates workspace_id & user_id
    ↓
Upload to Storage (workspace-scoped path)
    ↓
Insert to documents table (RLS validates)
    ↓
Webhook to n8n (with security data)
    ↓
Edge Function validates workspace access
    ↓
OCR Processing
    ↓
Transaction created (workspace-scoped)
```

Every step validates workspace access - no data leakage possible!

## Quick Verification

After applying fixes, run this to verify:

```sql
-- Check RLS is enabled
SELECT 
    tablename,
    rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public' 
AND tablename = 'documents';

-- Check policies exist
SELECT 
    policyname,
    permissive,
    cmd 
FROM pg_policies 
WHERE tablename = 'documents';

-- Should show:
-- documents_service_role_full_access | PERMISSIVE | ALL
-- documents_insert_own_workspace | PERMISSIVE | INSERT
-- documents_select_own_workspace | PERMISSIVE | SELECT
-- documents_update_own_workspace | PERMISSIVE | UPDATE
-- documents_delete_own_workspace | PERMISSIVE | DELETE
```

## Support

If issues persist after applying these fixes:
1. Check Supabase logs for detailed error messages
2. Verify your auth token is valid
3. Ensure workspace_members table has proper entries
4. Check user_profiles table has your user with correct auth_user_id