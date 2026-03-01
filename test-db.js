import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey)

async function test() {
    const {data: est} = await supabase.from('estados').select('*').limit(1);
    console.log("Estados:", est);
    
    const {data: mun} = await supabase.from('municipios').select('*').limit(1);
    console.log("Municipios:", mun);
}
test();
