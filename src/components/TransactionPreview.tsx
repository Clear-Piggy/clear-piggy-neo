import React from 'react';
import { 
  X, 
  Calendar, 
  MapPin,
  CreditCard, 
  CheckCircle,
  Receipt
} from 'lucide-react';
import { formatCurrency } from '../lib/supabase';

interface TransactionPreviewProps {
  transaction: any;
  receipt?: any; // Optional receipt data to show in preview
  onClose: () => void;
  onUnlink?: () => void; // Optional unlink handler
}

export const TransactionPreview: React.FC<TransactionPreviewProps> = ({ 
  transaction, 
  receipt,
  onClose,
  onUnlink
}) => {
  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return `${monthNames[date.getMonth()]} ${date.getDate()}, ${date.getFullYear()} at ${date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}`;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in">
      <div className="relative w-full max-w-2xl bg-white dark:bg-gray-800 rounded-xl shadow-2xl animate-in slide-in-from-bottom-5 overflow-hidden">
        {/* Header */}
        <div className="relative px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <Receipt className="h-5 w-5 text-gray-500" />
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                Receipt Preview
              </h3>
              <span className="px-2 py-1 bg-green-100 text-green-700 text-xs rounded-full">
                OCR Complete
              </span>
            </div>
            <button
              onClick={onClose}
              className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
            >
              <X className="h-5 w-5 text-gray-500" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex">
          {/* Left: Extracted Data */}
          <div className="flex-1 p-6 border-r border-gray-200 dark:border-gray-700">
            <div className="space-y-4">
              <h4 className="font-medium text-gray-900 dark:text-white">Extracted Data</h4>
              
              {/* Merchant Info */}
              <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-4">
                <h5 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
                  {transaction.merchant_name || 'Unknown Merchant'}
                </h5>
                {transaction.location && (
                  <div className="flex items-center text-gray-600 dark:text-gray-400 text-sm">
                    <MapPin className="h-4 w-4 mr-2" />
                    {transaction.location.address || 
                     `${transaction.location.city || ''}${transaction.location.city && transaction.location.region ? ', ' : ''}${transaction.location.region || ''}`}
                  </div>
                )}
                <div className="flex items-center text-gray-600 dark:text-gray-400 text-sm mt-2">
                  <Calendar className="h-4 w-4 mr-2" />
                  {formatDate(transaction.transaction_date)}
                </div>
              </div>

              {/* Amount Summary */}
              <div className="bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 rounded-lg p-4">
                <div className="text-center">
                  <p className="text-sm text-gray-600 dark:text-gray-400">Total Amount</p>
                  <p className="text-3xl font-bold text-green-600 dark:text-green-400">
                    {formatCurrency(Math.abs(transaction.amount_cents))}
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-4 mt-4 text-sm">
                  <div>
                    <p className="text-gray-600 dark:text-gray-400">Tax</p>
                    <p className="font-medium">$0.00</p>
                  </div>
                  <div>
                    <p className="text-gray-600 dark:text-gray-400">Tip</p>
                    <p className="font-medium">$0.00</p>
                  </div>
                </div>
              </div>

              {/* Items */}
              <div className="space-y-2">
                <h5 className="font-medium text-gray-900 dark:text-white">Items</h5>
                <div className="space-y-2">
                  <div className="flex justify-between items-center py-2 border-b border-gray-100 dark:border-gray-700">
                    <div className="flex-1">
                      <p className="text-sm font-medium text-gray-900 dark:text-white">
                        {transaction.merchant_name || transaction.description || 'Purchase'}
                      </p>
                      <p className="text-xs text-gray-500">
                        Qty: 1 × {formatCurrency(Math.abs(transaction.amount_cents))}
                      </p>
                    </div>
                    <p className="text-sm font-medium text-gray-900 dark:text-white">
                      {formatCurrency(Math.abs(transaction.amount_cents))}
                    </p>
                  </div>
                </div>
              </div>

              {/* Payment Method */}
              <div className="flex items-center space-x-2">
                <CreditCard className="h-4 w-4 text-gray-400" />
                <span className="text-sm text-gray-600 dark:text-gray-400">
                  {transaction.payment_method || transaction.account_name || 'Card Payment'}
                </span>
              </div>
            </div>
          </div>

          {/* Right: Transaction Details */}
          <div className="flex-1 p-6">
            <div className="space-y-4">
              {/* Success Message */}
              <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
                <div className="flex items-start">
                  <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400 mt-0.5 mr-3 flex-shrink-0" />
                  <div className="flex-1">
                    <h4 className="text-sm font-semibold text-green-900 dark:text-green-300">
                      Successfully Linked
                    </h4>
                    <p className="text-sm text-green-700 dark:text-green-400 mt-1">
                      This receipt is linked to: <span className="font-semibold">{transaction.merchant_name || 'Transaction'}</span>
                    </p>
                    <p className="text-xs text-green-600 dark:text-green-400 mt-1">
                      Amount: {formatCurrency(Math.abs(transaction.amount_cents))} • 
                      Date: {new Date(transaction.transaction_date).toLocaleDateString()}
                    </p>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex space-x-3">
                <button
                  onClick={onClose}
                  className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors flex items-center justify-center"
                >
                  <CheckCircle className="h-4 w-4 mr-2" />
                  View Transaction
                </button>
                {onUnlink && (
                  <button
                    onClick={onUnlink}
                    className="px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                  >
                    Unlink
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
          <div className="flex items-center justify-between text-sm text-gray-500 dark:text-gray-400">
            <span>File Size: {receipt ? `${(receipt.file_size / 1024).toFixed(1)} KB` : 'Unknown'}</span>
            <span>Uploaded: {receipt ? new Date(receipt.created_at).toLocaleString() : new Date().toLocaleString()}</span>
          </div>
          {receipt?.sha256_hash && (
            <p className="font-mono text-xs truncate mt-1 text-gray-400">
              Hash: {receipt.sha256_hash}
            </p>
          )}
        </div>
      </div>
    </div>
  );
};