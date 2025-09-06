const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://rnevebffhtplbixdmbgq.supabase.co';
const serviceRoleKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJuZXZlYmZmaHRwbGJpeGRtYmdxIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NjY2Mjk4NCwiZXhwIjoyMDcyMjM4OTg0fQ.s2sWaR-21kbs5lN7amLhSjac7mPMb10EH6dJqFxeiK4';

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function checkMatchingResults() {
  console.log('🔍 Checking for Matching Results in Database\n');
  console.log('═══════════════════════════════════════════\n');

  // Get all documents with their latest OCR metadata
  const { data: documents, error } = await supabase
    .from('documents')
    .select('*')
    .eq('document_type', 'receipt')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching documents:', error);
    return;
  }

  console.log(`Found ${documents.length} receipt documents\n`);

  documents.forEach((doc, idx) => {
    console.log(`📄 Document ${idx + 1}: ${doc.filename}`);
    console.log('─'.repeat(60));
    console.log(`  ID: ${doc.id}`);
    console.log(`  Status: ${doc.processing_status}`);
    console.log(`  Created: ${doc.created_at}`);
    console.log(`  Updated: ${doc.updated_at}`);
    
    if (doc.ocr_metadata) {
      console.log('\n  OCR Metadata Keys:', Object.keys(doc.ocr_metadata).join(', '));
      
      // Check for matching_result
      if (doc.ocr_metadata.matching_result) {
        console.log('\n  ✅ MATCHING RESULT FOUND:');
        console.log('  ' + JSON.stringify(doc.ocr_metadata.matching_result, null, 2).replace(/\n/g, '\n  '));
      } else {
        console.log('\n  ⚠️  NO matching_result field');
      }
      
      // Show basic OCR data
      console.log('\n  OCR Data:');
      console.log(`    Merchant: ${doc.ocr_metadata.merchant_name}`);
      console.log(`    Amount: $${doc.ocr_metadata.total_amount}`);
      console.log(`    Date: ${doc.ocr_metadata.transaction_date}`);
    } else {
      console.log('\n  ❌ No OCR metadata at all');
    }
    console.log('\n');
  });

  // Check document_attachments
  console.log('\n📎 DOCUMENT ATTACHMENTS:\n');
  console.log('═══════════════════════\n');
  
  const { data: attachments, error: attachError } = await supabase
    .from('document_attachments')
    .select('*');
  
  if (attachments && attachments.length > 0) {
    console.log(`Found ${attachments.length} attachments:\n`);
    attachments.forEach(att => {
      console.log(`  Document ${att.document_id} -> Transaction ${att.attached_to_id}`);
      console.log(`  Type: ${att.attached_to_type}`);
      console.log(`  Attached at: ${att.attached_at}`);
      console.log();
    });
  } else {
    console.log('No document attachments found');
  }

  // Test the query that the frontend would use
  console.log('\n\n🔧 TESTING FRONTEND QUERY:\n');
  console.log('═════════════════════════\n');
  
  // This simulates what the frontend does
  const { data: frontendDocs, error: frontendError } = await supabase
    .from('documents')
    .select('*')
    .eq('document_type', 'receipt')
    .eq('processing_status', 'processed')
    .order('created_at', { ascending: false });

  if (frontendError) {
    console.log('❌ Frontend query error:', frontendError.message);
  } else {
    console.log(`✅ Frontend query would return ${frontendDocs?.length || 0} processed receipts`);
    if (frontendDocs && frontendDocs.length > 0) {
      const withMatching = frontendDocs.filter(d => d.ocr_metadata?.matching_result);
      console.log(`   - ${withMatching.length} have matching_result`);
      console.log(`   - ${frontendDocs.length - withMatching.length} missing matching_result`);
    }
  }
}

checkMatchingResults().catch(console.error);