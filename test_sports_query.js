const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function test() {
    const id = "20fe68cb-5097-4fd8-9ecf-973ccf00f694"; // arena from previous step
    const { data, error } = await supabase
        .from('arenas')
        .select(`
            *,
            sports_relation:arena_sports(
                sport:sports(*)
            )
        `)
        .eq('id', id)
        .single();

    console.log("Sports Relation:", JSON.stringify(data.sports_relation, null, 2));
}

test();
