const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://rnevebffhtplbixdmbgq.supabase.co';
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJuZXZlYmZmaHRwbGJpeGRtYmdxIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NjY2Mjk4NCwiZXhwIjoyMDcyMjM4OTg0fQ.s2sWaR-21kbs5lN7amLhSjac7mPMb10EH6dJqFxeiK4';

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function deleteTestUser() {
  console.log('🗑️  DELETING TEST USER FROM AUTH...\n');

  try {
    // Delete the auth user
    const { data, error } = await supabase.auth.admin.deleteUser(
      '20391298-7ece-477e-bb3a-0549407cf78c'
    );

    if (error) {
      console.error('❌ Error deleting auth user:', error.message);
      return;
    }

    console.log('✅ Auth user deleted successfully!');
    
    // Verify deletion
    console.log('\n📋 Verifying deletion...');
    const { data: users } = await supabase.auth.admin.listUsers();
    
    const testUser = users.users.find(u => u.email === 'test123@gmail.com');
    if (testUser) {
      console.log('⚠️  User still exists in auth!');
    } else {
      console.log('✅ User completely removed from auth.users');
    }

    console.log('\n🎉 COMPLETE! Database is now clean.');
    console.log('You can now test a fresh signup with test123@gmail.com or any other email.');

  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

deleteTestUser();