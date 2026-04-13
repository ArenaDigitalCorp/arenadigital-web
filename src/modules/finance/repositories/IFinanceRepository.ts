import type { Transaction, CreateTransactionDTO, UpdateTransactionDTO, ArenaFinanceSummary, ArenaFinanceDailyRow } from '../types/finance.types';

export interface IFinanceRepository {
  create(data: CreateTransactionDTO): Promise<Transaction>;
  findByArena(arenaId: string, type?: 'entrada' | 'saída', startDate?: string, endDate?: string): Promise<Transaction[]>;
  findRecent(arenaId: string, type: 'entrada' | 'saída', limit?: number): Promise<Transaction[]>;
  update(id: string, data: UpdateTransactionDTO): Promise<Transaction>;
  delete(id: string): Promise<void>;
  getSummary(arenaId: string): Promise<ArenaFinanceSummary>;
  getDailyTotals(arenaId: string, startDate: string, endDate: string): Promise<ArenaFinanceDailyRow[]>;
}
