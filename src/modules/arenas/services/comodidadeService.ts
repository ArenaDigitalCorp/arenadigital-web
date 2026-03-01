import { supabase } from "@/shared/database/supabaseClient"

export interface Comodidade {
    id: string
    name: string
    created_at?: string
}

export class ComodidadeService {
    static async getComodidades(): Promise<Comodidade[]> {
        const { data: comodidades, error } = await supabase
            .from('comodidades')
            .select('*')
            .order('name')

        if (error) {
            console.error('Error fetching comodidades:', error)
            throw error
        }

        return comodidades || []
    }
}
