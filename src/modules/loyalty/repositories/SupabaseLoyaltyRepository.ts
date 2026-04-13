import type { SupabaseClient } from '@supabase/supabase-js';
import type { ILoyaltyRepository } from './ILoyaltyRepository';
import type { LoyaltyTransaction, CreateLoyaltyTransactionDTO, AthleteBalance, PaginatedResult } from '../types/loyalty.types';

export class SupabaseLoyaltyRepository implements ILoyaltyRepository {
  constructor(private readonly client: SupabaseClient) {}

  async findRecent(arenaId: string, tipo: 'crédito' | 'resgate' | 'vencimento', limit = 5): Promise<LoyaltyTransaction[]> {
    const { data, error } = await this.client
      .from('programa_fidelidade_extrato')
      .select('id, valor, tipo, descricao, data_registro, atleta:id_atleta(nome_perfil)')
      .eq('id_arena', arenaId)
      .eq('tipo', tipo)
      .order('data_registro', { ascending: false })
      .limit(limit);

    if (error) throw new Error(`SupabaseLoyaltyRepository.findRecent: ${error.message}`);
    return (data ?? []) as unknown as LoyaltyTransaction[];
  }

  async findRecentRedemptions(arenaId: string, limit = 5): Promise<LoyaltyTransaction[]> {
    const { data, error } = await this.client
      .from('programa_fidelidade_extrato')
      .select('id, valor, tipo, descricao, data_registro, atleta:id_atleta(nome_perfil)')
      .eq('id_arena', arenaId)
      .in('tipo', ['resgate', 'vencimento'])
      .order('data_registro', { ascending: false })
      .limit(limit);

    if (error) throw new Error(`SupabaseLoyaltyRepository.findRecentRedemptions: ${error.message}`);
    return (data ?? []) as unknown as LoyaltyTransaction[];
  }

  async create(data: CreateLoyaltyTransactionDTO): Promise<void> {
    const { error } = await this.client
      .from('programa_fidelidade_extrato')
      .insert([{ ...data, data_registro: data.data_registro ?? new Date().toISOString() }]);

    if (error) throw new Error(`SupabaseLoyaltyRepository.create: ${error.message}`);
  }

  async getStatement(arenaId: string, page = 1, pageSize = 10, filters?: { athleteName?: string; startDate?: string; endDate?: string }): Promise<PaginatedResult<LoyaltyTransaction>> {
    const offset = (page - 1) * pageSize;

    let query = this.client
      .from('programa_fidelidade_extrato')
      .select('*, atleta:id_atleta!inner(nome_perfil), criador:created_by(name)', { count: 'exact' })
      .eq('id_arena', arenaId);

    if (filters?.athleteName) query = query.ilike('atleta.nome_perfil', `%${filters.athleteName}%`);
    if (filters?.startDate) query = query.gte('data_registro', filters.startDate);
    if (filters?.endDate) query = query.lte('data_registro', filters.endDate);

    const { data, error, count } = await query
      .order('data_registro', { ascending: false })
      .range(offset, offset + pageSize - 1);

    if (error) throw new Error(`SupabaseLoyaltyRepository.getStatement: ${error.message}`);
    return { data: (data ?? []) as unknown as LoyaltyTransaction[], total: count ?? 0, totalPages: Math.ceil((count ?? 0) / pageSize) };
  }

  async getTopAthletes(arenaId: string, limit = 5): Promise<{ name: string; balance: number }[]> {
    const { data, error } = await this.client
      .from('athlete_loyalty_balance')
      .select('balance, atleta:id_atleta(nome_perfil)')
      .eq('id_arena', arenaId)
      .order('balance', { ascending: false })
      .limit(limit);

    if (error) throw new Error(`SupabaseLoyaltyRepository.getTopAthletes: ${error.message}`);
    return (data ?? []).map((item: any) => ({ name: item.atleta?.nome_perfil ?? 'Desconhecido', balance: Number(item.balance) }));
  }

  async getAthletesWithBalance(arenaId: string, page = 1, pageSize = 10, query?: string): Promise<PaginatedResult<AthleteBalance>> {
    const offset = (page - 1) * pageSize;

    let q = this.client
      .from('athlete_loyalty_balance')
      .select('id_atleta, balance, atleta:id_atleta!inner(id, nome_perfil, telefone)', { count: 'exact' })
      .eq('id_arena', arenaId);

    if (query) q = q.ilike('atleta.nome_perfil', `%${query}%`);

    const { data, error, count } = await q
      .order('balance', { ascending: false })
      .range(offset, offset + pageSize - 1);

    if (error) throw new Error(`SupabaseLoyaltyRepository.getAthletesWithBalance: ${error.message}`);

    const result: AthleteBalance[] = (data ?? []).map((item: any) => ({
      id_atleta: item.id_atleta,
      name: item.atleta?.nome_perfil ?? 'Desconhecido',
      phone: item.atleta?.telefone ?? '',
      balance: Number(item.balance),
    }));

    return { data: result, total: count ?? 0, totalPages: Math.ceil((count ?? 0) / pageSize) };
  }

  async searchAthletes(arenaId: string, query?: string): Promise<{ id: string; nome_perfil: string; telefone: string | null }[]> {
    let q = this.client
      .from('arenas_atleta')
      .select('id_atleta, atleta:id_atleta!inner(id, nome_perfil, telefone)')
      .eq('id_arena', arenaId);

    if (query) q = q.ilike('atleta.nome_perfil', `%${query}%`);

    const { data, error } = await q.limit(query ? 10 : 100);
    if (error) throw new Error(`SupabaseLoyaltyRepository.searchAthletes: ${error.message}`);

    return (data ?? [])
      .map((item: any) => item.atleta)
      .filter(Boolean) as { id: string; nome_perfil: string; telefone: string | null }[];
  }
}
