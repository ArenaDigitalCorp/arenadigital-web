import { supabase } from '@/shared/database/supabaseClient';
import { SupabaseProductRepository } from '../repositories/SupabaseProductRepository';

export type { Product, CreateProductDTO as ProductInput } from '../types/product.types';

const repo = new SupabaseProductRepository(supabase);

export class ProductService {
  static getProductsByArena(arenaId: string) {
    return repo.findByArena(arenaId);
  }

  static createProduct(input: Parameters<typeof repo.create>[0]) {
    return repo.create(input);
  }

  static updateProduct(id: string, input: Parameters<typeof repo.update>[1]) {
    return repo.update(id, input);
  }

  static deleteProduct(id: string) {
    return repo.delete(id);
  }
}
