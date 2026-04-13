import type { Database } from '@/types/supabase.types';

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
