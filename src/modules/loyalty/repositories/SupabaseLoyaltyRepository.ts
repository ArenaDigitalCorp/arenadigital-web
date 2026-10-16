import type { SupabaseClient } from '@supabase/supabase-js';
import type { ILoyaltyRepository } from './ILoyaltyRepository';
import type { LoyaltyTransaction, AthleteBalance, PaginatedResult } from '../types/loyalty.types';

// PostgREST reports an offset beyond the result set as PGRST103/416 and
// omits count. Recount with the identical filters; never infer a zero balance.
async function emptyRangePage<T>(
  readCount: () => PromiseLike<{ count: number | null; error: { message: string } | null }>,
  pageSize: number,
): Promise<PaginatedResult<T>> {
  const { count, error } = await readCount();
  if (error) throw new Error(`SupabaseLoyaltyRepository.pagination: ${error.message}`);
  if (count === null) throw new Error('SupabaseLoyaltyRepository.pagination: count unavailable');
  return { data: [], total: count, totalPages: Math.ceil(count / pageSize) };
}

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

  async getStatement(arenaId: string, page = 1, pageSize = 10, filters?: { athleteName?: string; startDate?: string; endDate?: string }): Promise<PaginatedResult<LoyaltyTransaction>> {
    const offset = (page - 1) * pageSize;

    const buildQuery = (head = false) => {
      let query = this.client
        .from('programa_fidelidade_extrato')
        .select('*, atleta:id_atleta!inner(nome_perfil), criador:created_by(name)', { count: 'exact', head })
        .eq('id_arena', arenaId);

      if (filters?.athleteName) query = query.ilike('atleta.nome_perfil', `%${filters.athleteName}%`);
      if (filters?.startDate) query = query.gte('data_registro', filters.startDate);
      if (filters?.endDate) query = query.lte('data_registro', filters.endDate);
      return query;
    };

    const { data, error, count } = await buildQuery()
      .order('data_registro', { ascending: false })
      .range(offset, offset + pageSize - 1);

    if (error?.code === 'PGRST103' && page > 1) return emptyRangePage<LoyaltyTransaction>(() => buildQuery(true), pageSize);
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

    const buildQuery = (head = false) => {
      let q = this.client
        .from('athlete_loyalty_balance')
        .select('id_atleta, balance, atleta:id_atleta!inner(id, nome_perfil, telefone)', { count: 'exact', head })
        .eq('id_arena', arenaId);

      if (query) q = q.ilike('atleta.nome_perfil', `%${query}%`);
      return q;
    };

    const { data, error, count } = await buildQuery()
      .order('balance', { ascending: false })
      .range(offset, offset + pageSize - 1);

    if (error?.code === 'PGRST103' && page > 1) return emptyRangePage<AthleteBalance>(() => buildQuery(true), pageSize);
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
