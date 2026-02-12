import { supabase } from "@/shared/database/supabaseClient";

export interface Sport {
    id: string;
    name: string;
}

export class SportService {
    static async getSports() {
        const { data, error } = await supabase
            .from('sports')
            .select('*')
            .order('name', { ascending: true });

        if (error) {
            console.error('Error fetching sports:', error);
            throw error;
        }

        return data as Sport[];
    }
}
