import React, { useState, useEffect, useMemo } from 'react';
import { supabase, formatCurrency } from '../lib/supabase';
import { motion } from 'framer-motion';
import { PlaidLinkButton } from './PlaidLink';
import {
  Home, CreditCard, TrendingUp, LogOut, Bell, Search, Plus,
  ArrowUpRight, ArrowDownLeft, MoreHorizontal, Filter, Download,
  RefreshCw, Activity, DollarSign, Wallet, Moon, Sun, Trash2, AlertCircle,
  Receipt, ChevronDown, ChevronUp, CheckCircle, XCircle
} from 'lucide-react';
import { CashFlowChart } from './CashFlowChart';
import { ReceiptUpload } from './ReceiptUpload';
import { ReceiptPreview, DocumentRecord } from './ReceiptPreview';
import { SmartReceiptTable } from './SmartReceiptTable';
import { AIInsightsDashboard } from './AIInsightsDashboard';
import { format, subDays, startOfMonth } from 'date-fns';
import { useTheme } from '../contexts/ThemeContext';
import { useWorkspace } from '../hooks/useWorkspace';

interface Transaction {
  id: string;
  date: string;
  description: string;
  amount: number;
  type: 'debit' | 'credit';
  category: string;
  account: string;
  merchant_logo?: string;
}

