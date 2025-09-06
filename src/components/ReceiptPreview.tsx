import React, { useState, useMemo, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { 
  Calendar, 
  MapPin, 
  CreditCard, 
  Receipt, 
  AlertCircle,
  CheckCircle,
  X,
  Download,
  Maximize2,
  Eye,
  AlertTriangle,
  XCircle,
  Search
} from 'lucide-react';
import { formatCurrency } from '../lib/supabase';
import { TransactionMatchCard } from './TransactionMatchCard';
import { TransactionPreview } from './TransactionPreview';

// TypeScript types for document structure
export interface OCRLineItem {
  description: string;
  quantity: number;
  unit_price: number;
  total: number;
}

export interface OCRMetadata {
  merchant_name?: string;
  location?: string;
  total_amount?: number;
  currency?: string;
  transaction_date?: string;
  transaction_time?: string;
  line_items?: OCRLineItem[];
  tax_amount?: number;
  tip_amount?: number;
  payment_method?: string;
  receipt_number?: string;
  confidence_score?: number;
  extraction_notes?: string;
  parsed_data?: OCRMetadata; // New structure wraps data in parsed_data
  matching_result?: {
    status: 'auto_linked' | 'needs_review' | 'unmatched';
    transaction_id?: string;
    confidence?: number;
    reason?: string;
    candidates?: Array<{
      transaction_id: string;
      merchant_name: string;
      amount: number;
      date: string;
      confidence: number;
      match_factors?: string[];
      category?: string;
      location?: string;
    }>;
  };
}

export interface DocumentRecord {
  id: string;
  workspace_id: string;
  filename: string;
  file_size: number;
  mime_type: string;
  document_type: string;
  storage_path: string;
  storage_bucket: string;
  sha256_hash?: string;
  processing_status: 'uploaded' | 'processing' | 'processed' | 'error';
  ocr_metadata?: OCRMetadata;
  metadata?: any;
  created_at: string;
  updated_at?: string;
  created_by?: string;
  updated_by?: string;
}

interface ReceiptPreviewProps {
  document: DocumentRecord;
  onClose?: () => void;
  onDelete?: (id: string) => void;
}

export const ReceiptPreview: React.FC<ReceiptPreviewProps> = ({ 
  document, 
  onClose, 
  onDelete
}) => {
  const [imageError, setImageError] = useState(false);
  const [showFullscreen, setShowFullscreen] = useState(false);
  const [pdfError, setPdfError] = useState(false);
  const [imageLoading, setImageLoading] = useState(true);
  const [linkedTransaction, setLinkedTransaction] = useState<any>(null);
  const [loadingTransaction, setLoadingTransaction] = useState(true);
  const [showTransactionPreview, setShowTransactionPreview] = useState(false);

  // Fetch linked transaction if exists
  useEffect(() => {
    const fetchLinkedTransaction = async () => {
      setLoadingTransaction(true);
      try {
        console.log('Fetching document with attachments:', document.id);
        
        // Query through documents table with a join to bypass RLS issues
        const { data: docWithAttachments, error: docError } = await supabase
          .from('documents')
          .select(`
            *,
            document_attachments (
              id,
              attached_to_id,
              attached_to_type,
              attachment_type,
              created_at,
              created_by
            )
          `)
          .eq('id', document.id)
          .single();

        console.log('Document with attachments result:', { docWithAttachments, docError });

        const docData = docWithAttachments as any;
        if (docData?.document_attachments && docData.document_attachments.length > 0) {
          const attachment = docData.document_attachments[0];
          console.log('Found attachment via join, fetching transaction:', attachment.attached_to_id);
          
          // Fetch the linked transaction
          const { data: transaction, error: transError } = await supabase
            .from('feed_transactions')
            .select('*')
            .eq('id', attachment.attached_to_id)
            .maybeSingle();

          console.log('Transaction query result:', { transaction, transError });
          
          if (transaction) {
            setLinkedTransaction(transaction);
          }
        } else {
          console.log('No attachments found for document via join');
        }
      } catch (error) {
        console.error('Error in fetchLinkedTransaction:', error);
      } finally {
        setLoadingTransaction(false);
      }
    };

    fetchLinkedTransaction();
  }, [document.id]);

  // Build the storage URL - memoized to prevent infinite loops
  const imageUrl = useMemo(() => {
    // Always use 'receipts' bucket since that's where receipts are stored
    const bucketName = 'receipts';
    
    // Handle different path formats
    let path = document.storage_path;
    
    // If path starts with bucket name, remove it
    if (path?.startsWith('receipts/')) {
      path = path.substring('receipts/'.length);
    }
    
    // Use Supabase's getPublicUrl method for proper URL construction
    const { data } = supabase.storage
      .from(bucketName)
      .getPublicUrl(path);
    
    // Only log once when URL is created
    console.log('Receipt URL generated:', data.publicUrl);
    
    return data.publicUrl;
  }, [document.storage_path]); // Only recalculate if storage_path changes

  // Handle both old and new OCR metadata structures
  // New structure has data in parsed_data, old has it directly
  const rawOcr = document.ocr_metadata || {};
  const ocr = rawOcr.parsed_data || rawOcr;
  const isPDF = document.mime_type?.includes('pdf');

  // Calculate confidence level and color
  const getConfidenceInfo = () => {
    const score = ocr.confidence_score || 0;
    if (score >= 0.8) return { label: 'High', color: 'text-green-600', bg: 'bg-green-100' };
    if (score >= 0.6) return { label: 'Medium', color: 'text-yellow-600', bg: 'bg-yellow-100' };
    return { label: 'Low', color: 'text-red-600', bg: 'bg-red-100' };
  };

  const confidence = getConfidenceInfo();

  // Format date for display
  const formatDate = (date?: string, time?: string) => {
    if (!date) return 'Unknown';
    const dateStr = new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
    return time ? `${dateStr} at ${time}` : dateStr;
  };

  return (
    <>
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg overflow-hidden">
        {/* Header */}
        <div className="border-b border-gray-200 dark:border-gray-700 px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <Receipt className="h-5 w-5 text-gray-500" />
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                Receipt Preview
              </h3>
              {document.processing_status === 'processing' && (
                <span className="px-2 py-1 bg-blue-100 text-blue-700 text-xs rounded-full">
                  Processing OCR...
                </span>
              )}
              {document.processing_status === 'processed' && (
                <span className="px-2 py-1 bg-green-100 text-green-700 text-xs rounded-full">
                  OCR Complete
                </span>
              )}
              {document.processing_status === 'error' && (
                <span className="px-2 py-1 bg-red-100 text-red-700 text-xs rounded-full">
                  OCR Failed
                </span>
              )}
            </div>
            {onClose && (
              <button
                onClick={onClose}
                className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
              >
                <X className="h-5 w-5 text-gray-500" />
              </button>
            )}
          </div>
        </div>

        {/* Content */}
        <div className="flex flex-col lg:flex-row">
          {/* Left: Receipt Image */}
          <div className="lg:w-1/2 p-6 border-r border-gray-200 dark:border-gray-700 flex flex-col">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="font-medium text-gray-900 dark:text-white">Original Receipt</h4>
                <div className="flex space-x-2">
                  {!isPDF && (
                    <button
                      onClick={() => setShowFullscreen(true)}
                      className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                      title="View fullscreen"
                    >
                      <Maximize2 className="h-4 w-4 text-gray-500" />
                    </button>
                  )}
                  <a
                    href={imageUrl}
                    download={document.filename}
                    className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                    title="Download"
                  >
                    <Download className="h-4 w-4 text-gray-500" />
                  </a>
                </div>
              </div>

              <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-4 flex items-center justify-center" style={{ height: '450px', overflow: 'auto' }}>
                {!imageError ? (
                  isPDF ? (
                    <div className="w-full">
                      {!pdfError ? (
                        /* PDF Preview using iframe for better control */
                        <iframe
                          src={`${imageUrl}#view=FitH&zoom=page-fit`}
                          className="w-full rounded-lg border border-gray-300 dark:border-gray-600"
                          style={{ height: '450px' }}
                          title="PDF Preview"
                          onError={() => setPdfError(true)}
                        />
                      ) : (
                        /* Fallback for PDF that can't be embedded */
                        <div className="text-center py-12">
                          <Receipt className="h-16 w-16 text-gray-400 mx-auto mb-4" />
                          <p className="text-gray-600 dark:text-gray-400 mb-2">
                            PDF Receipt: {document.filename}
                          </p>
                          <p className="text-sm text-gray-500 mb-4">
                            Preview not available in browser
                          </p>
                          <a
                            href={imageUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                          >
                            <Maximize2 className="h-4 w-4 mr-2" />
                            View PDF
                          </a>
                        </div>
                      )}
                    </div>
                  ) : (
                    /* Image Preview */
                    <div className="w-full relative">
                      {imageLoading && (
                        <div className="absolute inset-0 flex items-center justify-center">
                          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 dark:border-gray-100" />
                        </div>
                      )}
                      <img
                        src={imageUrl}
                        alt={document.filename}
                        className="max-w-full max-h-full object-contain rounded-lg"
                        style={{ width: 'auto', height: 'auto' }}
                        onLoad={() => setImageLoading(false)}
                        onError={(e) => {
                          console.error('Image load error:', e);
                          setImageLoading(false);
                          setImageError(true);
                        }}
                      />
                    </div>
                  )
                ) : (
                  <div className="text-center py-8">
                    <AlertCircle className="h-16 w-16 text-gray-400 mx-auto mb-4" />
                    <p className="text-gray-600 dark:text-gray-400">
                      Unable to load receipt preview
                    </p>
                    <p className="text-sm text-gray-500 mt-2">
                      {document.filename}
                    </p>
                    <button
                      onClick={() => {
                        window.open(imageUrl, '_blank');
                      }}
                      className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                    >
                      Try Opening in New Tab
                    </button>
                    <div className="mt-4 p-3 bg-gray-100 dark:bg-gray-800 rounded text-xs text-left">
                      <p className="font-mono break-all">
                        URL: {imageUrl}
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {/* File Info */}
              <div className="text-sm text-gray-600 dark:text-gray-400 space-y-1">
                <p>Size: {(document.file_size / 1024).toFixed(1)} KB</p>
                <p>Uploaded: {new Date(document.created_at).toLocaleString()}</p>
                <p className="font-mono text-xs truncate">Hash: {document.sha256_hash}</p>
              </div>
            </div>
          </div>

          {/* Right: OCR Data */}
          <div className="lg:w-1/2 p-6">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="font-medium text-gray-900 dark:text-white">Extracted Data</h4>
                {ocr.confidence_score && (
                  <span className={`px-2 py-1 text-xs rounded-full ${confidence.bg} ${confidence.color}`}>
                    {confidence.label} Confidence ({(ocr.confidence_score * 100).toFixed(0)}%)
                  </span>
                )}
              </div>

              {document.processing_status === 'processed' && ocr.merchant_name ? (
                <div className="space-y-4">
                  {/* Merchant Info */}
                  <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-4">
                    <h5 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
                      {ocr.merchant_name || 'Unknown Merchant'}
                    </h5>
                    {ocr.location && (
                      <div className="flex items-center text-gray-600 dark:text-gray-400 text-sm">
                        <MapPin className="h-4 w-4 mr-2" />
                        {ocr.location}
                      </div>
                    )}
                    {(ocr.transaction_date || ocr.transaction_time) && (
                      <div className="flex items-center text-gray-600 dark:text-gray-400 text-sm mt-2">
                        <Calendar className="h-4 w-4 mr-2" />
                        {formatDate(ocr.transaction_date, ocr.transaction_time)}
                      </div>
                    )}
                  </div>

                  {/* Amount Summary */}
                  <div className="bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 rounded-lg p-4">
                    <div className="text-center">
                      <p className="text-sm text-gray-600 dark:text-gray-400">Total Amount</p>
                      <p className="text-3xl font-bold text-green-600 dark:text-green-400">
                        {formatCurrency((ocr.total_amount || 0) * 100, ocr.currency || 'USD')}
                      </p>
                    </div>
                    <div className="grid grid-cols-2 gap-4 mt-4 text-sm">
                      {ocr.tax_amount !== undefined && (
                        <div>
                          <p className="text-gray-600 dark:text-gray-400">Tax</p>
                          <p className="font-medium">{formatCurrency(ocr.tax_amount * 100)}</p>
                        </div>
                      )}
                      {ocr.tip_amount !== undefined && (
                        <div>
                          <p className="text-gray-600 dark:text-gray-400">Tip</p>
                          <p className="font-medium">{formatCurrency(ocr.tip_amount * 100)}</p>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Line Items */}
                  {ocr.line_items && ocr.line_items.length > 0 && (
                    <div className="space-y-2">
                      <h5 className="font-medium text-gray-900 dark:text-white">Items</h5>
                      <div className="max-h-48 overflow-y-auto space-y-2">
                        {ocr.line_items.map((item: OCRLineItem, index: number) => (
                          <div key={index} className="flex justify-between items-center py-2 border-b border-gray-100 dark:border-gray-700 last:border-0">
                            <div className="flex-1">
                              <p className="text-sm font-medium text-gray-900 dark:text-white">
                                {item.description}
                              </p>
                              <p className="text-xs text-gray-500">
                                Qty: {item.quantity} × {formatCurrency(item.unit_price * 100)}
                              </p>
                            </div>
                            <p className="text-sm font-medium text-gray-900 dark:text-white">
                              {formatCurrency(item.total * 100)}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Additional Details */}
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    {ocr.payment_method && (
                      <div className="flex items-center space-x-2">
                        <CreditCard className="h-4 w-4 text-gray-400" />
                        <span className="text-gray-600 dark:text-gray-400">
                          {ocr.payment_method}
                        </span>
                      </div>
                    )}
                    {ocr.receipt_number && (
                      <div className="text-gray-600 dark:text-gray-400">
                        Receipt #{ocr.receipt_number}
                      </div>
                    )}
                  </div>

                  {/* Extraction Notes */}
                  {ocr.extraction_notes && (
                    <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-3">
                      <p className="text-sm text-blue-800 dark:text-blue-300">
                        <AlertCircle className="h-4 w-4 inline mr-2" />
                        {ocr.extraction_notes}
                      </p>
                    </div>
                  )}

                  {/* Matching Actions Based on Status */}
                  <div className="mt-6 border-t border-gray-200 dark:border-gray-700 pt-6">
                    {(() => {
                      // Check for linked transaction first (from document_attachments)
                      if (linkedTransaction && !loadingTransaction) {
                        return (
                          <div className="space-y-4">
                            <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
                              <div className="flex items-start">
                                <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400 mt-0.5 mr-3 flex-shrink-0" />
                                <div className="flex-1">
                                  <h4 className="text-sm font-semibold text-green-900 dark:text-green-300">
                                    Successfully Linked
                                  </h4>
                                  <p className="text-sm text-green-700 dark:text-green-400 mt-1">
                                    This receipt is linked to: <span className="font-semibold">{linkedTransaction.merchant_name || 'Unknown Merchant'}</span>
                                  </p>
                                  <p className="text-xs text-green-600 dark:text-green-400 mt-1">
                                    Amount: {formatCurrency(linkedTransaction.amount_cents)} • 
                                    Date: {new Date(linkedTransaction.transaction_date).toLocaleDateString()}
                                  </p>
                                </div>
                              </div>
                            </div>
                            <div className="flex space-x-3">
                              <button
                                onClick={() => setShowTransactionPreview(true)}
                                className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors flex items-center justify-center"
                              >
                                <Eye className="h-4 w-4 mr-2" />
                                View Transaction
                              </button>
                              <button
                                onClick={() => console.log('Unlink transaction:', linkedTransaction.id)}
                                className="px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                              >
                                Unlink
                              </button>
                            </div>
                          </div>
                        );
                      }

                      // Matching result should be at the root level of ocr_metadata, not in parsed_data
                      const matchingResult = rawOcr.matching_result;
                      
                      // Auto-linked receipt (from matching_result field)
                      if (matchingResult?.status === 'auto_linked') {
                        return (
                          <div className="space-y-4">
                            <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
                              <div className="flex items-start">
                                <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400 mt-0.5 mr-3 flex-shrink-0" />
                                <div className="flex-1">
                                  <h4 className="text-sm font-semibold text-green-900 dark:text-green-300">
                                    Successfully Linked
                                  </h4>
                                  <p className="text-sm text-green-700 dark:text-green-400 mt-1">
                                    This receipt has been automatically matched to a transaction 
                                    {matchingResult.confidence && (
                                      <span className="font-semibold"> ({Math.round(matchingResult.confidence * 100)}% confidence)</span>
                                    )}
                                  </p>
                                </div>
                              </div>
                            </div>
                            <div className="flex space-x-3">
                              <button
                                onClick={() => console.log('View transaction:', matchingResult.transaction_id)}
                                className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors flex items-center justify-center"
                              >
                                <Eye className="h-4 w-4 mr-2" />
                                View Transaction
                              </button>
                              <button
                                onClick={() => console.log('Unlink transaction:', matchingResult.transaction_id)}
                                className="px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                              >
                                Unlink
                              </button>
                            </div>
                          </div>
                        );
                      }
                      
                      // Needs review - show candidates
                      if (matchingResult?.status === 'needs_review' && matchingResult.candidates) {
                        return (
                          <div className="space-y-4">
                            <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
                              <div className="flex items-start">
                                <AlertTriangle className="h-5 w-5 text-yellow-600 dark:text-yellow-400 mt-0.5 mr-3 flex-shrink-0" />
                                <div className="flex-1">
                                  <h4 className="text-sm font-semibold text-yellow-900 dark:text-yellow-300">
                                    Review Required
                                  </h4>
                                  <p className="text-sm text-yellow-700 dark:text-yellow-400 mt-1">
                                    We found {matchingResult.candidates.length} possible match{matchingResult.candidates.length > 1 ? 'es' : ''} for this receipt. Please select the correct transaction.
                                  </p>
                                </div>
                              </div>
                            </div>
                            
                            <div className="space-y-4">
                              <h5 className="text-base font-semibold text-gray-900 dark:text-gray-100 flex items-center">
                                <span>Possible Matches</span>
                                <span className="ml-2 text-xs font-normal text-gray-500 dark:text-gray-400">
                                  (Ranked by confidence)
                                </span>
                              </h5>
                              <div className="space-y-3">
                                {matchingResult.candidates
                                  .sort((a, b) => b.confidence - a.confidence)
                                  .map((candidate, index) => (
                                    <TransactionMatchCard
                                      key={candidate.transaction_id}
                                      candidate={candidate}
                                      onSelect={(transactionId) => {
                                        console.log('Selected transaction:', transactionId);
                                        // TODO: Implement actual linking logic
                                        alert(`Linking receipt to transaction: ${transactionId}`);
                                      }}
                                      index={index}
                                    />
                                  ))}
                              </div>
                              
                              <div className="pt-2 border-t border-gray-200 dark:border-gray-700">
                                <button
                                  onClick={() => console.log('No match - search manually')}
                                  className="w-full px-4 py-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 transition-colors flex items-center justify-center"
                                >
                                  <Search className="h-4 w-4 mr-2" />
                                  None of these match - Search manually
                                </button>
                              </div>
                            </div>
                          </div>
                        );
                      }
                      
                      // Unmatched
                      if (matchingResult?.status === 'unmatched') {
                        return (
                          <div className="space-y-4">
                            <div className="bg-gray-50 dark:bg-gray-900/20 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                              <div className="flex items-start">
                                <XCircle className="h-5 w-5 text-gray-500 dark:text-gray-400 mt-0.5 mr-3 flex-shrink-0" />
                                <div className="flex-1">
                                  <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-300">
                                    No Match Found
                                  </h4>
                                  <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                                    No matching transaction found in your accounts. 
                                    {matchingResult.reason && (
                                      <span className="block mt-1 text-xs">{matchingResult.reason}</span>
                                    )}
                                  </p>
                                </div>
                              </div>
                            </div>
                            <button
                              onClick={() => console.log('Search manually')}
                              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors flex items-center justify-center"
                            >
                              <Search className="h-4 w-4 mr-2" />
                              Search Transactions Manually
                            </button>
                          </div>
                        );
                      }
                      
                      // Still loading transaction data
                      if (loadingTransaction) {
                        return (
                          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                            <div className="flex items-center">
                              <div className="animate-spin rounded-full h-5 w-5 border-2 border-blue-600 border-t-transparent mr-3"></div>
                              <div className="flex-1">
                                <h4 className="text-sm font-semibold text-blue-900 dark:text-blue-300">
                                  Loading Match Status
                                </h4>
                                <p className="text-sm text-blue-700 dark:text-blue-400 mt-1">
                                  Checking for linked transactions...
                                </p>
                              </div>
                            </div>
                          </div>
                        );
                      }
                      
                      // No matching data available but OCR is complete
                      if (document.processing_status === 'processed' && !matchingResult && !linkedTransaction) {
                        return (
                          <div className="space-y-4">
                            <div className="bg-gray-50 dark:bg-gray-900/20 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                              <div className="flex items-start">
                                <AlertCircle className="h-5 w-5 text-gray-500 dark:text-gray-400 mt-0.5 mr-3 flex-shrink-0" />
                                <div className="flex-1">
                                  <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-300">
                                    Ready for Matching
                                  </h4>
                                  <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                                    This receipt has been processed and is ready to be matched with a transaction.
                                  </p>
                                </div>
                              </div>
                            </div>
                            <button
                              onClick={() => console.log('Run matching workflow')}
                              className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center justify-center"
                            >
                              <Search className="h-4 w-4 mr-2" />
                              Find Matching Transactions
                            </button>
                          </div>
                        );
                      }
                      
                      // Still processing OCR
                      if (document.processing_status !== 'processed') {
                        return (
                          <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
                            <div className="flex items-center">
                              <div className="animate-spin rounded-full h-5 w-5 border-2 border-yellow-600 border-t-transparent mr-3"></div>
                              <div className="flex-1">
                                <h4 className="text-sm font-semibold text-yellow-900 dark:text-yellow-300">
                                  Processing Receipt
                                </h4>
                                <p className="text-sm text-yellow-700 dark:text-yellow-400 mt-1">
                                  OCR is still processing this receipt...
                                </p>
                              </div>
                            </div>
                          </div>
                        );
                      }
                      
                      return null;
                    })()}
                  </div>

                  {/* Delete Action */}
                  <div className="flex justify-end pt-4">
                    {onDelete && (
                      <button
                        onClick={() => onDelete(document.id)}
                        className="px-4 py-2 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                      >
                        Delete Receipt
                      </button>
                    )}
                  </div>
                </div>
              ) : document.processing_status === 'processing' ? (
                <div className="text-center py-12">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
                  <p className="text-gray-600 dark:text-gray-400">
                    Processing receipt with OCR...
                  </p>
                  <p className="text-sm text-gray-500 mt-2">
                    This may take a few moments
                  </p>
                </div>
              ) : document.processing_status === 'uploaded' ? (
                <div className="text-center py-12">
                  <AlertCircle className="h-12 w-12 text-yellow-500 mx-auto mb-4" />
                  <p className="text-gray-600 dark:text-gray-400">
                    Receipt uploaded, waiting for OCR processing
                  </p>
                </div>
              ) : (
                <div className="text-center py-12">
                  <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
                  <p className="text-gray-600 dark:text-gray-400">
                    No OCR data available
                  </p>
                  <p className="text-sm text-gray-500 mt-2">
                    {document.processing_status === 'error' 
                      ? 'OCR processing failed' 
                      : 'Receipt has not been processed yet'}
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Fullscreen Modal */}
      {showFullscreen && !isPDF && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-90 z-50 flex items-center justify-center p-8"
          onClick={() => setShowFullscreen(false)}
        >
          <div className="relative w-full h-full flex items-center justify-center">
            <button
              onClick={() => setShowFullscreen(false)}
              className="absolute top-4 right-4 p-2 bg-white rounded-full hover:bg-gray-100 transition-colors z-10"
            >
              <X className="h-6 w-6 text-gray-900" />
            </button>
            <img
              src={imageUrl}
              alt={document.filename}
              className="max-w-full max-h-full object-contain"
              style={{ maxHeight: '90vh', maxWidth: '90vw' }}
              onClick={(e) => e.stopPropagation()}
            />
          </div>
        </div>
      )}

      {/* Transaction Preview Modal */}
      {showTransactionPreview && linkedTransaction && (
        <TransactionPreview
          transaction={linkedTransaction}
          receipt={document}
          onClose={() => setShowTransactionPreview(false)}
          onUnlink={() => {
            console.log('Unlink transaction:', linkedTransaction.id);
            // TODO: Implement actual unlinking logic
          }}
        />
      )}
    </>
  );
};