# Clear Piggy - Application Overview

## 🎯 Purpose
Clear Piggy is a personal finance management application that helps users track their financial transactions, view spending patterns, and manage multiple bank accounts through Plaid integration.

## 🏗️ Architecture

### Tech Stack
- **Frontend**: React with TypeScript
- **Styling**: Tailwind CSS with dark mode support
- **Database**: Supabase (PostgreSQL)
- **Authentication**: Supabase Auth
- **Bank Integration**: Plaid API
- **Charts**: Recharts
- **Animations**: Framer Motion
- **Edge Functions**: Deno (for serverless processing)

### Key Features
- 🔐 Secure authentication with email/password
- 🏦 Bank account connection via Plaid
- 📊 Transaction enrichment (logos, categories, locations)
- 📈 Visual dashboards with cash flow analysis
- 🌙 Dark/Light mode toggle
- 🔄 Real-time transaction syncing
- 🏢 Workspace management (Personal/Business)

## 📱 Application Flow

### 1. Authentication Flow
```
User visits app → Auth component
├── New User → Sign Up
│   ├── Create account with email/password
│   ├── Automatic workspace creation
│   └── Redirect to Onboarding
├── Existing User → Sign In
│   ├── Check workspace status
│   ├── If onboarding_completed = false → Onboarding
│   └── If onboarding_completed = true → Dashboard
```

### 2. Onboarding Flow (New Users)
```
Step 1: Welcome Screen
├── Introduction to Clear Piggy
└── Continue button

Step 2: Workspace Setup
├── Choose workspace name
├── Select type (Personal/Business)
└── Save and continue

Step 3: Connect Bank
├── Plaid Link integration
├── Select bank and authenticate
├── Grant permissions
└── Automatic transaction sync

Step 4: Completion
├── Success message
├── Mark onboarding_completed = true
└── Navigate to Dashboard
```

### 3. Dashboard Features
```
Main Dashboard
├── Navigation Sidebar
│   ├── Overview
│   ├── Transactions
│   ├── Budgets
│   ├── Analytics
│   └── Settings
├── Key Metrics Cards
│   ├── Total Balance
│   ├── Monthly Income
│   ├── Monthly Expenses
│   └── Net Cash Flow
├── Cash Flow Chart
│   ├── 30-day visualization
│   ├── Income vs Expenses areas
│   └── Interactive tooltips
├── Recent Transactions
│   ├── Merchant logos
│   ├── Categories
│   ├── Amounts (color-coded)
│   └── Search/Filter options
└── Account Management
    ├── View connected accounts
    ├── Sync transactions
    └── Disconnect accounts
```

## 🔄 Data Flow

### Transaction Sync Process
1. User connects bank account via Plaid
2. Access token encrypted and stored in database
3. Edge function `workspace-sync-transactions` triggered
4. Function decrypts token and fetches from Plaid
5. Transactions enriched with:
   - Personal Finance Categories
   - Merchant logos
   - Location data
   - Proper debit/credit classification
6. Data stored in PostgreSQL with RLS (Row Level Security)
7. Dashboard refreshes to show new transactions

### Database Schema
```
workspaces
├── id (UUID)
├── name
├── workspace_type (personal/business)
├── onboarding_completed (boolean)
└── created_at

user_profiles
├── id (UUID)
├── auth_user_id (FK to auth.users)
├── email
├── full_name
└── default_workspace_id (FK to workspaces)

workspace_members
├── workspace_id (FK to workspaces)
├── user_id (FK to user_profiles)
└── role (owner/member)

institutions
├── id
├── workspace_id (FK to workspaces)
├── plaid_institution_id
├── name
├── access_token_encrypted
├── cursor (for sync tracking)
└── plaid_item_id

accounts
├── id
├── institution_id (FK to institutions)
├── plaid_account_id
├── name
├── type
├── current_balance_cents
└── available_balance_cents

transactions
├── id
├── account_id (FK to accounts)
├── plaid_transaction_id
├── amount_cents
├── direction (inflow/outflow)
├── date
├── name
├── merchant_name
├── merchant_logo_url
├── category_primary
├── category_detailed
├── location_address
├── location_city
├── location_region
└── location_postal_code
```

## 🎨 UI/UX Features

### Theme System
- Dark/Light mode toggle
- Persistent theme preference
- Smooth transitions
- Accessible color contrasts

### Component Architecture
- `App.tsx` - Main routing logic
- `Auth.tsx` - Login/Signup forms
- `Onboarding.tsx` - 4-step wizard
- `Dashboard.tsx` - Main application interface
- `PlaidLink.tsx` - Bank connection component
- `CashFlowChart.tsx` - Memoized chart component
- `ThemeContext.tsx` - Theme state management
- `useWorkspace.ts` - Workspace data hook

### Performance Optimizations
- Memoized chart components to prevent flickering
- Debounced search inputs
- Lazy loading of transaction data
- Optimistic UI updates
- Background transaction syncing

## 🔐 Security Features
- AES-GCM encryption for Plaid tokens
- Row Level Security (RLS) in PostgreSQL
- Secure edge functions with authentication
- No client-side token exposure
- HTTPS-only communication

## 🚀 Current Status

### ✅ Completed
- User authentication system
- Workspace creation and management
- Onboarding flow
- Plaid integration
- Transaction syncing and enrichment
- Dashboard with metrics and charts
- Dark mode support
- Transaction display with proper debit/credit logic
- Account management (connect/disconnect)

### 🔧 Known Issues (Fixed)
- ~~Token decryption errors~~ ✅ Fixed with proper AES-GCM implementation
- ~~Transaction direction display~~ ✅ Fixed with direction field usage
- ~~Random loading screens~~ ✅ Fixed by removing TOKEN_REFRESHED handler
- ~~Infinite refresh loops~~ ✅ Fixed with useRef pattern
- ~~Onboarding not showing for new users~~ ✅ Fixed with workspace refresh on sign in
- ~~Chart flickering~~ ✅ Fixed with memoized component

### 📋 Future Enhancements
- Budget creation and tracking
- Spending analytics and insights
- Transaction categorization editing
- Export functionality (CSV, PDF)
- Mobile responsive design
- Multi-workspace support
- Recurring transaction detection
- Bill reminders
- Financial goals tracking

## 🔧 Development Commands

```bash
# Start development server
npm start

# Connect to Supabase database
psql postgresql://postgres.lwsazhbejvctvheomyzd:[password]@aws-0-us-east-1.pooler.supabase.com:6543/postgres

# Deploy edge functions
supabase functions deploy workspace-sync-transactions

# Check logs
supabase functions logs workspace-sync-transactions
```

## 📝 Testing Flow

1. **New User Signup**
   - Create account → Auto workspace creation → Onboarding → Connect bank → Dashboard

2. **Transaction Sync**
   - Dashboard → Sync button → Edge function processes → Transactions appear with enrichment

3. **Theme Toggle**
   - Settings → Toggle dark/light mode → Persistent across sessions

## 🎯 Success Metrics
- Successfully connects to multiple bank accounts
- Syncs and enriches all transaction data
- Provides clear visualization of cash flow
- Maintains data security and encryption
- Offers smooth, flicker-free user experience