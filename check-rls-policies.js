const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://rnevebffhtplbixdmbgq.supabase.co';
const serviceRoleKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJuZXZlYmZmaHRwbGJpeGRtYmdxIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NjY2Mjk4NCwiZXhwIjoyMDcyMjM4OTg0fQ.s2sWaR-21kbs5lN7amLhSjac7mPMb10EH6dJqFxeiK4';

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function checkRLSPolicies() {
  console.log('🔒 Checking RLS Policies for document_attachments table\n');
  console.log('══════════════════════════════════════════════════════\n');

  try {
    // Check if RLS is enabled
    const { data: tables, error: tablesError } = await supabase
      .rpc('get_table_info', { table_name: 'document_attachments' });

    if (tablesError) {
      console.log('Note: Cannot check RLS status directly (expected with service role)\n');
    }

    // Try to query the table with service role
    const { data: attachments, error: attachError } = await supabase
      .from('document_attachments')
      .select('*')
      .limit(1);

    if (attachError) {
      console.log('❌ Cannot query document_attachments table even with service role');
      console.log('   Error:', attachError.message);
    } else {
      console.log('✅ Service role can query document_attachments table');
      console.log('   Found', attachments?.length || 0, 'sample record(s)\n');
    }

    // Get the actual attachment we're looking for
    const docId = 'efd1c73f-524d-45b8-811a-4e4abeb74ed6';
    const { data: targetAttachment } = await supabase
      .from('document_attachments')
      .select('*')
      .eq('document_id', docId)
      .single();

    if (targetAttachment) {
      console.log('📎 Target Attachment Details:');
      console.log('   Document ID:', targetAttachment.document_id);
      console.log('   Transaction ID:', targetAttachment.attached_to_id);
      console.log('   Workspace ID:', targetAttachment.workspace_id);
      console.log('   Created By:', targetAttachment.created_by || 'NULL');
      console.log();
    }

    console.log('🔧 SOLUTION:\n');
    console.log('The document_attachments table needs RLS policies to allow users to:');
    console.log('1. Read attachments for documents in their workspace');
    console.log('2. Read attachments for documents they created');
    console.log();
    console.log('SQL to create the missing RLS policy:\n');
    console.log(`
-- Enable RLS on document_attachments if not already enabled
ALTER TABLE document_attachments ENABLE ROW LEVEL SECURITY;

-- Create policy to allow users to read attachments in their workspace
CREATE POLICY "Users can view document attachments in their workspace" 
ON document_attachments 
FOR SELECT 
TO authenticated 
USING (
  workspace_id IN (
    SELECT workspace_id 
    FROM workspace_users 
    WHERE user_id = auth.uid()
  )
);

-- Alternative: If you want to match it to document access
CREATE POLICY "Users can view attachments for documents they can access" 
ON document_attachments 
FOR SELECT 
TO authenticated 
USING (
  document_id IN (
    SELECT id 
    FROM documents 
    WHERE workspace_id IN (
      SELECT workspace_id 
      FROM workspace_users 
      WHERE user_id = auth.uid()
    )
  )
);
    `);

    console.log('\n📝 To fix this issue:');
    console.log('1. Go to the Supabase Dashboard');
    console.log('2. Navigate to Authentication -> Policies');
    console.log('3. Find the document_attachments table');
    console.log('4. Add a SELECT policy with the workspace check above');
    console.log('5. Or run the SQL directly in the SQL editor');

  } catch (error) {
    console.error('Error checking RLS policies:', error);
  }
}

checkRLSPolicies().catch(console.error);