const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://rnevebffhtplbixdmbgq.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJuZXZlYmZmaHRwbGJpeGRtYmdxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTY2NjI5ODQsImV4cCI6MjA3MjIzODk4NH0.VNnnzLLo2Pi5IxAy2-ZPVAbnbrIQLe9xi7tKcPnWOLw';

const supabase = createClient(supabaseUrl, supabaseKey);

async function fixWorkspace() {
  try {
    // Sign in
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email: 'new_user@example.com',  // Replace with your email
      password: 'TestPassword123!'     // Replace with your password
    });
    
    if (authError) {
      console.error('Auth error:', authError);
      return;
    }
    
    console.log('Signed in as:', authData.user.email);
    
    // Get user profile
    const { data: profile, error: profileError } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('auth_user_id', authData.user.id)
      .single();
    
    if (profileError) {
      console.error('Profile error:', profileError);
      return;
    }
    
    console.log('Profile found:', profile);
    console.log('Current workspace ID:', profile.current_workspace_id);
    
    if (!profile.current_workspace_id) {
      console.log('\n❌ PROBLEM: Profile has no workspace!');
      
      // Check if user has any workspaces
      const { data: memberships } = await supabase
        .from('workspace_members')
        .select('workspace_id')
        .eq('user_profile_id', profile.id);
      
      if (memberships && memberships.length > 0) {
        const workspaceId = memberships[0].workspace_id;
        console.log(`\n✅ Found workspace membership: ${workspaceId}`);
        
        // Update profile with workspace
        const { error: updateError } = await supabase
          .from('user_profiles')
          .update({ current_workspace_id: workspaceId })
          .eq('id', profile.id);
        
        if (updateError) {
          console.error('Update error:', updateError);
        } else {
          console.log('✅ Fixed! Profile now has workspace:', workspaceId);
        }
      } else {
        console.log('\n❌ No workspace memberships found!');
        console.log('Running setup_user_profile function...');
        
        // Call the setup function
        const { error: setupError } = await supabase.rpc('setup_user_profile');
        
        if (setupError) {
          console.error('Setup error:', setupError);
        } else {
          console.log('✅ Setup completed! Please refresh your dashboard.');
        }
      }
    } else {
      console.log('✅ Profile already has workspace:', profile.current_workspace_id);
      
      // Check if workspace exists
      const { data: workspace, error: wsError } = await supabase
        .from('workspaces')
        .select('*')
        .eq('id', profile.current_workspace_id)
        .single();
      
      if (wsError) {
        console.error('Workspace not found:', wsError);
      } else {
        console.log('✅ Workspace exists:', workspace.name);
      }
    }
    
  } catch (error) {
    console.error('Error:', error);
  }
}

fixWorkspace();