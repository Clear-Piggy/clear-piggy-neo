const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://rnevebffhtplbixdmbgq.supabase.co';
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJuZXZlYmZmaHRwbGJpeGRtYmdxIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NjY2Mjk4NCwiZXhwIjoyMDcyMjM4OTg0fQ.s2sWaR-21kbs5lN7amLhSjac7mPMb10EH6dJqFxeiK4';

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function syncAuthUser() {
  console.log('🔄 Syncing auth user to public tables...\n');

  try {
    // Get the auth user
    const { data: authUsers } = await supabase.auth.admin.listUsers();
    const authUser = authUsers.users[0];
    
    if (!authUser) {
      console.log('❌ No auth user found');
      return;
    }

    console.log('Found auth user:');
    console.log(`  Email: ${authUser.email}`);
    console.log(`  ID: ${authUser.id}\n`);

    // First create a household/workspace
    console.log('1️⃣ Creating household/workspace...');
    const { data: household, error: householdError } = await supabase
      .from('households')
      .insert({
        name: 'Test Household',
        created_at: new Date().toISOString()
      })
      .select()
      .single();

    if (householdError) {
      console.log('❌ Error creating household:', householdError.message);
      return;
    }

    console.log('✅ Household created:', household.id);

    // Now create the user in public.users
    console.log('\n2️⃣ Creating user in public.users...');
    const { data: publicUser, error: userError } = await supabase
      .from('users')
      .insert({
        id: authUser.id,
        email: authUser.email,
        household_id: household.id,
        created_at: authUser.created_at
      })
      .select()
      .single();

    if (userError) {
      console.log('❌ Error creating public user:', userError.message);
      
      // Try to update if user exists
      const { data: existingUser } = await supabase
        .from('users')
        .select('*')
        .eq('id', authUser.id)
        .single();
        
      if (existingUser) {
        console.log('User already exists in public.users');
        console.log('Existing user data:', existingUser);
      }
      return;
    }

    console.log('✅ User created in public.users');
    console.log(`   ID: ${publicUser.id}`);
    console.log(`   Household: ${publicUser.household_id}`);

    console.log('\n✅ SUCCESS! User is now synced and should appear in UI');
    console.log('\n📱 To see in UI:');
    console.log('1. Open your app in the browser');
    console.log('2. Log in with: test123@gmail.com');
    console.log('3. You should now see the user dashboard');

  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

syncAuthUser();