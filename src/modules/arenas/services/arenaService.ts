import { supabase } from "@/shared/database/supabaseClient";

export interface ArenaInput {
    name: string;
    status: 'active' | 'inactive' | 'maintenance';
    sports?: string[]; // IDs of sports
    comodidades?: string[]; // IDs of comodidades
    owner_id: string; // Internal UUID
    address?: any;
    phone?: string;
    email?: string;
    opening_hours?: any;
    description?: string;
    banner_url?: string;
    zip_code?: string;
    number?: string;
    complement?: string;
    municipio_id?: number;
    facebook?: string;
    instagram?: string;
    tiktok?: string;
    nome_moeda_virtual?: string;
    neighborhood?: string;
    location?: any;
}

export class ArenaService {
    static async createArena(input: ArenaInput) {
        // Extract sports and comodidades to handle separately
        const { sports, comodidades, ...arenaData } = input;

        const { data: arena, error } = await supabase
            .from('arenas')
            .insert([arenaData])
            .select()
            .single();

        if (error) {
            console.error('Error creating arena:', error);
            throw error;
        }

        // Insert sports if provided
        if (sports && sports.length > 0) {
            const arenaSports = sports.map(sportId => ({
                arena_id: arena.id,
                sport_id: sportId
            }));

            const { error: sportsError } = await supabase
                .from('arena_sports')
                .insert(arenaSports);

            if (sportsError) {
                console.error('Error linking sports:', sportsError);
            }
        }

        // Insert comodidades if provided
        if (comodidades && comodidades.length > 0) {
            const arenaComodidades = comodidades.map(comodidadeId => ({
                arena_id: arena.id,
                comodidade_id: comodidadeId
            }));

            const { error: comodidadesError } = await supabase
                .from('arena_comodidades')
                .insert(arenaComodidades);

            if (comodidadesError) {
                console.error('Error linking comodidades:', comodidadesError);
            }
        }

        return arena;
    }

    static async getArenasByOwner(ownerId: string) {
        // Find arenas where user is explicitly linked in arena_users
        const { data: linkedArenas } = await supabase
            .from('arena_users')
            .select('arena_id')
            .eq('user_id', ownerId)
            .in('status', ['Ativo', 'ativo', 'active']);

        const linkedArenaIds = linkedArenas?.map(l => l.arena_id) || [];

        // Build base query
        let query = supabase
            .from('arenas')
            .select(`
                *,
                sports_relation:arena_sports(
                    sport:sports(*)
                ),
                comodidades_relation:arena_comodidades(
                    comodidade:comodidades(*)
                )
            `);

        // Apply OR filter to include user's owned arenas or linked arenas
        if (linkedArenaIds.length > 0) {
            query = query.or(`owner_id.eq.${ownerId},id.in.(${linkedArenaIds.join(',')})`);
        } else {
            query = query.eq('owner_id', ownerId);
        }

        const { data, error } = await query.order('created_at', { ascending: false });

        if (error) {
            console.error('Error fetching arenas:', error);
            throw error;
        }

        return data.map(arena => ({
            ...arena,
            sports: (arena.sports_relation as any[])?.map(s => s.sport) || [],
            comodidades: (arena.comodidades_relation as any[])?.map(c => c.comodidade) || []
        }));
    }

    static async getArenaById(id: string) {
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

        if (error) {
            console.error('Error fetching arena:', error);
            throw error;
        }

        return {
            ...data,
            sports: (data.sports_relation as any[])?.map(s => s.sport) || [],
            comodidades: (data.comodidades_relation as any[])?.map(c => c.comodidade) || []
        };
    }

    static async updateArena(id: string, input: Partial<ArenaInput>) {
        const { sports, comodidades, ...arenaData } = input;

        const { data, error } = await supabase
            .from('arenas')
            .update(arenaData)
            .eq('id', id)
            .select()
            .single();

        if (error) {
            console.error('Error updating arena:', error);
            throw error;
        }

        if (sports) {
            // Delete old associations
            await supabase
                .from('arena_sports')
                .delete()
                .eq('arena_id', id);

            // Add new associations
            if (sports.length > 0) {
                const arenaSports = sports.map(sportId => ({
                    arena_id: id,
                    sport_id: sportId
                }));

                const { error: sportsError } = await supabase
                    .from('arena_sports')
                    .insert(arenaSports);

                if (sportsError) {
                    console.error('Error updating sports:', sportsError);
                }
            }
        }

        if (comodidades) {
            // Delete old associations
            await supabase
                .from('arena_comodidades')
                .delete()
                .eq('arena_id', id);

            // Add new associations
            if (comodidades.length > 0) {
                const arenaComodidades = comodidades.map(comodidadeId => ({
                    arena_id: id,
                    comodidade_id: comodidadeId
                }));

                const { error: comodidadesError } = await supabase
                    .from('arena_comodidades')
                    .insert(arenaComodidades);

                if (comodidadesError) {
                    console.error('Error updating comodidades:', comodidadesError);
                }
            }
        }

        return data;
    }

    static async deleteArena(id: string) {
        const { error } = await supabase
            .from('arenas')
            .delete()
            .eq('id', id);

        if (error) {
            console.error('Error deleting arena:', error);
            throw error;
        }

        return true;
    }

    static async uploadBanner(file: File, arenaId: string): Promise<string> {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('arenaId', arenaId);

        const response = await fetch('/api/upload', {
            method: 'POST',
            body: formData,
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Failed to upload image');
        }

        const data = await response.json();
        return data.url;
    }
    static async getFirstArenaByOrganizationUser(userId: string) {
        try {
            const arenas = await ArenaService.getArenasByOwner(userId);
            if (arenas && arenas.length > 0) {
                return arenas[0];
            }
            console.warn('No arena found for user:', userId);
            return null;
        } catch (error) {
            console.error('Error fetching first arena for user:', error);
            return null;
        }
    }
}
