import type { Database } from '@/types/supabase.types';

type Row = Database['public']['Tables']['rotativos']['Row'];
type InscricaoRow = Database['public']['Tables']['rotativo_inscricoes']['Row'];

export type RotativoStatus = 'ativo' | 'desativado';
export type TipoPagamentoInscricao = 'credito' | 'avulso';
export type CreditoMovimentoTipo = 'compra' | 'uso' | 'vencimento';

export type CreateRotativoDTO = Database['public']['Tables']['rotativos']['Insert'] & {
  status?: RotativoStatus;
};

export type CreateInscricaoDTO = Database['public']['Tables']['rotativo_inscricoes']['Insert'] & {
  tipo_pagamento?: TipoPagamentoInscricao | null;
  modo_pagamento_id?: string | null;
  observacao?: string | null;
};

export type Rotativo = Row & {
  status?: RotativoStatus;
  esporte?: { name: string } | null;
  courts?: { id: string; name: string }[];
  inscricoes_count?: number;
};

export type RotativoInscricao = InscricaoRow & {
  tipo_pagamento?: TipoPagamentoInscricao | null;
  modo_pagamento_id?: string | null;
  observacao?: string | null;
  atleta?: { nome_perfil: string } | null;
  modo_pagamento?: { nome: string } | null;
};

export interface MonthCalendarEntry {
  hasRotativo: boolean;
  hasInscriptions: boolean;
}

export interface RotativoListFilters {
  search?: string;
  status?: RotativoStatus | 'todos';
  page?: number;
  pageSize?: number;
}

export interface RotativoPacote {
  id: string;
  arena_id: string;
  quantidade: number;
  valor_reais: number;
  ordem: number;
}

export interface RotativoCreditoMovimento {
  id: string;
  arena_id: string;
  atleta_id: string;
  tipo: CreditoMovimentoTipo;
  quantidade: number;
  lote_id: string | null;
  inscricao_id: string | null;
  created_at: string;
  atleta?: { nome_perfil: string } | null;
  lote?: { data_vencimento: string } | null;
}

export interface RotativoCreditoSaldo {
  arena_id: string;
  atleta_id: string;
  saldo: number;
  atleta?: { nome_perfil: string } | null;
}

export interface AtomicRotativoEnrollmentResult {
  inscricao_id: string;
  tipo_pagamento: TipoPagamentoInscricao;
  valor_pago: number;
  movimento_id: string | null;
  transaction_id: string | null;
  idempotent: boolean;
}

export interface AtomicRotativoCreditPurchaseResult {
  lote_id: string;
  movimento_id: string;
  transaction_id: string;
  valor_pago: number;
  idempotent: boolean;
}

export interface CourtOption {
  id: string;
  name: string;
}

export interface ModoPagamentoOption {
  id: string;
  nome: string;
}

export const ROTATIVO_VALIDITY_OPTIONS = [
  { label: '30 dias', days: 30 },
  { label: '60 dias', days: 60 },
  { label: '90 dias', days: 90 },
  { label: '6 meses', days: 180 },
  { label: '1 ano', days: 365 },
] as const;

export const CREDITO_PAYMENT_METHOD = '__credito__';
