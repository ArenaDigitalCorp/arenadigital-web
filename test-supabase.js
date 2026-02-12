const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
    console.log('Checking Supabase connection...');
    console.log('URL:', supabaseUrl);

    try {
        const { data: users, error: usersError } = await supabase.from('users').select('*');
        if (usersError) throw usersError;
        console.log('Users in DB:', users.length);
        if (users.length > 0) {
            console.log('First user:', users[0]);
        }

        const { data: arenas, error: arenasError } = await supabase.from('arenas').select('count');
        if (arenasError) throw arenasError;
        console.log('✅ Arenas table check OK');

        console.log('All systems go!');
    } catch (err) {
        console.error('❌ Error during check:', err.message);
    }
}

check();
