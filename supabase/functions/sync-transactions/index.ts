import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    console.log('sync-transactions: Starting request');
    
    const requestBody = await req.json();
    console.log('Request body:', requestBody);
    
    const { workspace_id, user_id } = requestBody;
    
    if (!workspace_id) {
      console.error('Missing workspace_id');
      throw new Error('workspace_id is required');
    }
    
    if (!user_id) {
      console.error('Missing user_id');
      throw new Error('user_id is required');
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    
    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('Supabase configuration missing');
    }
    
    const dbClient = createClient(supabaseUrl, supabaseServiceKey);

    // Get institutions using RPC function (bypasses RLS)
    const { data: institutionsData, error: instError } = await dbClient
      .rpc('sync_workspace_transactions', {
        p_workspace_id: workspace_id,
        p_user_id: user_id
      });

    if (instError) {
      console.error('Failed to get institutions:', instError);
      throw new Error(`Failed to get institutions: ${instError.message}`);
    }

    const institutions = institutionsData?.institutions || [];
    
    if (!institutions || institutions.length === 0) {
      return new Response(
        JSON.stringify({
          success: false,
          message: 'No connected institutions found'
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Found ${institutions.length} institutions to sync`);

    // Get Plaid configuration
    const plaidEnv = Deno.env.get('PLAID_ENV') || Deno.env.get('PLAID_ENVIRONMENT') || 'sandbox';
    const plaidClientId = Deno.env.get('PLAID_CLIENT_ID');
    const plaidSecret = Deno.env.get('PLAID_SECRET') || Deno.env.get(`PLAID_SECRET_${plaidEnv.toUpperCase()}`);
    
    if (!plaidClientId || !plaidSecret) {
      throw new Error('Plaid credentials not configured');
    }

    // Determine Plaid base URL
    let plaidBaseUrl = 'https://sandbox.plaid.com';
    if (plaidEnv === 'development' || plaidSecret.includes('development')) {
      plaidBaseUrl = 'https://development.plaid.com';
    } else if (plaidEnv === 'production' || (!plaidSecret.includes('sandbox') && !plaidSecret.includes('development'))) {
      plaidBaseUrl = 'https://production.plaid.com';
    }
    
    console.log('Using Plaid environment:', plaidBaseUrl);

    let totalTransactions = 0;
    let totalErrors = 0;

    // Sync transactions for each institution
    for (const institution of institutions) {
      try {
        console.log(`Processing institution: ${institution.name} (${institution.id})`);
        
        // Check if we have an encrypted access token
        if (!institution.plaid_access_token_encrypted) {
          console.error(`No access token for institution ${institution.name}`);
          totalErrors++;
          continue;
        }
        
        // Decrypt access token (simple base64 for now)
        let accessToken;
        try {
          accessToken = atob(institution.plaid_access_token_encrypted);
        } catch (decryptError) {
          console.error(`Failed to decrypt token for ${institution.name}:`, decryptError);
          totalErrors++;
          continue;
        }

        // Get transactions from last 30 days
        const now = new Date();
        const thirtyDaysAgo = new Date(now.getTime() - (30 * 24 * 60 * 60 * 1000));

        console.log(`Fetching transactions from Plaid at ${plaidBaseUrl}`);
        const transactionsResponse = await fetch(`${plaidBaseUrl}/transactions/get`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            client_id: plaidClientId,
            secret: plaidSecret,
            access_token: accessToken,
            start_date: thirtyDaysAgo.toISOString().split('T')[0],
            end_date: now.toISOString().split('T')[0],
          }),
        });

        if (!transactionsResponse.ok) {
          const errorText = await transactionsResponse.text();
          console.error(`Plaid error for institution ${institution.name}: Status ${transactionsResponse.status}, Response: ${errorText}`);
          
          // Try to parse error for more details
          try {
            const errorJson = JSON.parse(errorText);
            console.error('Plaid error details:', errorJson);
          } catch (e) {
            // Not JSON, already logged as text
          }
          
          totalErrors++;
          continue;
        }

        const txData = await transactionsResponse.json();
        const transactions = txData.transactions || [];
        
        console.log(`Received ${transactions.length} transactions from Plaid for ${institution.name}`);

        // Get bank accounts for this institution using RPC
        const { data: bankAccounts, error: accountsError } = await dbClient
          .rpc('get_institution_bank_accounts', {
            p_institution_id: institution.id
          });

        if (accountsError || !bankAccounts) {
          console.error(`Failed to get bank accounts for institution ${institution.name}:`, accountsError);
          totalErrors++;
          continue;
        }

        // Create account map for quick lookup
        const accountMap = new Map(
          bankAccounts.map((acc: any) => [acc.plaid_account_id, acc.id])
        );

        // Process transactions
        let institutionTransactionCount = 0;
        for (const tx of transactions) {
          const bankAccountId = accountMap.get(tx.account_id);
          if (!bankAccountId) {
            console.log(`No bank account found for Plaid account ${tx.account_id}`);
            continue;
          }

          const contentHash = btoa(`${tx.transaction_id}_${workspace_id}_${tx.date}`);
          
          // Use RPC to upsert transaction
          const { data: txResult, error: txError } = await dbClient
            .rpc('upsert_feed_transaction', {
              p_workspace_id: workspace_id,
              p_bank_account_id: bankAccountId,
              p_plaid_transaction_id: tx.transaction_id,
              p_provider_unique_id: tx.transaction_id,
              p_content_hash: contentHash,
              p_amount_cents: Math.round(Math.abs(tx.amount * 100)),
              p_direction: tx.amount > 0 ? 'outflow' : 'inflow',
              p_currency_code: tx.iso_currency_code || 'USD',
              p_transaction_date: tx.date,
              p_authorized_date: tx.authorized_date || null,
              p_description: tx.name,
              p_merchant_name: tx.merchant_name || null,
              p_status: tx.pending ? 'pending' : 'posted',
              p_user_id: user_id
            });

          if (txError) {
            console.error(`Failed to upsert transaction ${tx.transaction_id}:`, txError);
          } else {
            institutionTransactionCount++;
            totalTransactions++;
          }
        }

        console.log(`Synced ${institutionTransactionCount} transactions for ${institution.name}`);

        // Update last sync time for institution using RPC
        const { error: syncError } = await dbClient
          .rpc('update_institution_sync_time', {
            p_institution_id: institution.id
          });

        if (syncError) {
          console.error(`Failed to update sync time for ${institution.name}:`, syncError);
        }

      } catch (err) {
        console.error('Error syncing institution', institution.name, ':', err);
        totalErrors++;
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: `Synced ${totalTransactions} transactions`,
        transactions_synced: totalTransactions,
        institutions_processed: institutions.length,
        errors: totalErrors
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );

  } catch (error) {
    console.error('Error in sync-transactions:', error);
    return new Response(
      JSON.stringify({
        error: error.message,
        details: error.toString()
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    );
  }
});