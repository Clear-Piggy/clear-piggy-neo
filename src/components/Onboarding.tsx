import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '../lib/supabase';
import { PlaidLinkButton } from './PlaidLink';
import { useWorkspace } from '../hooks/useWorkspace';
import { 
  Sparkles, Building2, User, ChevronRight, Check, 
  CreditCard, TrendingUp, Shield, Zap, ArrowRight,
  Wallet, PiggyBank
} from 'lucide-react';

interface OnboardingProps {
  onComplete: () => void;
}

export const Onboarding: React.FC<OnboardingProps> = ({ onComplete }) => {
  const [currentStep, setCurrentStep] = useState(1);
  const [workspaceName, setWorkspaceName] = useState('');
  const [workspaceType, setWorkspaceType] = useState<'personal' | 'business' | ''>('');
  const [isConnecting, setIsConnecting] = useState(false);
  const [bankConnected, setBankConnected] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const { profile, workspace, refreshWorkspace } = useWorkspace();

  const totalSteps = 4;

  // Removed auto-advance - now handled directly in handleBankConnected

  const handleWorkspaceSetup = async () => {
    if (!workspaceName || !workspaceType) return;

    try {
      // Update workspace name and type - using any to bypass TypeScript
      const { error }: any = await (supabase as any)
        .from('workspaces')
        .update({ 
          name: workspaceName,
          workspace_type: workspaceType
        })
        .eq('id', workspace?.id || '');

      if (error) throw error;

      await refreshWorkspace();
      setCurrentStep(3);
    } catch (error) {
      console.error('Error updating workspace:', error);
    }
  };

  const handleBankConnected = async () => {
    setBankConnected(true);
    setIsConnecting(false);
    
    // Mark onboarding as complete immediately after bank connection
    if (workspace) {
      try {
        await (supabase as any)
          .from('workspaces')
          .update({ onboarding_completed: true })
          .eq('id', workspace.id);
        console.log('Marked onboarding as complete');
      } catch (error) {
        console.error('Error updating onboarding status:', error);
      }
    }
    
    // Move to completion step
    setCurrentStep(4);
    
    // Start syncing transactions in background
    setIsSyncing(true);
    
    // Trigger sync in background
    if (workspace) {
      supabase.functions.invoke('workspace-sync-transactions', {
        body: { workspace_id: workspace.id }
      }).then(() => {
        console.log('Transaction sync completed');
        setIsSyncing(false);
      }).catch((error) => {
        console.error('Sync error:', error);
        setIsSyncing(false);
      });
    }
  };

  const handleBankSyncComplete = async () => {
    // This is now handled in handleBankConnected
    // Just in case we still end up here, move to step 4
    setCurrentStep(4);
  };

  const handleComplete = () => {
    onComplete();
  };

  const steps = [
    { number: 1, title: 'Welcome', icon: Sparkles },
    { number: 2, title: 'Setup Workspace', icon: Building2 },
    { number: 3, title: 'Connect Bank', icon: CreditCard },
    { number: 4, title: 'All Set!', icon: Check }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
      {/* Progress Bar */}
      <div className="fixed top-0 left-0 right-0 h-1 bg-gray-200 dark:bg-gray-700 z-50">
        <motion.div 
          className="h-full bg-gradient-to-r from-primary-500 to-secondary-500"
          initial={{ width: '0%' }}
          animate={{ width: `${(currentStep / totalSteps) * 100}%` }}
          transition={{ duration: 0.5 }}
        />
      </div>

      {/* Step Indicator */}
      <div className="pt-8 pb-4">
        <div className="max-w-4xl mx-auto px-6">
          <div className="flex items-center justify-center space-x-4">
            {steps.map((step, index) => (
              <React.Fragment key={step.number}>
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ 
                    scale: currentStep >= step.number ? 1 : 0.8,
                    opacity: currentStep >= step.number ? 1 : 0.5
                  }}
                  className={`flex items-center space-x-2 px-4 py-2 rounded-full transition-all ${
                    currentStep === step.number 
                      ? 'bg-primary-100 dark:bg-primary-900/50 text-primary-700 dark:text-primary-300'
                      : currentStep > step.number
                      ? 'bg-green-100 dark:bg-green-900/50 text-green-700 dark:text-green-300'
                      : 'bg-gray-100 dark:bg-gray-800 text-gray-500'
                  }`}
                >
                  <step.icon className="h-5 w-5" />
                  <span className="font-medium hidden sm:inline">{step.title}</span>
                </motion.div>
                {index < steps.length - 1 && (
                  <div className={`h-px w-8 transition-all ${
                    currentStep > step.number ? 'bg-green-400' : 'bg-gray-300 dark:bg-gray-600'
                  }`} />
                )}
              </React.Fragment>
            ))}
          </div>
        </div>
      </div>

      {/* Content Area */}
      <div className="max-w-4xl mx-auto px-6 pb-20">
        <AnimatePresence mode="wait">
          {/* Step 1: Welcome */}
          {currentStep === 1 && (
            <motion.div
              key="welcome"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="text-center"
            >
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: 0.2, type: 'spring' }}
                className="w-24 h-24 mx-auto mb-8 bg-gradient-to-br from-primary-400 to-secondary-500 rounded-3xl flex items-center justify-center"
              >
                <PiggyBank className="h-12 w-12 text-white" />
              </motion.div>
              
              <h1 className="text-4xl md:text-5xl font-bold text-gray-900 dark:text-white mb-4">
                Welcome to Clear Piggy! 🎉
              </h1>
              <p className="text-xl text-gray-600 dark:text-gray-300 mb-12 max-w-2xl mx-auto">
                Let's get your finances organized in just a few simple steps. 
                This will only take about 2 minutes.
              </p>

              <div className="grid md:grid-cols-3 gap-6 mb-12 text-left max-w-3xl mx-auto">
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3 }}
                  className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-sm"
                >
                  <Shield className="h-10 w-10 text-primary-500 mb-3" />
                  <h3 className="font-semibold text-gray-900 dark:text-white mb-2">Bank-Level Security</h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Your data is encrypted and secured with industry-leading protection
                  </p>
                </motion.div>

                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.4 }}
                  className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-sm"
                >
                  <Zap className="h-10 w-10 text-yellow-500 mb-3" />
                  <h3 className="font-semibold text-gray-900 dark:text-white mb-2">Real-Time Insights</h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Get instant visibility into your spending patterns and trends
                  </p>
                </motion.div>

                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.5 }}
                  className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-sm"
                >
                  <TrendingUp className="h-10 w-10 text-green-500 mb-3" />
                  <h3 className="font-semibold text-gray-900 dark:text-white mb-2">Smart Budgeting</h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    AI-powered recommendations to optimize your financial health
                  </p>
                </motion.div>
              </div>

              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => setCurrentStep(2)}
                className="px-8 py-4 bg-gradient-to-r from-primary-500 to-secondary-500 text-white rounded-2xl font-semibold text-lg shadow-lg hover:shadow-xl transition-all flex items-center mx-auto"
              >
                Let's Get Started
                <ArrowRight className="ml-2 h-5 w-5" />
              </motion.button>
            </motion.div>
          )}

          {/* Step 2: Workspace Setup */}
          {currentStep === 2 && (
            <motion.div
              key="setup"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
            >
              <div className="max-w-xl mx-auto">
                <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-4 text-center">
                  Set Up Your Workspace
                </h2>
                <p className="text-gray-600 dark:text-gray-400 mb-8 text-center">
                  Personalize your financial dashboard
                </p>

                <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm p-8 space-y-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Workspace Name
                    </label>
                    <input
                      type="text"
                      value={workspaceName}
                      onChange={(e) => setWorkspaceName(e.target.value)}
                      placeholder={(profile as any)?.full_name ? `${(profile as any).full_name}'s Finances` : "My Finances"}
                      className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Workspace Type
                    </label>
                    <div className="grid grid-cols-2 gap-4">
                      <button
                        onClick={() => setWorkspaceType('personal')}
                        className={`p-4 rounded-xl border-2 transition-all ${
                          workspaceType === 'personal'
                            ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20'
                            : 'border-gray-200 dark:border-gray-700 hover:border-gray-300'
                        }`}
                      >
                        <User className="h-8 w-8 mx-auto mb-2 text-primary-500" />
                        <p className="font-semibold">Personal</p>
                        <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                          Track personal finances
                        </p>
                      </button>
                      
                      <button
                        onClick={() => setWorkspaceType('business')}
                        className={`p-4 rounded-xl border-2 transition-all ${
                          workspaceType === 'business'
                            ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20'
                            : 'border-gray-200 dark:border-gray-700 hover:border-gray-300'
                        }`}
                      >
                        <Building2 className="h-8 w-8 mx-auto mb-2 text-primary-500" />
                        <p className="font-semibold">Business</p>
                        <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                          Manage business expenses
                        </p>
                      </button>
                    </div>
                  </div>
                </div>

                <div className="flex justify-between mt-8">
                  <button
                    onClick={() => setCurrentStep(1)}
                    className="px-6 py-3 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors"
                  >
                    Back
                  </button>
                  
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={handleWorkspaceSetup}
                    disabled={!workspaceName || !workspaceType}
                    className={`px-8 py-3 rounded-xl font-semibold transition-all flex items-center ${
                      workspaceName && workspaceType
                        ? 'bg-gradient-to-r from-primary-500 to-secondary-500 text-white shadow-lg hover:shadow-xl'
                        : 'bg-gray-200 dark:bg-gray-700 text-gray-500 cursor-not-allowed'
                    }`}
                  >
                    Continue
                    <ChevronRight className="ml-2 h-5 w-5" />
                  </motion.button>
                </div>
              </div>
            </motion.div>
          )}

          {/* Step 3: Bank Connection */}
          {currentStep === 3 && (
            <motion.div
              key="bank"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
            >
              <div className="max-w-xl mx-auto">
                <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-4 text-center">
                  Connect Your Bank
                </h2>
                <p className="text-gray-600 dark:text-gray-400 mb-8 text-center">
                  Securely link your accounts to start tracking
                </p>

                <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm p-8">
                  {!bankConnected ? (
                    <div className="text-center space-y-6">
                      <div className="w-20 h-20 mx-auto bg-gradient-to-br from-blue-400 to-blue-600 rounded-full flex items-center justify-center">
                        <Wallet className="h-10 w-10 text-white" />
                      </div>
                      
                      <div>
                        <h3 className="font-semibold text-lg mb-2">Ready to Connect</h3>
                        <p className="text-gray-600 dark:text-gray-400 text-sm">
                          We use bank-level encryption to protect your data
                        </p>
                      </div>

                      <PlaidLinkButton
                        onSuccess={handleBankConnected}
                        onExit={() => setIsConnecting(false)}
                      >
                        <motion.button
                          whileHover={{ scale: 1.05 }}
                          whileTap={{ scale: 0.95 }}
                          className="w-full px-6 py-3 bg-gradient-to-r from-primary-500 to-secondary-500 text-white rounded-xl font-semibold shadow-lg hover:shadow-xl transition-all"
                          onClick={() => setIsConnecting(true)}
                        >
                          Connect Bank Account
                        </motion.button>
                      </PlaidLinkButton>

                      <button
                        onClick={() => setCurrentStep(4)}
                        className="text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                      >
                        Skip for now
                      </button>
                    </div>
                  ) : (
                    <div className="text-center space-y-6">
                      <motion.div
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        transition={{ type: 'spring' }}
                        className="w-20 h-20 mx-auto bg-gradient-to-br from-green-400 to-green-600 rounded-full flex items-center justify-center"
                      >
                        <Check className="h-10 w-10 text-white" />
                      </motion.div>
                      
                      <div>
                        <h3 className="font-semibold text-lg mb-2">Bank Connected!</h3>
                        {isSyncing ? (
                          <p className="text-gray-600 dark:text-gray-400 text-sm">
                            Syncing your transactions...
                          </p>
                        ) : (
                          <p className="text-gray-600 dark:text-gray-400 text-sm">
                            Your transactions are being imported
                          </p>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {!bankConnected && (
                  <div className="flex justify-between mt-8">
                    <button
                      onClick={() => setCurrentStep(2)}
                      className="px-6 py-3 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors"
                    >
                      Back
                    </button>
                  </div>
                )}
              </div>
            </motion.div>
          )}

          {/* Step 4: Complete */}
          {currentStep === 4 && (
            <motion.div
              key="complete"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="text-center"
            >
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: 'spring', delay: 0.2 }}
                className="w-24 h-24 mx-auto mb-8 bg-gradient-to-br from-green-400 to-green-600 rounded-full flex items-center justify-center"
              >
                <Check className="h-12 w-12 text-white" />
              </motion.div>
              
              <h2 className="text-4xl font-bold text-gray-900 dark:text-white mb-4">
                You're All Set! 🚀
              </h2>
              <p className="text-xl text-gray-600 dark:text-gray-300 mb-12 max-w-2xl mx-auto">
                Your workspace is ready. Let's dive into your financial dashboard!
              </p>

              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={handleComplete}
                className="px-8 py-4 bg-gradient-to-r from-primary-500 to-secondary-500 text-white rounded-2xl font-semibold text-lg shadow-lg hover:shadow-xl transition-all"
              >
                Go to Dashboard
              </motion.button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};