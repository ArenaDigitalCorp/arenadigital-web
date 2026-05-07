import type { Booking, CreateBookingDTO, UpdateBookingDTO } from '../types/booking.types';

export interface IBookingRepository {
  findByArena(arenaId: string, startDate?: string, endDate?: string): Promise<Booking[]>;
  findByCourt(courtId: string, startDate?: string, endDate?: string): Promise<Booking[]>;
  findByArenaWithSports(arenaId: string, startDate: string, endDate: string): Promise<Booking[]>;
  create(data: CreateBookingDTO): Promise<Booking>;
  createMany(data: CreateBookingDTO[]): Promise<Booking[]>;
  updateStatus(id: string, status: 'confirmed' | 'cancelled'): Promise<Booking>;
  updateBooking(
    bookingId: string,
    courtId: string,
    patch: Pick<UpdateBookingDTO, 'athlete_name' | 'athlete_id' | 'sport_id' | 'start_time' | 'end_time' | 'price'>
  ): Promise<Booking>;
}
