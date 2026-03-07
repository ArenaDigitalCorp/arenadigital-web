import { supabase } from "@/shared/database/supabaseClient";

export interface TransactionInput {
    arena_id: string;
    type: 'entrada' | 'saída';
    category: string;
    description: string;
    quantity: number;
    unit_value: number;
    discount: number;
    total_value: number;
    registration_date: string;
    launch_date: string;
    registered_by: string;
    atleta_id?: string | null;
}

export class FinanceService {
    static async createTransaction(input: TransactionInput) {
        const { data, error } = await supabase
            .from('transactions')
            .insert([input])
            .select()
            .single();

        if (error) {
            console.error('Error creating transaction:', error);
            throw error;
        }

        return data;
    }

    static async getTransactions(arenaId: string, type?: 'entrada' | 'saída') {
        let query = supabase
            .from('transactions')
            .select('*, registered_by:users(name), atleta:atleta_id(id, nome_perfil)')
            .eq('arena_id', arenaId)
            .order('launch_date', { ascending: false });

        if (type) {
            query = query.eq('type', type);
        }

        const { data, error } = await query;

        if (error) {
            console.error('Error fetching transactions:', error);
            throw error;
        }

        return data;
    }

    static async getTotals(arenaId: string) {
        const { data, error } = await supabase
            .from('transactions')
            .select('type, total_value')
            .eq('arena_id', arenaId);

        if (error) {
            console.error('Error fetching totals:', error);
            throw error;
        }

        const totals = data.reduce((acc, curr) => {
            if (curr.type === 'entrada') {
                acc.entradas += Number(curr.total_value);
            } else {
                acc.saidas += Number(curr.total_value);
            }
            return acc;
        }, { entradas: 0, saidas: 0 });

        return {
            ...totals,
            saldo: totals.entradas - totals.saidas
        };
    }

    static async updateTransaction(
        id: string,
        input: Omit<TransactionInput, 'arena_id' | 'registered_by'>
    ) {
        const { data, error } = await supabase
            .from('transactions')
            .update(input)
            .eq('id', id)
            .select()
            .single();

        if (error) {
            console.error('Error updating transaction:', error);
            throw error;
        }

        return data;
    }

    static async deleteTransaction(id: string) {
        const { error } = await supabase
            .from('transactions')
            .delete()
            .eq('id', id);

        if (error) {
            console.error('Error deleting transaction:', error);
            throw error;
        }

        return true;
    }
}
