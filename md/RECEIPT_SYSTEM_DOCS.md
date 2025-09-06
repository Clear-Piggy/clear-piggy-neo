# Receipt System Architecture Overview

## 📊 Database Structure

### `documents` Table
- **Purpose**: Stores metadata about all uploaded receipts
- **Key Fields**:
  - `id`: Unique identifier
  - `workspace_id`: Links to workspace (multi-tenant isolation)
  - `filename`: Original file name
  - `file_size`: Size in bytes
  - `mime_type`: File type (image/pdf)
  - `document_type`: Set to "receipt"
  - `storage_bucket`: "receipts" bucket name
  - `storage_path`: Path in storage (format: `workspace_id/timestamp-random.ext`)
  - `sha256_hash`: File hash for duplicate detection
  - `processing_status`: States: `uploaded` → `processing` → `processed` or `error`
  - `ocr_metadata`: JSON field containing extracted data
  - `created_by`/`updated_by`: User tracking

## 🗄️ Storage System

### Supabase Storage Bucket: `receipts`
- **Configuration**: Public bucket (allows direct URL access)
- **File Structure**: `workspace_id/timestamp-randomstring.extension`
- **Supported Types**: Images (JPEG, PNG, GIF, WebP) and PDFs
- **Access**: Public URLs via `https://[project].supabase.co/storage/v1/object/public/receipts/[path]`

## 📤 Upload Flow

1. **User uploads file** via `ReceiptUpload` component
2. **Client-side validation**:
   - File type check
   - Size limit (10MB)
   - SHA256 hash calculation
3. **Upload to Storage**:
   - File uploaded to `receipts` bucket
   - Path: `workspace_id/timestamp-random.ext`
4. **Create database record**:
   - Insert into `documents` table
   - Status: `uploaded`
5. **Trigger OCR webhook**:
   - Send to n8n: `https://primary-production-6ccfb.up.railway.app/webhook/receipt-ocr-supabase`
   - Payload includes: document_id, workspace_id, storage_path, user_id

## 🔄 OCR Processing (n8n Webhook)

### Security Flow
1. **Webhook receives** document info with workspace_id
2. **Validation** via Supabase edge function:
   - Verifies user has access to workspace
   - Prevents cross-tenant data access
3. **OCR Processing**:
   - Download file from storage
   - Extract text and structured data
   - Parse merchant, amounts, dates, line items
4. **Update database**:
   - Set `processing_status` to `processed`
   - Store extracted data in `ocr_metadata` JSON field

### OCR Metadata Structure
```json
{
  "merchant_name": "7-11",
  "location": "1698 Tamiami Trl S, Venice, FL",
  "total_amount": 100,
  "currency": "USD",
  "transaction_date": "2024-09-05",
  "transaction_time": "19:26",
  "line_items": [...],
  "tax_amount": 0,
  "tip_amount": 0,
  "payment_method": "card",
  "receipt_number": "",
  "confidence_score": 0.97,
  "extraction_notes": "Clear receipt"
}
```

## 👁️ Receipt Preview System

### Components

#### `ReceiptUpload.tsx`
- Drag & drop interface
- File validation and hashing
- Upload progress tracking
- Real-time status updates
- Webhook triggering

#### `ReceiptPreview.tsx`
- **Left panel**: Receipt image/PDF display
  - Images: Direct img tag with object-contain
  - PDFs: iframe with zoom controls
  - Fullscreen view option
- **Right panel**: OCR data display
  - Merchant info card
  - Total amount highlight
  - Line items list
  - Confidence score indicator
  - Additional metadata

#### `Dashboard.tsx` (Receipt Tab)
- Grid view of all receipts
- Shows thumbnails and key info
- Click to open ReceiptPreview modal
- Refresh and delete functionality

### Display Flow
1. **Fetch documents** from database where `document_type = 'receipt'`
2. **Build storage URLs** using Supabase storage SDK
3. **Display in grid** with status badges
4. **Click to preview** opens modal with full details
5. **Real-time updates** via Supabase subscriptions

## 🔐 Security Architecture

### Multi-Tenant Isolation
- All queries filtered by `workspace_id`
- RLS policies enforce workspace boundaries
- Edge function validates workspace access

### Webhook Security
- Workspace validation before OCR
- User authentication required
- Service role key for admin operations

### Storage Security
- Public bucket for read access
- Write requires authentication
- Path includes workspace_id for organization

## 🔄 Data Flow Summary

```
User Upload → Storage Bucket → Database Record → n8n Webhook
                                                       ↓
Preview Display ← Database Update ← OCR Processing ← Validation
```

## 🎯 Key Features

- **Duplicate Detection**: SHA256 hash comparison (currently disabled for testing)
- **Real-time Updates**: Supabase subscriptions for processing status
- **Multiple Formats**: Supports both images and PDFs
- **Structured Extraction**: Parses receipts into actionable data
- **Confidence Scoring**: OCR reliability metrics
- **Workspace Isolation**: Complete multi-tenant data separation

## 📁 File Locations

### Frontend Components
- `/src/components/ReceiptUpload.tsx` - Upload interface
- `/src/components/ReceiptPreview.tsx` - Preview modal
- `/src/components/Dashboard.tsx` - Main dashboard with receipts tab

### Backend/Config
- `/supabase/functions/validate-workspace-access/` - Edge function for security
- `/n8n_secure_ocr_workflow.json` - n8n workflow configuration

### Environment Variables
```env
REACT_APP_SUPABASE_URL=https://rnevebffhtplbixdmbgq.supabase.co
REACT_APP_SUPABASE_ANON_KEY=your_anon_key
```

## 🚀 Setup Requirements

1. **Supabase Setup**:
   - Create `documents` table with proper columns
   - Create `receipts` storage bucket
   - Set bucket to PUBLIC for read access
   - Deploy edge function for validation

2. **n8n Setup**:
   - Import workflow JSON
   - Configure webhook URL
   - Set up OCR service credentials
   - Add Supabase connection

3. **Frontend Setup**:
   - Configure environment variables
   - Install dependencies
   - Deploy or run locally

## 🐛 Common Issues & Solutions

### Receipt Not Displaying
- **Check**: Is the `receipts` bucket set to PUBLIC?
- **Fix**: Toggle "Public bucket" in Supabase dashboard

### OCR Not Processing
- **Check**: Is the webhook URL correct?
- **Check**: Is n8n workflow active?
- **Fix**: Verify webhook endpoint and n8n status

### Cross-Tenant Data Leak
- **Check**: Is workspace validation edge function deployed?
- **Fix**: Deploy and configure edge function

### Duplicate Upload Prevention
- **Current**: Disabled for testing (`ENABLE_DUPLICATE_CHECK = false`)
- **Enable**: Set to `true` in `ReceiptUpload.tsx`