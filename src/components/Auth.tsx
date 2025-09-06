import React, { useState } from 'react';
import { supabase } from '../lib/supabase';
import { motion } from 'framer-motion';
import { Mail, Lock, ArrowRight, Loader2, Eye, EyeOff, Moon, Sun } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';

export const Auth: React.FC = () => {
  const { isDark, toggleTheme } = useTheme();
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      if (isSignUp) {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: window.location.origin,
          }
        });

        if (error) throw error;

        if (data?.user?.identities?.length === 0) {
          setError('An account with this email already exists');
        } else if (data?.user) {
          // Setup user profile
          const { error: setupError } = await supabase.rpc('setup_user_profile');
          if (setupError) console.error('Profile setup error:', setupError);
          
          setError('Check your email for the confirmation link');
        }
      } else {
        const { data, error } = await supabase.auth.signInWithPassword({
          email,
          password
        });

        if (error) throw error;

        if (data?.user) {
          // Check if profile exists
          const { data: profileCheck } = await supabase
            .from('user_profiles')
            .select('id')
            .eq('auth_user_id', data.user.id)
            .single();

          if (!profileCheck) {
            const { error: setupError } = await supabase.rpc('setup_user_profile');
            if (setupError) console.error('Profile setup error:', setupError);
          }
        }
      }
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Authentication failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center p-4">
      <div className="absolute inset-0 gradient-mesh opacity-20" />
      
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="relative w-full max-w-md"
      >
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-gray-900 dark:bg-gray-100 rounded-2xl mb-4">
            <span className="text-white dark:text-gray-900 text-2xl font-bold">CP</span>
          </div>
          <h1 className="text-2xl font-semibold text-gray-900 dark:text-gray-100">Clear Piggy</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-2">Modern financial management</p>
        </div>

        {/* Auth Card */}
        <div className="card p-8">
          <div className="mb-6">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
              {isSignUp ? 'Create your account' : 'Welcome back'}
            </h2>
            <p className="text-gray-600 dark:text-gray-400 text-sm mt-1">
              {isSignUp ? 'Start managing your finances today' : 'Sign in to continue to your dashboard'}
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Email
              </label>
              <div className="relative">
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="input pl-10"
                  placeholder="you@example.com"
                  required
                  autoComplete="email"
                />
                <Mail className="absolute left-3 top-2.5 h-4 w-4 text-gray-400 dark:text-gray-500" />
              </div>
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Password
              </label>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="input pl-10 pr-10"
                  placeholder="••••••••"
                  required
                  autoComplete={isSignUp ? 'new-password' : 'current-password'}
                />
                <Lock className="absolute left-3 top-2.5 h-4 w-4 text-gray-400 dark:text-gray-500" />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-2.5 text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300"
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>
            </div>

            {error && (
              <motion.div 
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className={`p-3 rounded-lg text-sm ${
                  error.includes('Check your email') 
                    ? 'bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-400 border border-primary-200 dark:border-primary-800'
                    : 'bg-danger-50 dark:bg-danger-900/20 text-danger-700 dark:text-danger-400 border border-danger-200 dark:border-danger-800'
                }`}
              >
                {error}
              </motion.div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full btn btn-primary"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {isSignUp ? 'Creating account...' : 'Signing in...'}
                </>
              ) : (
                <>
                  {isSignUp ? 'Create account' : 'Sign in'}
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </button>
          </form>

          <div className="mt-6 pt-6 border-t border-gray-100 dark:border-gray-700">
            <button
              type="button"
              onClick={() => {
                setIsSignUp(!isSignUp);
                setError(null);
              }}
              className="w-full text-center text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100"
            >
              {isSignUp ? (
                <>Already have an account? <span className="font-medium">Sign in</span></>
              ) : (
                <>Don't have an account? <span className="font-medium">Sign up</span></>
              )}
            </button>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-8 text-center">
          <button
            onClick={toggleTheme}
            className="mb-4 p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors inline-flex items-center gap-2 text-gray-600 dark:text-gray-400"
          >
            {isDark ? (
              <><Sun className="h-4 w-4" /> Light mode</>
            ) : (
              <><Moon className="h-4 w-4" /> Dark mode</>
            )}
          </button>
          <p className="text-xs text-gray-500 dark:text-gray-500">
            By continuing, you agree to our Terms of Service and Privacy Policy
          </p>
        </div>
      </motion.div>
    </div>
  );
};