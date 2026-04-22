import type { Database } from '@/types/supabase.types';

type Row = Database['public']['Tables']['bookings']['Row'];

export type CreateBookingDTO = Database['public']['Tables']['bookings']['Insert'];
export type UpdateBookingDTO = Database['public']['Tables']['bookings']['Update'];

export type Booking = Row & {
  courts?: { id: string; name: string } | null;
  sports?: { id: string; name: string } | null;
  atleta?: { id: string; nome_perfil: string; telefone: string } | null;
};

export type PlanoMensalista = Database['public']['Tables']['planos_mensalista']['Row'];
export type CreatePlanoMensalistaDTO = Database['public']['Tables']['planos_mensalista']['Insert'];

export interface PlanoMensalistaComDetalhes extends PlanoMensalista {
  atleta: { id: string; nome_perfil: string; telefone: string | null } | null;
  sports: { id: string; name: string } | null;
  court: { id: string; name: string } | null;
  proximo_mes_reservado: string | null;
}
