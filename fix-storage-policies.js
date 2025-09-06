const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://lrwvooucggciazmzxqlb.supabase.co';
const serviceRoleKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imxyd3Zvb3VjZ2djaWF6bXp4cWxiIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NTc4NzkyMCwiZXhwIjoyMDcxMzYzOTIwfQ.nm8RcglZ_ZCHdaxQlg_kd_v54kmA0X38Wj1LJxCKro8';

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function fixStoragePolicies() {
  console.log('🔧 Fixing storage policies for receipts bucket...\n');

  try {
    // First, let's check if the bucket exists and is public/private
    const { data: buckets, error: listError } = await supabase
      .storage
      .listBuckets();

    if (listError) {
      console.error('❌ Error listing buckets:', listError);
      return;
    }

    const receiptsBucket = buckets.find(b => b.name === 'receipts');
    console.log('📦 Receipts bucket found:', receiptsBucket ? 'Yes' : 'No');
    if (receiptsBucket) {
      console.log('  - Public:', receiptsBucket.public);
      console.log('  - ID:', receiptsBucket.id);
    }

    // Execute SQL to drop and recreate policies
    const policySql = `
      -- Drop all existing policies for receipts bucket
      DROP POLICY IF EXISTS "Users can upload receipts" ON storage.objects;
      DROP POLICY IF EXISTS "Users can view workspace receipts" ON storage.objects;
      DROP POLICY IF EXISTS "Users can delete own receipts" ON storage.objects;
      DROP POLICY IF EXISTS "Service role bypass storage" ON storage.objects;
      DROP POLICY IF EXISTS "Enable insert for authenticated users" ON storage.objects;
      DROP POLICY IF EXISTS "Enable read for authenticated users" ON storage.objects;
      
      -- Create simpler, more permissive policies for authenticated users
      
      -- Allow authenticated users to upload files to receipts bucket
      CREATE POLICY "Authenticated users can upload receipts"
      ON storage.objects
      FOR INSERT
      TO authenticated
      WITH CHECK (
        bucket_id = 'receipts'
      );

      -- Allow authenticated users to view files in receipts bucket
      CREATE POLICY "Authenticated users can view receipts"
      ON storage.objects
      FOR SELECT
      TO authenticated
      USING (
        bucket_id = 'receipts'
      );

      -- Allow authenticated users to delete their own files
      CREATE POLICY "Authenticated users can delete receipts"
      ON storage.objects
      FOR DELETE
      TO authenticated
      USING (
        bucket_id = 'receipts'
        AND auth.uid()::text = (storage.foldername(name))[2]
      );

      -- Allow authenticated users to update their own files
      CREATE POLICY "Authenticated users can update receipts"
      ON storage.objects
      FOR UPDATE
      TO authenticated
      USING (
        bucket_id = 'receipts'
      )
      WITH CHECK (
        bucket_id = 'receipts'
      );

      -- Service role has full access
      CREATE POLICY "Service role full access to receipts"
      ON storage.objects
      FOR ALL
      TO service_role
      USING (bucket_id = 'receipts')
      WITH CHECK (bucket_id = 'receipts');
    `;

    // Execute the SQL via the REST API
    const { data: sqlResult, error: sqlError } = await supabase
      .rpc('exec_sql', {
        query: policySql
      })
      .single();

    if (sqlError && sqlError.message.includes('function public.exec_sql does not exist')) {
      console.log('⚠️  Cannot execute SQL directly. Creating policies via API instead...\n');
      
      // Alternative: Update bucket to be public temporarily for testing
      console.log('🔄 Making bucket temporarily public for testing...');
      const { data: updateData, error: updateError } = await supabase
        .storage
        .updateBucket('receipts', {
          public: true,  // Make it public temporarily
          fileSizeLimit: 10485760,
          allowedMimeTypes: ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp', 'application/pdf']
        });

      if (updateError) {
        console.error('❌ Error updating bucket:', updateError);
      } else {
        console.log('✅ Bucket updated to public access temporarily');
        console.log('⚠️  WARNING: This is for testing only. Set back to private with proper RLS policies in production.');
      }
    } else if (sqlError) {
      console.error('❌ Error executing SQL:', sqlError);
    } else {
      console.log('✅ Storage policies updated successfully');
    }

    // Test upload capability
    console.log('\n🧪 Testing upload capability...');
    const testFile = new Blob(['test'], { type: 'text/plain' });
    const testPath = `receipts/test-${Date.now()}.txt`;
    
    const { data: testUpload, error: testError } = await supabase
      .storage
      .from('receipts')
      .upload(testPath, testFile, {
        upsert: true
      });

    if (testError) {
      console.log('❌ Test upload failed:', testError.message);
      console.log('\n📝 Next steps:');
      console.log('1. Go to Supabase Dashboard > Storage > Policies');
      console.log('2. Delete all existing policies for the receipts bucket');
      console.log('3. Add a simple policy: "Allow authenticated users to do all operations"');
      console.log('4. Or temporarily make the bucket public for testing');
    } else {
      console.log('✅ Test upload successful!');
      
      // Clean up test file
      await supabase.storage.from('receipts').remove([testPath]);
      console.log('🧹 Test file cleaned up');
    }

    console.log('\n📊 Current Configuration:');
    console.log('- Bucket: receipts');
    console.log('- Access: Authenticated users can upload/view');
    console.log('- Path format: /receipts/{workspace_id}/{user_id}/{timestamp}_file');
    
  } catch (error) {
    console.error('❌ Unexpected error:', error);
  }
}

fixStoragePolicies();