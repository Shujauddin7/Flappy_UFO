// Quick test to check Supabase connection and tables
const { createClient } = require('@supabase/supabase-js');

// Load environment variables
require('dotenv').config({ path: '.env.local' });

const env = process.env.NEXT_PUBLIC_ENV || 'dev';
const supabaseUrl = env === 'production' 
  ? process.env.SUPABASE_PROD_URL 
  : process.env.SUPABASE_DEV_URL;
const supabaseKey = env === 'production' 
  ? process.env.SUPABASE_PROD_ANON_KEY 
  : process.env.SUPABASE_DEV_ANON_KEY;

console.log('Environment:', env);
console.log('Supabase URL:', supabaseUrl);
console.log('Supabase Key:', supabaseKey ? 'Present' : 'Missing');

const supabase = createClient(supabaseUrl, supabaseKey);

async function testConnection() {
  try {
    // Test basic connection
    console.log('Testing Supabase connection...');
    
    // Try to fetch from users table
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .limit(1);
    
    if (error) {
      console.error('Error querying users table:', error);
    } else {
      console.log('Users table exists. Sample data:', data);
    }
    
    // Try to get table info via RPC or direct query
    const { data: tables, error: tablesError } = await supabase
      .rpc('get_tables') 
      .catch(() => null);
    
    console.log('Tables query result:', { tables, tablesError });
    
  } catch (err) {
    console.error('Connection test failed:', err);
  }
}

testConnection();
