const { createClient } = require('@supabase/supabase-js');

// Use the correct Supabase instance from .env.local
const SUPABASE_URL = 'https://rnevebffhtplbixdmbgq.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJuZXZlYmZmaHRwbGJpeGRtYmdxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTY2NjI5ODQsImV4cCI6MjA3MjIzODk4NH0.VNnnzLLo2Pi5IxAy2-ZPVAbnbrIQLe9xi7tKcPnWOLw';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function checkBuckets() {
  console.log('🔍 Checking Supabase Storage Buckets...\n');
  console.log('URL:', SUPABASE_URL);
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
          
          // If bucket exists, try to list more files
          if (bucketName === 'receipts' && data) {
            const { data: moreFiles } = await supabase.storage
              .from(bucketName)
              .list('', { limit: 5 });
            
            if (moreFiles && moreFiles.length > 0) {
              console.log(`      Sample files:`);
              moreFiles.forEach(file => {
                console.log(`        - ${file.name}`);
              });
            }
          }
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
        
        // Try to generate public URL for the first document
        if (doc.storage_bucket && doc.storage_path) {
          const { data: urlData } = supabase.storage
            .from(doc.storage_bucket)
            .getPublicUrl(doc.storage_path);
          console.log(`      Public URL: ${urlData.publicUrl}\n`);
        }
      });
    } else {
      console.log('⚠️  No documents found');
    }

    // Try to get the actual bucket being used
    console.log('\n4. Testing file upload to receipts bucket:');
    const testFile = new Blob(['test'], { type: 'text/plain' });
    const testPath = `test-${Date.now()}.txt`;
    
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('receipts')
      .upload(testPath, testFile);
    
    if (uploadError) {
      console.log('❌ Cannot upload to receipts:', uploadError.message);
    } else {
      console.log('✅ Successfully uploaded test file to receipts bucket');
      console.log(`   Path: ${uploadData.path}`);
      
      // Clean up test file
      await supabase.storage.from('receipts').remove([testPath]);
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