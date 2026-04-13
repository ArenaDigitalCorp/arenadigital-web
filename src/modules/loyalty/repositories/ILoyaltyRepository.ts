import type { LoyaltyTransaction, CreateLoyaltyTransactionDTO, AthleteBalance, PaginatedResult } from '../types/loyalty.types';

export interface ILoyaltyRepository {
  findRecent(arenaId: string, tipo: 'crédito' | 'resgate' | 'vencimento', limit?: number): Promise<LoyaltyTransaction[]>;
  findRecentRedemptions(arenaId: string, limit?: number): Promise<LoyaltyTransaction[]>;
  create(data: CreateLoyaltyTransactionDTO): Promise<void>;
  getStatement(arenaId: string, page?: number, pageSize?: number, filters?: { athleteName?: string; startDate?: string; endDate?: string }): Promise<PaginatedResult<LoyaltyTransaction>>;
  getTopAthletes(arenaId: string, limit?: number): Promise<{ name: string; balance: number }[]>;
  getAthletesWithBalance(arenaId: string, page?: number, pageSize?: number, query?: string): Promise<PaginatedResult<AthleteBalance>>;
  searchAthletes(arenaId: string, query?: string): Promise<{ id: string; nome_perfil: string; telefone: string | null }[]>;
}
