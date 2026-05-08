import type { SupabaseClient } from '@supabase/supabase-js';
import type { IProductRepository } from './IProductRepository';
import type { Product, CreateProductDTO, UpdateProductDTO } from '../types/product.types';

export class SupabaseProductRepository implements IProductRepository {
  constructor(private readonly client: SupabaseClient) {}

  async findByArena(arenaId: string): Promise<Product[]> {
    const { data: rows, error } = await this.client
      .from('products')
      .select('*, station_type:station_types(*)')
      .eq('arena_id', arenaId)
      .order('created_at', { ascending: false });

    if (error) throw new Error(`SupabaseProductRepository.findByArena: ${error.message}`);
    const products = (rows ?? []) as unknown as Product[];

    const stationIds = [
      ...new Set(
        products
          .map((p) => p.station_id)
          .filter((id): id is string => typeof id === 'string' && id.length > 0),
      ),
    ];

    if (stationIds.length === 0) {
      return products;
    }

    const { data: stations, error: stationsError } = await this.client
      .from('stations')
      .select('id, name')
      .eq('arena_id', arenaId)
      .in('id', stationIds);

    if (stationsError) {
      throw new Error(`SupabaseProductRepository.findByArena (stations): ${stationsError.message}`);
    }

    const byId = new Map((stations ?? []).map((s) => [s.id, s]));

    return products.map((p) => {
      if (!p.station_id) return p;
      const s = byId.get(p.station_id);
      if (!s) return p;
      return { ...p, station: { id: s.id, name: s.name } };
    });
  }

  async create(data: CreateProductDTO): Promise<Product> {
    const { data: row, error } = await this.client
      .from('products')
      .insert([data])
      .select()
      .single();

    if (error) throw new Error(`SupabaseProductRepository.create: ${error.message}`);
    return row as unknown as Product;
  }

  async update(id: string, data: UpdateProductDTO): Promise<Product> {
    const { data: row, error } = await this.client
      .from('products')
      .update({ ...data, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();

    if (error) throw new Error(`SupabaseProductRepository.update: ${error.message}`);
    return row as unknown as Product;
  }

  async delete(id: string): Promise<void> {
    const { error } = await this.client.from('products').delete().eq('id', id);
    if (error) throw new Error(`SupabaseProductRepository.delete: ${error.message}`);
  }
}
