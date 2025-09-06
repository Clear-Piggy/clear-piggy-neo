const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.REACT_APP_SUPABASE_URL;
const supabaseAnonKey = process.env.REACT_APP_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Missing environment variables. Check .env.local file.');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function validateAIInsightsData(workspaceId) {
  console.log(`🔍 Validating AI insights data for workspace: ${workspaceId}\n`);

  try {
    // Check transaction data completeness
    console.log('📊 Analyzing transaction data quality...');
    
    const { data: transactions, error: transactionError } = await supabase
      .from('feed_transactions')
      .select(`
        id,
        workspace_id,
        transaction_date,
        amount_cents,
        direction,
        merchant_name,
        merchant_normalized,
        personal_finance_category_primary,
        personal_finance_category_detailed,
        location_city,
        location_region,
        payment_method,
        description,
        bank_account_id,
        account_name,
        merchant_logo_url
      `)
      .eq('workspace_id', workspaceId)
      .order('transaction_date', { ascending: false })
      .limit(100);

    if (transactionError) {
      console.error('❌ Error fetching transactions:', transactionError.message);
      return;
    }

    if (!transactions || transactions.length === 0) {
      console.log('⚠️  No transactions found for this workspace');
      return;
    }

    console.log(`✅ Found ${transactions.length} transactions`);

    // Analyze data quality
    const dataQuality = {
      total_transactions: transactions.length,
      with_categories: transactions.filter(t => t.personal_finance_category_primary).length,
      with_merchants: transactions.filter(t => t.merchant_name).length,
      with_locations: transactions.filter(t => t.location_city).length,
      with_normalized_merchants: transactions.filter(t => t.merchant_normalized).length,
      inflow_count: transactions.filter(t => t.direction === 'inflow').length,
      outflow_count: transactions.filter(t => t.direction === 'outflow').length,
      zero_amounts: transactions.filter(t => t.amount_cents === 0).length,
    };

    console.log('\n📈 Data Quality Analysis:');
    console.log(`  Total Transactions: ${dataQuality.total_transactions}`);
    console.log(`  With Categories: ${dataQuality.with_categories} (${Math.round((dataQuality.with_categories / dataQuality.total_transactions) * 100)}%)`);
    console.log(`  With Merchants: ${dataQuality.with_merchants} (${Math.round((dataQuality.with_merchants / dataQuality.total_transactions) * 100)}%)`);
    console.log(`  With Locations: ${dataQuality.with_locations} (${Math.round((dataQuality.with_locations / dataQuality.total_transactions) * 100)}%)`);
    console.log(`  With Normalized Merchants: ${dataQuality.with_normalized_merchants} (${Math.round((dataQuality.with_normalized_merchants / dataQuality.total_transactions) * 100)}%)`);
    console.log(`  Inflow Transactions: ${dataQuality.inflow_count}`);
    console.log(`  Outflow Transactions: ${dataQuality.outflow_count}`);
    console.log(`  Zero Amount Issues: ${dataQuality.zero_amounts}`);

    // Date range analysis
    const dates = transactions.map(t => new Date(t.transaction_date)).sort((a, b) => a - b);
    const earliestDate = dates[0];
    const latestDate = dates[dates.length - 1];
    const dateRange = Math.round((latestDate - earliestDate) / (1000 * 60 * 60 * 24));

    console.log(`\n📅 Date Range Analysis:`);
    console.log(`  Earliest Transaction: ${earliestDate.toDateString()}`);
    console.log(`  Latest Transaction: ${latestDate.toDateString()}`);
    console.log(`  Date Range: ${dateRange} days`);

    // Category distribution
    const categories = {};
    transactions.forEach(t => {
      if (t.personal_finance_category_primary) {
        categories[t.personal_finance_category_primary] = (categories[t.personal_finance_category_primary] || 0) + 1;
      }
    });

    console.log(`\n🏷️  Top Categories:`);
    Object.entries(categories)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 5)
      .forEach(([category, count]) => {
        console.log(`  ${category}: ${count} transactions (${Math.round((count / dataQuality.total_transactions) * 100)}%)`);
      });

    // Merchant distribution
    const merchants = {};
    transactions.forEach(t => {
      if (t.merchant_name) {
        merchants[t.merchant_name] = (merchants[t.merchant_name] || 0) + 1;
      }
    });

    console.log(`\n🏪 Top Merchants:`);
    Object.entries(merchants)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 5)
      .forEach(([merchant, count]) => {
        console.log(`  ${merchant}: ${count} transactions`);
      });

    // Amount analysis
    const amounts = transactions.map(t => Math.abs(t.amount_cents));
    const totalAmount = amounts.reduce((sum, amount) => sum + amount, 0);
    const avgAmount = totalAmount / amounts.length;
    const maxAmount = Math.max(...amounts);
    const minAmount = Math.min(...amounts);

    console.log(`\n💰 Amount Analysis:`);
    console.log(`  Average Transaction: $${(avgAmount / 100).toFixed(2)}`);
    console.log(`  Largest Transaction: $${(maxAmount / 100).toFixed(2)}`);
    console.log(`  Smallest Transaction: $${(minAmount / 100).toFixed(2)}`);
    console.log(`  Total Volume: $${(totalAmount / 100).toFixed(2)}`);

    // AI Readiness Assessment
    console.log(`\n🤖 AI Analysis Readiness:`);
    
    const readinessScore = Math.round(
      (dataQuality.with_categories / dataQuality.total_transactions * 30) +
      (dataQuality.with_merchants / dataQuality.total_transactions * 25) +
      (dataQuality.with_locations / dataQuality.total_transactions * 15) +
      (Math.min(dateRange / 90, 1) * 20) +
      (Math.min(dataQuality.total_transactions / 50, 1) * 10)
    );

    console.log(`  Readiness Score: ${readinessScore}/100`);
    
    if (readinessScore >= 80) {
      console.log('  ✅ EXCELLENT - Ready for comprehensive AI analysis');
    } else if (readinessScore >= 60) {
      console.log('  👍 GOOD - Ready for AI analysis with some limitations');
    } else if (readinessScore >= 40) {
      console.log('  ⚠️  FAIR - Basic AI analysis possible, more data recommended');
    } else {
      console.log('  ❌ POOR - Insufficient data for meaningful AI analysis');
    }

    // Recommendations
    console.log(`\n💡 Recommendations:`);
    if (dataQuality.with_categories / dataQuality.total_transactions < 0.8) {
      console.log('  • Improve transaction categorization for better insights');
    }
    if (dataQuality.total_transactions < 30) {
      console.log('  • Sync more accounts or wait for more transactions (need 30+ for AI analysis)');
    }
    if (dateRange < 30) {
      console.log('  • Need at least 30 days of data for trend analysis');
    }
    if (dataQuality.zero_amounts > 0) {
      console.log('  • Fix zero-amount transactions in database');
    }

  } catch (error) {
    console.error('❌ Validation failed:', error.message);
  }
}

// Example usage - replace with actual workspace ID
const exampleWorkspaceId = 'your-workspace-id-here';

if (process.argv[2]) {
  validateAIInsightsData(process.argv[2]);
} else {
  console.log('Usage: node validate-ai-data.js <workspace-id>');
  console.log('Example: node validate-ai-data.js 123e4567-e89b-12d3-a456-426614174000');
}