import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { user_id, workspace_id, required_permission } = await req.json()

    // Validate required parameters
    if (!user_id || !workspace_id) {
      return new Response(
        JSON.stringify({
          has_access: false,
          error: 'Missing required parameters: user_id and workspace_id'
        }),
        { 
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    // Create Supabase client with service role key
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    )

    // First check if user is the workspace owner
    const { data: workspace, error: workspaceError } = await supabase
      .from('workspaces')
      .select('id, name, owner_id')
      .eq('id', workspace_id)
      .single()

    if (workspaceError || !workspace) {
      return new Response(
        JSON.stringify({
          has_access: false,
          error: 'Workspace not found'
        }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    // Get user profile to check ownership
    const { data: profile, error: profileError } = await supabase
      .from('user_profiles')
      .select('id, auth_user_id')
      .eq('auth_user_id', user_id)
      .single()

    if (profileError || !profile) {
      return new Response(
        JSON.stringify({
          has_access: false,
          error: 'User profile not found'
        }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    // Check if user is owner
    if (workspace.owner_id === profile.id) {
      return new Response(
        JSON.stringify({
          has_access: true,
          user_role: 'owner',
          workspace_name: workspace.name,
          workspace_id: workspace.id
        }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    // Check if user is a member
    const { data: membership, error: memberError } = await supabase
      .from('workspace_members')
      .select('role, permissions')
      .eq('user_id', profile.id)
      .eq('workspace_id', workspace_id)
      .is('deleted_at', null)
      .single()

    if (memberError || !membership) {
      return new Response(
        JSON.stringify({
          has_access: false,
          error: 'User not found in workspace'
        }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    // Check specific permission if required
    let hasPermission = true
    if (required_permission) {
      // Check if user has the required permission
      // For now, we'll allow all permissions for members
      // You can implement more granular permission checking here
      hasPermission = membership.role === 'admin' || membership.role === 'member'
    }

    return new Response(
      JSON.stringify({
        has_access: hasPermission,
        user_role: membership.role,
        workspace_name: workspace.name,
        workspace_id: workspace.id,
        permissions: membership.permissions
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )

  } catch (error) {
    console.error('Error in validate-workspace-access:', error)
    return new Response(
      JSON.stringify({ 
        has_access: false, 
        error: error.message 
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  }
})