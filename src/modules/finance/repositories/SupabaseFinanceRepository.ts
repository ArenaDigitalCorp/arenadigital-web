import type { SupabaseClient } from '@supabase/supabase-js';
import type { IFinanceRepository } from './IFinanceRepository';
import type { Transaction, CreateTransactionDTO, UpdateTransactionDTO, ArenaFinanceSummary, ArenaFinanceDailyRow } from '../types/finance.types';

const WITH_RELATIONS = '*, registered_by:users(name), atleta:atleta_id(id, nome_perfil), modo_pagamento:modo_pagamento_id(id, nome)' as const;

export class SupabaseFinanceRepository implements IFinanceRepository {
  constructor(private readonly client: SupabaseClient) {}

  async create(data: CreateTransactionDTO): Promise<Transaction> {
    const { data: row, error } = await this.client
      .from('transactions')
      .insert([data])
      .select()
      .single();

    if (error) throw new Error(`SupabaseFinanceRepository.create: ${error.message}`);
    return row as unknown as Transaction;
  }

  async findByArena(arenaId: string, type?: 'entrada' | 'saída', startDate?: string, endDate?: string): Promise<Transaction[]> {
    let query = this.client
      .from('transactions')
      .select(WITH_RELATIONS)
      .eq('arena_id', arenaId)
      .order('launch_date', { ascending: false });

    if (type) query = query.eq('type', type);
    if (startDate) query = query.gte('launch_date', startDate);
    if (endDate) query = query.lte('launch_date', endDate);

    const { data, error } = await query;
    if (error) throw new Error(`SupabaseFinanceRepository.findByArena: ${error.message}`);
    return (data ?? []) as unknown as Transaction[];
  }

  async findRecent(arenaId: string, type: 'entrada' | 'saída', limit = 4): Promise<Transaction[]> {
    const { data, error } = await this.client
      .from('transactions')
      .select(WITH_RELATIONS)
      .eq('arena_id', arenaId)
      .eq('type', type)
      .order('launch_date', { ascending: false })
      .limit(limit);

    if (error) throw new Error(`SupabaseFinanceRepository.findRecent: ${error.message}`);
    return (data ?? []) as unknown as Transaction[];
  }

  async update(id: string, data: UpdateTransactionDTO): Promise<Transaction> {
    const { data: row, error } = await this.client
      .from('transactions')
      .update(data)
      .eq('id', id)
      .select()
      .single();

    if (error) throw new Error(`SupabaseFinanceRepository.update: ${error.message}`);
    return row as unknown as Transaction;
  }

  async delete(id: string): Promise<void> {
    const { error } = await this.client.from('transactions').delete().eq('id', id);
    if (error) throw new Error(`SupabaseFinanceRepository.delete: ${error.message}`);
  }

  async getSummary(arenaId: string): Promise<ArenaFinanceSummary> {
    const { data, error } = await this.client.rpc('get_arena_finance_summary', { p_arena_id: arenaId });
    if (error) throw new Error(`SupabaseFinanceRepository.getSummary: ${error.message}`);

    const row = data?.[0];
    if (!row) return { lifetime_entradas: 0, lifetime_saidas: 0, current_month_entradas: 0, current_month_saidas: 0, prev_month_entradas: 0, prev_month_saidas: 0 };

    return {
      lifetime_entradas: Number(row.lifetime_entradas ?? 0),
      lifetime_saidas: Number(row.lifetime_saidas ?? 0),
      current_month_entradas: Number(row.current_month_entradas ?? 0),
      current_month_saidas: Number(row.current_month_saidas ?? 0),
      prev_month_entradas: Number(row.prev_month_entradas ?? 0),
      prev_month_saidas: Number(row.prev_month_saidas ?? 0),
    };
  }

  async getDailyTotals(arenaId: string, startDate: string, endDate: string): Promise<ArenaFinanceDailyRow[]> {
    const { data, error } = await this.client.rpc('get_arena_finance_daily_totals', {
      p_arena_id: arenaId,
      p_start_date: startDate,
      p_end_date: endDate,
    });

    if (error) throw new Error(`SupabaseFinanceRepository.getDailyTotals: ${error.message}`);
    return (data ?? []).map((r: { bucket_date: string; entradas: unknown; saidas: unknown }) => ({
      bucket_date: String(r.bucket_date),
      entradas: Number(r.entradas ?? 0),
      saidas: Number(r.saidas ?? 0),
    }));
  }
}
