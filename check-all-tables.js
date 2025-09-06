require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.REACT_APP_SUPABASE_URL;
const supabaseAnonKey = process.env.REACT_APP_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function checkAllTables() {
  console.log('🔍 Checking all available tables\n');
  
  // List of potential table names based on the project context
  const tables = [
    'documents',
    'document_attachments',
    'feed_transactions',
    'transactions',
    'bank_accounts',
    'accounts',
    'institutions',
    'users',
    'user_profiles',
    'households',
    'household_members',
    'workspaces',
    'workspace_members',
    'plaid_items',
    'balances',
    'categories',
    'receipts',
    'attachments'
  ];

  console.log('Table Name                     | Access | Count');
  console.log('-------------------------------|--------|-------');
  
  for (const table of tables) {
    try {
      const { data, error, count } = await supabase
        .from(table)
        .select('*', { count: 'exact', head: true });
      
      if (error) {
        console.log(`${table.padEnd(30)} | ❌     | ${error.message.includes('not exist') ? 'Does not exist' : 'No permission'}`);
      } else {
        console.log(`${table.padEnd(30)} | ✅     | ${count || 0}`);
      }
    } catch (e) {
      console.log(`${table.padEnd(30)} | ❌     | Error`);
    }
  }

  // Now check the documents table structure in detail
  console.log('\n\n📄 DOCUMENTS TABLE STRUCTURE:');
  console.log('────────────────────────────');
  
  const { data: sampleDoc } = await supabase
    .from('documents')
    .select('*')
    .limit(1);
  
  if (sampleDoc && sampleDoc[0]) {
    const columns = Object.keys(sampleDoc[0]);
    console.log('Columns found:');
    columns.forEach(col => {
      const value = sampleDoc[0][col];
      const type = value === null ? 'null' : typeof value;
      console.log(`  - ${col}: ${type}`);
    });
  } else {
    // Try to insert a test document to see the structure
    console.log('No documents found. Table appears to be empty.');
  }
}

checkAllTables();