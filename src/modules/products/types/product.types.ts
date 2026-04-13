import type { Database } from '@/types/supabase.types';

type Row = Database['public']['Tables']['products']['Row'];

export type CreateProductDTO = Database['public']['Tables']['products']['Insert'];
export type UpdateProductDTO = Database['public']['Tables']['products']['Update'];

export type Product = Row & {
  station_type?: { id: string; name: string } | null;
};
