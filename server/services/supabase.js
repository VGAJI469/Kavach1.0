const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.warn('[Supabase] Missing URL or Service Role Key – supabase client will be disabled');
}

const supabase = createClient(supabaseUrl, serviceRoleKey);

module.exports = supabase;
