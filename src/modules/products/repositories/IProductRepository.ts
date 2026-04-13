import type { Product, CreateProductDTO, UpdateProductDTO } from '../types/product.types';

export interface IProductRepository {
  findByArena(arenaId: string): Promise<Product[]>;
  create(data: CreateProductDTO): Promise<Product>;
  update(id: string, data: UpdateProductDTO): Promise<Product>;
  delete(id: string): Promise<void>;
}
