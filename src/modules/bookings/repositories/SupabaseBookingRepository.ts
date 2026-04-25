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
    if (endDate) query = query.lte('start_time', endDate);

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

  /**
   * Verifica se já existe uma reserva ativa que conflita com o período informado
   * para a mesma quadra. Conflito ocorre quando os períodos se sobrepõem:
   *   existente.start_time < novo.end_time AND existente.end_time > novo.start_time
   */
  private async checkConflict(courtId: string, startTime: string, endTime: string): Promise<void> {
    const { data, error } = await this.client
      .from('bookings')
      .select('id, athlete_name, start_time, end_time, status')
      .eq('court_id', courtId)
      .in('status', ['confirmed', 'reservado'])
      .lt('start_time', endTime)
      .gt('end_time', startTime)
      .limit(1);

    if (error) throw new Error(`SupabaseBookingRepository.checkConflict: ${error.message}`);
    if (data && data.length > 0) {
      const conflicting = data[0] as any;
      throw new Error(
        `Conflito de horário: já existe uma reserva para ${conflicting.athlete_name ?? 'outro atleta'} nesta quadra no período solicitado.`
      );
    }
  }

  async create(data: CreateBookingDTO): Promise<Booking> {
    // Valida conflito antes de inserir
    await this.checkConflict(data.court_id, data.start_time, data.end_time);

    const { data: row, error } = await this.client
      .from('bookings')
      .insert([data])
      .select()
      .single();

    if (error) throw new Error(`SupabaseBookingRepository.create: ${error.message}`);
    return row as unknown as Booking;
  }

  async createMany(data: CreateBookingDTO[]): Promise<Booking[]> {
    // Valida conflito para cada reserva antes de inserir em lote
    for (const booking of data) {
      await this.checkConflict(booking.court_id, booking.start_time, booking.end_time);
    }

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
