import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { 
  Brain, 
  TrendingUp, 
  AlertTriangle, 
  Target, 
  DollarSign, 
  RefreshCw,
  Lightbulb,
  CheckCircle,
  XCircle,
  AlertCircle,
  Activity,
  PieChart
} from 'lucide-react';
import { supabase, formatCurrency } from '../lib/supabase';
import { useWorkspace } from '../hooks/useWorkspace';
import { useTheme } from '../contexts/ThemeContext';

interface AIInsight {
  type: 'pattern' | 'anomaly' | 'opportunity' | 'warning';
  title: string;
  description: string;
  category: string;
  amount_cents: number;
  confidence: number;
  actionable: boolean;
  recommendation: string;
}

interface BudgetSuggestion {
  category: string;
  suggested_monthly_limit_cents: number;
  current_monthly_average_cents: number;
  confidence: number;
  reasoning: string;
}

interface SpendingSummary {
  total_outflow_cents: number;
  total_inflow_cents: number;
  net_cashflow_cents: number;
  top_category: string;
  top_merchant: string;
  transaction_count: number;
  unique_merchants: number;
  avg_transaction_cents: number;
}

interface Alert {
  type: 'high_spend' | 'unusual_merchant' | 'location_anomaly' | 'budget_exceeded';
  message: string;
  severity: 'low' | 'medium' | 'high';
}

interface AIAnalysisResult {
  insights: AIInsight[];
  budget_suggestions: BudgetSuggestion[];
  spending_summary: SpendingSummary;
  alerts: Alert[];
  metadata?: {
    workspace_id: string;
    generated_at: string;
    transaction_count: number;
    data_hash: string;
    cached: boolean;
  };
}

