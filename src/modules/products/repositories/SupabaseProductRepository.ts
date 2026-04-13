import type { SupabaseClient } from '@supabase/supabase-js';
import type { IProductRepository } from './IProductRepository';
import type { Product, CreateProductDTO, UpdateProductDTO } from '../types/product.types';

export class SupabaseProductRepository implements IProductRepository {
  constructor(private readonly client: SupabaseClient) {}

  async findByArena(arenaId: string): Promise<Product[]> {
    const { data, error } = await this.client
      .from('products')
      .select('*, station_type:station_types(*)')
      .eq('arena_id', arenaId)
      .order('created_at', { ascending: false });

    if (error) throw new Error(`SupabaseProductRepository.findByArena: ${error.message}`);
    return (data ?? []) as unknown as Product[];
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
