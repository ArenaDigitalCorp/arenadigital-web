import { supabase } from "@/shared/database/supabaseClient";

export interface Product {
    id: string;
    arena_id: string;
    name: string;
    item_type: 'Alimentação' | 'Bebida' | 'Vestimenta' | 'Acessório';
    station_type_id: string;
    price: number;
    status: 'Em estoque' | 'Em falta';
    created_at: string;
    updated_at: string;
    created_by?: string;
    updated_by?: string;
    station_type?: {
        id: string;
        name: string;
    };
}

export interface ProductInput {
    arena_id: string;
    name: string;
    item_type: 'Alimentação' | 'Bebida' | 'Vestimenta' | 'Acessório';
    station_type_id: string;
    price: number;
    status: 'Em estoque' | 'Em falta';
}

export class ProductService {
    static async getProductsByArena(arenaId: string) {
        const { data, error } = await supabase
            .from('products')
            .select(`
                *,
                station_type:station_types(*)
            `)
            .eq('arena_id', arenaId)
            .order('created_at', { ascending: false });

        if (error) {
            console.error('Error fetching products:', error);
            throw error;
        }

        return data as Product[];
    }

    static async createProduct(input: ProductInput) {
        const { data, error } = await supabase
            .from('products')
            .insert([input])
            .select()
            .single();

        if (error) {
            console.error('Error creating product:', error);
            throw error;
        }

        return data;
    }

    static async updateProduct(id: string, input: Partial<ProductInput>) {
        const { data, error } = await supabase
            .from('products')
            .update({ ...input, updated_at: new Date().toISOString() })
            .eq('id', id)
            .select()
            .single();

        if (error) {
            console.error('Error updating product:', error);
            throw error;
        }

        return data;
    }

    static async deleteProduct(id: string) {
        const { error } = await supabase
            .from('products')
            .delete()
            .eq('id', id);

        if (error) {
            console.error('Error deleting product:', error);
            throw error;
        }

        return true;
    }
}
