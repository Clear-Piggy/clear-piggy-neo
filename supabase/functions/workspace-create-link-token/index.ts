import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { workspace_id, user_id } = await req.json();

    if (!workspace_id) {
      throw new Error('workspace_id is required');
    }

    if (!user_id) {
      throw new Error('user_id is required');
    }

    // Get Plaid configuration from environment
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

    // Create link token request body
    const linkTokenRequest = {
      client_id: plaidClientId,
      secret: plaidSecret,
      user: {
        client_user_id: `${workspace_id}_${user_id}`,
      },
      client_name: 'Clear Piggy',
      products: ['transactions'],
      country_codes: ['US'],
      language: 'en',
      webhook: Deno.env.get('PLAID_WEBHOOK_URL') || `${Deno.env.get('SUPABASE_URL')}/functions/v1/plaid-webhook`,
    };

    console.log('Creating link token for workspace:', workspace_id);
    
    // Make direct HTTP request to Plaid API
    const response = await fetch(`${plaidBaseUrl}/link/token/create`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(linkTokenRequest),
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error('Plaid API error:', errorData);
      throw new Error(errorData.error_message || 'Failed to create link token');
    }

    const data = await response.json();

    return new Response(
      JSON.stringify({ 
        link_token: data.link_token,
        expiration: data.expiration,
        request_id: data.request_id
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error) {
    console.error('Error creating link token:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    );
  }
});