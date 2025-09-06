export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

// Define simplified types that match actual Supabase response structure
export interface UserProfile {
  id: string;
  auth_user_id?: string;
  email: string;
  full_name: string | null;
  avatar_url?: string | null;
  default_workspace_id: string | null;
  current_workspace_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface Workspace {
  id: string;
  name: string;
  workspace_type: 'personal' | 'business' | 'family';
  owner_id: string;
  default_currency: string;
  logo_url?: string | null;
  settings?: any;
  created_at: string;
  updated_at: string;
}

export interface WorkspaceMember {
  id: string;
  workspace_id: string;
  user_id: string;
  role: 'owner' | 'member' | 'bookkeeper' | 'viewer';
  invited_by?: string | null;
  invited_at?: string | null;
  accepted_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface Institution {
  id: string;
  workspace_id: string;
  plaid_institution_id: string;
  name: string;
  logo_url: string | null;
  logo_base64?: string | null;
  hex_color: string | null;
  website_url: string | null;
  routing_numbers: string[] | null;
  status: string;
  created_at: string;
  updated_at: string;
}

export interface BankAccount {
  id: string;
  workspace_id: string;
  institution_id: string;
  plaid_account_id: string;
  name: string;
  account_type: string;
  account_subtype_detailed: string | null;
  mask: string | null;
  routing_number: string | null;
  current_balance_cents: number;
  available_balance_cents: number | null;
  verification_status: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  institution?: Institution;
}

export interface FeedTransaction {
  id: string;
  workspace_id: string;
  bank_account_id: string;
  plaid_transaction_id: string | null;
  amount_cents: number;
  direction: 'inflow' | 'outflow';
  status: 'pending' | 'posted' | 'cancelled';
  transaction_date: string;
  merchant_name: string | null;
  merchant_logo_url: string | null;
  merchant_website: string | null;
  merchant_entity_id: string | null;
  location_city: string | null;
  location_region: string | null;
  location_lat: number | null;
  location_lon: number | null;
  location_store_number: string | null;
  counterparty_name: string | null;
  counterparty_logo_url: string | null;
  payment_method: string | null;
  payment_processor: string | null;
  check_number?: string | null;
  personal_finance_category_primary: string | null;
  personal_finance_category_confidence: number | null;
  content_hash: string;
  created_at: string;
  updated_at: string;
}

export interface Category {
  id: string;
  workspace_id: string;
  name: string;
  category_type: 'expense' | 'income' | 'transfer';
  parent_category_id: string | null;
  parent_id?: string | null; // alias for components that use parent_id
  color: string | null;
  icon: string | null;
  is_system: boolean;
  created_at: string;
  updated_at: string;
}

export interface MerchantAlias {
  id: string;
  workspace_id: string;
  normalized_name: string;
  original_name?: string; // some components expect this
  display_name: string;
  match_patterns: string[];
  category_id?: string | null;
  created_at: string;
  updated_at: string;
}

export interface CategoryRule {
  id: string;
  workspace_id: string;
  rule_name?: string;
  condition_type: 'merchant_name' | 'description' | 'amount' | 'account';
  condition_value: string;
  action_type: string;
  rule_type?: 'contains' | 'equals' | 'starts_with' | 'regex';
  pattern?: string;
  category_id: string;
  priority: number;
  confidence: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface CategorizationRule extends CategoryRule {
  // Alias for components expecting CategorizationRule
}

export interface ChartOfAccount {
  id: string;
  workspace_id: string;
  account_code: string;
  account_name: string;
  account_type: 'asset' | 'liability' | 'equity' | 'revenue' | 'expense';
  parent_account_id: string | null;
  parent_id?: string | null; // alias
  is_active: boolean;
  normal_balance: 'debit' | 'credit';
  created_at: string;
  updated_at: string;
}

export interface JournalEntry {
  id: string;
  workspace_id: string;
  entry_date: string;
  description: string;
  reference_number: string | null;
  status: 'draft' | 'posted' | 'void';
  created_by: string;
  posted_at: string | null;
  voided_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface JournalEntryLine {
  id: string;
  journal_entry_id: string;
  account_id: string;
  description: string | null;
  debit_cents: number | null;
  credit_cents: number | null;
  created_at: string;
}

export interface LedgerEntry {
  id: string;
  workspace_id: string;
  account_id: string;
  journal_entry_id?: string;
  journal_batch_id?: string;
  entry_type: 'debit' | 'credit';
  amount_cents: number;
  entry_date: string;
  description: string | null;
  debit_cents?: number | null;
  credit_cents?: number | null;
  balance_cents?: number;
  created_at: string;
}

export interface TransactionLink {
  id: string;
  workspace_id: string;
  feed_transaction_id: string;
  ledger_entry_id: string;
  allocation_percentage: number;
  created_at: string;
}

export interface Budget {
  id: string;
  workspace_id: string;
  name: string;
  period_type: 'monthly' | 'quarterly' | 'annually';
  start_date: string;
  end_date: string;
  total_budgeted_cents: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface BudgetPeriod extends Budget {
  // Alias for components expecting BudgetPeriod
}

export interface BudgetLine {
  id: string;
  budget_id: string;
  budget_period_id?: string;
  category_id: string | null;
  account_id?: string | null;
  budgeted_amount_cents: number;
  amount_cents?: number;
  notes?: string | null;
  created_at: string;
  updated_at: string;
}

export interface BudgetActual {
  id: string;
  budget_id?: string;
  budget_period_id?: string;
  category_id: string | null;
  account_id?: string | null;
  actual_amount_cents: number;
  variance_cents: number;
  percentage_used?: number;
  last_calculated_at?: string;
  created_at: string;
  updated_at: string;
}

export interface Document {
  id: string;
  workspace_id: string;
  transaction_id?: string | null;
  document_type?: string;
  file_name?: string;
  file_size?: number;
  mime_type: string;
  storage_path: string;
  ocr_status: 'pending' | 'processing' | 'processed' | 'completed' | 'failed' | null;
  ocr_data?: Json | null;
  uploaded_by?: string;
  created_at: string;
  updated_at: string;
}

export interface DocumentExtraction {
  id: string;
  document_id: string;
  extracted_text: string | null;
  extracted_data: any;
  confidence_score: number | null;
  processing_engine: string | null;
  processed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface DocumentAttachment {
  id: string;
  document_id: string;
  attached_to_type: string;
  attached_to_id: string;
  created_at: string;
}

// Keep Database interface for reference
export interface Database {
  public: {
    Tables: {
      user_profiles: {
        Row: UserProfile;
        Insert: Partial<UserProfile>;
        Update: Partial<UserProfile>;
      };
      workspaces: {
        Row: Workspace;
        Insert: Partial<Workspace>;
        Update: Partial<Workspace>;
      };
      workspace_members: {
        Row: WorkspaceMember;
        Insert: Partial<WorkspaceMember>;
        Update: Partial<WorkspaceMember>;
      };
      institutions: {
        Row: Institution;
        Insert: Partial<Institution>;
        Update: Partial<Institution>;
      };
      bank_accounts: {
        Row: BankAccount;
        Insert: Partial<BankAccount>;
        Update: Partial<BankAccount>;
      };
      feed_transactions: {
        Row: FeedTransaction;
        Insert: Partial<FeedTransaction>;
        Update: Partial<FeedTransaction>;
      };
      categories: {
        Row: Category;
        Insert: Partial<Category>;
        Update: Partial<Category>;
      };
      merchant_aliases: {
        Row: MerchantAlias;
        Insert: Partial<MerchantAlias>;
        Update: Partial<MerchantAlias>;
      };
      category_rules: {
        Row: CategoryRule;
        Insert: Partial<CategoryRule>;
        Update: Partial<CategoryRule>;
      };
      chart_of_accounts: {
        Row: ChartOfAccount;
        Insert: Partial<ChartOfAccount>;
        Update: Partial<ChartOfAccount>;
      };
      ledger_entries: {
        Row: LedgerEntry;
        Insert: Partial<LedgerEntry>;
        Update: Partial<LedgerEntry>;
      };
      transaction_links: {
        Row: TransactionLink;
        Insert: Partial<TransactionLink>;
        Update: Partial<TransactionLink>;
      };
      budgets: {
        Row: Budget;
        Insert: Partial<Budget>;
        Update: Partial<Budget>;
      };
      budget_lines: {
        Row: BudgetLine;
        Insert: Partial<BudgetLine>;
        Update: Partial<BudgetLine>;
      };
      documents: {
        Row: Document;
        Insert: Partial<Document>;
        Update: Partial<Document>;
      };
      document_attachments: {
        Row: DocumentAttachment;
        Insert: Partial<DocumentAttachment>;
        Update: Partial<DocumentAttachment>;
      };
    };
    Views: {};
    Functions: {
      current_user_profile_id: {
        Args: Record<PropertyKey, never>;
        Returns: string;
      };
      is_workspace_member: {
        Args: {
          workspace_uuid: string;
          role?: string;
        };
        Returns: boolean;
      };
      has_workspace_write_access: {
        Args: {
          workspace_uuid: string;
        };
        Returns: boolean;
      };
      handle_new_user: {
        Args: Record<PropertyKey, never>;
        Returns: void;
      };
      import_plaid_transactions_enhanced: {
        Args: {
          transactions: Json[];
        };
        Returns: void;
      };
      import_plaid_institution_data: {
        Args: {
          institution_data: Json;
        };
        Returns: void;
      };
      apply_categorization_rules: {
        Args: {
          transaction_id: string;
        };
        Returns: void;
      };
      create_split_transaction: {
        Args: {
          transaction_id: string;
          splits: Json[];
        };
        Returns: void;
      };
    };
    Enums: {};
    CompositeTypes: {};
  };
}