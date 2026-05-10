import type { Database } from '@/types/supabase.types';
import { normalizeString } from '@/lib/utils';

type Row = Database['public']['Tables']['products']['Row'];

export type CreateProductDTO = Database['public']['Tables']['products']['Insert'];
export type UpdateProductDTO = Database['public']['Tables']['products']['Update'];

export type Product = Row & {
  station_type?: { id: string; name: string } | null;
  station?: { id: string; name: string } | null;
};

/** Valores persistidos em `products.status` (check no banco após migration ativo/inativo). */
export type CatalogAvailabilityStatus = 'Ativo' | 'Inativo';

/** Normaliza leitura de `products.status` (legado Em estoque/Em falta até o banco migrar). */
export function normalizeCatalogStatus(raw: string | null | undefined): CatalogAvailabilityStatus {
  if (raw === 'Ativo' || raw === 'Inativo') return raw;
  if (raw === 'Em falta') return 'Inativo';
  if (raw === 'Em estoque') return 'Ativo';
  return 'Ativo';
}

/** Itens `catalog_kind = service` não usam estoque (ex.: aluguel de raquete). */
export function isCatalogService(p: Pick<Product, 'catalog_kind'>): boolean {
  return p.catalog_kind === 'service';
}

/** Busca em catálogo/comanda: nome, tipo de item, palavras-chave produto/serviço (normalizado). */
export function matchesProductOrServiceSearch(
  p: Pick<Product, 'name' | 'item_type' | 'catalog_kind'>,
  raw: string,
): boolean {
  const q = normalizeString(raw.trim());
  if (!q) return true;
  if (normalizeString(p.name).includes(q)) return true;
  if (normalizeString(p.item_type ?? '').includes(q)) return true;
  const service = isCatalogService(p);
  if (q === 'servico' || q === 'service') return service;
  if (q === 'produto' || q === 'product') return !service;
  return false;
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
