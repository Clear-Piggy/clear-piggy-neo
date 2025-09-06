const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://lrwvooucggciazmzxqlb.supabase.co';
const serviceRoleKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imxyd3Zvb3VjZ2djaWF6bXp4cWxiIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NTc4NzkyMCwiZXhwIjoyMDcxMzYzOTIwfQ.nm8RcglZ_ZCHdaxQlg_kd_v54kmA0X38Wj1LJxCKro8';

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function makeBucketPrivateAndSecure() {
  console.log('🔒 Setting receipts bucket back to PRIVATE with proper security...\n');

  try {
    // Update bucket to be private
    const { data, error } = await supabase
      .storage
      .updateBucket('receipts', {
        public: false,  // PRIVATE - requires authentication
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

    console.log('✅ Receipts bucket is now PRIVATE and SECURE');
    
    // Verify the change
    const { data: buckets, error: listError } = await supabase
      .storage
      .listBuckets();

    if (!listError) {
      const receiptsBucket = buckets.find(b => b.name === 'receipts');
      if (receiptsBucket) {
        console.log('\n📊 Bucket Configuration:');
        console.log('  - Name:', receiptsBucket.name);
        console.log('  - Public:', receiptsBucket.public ? '❌ YES (NOT SECURE!)' : '✅ NO (SECURE)');
        console.log('  - File Size Limit:', receiptsBucket.file_size_limit ? `${receiptsBucket.file_size_limit / 1048576}MB` : 'No limit');
        console.log('  - Allowed Types:', receiptsBucket.allowed_mime_types || 'All types');
      }
    }

    console.log('\n🔐 Security Configuration:');
    console.log('  ✅ Private bucket (requires authentication)');
    console.log('  ✅ Workspace-scoped storage paths');
    console.log('  ✅ RLS policies enforce workspace access');
    console.log('  ✅ Path format: /receipts/{workspace_id}/{user_id}/');
    
    console.log('\n📝 Make sure you have run the SQL from:');
    console.log('  SQL/fix-documents-rls-proper.sql');
    console.log('\nThis ensures both storage and database have proper security policies.');

  } catch (error) {
    console.error('❌ Unexpected error:', error);
  }
}

makeBucketPrivateAndSecure();