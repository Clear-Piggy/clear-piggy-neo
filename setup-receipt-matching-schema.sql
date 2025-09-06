-- Receipt Matching System Database Schema Setup
-- This script sets up the necessary tables and structures for the receipt processing system

-- Ensure documents table has the right structure for receipt processing
ALTER TABLE documents 
ADD COLUMN IF NOT EXISTS ocr_metadata JSONB,
ADD COLUMN IF NOT EXISTS processing_status TEXT DEFAULT 'uploaded',
ADD COLUMN IF NOT EXISTS document_type TEXT DEFAULT 'receipt',
ADD COLUMN IF NOT EXISTS workspace_id UUID,
ADD COLUMN IF NOT EXISTS storage_path TEXT,
ADD COLUMN IF NOT EXISTS storage_bucket TEXT,
ADD COLUMN IF NOT EXISTS filename TEXT,
ADD COLUMN IF NOT EXISTS file_size INTEGER,
ADD COLUMN IF NOT EXISTS mime_type TEXT,
ADD COLUMN IF NOT EXISTS sha256_hash TEXT,
ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW(),
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW(),
ADD COLUMN IF NOT EXISTS created_by UUID,
ADD COLUMN IF NOT EXISTS updated_by UUID;

-- Add check constraint for processing status
ALTER TABLE documents 
DROP CONSTRAINT IF EXISTS documents_processing_status_check;

ALTER TABLE documents
ADD CONSTRAINT documents_processing_status_check 
CHECK (processing_status IN ('uploaded', 'processing', 'processed', 'error'));

-- Create index for faster queries on matching status
CREATE INDEX IF NOT EXISTS idx_documents_matching_status 
ON documents ((ocr_metadata->'matching_result'->>'status'));

CREATE INDEX IF NOT EXISTS idx_documents_workspace_type 
ON documents (workspace_id, document_type);

-- Since we use 'attachments' instead of 'document_attachments'
-- Ensure attachments table has the right structure
ALTER TABLE attachments
ADD COLUMN IF NOT EXISTS document_id UUID REFERENCES documents(id),
ADD COLUMN IF NOT EXISTS attached_to_type TEXT,
ADD COLUMN IF NOT EXISTS attached_to_id UUID,
ADD COLUMN IF NOT EXISTS attached_by UUID,
ADD COLUMN IF NOT EXISTS attached_at TIMESTAMPTZ DEFAULT NOW(),
ADD COLUMN IF NOT EXISTS metadata JSONB;

-- Create indexes for attachments
CREATE INDEX IF NOT EXISTS idx_attachments_document 
ON attachments (document_id);

CREATE INDEX IF NOT EXISTS idx_attachments_attached_to 
ON attachments (attached_to_type, attached_to_id);

-- Since we use 'transactions' instead of 'feed_transactions'
-- Ensure transactions table has necessary columns
ALTER TABLE transactions
ADD COLUMN IF NOT EXISTS merchant_name TEXT,
ADD COLUMN IF NOT EXISTS amount_cents INTEGER,
ADD COLUMN IF NOT EXISTS transaction_date DATE,
ADD COLUMN IF NOT EXISTS reconciliation_status TEXT,
ADD COLUMN IF NOT EXISTS workspace_id UUID,
ADD COLUMN IF NOT EXISTS account_id UUID,
ADD COLUMN IF NOT EXISTS plaid_transaction_id TEXT,
ADD COLUMN IF NOT EXISTS category_primary TEXT,
ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();

-- Sample OCR metadata structure for reference
COMMENT ON COLUMN documents.ocr_metadata IS '
{
  "merchant_name": "Store Name",
  "location": "123 Main St",
  "total_amount": 25.99,
  "currency": "USD",
  "transaction_date": "2024-09-05",
  "transaction_time": "14:30",
  "line_items": [...],
  "tax_amount": 2.00,
  "tip_amount": 0,
  "payment_method": "card",
  "receipt_number": "12345",
  "confidence_score": 0.95,
  "extraction_notes": "Clear scan",
  "matching_result": {
    "status": "auto_linked|needs_review|unmatched",
    "transaction_id": "uuid-here",
    "confidence": 0.92,
    "reason": "Amount and date match",
    "candidates": [
      {
        "transaction_id": "uuid",
        "merchant_name": "Store",
        "amount": 2599,
        "date": "2024-09-05",
        "confidence": 0.92,
        "match_factors": ["exact amount", "same day", "merchant match"],
        "category": "shopping",
        "location": "New York"
      }
    ]
  }
}';

