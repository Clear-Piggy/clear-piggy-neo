# Receipt OCR Security Implementation

## Overview
This document describes the security enhancements implemented for the receipt OCR processing system to prevent cross-tenant data leakage and ensure proper workspace isolation.

## Security Architecture

### 1. Workspace Validation Edge Function
Located at: `supabase/functions/validate-workspace-access/index.ts`

**Purpose:** Validates that a user has access to a specific workspace before processing receipts.

**Key Features:**
- Validates user_id and workspace_id are valid UUIDs
- Checks if user is workspace owner or member
- Returns user role and permissions
- Service role key for database access
- CORS headers for cross-origin requests

### 2. Frontend Security (ReceiptUpload Component)

**Critical Security Data Sent:**
```javascript
{
  supabase_user_id: user.id,      // User's auth ID
  workspace_id: workspaceId,       // Current workspace
  source: 'clear-piggy-dashboard', // Request origin
  user_email: user.email,          // User email
  timestamp: new Date().toISOString()
}
```

### 3. n8n Workflow Security Nodes

**Security Checkpoints:**
1. **Validate Workspace Security** - Validates required fields exist
2. **Validate Workspace Access** - Calls edge function to verify permissions
3. **Security Checkpoint** - Double validates before processing

## File Storage Security

### Storage Path Structure
```
/receipts/{workspace_id}/{user_id}/{timestamp}_receipt.jpg
```

This ensures:
- Files are workspace-scoped
- User-specific organization
- No cross-workspace access
- Timestamp prevents collisions

## Transaction Creation Security

All transactions created include:
- `workspace_id` - Mandatory workspace scoping
- `created_by` - User who uploaded receipt
- `updated_by` - User who uploaded receipt
- Audit trail in notes field

## Deployment Instructions

### 1. Deploy Edge Function
```bash
./deploy-workspace-validation-function.sh
```

### 2. Test Edge Function
```bash
# Edit the test script with your IDs first
nano test-workspace-validation.sh

# Update these lines with real IDs:
USER_ID="your-user-auth-id-here"
WORKSPACE_ID="your-workspace-id-here"

# Run tests
./test-workspace-validation.sh
```

### 3. Import n8n Workflow
1. Open n8n admin panel
2. Import `n8n_secure_ocr_workflow.json`
3. Verify webhook URL matches frontend

### 4. Create Storage Bucket
In Supabase Dashboard:
1. Go to Storage
2. Create bucket named "receipts"
3. Set to Private
4. Add RLS policies from `SQL/setup-receipts-storage.sql`

## Security Validation Checklist

- [ ] Edge function deployed successfully
- [ ] Edge function tests pass
- [ ] Frontend sends workspace_id in webhook
- [ ] n8n workflow validates workspace access
- [ ] Storage uses workspace-scoped paths
- [ ] Transactions include workspace_id
- [ ] RLS policies enabled on all tables
- [ ] Storage bucket is private

## Error Handling

### Common Security Errors

1. **"SECURITY VIOLATION: Missing user_id or workspace_id"**
   - Frontend not sending required fields
   - Check ReceiptUpload component

2. **"User not found in workspace"**
   - User doesn't have access to workspace
   - Check workspace_members table

3. **"Workspace not found"**
   - Invalid workspace_id
   - Check workspaces table

4. **"SECURITY VIOLATION: Workspace ID mismatch"**
   - Data inconsistency between OCR and storage
   - Check n8n workflow nodes

## Monitoring

### Key Metrics to Track
- Failed workspace validations
- Cross-workspace access attempts
- Edge function response times
- Storage access patterns

### Logs to Review
- Edge function logs in Supabase
- n8n workflow execution logs
- Frontend console for webhook responses

## Security Best Practices

1. **Never bypass workspace validation**
2. **Always include workspace_id in all operations**
3. **Use service role only for edge functions**
4. **Regular audit of workspace access logs**
5. **Monitor for unusual access patterns**

## Testing Receipt Upload

1. Open the app and navigate to Receipts tab
2. Upload a receipt image
3. Check browser console for security logs
4. Verify n8n workflow execution
5. Check transaction created with correct workspace_id

## Rollback Plan

If issues occur:
1. Disable n8n workflow
2. Revert to previous ReceiptUpload component
3. Remove edge function
4. Review logs for root cause

## Support

For issues or questions:
- Check n8n workflow logs
- Review edge function logs in Supabase
- Check browser console for frontend errors
- Verify all IDs are valid UUIDs