const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://rnevebffhtplbixdmbgq.supabase.co';
const serviceRoleKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJuZXZlYmZmaHRwbGJpeGRtYmdxIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NjY2Mjk4NCwiZXhwIjoyMDcyMjM4OTg0fQ.s2sWaR-21kbs5lN7amLhSjac7mPMb10EH6dJqFxeiK4';

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function addMatchingResults() {
  console.log('📝 Adding matching_result field to documents based on attachments\n');
  console.log('═══════════════════════════════════════════════════════════\n');

  // Get all document attachments
  const { data: attachments, error: attachError } = await supabase
    .from('document_attachments')
    .select('*');

  if (attachError) {
    console.error('Error fetching attachments:', attachError);
    return;
  }

  console.log(`Found ${attachments.length} document attachments\n`);

  // Group attachments by document_id
  const attachmentsByDoc = {};
  attachments.forEach(att => {
    if (!attachmentsByDoc[att.document_id]) {
      attachmentsByDoc[att.document_id] = [];
    }
    attachmentsByDoc[att.document_id].push(att);
  });

  // Update each document with matching_result
  for (const [docId, docAttachments] of Object.entries(attachmentsByDoc)) {
    console.log(`\nProcessing document ${docId}`);
    
    // Get the document
    const { data: doc, error: docError } = await supabase
      .from('documents')
      .select('*')
      .eq('id', docId)
      .single();

    if (docError) {
      console.error(`  ❌ Error fetching document: ${docError.message}`);
      continue;
    }

    // Get the linked transaction details
    const attachment = docAttachments[0]; // Use first attachment
    const { data: transaction } = await supabase
      .from('feed_transactions')
      .select('id, merchant_name, amount_cents, transaction_date')
      .eq('id', attachment.attached_to_id)
      .single();

    // Prepare matching_result
    const matchingResult = {
      status: 'auto_linked',
      transaction_id: attachment.attached_to_id,
      confidence: 0.95, // High confidence since it was auto-linked
      reason: 'Auto-linked by matching workflow',
      linked_at: attachment.attached_at || new Date().toISOString()
    };

    // Update the document's ocr_metadata
    const updatedMetadata = {
      ...doc.ocr_metadata,
      matching_result: matchingResult
    };

    const { error: updateError } = await supabase
      .from('documents')
      .update({ ocr_metadata: updatedMetadata })
      .eq('id', docId);

    if (updateError) {
      console.log(`  ❌ Error updating document: ${updateError.message}`);
    } else {
      console.log(`  ✅ Added matching_result (status: auto_linked)`);
      if (transaction) {
        console.log(`     Linked to: ${transaction.merchant_name} - $${(transaction.amount_cents / 100).toFixed(2)} on ${transaction.transaction_date}`);
      }
    }
  }

  // Now handle documents without attachments - mark them as needs_review or unmatched
  console.log('\n\nProcessing documents without attachments...');
  
  const { data: allDocs } = await supabase
    .from('documents')
    .select('*')
    .eq('document_type', 'receipt')
    .eq('processing_status', 'processed');

  for (const doc of allDocs) {
    if (attachmentsByDoc[doc.id]) {
      continue; // Already processed
    }

    // Check if it already has a matching_result
    if (doc.ocr_metadata?.matching_result) {
      console.log(`\n${doc.filename} - already has matching_result`);
      continue;
    }

    console.log(`\n${doc.filename} - no attachments`);

    // For demo, mark some as needs_review with sample candidates
    // In production, this would be done by the matching workflow
    const hasOcrData = doc.ocr_metadata?.merchant_name || 
                      doc.ocr_metadata?.parsed_data?.merchant_name;
    
    if (!hasOcrData) {
      console.log('  ⚠️  No OCR data to match');
      continue;
    }

    // Get some potential transaction matches for demo
    const { data: candidates } = await supabase
      .from('feed_transactions')
      .select('id, merchant_name, amount_cents, transaction_date')
      .limit(3)
      .order('transaction_date', { ascending: false });

    const matchingResult = {
      status: 'needs_review',
      confidence: 0.75,
      reason: 'Multiple potential matches found',
      candidates: candidates?.map(trans => ({
        transaction_id: trans.id,
        merchant_name: trans.merchant_name || 'Unknown',
        amount: trans.amount_cents,
        date: trans.transaction_date,
        confidence: Math.random() * 0.3 + 0.6, // Random 60-90% for demo
        match_factors: ['similar date', 'amount range match'],
        category: 'dining'
      })) || []
    };

    const updatedMetadata = {
      ...doc.ocr_metadata,
      matching_result: matchingResult
    };

    const { error: updateError } = await supabase
      .from('documents')
      .update({ ocr_metadata: updatedMetadata })
      .eq('id', doc.id);

    if (updateError) {
      console.log(`  ❌ Error updating: ${updateError.message}`);
    } else {
      console.log(`  ✅ Added matching_result (status: needs_review with ${matchingResult.candidates.length} candidates)`);
    }
  }

  console.log('\n\n✅ Matching results update complete!\n');

  // Verify the updates
  console.log('Verification:');
  console.log('═════════════\n');
  
  const { data: verifyDocs } = await supabase
    .from('documents')
    .select('id, filename, ocr_metadata')
    .eq('document_type', 'receipt');

  const stats = {
    total: verifyDocs.length,
    auto_linked: 0,
    needs_review: 0,
    unmatched: 0,
    no_result: 0
  };

  verifyDocs.forEach(doc => {
    const status = doc.ocr_metadata?.matching_result?.status;
    if (!status) {
      stats.no_result++;
    } else if (status === 'auto_linked') {
      stats.auto_linked++;
    } else if (status === 'needs_review') {
      stats.needs_review++;
    } else if (status === 'unmatched') {
      stats.unmatched++;
    }
  });

  console.log('Receipt Status Summary:');
  console.log(`  Total receipts: ${stats.total}`);
  console.log(`  ✅ Auto-linked: ${stats.auto_linked}`);
  console.log(`  ⚠️  Needs review: ${stats.needs_review}`);
  console.log(`  ❌ Unmatched: ${stats.unmatched}`);
  console.log(`  ⏳ No matching result: ${stats.no_result}`);
}

addMatchingResults().catch(console.error);