-- Function to get receipts by matching status
CREATE OR REPLACE FUNCTION get_receipts_by_status(
  p_workspace_id UUID,
  p_status TEXT
)
RETURNS TABLE (
  id UUID,
  filename TEXT,
  processing_status TEXT,
  ocr_metadata JSONB,
  created_at TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    d.id,
    d.filename,
    d.processing_status,
    d.ocr_metadata,
    d.created_at
  FROM documents d
  WHERE d.workspace_id = p_workspace_id
    AND d.document_type = 'receipt'
    AND d.ocr_metadata->'matching_result'->>'status' = p_status
  ORDER BY d.created_at DESC;
END;
$$ LANGUAGE plpgsql;

-- Function to link receipt to transaction
CREATE OR REPLACE FUNCTION link_receipt_to_transaction(
  p_document_id UUID,
  p_transaction_id UUID,
  p_user_id UUID
)
RETURNS VOID AS $$
BEGIN
  -- Insert attachment record
  INSERT INTO attachments (
    document_id,
    attached_to_type,
    attached_to_id,
    attached_by,
    attached_at
  ) VALUES (
    p_document_id,
    'transaction',
    p_transaction_id,
    p_user_id,
    NOW()
  )
  ON CONFLICT (document_id, attached_to_type, attached_to_id) 
  DO NOTHING;
  
  -- Update document's matching status
  UPDATE documents
  SET 
    ocr_metadata = jsonb_set(
      ocr_metadata,
      '{matching_result,status}',
      '"auto_linked"'
    ),
    updated_at = NOW()
  WHERE id = p_document_id;
END;
$$ LANGUAGE plpgsql;

-- Function to unlink receipt from transaction
CREATE OR REPLACE FUNCTION unlink_receipt_from_transaction(
  p_document_id UUID,
  p_transaction_id UUID
)
RETURNS VOID AS $$
BEGIN
  -- Delete attachment record
  DELETE FROM attachments
  WHERE document_id = p_document_id
    AND attached_to_type = 'transaction'
    AND attached_to_id = p_transaction_id;
  
  -- Update document's matching status
  UPDATE documents
  SET 
    ocr_metadata = jsonb_set(
      ocr_metadata,
      '{matching_result,status}',
      '"unmatched"'
    ),
    updated_at = NOW()
  WHERE id = p_document_id;
END;
$$ LANGUAGE plpgsql;

-- View for receipts with their linked transactions
CREATE OR REPLACE VIEW receipt_transaction_links AS
SELECT 
  d.id as document_id,
  d.filename,
  d.ocr_metadata,
  d.processing_status,
  a.attached_to_id as transaction_id,
  t.merchant_name as transaction_merchant,
  t.amount_cents as transaction_amount,
  t.transaction_date,
  a.attached_at,
  a.attached_by
FROM documents d
LEFT JOIN attachments a ON d.id = a.document_id AND a.attached_to_type = 'transaction'
LEFT JOIN transactions t ON a.attached_to_id = t.id
WHERE d.document_type = 'receipt';

-- Grant necessary permissions (adjust as needed)
GRANT ALL ON documents TO authenticated;
GRANT ALL ON attachments TO authenticated;
GRANT ALL ON transactions TO authenticated;
GRANT EXECUTE ON FUNCTION get_receipts_by_status TO authenticated;
GRANT EXECUTE ON FUNCTION link_receipt_to_transaction TO authenticated;
GRANT EXECUTE ON FUNCTION unlink_receipt_from_transaction TO authenticated;
GRANT SELECT ON receipt_transaction_links TO authenticated;