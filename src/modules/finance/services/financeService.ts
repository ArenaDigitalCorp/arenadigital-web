import { supabase } from '@/shared/database/supabaseClient';
import { SupabaseFinanceRepository } from '../repositories/SupabaseFinanceRepository';

export type { ArenaFinanceSummary, ArenaFinanceDailyRow, Transaction, CreateTransactionDTO as TransactionInput } from '../types/finance.types';

const repo = new SupabaseFinanceRepository(supabase);

export class FinanceService {
  static createTransaction(input: Parameters<typeof repo.create>[0]) {
    return repo.create(input);
  }

  static getArenaFinanceSummary(arenaId: string) {
    return repo.getSummary(arenaId);
  }

  static getArenaFinanceDailyTotals(arenaId: string, startDate: string, endDate: string) {
    return repo.getDailyTotals(arenaId, startDate, endDate);
  }

  static getRecentTransactions(arenaId: string, type: 'entrada' | 'saída', limit = 4) {
    return repo.findRecent(arenaId, type, limit);
  }

  static getTransactions(arenaId: string, type?: 'entrada' | 'saída', startDate?: string, endDate?: string) {
    return repo.findByArena(arenaId, type, startDate, endDate);
  }

  static async getTotals(arenaId: string) {
    const s = await repo.getSummary(arenaId);
    return { entradas: s.lifetime_entradas, saidas: s.lifetime_saidas, saldo: s.lifetime_entradas - s.lifetime_saidas };
  }

  static updateTransaction(id: string, input: Parameters<typeof repo.update>[1]) {
    return repo.update(id, input);
  }

  static deleteTransaction(id: string) {
    return repo.delete(id);
  }
}
