#!/bin/bash

echo "🧪 Testing Workspace Validation Edge Function"
echo "============================================="

# Configuration
FUNCTION_URL="https://lrwvooucggciazmzxqlb.supabase.co/functions/v1/validate-workspace-access"
SERVICE_ROLE_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imxyd3Zvb3VjZ2djaWF6bXp4cWxiIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTczNTc4NzkyMCwiZXhwIjoyMDUxMzYzOTIwfQ.nm8RcglZ_ZCHdaxQlg_kd_v54kmA0X38Wj1LJxCKro8"

# Test data - Replace these with actual IDs from your database
USER_ID="your-user-auth-id-here"
WORKSPACE_ID="your-workspace-id-here"

echo "📊 Test Parameters:"
echo "- User ID: $USER_ID"
echo "- Workspace ID: $WORKSPACE_ID"
echo ""

# Test 1: Valid user and workspace
echo "Test 1: Valid workspace access check"
echo "-------------------------------------"
curl -X POST "$FUNCTION_URL" \
  -H "Authorization: Bearer $SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "user_id": "'$USER_ID'",
    "workspace_id": "'$WORKSPACE_ID'",
    "required_permission": "documents:create"
  }' | python3 -m json.tool

echo ""
echo "Test 2: Invalid user ID"
echo "------------------------"
curl -X POST "$FUNCTION_URL" \
  -H "Authorization: Bearer $SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "user_id": "00000000-0000-0000-0000-000000000000",
    "workspace_id": "'$WORKSPACE_ID'",
    "required_permission": "documents:create"
  }' | python3 -m json.tool

echo ""
echo "Test 3: Invalid workspace ID"
echo "-----------------------------"
curl -X POST "$FUNCTION_URL" \
  -H "Authorization: Bearer $SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "user_id": "'$USER_ID'",
    "workspace_id": "00000000-0000-0000-0000-000000000000",
    "required_permission": "documents:create"
  }' | python3 -m json.tool

echo ""
echo "Test 4: Missing parameters"
echo "---------------------------"
curl -X POST "$FUNCTION_URL" \
  -H "Authorization: Bearer $SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" \
  -d '{}' | python3 -m json.tool

echo ""
echo "✅ Tests complete!"
echo ""
echo "Expected results:"
echo "- Test 1: has_access: true (if user has access)"
echo "- Test 2: has_access: false (user not found)"
echo "- Test 3: has_access: false (workspace not found)"
echo "- Test 4: has_access: false (missing parameters)"