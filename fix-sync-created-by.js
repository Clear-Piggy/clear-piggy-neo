// In workspace-sync-transactions/index.ts, update line 290 (in the RPC call)

// CHANGE THIS:
p_created_by: institution.created_by || null

// TO THIS:
p_created_by: institution.created_by || institution.updated_by || workspace_owner_id

// BUT we need to get the workspace owner first, so add this before the institution loop (around line 148):

// Get workspace owner for fallback created_by
const { data: workspace, error: wsError } = await supabaseClient
  .from('workspaces')
  .select('owner_id')
  .eq('id', workspace_id)
  .single();

const workspaceOwnerId = workspace?.owner_id || null;
console.log('Workspace owner ID for fallback:', workspaceOwnerId);

// Then in the upsert_transaction RPC call, use:
p_created_by: institution.created_by || institution.updated_by || workspaceOwnerId || null

// This provides a fallback chain:
// 1. Use institution.created_by if it exists
// 2. Otherwise use institution.updated_by
// 3. Otherwise use the workspace owner
// 4. If all fail, use null (which will error, but at least we tried)