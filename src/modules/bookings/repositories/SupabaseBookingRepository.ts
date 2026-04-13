import type { SupabaseClient } from '@supabase/supabase-js';
import type { IBookingRepository } from './IBookingRepository';
import type { Booking, CreateBookingDTO } from '../types/booking.types';

const WITH_RELATIONS = '*, courts(id, name), sports(id, name), atleta:athlete_id(id, nome_perfil, telefone)' as const;

export class SupabaseBookingRepository implements IBookingRepository {
  constructor(private readonly client: SupabaseClient) {}

  async findByArena(arenaId: string, startDate?: string, endDate?: string): Promise<Booking[]> {
    let query = this.client
      .from('bookings')
      .select('*, courts(name)')
      .eq('arena_id', arenaId);

    if (startDate) query = query.gte('start_time', startDate);
    if (endDate) query = query.lte('end_time', endDate);

    const { data, error } = await query.order('start_time', { ascending: true });
    if (error) throw new Error(`SupabaseBookingRepository.findByArena: ${error.message}`);
    return (data ?? []) as unknown as Booking[];
  }

  async findByCourt(courtId: string, startDate?: string, endDate?: string): Promise<Booking[]> {
    let query = this.client
      .from('bookings')
      .select(WITH_RELATIONS)
      .eq('court_id', courtId);

    if (startDate) query = query.gte('start_time', startDate);
    if (endDate) query = query.lte('end_time', endDate);

    const { data, error } = await query.order('start_time', { ascending: true });
    if (error) throw new Error(`SupabaseBookingRepository.findByCourt: ${error.message}`);
    return (data ?? []) as unknown as Booking[];
  }

  async findByArenaWithSports(arenaId: string, startDate: string, endDate: string): Promise<Booking[]> {
    const { data, error } = await this.client
      .from('bookings')
      .select(WITH_RELATIONS)
      .eq('arena_id', arenaId)
      .gte('start_time', startDate)
      .lte('end_time', endDate)
      .order('start_time', { ascending: true });

    if (error) throw new Error(`SupabaseBookingRepository.findByArenaWithSports: ${error.message}`);
    return (data ?? []) as unknown as Booking[];
  }

  async create(data: CreateBookingDTO): Promise<Booking> {
    const { data: row, error } = await this.client
      .from('bookings')
      .insert([data])
      .select()
      .single();

    if (error) throw new Error(`SupabaseBookingRepository.create: ${error.message}`);
    return row as unknown as Booking;
  }

  async createMany(data: CreateBookingDTO[]): Promise<Booking[]> {
    const { data: rows, error } = await this.client
      .from('bookings')
      .insert(data)
      .select();

    if (error) throw new Error(`SupabaseBookingRepository.createMany: ${error.message}`);
    return (rows ?? []) as unknown as Booking[];
  }

  async updateStatus(id: string, status: 'confirmed' | 'cancelled'): Promise<Booking> {
    const { data, error } = await this.client
      .from('bookings')
      .update({ status })
      .eq('id', id)
      .select()
      .single();

    if (error) throw new Error(`SupabaseBookingRepository.updateStatus: ${error.message}`);
    return data as unknown as Booking;
  }
}
