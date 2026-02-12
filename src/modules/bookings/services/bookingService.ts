import { supabase } from "@/shared/database/supabaseClient";

export interface BookingInput {
    arena_id: string;
    court_id: string;
    athlete_name: string;
    start_time: string;
    end_time: string;
    status: 'confirmed' | 'cancelled' | 'pending';
}

export class BookingService {
    static async createBooking(input: BookingInput) {
        const { data, error } = await supabase
            .from('bookings')
            .insert([input])
            .select()
            .single();

        if (error) {
            console.error('Error creating booking:', error);
            throw error;
        }

        return data;
    }

    static async getBookingsByArena(arenaId: string, startDate?: string, endDate?: string) {
        let query = supabase
            .from('bookings')
            .select('*, courts(name)')
            .eq('arena_id', arenaId);

        if (startDate) query = query.gte('start_time', startDate);
        if (endDate) query = query.lte('end_time', endDate);

        const { data, error } = await query.order('start_time', { ascending: true });

        if (error) {
            console.error('Error fetching bookings:', error);
            throw error;
        }

        return data;
    }

    static async updateBookingStatus(id: string, status: 'confirmed' | 'cancelled') {
        const { data, error } = await supabase
            .from('bookings')
            .update({ status })
            .eq('id', id)
            .select()
            .single();

        if (error) {
            console.error('Error updating booking:', error);
            throw error;
        }

        return data;
    }
}
