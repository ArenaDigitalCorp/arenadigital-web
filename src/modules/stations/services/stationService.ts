import { supabase } from "@/shared/database/supabaseClient";

export interface StationType {
    id: string;
    name: string;
}

export interface StationInput {
    arena_id: string;
    name: string;
    status: 'ativo' | 'inativo' | 'Em manutenção' | 'Desativado';
    station_type_id: string;
}

export class StationService {
    static async getStationTypes() {
        const { data, error } = await supabase
            .from('station_types')
            .select('*')
            .order('name');

        if (error) {
            console.error('Error fetching station types:', error);
            throw error;
        }

        return data as StationType[];
    }

    static async createStation(input: StationInput) {
        const { data, error } = await supabase
            .from('stations')
            .insert([input])
            .select()
            .single();

        if (error) {
            console.error('Error creating station:', error);
            throw error;
        }

        return data;
    }

    static async getStationsByArena(arenaId: string) {
        const { data, error } = await supabase
            .from('stations')
            .select(`
                *,
                station_type:station_types(*)
            `)
            .eq('arena_id', arenaId)
            .order('created_at', { ascending: false });

        if (error) {
            console.error('Error fetching stations:', error);
            throw error;
        }

        return data;
    }

    static async getStationById(id: string) {
        const { data, error } = await supabase
            .from('stations')
            .select(`
                *,
                station_type:station_types(*)
            `)
            .eq('id', id)
            .single();

        if (error) {
            console.error('Error fetching station:', error);
            throw error;
        }

        return data;
    }

    static async updateStation(id: string, input: Partial<StationInput>) {
        const { data, error } = await supabase
            .from('stations')
            .update(input)
            .eq('id', id)
            .select()
            .single();

        if (error) {
            console.error('Error updating station:', error);
            throw error;
        }

        return data;
    }

    static async deleteStation(id: string) {
        const { error } = await supabase
            .from('stations')
            .delete()
            .eq('id', id);

        if (error) {
            console.error('Error deleting station:', error);
            throw error;
        }

        return true;
    }
}
