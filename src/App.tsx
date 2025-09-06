import React, { useState, useEffect } from 'react';
import { supabase } from './lib/supabase';
import { Auth } from './components/Auth';
import { Dashboard } from './components/Dashboard';
import { Onboarding } from './components/Onboarding';
import { ThemeProvider } from './contexts/ThemeContext';
import { useWorkspace } from './hooks/useWorkspace';

function AppContent() {
  const [session, setSession] = useState<any>(null);
  const [sessionLoading, setSessionLoading] = useState(true);
  const { workspace, loading: workspaceLoading, refreshWorkspace } = useWorkspace();

  // Removed debug logging to prevent render loop

  useEffect(() => {
    let mounted = true;
    
    // Timeout to prevent infinite loading
    const timeout = setTimeout(() => {
      if (mounted && sessionLoading) {
        console.log('Session loading timeout - assuming no session');
        setSession(null);
        setSessionLoading(false);
      }
    }, 5000); // 5 second timeout
    
    // Get initial session
    supabase.auth.getSession()
      .then(({ data: { session }, error }) => {
        if (!mounted) return;
        if (error) {
          console.error('Error getting session:', error);
        }
        setSession(session);
        setSessionLoading(false);
      })
      .catch((error) => {
        if (!mounted) return;
        console.error('Failed to get session:', error);
        setSession(null);
        setSessionLoading(false);
      });

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!mounted) return;
      setSession(session);
      setSessionLoading(false); // Also set loading to false on auth changes
      
      // Force workspace refresh on sign in
      if (event === 'SIGNED_IN' && session) {
        await refreshWorkspace();
      }
    });

    return () => {
      mounted = false;
      clearTimeout(timeout);
      subscription.unsubscribe();
    };
  }, [refreshWorkspace]);

  // Determine what to show based on current state
  const getContent = () => {
    // Still loading session
    if (sessionLoading) {
      return (
        <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
          <div>
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 dark:border-gray-100" />
            <p style={{ marginTop: '20px', textAlign: 'center' }}>Loading session...</p>
          </div>
        </div>
      );
    }

    // No session - show auth
    if (!session) {
      return <Auth />;
    }

    // Session exists but workspace still loading - only show loading if we don't have a workspace yet
    if (workspaceLoading && !workspace) {
      return (
        <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 dark:border-gray-100" />
        </div>
      );
    }

    // Session and workspace loaded - check onboarding
    if (workspace) {
      const workspaceData = workspace as any;
      const needsOnboarding = workspaceData.onboarding_completed !== true;
      
      // Check if onboarding is needed

      if (needsOnboarding) {
        return <Onboarding onComplete={() => window.location.reload()} />;
      }

      return <Dashboard />;
    }

    // Fallback - show dashboard
    return <Dashboard />;
  };

  return getContent();
}

function App() {
  try {
    return (
      <ThemeProvider>
        <AppContent />
      </ThemeProvider>
    );
  } catch (error) {
    return (
      <div style={{ padding: '20px', color: 'red' }}>
        Error rendering app: {String(error)}
      </div>
    );
  }
}

export default App;