# Receipt Processing Implementation - Claude Code Prompts

## Context for Claude Code

Clear Piggy is a finance dashboard app using React + Tailwind + Supabase. We have an existing schema with:
- `documents` table for receipt storage (with OCR fields)
- `document_attachments` table for linking receipts to transactions
- `feed_transactions` table with bank transaction data
- n8n workflow handling OCR processing via webhook

## Implementation Requirements

Build receipt upload → OCR → AI parsing → smart transaction matching system with auto-tagging for high confidence matches and review interface for medium confidence.

---

## Prompt 1: Receipt Upload Component

```
Create a React component for receipt upload with the following requirements:

- Drag & drop zone using Tailwind styling matching Clear Piggy design (modern green gradients)
- File validation (images only, max 10MB)
- Preview uploaded image before processing
- Integration with Supabase storage and documents table
- Trigger n8n webhook after successful upload
- Processing status indicator (uploading → processing → complete)

Supabase schema to use:
- documents table: id, workspace_id, filename, file_size, mime_type, document_type='receipt', storage_path, storage_bucket, processing_status='uploaded'|'processing'|'processed'|'error'
- Use Supabase storage bucket named 'receipts'

Component should:
1. Upload file to Supabase storage
2. Create record in documents table  
3. Call n8n webhook with document ID and storage path
4. Show processing status with elegant loading states
5. Handle errors gracefully

Use TypeScript, modern React patterns, and include proper error handling.
```

---

## Prompt 2: OCR Data Parser Edge Function

```
Create a Supabase Edge Function that parses OCR text from receipts using Claude AI API.

Function requirements:
- Triggered after n8n OCR processing completes
- Takes document ID and OCR text as input
- Uses Claude API to extract structured data from receipt text
- Updates documents table with parsed data and processing status

Schema fields to update:
- ocr_text (from n8n)
- ocr_metadata (store parsed structured data)
- processing_status ('processed' or 'error')

Claude AI prompt should extract:
- Merchant name and address
- Total amount (including tax breakdown)
- Transaction date and time
- Payment method if visible
- Line items (optional)

Store parsed data in ocr_metadata JSONB field:
```json
{
  "parsed_receipt": {
    "merchant_name": "Whole Foods Market",
    "merchant_address": "123 Main St, City, State",
    "total_amount": 127.45,
    "tax_amount": 8.99,
    "date": "2025-09-03",
    "time": "14:30",
    "payment_method": "Card ending in 1234",
    "line_items": [...]
  },
  "parsing_confidence": 0.92,
  "raw_ocr_text": "original OCR text here"
}
```

Include error handling for malformed OCR text and Claude API failures.
```

---

## Prompt 3: Transaction Matching Algorithm

```
Create a function that matches parsed receipt data with existing bank transactions using smart scoring.

Requirements:
- Search feed_transactions within ±7 days of receipt date
- Multi-factor scoring algorithm (amount + merchant + date proximity)
- Return top 3 candidates with confidence scores
- Handle edge cases (no matches, multiple exact matches)

Matching criteria:
1. Amount matching (40% weight):
   - Exact match = 100 points
   - Within $2 = 80 points  
   - Within 5% = 60 points
2. Merchant matching (35% weight):
   - Fuzzy string matching on merchant_normalized field
   - Use Levenshtein distance or similar
3. Date proximity (25% weight):
   - Same day = 100 points
   - ±1 day = 80 points
   - ±3 days = 50 points

Input: Parsed receipt data from ocr_metadata
Output: Array of transaction candidates with scores

Update documents.ocr_metadata to include matching results:
```json
{
  "parsed_receipt": {...},
  "matching_results": {
    "status": "auto_match|needs_review|no_matches",
    "auto_match_confidence": 0.95,
    "candidates": [
      {
        "transaction_id": "uuid",
        "confidence_score": 0.95,
        "match_factors": {
          "amount_score": 100,
          "merchant_score": 85,
          "date_score": 100
        },
        "transaction_preview": {
          "merchant_name": "WHOLEFDS #123",
          "amount_cents": 12745,
          "transaction_date": "2025-09-03"
        }
      }
    ]
  }
}
```

Include auto-linking logic: if confidence > 90%, automatically create document_attachments record.
```

---

## Prompt 4: Receipt Review Interface Component

```
Create a React component for reviewing receipt-transaction matches with the following features:

- Display receipt image alongside parsed data
- Show transaction matching candidates in cards
- Allow user to approve auto-matches or choose from alternatives
- Handle different states: auto-matched, needs review, no matches

Component states to handle:
1. Auto-matched (high confidence): Show success state with option to change
2. Needs review (medium confidence): Display 2-3 candidate transactions to choose from
3. No matches: Show "no matching transactions found" with option to search manually

UI should show:
- Receipt preview and parsed data summary
- Transaction candidates with match confidence scores  
- Clear approve/reject buttons
- Search functionality for manual matching
- Ability to mark receipt as "expense only" (no transaction match needed)

Use existing schema:
- Read from documents table where document_type='receipt'
- Display data from ocr_metadata.parsed_receipt and matching_results
- Create/update document_attachments when user confirms match

Include proper loading states, error handling, and accessibility features.
```

---

