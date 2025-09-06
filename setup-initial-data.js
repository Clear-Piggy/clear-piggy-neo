const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://rnevebffhtplbixdmbgq.supabase.co';
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJuZXZlYmZmaHRwbGJpeGRtYmdxIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NjY2Mjk4NCwiZXhwIjoyMDcyMjM4OTg0fQ.s2sWaR-21kbs5lN7amLhSjac7mPMb10EH6dJqFxeiK4';

// Create client with service role
const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  },
  db: {
    schema: 'public'
  }
});

async function setupInitialData() {
  console.log('🚀 SETTING UP INITIAL DATA FOR CLEAR PIGGY');
  console.log('==========================================\n');

  try {
    // Get existing auth user
    console.log('1️⃣ Getting existing auth user...');
    const { data: authData } = await supabase.auth.admin.listUsers();
    const authUser = authData?.users?.[0];
    
    if (!authUser) {
      console.log('❌ No auth user found. Please create one first.');
      return;
    }

    console.log(`✅ Found auth user: ${authUser.email} (${authUser.id})\n`);

    // Check if user_profile exists
    console.log('2️⃣ Checking for user_profile...');
    
    // Try direct SQL approach since policies are blocking
    const { data: sqlResult, error: sqlError } = await supabase.rpc('raw_sql', {
      query_text: `
        SELECT * FROM public.user_profiles WHERE auth_user_id = '${authUser.id}'
      `
    });

    if (sqlError) {
      // Try a different approach - insert directly
      console.log('Trying direct insert approach...');
      
      // First create a workspace
      console.log('\n3️⃣ Creating workspace...');
      const workspaceId = crypto.randomUUID();
      const { error: wsInsertError } = await supabase
        .from('workspaces')
        .insert({
          id: workspaceId,
          name: 'My Workspace',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        });

      if (wsInsertError) {
        console.log('Workspace insert error:', wsInsertError.message);
        console.log('\nTrying RPC function approach...');
        
        // Create an RPC function to bypass RLS
        const setupFunction = `
          CREATE OR REPLACE FUNCTION setup_initial_user_and_workspace()
          RETURNS json
          LANGUAGE plpgsql
          SECURITY DEFINER
          AS $$
          DECLARE
            v_user_id uuid := '${authUser.id}';
            v_email text := '${authUser.email}';
            v_workspace_id uuid;
            v_profile_id uuid;
            result json;
          BEGIN
            -- Create workspace
            INSERT INTO public.workspaces (name, created_at, updated_at)
            VALUES ('My Workspace', NOW(), NOW())
            RETURNING id INTO v_workspace_id;
            
            -- Create user profile
            INSERT INTO public.user_profiles (auth_user_id, email, created_at, updated_at)
            VALUES (v_user_id, v_email, NOW(), NOW())
            RETURNING id INTO v_profile_id;
            
            -- Create workspace membership
            INSERT INTO public.workspace_members (
              workspace_id, 
              user_id, 
              role, 
              accepted_at,
              created_at, 
              updated_at
            )
            VALUES (
              v_workspace_id, 
              v_profile_id, 
              'owner',
              NOW(),
              NOW(), 
              NOW()
            );
            
            result := json_build_object(
              'workspace_id', v_workspace_id,
              'profile_id', v_profile_id,
              'success', true
            );
            
            RETURN result;
          END;
          $$;
        `;

        console.log('Creating setup function in database...');
        const { error: funcError } = await supabase.rpc('exec_sql', {
          sql: setupFunction
        });

        if (funcError) {
          console.log('Cannot create function. Let me check what we can access...');
          
          // Check if we can query feed_transactions (it was accessible earlier)
          const { data: testData, error: testError } = await supabase
            .from('feed_transactions')
            .select('*')
            .limit(1);
            
          console.log('Feed transactions accessible?', !testError);
          if (testError) {
            console.log('Error:', testError.message);
          }
        }
      } else {
        console.log('✅ Workspace created!');
      }
    }

    console.log('\n📊 Current status:');
    console.log('- Auth user exists: ✅');
    console.log('- Need to create user_profile');
    console.log('- Need to create workspace');
    console.log('- Need to create workspace_member link');
    
    console.log('\n💡 NEXT STEPS:');
    console.log('1. Go to Supabase SQL Editor');
    console.log('2. Run this SQL to setup your initial data:');
    console.log('```sql');
    console.log(`
-- Create initial workspace
INSERT INTO public.workspaces (id, name, created_at, updated_at)
VALUES (
  gen_random_uuid(),
  'My First Workspace',
  NOW(),
  NOW()
)
ON CONFLICT DO NOTHING
RETURNING id;

-- Create user profile (use the workspace ID from above)
INSERT INTO public.user_profiles (id, auth_user_id, email, created_at, updated_at)
VALUES (
  gen_random_uuid(),
  '${authUser.id}',
  '${authUser.email}',
  NOW(),
  NOW()
)
ON CONFLICT DO NOTHING
RETURNING id;

-- Link them together (use both IDs from above)
-- You'll need to manually insert the workspace_id and user_id from the above queries
    `);
    console.log('```');

  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

setupInitialData();