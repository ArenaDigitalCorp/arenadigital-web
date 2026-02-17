import { supabase } from "@/shared/database/supabaseClient";

export interface FidelityTransaction {
    id: string;
    id_arena?: string;
    id_atleta?: string;
    valor: number;
    tipo: 'crédito' | 'resgate' | 'vencimento';
    descricao: string;
    data_registro: string;
    atleta?: {
        nome_perfil: string;
    } | any;
    criador?: {
        name: string;
    } | any;
}

export class LoyaltyService {
    static async getLatestCredits(arenaId: string, limit = 5) {
        try {
            const { data, error } = await supabase
                .from('programa_fidelidade_extrato')
                .select(`
                    id,
                    valor,
                    tipo,
                    descricao,
                    data_registro,
                    atleta:id_atleta (
                        nome_perfil
                    )
                `)
                .eq('id_arena', arenaId)
                .eq('tipo', 'crédito')
                .order('data_registro', { ascending: false })
                .limit(limit);

            if (error) {
                console.error('Error fetching latest credits:', error);
                throw error;
            }

            return data as FidelityTransaction[];
        } catch (error) {
            console.error('LoyaltyService.getLatestCredits error:', error);
            throw error;
        }
    }

    static async getLatestRedemptions(arenaId: string, limit = 5) {
        try {
            const { data, error } = await supabase
                .from('programa_fidelidade_extrato')
                .select(`
                    id,
                    valor,
                    tipo,
                    descricao,
                    data_registro,
                    atleta:id_atleta (
                        nome_perfil
                    )
                `)
                .eq('id_arena', arenaId)
                .in('tipo', ['resgate', 'vencimento'])
                .order('data_registro', { ascending: false })
                .limit(limit);

            if (error) {
                console.error('Error fetching latest redemptions:', error);
                throw error;
            }

            return data as FidelityTransaction[];
        } catch (error) {
            console.error('LoyaltyService.getLatestRedemptions error:', error);
            throw error;
        }
    }

    static async createTransaction(data: {
        id_arena: string;
        id_atleta: string;
        valor: number;
        tipo: 'crédito' | 'resgate';
        descricao?: string;
        data_vencimento?: string | null;
        created_by: string;
    }) {
        try {
            const { error } = await supabase
                .from('programa_fidelidade_extrato')
                .insert([{
                    ...data,
                    data_registro: new Date().toISOString()
                }]);

            if (error) {
                console.error('Error creating transaction:', error);
                throw error;
            }

            return { success: true };
        } catch (error) {
            console.error('LoyaltyService.createTransaction error:', error);
            throw error;
        }
    }

    static async searchArenaAthletes(arenaId: string, query?: string) {
        try {
            let supabaseQuery = supabase
                .from('arenas_atleta')
                .select(`
                    id_atleta,
                    atleta:id_atleta!inner (
                        id,
                        nome_perfil,
                        telefone
                    )
                `)
                .eq('id_arena', arenaId);

            if (query) {
                supabaseQuery = supabaseQuery.ilike('atleta.nome_perfil', `%${query}%`);
            }

            const { data, error } = await supabaseQuery.limit(query ? 10 : 100);

            if (error) {
                console.error('Error searching arena athletes:', error);
                throw error;
            }

            // Filter out any potential nulls from the join and map to athlete objects
            return (data || [])
                .map(item => item.atleta)
                .filter(a => a !== null) as any[];
        } catch (error) {
            console.error('LoyaltyService.searchArenaAthletes error:', error);
            throw error;
        }
    }

    static async getTopAthletes(arenaId: string, limit = 5) {
        try {
            const { data, error } = await supabase
                .from('athlete_loyalty_balance')
                .select(`
                    balance,
                    atleta:id_atleta (
                        nome_perfil
                    )
                `)
                .eq('id_arena', arenaId)
                .order('balance', { ascending: false })
                .limit(limit);

            if (error) {
                console.error('Error fetching top athletes:', error);
                throw error;
            }

            return (data || []).map(item => ({
                name: (item.atleta as any)?.nome_perfil || "Desconhecido",
                balance: Number(item.balance)
            }));
        } catch (error) {
            console.error('LoyaltyService.getTopAthletes error:', error);
            throw error;
        }
    }

    static async getAthletesWithBalance(arenaId: string, page = 1, pageSize = 10, query?: string) {
        try {
            const offset = (page - 1) * pageSize;

            let supabaseQuery = supabase
                .from('athlete_loyalty_balance')
                .select(`
                    id_atleta,
                    balance,
                    atleta:id_atleta!inner (
                        id,
                        nome_perfil,
                        telefone
                    )
                `, { count: 'exact' })
                .eq('id_arena', arenaId);

            if (query) {
                supabaseQuery = supabaseQuery.ilike('atleta.nome_perfil', `%${query}%`);
            }

            const { data, error, count } = await supabaseQuery
                .order('balance', { ascending: false })
                .range(offset, offset + pageSize - 1);

            if (error) {
                console.error('Error fetching athletes with balance:', error);
                throw error;
            }

            const result = (data || []).map(item => ({
                id_atleta: (item as any).id_atleta,
                name: (item.atleta as any)?.nome_perfil || "Desconhecido",
                phone: (item.atleta as any)?.telefone || "",
                balance: Number(item.balance)
            }));

            return {
                data: result,
                total: count || 0,
                totalPages: Math.ceil((count || 0) / pageSize)
            };
        } catch (error) {
            console.error('LoyaltyService.getAthletesWithBalance error:', error);
            throw error;
        }
    }

    static async getStatement(arenaId: string, page = 1, pageSize = 10, filters?: { athleteName?: string, startDate?: string, endDate?: string }) {
        try {
            const offset = (page - 1) * pageSize;

            let supabaseQuery = supabase
                .from('programa_fidelidade_extrato')
                .select(`
                    *,
                    atleta:id_atleta!inner (
                        nome_perfil
                    ),
                    criador:created_by (
                        name
                    )
                `, { count: 'exact' })
                .eq('id_arena', arenaId);

            if (filters?.athleteName) {
                supabaseQuery = supabaseQuery.ilike('atleta.nome_perfil', `%${filters.athleteName}%`);
            }

            if (filters?.startDate) {
                supabaseQuery = supabaseQuery.gte('data_registro', filters.startDate);
            }

            if (filters?.endDate) {
                supabaseQuery = supabaseQuery.lte('data_registro', filters.endDate);
            }

            const { data, error, count } = await supabaseQuery
                .order('data_registro', { ascending: false })
                .range(offset, offset + pageSize - 1);

            if (error) {
                console.error('Error fetching loyalty statement:', error);
                throw error;
            }

            return {
                data: data as FidelityTransaction[],
                total: count || 0,
                totalPages: Math.ceil((count || 0) / pageSize)
            };
        } catch (error) {
            console.error('LoyaltyService.getStatement error:', error);
            throw error;
        }
    }
}
