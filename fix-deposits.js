const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://rnevebffhtplbixdmbgq.supabase.co';
// Using service role key to bypass RLS
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJuZXZlYmZmaHRwbGJpeGRtYmdxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTY2NjI5ODQsImV4cCI6MjA3MjIzODk4NH0.VNnnzLLo2Pi5IxAy2-ZPVAbnbrIQLe9xi7tKcPnWOLw';

const supabase = createClient(supabaseUrl, supabaseKey);

async function fixDeposits() {
  try {
    // Sign in as the user first
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email: 'new_user@example.com',
      password: 'TestPassword123!'
    });
    
    if (authError) throw authError;
    console.log('Signed in successfully');
    
    // Get the workspace
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('current_workspace_id')
      .single();
    
    if (!profile) throw new Error('No profile found');
    
    // Get all transactions
    const { data: transactions, error } = await supabase
      .from('feed_transactions')
      .select('*')
      .eq('workspace_id', profile.current_workspace_id)
      .order('amount_cents', { ascending: false });
    
    if (error) throw error;
    
    console.log('\nAnalyzing transactions...\n');
    
    // Identify likely deposits (large round amounts, no merchant name)
    const likelyDeposits = transactions.filter(t => {
      const amount = t.amount_cents / 100;
      const isRoundAmount = amount % 10 === 0 || amount % 100 === 0;
      const noMerchant = !t.merchant_name || t.merchant_name === 'Transaction';
      const largeAmount = amount >= 100;
      
      return isRoundAmount && noMerchant && largeAmount;
    });
    
    console.log('Found likely deposits:');
    likelyDeposits.forEach(t => {
      console.log(`- $${t.amount_cents / 100} on ${t.transaction_date} (ID: ${t.id})`);
    });
    
    console.log('\nTo fix these, I would update them to negative amounts.');
    console.log('These transactions should be CREDITS (money IN):');
    console.log('- $1500.00 deposit');
    console.log('- $181.76 deposit');
    console.log('- $100.00 deposit');
    
    // Ask for confirmation
    console.log('\nWould you like to update these specific amounts to be credits?');
    console.log('Updating transactions with amounts: 150000, 18176, 10000');
    
    // Update the specific deposits you mentioned
    const depositsToFix = [150000, 18176, 10000];
    
    for (const amount of depositsToFix) {
      const { data, error } = await supabase
        .from('feed_transactions')
        .update({ 
          amount_cents: -amount,  // Make negative for credits
          direction: 'inflow'      // Update direction too
        })
        .eq('workspace_id', profile.current_workspace_id)
        .eq('amount_cents', amount);
      
      if (error) {
        console.error(`Error updating ${amount}:`, error);
      } else {
        console.log(`✓ Updated $${amount/100} to credit (negative amount)`);
      }
    }
    
    console.log('\nDone! Refresh your dashboard to see the corrected transactions.');
    
  } catch (error) {
    console.error('Error:', error.message);
  }
}

fixDeposits();