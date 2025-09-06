import { createClient } from '@supabase/supabase-js';
import { Database } from '../types/database.types';

const supabaseUrl = process.env.REACT_APP_SUPABASE_URL!;
const supabaseAnonKey = process.env.REACT_APP_SUPABASE_ANON_KEY!;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables. Please check your .env.local file.');
}

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey);

// Helper functions
export const getCurrentUser = async () => {
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error) throw error;
  return user;
};

export const getCurrentUserProfile = async () => {
  const user = await getCurrentUser();
  if (!user) return null;
  
  const { data, error } = await supabase
    .from('user_profiles')
    .select('*')
    .eq('auth_user_id', user.id)
    .single();
    
  if (error) throw error;
  return data;
};

export const getCurrentWorkspace = async () => {
  const profile = await getCurrentUserProfile();
  if (!profile) return null;
  
  const workspaceId = (profile as any).current_workspace_id || (profile as any).default_workspace_id;
  if (!workspaceId) {
    console.error('No workspace ID found in profile');
    return null;
  }
  
  const { data, error } = await supabase
    .from('workspaces')
    .select('*')
    .eq('id', workspaceId)
    .single();
    
  if (error) {
    console.error('Error fetching workspace:', error);
    return null;
  }
  return data;
};

export const formatCurrency = (cents: number, currency = 'USD'): string => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(cents / 100);
};

export const formatNumber = (num: number): string => {
  return new Intl.NumberFormat('en-US').format(num);
};