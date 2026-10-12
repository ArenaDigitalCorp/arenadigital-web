import type { Database } from '@/types/supabase.types';
import type { CaixaTotalPorModo } from '@/modules/finance/lib/caixa';

type Row = Database['public']['Tables']['transactions']['Row'];

export type CreateTransactionDTO = Database['public']['Tables']['transactions']['Insert'];
export type UpdateTransactionDTO = Database['public']['Tables']['transactions']['Update'];

export type Transaction = Row & {
  registered_by?: { name: string | null } | null;
  atleta?: { id: string; nome_perfil: string } | null;
  modo_pagamento?: { id: string; nome: string } | null;
};

export interface ArenaFinanceSummary {
  lifetime_entradas: number;
  lifetime_saidas: number;
  current_month_entradas: number;
  current_month_saidas: number;
  prev_month_entradas: number;
  prev_month_saidas: number;
}

export interface ArenaFinanceDailyRow {
  bucket_date: string;
  entradas: number;
  saidas: number;
}

export type CaixaSessionStatus = 'aberta' | 'fechada';

export type CaixaSession = Omit<Database['public']['Tables']['caixa_sessions']['Row'], 'totais_por_modo'> & {
  totais_por_modo: CaixaTotalPorModo[] | null;
  opened_by_user?: { name: string | null } | null;
  closed_by_user?: { name: string | null } | null;
};

export type TransactionCategory = Database['public']['Tables']['transaction_categories']['Row'];

export interface CaixaSessionsHistoryFilters {
  page?: number;
  pageSize?: number;
  dateFrom?: string;
  dateTo?: string;
  openedBy?: string;
}

export interface CaixaResponsavel {
  id: string;
  name: string;
}
export type UpdateTransactionCategoryDTO = Database['public']['Tables']['transaction_categories']['Update'];