export const Dashboard: React.FC = () => {
  const { isDark, toggleTheme } = useTheme();
  const { workspace, profile, loading: workspaceLoading, error: workspaceError, refreshWorkspace } = useWorkspace();
  const [user, setUser] = useState<any>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [accounts, setAccounts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');
  const [dateRange, setDateRange] = useState('30d');
  const [disconnectingAccount, setDisconnectingAccount] = useState<string | null>(null);
  const [showDisconnectConfirm, setShowDisconnectConfirm] = useState<string | null>(null);
  const [syncingTransactions, setSyncingTransactions] = useState(false);
  const [documents, setDocuments] = useState<DocumentRecord[]>([]);
  const [selectedDocument, setSelectedDocument] = useState<DocumentRecord | null>(null);
  const [loadingDocuments, setLoadingDocuments] = useState(false);
  const [reviewSectionCollapsed, setReviewSectionCollapsed] = useState(false);

  useEffect(() => {
    if (workspace?.id) {
      loadDashboardData();
      if (activeTab === 'receipts') {
        loadDocuments();
      }
    }
  }, [workspace?.id]);  // Re-load only when workspace ID changes

  useEffect(() => {
    if (workspace?.id && activeTab === 'receipts') {
      loadDocuments();
    }
  }, [activeTab, workspace?.id]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (showDisconnectConfirm && !(e.target as HTMLElement).closest('.account-menu')) {
        setShowDisconnectConfirm(null);
      }
    };
    
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, [showDisconnectConfirm]);

  const loadDocuments = async () => {
    if (!workspace?.id) return;
    
    setLoadingDocuments(true);
    try {
      const { data, error } = await supabase
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
        .eq('workspace_id', workspace.id)
        .eq('document_type', 'receipt')
        .order('created_at', { ascending: false });
      
      if (error) {
        console.error('Error loading documents:', error);
      } else {
        setDocuments(data || []);
      }
    } catch (error) {
      console.error('Error loading documents:', error);
    } finally {
      setLoadingDocuments(false);
    }
  };

  const handleDeleteDocument = async (documentId: string) => {
    try {
      // Delete from storage
      const doc = documents.find(d => d.id === documentId);
      if (doc?.storage_path) {
        await supabase.storage
          .from(doc.storage_bucket || 'receipts')
          .remove([doc.storage_path]);
      }
      
      // Delete from database
      await supabase
        .from('documents')
        .delete()
        .eq('id', documentId);
      
      // Refresh the list
      await loadDocuments();
      setSelectedDocument(null);
    } catch (error) {
      console.error('Error deleting document:', error);
      alert('Failed to delete receipt');
    }
  };


  const loadDashboardData = async () => {
    try {
      // Don't set loading to true if we already have data
      if (transactions.length === 0) {
        setLoading(true);
      }
      
      const { data: { user } } = await supabase.auth.getUser();
      setUser(user);

      if (!workspace) {
        setLoading(false);
        return;
      }

      // Load bank accounts
      const { data: accountsData, error: accountsError } = await supabase
        .from('bank_accounts')
        .select('*')
        .eq('workspace_id', workspace.id)
        .eq('is_active', true);
      
      if (accountsError) {
        console.error('Error loading accounts:', accountsError);
      }
      setAccounts(accountsData || []);

      // Load transactions
      const { data: transData } = await supabase
        .from('feed_transactions')
        .select('*')
        .eq('workspace_id', workspace.id)
        .order('transaction_date', { ascending: false })
        .limit(50);
      
      const formattedTransactions = (transData || []).map((t: any) => ({
        id: t.id,
        date: t.transaction_date || t.date,
        description: t.merchant_name || t.description || t.name || 'Transaction',
        amount: Math.abs(t.amount_cents / 100),
        type: t.direction === 'inflow' ? 'credit' as const : 'debit' as const,  // Use direction field: inflow = credit/income, outflow = debit/expense
        category: t.personal_finance_category_primary || t.primary_category || 'Uncategorized',
        account: t.account_name || 'Account',
        merchant_logo: t.merchant_logo_url
      }));

      setTransactions(formattedTransactions);
    } catch (error) {
      console.error('Error loading dashboard:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSignOut = async () => {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) {
        console.error('Error signing out:', error);
      } else {
        // Force reload to clear all state and redirect to auth
        window.location.href = '/';
      }
    } catch (err) {
      console.error('Sign out error:', err);
      // Force reload anyway to clear state
      window.location.href = '/';
    }
  };

  const handleDisconnectAccount = async (accountId: string) => {
    setDisconnectingAccount(accountId);
    try {
      // Delete transactions for this account
      await supabase
        .from('feed_transactions')
        .delete()
        .eq('bank_account_id', accountId);
      
      // Delete the bank account
      await supabase
        .from('bank_accounts')
        .delete()
        .eq('id', accountId);
      
      // Reload the data
      await loadDashboardData();
      
      setShowDisconnectConfirm(null);
    } catch (error) {
      console.error('Error disconnecting account:', error);
      alert('Failed to disconnect account. Please try again.');
    } finally {
      setDisconnectingAccount(null);
    }
  };

  
  const cleanAllBankData = async () => {
    if (!workspace) return;
    
    if (!window.confirm('⚠️ This will DELETE all bank accounts, institutions, and transactions. Are you sure?')) {
      return;
    }
    
    try {
      // Delete transactions first (foreign key constraints)
      const { error: txError } = await supabase
        .from('feed_transactions')
        .delete()
        .eq('workspace_id', workspace.id);
      
      if (txError) {
        console.error('Error deleting transactions:', txError);
      }
      
      // Delete bank accounts
      const { error: accError } = await supabase
        .from('bank_accounts')
        .delete()
        .eq('workspace_id', workspace.id);
      
      if (accError) {
        console.error('Error deleting accounts:', accError);
      }
      
      // Delete institutions
      const { error: instError } = await supabase
        .from('institutions')
        .delete()
        .eq('workspace_id', workspace.id);
      
      if (instError) {
        console.error('Error deleting institutions:', instError);
      }
      alert('All bank data has been cleaned. You can now reconnect your accounts.');
      
      // Reload the dashboard
      await loadDashboardData();
      
    } catch (error) {
      console.error('Error during cleanup:', error);
      alert('Error during cleanup. Check console for details.');
    }
  };

  // Calculate totals
  const totalBalance = accounts.reduce((sum, acc) => sum + (acc.current_balance_cents || 0), 0) / 100;
  const monthlyIncome = transactions
    .filter(t => t.type === 'credit' && new Date(t.date) >= startOfMonth(new Date()))
    .reduce((sum, t) => sum + t.amount, 0);
  const monthlyExpenses = transactions
    .filter(t => t.type === 'debit' && new Date(t.date) >= startOfMonth(new Date()))
    .reduce((sum, t) => sum + t.amount, 0);

  // Sync transactions from Plaid
  const syncTransactions = async () => {
    if (!workspace || !profile || syncingTransactions) return;
    
    setSyncingTransactions(true);
    try {
      
      const { data, error } = await supabase.functions.invoke('workspace-sync-transactions', {
        body: {
          workspace_id: workspace.id
        }
      });

      if (error) {
        console.error('Sync error:', error);
        // Check if error has more details
        if ((error as any).context?.body) {
          try {
            const errorBody = await (error as any).context.json();
            console.error('Error details:', errorBody);
            alert(`Sync failed: ${errorBody.error || 'Unknown error'}`);
          } catch {
            alert('Failed to sync transactions. Please check if your bank accounts are connected.');
          }
        } else {
          alert('Failed to sync transactions. Please try again.');
        }
      } else {
        // Show appropriate message based on sync result
        if (data?.new_transactions > 0 || data?.updated_transactions > 0) {
          alert(`Successfully synced ${data.new_transactions} new and ${data.updated_transactions} updated transactions!`);
          // Trigger a refresh by updating the workspace to cause useEffect to reload
          window.location.reload();
        } else if (data?.errors > 0) {
          alert(`Sync completed with ${data.errors} error(s). Check console for details.`);
        } else if (data?.message) {
          alert(data.message);
        } else {
          alert('Sync completed - no new transactions found');
        }
      }
    } catch (err) {
      console.error('Sync error:', err);
      alert('Failed to sync transactions. Please try again.');
    } finally {
      setSyncingTransactions(false);
    }
  };

  // Generate chart data
  const generateChartData = () => {
    const days = 30;
    const data = [];
    const today = new Date();
    for (let i = days; i >= 0; i--) {
      const date = subDays(today, i);
      const dayTransactions = transactions.filter(t => 
        format(new Date(t.date), 'yyyy-MM-dd') === format(date, 'yyyy-MM-dd')
      );
      const income = dayTransactions.filter(t => t.type === 'credit').reduce((sum, t) => sum + t.amount, 0);
      const expenses = dayTransactions.filter(t => t.type === 'debit').reduce((sum, t) => sum + t.amount, 0);
      data.push({
        date: format(date, 'MMM d'),
        income,
        expenses,
        net: income - expenses
      });
    }
    return data;
  };

  // Memoize chart data to prevent flickering - only recalculate when transactions actually change
  const chartData = useMemo(() => {
    if (!transactions || transactions.length === 0) {
      // Return empty data for 30 days if no transactions
      const days = 30;
      const data = [];
      const today = new Date();
      for (let i = days; i >= 0; i--) {
        const date = subDays(today, i);
        data.push({
          date: format(date, 'MMM d'),
          income: 0,
          expenses: 0,
          net: 0
        });
      }
      return data;
    }
    return generateChartData();
  }, [transactions.length, transactions]);

  // Only show loading screen on initial load when we have no data
  if (loading && transactions.length === 0 && !workspace) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 dark:border-gray-100 mx-auto mb-4" />
          <p className="text-gray-600 dark:text-gray-400">
            {workspaceLoading ? 'Setting up workspace...' : 'Loading dashboard...'}
          </p>
        </div>
      </div>
    );
  }

  if (workspaceError) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center p-8 max-w-md">
          <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-2">
            Workspace Error
          </h2>
          <p className="text-gray-600 dark:text-gray-400 mb-4">
            {workspaceError}
          </p>
          <button
            onClick={refreshWorkspace}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Sidebar */}
      <div className="fixed left-0 top-0 h-full w-64 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 z-10">
        <div className="p-6">
          <div className="flex items-center gap-3 mb-8">
            <div className="w-10 h-10 bg-gray-900 dark:bg-gray-100 rounded-xl flex items-center justify-center">
              <span className="text-white dark:text-gray-900 font-bold">CP</span>
            </div>
            <span className="font-semibold text-gray-900 dark:text-gray-100">Clear Piggy</span>
          </div>

          <nav className="space-y-1">
            <button
              onClick={() => setActiveTab('overview')}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-colors ${
                activeTab === 'overview' ? 'bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-gray-100' : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700'
              }`}
            >
              <Home className="h-4 w-4" />
              <span className="font-medium">Overview</span>
            </button>
            <button
              onClick={() => setActiveTab('accounts')}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-colors ${
                activeTab === 'accounts' ? 'bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-gray-100' : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700'
              }`}
            >
              <Wallet className="h-4 w-4" />
              <span className="font-medium">Accounts</span>
            </button>
            <button
              onClick={() => setActiveTab('transactions')}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-colors ${
                activeTab === 'transactions' ? 'bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-gray-100' : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700'
              }`}
            >
              <CreditCard className="h-4 w-4" />
              <span className="font-medium">Transactions</span>
            </button>
            <button
              onClick={() => setActiveTab('analytics')}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-colors ${
                activeTab === 'analytics' ? 'bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-gray-100' : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700'
              }`}
            >
              <TrendingUp className="h-4 w-4" />
              <span className="font-medium">Analytics</span>
            </button>
            <button
              onClick={() => setActiveTab('receipts')}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-colors ${
                activeTab === 'receipts' ? 'bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-gray-100' : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700'
              }`}
            >
              <Receipt className="h-4 w-4" />
              <span className="font-medium">Receipts</span>
            </button>
          </nav>
        </div>

        <div className="absolute bottom-0 left-0 right-0 p-6 border-t border-gray-100 dark:border-gray-700">
          <button
            onClick={handleSignOut}
            className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
          >
            <LogOut className="h-4 w-4" />
            <span className="font-medium">Sign out</span>
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="ml-64">
        {/* Top Bar */}
        <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
                {activeTab === 'overview' && 'Overview'}
                {activeTab === 'accounts' && 'Accounts'}
                {activeTab === 'transactions' && 'Transactions'}
                {activeTab === 'analytics' && 'Analytics'}
                {activeTab === 'receipts' && 'Receipts'}
              </h1>
              <select 
                value={dateRange}
                onChange={(e) => setDateRange(e.target.value)}
                className="text-sm border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-lg px-3 py-1.5"
              >
                <option value="7d">Last 7 days</option>
                <option value="30d">Last 30 days</option>
                <option value="90d">Last 90 days</option>
                <option value="ytd">Year to date</option>
              </select>
            </div>

            <div className="flex items-center gap-3">
              <button 
                onClick={toggleTheme}
                className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
              >
                {isDark ? (
                  <Sun className="h-5 w-5 text-gray-600 dark:text-gray-400" />
                ) : (
                  <Moon className="h-5 w-5 text-gray-600 dark:text-gray-400" />
                )}
              </button>
              <button className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg">
                <Search className="h-5 w-5 text-gray-600 dark:text-gray-400" />
              </button>
              <button className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg relative">
                <Bell className="h-5 w-5 text-gray-600 dark:text-gray-400" />
                <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-danger-500 rounded-full" />
              </button>
              <div className="ml-3 flex items-center gap-3">
                <div className="text-right">
                  <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{profile?.full_name || user?.email}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">{workspace?.name}</p>
                </div>
                <div className="w-10 h-10 bg-gray-200 dark:bg-gray-600 rounded-full flex items-center justify-center">
                  <span className="text-sm font-medium text-gray-600 dark:text-gray-300">
                    {(profile?.full_name || user?.email || 'U')[0].toUpperCase()}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Content Area */}
        <div className="p-8">
          {activeTab === 'overview' && (
            <div className="space-y-6">
              {/* Key Metrics */}
              <div className="grid grid-cols-4 gap-6">
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0 }}
                  className="card p-6"
                >
                  <div className="flex items-center justify-between mb-4">
                    <p className="text-sm text-gray-600 dark:text-gray-400">Total Balance</p>
                    <DollarSign className="h-5 w-5 text-gray-400 dark:text-gray-500" />
                  </div>
                  <p className="text-2xl font-semibold text-gray-900 dark:text-gray-100">{formatCurrency(totalBalance * 100)}</p>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">{accounts.length} accounts</p>
                </motion.div>

                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1 }}
                  className="card p-6"
                >
                  <div className="flex items-center justify-between mb-4">
                    <p className="text-sm text-gray-600 dark:text-gray-400">Monthly Income</p>
                    <ArrowDownLeft className="h-5 w-5 text-success-600 dark:text-success-400" />
                  </div>
                  <p className="text-2xl font-semibold text-gray-900 dark:text-gray-100">{formatCurrency(monthlyIncome * 100)}</p>
                  <p className="text-sm text-success-600 dark:text-success-400 mt-2">This month</p>
                </motion.div>

                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2 }}
                  className="card p-6"
                >
                  <div className="flex items-center justify-between mb-4">
                    <p className="text-sm text-gray-600 dark:text-gray-400">Monthly Expenses</p>
                    <ArrowUpRight className="h-5 w-5 text-danger-600 dark:text-danger-400" />
                  </div>
                  <p className="text-2xl font-semibold text-gray-900 dark:text-gray-100">{formatCurrency(monthlyExpenses * 100)}</p>
                  <p className="text-sm text-danger-600 dark:text-danger-400 mt-2">This month</p>
                </motion.div>

                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3 }}
                  className="card p-6"
                >
                  <div className="flex items-center justify-between mb-4">
                    <p className="text-sm text-gray-600 dark:text-gray-400">Net Cash Flow</p>
                    <Activity className="h-5 w-5 text-primary-600 dark:text-primary-400" />
                  </div>
                  <p className="text-2xl font-semibold text-gray-900 dark:text-gray-100">
                    {formatCurrency((monthlyIncome - monthlyExpenses) * 100)}
                  </p>
                  <p className={`text-sm mt-2 ${monthlyIncome > monthlyExpenses ? 'text-success-600 dark:text-success-400' : 'text-danger-600 dark:text-danger-400'}`}>
                    {monthlyIncome > monthlyExpenses ? '↑' : '↓'} {Math.abs(((monthlyIncome - monthlyExpenses) / monthlyExpenses * 100)).toFixed(1)}%
                  </p>
                </motion.div>
              </div>

              {/* Cash Flow Chart */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 }}
                className="card p-6"
              >
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Cash Flow</h2>
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 bg-success-500 rounded-full" />
                      <span className="text-sm text-gray-600 dark:text-gray-400">Income</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 bg-danger-500 rounded-full" />
                      <span className="text-sm text-gray-600 dark:text-gray-400">Expenses</span>
                    </div>
                  </div>
                </div>
                <CashFlowChart data={chartData} isDark={isDark} />
              </motion.div>

              {/* Recent Transactions */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5 }}
                className="card"
              >
                <div className="p-6 border-b border-gray-100 dark:border-gray-700">
                  <div className="flex items-center justify-between">
                    <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Recent Transactions</h2>
                    <button className="text-sm text-primary-600 hover:text-primary-700 font-medium">
                      View all →
                    </button>
                  </div>
                </div>
                <div className="divide-y divide-gray-100 dark:divide-gray-700">
                  {transactions.slice(0, 5).map((transaction) => (
                    <div key={transaction.id} className="px-6 py-4 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          {transaction.merchant_logo ? (
                            <img 
                              src={transaction.merchant_logo} 
                              alt=""
                              className="w-10 h-10 rounded-full object-cover"
                            />
                          ) : (
                            <div className="w-10 h-10 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center">
                              <CreditCard className="h-5 w-5 text-gray-400 dark:text-gray-500" />
                            </div>
                          )}
                          <div>
                            <p className="font-medium text-gray-900 dark:text-gray-100">{transaction.description}</p>
                            <p className="text-sm text-gray-500 dark:text-gray-400">
                              {transaction.category} • {format(new Date(transaction.date), 'MMM d, yyyy')}
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className={`font-medium ${
                            transaction.type === 'credit' ? 'text-success-600 dark:text-success-400' : 'text-danger-600 dark:text-danger-400'
                          }`}>
                            {transaction.type === 'credit' ? '+' : '-'}{formatCurrency(transaction.amount * 100)}
                          </p>
                          <p className="text-sm text-gray-500 dark:text-gray-400">{transaction.account}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </motion.div>
            </div>
          )}

          {activeTab === 'accounts' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between mb-6">
                <p className="text-gray-600 dark:text-gray-400">Manage your connected accounts</p>
                <div className="flex items-center gap-2">
                  <button
                    onClick={loadDashboardData}
                    className="btn btn-secondary"
                    title="Refresh accounts"
                  >
                    <RefreshCw className="h-4 w-4" />
                    Refresh
                  </button>
                  <button
                    onClick={cleanAllBankData}
                    className="btn btn-secondary bg-orange-600 hover:bg-orange-700 text-white"
                    title="Clean all bank data"
                  >
                    🧹 Clean All
                  </button>
                  <PlaidLinkButton onSuccess={loadDashboardData}>
                    <Plus className="h-4 w-4" />
                    Add Account
                  </PlaidLinkButton>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-6">
                {accounts.map((account) => (
                  <motion.div
                    key={account.id}
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="card p-6 card-hover"
                  >
                    <div className="flex items-start justify-between mb-4">
                      <div>
                        <h3 className="font-semibold text-gray-900 dark:text-gray-100">{account.name}</h3>
                        <p className="text-sm text-gray-500 dark:text-gray-400">{account.institution_name}</p>
                      </div>
                      <div className="relative account-menu">
                        <button 
                          onClick={() => setShowDisconnectConfirm(showDisconnectConfirm === account.id ? null : account.id)}
                          className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
                        >
                          <MoreHorizontal className="h-4 w-4 text-gray-400 dark:text-gray-500" />
                        </button>
                        
                        {showDisconnectConfirm === account.id && (
                          <div className="absolute right-0 top-8 w-48 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 p-2 z-10">
                            <button
                              onClick={() => handleDisconnectAccount(account.id)}
                              disabled={disconnectingAccount === account.id}
                              className="w-full flex items-center gap-2 px-3 py-2 text-sm text-danger-600 dark:text-danger-400 hover:bg-danger-50 dark:hover:bg-danger-900/20 rounded transition-colors"
                            >
                              {disconnectingAccount === account.id ? (
                                <>
                                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-danger-600" />
                                  Disconnecting...
                                </>
                              ) : (
                                <>
                                  <Trash2 className="h-4 w-4" />
                                  Disconnect Account
                                </>
                              )}
                            </button>
                            <div className="px-3 py-2 text-xs text-gray-500 dark:text-gray-400">
                              <AlertCircle className="h-3 w-3 inline mr-1" />
                              This will remove all transactions
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="space-y-3">
                      <div>
                        <p className="text-sm text-gray-600 dark:text-gray-400">Current Balance</p>
                        <p className="text-xl font-semibold text-gray-900 dark:text-gray-100">
                          {formatCurrency(account.current_balance_cents || 0)}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-600 dark:text-gray-400">Available Balance</p>
                        <p className="text-lg font-medium text-gray-700 dark:text-gray-300">
                          {formatCurrency(account.available_balance_cents || 0)}
                        </p>
                      </div>
                    </div>
                    <div className="mt-4 pt-4 border-t border-gray-100 dark:border-gray-700">
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        Last synced: {format(new Date(account.last_sync_at || Date.now()), 'MMM d, h:mm a')}
                      </p>
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'transactions' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <button className="btn btn-secondary">
                    <Filter className="h-4 w-4" />
                    Filter
                  </button>
                  <button className="btn btn-secondary">
                    <Download className="h-4 w-4" />
                    Export
                  </button>
                </div>
                <button 
                  className="btn btn-ghost"
                  onClick={syncTransactions}
                  disabled={syncingTransactions}
                >
                  <RefreshCw className={`h-4 w-4 ${syncingTransactions ? 'animate-spin' : ''}`} />
                  {syncingTransactions ? 'Syncing...' : 'Sync Transactions'}
                </button>
              </div>

              <div className="card">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-gray-200 dark:border-gray-700">
                        <th className="text-left p-4 font-medium text-gray-600 dark:text-gray-400 text-sm">Date</th>
                        <th className="text-left p-4 font-medium text-gray-600 dark:text-gray-400 text-sm">Description</th>
                        <th className="text-left p-4 font-medium text-gray-600 dark:text-gray-400 text-sm">Category</th>
                        <th className="text-left p-4 font-medium text-gray-600 dark:text-gray-400 text-sm">Account</th>
                        <th className="text-right p-4 font-medium text-gray-600 dark:text-gray-400 text-sm">Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      {transactions.map((transaction) => (
                        <tr key={transaction.id} className="table-row">
                          <td className="p-4 text-sm text-gray-600 dark:text-gray-400">
                            {format(new Date(transaction.date), 'MMM d')}
                          </td>
                          <td className="p-4">
                            <div className="flex items-center gap-3">
                              {transaction.merchant_logo ? (
                                <img 
                                  src={transaction.merchant_logo} 
                                  alt=""
                                  className="w-8 h-8 rounded-full object-cover"
                                />
                              ) : (
                                <div className="w-8 h-8 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center">
                                  <CreditCard className="h-4 w-4 text-gray-400 dark:text-gray-500" />
                                </div>
                              )}
                              <span className="font-medium text-gray-900 dark:text-gray-100">{transaction.description}</span>
                            </div>
                          </td>
                          <td className="p-4 text-sm text-gray-600 dark:text-gray-400">{transaction.category}</td>
                          <td className="p-4 text-sm text-gray-600 dark:text-gray-400">{transaction.account}</td>
                          <td className={`p-4 text-sm font-medium text-right ${
                            transaction.type === 'credit' ? 'text-success-600 dark:text-success-400' : 'text-danger-600 dark:text-danger-400'
                          }`}>
                            {transaction.type === 'credit' ? '+' : '-'}{formatCurrency(transaction.amount * 100)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'analytics' && (
            <AIInsightsDashboard />
          )}

          {activeTab === 'receipts' && (
            <div className="h-full flex flex-col space-y-6">
              {/* Upload Section */}
              <div className="card p-6">
                <ReceiptUpload />
              </div>

              {/* Smart Receipt Table */}
              <div className="card flex-1 min-h-0 flex flex-col">
                <SmartReceiptTable 
                  receipts={documents as any}
                  loading={loadingDocuments}
                  onRefresh={loadDocuments}
                />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};