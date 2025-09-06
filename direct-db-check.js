const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://rnevebffhtplbixdmbgq.supabase.co';
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJuZXZlYmZmaHRwbGJpeGRtYmdxIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NjY2Mjk4NCwiZXhwIjoyMDcyMjM4OTg0fQ.o7uVe-HbplQSCqPMhY-jaONJMPU5fDm8W9AFkJrDKu0';

// Using service role key to bypass RLS
const supabase = createClient(supabaseUrl, supabaseServiceKey);

const workspaceId = '7c1de984-09f2-430f-9b29-2e1d392ce6e9';

async function checkDatabase() {
  console.log('🔍 Direct Database Check for Workspace:', workspaceId);
  console.log('=' .repeat(80));
  
  // Check institutions
  console.log('\n📊 INSTITUTIONS:');
  const { data: institutions, error: instError } = await supabase
    .from('institutions')
    .select('*')
    .eq('workspace_id', workspaceId);
  
  if (instError) {
    console.error('Error fetching institutions:', instError);
  } else {
    console.log('Count:', institutions?.length || 0);
    institutions?.forEach((inst, i) => {
      console.log(`\n${i + 1}. ${inst.name}`);
      console.log('   ID:', inst.id);
      console.log('   Plaid Institution ID:', inst.plaid_institution_id);
      console.log('   Plaid Item ID:', inst.plaid_item_id || 'NULL');
      console.log('   Has Token:', inst.plaid_access_token_encrypted ? 'YES' : 'NO');
      console.log('   Status:', inst.status);
    });
  }
  
  // Check bank accounts
  console.log('\n' + '='.repeat(80));
  console.log('\n📊 BANK ACCOUNTS:');
  const { data: accounts, error: accError } = await supabase
    .from('bank_accounts')
    .select('*')
    .eq('workspace_id', workspaceId);
  
  if (accError) {
    console.error('Error fetching accounts:', accError);
  } else {
    console.log('Count:', accounts?.length || 0);
    
    if (accounts && accounts.length > 0) {
      // Check for NULL institution_id
      const nullInstitutionAccounts = accounts.filter(acc => !acc.institution_id);
      if (nullInstitutionAccounts.length > 0) {
        console.log('\n⚠️  PROBLEM FOUND:', nullInstitutionAccounts.length, 'accounts have NULL institution_id!');
        console.log('   These accounts will NOT show in the UI!');
      }
      
      accounts.forEach((acc, i) => {
        console.log(`\n${i + 1}. ${acc.name} ${!acc.institution_id ? '⚠️ MISSING INSTITUTION!' : ''}`);
        console.log('   Account ID:', acc.id);
        console.log('   Institution ID:', acc.institution_id || '❌ NULL - THIS IS THE PROBLEM!');
        console.log('   Plaid Account ID:', acc.plaid_account_id);
        console.log('   Type:', acc.account_type);
        console.log('   Balance: $' + ((acc.current_balance_cents || 0) / 100).toFixed(2));
        console.log('   Active:', acc.is_active);
        console.log('   Created:', new Date(acc.created_at).toLocaleString());
      });
    } else {
      console.log('   No accounts found');
    }
  }
  
  // Check transactions
  console.log('\n' + '='.repeat(80));
  console.log('\n📊 TRANSACTIONS:');
  const { count: txCount } = await supabase
    .from('feed_transactions')
    .select('*', { count: 'exact', head: true })
    .eq('workspace_id', workspaceId);
  
  console.log('Count:', txCount || 0);
  
  // Summary
  console.log('\n' + '='.repeat(80));
  console.log('\n📋 SUMMARY:');
  
  const hasInstitutions = institutions && institutions.length > 0;
  const hasAccounts = accounts && accounts.length > 0;
  const hasNullInstitutions = accounts?.some(acc => !acc.institution_id);
  
  if (hasNullInstitutions) {
    console.log('❌ CRITICAL ISSUE: Some bank accounts have NULL institution_id');
    console.log('   This prevents them from showing in the UI.');
    console.log('   These were created before the Edge Function fix.');
    console.log('\n   TO FIX: Run this script with --clean flag to delete everything');
    console.log('   Then reconnect your bank in the app.');
  } else if (hasInstitutions && !hasAccounts) {
    console.log('⚠️  WARNING: Institution exists but no bank accounts');
    console.log('   The Edge Function may have failed after creating institution.');
    console.log('   Try cleaning and reconnecting.');
  } else if (hasAccounts && hasInstitutions) {
    console.log('✅ All accounts have valid institution_id');
    console.log('   Everything should work correctly.');
  } else {
    console.log('📭 No data found. Ready for fresh connection.');
  }
  
  // Clean option
  if (process.argv.includes('--clean')) {
    console.log('\n' + '='.repeat(80));
    console.log('\n🧹 CLEANING DATABASE...');
    
    // Delete transactions
    const { error: txDelError, count: txDelCount } = await supabase
      .from('feed_transactions')
      .delete()
      .eq('workspace_id', workspaceId);
    console.log('Deleted transactions:', txDelCount || 0, txDelError ? `(Error: ${txDelError.message})` : '');
    
    // Delete bank accounts
    const { error: accDelError, count: accDelCount } = await supabase
      .from('bank_accounts')
      .delete()
      .eq('workspace_id', workspaceId);
    console.log('Deleted bank accounts:', accDelCount || 0, accDelError ? `(Error: ${accDelError.message})` : '');
    
    // Delete institutions
    const { error: instDelError, count: instDelCount } = await supabase
      .from('institutions')
      .delete()
      .eq('workspace_id', workspaceId);
    console.log('Deleted institutions:', instDelCount || 0, instDelError ? `(Error: ${instDelError.message})` : '');
    
    console.log('\n✅ Cleanup complete! You can now reconnect in the app.');
  }
}

checkDatabase().catch(console.error);