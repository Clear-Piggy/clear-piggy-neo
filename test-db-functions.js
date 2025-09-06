const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://rnevebffhtplbixdmbgq.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJuZXZlYmZmaHRwbGJpeGRtYmdxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTY2NjI5ODQsImV4cCI6MjA3MjIzODk4NH0.VNnnzLLo2Pi5IxAy2-ZPVAbnbrIQLe9xi7tKcPnWOLw';

const supabase = createClient(supabaseUrl, supabaseKey);

async function testDatabaseFunctions() {
  try {
    console.log('🧪 Testing database functions...\n');
    
    // Sign in
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email: 'test123@gmail.com',
      password: 'TestPass123!'
    });
    
    if (authError) {
      console.error('❌ Auth error:', authError);
      return;
    }
    
    console.log('✅ Signed in as:', authData.user.email);
    
    // Get user profile
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('auth_user_id', authData.user.id)
      .single();
      
    const workspaceId = profile?.current_workspace_id || profile?.default_workspace_id;
    console.log('📊 Workspace ID:', workspaceId);
    
    // Get existing institution
    const { data: institutions } = await supabase
      .from('institutions')
      .select('*')
      .eq('workspace_id', workspaceId);
    
    console.log('\n🏛️ Existing institutions:', institutions?.length || 0);
    
    if (institutions && institutions.length > 0) {
      const inst = institutions[0];
      console.log('Using institution:', inst.name, inst.id);
      
      // Test creating a bank account via RPC function
      console.log('\n🧪 Testing upsert_bank_account function...');
      
      const { data: accountResult, error: accountError } = await supabase.rpc('upsert_bank_account', {
        p_workspace_id: workspaceId,
        p_institution_id: inst.id,
        p_plaid_account_id: 'test_account_' + Date.now(),
        p_name: 'Test Account Created Via Function',
        p_account_type: 'checking',
        p_account_subtype_detailed: 'checking',
        p_mask: '9999',
        p_current_balance_cents: 100000, // $1000
        p_available_balance_cents: 100000,
        p_currency_code: 'USD',
        p_user_id: profile.id
      });
      
      if (accountError) {
        console.error('❌ Error calling upsert_bank_account:', accountError);
      } else {
        console.log('✅ Account created successfully!');
        console.log('Result:', accountResult);
        
        // Verify it was created
        const { data: newAccounts } = await supabase
          .from('bank_accounts')
          .select('*')
          .eq('workspace_id', workspaceId);
        
        console.log('\n📊 Total accounts after test:', newAccounts?.length || 0);
        newAccounts?.forEach((acc, i) => {
          console.log(`${i + 1}. ${acc.name}`);
          console.log(`   ID: ${acc.id}`);
          console.log(`   Institution ID: ${acc.institution_id}`);
          console.log(`   Balance: $${(acc.current_balance_cents || 0) / 100}`);
        });
      }
    } else {
      console.log('❌ No institutions found. Connect a bank account first.');
    }
    
  } catch (error) {
    console.error('💥 Error:', error);
  }
}

testDatabaseFunctions();