const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.REACT_APP_SUPABASE_URL;
const supabaseAnonKey = process.env.REACT_APP_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Missing environment variables. Check .env.local for:');
  console.error('- REACT_APP_SUPABASE_URL');
  console.error('- REACT_APP_SUPABASE_ANON_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function validateSchema() {
  console.log('🔍 Validating Clear Piggy schema for AI Analytics...\n');

  try {
    // Check if feed_transactions table exists by querying it directly
    console.log('📊 Checking feed_transactions table...');
    const { data: sampleTransaction, error: feedError } = await supabase
      .from('feed_transactions')
      .select('*')
      .limit(1);

    if (feedError) {
      console.error('❌ Error checking feed_transactions:', feedError.message);
    } else if (!sampleTransaction || sampleTransaction.length === 0) {
      console.log('⚠️  feed_transactions table exists but has no data');
    } else {
      console.log('✅ feed_transactions table found with data');
      console.log('Available fields:', Object.keys(sampleTransaction[0]));
    }

    // Check key fields mentioned in the prompts
    console.log('\n🎯 Validating key fields for AI analysis...');
    const requiredFields = [
      'amount_cents',
      'direction', 
      'transaction_date',
      'merchant_name',
      'merchant_normalized',
      'personal_finance_category_primary',
      'personal_finance_category_detailed',
      'location_city',
      'location_region',
      'payment_method',
      'description',
      'bank_account_id',
      'workspace_id'
    ];

    const availableFields = sampleTransaction && sampleTransaction.length > 0 
      ? Object.keys(sampleTransaction[0]) 
      : [];
    
    requiredFields.forEach(field => {
      if (availableFields.includes(field)) {
        console.log(`   ✅ ${field}`);
      } else {
        console.log(`   ❌ ${field} - MISSING`);
      }
    });

    // Display sample transaction data
    if (sampleTransaction && sampleTransaction.length > 0) {
      console.log('\n📈 Sample transaction structure:');
      console.log(JSON.stringify(sampleTransaction[0], null, 2));
    }

    // Check other required tables
    console.log('\n🏗️ Checking supporting tables...');
    const supportingTables = ['workspaces', 'bank_accounts', 'categories', 'budgets', 'budget_lines'];
    
    for (const table of supportingTables) {
      try {
        const { data, error } = await supabase
          .from(table)
          .select('*')
          .limit(1);
        
        if (error) {
          console.log(`   ❌ ${table} - Error: ${error.message}`);
        } else {
          console.log(`   ✅ ${table} - Available`);
        }
      } catch (err) {
        console.log(`   ❌ ${table} - Error: ${err.message}`);
      }
    }

  } catch (error) {
    console.error('❌ Schema validation failed:', error.message);
  }
}

validateSchema();