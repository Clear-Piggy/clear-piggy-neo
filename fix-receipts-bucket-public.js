const { createClient } = require('@supabase/supabase-js');

// Use the correct Supabase instance
const SUPABASE_URL = 'https://rnevebffhtplbixdmbgq.supabase.co';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJuZXZlYmZmaHRwbGJpeGRtYmdxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTY2NjI5ODQsImV4cCI6MjA3MjIzODk4NH0.VNnnzLLo2Pi5IxAy2-ZPVAbnbrIQLe9xi7tKcPnWOLw';

// Use service key if available for admin operations
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY || SUPABASE_ANON_KEY);

async function fixReceiptsBucket() {
  console.log('🔧 Fixing receipts bucket access...\n');

  try {
    // Test current access
    console.log('1. Testing current bucket access:');
    const testPath = '38d8d2e1-fd55-48b9-bca2-91033ba55bda/1757078432410-qn1nx0glo.pdf';
    
    // Try to get public URL
    const { data: urlData } = supabase.storage
      .from('receipts')
      .getPublicUrl(testPath);
    
    console.log('Public URL:', urlData.publicUrl);
    
    // Test if we can access it
    console.log('\n2. Testing URL access:');
    try {
      const response = await fetch(urlData.publicUrl);
      if (response.ok) {
        console.log('✅ File is accessible (Status:', response.status, ')');
      } else {
        console.log('❌ File not accessible (Status:', response.status, ')');
        const errorText = await response.text();
        console.log('Error:', errorText);
        
        // Try to update bucket to be public
        console.log('\n3. Attempting to make bucket public:');
        const { data: updateData, error: updateError } = await supabase.storage.updateBucket('receipts', {
          public: true
        });
        
        if (updateError) {
          console.log('❌ Cannot update bucket:', updateError.message);
          console.log('\n⚠️  You need to make the bucket public in Supabase Dashboard:');
          console.log('   1. Go to https://supabase.com/dashboard/project/rnevebffhtplbixdmbgq/storage/buckets');
          console.log('   2. Find the "receipts" bucket');
          console.log('   3. Click on it and toggle "Public" to ON');
        } else {
          console.log('✅ Bucket updated to public!');
        }
      }
    } catch (fetchError) {
      console.log('❌ Fetch error:', fetchError.message);
    }
    
    // Check if file exists in storage
    console.log('\n4. Checking if file exists in storage:');
    const { data: files, error: listError } = await supabase.storage
      .from('receipts')
      .list('38d8d2e1-fd55-48b9-bca2-91033ba55bda', { limit: 10 });
    
    if (listError) {
      console.log('❌ Cannot list files:', listError.message);
    } else if (files && files.length > 0) {
      console.log('✅ Found', files.length, 'file(s) in workspace folder:');
      files.forEach(file => {
        console.log('   -', file.name, '(', file.metadata?.size || 0, 'bytes)');
      });
      
      // Check if our specific file exists
      const targetFile = files.find(f => f.name === '1757078432410-qn1nx0glo.pdf');
      if (targetFile) {
        console.log('✅ Target PDF file exists!');
      } else {
        console.log('❌ Target PDF file not found in list');
      }
    } else {
      console.log('⚠️  No files found in workspace folder');
    }
    
    // Try to create a signed URL as alternative
    console.log('\n5. Creating signed URL as alternative:');
    const { data: signedData, error: signedError } = await supabase.storage
      .from('receipts')
      .createSignedUrl(testPath, 3600); // 1 hour
    
    if (signedError) {
      console.log('❌ Cannot create signed URL:', signedError.message);
    } else if (signedData?.signedUrl) {
      console.log('✅ Signed URL created successfully!');
      console.log('URL (valid for 1 hour):', signedData.signedUrl);
      
      // Test signed URL
      try {
        const signedResponse = await fetch(signedData.signedUrl);
        if (signedResponse.ok) {
          console.log('✅ Signed URL works!');
        } else {
          console.log('❌ Signed URL failed (Status:', signedResponse.status, ')');
        }
      } catch (err) {
        console.log('❌ Error testing signed URL:', err.message);
      }
    }

  } catch (error) {
    console.error('❌ Unexpected error:', error);
  }
}

// Run the fix
fixReceiptsBucket().then(() => {
  console.log('\n✨ Check complete!');
  console.log('\nNOTE: If the bucket is not public, you need to:');
  console.log('1. Go to your Supabase Dashboard');
  console.log('2. Navigate to Storage > Buckets');
  console.log('3. Click on "receipts" bucket');
  console.log('4. Toggle "Public bucket" to ON');
  process.exit(0);
}).catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});