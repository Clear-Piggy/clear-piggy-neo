import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { 
  ChevronDown, 
  ChevronRight, 
  Search, 
  Filter,
  CheckCircle,
  Clock,
  AlertCircle,
  Eye,
  Edit,
  MoreVertical,
  Link,
  Tag,
  Calendar,
  DollarSign,
  TrendingUp,
  FileText,
  MapPin,
  Trash2,
  X,
  Check,
  CreditCard,
  Building2
} from 'lucide-react';
import { formatCurrency, supabase } from '../lib/supabase';
import { ReceiptPreview } from './ReceiptPreview';

interface Receipt {
  id: string;
  filename: string;
  merchant_name?: string;
  amount?: number;
  date: string;
  category?: string;
  status: 'processing' | 'linked' | 'unlinked' | 'needs_review';
  confidence?: number;
  location?: string;
  isExpense?: boolean;
  processing_status: string;
  ocr_metadata?: any;
  file_size: number;
  mime_type: string;
  storage_path: string;
  created_at: string;
  workspace_id: string;
  document_type: string;
  document_attachments?: Array<{
    id: string;
    attached_to_id: string;
    attached_to_type: string;
    attachment_type?: string;
    created_at: string;
    created_by?: string;
  }>;
}

interface SmartReceiptTableProps {
  receipts: Receipt[];
  loading?: boolean;
  onRefresh?: () => void;
}

type GroupBy = 'date' | 'status' | 'category';

