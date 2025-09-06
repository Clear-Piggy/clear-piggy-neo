import React from 'react';
import { Calendar, Store, Check, TrendingUp, Hash, MapPin } from 'lucide-react';

export interface TransactionCandidate {
  transaction_id: string;
  merchant_name: string;
  amount: number;
  date: string;
  confidence: number;
  match_factors?: string[];
  category?: string;
  location?: string;
}

interface TransactionMatchCardProps {
  candidate: TransactionCandidate;
  onSelect: (transactionId: string) => void;
  index?: number;
}

export const TransactionMatchCard: React.FC<TransactionMatchCardProps> = ({ 
  candidate, 
  onSelect,
  index = 0 
}) => {
  const confidencePercent = Math.round(candidate.confidence * 100);
  
  // Determine confidence color based on percentage
  const getConfidenceColor = (percent: number) => {
    if (percent >= 90) return 'text-green-600 bg-green-50 border-green-200 dark:text-green-400 dark:bg-green-900/20 dark:border-green-800';
    if (percent >= 70) return 'text-yellow-600 bg-yellow-50 border-yellow-200 dark:text-yellow-400 dark:bg-yellow-900/20 dark:border-yellow-800';
    return 'text-red-600 bg-red-50 border-red-200 dark:text-red-400 dark:bg-red-900/20 dark:border-red-800';
  };

  const getConfidenceLabel = (percent: number) => {
    if (percent >= 90) return 'Excellent Match';
    if (percent >= 70) return 'Good Match';
    return 'Possible Match';
  };

  // Default match factors if none provided
  const matchFactors = candidate.match_factors || [];
  
  // Generate match factors based on confidence if not provided
  if (matchFactors.length === 0) {
    if (confidencePercent >= 90) {
      matchFactors.push('exact amount', 'merchant match', 'same day');
    } else if (confidencePercent >= 70) {
      matchFactors.push('similar amount', 'same day');
    } else {
      matchFactors.push('similar date');
    }
  }

  const formatAmount = (cents: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(cents / 100);
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const today = new Date();
    const diffTime = Math.abs(today.getTime() - date.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;
    
    return date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric',
      year: date.getFullYear() !== today.getFullYear() ? 'numeric' : undefined
    });
  };

  return (
    <div 
      className={`
        relative overflow-hidden rounded-xl border-2 transition-all duration-200
        ${index === 0 ? 'border-blue-300 dark:border-blue-700 shadow-lg' : 'border-gray-200 dark:border-gray-700'}
        hover:border-blue-400 dark:hover:border-blue-600 hover:shadow-xl
        bg-white dark:bg-gray-800 p-4 group cursor-pointer
      `}
      onClick={() => onSelect(candidate.transaction_id)}
    >
      {/* Best Match Badge for first item */}
      {index === 0 && (
        <div className="absolute -top-1 -right-1">
          <div className="bg-blue-500 text-white text-xs font-bold px-3 py-1 rounded-bl-lg rounded-tr-lg shadow-md">
            Best Match
          </div>
        </div>
      )}

      {/* Main Content */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1">
          {/* Merchant and Amount Row */}
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center space-x-2">
              <Store className="h-5 w-5 text-gray-400" />
              <h3 className="font-semibold text-gray-900 dark:text-gray-100 text-lg">
                {candidate.merchant_name}
              </h3>
            </div>
            <span className="text-xl font-bold text-gray-900 dark:text-gray-100">
              {formatAmount(candidate.amount)}
            </span>
          </div>

          {/* Date and Category Row */}
          <div className="flex items-center space-x-4 text-sm text-gray-600 dark:text-gray-400 mb-3">
            <div className="flex items-center space-x-1">
              <Calendar className="h-4 w-4" />
              <span>{formatDate(candidate.date)}</span>
            </div>
            {candidate.category && (
              <div className="flex items-center space-x-1">
                <Hash className="h-4 w-4" />
                <span className="capitalize">{candidate.category}</span>
              </div>
            )}
            {candidate.location && (
              <div className="flex items-center space-x-1">
                <MapPin className="h-4 w-4" />
                <span className="truncate max-w-[150px]">{candidate.location}</span>
              </div>
            )}
          </div>

          {/* Match Factors */}
          <div className="flex flex-wrap gap-2 mb-3">
            {matchFactors.map((factor, idx) => (
              <span 
                key={idx}
                className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400"
              >
                <Check className="h-3 w-3 mr-1" />
                {factor}
              </span>
            ))}
          </div>

          {/* Confidence Score */}
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-semibold border ${getConfidenceColor(confidencePercent)}`}>
                <TrendingUp className="h-4 w-4 mr-1.5" />
                <span>{confidencePercent}% Match</span>
              </div>
              <span className="text-sm text-gray-500 dark:text-gray-400">
                {getConfidenceLabel(confidencePercent)}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Action Button */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          onSelect(candidate.transaction_id);
        }}
        className={`
          w-full mt-3 px-4 py-2.5 rounded-lg font-medium transition-all duration-200
          ${index === 0 
            ? 'bg-blue-600 text-white hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600' 
            : 'bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600'
          }
          flex items-center justify-center space-x-2
          group-hover:shadow-md
        `}
      >
        <Check className="h-4 w-4" />
        <span>Select this match</span>
      </button>

      {/* Hover effect gradient overlay */}
      <div className="absolute inset-0 bg-gradient-to-r from-blue-500/0 via-blue-500/0 to-blue-500/0 group-hover:from-blue-500/5 group-hover:via-blue-500/0 group-hover:to-blue-500/5 transition-all duration-300 pointer-events-none rounded-xl" />
    </div>
  );
};

export default TransactionMatchCard;