import type { Booking, CreateBookingDTO } from '../types/booking.types';

export interface IBookingRepository {
  findByArena(arenaId: string, startDate?: string, endDate?: string): Promise<Booking[]>;
  findByCourt(courtId: string, startDate?: string, endDate?: string): Promise<Booking[]>;
  findByArenaWithSports(arenaId: string, startDate: string, endDate: string): Promise<Booking[]>;
  create(data: CreateBookingDTO): Promise<Booking>;
  createMany(data: CreateBookingDTO[]): Promise<Booking[]>;
  updateStatus(id: string, status: 'confirmed' | 'cancelled'): Promise<Booking>;
}
