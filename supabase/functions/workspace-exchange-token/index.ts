import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Helper to encrypt sensitive data using Web Crypto API
async function encryptToken(token: string): Promise<string> {
  const encryptionKey = Deno.env.get('PLAID_ENCRYPTION_KEY') || Deno.env.get('ENCRYPTION_KEY');
  if (!encryptionKey) {
    console.warn('No encryption key found, using base64 encoding (not recommended for production)');
    // In development, just base64 encode
    return btoa(token);
  }
  
  try {
    // Use Web Crypto API for encryption
    const encoder = new TextEncoder();
    const data = encoder.encode(token);
    
    // Create a key from the encryption key
    const keyMaterial = await crypto.subtle.importKey(
      'raw',
      encoder.encode(encryptionKey.padEnd(32, '0').slice(0, 32)), // Ensure 32 bytes
      { name: 'AES-GCM' },
      false,
      ['encrypt']
    );
    
    // Generate IV
    const iv = crypto.getRandomValues(new Uint8Array(12));
    
    // Encrypt
    const encrypted = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv },
      keyMaterial,
      data
    );
    
    // Combine IV and encrypted data
    const combined = new Uint8Array(iv.length + encrypted.byteLength);
    combined.set(iv, 0);
    combined.set(new Uint8Array(encrypted), iv.length);
    
    // Return base64 encoded
    return btoa(String.fromCharCode(...combined));
  } catch (err) {
    console.error('Encryption failed:', err);
    // Fallback to base64
    return btoa(token);
  }
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Get the authorization header from the request
    const authHeader = req.headers.get('Authorization');
    
    const requestBody = await req.json();
    console.log('Request received:', { 
      workspace_id: requestBody.workspace_id,
      user_id: requestBody.user_id,
      has_public_token: !!requestBody.public_token,
      has_metadata: !!requestBody.metadata,
      institution_id: requestBody.institution_id
    });
    
    const { public_token, workspace_id, user_id, metadata, institution_id } = requestBody;

    if (!workspace_id) {
      throw new Error('workspace_id is required');
    }

    if (!user_id) {
      throw new Error('user_id is required');
    }

    if (!public_token) {
      throw new Error('public_token is required');
    }

    // Initialize Supabase client with service role for bypassing RLS
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    
    console.log('Supabase URL:', supabaseUrl);
    console.log('Has service role key:', !!serviceRoleKey);
    console.log('Has auth header:', !!authHeader);
    
    if (!supabaseUrl || !serviceRoleKey) {
      throw new Error('Supabase configuration missing');
    }
    
    // Create service role client that bypasses RLS completely
    // Service role key should bypass all RLS policies
    const dbClient = createClient(supabaseUrl, serviceRoleKey);
    
    // No longer need to test access - we'll use database functions

    // Get Plaid configuration
    const plaidEnv = Deno.env.get('PLAID_ENV') || Deno.env.get('PLAID_ENVIRONMENT') || 'sandbox';
    const plaidClientId = Deno.env.get('PLAID_CLIENT_ID');
    const plaidSecret = Deno.env.get('PLAID_SECRET') || Deno.env.get(`PLAID_SECRET_${plaidEnv.toUpperCase()}`);
    
    if (!plaidClientId || !plaidSecret) {
      throw new Error('Plaid credentials not configured');
    }

    // Determine Plaid base URL
    let plaidBaseUrl = 'https://sandbox.plaid.com';
    if (plaidEnv === 'development') {
      plaidBaseUrl = 'https://development.plaid.com';
    } else if (plaidEnv === 'production') {
      plaidBaseUrl = 'https://production.plaid.com';
    }

    console.log('Exchanging public token for workspace:', workspace_id);
    
    let accessToken: string;
    let itemId: string;
    
    // Check if this is a test token (for debugging)
    if (public_token.startsWith('public-sandbox-test-')) {
      console.log('Test token detected, creating mock access token');
      accessToken = 'access-sandbox-' + Date.now();
      itemId = 'sandbox_item_' + Date.now();
    } else {
      // Exchange real public token for access token
      const exchangeResponse = await fetch(`${plaidBaseUrl}/item/public_token/exchange`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          client_id: plaidClientId,
          secret: plaidSecret,
          public_token: public_token,
        }),
      });

      if (!exchangeResponse.ok) {
        const errorData = await exchangeResponse.json();
        console.error('Plaid API error:', errorData);
        
        // Return more detailed error response
        return new Response(
          JSON.stringify({
            error: 'Failed to exchange public token',
            details: errorData.error_message || 'Unknown error',
            error_code: errorData.error_code,
            workspace_id,
            institution_id: metadata?.institution?.institution_id
          }),
          {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 400,
          }
        );
      }

      const exchangeData = await exchangeResponse.json();
      accessToken = exchangeData.access_token;
      itemId = exchangeData.item_id;
      
      // Validate token format
      console.log('Access token validation:');
      console.log('- Token starts with "access-":', accessToken?.startsWith('access-'));
      console.log('- Token length:', accessToken?.length);
      console.log('- Token preview:', accessToken?.substring(0, 40) + '...');
      
      if (!accessToken || !accessToken.startsWith('access-')) {
        console.error('WARNING: Invalid access token format received from Plaid!');
        console.error('Full token:', accessToken);
      }
    }

    // Encrypt the access token for storage
    console.log('Encrypting access token for item:', itemId);
    const encryptedToken = await encryptToken(accessToken);
    console.log('Access token encrypted, length:', encryptedToken.length);
    console.log('Token preview:', encryptedToken.substring(0, 20) + '...');

    // Get institution details if available
    let institutionData = null;
    if (metadata?.institution?.institution_id) {
      try {
        const institutionResponse = await fetch(`${plaidBaseUrl}/institutions/get_by_id`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            client_id: plaidClientId,
            secret: plaidSecret,
            institution_id: metadata.institution.institution_id,
            country_codes: ['US'],
          }),
        });

        if (institutionResponse.ok) {
          const instData = await institutionResponse.json();
          const inst = instData.institution;
          
          // Use the database function to upsert institution (bypasses RLS)
          console.log('Upserting institution via database function');
          const { data: instResult, error: instError } = await dbClient.rpc('upsert_institution', {
            p_workspace_id: workspace_id,
            p_plaid_institution_id: inst.institution_id,
            p_plaid_item_id: itemId,
            p_plaid_access_token_encrypted: encryptedToken,
            p_name: inst.name,
            p_logo_url: inst.logo || null,
            p_hex_color: inst.primary_color || null,
            p_website_url: inst.url || null,
            p_routing_numbers: inst.routing_numbers || [],
            p_user_id: user_id
          });

          if (instError) {
            console.error('Error saving institution:', instError);
            throw new Error(`Failed to save institution: ${instError.message}`);
          } else {
            console.log('Institution saved/updated successfully');
            console.log('Result:', instResult);
            // Get the full institution data
            const { data: fullInst } = await dbClient
              .from('institutions')
              .select('*')
              .eq('id', instResult.id)
              .single();
            institutionData = fullInst || { id: instResult.id };
          }
        }
      } catch (instErr) {
        console.error('Error fetching institution details:', instErr);
        throw new Error(`Failed to fetch/create institution: ${instErr instanceof Error ? instErr.message : String(instErr)}`);
      }
    } else {
      console.log('No institution metadata provided, creating basic institution record');
      
      // Use database function for basic institution too
      const { data: instResult, error: instError } = await dbClient.rpc('upsert_institution', {
        p_workspace_id: workspace_id,
        p_plaid_institution_id: 'unknown_' + itemId,
        p_plaid_item_id: itemId,
        p_plaid_access_token_encrypted: encryptedToken,
        p_name: 'Connected Bank Account',
        p_logo_url: null,
        p_hex_color: null,
        p_website_url: null,
        p_routing_numbers: [],
        p_user_id: user_id
      });
      
      if (instError) {
        console.error('Error creating basic institution:', instError);
        throw new Error(`Failed to create basic institution: ${instError.message}`);
      } else {
        console.log('Basic institution created with token');
        // Get the full institution data
        const { data: fullInst } = await dbClient
          .from('institutions')
          .select('*')
          .eq('id', instResult.id)
          .single();
        institutionData = fullInst || { id: instResult.id };
      }
    }

    // Ensure we have an institution before creating accounts
    if (!institutionData) {
      throw new Error('Institution must be created before creating bank accounts. Check institution creation errors above.');
    }

    // Get and store account details
    console.log('Fetching accounts for workspace:', workspace_id);
    
    let accountsData: any = { accounts: [] };
    const accountResults = [];
    
    // Skip fetching accounts for test tokens
    if (!public_token.startsWith('public-sandbox-test-')) {
      const accountsResponse = await fetch(`${plaidBaseUrl}/accounts/get`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          client_id: plaidClientId,
          secret: plaidSecret,
          access_token: accessToken,
        }),
      });

      if (!accountsResponse.ok) {
        const errorData = await accountsResponse.json();
        console.error('Error fetching accounts:', errorData);
        // Continue without accounts for now
        console.log('Continuing without account details');
      } else {
        accountsData = await accountsResponse.json();
      }
    } else {
      // Create mock account for test token
      accountsData.accounts = [{
        account_id: 'test_account_' + Date.now(),
        name: 'Test Checking Account',
        type: 'depository',
        subtype: 'checking',
        mask: '0000',
        balances: {
          current: 1000,
          available: 1000,
          iso_currency_code: 'USD'
        }
      }];
    }
    
    for (const account of accountsData.accounts) {
      // Map Plaid account type to database enum
      const mapAccountType = (plaidType: string, subtype?: string) => {
        switch(plaidType) {
          case 'depository': 
            return subtype === 'checking' ? 'checking' : 
                   subtype === 'savings' ? 'savings' : 'checking';
          case 'credit': 
            return 'credit_card';
          case 'loan': 
            return 'loan';
          case 'investment':
          case 'brokerage': 
            return 'investment';
          default: 
            return 'checking'; // Default fallback
        }
      };

      // Use database function to upsert bank account (bypasses RLS)
      const { data: accResult, error: accError } = await dbClient.rpc('upsert_bank_account', {
        p_workspace_id: workspace_id,
        p_institution_id: institutionData.id,
        p_plaid_account_id: account.account_id,
        p_name: account.name,
        p_account_type: mapAccountType(account.type, account.subtype),
        p_account_subtype_detailed: account.subtype || null,
        p_mask: account.mask || null,
        p_current_balance_cents: account.balances.current ? Math.round(account.balances.current * 100) : null,
        p_available_balance_cents: account.balances.available ? Math.round(account.balances.available * 100) : null,
        p_currency_code: account.balances.iso_currency_code || 'USD',
        p_user_id: user_id
      });

      if (accError) {
        console.error('Error saving account:', accError);
        console.error('Account:', account.account_id, account.name);
        // Continue anyway to try to save other accounts
      } else {
        accountResults.push(accResult);
        console.log('Successfully saved account:', account.name);
      }
    }

    // Don't block the response with transaction sync - do it async
    // This prevents timeout issues and lets the UI update immediately
    console.log('Scheduling initial transaction sync for workspace:', workspace_id);
    
    // Start transaction sync in background (non-blocking)
    const syncTransactionsAsync = async () => {
      let transactionCount = 0;
      let transactionErrors = 0;
      
      try {
        console.log('Starting background transaction sync...');
      const now = new Date();
      const startDate = new Date(now.getFullYear(), now.getMonth() - 3, 1); // 3 months back for more data
      
      console.log(`Fetching transactions from ${startDate.toISOString().split('T')[0]} to ${now.toISOString().split('T')[0]}`);
      const transactionsResponse = await fetch(`${plaidBaseUrl}/transactions/get`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          client_id: plaidClientId,
          secret: plaidSecret,
          access_token: accessToken,
          start_date: startDate.toISOString().split('T')[0],
          end_date: now.toISOString().split('T')[0],
        }),
      });

      if (!transactionsResponse.ok) {
        const errorData = await transactionsResponse.json();
        console.error('Failed to fetch transactions from Plaid:', errorData);
        console.error('Request was:', {
          start_date: startDate.toISOString().split('T')[0],
          end_date: now.toISOString().split('T')[0],
          access_token_exists: !!accessToken
        });
      } else {
        const txData = await transactionsResponse.json();
        console.log(`Received ${txData.transactions?.length || 0} transactions from Plaid`);
        console.log('Transaction data sample:', txData.transactions?.[0]);
        
        // Store transactions with full enrichment using the same RPC as sync function
        for (const tx of txData.transactions || []) {
          // Find the bank account by plaid_account_id to get the UUID
          const { data: bankAccount } = await dbClient
            .from('bank_accounts')
            .select('id')
            .eq('workspace_id', workspace_id)
            .eq('plaid_account_id', tx.account_id)
            .single();
          
          if (!bankAccount) {
            console.error(`Bank account not found for Plaid account ID: ${tx.account_id}`);
            transactionErrors++;
            continue;
          }
          
          // Use the same enriched RPC as the sync function for consistency
          const { data: txResult, error: txError } = await dbClient
            .rpc('upsert_transaction_enriched', {
              // Core required fields
              p_workspace_id: workspace_id,
              p_bank_account_id: bankAccount.id,
              p_plaid_transaction_id: tx.transaction_id,
              p_provider_unique_id: tx.transaction_id,
              p_content_hash: Buffer.from(`${tx.transaction_id}_${workspace_id}_${tx.date}`).toString('base64'),
              p_amount_cents: Math.round(Math.abs(tx.amount * 100)),
              p_direction: tx.amount > 0 ? 'outflow' : 'inflow',
              p_currency_code: tx.iso_currency_code || 'USD',
              p_transaction_date: tx.date,
              p_description: tx.name,
              p_status: tx.pending ? 'pending' : 'posted',
              p_created_by: user_id,
              
              // Optional enrichment fields
              p_authorized_date: tx.authorized_date || null,
              
              // Merchant enrichment
              p_merchant_name: tx.merchant_name || null,
              p_merchant_logo_url: tx.logo_url || null,
              p_merchant_website: tx.website || null,
              p_merchant_entity_id: tx.merchant_entity_id || null,
              
              // Location enrichment
              p_location_address: tx.location?.address || null,
              p_location_city: tx.location?.city || null,
              p_location_region: tx.location?.region || null,
              p_location_postal_code: tx.location?.postal_code || null,
              p_location_country: tx.location?.country || null,
              p_location_lat: tx.location?.lat ? parseFloat(tx.location.lat) : null,
              p_location_lon: tx.location?.lon ? parseFloat(tx.location.lon) : null,
              p_location_store_number: tx.location?.store_number || null,
              
              // Personal Finance Category enrichment (Plaid's enhanced categories)
              p_personal_finance_category_primary: tx.personal_finance_category?.primary || null,
              p_personal_finance_category_detailed: tx.personal_finance_category?.detailed || null,
              p_personal_finance_category_confidence: tx.personal_finance_category?.confidence_level ? 
                parseFloat(tx.personal_finance_category.confidence_level) : null,
              
              // Legacy category enrichment (Plaid's old categories)
              p_category_primary: tx.category ? tx.category[0] : null,
              p_category_detailed: tx.category && tx.category.length > 1 ? tx.category[1] : null,
              
              // Payment details
              p_payment_method: tx.payment_meta?.payment_method || tx.payment_channel || null,
              p_payment_processor: tx.payment_meta?.payment_processor || null,
              p_payment_reference_number: tx.payment_meta?.reference_number || null,
              p_transaction_code: tx.transaction_code || null
            });

          if (txError) {
            console.error('Error saving transaction:', txError);
            console.error('Transaction ID:', tx.transaction_id);
            transactionErrors++;
          } else {
            if (txResult?.is_new) {
              console.log(`✅ Created new transaction ${tx.transaction_id}: ${tx.name}`);
            } else {
              console.log(`🔄 Updated existing transaction ${tx.transaction_id}: ${tx.name}`);
            }
            transactionCount++;
          }
        }
        console.log(`Successfully saved ${transactionCount} transactions, ${transactionErrors} errors`);
      }
      } catch (txErr) {
        console.error('Error in background sync:', txErr);
      }
    };
    
    // Start the async sync but don't await it - let it run in background
    syncTransactionsAsync().catch(err => {
      console.error('Background sync failed:', err);
    });

    // Return immediately without waiting for transactions
    return new Response(
      JSON.stringify({ 
        success: true,
        workspace_id,
        item_id: itemId,
        institution: institutionData,
        accounts: accountResults,
        transactions_syncing: true, // Indicate sync is happening in background
        encrypted_token: encryptedToken, // Return the encrypted token
        plaid_institution_id: metadata?.institution?.institution_id,
        message: `Successfully connected ${metadata?.institution?.name || 'bank account'} with ${accountResults.length} accounts. Transactions syncing in background...`
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error) {
    console.error('Error exchanging token:', error);
    return new Response(
      JSON.stringify({ 
        error: error.message,
        details: error.stack
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    );
  }
});