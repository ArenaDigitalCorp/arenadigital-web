import { supabase } from "@/shared/database/supabaseClient";

export interface CourtInput {
    arena_id: string;
    name: string;
    status: 'ativo' | 'inativo' | 'Em manutenção' | 'Desativado';
    type: string; // Quadra, Espaço social
    is_covered: boolean;
    observations?: string;
    available_days: string[];
    price: number;
    booking_type: 'unique' | 'hourly';
    image_url?: string;
    day_config?: any; // To store detailed schedule and pricing
    is_active: boolean; // Legacy, keep for compatibility
    capacity?: number;
}

export class CourtService {
    static async createCourt(input: CourtInput, sportIds?: string[]) {
        const { data: court, error: courtError } = await supabase
            .from('courts')
            .insert([{
                arena_id: input.arena_id,
                name: input.name,
                status: input.status,
                type: input.type,
                is_covered: input.is_covered,
                observations: input.observations,
                available_days: input.available_days,
                price: input.price,
                booking_type: input.booking_type,
                image_url: input.image_url,
                day_config: input.day_config,
                is_active: input.is_active,
                capacity: input.capacity
            }])
            .select()
            .single();

        if (courtError) {
            console.error('Error creating court:', courtError);
            throw courtError;
        }

        if (sportIds && sportIds.length > 0) {
            const courtSports = sportIds.map(sportId => ({
                court_id: court.id,
                sport_id: sportId
            }));

            const { error: sportsError } = await supabase
                .from('court_sports')
                .insert(courtSports);

            if (sportsError) {
                console.error('Error linking sports:', sportsError);
            }
        }

        return court;
    }

    static async getCourtsByArena(arenaId: string) {
        const { data, error } = await supabase
            .from('courts')
            .select(`
                *,
                sports:court_sports(
                    sport:sports(*)
                )
            `)
            .eq('arena_id', arenaId)
            .order('created_at', { ascending: false });

        if (error) {
            console.error('Error fetching courts:', error);
            throw error;
        }

        // Flatten sports array
        return data.map(court => ({
            ...court,
            sports: (court.sports as any[]).map(s => s.sport)
        }));
    }

    static async getCourtById(id: string) {
        const { data, error } = await supabase
            .from('courts')
            .select(`
                *,
                sports:court_sports(
                    sport:sports(*)
                )
            `)
            .eq('id', id)
            .single();

        if (error) {
            console.error('Error fetching court:', error);
            throw error;
        }

        return {
            ...data,
            sports: (data.sports as any[]).map((s: any) => s.sport)
        };
    }

    static async updateCourt(id: string, input: Partial<CourtInput>, sportIds?: string[]) {
        const { data: court, error: courtError } = await supabase
            .from('courts')
            .update({
                name: input.name,
                status: input.status,
                type: input.type,
                is_covered: input.is_covered,
                observations: input.observations,
                available_days: input.available_days,
                price: input.price,
                booking_type: input.booking_type,
                image_url: input.image_url,
                day_config: input.day_config,
                is_active: input.is_active,
                capacity: input.capacity
            })
            .eq('id', id)
            .select()
            .single();

        if (courtError) {
            console.error('Error updating court:', courtError);
            throw courtError;
        }

        if (sportIds) {
            // Delete old associations
            await supabase
                .from('court_sports')
                .delete()
                .eq('court_id', id);

            // Add new associations
            if (sportIds.length > 0) {
                const courtSports = sportIds.map(sportId => ({
                    court_id: id,
                    sport_id: sportId
                }));

                const { error: sportsError } = await supabase
                    .from('court_sports')
                    .insert(courtSports);

                if (sportsError) {
                    console.error('Error updating sports:', sportsError);
                }
            }
        }

        return court;
    }

    static async deleteCourt(id: string) {
        const { error } = await supabase
            .from('courts')
            .delete()
            .eq('id', id);

        if (error) {
            console.error('Error deleting court:', error);
            throw error;
        }

        return true;
    }

    static async uploadImage(file: File, arenaId: string, spaceId: string): Promise<string> {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('arenaId', arenaId);
        formData.append('spaceId', spaceId);
        formData.append('type', 'space');

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
}
