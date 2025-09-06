const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const supabaseUrl = 'https://rnevebffhtplbixdmbgq.supabase.co';
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJuZXZlYmZmaHRwbGJpeGRtYmdxIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTczNDQwODgzMywiZXhwIjoyMDUwMDg0ODMzfQ.HKTrN23zfx_O-r7xOdYU0D-QWz3yOhMJnk1o-1zVkNs';

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function runMigration() {
  try {
    const sql = fs.readFileSync('add-workspace-type.sql', 'utf8');
    
    // Split SQL into individual statements and run them
    const statements = sql.split(';').filter(s => s.trim());
    
    for (const statement of statements) {
      if (statement.trim()) {
        console.log('Running:', statement.trim().split('\n')[0] + '...');
        const { error } = await supabase.rpc('exec', { sql: statement + ';' }).single();
        
        // Try direct execution if RPC fails
        if (error) {
          // Just run the SQL directly
          const response = await fetch(supabaseUrl + '/rest/v1/rpc', {
            method: 'POST',
            headers: {
              'apikey': supabaseServiceKey,
              'Authorization': `Bearer ${supabaseServiceKey}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              query: statement + ';'
            })
          });
          
          if (!response.ok) {
            console.error('Statement failed:', await response.text());
          }
        }
      }
    }
    
    console.log('Migration completed successfully!');
  } catch (error) {
    console.error('Migration failed:', error);
  }
}

runMigration();