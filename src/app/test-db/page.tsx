import { supabase } from '@/shared/database/supabaseClient';

export default async function Page() {
    const { data, error } = await supabase.from('estados').select('*').limit(5);
    return (
        <div>
            <h1>Test Estados</h1>
            <pre>{JSON.stringify({ data, error }, null, 2)}</pre>
        </div>
    );
}
