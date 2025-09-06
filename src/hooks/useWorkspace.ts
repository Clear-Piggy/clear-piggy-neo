import { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { UserProfile, Workspace } from '../types/database.types';

interface UseWorkspaceReturn {
  workspace: Workspace | null;
  profile: UserProfile | null;
  loading: boolean;
  error: string | null;
  refreshWorkspace: () => Promise<void>;
  ensureWorkspace: () => Promise<Workspace | null>;
}

export const useWorkspace = (): UseWorkspaceReturn => {
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const isInitializing = useRef(false);

  const ensureWorkspace = async (): Promise<Workspace | null> => {
    try {
      setError(null);
      
      // Step 1: Get current user
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError || !user) {
        setError('Not authenticated');
        return null;
      }

      // Step 2: Get or create user profile
      let { data: userProfile, error: profileError } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('auth_user_id', user.id)
        .single() as { data: any, error: any };

      if (profileError || !userProfile) {
        const { error: setupError } = await supabase.rpc('setup_user_profile');
        
        if (setupError) {
          setError(`Failed to setup profile: ${setupError.message}`);
          return null;
        }

        // Retry getting profile after setup
        const { data: newProfile, error: retryError } = await supabase
          .from('user_profiles')
          .select('*')
          .eq('auth_user_id', user.id)
          .single() as { data: any, error: any };

        if (retryError || !newProfile) {
          setError('Failed to create profile');
          return null;
        }

        userProfile = newProfile;
      }

      if (!userProfile) {
        setError('Unable to create user profile');
        return null;
      }

      setProfile(userProfile);

      // Step 3: Get workspace ID
      let workspaceId = userProfile.default_workspace_id;

      // Step 4: If no workspace ID, try to find one from memberships
      if (!workspaceId) {
        const { data: memberships, error: memberError } = await supabase
          .from('workspace_members')
          .select('workspace_id')
          .eq('user_id', userProfile.id);

        if (!memberError && memberships && memberships.length > 0) {
          workspaceId = (memberships[0] as any).workspace_id;
        } else {
          // No memberships found, create new workspace
          const { error: setupError } = await supabase.rpc('setup_user_profile');
          
          if (setupError) {
            setError(`Failed to create workspace: ${setupError.message}`);
            return null;
          }

          // Get updated profile with new workspace
          const { data: updatedProfile } = await supabase
            .from('user_profiles')
            .select('*')
            .eq('auth_user_id', user.id)
            .single();

          if (updatedProfile) {
            workspaceId = (updatedProfile as any).default_workspace_id;
            setProfile(updatedProfile as UserProfile);
          }
        }
      }

      if (!workspaceId) {
        setError('Unable to determine workspace');
        return null;
      }

      // Step 5: Get workspace details
      const { data: workspaceData, error: wsError } = await supabase
        .from('workspaces')
        .select('*')
        .eq('id', workspaceId)
        .single();

      if (wsError || !workspaceData) {
        setError(`Workspace not found: ${workspaceId}`);
        return null;
      }

      setWorkspace(workspaceData as Workspace);
      return workspaceData as Workspace;

    } catch (err: any) {
      console.error('Error ensuring workspace:', err);
      setError(err.message || 'Unknown error');
      return null;
    }
  };

  const refreshWorkspace = async () => {
    if (isInitializing.current) return;
    
    isInitializing.current = true;
    setLoading(true);
    
    try {
      await ensureWorkspace();
    } finally {
      setLoading(false);
      isInitializing.current = false;
    }
  };

  useEffect(() => {
    let mounted = true;
    
    const initialize = async () => {
      if (!mounted) return;
      await refreshWorkspace();
    };
    
    initialize();

    // Subscribe to auth changes
    const { data: authListener } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!mounted) return;
      
      if (event === 'SIGNED_OUT') {
        setWorkspace(null);
        setProfile(null);
        setError(null);
      }
      // Don't refresh on TOKEN_REFRESHED or SIGNED_IN events to avoid loops
    });

    return () => {
      mounted = false;
      authListener?.subscription.unsubscribe();
    };
  }, []); // Empty dependency array - only run once on mount

  return {
    workspace,
    profile,
    loading,
    error,
    refreshWorkspace,
    ensureWorkspace
  };
};