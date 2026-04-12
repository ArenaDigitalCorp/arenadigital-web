import { supabase } from "@/shared/database/supabaseClient";

/** Row from RPC `get_arena_finance_summary` — aggregates only, no row-by-row transfer. */
export interface ArenaFinanceSummary {
    lifetime_entradas: number;
    lifetime_saidas: number;
    current_month_entradas: number;
    current_month_saidas: number;
    prev_month_entradas: number;
    prev_month_saidas: number;
}

/** One day bucket from RPC `get_arena_finance_daily_totals` for charting. */
export interface ArenaFinanceDailyRow {
    bucket_date: string;
    entradas: number;
    saidas: number;
}

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
    modo_pagamento_id?: string | null;
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

    /**
     * Lifetime + current/previous month totals in one DB round-trip (scalable vs loading all rows).
     */
    static async getArenaFinanceSummary(arenaId: string): Promise<ArenaFinanceSummary> {
        const { data, error } = await supabase.rpc('get_arena_finance_summary', {
            p_arena_id: arenaId,
        });

        if (error) {
            console.error('Error fetching arena finance summary:', error);
            throw error;
        }

        const row = data?.[0];
        const z = () => ({
            lifetime_entradas: 0,
            lifetime_saidas: 0,
            current_month_entradas: 0,
            current_month_saidas: 0,
            prev_month_entradas: 0,
            prev_month_saidas: 0,
        });

        if (!row) return z();

        return {
            lifetime_entradas: Number(row.lifetime_entradas ?? 0),
            lifetime_saidas: Number(row.lifetime_saidas ?? 0),
            current_month_entradas: Number(row.current_month_entradas ?? 0),
            current_month_saidas: Number(row.current_month_saidas ?? 0),
            prev_month_entradas: Number(row.prev_month_entradas ?? 0),
            prev_month_saidas: Number(row.prev_month_saidas ?? 0),
        };
    }

    /**
     * Pre-aggregated per-day sums for a date range (inclusive). Dates as `YYYY-MM-DD`.
     */
    static async getArenaFinanceDailyTotals(
        arenaId: string,
        startDate: string,
        endDate: string
    ): Promise<ArenaFinanceDailyRow[]> {
        const { data, error } = await supabase.rpc('get_arena_finance_daily_totals', {
            p_arena_id: arenaId,
            p_start_date: startDate,
            p_end_date: endDate,
        });

        if (error) {
            console.error('Error fetching arena finance daily totals:', error);
            throw error;
        }

        return (data ?? []).map((r: { bucket_date: string; entradas: unknown; saidas: unknown }) => ({
            bucket_date: typeof r.bucket_date === 'string' ? r.bucket_date : String(r.bucket_date),
            entradas: Number(r.entradas ?? 0),
            saidas: Number(r.saidas ?? 0),
        }));
    }

    /** Latest N transactions of a type (for dashboard preview lists). */
    static async getRecentTransactions(arenaId: string, type: 'entrada' | 'saída', limit = 4) {
        const { data, error } = await supabase
            .from('transactions')
            .select(
                '*, registered_by:users(name), atleta:atleta_id(id, nome_perfil), modo_pagamento:modo_pagamento_id(id, nome)'
            )
            .eq('arena_id', arenaId)
            .eq('type', type)
            .order('launch_date', { ascending: false })
            .limit(limit);

        if (error) {
            console.error('Error fetching recent transactions:', error);
            throw error;
        }

        return data ?? [];
    }

    static async getTransactions(arenaId: string, type?: 'entrada' | 'saída', startDate?: string, endDate?: string) {
        let query = supabase
            .from('transactions')
            .select('*, registered_by:users(name), atleta:atleta_id(id, nome_perfil), modo_pagamento:modo_pagamento_id(id, nome)')
            .eq('arena_id', arenaId)
            .order('launch_date', { ascending: false });

        if (type) {
            query = query.eq('type', type);
        }

        if (startDate) {
            query = query.gte('launch_date', startDate);
        }

        if (endDate) {
            query = query.lte('launch_date', endDate);
        }

        const { data, error } = await query;

        if (error) {
            console.error('Error fetching transactions:', error);
            throw error;
        }

        return data;
    }

    static async getTotals(arenaId: string) {
        const s = await this.getArenaFinanceSummary(arenaId);
        return {
            entradas: s.lifetime_entradas,
            saidas: s.lifetime_saidas,
            saldo: s.lifetime_entradas - s.lifetime_saidas,
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
