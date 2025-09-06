const { createClient } = require('@supabase/supabase-js');

// Using service role key to bypass RLS
const supabaseUrl = 'https://rnevebffhtplbixdmbgq.supabase.co';
const serviceRoleKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJuZXZlYmZmaHRwbGJpeGRtYmdxIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NjY2Mjk4NCwiZXhwIjoyMDcyMjM4OTg0fQ.s2sWaR-21kbs5lN7amLhSjac7mPMb10EH6dJqFxeiK4';

// Create client with service role (bypasses RLS)
const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function examineFullSchema() {
  console.log('🔍 Examining Database with Service Role (RLS Bypassed)\n');
  console.log('═══════════════════════════════════════════════════════\n');

  // Check all key tables
  const tables = [
    'documents',
    'document_attachments',
    'feed_transactions',
    'transactions',
    'bank_accounts',
    'accounts',
    'institutions',
    'workspaces',
    'workspace_members',
    'user_profiles',
    'attachments',
    'receipts'
  ];

  console.log('📊 TABLE ACCESS WITH SERVICE ROLE:\n');
  console.log('Table Name                     | Status | Records | Sample Columns');
  console.log('-------------------------------|--------|---------|----------------');
  
  for (const table of tables) {
    try {
      const { data, error, count } = await supabase
        .from(table)
        .select('*', { count: 'exact' })
        .limit(1);
      
      if (error) {
        console.log(`${table.padEnd(30)} | ❌     | N/A     | ${error.message}`);
      } else {
        const columns = data && data[0] ? Object.keys(data[0]).slice(0, 5).join(', ') : 'No data';
        console.log(`${table.padEnd(30)} | ✅     | ${String(count || 0).padEnd(7)} | ${columns}`);
      }
    } catch (e) {
      console.log(`${table.padEnd(30)} | ❌     | Error   | ${e.message}`);
    }
  }

  // Examine documents table in detail
  console.log('\n\n📄 DOCUMENTS TABLE DETAILED STRUCTURE:');
  console.log('──────────────────────────────────────');
  
  const { data: docs } = await supabase
    .from('documents')
    .select('*')
    .limit(3);
  
  if (docs && docs.length > 0) {
    console.log(`Found ${docs.length} documents\n`);
    console.log('Columns in documents table:');
    const columns = Object.keys(docs[0]);
    columns.forEach(col => {
      const value = docs[0][col];
      const type = value === null ? 'null' : Array.isArray(value) ? 'array' : typeof value === 'object' ? 'object/jsonb' : typeof value;
      console.log(`  - ${col}: ${type}`);
    });
    
    // Check for OCR metadata
    console.log('\nDocuments with OCR metadata:');
    docs.forEach(doc => {
      if (doc.ocr_metadata) {
        console.log(`  - ${doc.filename || doc.id}:`);
        console.log(`    Status: ${doc.processing_status}`);
        console.log(`    OCR Keys: ${Object.keys(doc.ocr_metadata).join(', ')}`);
        if (doc.ocr_metadata.matching_result) {
          console.log(`    Matching Status: ${doc.ocr_metadata.matching_result.status}`);
        }
      }
    });
  } else {
    console.log('No documents found in table');
  }

  // Check feed_transactions or transactions
  console.log('\n\n💳 TRANSACTIONS TABLE ANALYSIS:');
  console.log('─────────────────────────────────');
  
  // Try feed_transactions first
  let transTable = 'feed_transactions';
  let { data: trans, error: transError } = await supabase
    .from(transTable)
    .select('*')
    .limit(3);
  
  if (transError) {
    console.log(`feed_transactions not accessible: ${transError.message}`);
    console.log('Trying transactions table instead...\n');
    transTable = 'transactions';
    const result = await supabase
      .from(transTable)
      .select('*')
      .limit(3);
    trans = result.data;
    transError = result.error;
  }
  
  if (!transError && trans) {
    console.log(`✅ Using table: ${transTable}`);
    if (trans.length > 0) {
      console.log('Transaction columns:');
      Object.keys(trans[0]).forEach(col => {
        console.log(`  - ${col}`);
      });
    }
    
    const { count } = await supabase
      .from(transTable)
      .select('*', { count: 'exact', head: true });
    console.log(`\nTotal transactions: ${count || 0}`);
  }

  // Check document_attachments or attachments
  console.log('\n\n🔗 ATTACHMENTS TABLE ANALYSIS:');
  console.log('──────────────────────────────');
  
  let attachTable = 'document_attachments';
  let { data: attach, error: attachError } = await supabase
    .from(attachTable)
    .select('*')
    .limit(3);
  
  if (attachError) {
    console.log(`document_attachments not accessible: ${attachError.message}`);
    console.log('Trying attachments table instead...\n');
    attachTable = 'attachments';
    const result = await supabase
      .from(attachTable)
      .select('*')
      .limit(3);
    attach = result.data;
    attachError = result.error;
  }
  
  if (!attachError && attach) {
    console.log(`✅ Using table: ${attachTable}`);
    if (attach && attach.length > 0) {
      console.log('Attachment columns:');
      Object.keys(attach[0]).forEach(col => {
        console.log(`  - ${col}`);
      });
    }
    
    const { count } = await supabase
      .from(attachTable)
      .select('*', { count: 'exact', head: true });
    console.log(`\nTotal attachments: ${count || 0}`);
  }

  // Check workspaces
  console.log('\n\n🏢 WORKSPACES ANALYSIS:');
  console.log('────────────────────────');
  
  const { data: workspaces, error: wsError } = await supabase
    .from('workspaces')
    .select('*')
    .limit(5);
  
  if (!wsError && workspaces) {
    console.log(`Found ${workspaces.length} workspaces`);
    if (workspaces.length > 0) {
      console.log('\nSample workspaces:');
      workspaces.forEach(ws => {
        console.log(`  - ${ws.name || ws.id} (ID: ${ws.id})`);
      });
    }
  } else if (wsError) {
    console.log(`Error accessing workspaces: ${wsError.message}`);
  }

  // Test queries for receipt matching
  console.log('\n\n🎯 TESTING RECEIPT MATCHING QUERIES:');
  console.log('────────────────────────────────────');
  
  // Query for receipts needing review
  const { data: needsReview, error: reviewError } = await supabase
    .from('documents')
    .select('*')
    .eq('document_type', 'receipt')
    .eq('ocr_metadata->matching_result->>status', 'needs_review');
  
  if (!reviewError) {
    console.log(`✅ Receipts needing review: ${needsReview?.length || 0}`);
  } else {
    console.log(`❌ Error querying needs_review: ${reviewError.message}`);
  }

  // Query for processed receipts
  const { data: processed } = await supabase
    .from('documents')
    .select('*')
    .eq('document_type', 'receipt')
    .eq('processing_status', 'processed');
  
  console.log(`✅ Processed receipts: ${processed?.length || 0}`);

  // Check if we can join tables
  console.log('\n\n🔄 TESTING TABLE JOINS:');
  console.log('──────────────────────');
  
  try {
    const { data: joinTest, error: joinError } = await supabase
      .from('documents')
      .select(`
        id,
        filename,
        processing_status,
        ${attachTable}!inner(*)
      `)
      .eq('document_type', 'receipt')
      .limit(5);
    
    if (!joinError) {
      console.log(`✅ Can join documents with ${attachTable}`);
    } else {
      console.log(`❌ Join error: ${joinError.message}`);
    }
  } catch (e) {
    console.log(`❌ Join failed: ${e.message}`);
  }

  console.log('\n═══════════════════════════════════════════════════════');
  console.log('✅ Full schema examination complete with service role!\n');
}

examineFullSchema().catch(console.error);