// REPLACE THE RPC CALL IN workspace-sync-transactions/index.ts 
// Around line 227-243, replace the upsert_transaction call with this:

// Upsert transaction using enriched RPC with all Plaid data
const { data: txResult, error: txError } = await supabaseClient
  .rpc('upsert_transaction_enriched', {
    // Core required fields
    p_workspace_id: workspace_id,
    p_bank_account_id: bankAccountId,
    p_plaid_transaction_id: tx.transaction_id,
    p_provider_unique_id: tx.transaction_id,
    p_content_hash: btoa(`${tx.transaction_id}_${workspace_id}_${tx.date}`),
    p_amount_cents: Math.round(Math.abs(tx.amount * 100)),
    p_direction: tx.amount > 0 ? 'outflow' : 'inflow',
    p_currency_code: tx.iso_currency_code || 'USD',
    p_transaction_date: tx.date,
    p_description: tx.name,
    p_status: tx.pending ? 'pending' : 'posted',
    p_created_by: institution.created_by || institution.updated_by || workspaceOwnerId,
    
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

// Also need to add workspaceOwnerId variable at the top of the function (around line 148):
// Get workspace owner for fallback created_by
const { data: workspace, error: wsError } = await supabaseClient
  .from('workspaces')
  .select('owner_id')
  .eq('id', workspace_id)
  .single();

const workspaceOwnerId = workspace?.owner_id || null;
console.log('Workspace owner ID for fallback:', workspaceOwnerId);