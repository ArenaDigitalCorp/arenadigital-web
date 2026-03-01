import { supabase } from "@/shared/database/supabaseClient";

export interface AtletaInput {
    id_users: string;
    nome_perfil: string;
    cpf?: string;
    telefone?: string;
    origem_cadastro?: 'arena' | 'aplicativo';
    id_arena_cadastro?: string;
}

export interface AtletaEsporteInput {
    id_atleta: string;
    id_esporte: string;
    nivel_habilidade?: string;
}

export interface ArenaAtletaInput {
    id_arena: string;
    id_atleta: string;
    origem?: 'web' | 'aplicativo';
}

export class AthleteService {
    static async createAtleta(input: AtletaInput) {
        const { data, error } = await supabase
            .from('atleta')
            .insert(input)
            .select()
            .single();

        if (error) {
            console.error('Error creating atleta:', error);
            throw error;
        }
        return data;
    }

    static async linkToArena(input: ArenaAtletaInput) {
        const { error } = await supabase
            .from('arenas_atleta')
            .insert(input);

        if (error) {
            console.error('Error linking atleta to arena:', error);
            throw error;
        }
    }

    static async addSport(input: AtletaEsporteInput) {
        const { error } = await supabase
            .from('atleta_esportes')
            .insert(input);

        if (error) {
            console.error('Error adding sport to athlete:', error);
            throw error;
        }
    }

    static async getAthletesByArena(arenaId: string, searchTerm?: string) {
        try {
            // Buscando diretamente da tabela de atletas para garantir consistência nos dados e filtros
            let query = supabase
                .from('atleta')
                .select(`
                    id,
                    nome_perfil,
                    cpf,
                    telefone,
                    arenas_atleta!inner (
                        id_arena
                    ),
                    atleta_esportes (
                        sport:id_esporte (
                            name
                        )
                    )
                `)
                .eq('arenas_atleta.id_arena', arenaId)
                .order('nome_perfil', { ascending: true });

            if (searchTerm) {
                query = query.ilike('nome_perfil', `%${searchTerm}%`);
            }

            const { data, error } = await query;

            if (error) {
                console.error('Error fetching athletes by arena:', error);
                throw error;
            }

            if (!data) return [];

            return (data as any[]).map(atleta => ({
                id: atleta.id,
                name: atleta.nome_perfil,
                cpf: atleta.cpf || "---",
                telefone: atleta.telefone || "---",
                sport: atleta.atleta_esportes?.[0]?.sport?.name || "N/A"
            }));
        } catch (err) {
            console.error('Critical error in getAthletesByArena:', err);
            return [];
        }
    }

    static async getSports() {
        const { data, error } = await supabase
            .from('sports')
            .select('id, name')
            .order('name');

        if (error) {
            console.error('Error fetching sports:', error);
            throw error;
        }
        return data || [];
    }
}
