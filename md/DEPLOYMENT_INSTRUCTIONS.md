# Clear Piggy Neo - Deployment Instructions

## Prerequisites
- Supabase account with project set up
- Plaid account with API credentials
- Node.js installed locally

## Step 1: Deploy Database Functions

1. Go to your Supabase Dashboard SQL Editor:
   ```
   https://supabase.com/dashboard/project/rnevebffhtplbixdmbgq/sql/new
   ```

2. Copy and paste the entire contents of `create-all-db-functions.sql`

3. Click "Run" to execute the SQL

4. You should see "Success. No rows returned" message

## Step 2: Deploy Edge Function

### Option A: Using Supabase CLI

1. Install Supabase CLI if not already installed:
   ```bash
   npm install -g supabase
   ```

2. Login to Supabase:
   ```bash
   npx supabase login
   ```

3. Link to your project (you'll need your database password):
   ```bash
   npx supabase link --project-ref rnevebffhtplbixdmbgq
   ```

4. Set environment variables for the Edge Function:
   ```bash
   npx supabase secrets set PLAID_CLIENT_ID=your_plaid_client_id
   npx supabase secrets set PLAID_SECRET=your_plaid_secret
   ```

5. Deploy the Edge Function:
   ```bash
   npx supabase functions deploy workspace-exchange-token
   ```

### Option B: Using Supabase Dashboard (Easier)

1. Go to Edge Functions in your Supabase Dashboard:
   ```
   https://supabase.com/dashboard/project/rnevebffhtplbixdmbgq/functions
   ```

2. Click "New Function" or update existing `workspace-exchange-token`

3. Copy the entire contents of `supabase/functions/workspace-exchange-token/index.ts`

4. Paste it into the function editor

5. Add environment variables in the Function Settings:
   - `PLAID_CLIENT_ID`: Your Plaid Client ID
   - `PLAID_SECRET`: Your Plaid Secret

6. Click "Deploy"

## Step 3: Test the Functions

1. Run the test script to verify everything works:
   ```bash
   node test-db-functions.js
   ```

2. You should see output like:
   ```
   ✅ Signed in as: test123@gmail.com
   📊 Workspace ID: [uuid]
   ✅ Account created successfully!
   ```

## Step 4: Connect Bank Account in UI

1. Start the application:
   ```bash
   npm start
   ```

2. Login with your credentials

3. Go to the Accounts tab

4. Click "Connect Bank Account"

5. Complete Plaid Link flow

6. Your bank accounts should now appear in the UI

## Troubleshooting

### If accounts don't show after connecting:

1. Check the browser console for errors

2. Run the debug script:
   ```bash
   node direct-db-check.js
   ```

3. Check if the SQL functions were created successfully:
   - Go to Supabase Dashboard > Database > Functions
   - Verify `upsert_institution`, `upsert_bank_account`, and `upsert_feed_transaction` exist

### If you get "permission denied" errors:

1. Make sure the SQL functions have `SECURITY DEFINER` set
2. Verify the GRANT statements were executed for all functions

### To clean all bank data and start fresh:

1. Open `check-and-clean-accounts.html` in your browser
2. Click "Clean ALL Bank Data"
3. Reconnect your bank accounts

## Important Notes

- The `limit_cents` column does NOT exist in the `bank_accounts` table
- Always use the fixed versions of the functions (without `limit_cents`)
- Edge Functions cannot bypass RLS directly, that's why we use SECURITY DEFINER functions
- Test with Plaid development environment first before going to production