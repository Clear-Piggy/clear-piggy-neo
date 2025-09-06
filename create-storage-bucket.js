const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://lrwvooucggciazmzxqlb.supabase.co';
const serviceRoleKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imxyd3Zvb3VjZ2djaWF6bXp4cWxiIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NTc4NzkyMCwiZXhwIjoyMDcxMzYzOTIwfQ.nm8RcglZ_ZCHdaxQlg_kd_v54kmA0X38Wj1LJxCKro8';

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function createReceiptsBucket() {
  console.log('🪣 Creating receipts storage bucket...\n');

  try {
    // Try to create the bucket
    const { data: createData, error: createError } = await supabase
      .storage
      .createBucket('receipts', {
        public: false,
        fileSizeLimit: 10485760, // 10MB
        allowedMimeTypes: ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp']
      });

    if (createError) {
      if (createError.message.includes('already exists')) {
        console.log('ℹ️  Bucket already exists, updating settings...');
        
        // Update the existing bucket
        const { data: updateData, error: updateError } = await supabase
          .storage
          .updateBucket('receipts', {
            public: false,
            fileSizeLimit: 10485760,
            allowedMimeTypes: ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp']
          });

        if (updateError) {
          console.error('❌ Failed to update bucket:', updateError.message);
          return;
        }
        console.log('✅ Bucket settings updated successfully');
      } else {
        console.error('❌ Failed to create bucket:', createError.message);
        return;
      }
    } else {
      console.log('✅ Receipts bucket created successfully');
    }

    // List buckets to confirm
    const { data: buckets, error: listError } = await supabase
      .storage
      .listBuckets();

    if (!listError) {
      const receiptsBucket = buckets.find(b => b.name === 'receipts');
      if (receiptsBucket) {
        console.log('\n📊 Bucket Details:');
        console.log('  - Name:', receiptsBucket.name);
        console.log('  - ID:', receiptsBucket.id);
        console.log('  - Public:', receiptsBucket.public);
        console.log('  - File Size Limit:', receiptsBucket.file_size_limit ? `${receiptsBucket.file_size_limit / 1048576}MB` : 'No limit');
        console.log('  - Created:', receiptsBucket.created_at);
      }
    }

    console.log('\n🔒 Security Configuration:');
    console.log('  - Private bucket (requires authentication)');
    console.log('  - Workspace-scoped storage paths');
    console.log('  - RLS policies need to be applied via SQL');
    
    console.log('\n📁 Storage Path Format:');
    console.log('  /receipts/{workspace_id}/{user_id}/{timestamp}_receipt.jpg');
    
    console.log('\n✅ Storage bucket setup complete!');
    console.log('\nNext steps:');
    console.log('1. Apply RLS policies using SQL/create-receipts-bucket.sql');
    console.log('2. Test receipt upload in the app');
    console.log('3. Monitor n8n workflow execution');

  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

createReceiptsBucket();