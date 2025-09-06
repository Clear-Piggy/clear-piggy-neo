require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.REACT_APP_SUPABASE_URL;
const supabaseAnonKey = process.env.REACT_APP_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('❌ Missing environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function examineSchema() {
  console.log('🔍 Examining Receipt Processing Database Schema\n');
  console.log('═══════════════════════════════════════════════\n');

  try {
    // 1. Check documents table
    console.log('📄 DOCUMENTS TABLE:');
    console.log('─────────────────────');
    const { data: documents, error: docsError } = await supabase
      .from('documents')
      .select('*')
      .limit(1);
    
    if (docsError) {
      console.log('❌ Error accessing documents table:', docsError.message);
    } else {
      console.log('✅ Documents table accessible');
      console.log('   Total columns:', documents[0] ? Object.keys(documents[0]).length : 'No data');
      if (documents[0]) {
        console.log('   Columns:', Object.keys(documents[0]).join(', '));
      }
    }

    // Check for documents with OCR metadata
    const { data: ocrDocs, count: ocrCount } = await supabase
      .from('documents')
      .select('id, filename, processing_status, ocr_metadata', { count: 'exact' })
      .not('ocr_metadata', 'is', null)
      .limit(5);
    
    console.log(`   Documents with OCR metadata: ${ocrCount || 0}`);
    if (ocrDocs && ocrDocs.length > 0) {
      console.log('\n   Sample OCR metadata structure:');
      ocrDocs.forEach(doc => {
        console.log(`   - ${doc.filename}:`);
        console.log(`     Status: ${doc.processing_status}`);
        if (doc.ocr_metadata) {
          console.log(`     OCR Keys: ${Object.keys(doc.ocr_metadata).join(', ')}`);
          if (doc.ocr_metadata.matching_result) {
            console.log(`     Matching Status: ${doc.ocr_metadata.matching_result.status}`);
          }
        }
      });
    }

    // 2. Check feed_transactions table
    console.log('\n\n💳 FEED_TRANSACTIONS TABLE:');
    console.log('──────────────────────────');
    const { data: transactions, error: transError } = await supabase
      .from('feed_transactions')
      .select('*')
      .limit(1);
    
    if (transError) {
      console.log('❌ Error accessing feed_transactions table:', transError.message);
    } else {
      console.log('✅ Feed_transactions table accessible');
      console.log('   Total columns:', transactions[0] ? Object.keys(transactions[0]).length : 'No data');
      if (transactions[0]) {
        console.log('   Key columns:', ['id', 'merchant_name', 'amount_cents', 'transaction_date', 'reconciliation_status']
          .filter(col => col in transactions[0])
          .join(', '));
      }

      // Count total transactions
      const { count: transCount } = await supabase
        .from('feed_transactions')
        .select('*', { count: 'exact', head: true });
      console.log(`   Total transactions: ${transCount || 0}`);
    }

    // 3. Check document_attachments table
    console.log('\n\n🔗 DOCUMENT_ATTACHMENTS TABLE:');
    console.log('────────────────────────────────');
    const { data: attachments, error: attachError } = await supabase
      .from('document_attachments')
      .select('*')
      .limit(1);
    
    if (attachError) {
      console.log('❌ Error accessing document_attachments table:', attachError.message);
    } else {
      console.log('✅ Document_attachments table accessible');
      console.log('   Total columns:', attachments[0] ? Object.keys(attachments[0]).length : 'No data');
      if (attachments[0]) {
        console.log('   Columns:', Object.keys(attachments[0]).join(', '));
      }

      // Count linked receipts
      const { count: linkedCount } = await supabase
        .from('document_attachments')
        .select('*', { count: 'exact', head: true })
        .eq('attached_to_type', 'feed_transaction');
      console.log(`   Linked receipts to transactions: ${linkedCount || 0}`);
    }

    // 4. Check for receipts by matching status
    console.log('\n\n📊 RECEIPT MATCHING STATUS BREAKDOWN:');
    console.log('─────────────────────────────────────');
    
    // Auto-linked (have attachments)
    const { data: linkedDocs } = await supabase
      .from('documents')
      .select('id', { count: 'exact' })
      .eq('document_type', 'receipt');
    
    const { count: autoLinkedCount } = await supabase
      .from('document_attachments')
      .select('*', { count: 'exact', head: true })
      .eq('attached_to_type', 'feed_transaction');
    
    console.log(`   ✅ Auto-linked receipts: ${autoLinkedCount || 0}`);

    // Needs review
    const { data: needsReviewDocs } = await supabase
      .from('documents')
      .select('id, ocr_metadata')
      .eq('document_type', 'receipt')
      .filter('ocr_metadata->matching_result->status', 'eq', 'needs_review');
    
    console.log(`   ⚠️  Needs review: ${needsReviewDocs?.length || 0}`);

    // Unmatched
    const { data: unmatchedDocs } = await supabase
      .from('documents')
      .select('id, ocr_metadata')
      .eq('document_type', 'receipt')
      .filter('ocr_metadata->matching_result->status', 'eq', 'unmatched');
    
    console.log(`   ❌ Unmatched: ${unmatchedDocs?.length || 0}`);

    // Processing
    const { data: processingDocs } = await supabase
      .from('documents')
      .select('id')
      .eq('document_type', 'receipt')
      .in('processing_status', ['uploaded', 'processing']);
    
    console.log(`   ⏳ Still processing: ${processingDocs?.length || 0}`);

    // 5. Sample matching result structure
    console.log('\n\n🔍 SAMPLE MATCHING RESULT STRUCTURES:');
    console.log('──────────────────────────────────────');
    
    const { data: sampleDocs } = await supabase
      .from('documents')
      .select('filename, ocr_metadata')
      .eq('document_type', 'receipt')
      .not('ocr_metadata->matching_result', 'is', null)
      .limit(3);
    
    if (sampleDocs && sampleDocs.length > 0) {
      sampleDocs.forEach((doc, idx) => {
        console.log(`\n   Example ${idx + 1}: ${doc.filename}`);
        if (doc.ocr_metadata?.matching_result) {
          console.log('   ' + JSON.stringify(doc.ocr_metadata.matching_result, null, 4).replace(/\n/g, '\n   '));
        }
      });
    } else {
      console.log('   No documents with matching results found');
    }

    // 6. Test query for needs review with candidates
    console.log('\n\n🎯 TEST QUERIES:');
    console.log('────────────────');
    
    // Query for receipts needing review
    const { data: reviewNeeded, error: reviewError } = await supabase
      .from('documents')
      .select('id, filename, ocr_metadata')
      .eq('document_type', 'receipt')
      .eq('ocr_metadata->matching_result->>status', 'needs_review');
    
    if (reviewError) {
      console.log('❌ Query error (needs review):', reviewError.message);
    } else {
      console.log(`✅ Query successful: Found ${reviewNeeded?.length || 0} receipts needing review`);
    }

    // Query for auto-linked receipts with transaction details
    const { data: linkedWithDetails, error: linkedError } = await supabase
      .from('document_attachments')
      .select(`
        id,
        document_id,
        attached_to_id,
        documents!inner(filename, ocr_metadata),
        feed_transactions!inner(merchant_name, amount_cents, transaction_date)
      `)
      .eq('attached_to_type', 'feed_transaction')
      .limit(5);
    
    if (linkedError) {
      console.log('❌ Query error (linked with details):', linkedError.message);
    } else {
      console.log(`✅ Query successful: Retrieved ${linkedWithDetails?.length || 0} linked receipts with transaction details`);
    }

    console.log('\n═══════════════════════════════════════════════');
    console.log('✅ Schema examination complete!\n');

  } catch (error) {
    console.error('❌ Unexpected error:', error);
  }
}

examineSchema();