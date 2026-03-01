import { supabase } from "@/shared/database/supabaseClient";

export interface ArenaInput {
    name: string;
    status: 'active' | 'inactive' | 'maintenance';
    sports?: string[]; // IDs of sports
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
        // Extract sports to handle separately
        const { sports, ...arenaData } = input;

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

        return arena;
    }

    static async getArenasByOwner(ownerId: string) {
        const { data, error } = await supabase
            .from('arenas')
            .select(`
                *,
                sports_relation:arena_sports(
                    sport:sports(*)
                )
            `)
            .eq('owner_id', ownerId)
            .order('created_at', { ascending: false });

        if (error) {
            console.error('Error fetching arenas:', error);
            throw error;
        }

        return data.map(arena => ({
            ...arena,
            sports: (arena.sports_relation as any[])?.map(s => s.sport) || []
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
            sports: (data.sports_relation as any[])?.map(s => s.sport) || []
        };
    }

    static async updateArena(id: string, input: Partial<ArenaInput>) {
        const { sports, ...arenaData } = input;

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
        // 1. Find the organization owned by the user
        const { data: orgs, error: orgError } = await supabase
            .from('organizations')
            .select('id')
            .eq('owner_id', userId)
            .limit(1);

        if (orgError) {
            console.error('Error fetching organization:', orgError);
            throw orgError;
        }

        if (!orgs || orgs.length === 0) {
            console.warn('No organization found for user:', userId);
            return null;
        }

        const organizationId = orgs[0].id;

        // 2. Find the first arena linked to this organization
        const { data: arenas, error: arenaError } = await supabase
            .from('arenas')
            .select('*')
            .eq('organization_id', organizationId)
            .limit(1);

        if (arenaError) {
            console.error('Error fetching arena for organization:', arenaError);
            throw arenaError;
        }

        if (!arenas || arenas.length === 0) {
            console.warn('No arena found for organization:', organizationId);
            return null;
        }

        return arenas[0];
    }
}
