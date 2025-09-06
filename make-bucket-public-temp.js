const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://lrwvooucggciazmzxqlb.supabase.co';
const serviceRoleKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imxyd3Zvb3VjZ2djaWF6bXp4cWxiIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NTc4NzkyMCwiZXhwIjoyMDcxMzYzOTIwfQ.nm8RcglZ_ZCHdaxQlg_kd_v54kmA0X38Wj1LJxCKro8';

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function makeBucketPublicTemporarily() {
  console.log('🔄 Temporarily making receipts bucket public for testing...\n');
  console.log('⚠️  WARNING: This is for development only!\n');

  try {
    // Update bucket to be public
    const { data, error } = await supabase
      .storage
      .updateBucket('receipts', {
        public: true,
        fileSizeLimit: 10485760, // 10MB
        allowedMimeTypes: [
          'image/jpeg', 
          'image/jpg', 
          'image/png', 
          'image/gif', 
          'image/webp',
          'application/pdf'
        ]
      });

    if (error) {
      console.error('❌ Error updating bucket:', error);
      return;
    }

    console.log('✅ Receipts bucket is now PUBLIC');
    console.log('📝 Files can now be uploaded and accessed without RLS restrictions');
    
    // Verify the change
    const { data: buckets, error: listError } = await supabase
      .storage
      .listBuckets();

    if (!listError) {
      const receiptsBucket = buckets.find(b => b.name === 'receipts');
      if (receiptsBucket) {
        console.log('\n📊 Bucket Configuration:');
        console.log('  - Name:', receiptsBucket.name);
        console.log('  - Public:', receiptsBucket.public ? '✅ YES' : '❌ NO');
        console.log('  - File Size Limit:', receiptsBucket.file_size_limit ? `${receiptsBucket.file_size_limit / 1048576}MB` : 'No limit');
        console.log('  - Allowed Types:', receiptsBucket.allowed_mime_types || 'All types');
      }
    }

    console.log('\n⚠️  IMPORTANT:');
    console.log('This is a temporary fix for development.');
    console.log('For production, you should:');
    console.log('1. Set the bucket back to private');
    console.log('2. Configure proper RLS policies via Supabase Dashboard');
    console.log('3. Use the workspace-scoped storage approach');
    
    console.log('\n🎯 You can now upload receipts without RLS errors!');

  } catch (error) {
    console.error('❌ Unexpected error:', error);
  }
}

makeBucketPublicTemporarily();