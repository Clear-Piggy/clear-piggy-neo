#!/bin/bash

# Deploy the sync-transactions Edge Function
echo "Deploying sync-transactions Edge Function with improved error handling..."

cd /Users/officemac/Projects/clear-piggy-neo

# First, link the project if not already linked
echo "Linking Supabase project..."
echo "You'll need to enter your database password from:"
echo "https://supabase.com/dashboard/project/rnevebffhtplbixdmbgq/settings/database"
echo ""
supabase link --project-ref rnevebffhtplbixdmbgq

# Deploy the function
echo ""
echo "Deploying workspace-sync-transactions function..."
supabase functions deploy workspace-sync-transactions

echo ""
echo "Function deployed! You can now test the sync button in the app."
echo ""
echo "To view function logs, run:"
echo "npx supabase functions logs"