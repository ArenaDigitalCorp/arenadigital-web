import { supabase } from "@/shared/database/supabaseClient";

export interface StockEntry {
    id: string;
    product_id: string;
    arena_id: string;
    quantity: number;
    entry_date: string;
    supplier: string;
    description?: string;
    invoice_number?: string;
    registered_by: string;
    created_at: string;
    user?: {
        name: string;
    };
}

export interface StockEntryInput {
    product_id: string;
    arena_id: string;
    quantity: number;
    entry_date: string;
    supplier: string;
    description?: string;
    invoice_number?: string;
    registered_by: string;
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
    user?: {
        name: string;
    };
}

export class StockService {
    static async createStockEntry(input: StockEntryInput): Promise<StockEntry> {
        const { data: entry, error: entryError } = await supabase
            .from('product_stock_entries')
            .insert([{
                product_id: input.product_id,
                arena_id: input.arena_id,
                quantity: input.quantity,
                entry_date: input.entry_date,
                supplier: input.supplier,
                description: input.description || null,
                invoice_number: input.invoice_number || null,
                registered_by: input.registered_by,
            }])
            .select()
            .single();

        if (entryError) {
            console.error('Error creating stock entry:', entryError);
            throw entryError;
        }

        const { data: product, error: productError } = await supabase
            .from('products')
            .select('stock_quantity')
            .eq('id', input.product_id)
            .single();

        if (productError) {
            console.error('Error fetching product stock:', productError);
            throw productError;
        }

        const newBalance = (product.stock_quantity || 0) + input.quantity;

        const { error: movementError } = await supabase
            .from('product_stock_movements')
            .insert([{
                product_id: input.product_id,
                arena_id: input.arena_id,
                type: 'entrada',
                quantity: input.quantity,
                reference_type: 'stock_entry',
                reference_id: entry.id,
                balance_after: newBalance,
                registered_by: input.registered_by,
            }]);

        if (movementError) {
            console.error('Error recording stock movement:', movementError);
            throw movementError;
        }

        const { error: updateError } = await supabase
            .from('products')
            .update({ stock_quantity: newBalance })
            .eq('id', input.product_id);

        if (updateError) {
            console.error('Error updating product stock:', updateError);
            throw updateError;
        }

        return entry as StockEntry;
    }

    static async getStockEntriesByProduct(productId: string): Promise<StockEntry[]> {
        const { data, error } = await supabase
            .from('product_stock_entries')
            .select(`
                *,
                user:users!product_stock_entries_registered_by_fkey(name)
            `)
            .eq('product_id', productId)
            .order('created_at', { ascending: false });

        if (error) {
            console.error('Error fetching stock entries:', error);
            throw error;
        }

        return data as StockEntry[];
    }

    static async getStockMovementsByProduct(productId: string): Promise<StockMovement[]> {
        const { data, error } = await supabase
            .from('product_stock_movements')
            .select(`
                *,
                user:users!product_stock_movements_registered_by_fkey(name)
            `)
            .eq('product_id', productId)
            .order('created_at', { ascending: false });

        if (error) {
            console.error('Error fetching stock movements:', error);
            throw error;
        }

        return data as StockMovement[];
    }

    static async registerStockOutflow(
        productId: string,
        quantity: number,
        arenaId: string,
        userId: string,
        referenceId?: string,
        referenceType: string = 'order_item'
    ): Promise<void> {
        const { data: product, error: productError } = await supabase
            .from('products')
            .select('stock_quantity')
            .eq('id', productId)
            .single();

        if (productError) {
            console.error('Error fetching product stock:', productError);
            throw productError;
        }

        const currentStock = product.stock_quantity || 0;

        if (currentStock < quantity) {
            throw new Error(`Estoque insuficiente. Disponível: ${currentStock}, Solicitado: ${quantity}`);
        }

        const newBalance = currentStock - quantity;

        const { error: movementError } = await supabase
            .from('product_stock_movements')
            .insert([{
                product_id: productId,
                arena_id: arenaId,
                type: 'saida',
                quantity: quantity,
                reference_type: referenceType,
                reference_id: referenceId || null,
                balance_after: newBalance,
                registered_by: userId,
            }]);

        if (movementError) {
            console.error('Error recording stock outflow:', movementError);
            throw movementError;
        }

        const { error: updateError } = await supabase
            .from('products')
            .update({ stock_quantity: newBalance })
            .eq('id', productId);

        if (updateError) {
            console.error('Error updating product stock:', updateError);
            throw updateError;
        }
    }

    static async restoreStockForOrder(
        orderId: string,
        arenaId: string,
        userId: string
    ): Promise<void> {
        const { data: items, error: itemsError } = await supabase
            .from('station_order_items')
            .select('id, product_id, quantity')
            .eq('order_id', orderId);

        if (itemsError) {
            console.error('Error fetching order items for stock restore:', itemsError);
            throw itemsError;
        }

        if (!items || items.length === 0) return;

        for (const item of items) {
            const { data: product, error: productError } = await supabase
                .from('products')
                .select('stock_quantity')
                .eq('id', item.product_id)
                .single();

            if (productError) {
                console.error(`Error fetching product ${item.product_id}:`, productError);
                continue;
            }

            const newBalance = (product.stock_quantity || 0) + item.quantity;

            await supabase
                .from('product_stock_movements')
                .insert([{
                    product_id: item.product_id,
                    arena_id: arenaId,
                    type: 'entrada',
                    quantity: item.quantity,
                    reference_type: 'cancellation',
                    reference_id: item.id,
                    balance_after: newBalance,
                    registered_by: userId,
                }]);

            await supabase
                .from('products')
                .update({ stock_quantity: newBalance })
                .eq('id', item.product_id);
        }
    }

    static async checkStockAvailability(productId: string, requestedQty: number): Promise<boolean> {
        const { data, error } = await supabase
            .from('products')
            .select('stock_quantity')
            .eq('id', productId)
            .single();

        if (error) {
            console.error('Error checking stock availability:', error);
            return false;
        }

        return (data.stock_quantity || 0) >= requestedQty;
    }
}
