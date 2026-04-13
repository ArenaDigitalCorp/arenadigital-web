import type { Database } from '@/types/supabase.types';

type Row = Database['public']['Tables']['rotativos']['Row'];
type InscricaoRow = Database['public']['Tables']['rotativo_inscricoes']['Row'];

export type CreateRotativoDTO = Database['public']['Tables']['rotativos']['Insert'];
export type CreateInscricaoDTO = Database['public']['Tables']['rotativo_inscricoes']['Insert'];

export type Rotativo = Row & {
  esporte?: { name: string } | null;
  inscricoes_count?: number;
};

export type RotativoInscricao = InscricaoRow & {
  atleta?: { nome_perfil: string } | null;
};

export interface MonthCalendarEntry {
  hasRotativo: boolean;
  hasInscriptions: boolean;
}
