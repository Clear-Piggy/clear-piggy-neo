const { createClient } = require('@supabase/supabase-js');

// Supabase credentials
const supabaseUrl = 'https://rnevebffhtplbixdmbgq.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJuZXZlYmZmaHRwbGJpeGRtYmdxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTY2NjI5ODQsImV4cCI6MjA3MjIzODk4NH0.VNnnzLLo2Pi5IxAy2-ZPVAbnbrIQLe9xi7tKcPnWOLw';
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJuZXZlYmZmaHRwbGJpeGRtYmdxIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NjY2Mjk4NCwiZXhwIjoyMDcyMjM4OTg0fQ.s2sWaR-21kbs5lN7amLhSjac7mPMb10EH6dJqFxeiK4';

// Use service role for full access
const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function testConnection() {
  console.log('🔌 Testing Supabase Connection...');
  console.log('📍 Project ID: rnevebffhtplbixdmbgq');
  console.log('🌐 URL: ' + supabaseUrl);
  console.log('');

  try {
    // Test basic connection by checking tables
    const tables = [
      'users',
      'households', 
      'institutions',
      'plaid_items',
      'accounts',
      'transactions',
      'balances',
      'categories'
    ];

    console.log('📊 Database Tables:');
    console.log('─'.repeat(50));
    
    for (const table of tables) {
      try {
        const { count, error } = await supabase
          .from(table)
          .select('*', { count: 'exact', head: true });
        
        if (!error) {
          console.log(`✅ ${table.padEnd(15)} : ${(count || 0).toString().padStart(6)} records`);
        } else {
          console.log(`❌ ${table.padEnd(15)} : ${error.message}`);
        }
      } catch (e) {
        console.log(`❌ ${table.padEnd(15)} : Error accessing`);
      }
    }

    // Check for any data in key tables
    console.log('\n📝 Sample Data Check:');
    console.log('─'.repeat(50));

    // Check users
    const { data: users, error: usersError } = await supabase
      .from('users')
      .select('id, email, created_at')
      .limit(3);
    
    if (users && users.length > 0) {
      console.log(`\nUsers (${users.length} shown):`);
      users.forEach(u => {
        console.log(`  • ${u.email || 'No email'} (ID: ${u.id.substring(0, 8)}...)`);
      });
    } else {
      console.log('\nNo users found in database');
    }

    // Check institutions
    const { data: institutions, error: instError } = await supabase
      .from('institutions')
      .select('id, name, created_at')
      .limit(3);
    
    if (institutions && institutions.length > 0) {
      console.log(`\nInstitutions (${institutions.length} shown):`);
      institutions.forEach(i => {
        console.log(`  • ${i.name} (ID: ${i.id})`);
      });
    } else {
      console.log('No institutions found in database');
    }

    console.log('\n✅ Connection successful! Database is accessible.');

  } catch (error) {
    console.error('❌ Connection failed:', error.message);
    console.error('Error details:', error);
  }
}

testConnection();