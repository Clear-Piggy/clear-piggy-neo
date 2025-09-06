# Production RLS Fix Deployment Guide

## Current Issues Identified

1. **RESTRICTIVE Policies**: All workspace policies are RESTRICTIVE instead of PERMISSIVE
   - RESTRICTIVE policies require ALL to pass (AND logic)
   - PERMISSIVE policies require ANY to pass (OR logic)
   - Current setup is too restrictive and causing 500 errors

2. **No Helper Functions**: Auth context handling is unstable
   - Direct auth.uid() calls in policies can be unreliable
   - Need SECURITY DEFINER functions for stable context

3. **Recursive References**: Policies have circular references causing performance issues

## The Production Fix

The fix (`SQL/production-fix-workspace-rls.sql`) addresses all issues:

### 1. Creates Helper Functions
```sql
-- Stable function to get user profile ID
CREATE FUNCTION get_user_profile_id(user_auth_id UUID)
RETURNS UUID
SECURITY DEFINER

-- Function to check workspace access
CREATE FUNCTION user_has_workspace_access(workspace_id UUID, user_auth_id UUID)
RETURNS BOOLEAN
SECURITY DEFINER
```

### 2. Replaces Policies with PERMISSIVE Ones
- Removes all existing RESTRICTIVE policies
- Creates new PERMISSIVE policies using helper functions
- Handles NULL auth.uid() gracefully with CASE statements

### 3. Ensures Service Role Bypass
- Service role always gets full access (critical for admin operations)
- Authenticated users get proper filtered access

## Deployment Steps

### Step 1: Apply the Fix in Supabase SQL Editor

1. Go to Supabase Dashboard → SQL Editor
2. Copy the entire contents of `SQL/production-fix-workspace-rls.sql`
3. Run the script
4. Verify output shows:
   - ✅ Created 4 policies on workspaces table
   - Functions created successfully

### Step 2: Verify the Fix

Run the test script locally:
```bash
node test-production-fix.js
```

Expected output:
```
✅ get_user_profile_id returns: [UUID]
✅ user_has_workspace_access returns: true
✅ Service role can access workspace
✅ Authenticated user can access workspace
✅ ALL TESTS PASSED!
```

### Step 3: Monitor Application

1. Clear browser cache/cookies
2. Sign in to the application
3. Verify workspace loads without 500 errors
4. Check that all features work:
   - Workspace selection
   - Transaction viewing
   - Bank account management

## What This Fixes

### Before (BROKEN):
- 500 errors when authenticated users query workspaces
- auth.uid() returns null in some contexts
- RESTRICTIVE policies block legitimate access
- App stuck in "Setting up your workspace..." loop

### After (FIXED):
- Stable authentication context via SECURITY DEFINER functions
- PERMISSIVE policies allow proper access
- NULL auth.uid() handled gracefully
- Service role always works for admin operations
- App loads workspaces correctly

## Testing Checklist

- [ ] Run `SQL/production-fix-workspace-rls.sql` in Supabase
- [ ] Run `node test-production-fix.js` - all tests pass
- [ ] Clear browser data and re-authenticate
- [ ] Workspace loads without errors
- [ ] Can view transactions
- [ ] Can manage bank accounts
- [ ] Service role operations work (sync, etc.)

## Rollback Plan

If issues occur after deployment:

1. **Quick Fix**: Temporarily disable RLS (NOT recommended for production):
```sql
ALTER TABLE public.workspaces DISABLE ROW LEVEL SECURITY;
```

2. **Proper Rollback**: Restore previous policies:
```sql
-- Run SQL/emergency-fix-workspace-access-v2.sql
-- This restores the simpler policy structure
```

## Additional Notes

- The fix uses SECURITY DEFINER functions which run with elevated privileges
- Functions are owned by the postgres user and execute in a stable context
- This pattern can be applied to other tables if similar issues occur
- Monitor Supabase logs for any new errors after deployment

## Support

If issues persist after applying this fix:

1. Check Supabase logs for specific error messages
2. Run `node verify-rls-status.js` to check current state
3. Ensure all users have proper entries in `user_profiles` table
4. Verify workspace ownership and membership data is correct