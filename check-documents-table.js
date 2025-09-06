const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://lrwvooucggciazmzxqlb.supabase.co';
const serviceRoleKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imxyd3Zvb3VjZ2djaWF6bXp4cWxiIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NTc4NzkyMCwiZXhwIjoyMDcxMzYzOTIwfQ.nm8RcglZ_ZCHdaxQlg_kd_v54kmA0X38Wj1LJxCKro8';

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function checkDocumentsTable() {
  console.log('🔍 Checking documents table...\n');

  try {
    // Try to query the documents table
    const { data, error, count } = await supabase
      .from('documents')
      .select('*', { count: 'exact', head: true });

    if (error) {
      if (error.message.includes('relation') && error.message.includes('does not exist')) {
        console.log('❌ Documents table does not exist!');
        console.log('📝 The documents table needs to be created.');
        console.log('\nYou need to run the SQL from: SQL/006_documents_attachments.sql');
        return;
      } else {
        console.log('⚠️  Error querying documents table:', error.message);
        console.log('This might be an RLS issue.');
      }
    } else {
      console.log('✅ Documents table exists');
      console.log(`📊 Current record count: ${count || 0}`);
    }

    // Check if we can insert (using service role)
    console.log('\n🧪 Testing insert capability...');
    const testDoc = {
      workspace_id: '38d8d2e1-fd55-48b9-bca2-91033ba55bda', // Your workspace ID
      filename: 'test-receipt.pdf',
      file_size: 1024,
      mime_type: 'application/pdf',
      document_type: 'receipt',
      storage_path: 'receipts/test/test.pdf',
      storage_bucket: 'receipts',
      sha256_hash: 'test-hash-' + Date.now(),
      processing_status: 'uploaded',
      metadata: { test: true },
      created_by: '00000000-0000-0000-0000-000000000000',
      updated_by: '00000000-0000-0000-0000-000000000000'
    };

    const { data: insertData, error: insertError } = await supabase
      .from('documents')
      .insert(testDoc)
      .select()
      .single();

    if (insertError) {
      console.log('❌ Insert test failed:', insertError.message);
      
      if (insertError.message.includes('violates foreign key constraint')) {
        console.log('📝 This is likely because created_by/updated_by need valid user_profile IDs');
      }
    } else {
      console.log('✅ Insert test successful!');
      
      // Clean up test record
      if (insertData && insertData.id) {
        await supabase
          .from('documents')
          .delete()
          .eq('id', insertData.id);
        console.log('🧹 Test record cleaned up');
      }
    }

    // Check RLS status
    console.log('\n🔒 Checking RLS status...');
    const { data: rlsData, error: rlsError } = await supabase
      .rpc('check_rls_enabled', { table_name: 'documents' })
      .single();

    if (rlsError) {
      // Try alternative method
      console.log('⚠️  Cannot check RLS status directly');
    } else {
      console.log('RLS Enabled:', rlsData ? 'Yes' : 'No');
    }

  } catch (error) {
    console.error('❌ Unexpected error:', error);
  }
}

checkDocumentsTable();