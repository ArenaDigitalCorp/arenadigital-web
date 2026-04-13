import type { Database } from '@/types/supabase.types';

type Row = Database['public']['Tables']['programa_fidelidade_extrato']['Row'];

export type CreateLoyaltyTransactionDTO = Database['public']['Tables']['programa_fidelidade_extrato']['Insert'];

export type LoyaltyTransaction = Row & {
  atleta?: { nome_perfil: string } | null;
  criador?: { name: string | null } | null;
};

export interface AthleteBalance {
  id_atleta: string;
  name: string;
  phone: string;
  balance: number;
}

export interface PaginatedResult<T> {
  data: T[];
  total: number;
  totalPages: number;
}
