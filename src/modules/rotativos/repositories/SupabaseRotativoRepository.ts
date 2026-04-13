import type { SupabaseClient } from '@supabase/supabase-js';
import type { IRotativoRepository } from './IRotativoRepository';
import type { Rotativo, RotativoInscricao, CreateRotativoDTO, MonthCalendarEntry } from '../types/rotativo.types';

export class SupabaseRotativoRepository implements IRotativoRepository {
  constructor(private readonly client: SupabaseClient) {}

  async create(data: CreateRotativoDTO): Promise<Rotativo> {
    const { data: row, error } = await this.client
      .from('rotativos')
      .insert(data)
      .select()
      .single();

    if (error) throw new Error(`SupabaseRotativoRepository.create: ${error.message}`);
    return row as unknown as Rotativo;
  }

  async findByDate(arenaId: string, date: string): Promise<Rotativo[]> {
    const { data, error } = await this.client
      .from('rotativos')
      .select('*, esporte:id_esporte(name)')
      .eq('id_arena', arenaId)
      .eq('data', date);

    if (error) throw new Error(`SupabaseRotativoRepository.findByDate: ${error.message}`);

    const results = await Promise.all(
      (data ?? []).map(async (r) => {
        const { count } = await this.client
          .from('rotativo_inscricoes')
          .select('*', { count: 'exact', head: true })
          .eq('id_rotativo', r.id);
        return { ...r, inscricoes_count: count ?? 0 } as unknown as Rotativo;
      })
    );

    return results;
  }

  async findByMonth(arenaId: string, startDate: string, endDate: string): Promise<Record<string, MonthCalendarEntry>> {
    const { data, error } = await this.client
      .from('rotativos')
      .select('id, data')
      .eq('id_arena', arenaId)
      .gte('data', startDate)
      .lte('data', endDate);

    if (error) throw new Error(`SupabaseRotativoRepository.findByMonth: ${error.message}`);

    const results = await Promise.all(
      (data ?? []).map(async (r) => {
        const { count } = await this.client
          .from('rotativo_inscricoes')
          .select('*', { count: 'exact', head: true })
          .eq('id_rotativo', r.id);
        return { data: r.data, inscricoes_count: count ?? 0 };
      })
    );

    const byDate: Record<string, MonthCalendarEntry> = {};
    for (const r of results) {
      if (!byDate[r.data]) byDate[r.data] = { hasRotativo: true, hasInscriptions: false };
      if (r.inscricoes_count > 0) byDate[r.data].hasInscriptions = true;
    }
    return byDate;
  }

  async getInscritos(rotativoId: string): Promise<RotativoInscricao[]> {
    const { data, error } = await this.client
      .from('rotativo_inscricoes')
      .select('*, atleta:id_atleta(nome_perfil)')
      .eq('id_rotativo', rotativoId)
      .order('data_inscricao', { ascending: true });

    if (error) throw new Error(`SupabaseRotativoRepository.getInscritos: ${error.message}`);
    return (data ?? []) as unknown as RotativoInscricao[];
  }

  async registerAthlete(rotativoId: string, athleteId: string, valuePaid: number): Promise<RotativoInscricao> {
    const { data: rotativo, error: rotativoError } = await this.client
      .from('rotativos')
      .select('limitado, limite_participantes')
      .eq('id', rotativoId)
      .single();

    if (rotativoError) throw new Error(`SupabaseRotativoRepository.registerAthlete (fetch): ${rotativoError.message}`);

    if (rotativo.limitado) {
      const { count, error: countError } = await this.client
        .from('rotativo_inscricoes')
        .select('*', { count: 'exact', head: true })
        .eq('id_rotativo', rotativoId);

      if (countError) throw new Error(`SupabaseRotativoRepository.registerAthlete (count): ${countError.message}`);
      if (count !== null && count >= (rotativo.limite_participantes ?? 0)) {
        throw new Error('Limite de participantes atingido.');
      }
    }

    const { data, error } = await this.client
      .from('rotativo_inscricoes')
      .insert({ id_rotativo: rotativoId, id_atleta: athleteId, valor_pago: valuePaid, status_pagamento: 'pago' })
      .select()
      .single();

    if (error) {
      if (error.code === '23505') throw new Error('Atleta já inscrito nesta sessão.');
      throw new Error(`SupabaseRotativoRepository.registerAthlete: ${error.message}`);
    }

    return data as unknown as RotativoInscricao;
  }
}
