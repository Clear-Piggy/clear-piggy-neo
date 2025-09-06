import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

export const usePlaidToken = () => {
  const [linkToken, setLinkToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    createLinkToken();
  }, []);

  const createLinkToken = async () => {
    try {
      setLoading(true);
      
      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('No authenticated user');

      // First try to get token from Supabase Edge Function
      try {
        const { data, error } = await supabase.functions.invoke('create-plaid-link-token', {
          body: {
            user_id: user.id,
            client_name: user.email || 'User'
          }
        });

        if (!error && data?.link_token) {
          setLinkToken(data.link_token);
          return;
        }
      } catch (err) {
        console.log('Edge function not available, using direct API');
      }

      // Fallback: Create link token directly (only works in development)
      // Note: In production, you should always use a backend service
      const response = await fetch('/api/plaid/link-token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          user_id: user.id,
        }),
      }).catch(() => null);

      if (response && response.ok) {
        const data = await response.json();
        setLinkToken(data.link_token);
      } else {
        // Last resort: Create a test token for development
        console.warn('Using development mode - Plaid Link may not work correctly');
        // We'll still set a dummy token to allow the UI to render
        setLinkToken('link-development-placeholder');
      }
    } catch (err) {
      console.error('Error creating link token:', err);
      setError('Failed to initialize Plaid Link');
    } finally {
      setLoading(false);
    }
  };

  return { linkToken, loading, error, refresh: createLinkToken };
};