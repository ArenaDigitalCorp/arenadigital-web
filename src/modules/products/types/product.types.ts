import type { Database } from '@/types/supabase.types';

type Row = Database['public']['Tables']['products']['Row'];

export type CreateProductDTO = Database['public']['Tables']['products']['Insert'];
export type UpdateProductDTO = Database['public']['Tables']['products']['Update'];

export type Product = Row & {
  station_type?: { id: string; name: string } | null;
  station?: { id: string; name: string } | null;
};

/** Itens `catalog_kind = service` não usam estoque (ex.: aluguel de raquete). */
export function isCatalogService(p: Pick<Product, 'catalog_kind'>): boolean {
  return p.catalog_kind === 'service';
}

export interface StockMovement {
  id: string;
  product_id: string;
  arena_id: string;
  type: 'entrada' | 'saida';
  quantity: number;
  reference_type?: string;
  reference_id?: string;
  balance_after: number;
  registered_by: string;
  created_at: string;
  user?: { name: string };
}