## Prompt 5: Receipt Backlog Management Page

```
Create a page component for managing unmatched receipts and review queue.

Page should include:
- Filter/search functionality (by date range, merchant, amount)
- Bulk actions (re-run matching, mark as reviewed)
- Different views: Needs Review, Unmatched, Recently Processed
- Statistics dashboard (processed count, match rate, etc.)

Query requirements:
```sql
-- Get receipts needing review
SELECT d.*, 
       d.ocr_metadata->>'parsed_receipt' as receipt_data,
       d.ocr_metadata->>'matching_results' as match_data
FROM documents d
WHERE d.workspace_id = $1 
  AND d.document_type = 'receipt'
  AND d.processing_status = 'processed'
  AND (d.ocr_metadata->>'matching_results'->>'status' IN ('needs_review', 'no_matches')
       OR NOT EXISTS (
         SELECT 1 FROM document_attachments da 
         WHERE da.document_id = d.id 
           AND da.attached_to_type = 'feed_transaction'
       ))
ORDER BY d.created_at DESC;
```

Include components for:
- Receipt thumbnail grid view
- Detailed receipt viewer modal
- Transaction search and manual linking
- Batch processing controls
```

---

## Prompt 6: Enhanced Webhook Handler with Error Recovery

```
Create a robust Supabase Edge Function to handle n8n webhook responses with error recovery.

Webhook payload from n8n:
```json
{
  "document_id": "uuid",
  "ocr_text": "extracted text",
  "ocr_confidence": 0.92,
  "status": "success|error",
  "error_message": "optional error details",
  "processing_time_ms": 3200
}
```

Function requirements:
1. Validate webhook payload and document ownership
2. Update documents table with OCR results  
3. Trigger AI parsing workflow if OCR successful
4. Handle retries for failed OCR processing
5. Send real-time updates to client via Supabase realtime

Enhanced error handling:
- Store failed OCR attempts with retry logic
- Implement exponential backoff for n8n webhook retries
- Fallback to Tesseract.js client-side OCR if n8n fails consistently
- Update processing_status appropriately for all scenarios

Schema updates using existing fields:
```sql
-- Update documents with OCR results and trigger next step
UPDATE documents 
SET 
  ocr_text = $ocr_text,
  ocr_confidence = $confidence,
  processing_status = CASE 
    WHEN $status = 'success' AND $confidence > 0.7 THEN 'processing'::document_status_enum
    WHEN $status = 'success' AND $confidence <= 0.7 THEN 'processed'::document_status_enum  
    ELSE 'error'::document_status_enum 
  END,
  updated_at = now(),
  metadata = metadata || jsonb_build_object(
    'n8n_processing_time_ms', $processing_time,
    'retry_count', COALESCE((metadata->>'retry_count')::int, 0) + 1
  )
WHERE id = $document_id AND workspace_id = $workspace_id;
```

Include security validation, rate limiting, and comprehensive error logging.
```

## Prompt 7: Receipt Processing Utilities & Helpers

```
Create utility functions for receipt processing workflow using modern JavaScript libraries.

Required packages:
```bash
npm install crypto-js fuzzball date-fns lodash
```

Utility functions needed:
1. **File hash calculation** for duplicate detection
2. **Fuzzy merchant matching** with confidence scoring  
3. **Receipt data normalization** for consistent parsing
4. **Date range calculations** for transaction search windows
5. **Amount tolerance matching** with percentage-based logic

```javascript
// utils/receiptProcessing.ts
import { createHash } from 'crypto-js/sha256';
import { token_set_ratio, extract } from 'fuzzball';
import { differenceInDays, isWithinInterval, subDays, addDays } from 'date-fns';
import _ from 'lodash';

// File utilities
export async function calculateFileHash(file: File): Promise<string>;
export function validateReceiptFile(file: File): { valid: boolean; error?: string };

// Merchant matching utilities  
export function fuzzyMatchMerchants(receiptMerchant: string, transactions: Transaction[]): MatchResult[];
export function normalizeMerchantName(merchant: string): string;

// Amount matching utilities
export function calculateAmountTolerance(amount: number, tolerance: number): { min: number; max: number };
export function isAmountMatch(receiptAmount: number, transactionAmount: number, tolerance?: number): boolean;

// Date utilities for transaction window
export function getTransactionDateWindow(receiptDate: string, daysBefore: number, daysAfter: number): { start: Date; end: Date };
export function calculateDateProximityScore(receiptDate: string, transactionDate: string): number;
```

Include TypeScript interfaces for:
- `ReceiptData`, `MatchResult`, `TransactionCandidate`
- `ProcessingStatus`, `MatchConfidence`, `ReviewAction`
- Error types and response shapes

Add comprehensive JSDoc documentation for all functions.
```

---

## Implementation Order

1. **Start with Receipt Upload Component** - Get the basic upload flow working
2. **Build Webhook Handler** - Handle n8n OCR responses  
3. **Create OCR Parser** - Extract structured data with Claude AI
4. **Implement Transaction Matching** - Smart matching algorithm
5. **Build Review Interface** - User approval/rejection workflow
6. **Add Backlog Management** - Handle unmatched receipts

Each component builds on the previous one, allowing for iterative development and testing at each stage.