const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://rnevebffhtplbixdmbgq.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJuZXZlYmZmaHRwbGJpeGRtYmdxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTY2NjI5ODQsImV4cCI6MjA3MjIzODk4NH0.VNnnzLLo2Pi5IxAy2-ZPVAbnbrIQLe9xi7tKcPnWOLw';

const supabase = createClient(supabaseUrl, supabaseKey);
const workspaceId = '7c1de984-09f2-430f-9b29-2e1d392ce6e9';

async function checkData() {
  console.log('🔍 Checking workspace:', workspaceId);
  console.log('=' .repeat(60));
  
  // First sign in with your test account
  const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
    email: 'test123@test.com',
    password: 'test123456'
  });
  
  if (authError) {
    console.error('Auth failed. Trying without auth...');
    // Continue anyway - maybe RLS allows some access
  } else {
    console.log('✅ Authenticated as:', authData.user.email);
  }
  
  // Check institutions
  console.log('\n📊 CHECKING INSTITUTIONS:');
  const { data: institutions, error: instError } = await supabase
    .from('institutions')
    .select('id, workspace_id, name, plaid_institution_id, plaid_item_id, plaid_access_token_encrypted, status')
    .eq('workspace_id', workspaceId);
  
  if (instError) {
    console.error('Error:', instError.message);
  } else {
    console.log('Found:', institutions?.length || 0, 'institutions');
    institutions?.forEach((inst, i) => {
      console.log(`  ${i + 1}. ${inst.name}`);
      console.log(`     ID: ${inst.id}`);
      console.log(`     Has Token: ${inst.plaid_access_token_encrypted ? 'YES' : 'NO'}`);
    });
  }
  
  // Check bank accounts
  console.log('\n📊 CHECKING BANK ACCOUNTS:');
  const { data: accounts, error: accError } = await supabase
    .from('bank_accounts')
    .select('id, workspace_id, institution_id, name, plaid_account_id, current_balance_cents, is_active')
    .eq('workspace_id', workspaceId);
  
  if (accError) {
    console.error('Error:', accError.message);
  } else {
    console.log('Found:', accounts?.length || 0, 'accounts');
    
    // Check for orphaned accounts
    const orphaned = accounts?.filter(a => !a.institution_id) || [];
    if (orphaned.length > 0) {
      console.log('\n⚠️  PROBLEM: ' + orphaned.length + ' accounts have NULL institution_id!');
      console.log('These accounts will NOT show in the UI!');
    }
    
    accounts?.forEach((acc, i) => {
      console.log(`  ${i + 1}. ${acc.name} ${!acc.institution_id ? '❌ NO INSTITUTION!' : ''}`);
      console.log(`     ID: ${acc.id}`);
      console.log(`     Institution: ${acc.institution_id || 'NULL - PROBLEM!'}`);
      console.log(`     Balance: $${(acc.current_balance_cents || 0) / 100}`);
    });
  }
  
  // Check transactions
  console.log('\n📊 CHECKING TRANSACTIONS:');
  const { count: txCount } = await supabase
    .from('feed_transactions')
    .select('*', { count: 'exact', head: true })
    .eq('workspace_id', workspaceId);
  console.log('Found:', txCount || 0, 'transactions');
  
  // Cleanup if requested
  if (process.argv.includes('--clean')) {
    console.log('\n' + '='.repeat(60));
    console.log('🧹 CLEANING ALL DATA...');
    
    // Delete in order due to foreign keys
    const { count: txDel } = await supabase
      .from('feed_transactions')
      .delete()
      .eq('workspace_id', workspaceId);
    console.log('Deleted', txDel || 0, 'transactions');
    
    const { count: accDel } = await supabase
      .from('bank_accounts')
      .delete()
      .eq('workspace_id', workspaceId);
    console.log('Deleted', accDel || 0, 'bank accounts');
    
    const { count: instDel } = await supabase
      .from('institutions')
      .delete()
      .eq('workspace_id', workspaceId);
    console.log('Deleted', instDel || 0, 'institutions');
    
    console.log('\n✅ Cleanup complete! Reconnect in the app.');
  } else {
    console.log('\n' + '='.repeat(60));
    console.log('To clean all data, run: node simple-db-check.js --clean');
  }
}

checkData().catch(console.error);