const InsightCard: React.FC<{ insight: AIInsight }> = ({ insight }) => {
  const { isDark } = useTheme();

  const getInsightIcon = (type: string) => {
    switch (type) {
      case 'pattern': return <TrendingUp className="w-5 h-5 text-blue-500" />;
      case 'anomaly': return <AlertTriangle className="w-5 h-5 text-yellow-500" />;
      case 'opportunity': return <Lightbulb className="w-5 h-5 text-green-500" />;
      case 'warning': return <AlertCircle className="w-5 h-5 text-red-500" />;
      default: return <Activity className="w-5 h-5 text-gray-500" />;
    }
  };

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 0.8) return 'text-green-500';
    if (confidence >= 0.6) return 'text-yellow-500';
    return 'text-red-500';
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className={`p-6 rounded-xl border ${
        isDark 
          ? 'bg-gray-800 border-gray-700' 
          : 'bg-white border-gray-200'
      } shadow-sm hover:shadow-md transition-shadow`}
    >
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center space-x-3">
          {getInsightIcon(insight.type)}
          <h3 className={`font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
            {insight.title}
          </h3>
        </div>
        <span className={`text-sm font-medium ${getConfidenceColor(insight.confidence)}`}>
          {Math.round(insight.confidence * 100)}%
        </span>
      </div>

      <p className={`text-sm mb-4 ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>
        {insight.description}
      </p>

      {insight.amount_cents > 0 && (
        <div className={`text-lg font-bold mb-2 ${isDark ? 'text-white' : 'text-gray-900'}`}>
          {formatCurrency(insight.amount_cents / 100)}
        </div>
      )}

      {insight.actionable && insight.recommendation && (
        <div className={`p-3 rounded-lg ${
          isDark ? 'bg-gray-700' : 'bg-gray-50'
        } border-l-4 border-blue-500`}>
          <p className={`text-sm ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
            <strong>💡 Recommendation:</strong> {insight.recommendation}
          </p>
        </div>
      )}

      <div className="flex justify-between items-center mt-3 pt-3 border-t border-gray-200 dark:border-gray-700">
        <span className={`text-xs uppercase tracking-wide ${
          isDark ? 'text-gray-400' : 'text-gray-500'
        }`}>
          {insight.category.replace('_', ' ')}
        </span>
        <span className={`text-xs capitalize ${
          isDark ? 'text-gray-400' : 'text-gray-500'
        }`}>
          {insight.type}
        </span>
      </div>
    </motion.div>
  );
};

const BudgetSuggestionCard: React.FC<{ suggestion: BudgetSuggestion }> = ({ suggestion }) => {
  const { isDark } = useTheme();
  
  const currentAmount = suggestion.current_monthly_average_cents / 100;
  const suggestedAmount = suggestion.suggested_monthly_limit_cents / 100;
  const savingsAmount = currentAmount - suggestedAmount;
  const savingsPercentage = Math.round((savingsAmount / currentAmount) * 100);

  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      className={`p-6 rounded-xl border ${
        isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'
      } shadow-sm`}
    >
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center space-x-3">
          <Target className="w-5 h-5 text-green-500" />
          <h3 className={`font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
            {suggestion.category.replace('_', ' ').toLowerCase()}
          </h3>
        </div>
        <span className={`text-sm font-medium ${
          suggestion.confidence >= 0.8 ? 'text-green-500' : 
          suggestion.confidence >= 0.6 ? 'text-yellow-500' : 'text-red-500'
        }`}>
          {Math.round(suggestion.confidence * 100)}% confident
        </span>
      </div>

      <div className="space-y-3">
        <div className="flex justify-between">
          <span className={`text-sm ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>
            Current Average:
          </span>
          <span className={`font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>
            {formatCurrency(currentAmount)}
          </span>
        </div>

        <div className="flex justify-between">
          <span className={`text-sm ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>
            Suggested Limit:
          </span>
          <span className="font-medium text-green-600">
            {formatCurrency(suggestedAmount)}
          </span>
        </div>

        {savingsAmount > 0 && (
          <div className="flex justify-between">
            <span className={`text-sm ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>
              Potential Savings:
            </span>
            <span className="font-medium text-green-600">
              {formatCurrency(savingsAmount)} ({savingsPercentage}%)
            </span>
          </div>
        )}
      </div>

      <div className={`mt-4 p-3 rounded-lg ${isDark ? 'bg-gray-700' : 'bg-gray-50'}`}>
        <p className={`text-sm ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
          {suggestion.reasoning}
        </p>
      </div>
    </motion.div>
  );
};

const SpendingSummaryWidget: React.FC<{ summary: SpendingSummary }> = ({ summary }) => {
  const { isDark } = useTheme();

  return (
    <div className={`p-6 rounded-xl border ${
      isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'
    } shadow-sm`}>
      <div className="flex items-center space-x-3 mb-6">
        <PieChart className="w-6 h-6 text-blue-500" />
        <h3 className={`text-lg font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
          Spending Overview
        </h3>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="text-center">
          <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>Total Income</p>
          <p className="text-xl font-bold text-green-600">
            {formatCurrency(summary.total_inflow_cents / 100)}
          </p>
        </div>

        <div className="text-center">
          <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>Total Expenses</p>
          <p className="text-xl font-bold text-red-600">
            {formatCurrency(summary.total_outflow_cents / 100)}
          </p>
        </div>

        <div className="text-center">
          <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>Net Cash Flow</p>
          <p className={`text-xl font-bold ${
            summary.net_cashflow_cents >= 0 ? 'text-green-600' : 'text-red-600'
          }`}>
            {formatCurrency(summary.net_cashflow_cents / 100)}
          </p>
        </div>

        <div className="text-center">
          <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>Transactions</p>
          <p className={`text-xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
            {summary.transaction_count}
          </p>
        </div>
      </div>

      <div className="mt-6 pt-4 border-t border-gray-200 dark:border-gray-700">
        <div className="flex justify-between text-sm">
          <span className={isDark ? 'text-gray-400' : 'text-gray-500'}>Top Category:</span>
          <span className={`font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>
            {summary.top_category.replace('_', ' ')}
          </span>
        </div>
        <div className="flex justify-between text-sm mt-1">
          <span className={isDark ? 'text-gray-400' : 'text-gray-500'}>Top Merchant:</span>
          <span className={`font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>
            {summary.top_merchant}
          </span>
        </div>
      </div>
    </div>
  );
};

const AlertsBanner: React.FC<{ alerts: Alert[] }> = ({ alerts }) => {
  const { isDark } = useTheme();

  if (alerts.length === 0) return null;

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'high': return <XCircle className="w-5 h-5 text-red-500" />;
      case 'medium': return <AlertCircle className="w-5 h-5 text-yellow-500" />;
      case 'low': return <CheckCircle className="w-5 h-5 text-green-500" />;
      default: return <AlertCircle className="w-5 h-5 text-gray-500" />;
    }
  };

  return (
    <div className="space-y-3">
      {alerts.map((alert, index) => (
        <motion.div
          key={index}
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: index * 0.1 }}
          className={`p-4 rounded-lg border-l-4 ${
            alert.severity === 'high' ? 'border-red-500 bg-red-50 dark:bg-red-900/20' :
            alert.severity === 'medium' ? 'border-yellow-500 bg-yellow-50 dark:bg-yellow-900/20' :
            'border-green-500 bg-green-50 dark:bg-green-900/20'
          } ${isDark ? 'border-gray-700' : 'border-gray-200'}`}
        >
          <div className="flex items-start space-x-3">
            {getSeverityIcon(alert.severity)}
            <div className="flex-1">
              <p className={`text-sm font-medium ${
                alert.severity === 'high' ? 'text-red-800 dark:text-red-200' :
                alert.severity === 'medium' ? 'text-yellow-800 dark:text-yellow-200' :
                'text-green-800 dark:text-green-200'
              }`}>
                {alert.message}
              </p>
              <p className={`text-xs mt-1 uppercase tracking-wide ${
                alert.severity === 'high' ? 'text-red-600 dark:text-red-300' :
                alert.severity === 'medium' ? 'text-yellow-600 dark:text-yellow-300' :
                'text-green-600 dark:text-green-300'
              }`}>
                {alert.type.replace('_', ' ')} • {alert.severity} priority
              </p>
            </div>
          </div>
        </motion.div>
      ))}
    </div>
  );
};

export const AIInsightsDashboard: React.FC = () => {
  const { workspace } = useWorkspace();
  const { isDark } = useTheme();
  const [analysis, setAnalysis] = useState<AIAnalysisResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadAIInsights = async (forceRefresh = false) => {
    if (!workspace?.id) return;

    setLoading(true);
    setError(null);

    try {
      const { data, error: functionError } = await supabase.functions.invoke('ai-spending-insights', {
        body: { 
          workspace_id: workspace.id,
          force_refresh: forceRefresh 
        }
      });

      if (functionError) {
        throw new Error(functionError.message || 'Failed to load AI insights');
      }

      if (data?.error) {
        throw new Error(data.error);
      }

      setAnalysis(data);
    } catch (err: any) {
      console.error('Error loading AI insights:', err);
      setError(err.message || 'Failed to load AI insights');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (workspace?.id) {
      loadAIInsights();
    }
  }, [workspace?.id]);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-center py-12">
          <div className="text-center">
            <RefreshCw className="w-8 h-8 text-blue-500 animate-spin mx-auto mb-4" />
            <p className={`text-lg font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>
              AI is analyzing your spending patterns...
            </p>
            <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
              This may take a moment
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-12">
        <AlertTriangle className="w-12 h-12 text-red-500 mx-auto mb-4" />
        <h3 className={`text-lg font-medium mb-2 ${isDark ? 'text-white' : 'text-gray-900'}`}>
          Unable to Load AI Insights
        </h3>
        <p className={`text-sm mb-4 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
          {error}
        </p>
        <button
          onClick={() => loadAIInsights()}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          Try Again
        </button>
      </div>
    );
  }

  if (!analysis) {
    return null;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <Brain className="w-8 h-8 text-blue-500" />
          <h2 className={`text-2xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
            AI Financial Insights
          </h2>
        </div>
        <div className="flex items-center space-x-2">
          {analysis?.metadata?.cached && (
            <span className="text-xs text-gray-500 bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded">
              Cached {new Date(analysis.metadata.generated_at).toLocaleTimeString()}
            </span>
          )}
          <button
            onClick={() => loadAIInsights(false)}
            disabled={loading}
            className="px-3 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 disabled:opacity-50 transition-colors flex items-center space-x-2"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
          <button
            onClick={() => loadAIInsights(true)}
            disabled={loading}
            className="px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors flex items-center space-x-2"
          >
            <Brain className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            <span>Force Refresh</span>
          </button>
        </div>
      </div>

      {/* Alerts */}
      {analysis.alerts.length > 0 && (
        <div>
          <h3 className={`text-lg font-semibold mb-4 ${isDark ? 'text-white' : 'text-gray-900'}`}>
            🚨 Important Alerts
          </h3>
          <AlertsBanner alerts={analysis.alerts} />
        </div>
      )}

      {/* Spending Summary */}
      <SpendingSummaryWidget summary={analysis.spending_summary} />

      {/* AI Insights */}
      <div>
        <h3 className={`text-lg font-semibold mb-4 ${isDark ? 'text-white' : 'text-gray-900'}`}>
          💡 AI Insights
        </h3>
        <div className="grid gap-6 md:grid-cols-2">
          {analysis.insights.map((insight, index) => (
            <InsightCard key={index} insight={insight} />
          ))}
        </div>
      </div>

      {/* Budget Suggestions */}
      {analysis.budget_suggestions.length > 0 && (
        <div>
          <h3 className={`text-lg font-semibold mb-4 ${isDark ? 'text-white' : 'text-gray-900'}`}>
            🎯 Smart Budget Suggestions
          </h3>
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {analysis.budget_suggestions.map((suggestion, index) => (
              <BudgetSuggestionCard key={index} suggestion={suggestion} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
};