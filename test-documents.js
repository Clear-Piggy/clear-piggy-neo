const { createClient } = require('@supabase/supabase-js');

// Use the correct Supabase instance
const SUPABASE_URL = 'https://rnevebffhtplbixdmbgq.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJuZXZlYmZmaHRwbGJpeGRtYmdxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTY2NjI5ODQsImV4cCI6MjA3MjIzODk4NH0.VNnnzLLo2Pi5IxAy2-ZPVAbnbrIQLe9xi7tKcPnWOLw';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function testDocuments() {
  console.log('🔍 Testing Documents in Supabase\n');
  console.log('URL:', SUPABASE_URL);
  console.log('-----------------------------------\n');

  try {
    // First check if documents table exists
    console.log('1. Checking documents table:');
    const { data: docs, error: docsError } = await supabase
      .from('documents')
      .select('*')
      .limit(5);
    
    if (docsError) {
      console.log('❌ Error reading documents:', docsError.message);
      
      // Check if it's a missing table or permission issue
      if (docsError.message.includes('relation') || docsError.message.includes('does not exist')) {
        console.log('   ℹ️  The documents table may not exist yet');
      }
    } else if (docs && docs.length > 0) {
      console.log(`✅ Found ${docs.length} document(s):\n`);
      docs.forEach(doc => {
        console.log(`   📄 ${doc.filename || 'Unnamed'}`);
        console.log(`      ID: ${doc.id}`);
        console.log(`      Bucket: ${doc.storage_bucket || 'not set'}`);
        console.log(`      Path: ${doc.storage_path || 'not set'}`);
        console.log(`      Status: ${doc.processing_status || 'unknown'}\n`);
      });
    } else {
      console.log('⚠️  No documents found in table');
    }

    // Check what tables exist
    console.log('\n2. Checking available tables:');
    const { data: tables, error: tablesError } = await supabase
      .from('information_schema.tables')
      .select('table_name')
      .eq('table_schema', 'public')
      .limit(20);
    
    if (tablesError) {
      console.log('❌ Cannot list tables:', tablesError.message);
      
      // Try some common table names
      const commonTables = ['users', 'user_profiles', 'workspaces', 'documents', 'receipts', 'transactions'];
      console.log('\n   Testing common table names:');
      
      for (const table of commonTables) {
        const { error } = await supabase.from(table).select('id').limit(1);
        if (!error) {
          console.log(`   ✅ ${table} exists`);
        } else if (error.message.includes('does not exist')) {
          console.log(`   ❌ ${table} does not exist`);
        } else {
          console.log(`   ⚠️  ${table}: ${error.message}`);
        }
      }
    } else if (tables && tables.length > 0) {
      console.log(`✅ Found ${tables.length} table(s):`);
      tables.forEach(t => {
        console.log(`   - ${t.table_name}`);
      });
    }

    // Check storage buckets again
    console.log('\n3. Checking storage buckets:');
    const bucketNames = ['receipts', 'documents'];
    
    for (const bucket of bucketNames) {
      const { data: files, error } = await supabase.storage
        .from(bucket)
        .list('', { limit: 3 });
      
      if (!error) {
        console.log(`   ✅ ${bucket} bucket: ${files?.length || 0} files`);
        if (files && files.length > 0) {
          files.forEach(f => console.log(`      - ${f.name}`));
        }
      } else {
        console.log(`   ❌ ${bucket} bucket: ${error.message}`);
      }
    }

  } catch (error) {
    console.error('❌ Unexpected error:', error);
  }
}

// Run the test
testDocuments().then(() => {
  console.log('\n✨ Test complete!');
  process.exit(0);
}).catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});