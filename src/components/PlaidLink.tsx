import React, { useState, useEffect } from 'react';
import { usePlaidLink } from 'react-plaid-link';
import { supabase } from '../lib/supabase';
import { useWorkspace } from '../hooks/useWorkspace';
import { Loader2, ExternalLink } from 'lucide-react';

interface PlaidLinkProps {
  onSuccess?: () => void;
  onExit?: () => void;
  children?: React.ReactNode;
}

export const PlaidLinkButton: React.FC<PlaidLinkProps> = ({ 
  onSuccess, 
  onExit,
  children 
}) => {
  const [linkToken, setLinkToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { workspace, profile } = useWorkspace();

  useEffect(() => {
    if (workspace && profile) {
      createLinkToken();
    }
  }, [workspace, profile]);

  const createLinkToken = async () => {
    try {
      setLoading(true);
      setError(null);
      
      if (!workspace || !profile) {
        throw new Error('Workspace or profile not available');
      }


      // Call Supabase Edge Function to create link token
      const { data, error } = await supabase.functions.invoke('workspace-create-link-token', {
        body: {
          workspace_id: workspace.id,
          user_id: profile.id
        }
      });

      if (error) {
        console.error('Link token error:', error);
        throw error;
      }
      if (!data?.link_token) throw new Error('No link token received');
      setLinkToken(data.link_token);
    } catch (err) {
      console.error('Error creating link token:', err);
      
      // Fallback: Try to create link token directly (for development)
      try {
        const response = await fetch('https://production.plaid.com/link/token/create', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            client_id: process.env.REACT_APP_PLAID_CLIENT_ID,
            secret: process.env.REACT_APP_PLAID_SECRET,
            client_name: 'Clear Piggy',
            products: ['transactions'],
            country_codes: ['US'],
            language: 'en',
            user: {
              client_user_id: 'user-' + Date.now(),
            },
          }),
        });
        
        const data = await response.json();
        if (data.link_token) {
          setLinkToken(data.link_token);
        } else {
          setError('Failed to initialize Plaid Link');
        }
      } catch (fallbackErr) {
        setError('Failed to initialize Plaid Link. Please try again later.');
      }
    } finally {
      setLoading(false);
    }
  };

  const onPlaidSuccess = async (public_token: string, metadata: any) => {
    try {
      setLoading(true);
      
      if (!workspace || !profile) {
        throw new Error('Workspace or profile not available');
      }


      // Exchange public token for access token via Supabase Edge Function
      const { data, error } = await supabase.functions.invoke('workspace-exchange-token', {
        body: {
          public_token,
          workspace_id: workspace.id,
          user_id: profile.id,
          metadata
        }
      });

      if (error) {
        console.error('Failed to exchange token:', error);
        throw new Error('Failed to connect account. Please try again.');
      }

      // The edge function handles creating/updating the institution
      if (data?.success || data?.encrypted_token) {
        // Show sync message if transactions are syncing in background
        if (data?.transactions_syncing) {
          alert('Bank account connected successfully! Transactions are syncing in the background and will appear shortly.');
        }
      }
      
      if (onSuccess) {
        onSuccess();
      }
      
      // Refresh the page to show new account
      setTimeout(() => {
        window.location.reload();
      }, 1500);
    } catch (err) {
      console.error('Error handling Plaid success:', err);
      setError('Failed to connect account. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const config = {
    token: linkToken,
    onSuccess: onPlaidSuccess,
    onExit: (err: any, metadata: any) => {
      if (err) console.error('Plaid Link error:', err);
      if (onExit) onExit();
    },
  };

  const { open, ready } = usePlaidLink(config);

  if (error) {
    return (
      <div className="text-sm text-danger-600">
        {error}
      </div>
    );
  }

  return (
    <button
      onClick={() => open()}
      disabled={!ready || loading}
      className="btn btn-primary"
    >
      {loading ? (
        <>
          <Loader2 className="h-4 w-4 animate-spin" />
          Connecting...
        </>
      ) : (
        <>
          {children || (
            <>
              <ExternalLink className="h-4 w-4" />
              Connect Bank Account
            </>
          )}
        </>
      )}
    </button>
  );
};