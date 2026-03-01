const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

async function check() {
  const { data: estados, error } = await supabase.from('estados').select('*').limit(1);
  console.log("Estados:", estados);
  const { data: municipios, error2 } = await supabase.from('municipios').select('*').limit(1);
  console.log("Municipios:", municipios);
}

check();
