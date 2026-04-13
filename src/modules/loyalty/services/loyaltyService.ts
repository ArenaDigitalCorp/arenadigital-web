import { supabase } from '@/shared/database/supabaseClient';
import { SupabaseLoyaltyRepository } from '../repositories/SupabaseLoyaltyRepository';

export type { LoyaltyTransaction as FidelityTransaction, CreateLoyaltyTransactionDTO, AthleteBalance, PaginatedResult } from '../types/loyalty.types';

const repo = new SupabaseLoyaltyRepository(supabase);

export class LoyaltyService {
  static getLatestCredits(arenaId: string, limit = 5) {
    return repo.findRecent(arenaId, 'crédito', limit);
  }

  static getLatestRedemptions(arenaId: string, limit = 5) {
    return repo.findRecentRedemptions(arenaId, limit);
  }

  static createTransaction(data: Parameters<typeof repo.create>[0]) {
    return repo.create(data);
  }

  static getStatement(arenaId: string, page = 1, pageSize = 10, filters?: { athleteName?: string; startDate?: string; endDate?: string }) {
    return repo.getStatement(arenaId, page, pageSize, filters);
  }

  static getTopAthletes(arenaId: string, limit = 5) {
    return repo.getTopAthletes(arenaId, limit);
  }

  static getAthletesWithBalance(arenaId: string, page = 1, pageSize = 10, query?: string) {
    return repo.getAthletesWithBalance(arenaId, page, pageSize, query);
  }

  static searchArenaAthletes(arenaId: string, query?: string) {
    return repo.searchAthletes(arenaId, query);
  }
}
