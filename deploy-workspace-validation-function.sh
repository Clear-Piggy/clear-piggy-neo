#!/bin/bash

echo "🔐 Deploying Workspace Validation Edge Function"
echo "================================================"

# Check if supabase CLI is installed
if ! command -v supabase &> /dev/null; then
    echo "❌ Supabase CLI is not installed"
    echo "Install it with: brew install supabase/tap/supabase"
    exit 1
fi

# Check if we're in the right directory
if [ ! -f "supabase/functions/validate-workspace-access/index.ts" ]; then
    echo "❌ Edge function not found. Make sure you're in the project root directory."
    exit 1
fi

echo "📂 Function found at: supabase/functions/validate-workspace-access/index.ts"

# Deploy the function
echo "🚀 Deploying to Supabase..."
supabase functions deploy validate-workspace-access \
  --project-ref lrwvooucggciazmzxqlb \
  --no-verify-jwt

if [ $? -eq 0 ]; then
    echo "✅ Function deployed successfully!"
    echo ""
    echo "📝 Function Details:"
    echo "- Name: validate-workspace-access"
    echo "- URL: https://lrwvooucggciazmzxqlb.supabase.co/functions/v1/validate-workspace-access"
    echo "- Purpose: Validates user access to workspace for OCR security"
    echo ""
    echo "🔒 Security Features:"
    echo "- Validates workspace_id and user_id"
    echo "- Checks workspace membership"
    echo "- Returns user role and permissions"
    echo "- Prevents cross-tenant data access"
    echo ""
    echo "📋 Next Steps:"
    echo "1. Test the function with the test script"
    echo "2. Configure n8n workflow to use this function"
    echo "3. Monitor function logs in Supabase dashboard"
else
    echo "❌ Deployment failed. Check the error messages above."
    exit 1
fi