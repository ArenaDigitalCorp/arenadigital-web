import type { Database } from '@/types/supabase.types';

type Row = Database['public']['Tables']['bookings']['Row'];

export type CreateBookingDTO = Database['public']['Tables']['bookings']['Insert'];
export type UpdateBookingDTO = Database['public']['Tables']['bookings']['Update'];

export type BookingParticipantEmbed = {
  id: string
  atleta_id: string
  funcao: string
  status: string
  valor?: number | null
  pago_em?: string | null
  atleta?: { id: string; nome_perfil: string; telefone: string | null } | null
}

export type Booking = Row & {
  courts?: { id: string; name: string } | null
  sports?: { id: string; name: string } | null
  atleta?: { id: string; nome_perfil: string; telefone: string } | null
  booking_services?: BookingServiceEmbed[] | null
  booking_participants?: BookingParticipantEmbed[] | null
}

export type BookingServiceEmbed = {
  id: string
  booking_id: string
  product_id: string
  quantity: number
  unit_price: number
  products?: { id: string; name: string } | null
}

export type PlanoMensalista = Database['public']['Tables']['planos_mensalista']['Row'];
export type CreatePlanoMensalistaDTO = Database['public']['Tables']['planos_mensalista']['Insert'];

/** Uma faixa semanal do plano (planos_mensalista_blocos). */
export interface PlanoMensalistaBloco {
  id: string;
  court_id: string;
  dia_semana: number;
  horario_inicio: string;
  horario_fim: string;
  court: { id: string; name: string } | null;
}

export interface PlanoMensalistaComDetalhes extends PlanoMensalista {
  atleta: { id: string; nome_perfil: string; telefone: string | null } | null;
  sports: { id: string; name: string } | null;
  court: { id: string; name: string } | null;
  proximo_mes_reservado: string | null;
  /**
   * Faixas semanais do plano. Planos por blocos têm N; planos legados têm o
   * bloco espelho criado pelo backfill (ou nenhum, quando o horário salvo é
   * inválido). As colunas `dia_semana`/`horario_inicio` do próprio plano
   * continuam apontando para o primeiro bloco.
   */
  blocos?: PlanoMensalistaBloco[] | null;
}
