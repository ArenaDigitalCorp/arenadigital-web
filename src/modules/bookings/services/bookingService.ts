import { supabase } from '@/shared/database/supabaseClient';
import { SupabaseBookingRepository } from '../repositories/SupabaseBookingRepository';

export type { Booking, CreateBookingDTO as BookingInput } from '../types/booking.types';

const repo = new SupabaseBookingRepository(supabase);

export class BookingService {
  static createBooking(input: Parameters<typeof repo.create>[0]) {
    return repo.create(input);
  }

  static createRecurringBookings(inputs: Parameters<typeof repo.createMany>[0]) {
    return repo.createMany(inputs);
  }

  static getBookingsByArena(arenaId: string, startDate?: string, endDate?: string) {
    return repo.findByArena(arenaId, startDate, endDate);
  }

  static getBookingsByCourt(courtId: string, startDate?: string, endDate?: string) {
    return repo.findByCourt(courtId, startDate, endDate);
  }

  static getBookingsByArenaWithSports(arenaId: string, startDate: string, endDate: string) {
    return repo.findByArenaWithSports(arenaId, startDate, endDate);
  }

  static updateBookingStatus(id: string, status: 'confirmed' | 'cancelled') {
    return repo.updateStatus(id, status);
  }
}
