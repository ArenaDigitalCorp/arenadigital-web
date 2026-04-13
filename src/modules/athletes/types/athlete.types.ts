import type { Database } from '@/types/supabase.types';

type Row = Database['public']['Tables']['atleta']['Row'];

export type CreateAtletaDTO = Database['public']['Tables']['atleta']['Insert'];
export type CreateAtletaEsporteDTO = Database['public']['Tables']['atleta_esportes']['Insert'];
export type CreateArenaAtletaDTO = Database['public']['Tables']['arenas_atleta']['Insert'];

export type Atleta = Row;

export type AtletaWithDetails = Row & {
  users?: { email: string } | null;
  arenas_atleta?: { id_arena: string }[];
  atleta_esportes?: { sport: { name: string } | null }[];
};

/** Flat view used in listings */
export interface AtletaListItem {
  id: string;
  name: string;
  cpf: string;
  telefone: string;
  email: string;
  sport: string;
}
