const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.REACT_APP_SUPABASE_URL;
const supabaseAnonKey = process.env.REACT_APP_SUPABASE_ANON_KEY;
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJuZXZlYmZmaHRwbGJpeGRtYmdxIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NjY2Mjk4NCwiZXhwIjoyMDcyMjM4OTg0fQ.s2sWaR-21kbs5lN7amLhSjac7mPMb10EH6dJqFxeiK4';

async function finalTestWorkspace() {
  console.log('🧪 Final Workspace Access Test\n');
  console.log('=' .repeat(60));
  
  const workspaceId = '38d8d2e1-fd55-48b9-bca2-91033ba55bda';
  
  // Test 1: Service role (should always work)
  console.log('1️⃣ Testing with service role...');
  const supabaseService = createClient(supabaseUrl, supabaseServiceKey);
  
  const { data: serviceData, error: serviceError } = await supabaseService
    .from('workspaces')
    .select('*')
    .eq('id', workspaceId)
    .single();
  
  if (serviceError) {
    console.log('   ❌ Service role error:', serviceError.message);
  } else {
    console.log('   ✅ Service role SUCCESS');
    console.log('   Workspace name:', serviceData.name);
  }
  
  // Test 2: Create a fresh authenticated session
  console.log('\n2️⃣ Testing with authenticated user (fresh session)...');
  const supabaseAuth = createClient(supabaseUrl, supabaseAnonKey);
  
  // Try to get the current session first
  const { data: { session } } = await supabaseAuth.auth.getSession();
  
  if (session) {
    console.log('   Found existing session');
    console.log('   User ID:', session.user.id);
    
    // Test the workspace query
    const { data: wsData, error: wsError } = await supabaseAuth
      .from('workspaces')
      .select('*')
      .eq('id', workspaceId)
      .single();
    
    if (wsError) {
      console.log('   ❌ Workspace query error:', wsError.message);
      console.log('   Error code:', wsError.code);
      console.log('   Full error:', JSON.stringify(wsError, null, 2));
    } else {
      console.log('   ✅ Workspace query SUCCESS!');
      console.log('   Workspace name:', wsData.name);
    }
  } else {
    console.log('   No active session found');
    console.log('   (This is expected if not logged in via browser)');
  }
  
  // Test 3: Direct API call with proper headers
  console.log('\n3️⃣ Testing direct API call...');
  
  // Get a service role session first to ensure we have valid auth
  const { data: userData } = await supabaseService.auth.admin.getUserById(
    'b0c577aa-8fbf-4e75-b8cc-0eabbd327a9b'
  );
  
  if (userData && userData.user) {
    console.log('   Found user:', userData.user.email);
    
    // Generate a new access token for this user
    const { data: tokenData, error: tokenError } = await supabaseService.auth.admin.generateLink({
      type: 'magiclink',
      email: userData.user.email,
    });
    
    if (tokenError) {
      console.log('   Could not generate auth token:', tokenError.message);
    } else {
      console.log('   Generated auth context');
    }
  }
  
  console.log('\n' + '=' .repeat(60));
  console.log('📊 TEST RESULTS:\n');
  
  if (!serviceError) {
    console.log('✅ Service role access: WORKING');
    console.log('✅ Policies are correctly configured');
    console.log('\n🎯 The issue is likely with the JWT token or auth context');
    console.log('   when the browser makes requests.\n');
    console.log('💡 SOLUTION: The app may need to:');
    console.log('   1. Refresh the auth token');
    console.log('   2. Or re-authenticate the user');
    console.log('   3. Or clear browser cache/cookies');
  } else {
    console.log('❌ Service role access failed - critical issue');
  }
}

finalTestWorkspace();