export const SmartReceiptTable: React.FC<SmartReceiptTableProps> = ({ 
  receipts, 
  loading = false,
  onRefresh 
}) => {
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set(['Today', 'Yesterday', 'This Week']));
  const [selectedReceipts, setSelectedReceipts] = useState<Set<string>>(new Set());
  const [groupBy, setGroupBy] = useState<GroupBy>('date');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedReceipt, setSelectedReceipt] = useState<Receipt | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [linkedTransactions, setLinkedTransactions] = useState<{[key: string]: any}>({});
  const [loadingTransactions, setLoadingTransactions] = useState<Set<string>>(new Set());

  // Get receipt data from OCR metadata
  const getReceiptData = (receipt: any) => {
    const ocr = receipt.ocr_metadata?.parsed_data || receipt.ocr_metadata || {};
    const matchingResult = receipt.ocr_metadata?.matching_result;
    
    let status: Receipt['status'] = 'unlinked';
    
    // Check if still processing
    if (receipt.processing_status === 'processing') {
      status = 'processing';
    } 
    // Check for linked transaction through document_attachments
    else if (receipt.document_attachments && receipt.document_attachments.length > 0) {
      status = 'linked';
    }
    // Check matching_result field as fallback
    else if (matchingResult?.status === 'auto_linked') {
      status = 'linked';
    } else if (matchingResult?.status === 'needs_review') {
      status = 'needs_review';
    }

    return {
      ...receipt,
      merchant_name: ocr.merchant_name || receipt.filename,
      amount: ocr.total_amount ? parseFloat(ocr.total_amount) * 100 : undefined,
      date: ocr.transaction_date || receipt.created_at,
      category: ocr.category || 'Uncategorized',
      status,
      confidence: ocr.confidence_score,
      location: ocr.location,
      isExpense: true,
      document_attachments: receipt.document_attachments
    };
  };

  // Process receipts with OCR data
  const processedReceipts = useMemo(() => {
    return receipts.map(getReceiptData);
  }, [receipts]);

  // Filter receipts based on search
  const filteredReceipts = useMemo(() => {
    if (!searchTerm) return processedReceipts;
    const term = searchTerm.toLowerCase();
    return processedReceipts.filter(r => 
      r.merchant_name?.toLowerCase().includes(term) ||
      r.filename.toLowerCase().includes(term) ||
      r.category?.toLowerCase().includes(term)
    );
  }, [processedReceipts, searchTerm]);

  // Group receipts
  const groupedReceipts = useMemo(() => {
    const groups: { [key: string]: Receipt[] } = {};
    
    filteredReceipts.forEach(receipt => {
      let groupKey: string;
      
      if (groupBy === 'date') {
        const receiptDate = new Date(receipt.date);
        const today = new Date();
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);
        const weekAgo = new Date(today);
        weekAgo.setDate(weekAgo.getDate() - 7);
        
        if (receiptDate.toDateString() === today.toDateString()) {
          groupKey = 'Today';
        } else if (receiptDate.toDateString() === yesterday.toDateString()) {
          groupKey = 'Yesterday';
        } else if (receiptDate > weekAgo) {
          groupKey = 'This Week';
        } else {
          groupKey = 'Older';
        }
      } else if (groupBy === 'status') {
        switch (receipt.status) {
          case 'processing':
            groupKey = 'Processing';
            break;
          case 'linked':
            groupKey = 'Linked to Transactions';
            break;
          case 'needs_review':
            groupKey = 'Needs Review';
            break;
          default:
            groupKey = 'Unlinked';
        }
      } else {
        groupKey = receipt.category || 'Uncategorized';
      }
      
      if (!groups[groupKey]) {
        groups[groupKey] = [];
      }
      groups[groupKey].push(receipt);
    });
    
    return groups;
  }, [filteredReceipts, groupBy]);

  // Fetch linked transaction when expanding a row
  const fetchLinkedTransaction = async (receipt: any) => {
    if (!receipt.document_attachments || receipt.document_attachments.length === 0) return;
    
    const attachmentId = receipt.document_attachments[0].attached_to_id;
    
    // Clear cache to force refresh (for debugging)
    delete linkedTransactions[attachmentId];
    
    setLoadingTransactions(prev => new Set(prev).add(receipt.id));
    
    try {
      // Fetch the transaction
      const { data: transactionData, error: transactionError } = await supabase
        .from('feed_transactions')
        .select('*')
        .eq('id', attachmentId)
        .single();
      
      console.log('Fetched transaction:', transactionData, 'Error:', transactionError);
      
      if (transactionData && !transactionError) {
        const transaction = transactionData as any;
        
        // Set account display name - we'll try to get more info if possible
        // For now, just show that it's linked to a bank account
        if (transaction.bank_account_id) {
          // We have a bank account ID but may not have access to the bank_accounts table
          // due to RLS policies. Show what we can.
          transaction.account_display_name = transaction.account_name || 'Linked Bank Account';
          
          // Try to fetch more details if possible (may fail due to RLS)
          try {
            // Try with basic columns first
            const { data: accountData, error: accountError } = await supabase
              .from('bank_accounts')
              .select('*')
              .eq('id', transaction.bank_account_id)
              .single();
            
            if (accountData && !accountError) {
              const account = accountData as any;
              console.log('Bank account data:', account);
              
              // Build display name from available fields
              const institution = account.institution_name || account.institution || '';
              const name = account.official_name || account.name || 'Account';
              const mask = account.mask || account.last4 || '';
              const subtype = account.subtype || account.account_subtype || '';
              
              // Format: "Institution Name (type) ****1234"
              let displayParts = [];
              if (institution) displayParts.push(institution);
              if (name && name !== 'Account') displayParts.push(name);
              if (subtype) displayParts.push(`(${subtype})`);
              if (mask) displayParts.push(`****${mask}`);
              
              transaction.account_display_name = displayParts.join(' ') || 'Linked Bank Account';
              console.log('Account display name:', transaction.account_display_name);
            } else {
              console.log('Could not fetch bank account details:', accountError?.message);
            }
          } catch (err) {
            console.log('Error fetching bank account:', err);
          }
        } else {
          transaction.account_display_name = transaction.account_name || 'Cash/Other';
        }
        
        // Add merchant logo URL if available
        if (transaction.merchant_name) {
          // Try to get logo from merchant_logo field or construct from merchant name
          if (transaction.logo_url) {
            transaction.merchant_logo_url = transaction.logo_url;
          } else if (transaction.merchant_logo) {
            transaction.merchant_logo_url = transaction.merchant_logo;
          } else {
            // Use Clearbit Logo API as fallback for known merchants
            const merchantName = transaction.merchant_name.toLowerCase();
            // Only use Clearbit for well-known merchants
            if (merchantName.includes('panera') || merchantName.includes('starbucks') || 
                merchantName.includes('walmart') || merchantName.includes('target') ||
                merchantName.includes('amazon') || merchantName.includes('mcdonalds')) {
              const merchantDomain = merchantName.replace(/[^a-z0-9]/g, '');
              transaction.merchant_logo_url = `https://logo.clearbit.com/${merchantDomain}.com`;
            }
          }
        }
        
        setLinkedTransactions(prev => ({
          ...prev,
          [attachmentId]: transaction
        }));
      }
    } catch (error) {
      console.error('Error fetching transaction:', error);
    } finally {
      setLoadingTransactions(prev => {
        const newSet = new Set(prev);
        newSet.delete(receipt.id);
        return newSet;
      });
    }
  };

  // Toggle row expansion
  const toggleRow = useCallback((id: string, receipt?: any) => {
    setExpandedRows(prev => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
        // Fetch linked transaction when expanding
        if (receipt && receipt.status === 'linked') {
          fetchLinkedTransaction(receipt);
        }
      }
      return newSet;
    });
  }, []);

  // Toggle group expansion
  const toggleGroup = useCallback((group: string) => {
    setExpandedGroups(prev => {
      const newSet = new Set(prev);
      if (newSet.has(group)) {
        newSet.delete(group);
      } else {
        newSet.add(group);
      }
      return newSet;
    });
  }, []);

  // Toggle receipt selection
  const toggleSelection = useCallback((id: string, event?: React.MouseEvent | React.ChangeEvent) => {
    event?.stopPropagation();
    setSelectedReceipts(prev => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  }, []);

  // Select all in group
  const selectAllInGroup = useCallback((groupReceipts: Receipt[], event?: React.MouseEvent | React.ChangeEvent) => {
    event?.stopPropagation();
    const allSelected = groupReceipts.every(r => selectedReceipts.has(r.id));
    
    setSelectedReceipts(prev => {
      const newSet = new Set(prev);
      groupReceipts.forEach(r => {
        if (allSelected) {
          newSet.delete(r.id);
        } else {
          newSet.add(r.id);
        }
      });
      return newSet;
    });
  }, [selectedReceipts]);

  // Get status icon
  const getStatusIcon = (status: Receipt['status']) => {
    switch (status) {
      case 'linked':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'processing':
        return <Clock className="h-4 w-4 text-blue-500 animate-spin" />;
      case 'needs_review':
        return <AlertCircle className="h-4 w-4 text-yellow-500" />;
      default:
        return <AlertCircle className="h-4 w-4 text-gray-400" />;
    }
  };

  // Get status label
  const getStatusLabel = (status: Receipt['status']) => {
    switch (status) {
      case 'linked':
        return 'Linked';
      case 'processing':
        return 'Processing';
      case 'needs_review':
        return 'Review';
      default:
        return 'Unlinked';
    }
  };

  // Calculate group totals
  const getGroupTotal = (groupReceipts: Receipt[]) => {
    return groupReceipts.reduce((sum, r) => sum + (r.amount || 0), 0);
  };

  // Bulk actions
  const handleBulkDelete = () => {
    if (window.confirm(`Delete ${selectedReceipts.size} receipt(s)?`)) {
      // Implement bulk delete
      console.log('Deleting:', Array.from(selectedReceipts));
      setSelectedReceipts(new Set());
    }
  };

  const handleBulkLink = () => {
    console.log('Linking:', Array.from(selectedReceipts));
    // Implement bulk link
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header with search and filters */}
      <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1 flex gap-2">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search receipts..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`px-4 py-2 rounded-lg border transition-colors ${
                showFilters 
                  ? 'bg-blue-50 border-blue-300 text-blue-700 dark:bg-blue-900/30 dark:border-blue-700 dark:text-blue-400'
                  : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50 dark:bg-gray-700 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-600'
              }`}
            >
              <Filter className="h-4 w-4" />
            </button>
          </div>
          
          <div className="flex gap-2">
            <select
              value={groupBy}
              onChange={(e) => setGroupBy(e.target.value as GroupBy)}
              className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
            >
              <option value="date">Group by Date</option>
              <option value="status">Group by Status</option>
              <option value="category">Group by Category</option>
            </select>
            
            {onRefresh && (
              <button
                onClick={onRefresh}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                Refresh
              </button>
            )}
          </div>
        </div>

        {/* Bulk actions bar */}
        {selectedReceipts.size > 0 && (
          <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg flex items-center justify-between">
            <span className="text-sm font-medium text-blue-900 dark:text-blue-300">
              {selectedReceipts.size} receipt{selectedReceipts.size !== 1 ? 's' : ''} selected
            </span>
            <div className="flex gap-2">
              <button
                onClick={handleBulkLink}
                className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
              >
                Link to Transactions
              </button>
              <button
                onClick={handleBulkDelete}
                className="px-3 py-1 text-sm bg-red-600 text-white rounded hover:bg-red-700 transition-colors"
              >
                Delete
              </button>
              <button
                onClick={() => setSelectedReceipts(new Set())}
                className="px-3 py-1 text-sm border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
              >
                Clear
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Table content */}
      <div className="flex-1 overflow-auto">
        {loading ? (
          <div className="p-8 text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-4 text-gray-500 dark:text-gray-400">Loading receipts...</p>
          </div>
        ) : Object.keys(groupedReceipts).length === 0 ? (
          <div className="p-8 text-center">
            <FileText className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-500 dark:text-gray-400">No receipts found</p>
            {searchTerm && (
              <p className="text-sm text-gray-400 dark:text-gray-500 mt-2">
                Try adjusting your search terms
              </p>
            )}
          </div>
        ) : (
          <div className="divide-y divide-gray-200 dark:divide-gray-700">
            {Object.entries(groupedReceipts).map(([groupName, groupReceipts]) => (
              <div key={groupName}>
                {/* Group header */}
                <div
                  className="px-6 py-3 bg-gray-50 dark:bg-gray-900/50 sticky top-0 z-10 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-900/70 transition-colors"
                  onClick={() => toggleGroup(groupName)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <button className="p-1">
                        {expandedGroups.has(groupName) ? (
                          <ChevronDown className="h-4 w-4 text-gray-500" />
                        ) : (
                          <ChevronRight className="h-4 w-4 text-gray-500" />
                        )}
                      </button>
                      <input
                        type="checkbox"
                        checked={groupReceipts.every(r => selectedReceipts.has(r.id))}
                        onChange={(e) => selectAllInGroup(groupReceipts, e)}
                        onClick={(e) => e.stopPropagation()}
                        className="rounded border-gray-300 dark:border-gray-600"
                      />
                      <h3 className="font-medium text-gray-900 dark:text-white">
                        {groupName}
                      </h3>
                      <span className="text-sm text-gray-500 dark:text-gray-400">
                        {groupReceipts.length} receipt{groupReceipts.length !== 1 ? 's' : ''}
                      </span>
                    </div>
                    <div className="text-sm font-medium text-gray-900 dark:text-white">
                      {formatCurrency(getGroupTotal(groupReceipts))}
                    </div>
                  </div>
                </div>

                {/* Group content */}
                {expandedGroups.has(groupName) && (
                  <div className="divide-y divide-gray-200 dark:divide-gray-700">
                    {groupReceipts.map(receipt => (
                      <div key={receipt.id}>
                        {/* Receipt row */}
                        <div
                          className="px-6 py-4 hover:bg-gray-50 dark:hover:bg-gray-900/30 cursor-pointer transition-colors"
                          onClick={() => toggleRow(receipt.id, receipt)}
                        >
                          <div className="flex items-center gap-4">
                            {/* Checkbox */}
                            <input
                              type="checkbox"
                              checked={selectedReceipts.has(receipt.id)}
                              onChange={(e) => toggleSelection(receipt.id, e)}
                              onClick={(e) => e.stopPropagation()}
                              className="rounded border-gray-300 dark:border-gray-600"
                            />

                            {/* Expand indicator */}
                            <button className="p-1">
                              {expandedRows.has(receipt.id) ? (
                                <ChevronDown className="h-4 w-4 text-gray-500" />
                              ) : (
                                <ChevronRight className="h-4 w-4 text-gray-500" />
                              )}
                            </button>

                            {/* Receipt info */}
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <h4 className="font-medium text-gray-900 dark:text-white truncate">
                                  {receipt.merchant_name}
                                </h4>
                                {receipt.isExpense && (
                                  <span className="px-2 py-0.5 text-xs font-medium bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400 rounded">
                                    Business
                                  </span>
                                )}
                              </div>
                              <p className="text-sm text-gray-500 dark:text-gray-400">
                                {new Date(receipt.date).toLocaleDateString()}
                              </p>
                            </div>

                            {/* Amount */}
                            <div className="text-right">
                              <p className="font-semibold text-gray-900 dark:text-white">
                                {receipt.amount ? formatCurrency(receipt.amount) : '-'}
                              </p>
                            </div>

                            {/* Category */}
                            <div className="hidden sm:flex items-center gap-1">
                              <Tag className="h-4 w-4 text-gray-400" />
                              <span className="text-sm text-gray-600 dark:text-gray-400">
                                {receipt.category}
                              </span>
                            </div>

                            {/* Status */}
                            <div className="flex items-center gap-1">
                              {getStatusIcon(receipt.status)}
                              <span className="text-sm font-medium text-gray-600 dark:text-gray-400">
                                {getStatusLabel(receipt.status)}
                              </span>
                            </div>

                            {/* Actions */}
                            <div className="flex items-center gap-2">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSelectedReceipt(receipt);
                                }}
                                className="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                              >
                                <Eye className="h-4 w-4" />
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  // Implement edit
                                }}
                                className="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                              >
                                <Edit className="h-4 w-4" />
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  // Implement more menu
                                }}
                                className="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                              >
                                <MoreVertical className="h-4 w-4" />
                              </button>
                            </div>
                          </div>
                        </div>

                        {/* Expanded details */}
                        {expandedRows.has(receipt.id) && (
                          <div className="px-6 py-4 bg-gray-50 dark:bg-gray-900/50 border-t border-gray-200 dark:border-gray-700">
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                              {/* Receipt details */}
                              <div>
                                <h5 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                  Receipt Details
                                </h5>
                                <div className="space-y-1 text-sm">
                                  {receipt.location && (
                                    <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
                                      <MapPin className="h-3 w-3" />
                                      <span>{receipt.location}</span>
                                    </div>
                                  )}
                                  <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
                                    <FileText className="h-3 w-3" />
                                    <span>{(receipt.file_size / 1024).toFixed(1)} KB</span>
                                  </div>
                                  {receipt.confidence && (
                                    <div className="flex items-center gap-2">
                                      <span className="text-gray-600 dark:text-gray-400">Confidence:</span>
                                      <span className={`font-medium ${
                                        receipt.confidence > 0.8 ? 'text-green-600' : 
                                        receipt.confidence > 0.6 ? 'text-yellow-600' : 'text-red-600'
                                      }`}>
                                        {(receipt.confidence * 100).toFixed(0)}%
                                      </span>
                                    </div>
                                  )}
                                </div>
                              </div>

                              {/* Quick actions */}
                              <div>
                                <h5 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                  Quick Actions
                                </h5>
                                <div className="flex flex-wrap gap-2">
                                  <button className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors">
                                    View Full
                                  </button>
                                  {receipt.status === 'unlinked' && (
                                    <button className="px-3 py-1 text-sm border border-blue-600 text-blue-600 dark:text-blue-400 rounded hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors">
                                      Link Transaction
                                    </button>
                                  )}
                                  <button className="px-3 py-1 text-sm border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                                    Edit Category
                                  </button>
                                </div>
                              </div>

                              {/* AI Insights */}
                              <div>
                                <h5 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                  AI Insights
                                </h5>
                                <div className="space-y-1 text-sm text-gray-600 dark:text-gray-400">
                                  <div className="flex items-center gap-2">
                                    <TrendingUp className="h-3 w-3 text-green-500" />
                                    <span>Potential tax deduction</span>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <DollarSign className="h-3 w-3 text-blue-500" />
                                    <span>Within monthly budget</span>
                                  </div>
                                </div>
                              </div>
                            </div>

                            {/* Transaction link status */}
                            {receipt.status === 'linked' && (
                              <div className="mt-4 p-4 bg-green-50 dark:bg-green-900/20 rounded-lg">
                                <div className="flex items-center gap-2 mb-3">
                                  <Link className="h-4 w-4 text-green-600 dark:text-green-400" />
                                  <span className="text-sm font-medium text-green-900 dark:text-green-300">
                                    Linked Transaction
                                  </span>
                                </div>
                                
                                {(() => {
                                  const attachmentId = receipt.document_attachments?.[0]?.attached_to_id;
                                  const transaction = attachmentId ? linkedTransactions[attachmentId] : null;
                                  const isLoading = loadingTransactions.has(receipt.id);
                                  
                                  if (isLoading) {
                                    return (
                                      <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                                        <div className="animate-spin rounded-full h-4 w-4 border-2 border-green-600 border-t-transparent"></div>
                                        <span>Loading transaction details...</span>
                                      </div>
                                    );
                                  }
                                  
                                  if (transaction) {
                                    return (
                                      <div className="space-y-2">
                                        <div className="flex items-start justify-between">
                                          <div className="flex-1">
                                            <div className="flex items-center gap-2">
                                              {transaction.merchant_logo_url ? (
                                                <img 
                                                  src={transaction.merchant_logo_url} 
                                                  alt={transaction.merchant_name}
                                                  className="h-5 w-5 rounded object-contain bg-white"
                                                  onError={(e) => {
                                                    (e.target as HTMLImageElement).style.display = 'none';
                                                  }}
                                                />
                                              ) : (
                                                <Building2 className="h-4 w-4 text-gray-400" />
                                              )}
                                              <span className="text-sm font-medium text-gray-900 dark:text-white">
                                                {transaction.merchant_name || transaction.description}
                                              </span>
                                            </div>
                                            <div className="flex items-center gap-4 mt-1">
                                              <div className="flex items-center gap-1">
                                                <Calendar className="h-3 w-3 text-gray-400" />
                                                <span className="text-xs text-gray-600 dark:text-gray-400">
                                                  {new Date(transaction.transaction_date).toLocaleDateString()}
                                                </span>
                                              </div>
                                              <div className="flex items-center gap-1">
                                                <CreditCard className="h-3 w-3 text-gray-400" />
                                                <span className="text-xs text-gray-600 dark:text-gray-400">
                                                  {transaction.account_display_name}
                                                </span>
                                              </div>
                                            </div>
                                          </div>
                                          <div className="text-right">
                                            <p className="text-sm font-semibold text-gray-900 dark:text-white">
                                              {formatCurrency(Math.abs(transaction.amount_cents))}
                                            </p>
                                            <p className="text-xs text-gray-500 dark:text-gray-400">
                                              {transaction.amount_cents < 0 ? 'Debit' : 'Credit'}
                                            </p>
                                          </div>
                                        </div>
                                        <div className="flex gap-2">
                                          <button 
                                            onClick={() => setSelectedReceipt(receipt)}
                                            className="text-xs px-2 py-1 bg-green-600 text-white rounded hover:bg-green-700 transition-colors"
                                          >
                                            View Full Details
                                          </button>
                                          <button className="text-xs px-2 py-1 text-green-600 dark:text-green-400 border border-green-600 dark:border-green-400 rounded hover:bg-green-50 dark:hover:bg-green-900/20 transition-colors">
                                            Unlink
                                          </button>
                                        </div>
                                      </div>
                                    );
                                  }
                                  
                                  return (
                                    <div className="text-sm text-gray-600 dark:text-gray-400">
                                      Transaction linked but details unavailable
                                    </div>
                                  );
                                })()}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Receipt preview modal */}
      {selectedReceipt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="relative w-full max-w-6xl max-h-[90vh] bg-white dark:bg-gray-800 rounded-2xl shadow-2xl overflow-hidden">
            <ReceiptPreview
              document={selectedReceipt as any}
              onClose={() => setSelectedReceipt(null)}
              onDelete={() => {
                // Implement delete
                setSelectedReceipt(null);
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
};