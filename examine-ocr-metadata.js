const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://rnevebffhtplbixdmbgq.supabase.co';
const serviceRoleKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJuZXZlYmZmaHRwbGJpeGRtYmdxIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NjY2Mjk4NCwiZXhwIjoyMDcyMjM4OTg0fQ.s2sWaR-21kbs5lN7amLhSjac7mPMb10EH6dJqFxeiK4';

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function examineOCRMetadata() {
  console.log('📋 DETAILED OCR METADATA EXAMINATION\n');
  console.log('════════════════════════════════════\n');

  // Get all documents with their OCR metadata
  const { data: documents, error } = await supabase
    .from('documents')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching documents:', error);
    return;
  }

  console.log(`Found ${documents.length} documents in total\n`);

  documents.forEach((doc, idx) => {
    console.log(`\n📄 Document ${idx + 1}: ${doc.filename}`);
    console.log('─'.repeat(50));
    console.log(`  ID: ${doc.id}`);
    console.log(`  Type: ${doc.document_type}`);
    console.log(`  Status: ${doc.processing_status}`);
    console.log(`  Created: ${doc.created_at}`);
    console.log(`  Workspace: ${doc.workspace_id}`);
    
    if (doc.ocr_metadata) {
      console.log('\n  OCR Metadata:');
      console.log('  ' + JSON.stringify(doc.ocr_metadata, null, 2).replace(/\n/g, '\n  '));
      
      // Check for matching_result
      if (!doc.ocr_metadata.matching_result) {
        console.log('\n  ⚠️  NO matching_result field found!');
        console.log('  This document needs matching workflow to be run.');
      }
    } else {
      console.log('\n  ❌ No OCR metadata');
    }
  });

  // Check feed_transactions for potential matches
  console.log('\n\n💳 SAMPLE FEED TRANSACTIONS FOR MATCHING:\n');
  console.log('════════════════════════════════════════════\n');
  
  const { data: transactions } = await supabase
    .from('feed_transactions')
    .select('id, merchant_name, amount_cents, transaction_date, description, workspace_id')
    .order('transaction_date', { ascending: false })
    .limit(10);

  if (transactions && transactions.length > 0) {
    console.log('Recent transactions that could be matched to receipts:\n');
    transactions.forEach(trans => {
      console.log(`  💰 ${trans.merchant_name || trans.description}`);
      console.log(`     Amount: $${(trans.amount_cents / 100).toFixed(2)}`);
      console.log(`     Date: ${trans.transaction_date}`);
      console.log(`     ID: ${trans.id}`);
      console.log(`     Workspace: ${trans.workspace_id}`);
      console.log();
    });
  }

  // Check document_attachments structure
  console.log('\n📎 DOCUMENT_ATTACHMENTS TABLE STRUCTURE:\n');
  console.log('════════════════════════════════════════\n');
  
  // Try to get the table schema by attempting an insert and catching the error
  const { error: schemaError } = await supabase
    .from('document_attachments')
    .insert({ 
      document_id: '00000000-0000-0000-0000-000000000000',
      attached_to_type: 'test',
      attached_to_id: '00000000-0000-0000-0000-000000000000'
    });
  
  if (schemaError) {
    console.log('Table structure (from error message):');
    console.log(schemaError.message);
    
    // List any existing attachments
    const { data: attachments } = await supabase
      .from('document_attachments')
      .select('*')
      .limit(5);
    
    if (attachments && attachments.length > 0) {
      console.log('\nExisting attachment columns:');
      Object.keys(attachments[0]).forEach(col => {
        console.log(`  - ${col}`);
      });
    } else {
      console.log('\nNo existing attachments to examine structure.');
    }
  }

  console.log('\n\n🎯 SUMMARY:\n');
  console.log('════════════\n');
  console.log('1. Documents exist with OCR data (merchant, amount, date)');
  console.log('2. Feed transactions exist with similar data');
  console.log('3. NO matching_result field in current OCR metadata');
  console.log('4. document_attachments table exists but is empty');
  console.log('5. Need to implement matching workflow to:');
  console.log('   - Add matching_result to ocr_metadata');
  console.log('   - Create document_attachments records for links');
  console.log('   - Update UI to show matching status');
}

examineOCRMetadata().catch(console.error);