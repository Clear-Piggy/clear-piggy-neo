const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://rnevebffhtplbixdmbgq.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJuZXZlYmZmaHRwbGJpeGRtYmdxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTY2NjI5ODQsImV4cCI6MjA3MjIzODk4NH0.VNnnzLLo2Pi5IxAy2-ZPVAbnbrIQLe9xi7tKcPnWOLw';

const supabase = createClient(supabaseUrl, supabaseKey);

async function debugBankAccounts() {
  try {
    console.log('🔍 Debugging bank account creation...\n');
    
    // Sign in
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email: 'new_user@example.com',
      password: 'TestPassword123!'
    });
    
    if (authError) {
      console.error('❌ Auth error:', authError);
      return;
    }
    
    console.log('✅ Signed in as:', authData.user.email);
    
    // Get user profile and workspace
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('auth_user_id', authData.user.id)
      .single();
      
    console.log('👤 Profile:', {
      id: profile?.id,
      current_workspace_id: profile?.current_workspace_id,
      default_workspace_id: profile?.default_workspace_id
    });
    
    const workspaceId = profile?.current_workspace_id || profile?.default_workspace_id;
    
    if (!workspaceId) {
      console.log('❌ No workspace ID found!');
      return;
    }
    
    // Check ALL bank accounts in workspace
    const { data: allAccounts, error: accountsError } = await supabase
      .from('bank_accounts')
      .select('*')
      .eq('workspace_id', workspaceId);
    
    console.log('\n🏦 Bank accounts in workspace:', workspaceId);
    console.log('Total accounts found:', allAccounts?.length || 0);
    
    if (allAccounts && allAccounts.length > 0) {
      allAccounts.forEach((acc, i) => {
        console.log(`\n${i + 1}. ${acc.name} (${acc.institution_name})`);
        console.log(`   ID: ${acc.id}`);
        console.log(`   Active: ${acc.is_active}`);
        console.log(`   Balance: $${(acc.current_balance_cents || 0) / 100}`);
        console.log(`   Created: ${new Date(acc.created_at).toLocaleString()}`);
      });
    } else {
      console.log('🔍 No bank accounts found. This could be why they\'re not showing in the UI.');
    }
    
    // Check institutions
    const { data: institutions } = await supabase
      .from('institutions')
      .select('*')
      .eq('workspace_id', workspaceId);
    
    console.log('\n🏛️ Institutions in workspace:', institutions?.length || 0);
    institutions?.forEach((inst, i) => {
      console.log(`${i + 1}. ${inst.name} - Plaid ID: ${inst.plaid_institution_id}`);
    });
    
    // Check recent transactions
    const { data: transactions } = await supabase
      .from('feed_transactions')
      .select('*')
      .eq('workspace_id', workspaceId)
      .order('created_at', { ascending: false })
      .limit(5);
    
    console.log('\n💳 Recent transactions:', transactions?.length || 0);
    transactions?.forEach((tx, i) => {
      console.log(`${i + 1}. ${tx.merchant_name || 'Unknown'} - $${Math.abs(tx.amount_cents / 100)}`);
    });
    
  } catch (error) {
    console.error('💥 Debug error:', error);
  }
}

debugBankAccounts();