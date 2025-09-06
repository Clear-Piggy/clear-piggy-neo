const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.REACT_APP_SUPABASE_URL || 'https://lrwvooucggciazmzxqlb.supabase.co';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const SUPABASE_ANON_KEY = process.env.REACT_APP_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imxyd3ZvdWNnZ2NpYXptenp4cWxiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MjgwNjkyNzUsImV4cCI6MjA0MzY0NTI3NX0.tKwwPiaFLRql6M8UbfVPkr4e7dAOA_BQMpEQdPHCLe0';

// Use service key if available, otherwise use anon key
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY || SUPABASE_ANON_KEY);

async function checkBuckets() {
  console.log('🔍 Checking Supabase Storage Buckets...\n');
  console.log('URL:', SUPABASE_URL);
  console.log('Using:', SUPABASE_SERVICE_KEY ? 'Service Key' : 'Anon Key');
  console.log('-----------------------------------\n');

  try {
    // Try to list all buckets
    console.log('1. Attempting to list all buckets:');
    const { data: buckets, error: bucketsError } = await supabase.storage.listBuckets();
    
    if (bucketsError) {
      console.log('❌ Cannot list buckets:', bucketsError.message);
    } else if (buckets && buckets.length > 0) {
      console.log(`✅ Found ${buckets.length} bucket(s):\n`);
      buckets.forEach(bucket => {
        console.log(`   📦 ${bucket.name}`);
        console.log(`      ID: ${bucket.id}`);
        console.log(`      Public: ${bucket.public ? 'Yes' : 'No'}`);
        console.log(`      Created: ${new Date(bucket.created_at).toLocaleString()}\n`);
      });
    } else {
      console.log('⚠️  No buckets found');
    }

    // Test known bucket names
    console.log('\n2. Testing common bucket names:');
    const knownBuckets = ['receipts', 'receipt', 'documents', 'public', 'avatars', 'uploads', 'files'];
    
    for (const bucketName of knownBuckets) {
      try {
        const { data, error } = await supabase.storage
          .from(bucketName)
          .list('', { limit: 1 });
        
        if (error) {
          console.log(`   ❌ ${bucketName}: ${error.message}`);
        } else {
          console.log(`   ✅ ${bucketName}: Accessible (${data?.length || 0} items)`);
        }
      } catch (err) {
        console.log(`   ❌ ${bucketName}: ${err.message}`);
      }
    }

    // Check documents table for storage configuration
    console.log('\n3. Checking documents table for storage paths:');
    const { data: docs, error: docsError } = await supabase
      .from('documents')
      .select('id, storage_bucket, storage_path, filename')
      .limit(5);
    
    if (docsError) {
      console.log('❌ Cannot read documents:', docsError.message);
    } else if (docs && docs.length > 0) {
      console.log(`✅ Found ${docs.length} document(s):\n`);
      docs.forEach(doc => {
        console.log(`   📄 ${doc.filename}`);
        console.log(`      Bucket: ${doc.storage_bucket || 'not set'}`);
        console.log(`      Path: ${doc.storage_path || 'not set'}\n`);
      });
    } else {
      console.log('⚠️  No documents found');
    }

    // Try to create receipts bucket if it doesn't exist
    console.log('\n4. Attempting to create/verify "receipts" bucket:');
    const { data: createData, error: createError } = await supabase.storage.createBucket('receipts', {
      public: true,
      allowedMimeTypes: ['image/*', 'application/pdf']
    });
    
    if (createError) {
      if (createError.message.includes('already exists')) {
        console.log('✅ "receipts" bucket already exists');
      } else {
        console.log('❌ Cannot create bucket:', createError.message);
      }
    } else {
      console.log('✅ Created "receipts" bucket successfully!');
    }

  } catch (error) {
    console.error('❌ Error:', error);
  }
}

// Run the check
checkBuckets().then(() => {
  console.log('\n✨ Check complete!');
  process.exit(0);
}).catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});