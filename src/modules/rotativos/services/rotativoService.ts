import { supabase } from "@/shared/database/supabaseClient";

export interface Rotativo {
    id: string;
    id_arena: string;
    id_esporte: string;
    data: string;
    hora_inicio: string;
    hora_fim: string;
    valor: number;
    limitado: boolean;
    limite_participantes: number | null;
    created_at: string;
    updated_at: string;
    esporte?: { name: string };
    inscricoes_count?: number;
}

export interface RotativoInscricao {
    id: string;
    id_rotativo: string;
    id_atleta: string;
    data_inscricao: string;
    valor_pago: number;
    status_pagamento: string;
    atleta?: { nome_perfil: string };
}

export class RotativoService {
    static async createRotativo(input: any) {
        const { data, error } = await supabase
            .from('rotativos')
            .insert(input)
            .select()
            .single();

        if (error) {
            console.error('Error creating rotativo:', error);
            throw error;
        }
        return data;
    }

    static async getRotativosByDate(arenaId: string, date: string) {
        const { data, error } = await supabase
            .from('rotativos')
            .select(`
                *,
                esporte:id_esporte (
                    name
                )
            `)
            .eq('id_arena', arenaId)
            .eq('data', date);

        if (error) {
            console.error('Error fetching rotativos:', error);
            throw error;
        }

        // Fetch counts separately to avoid complex join issues if not configured
        const results = await Promise.all((data || []).map(async (rotativo) => {
            const { count } = await supabase
                .from('rotativo_inscricoes')
                .select('*', { count: 'exact', head: true })
                .eq('id_rotativo', rotativo.id);

            return {
                ...rotativo,
                inscricoes_count: count || 0
            };
        }));

        return results;
    }

    static async getRotativosByMonth(arenaId: string, startDate: string, endDate: string) {
        const { data, error } = await supabase
            .from('rotativos')
            .select('id, data')
            .eq('id_arena', arenaId)
            .gte('data', startDate)
            .lte('data', endDate);

        if (error) {
            console.error('Error fetching rotativos by month:', error);
            throw error;
        }

        const results = await Promise.all((data || []).map(async (r) => {
            const { count } = await supabase
                .from('rotativo_inscricoes')
                .select('*', { count: 'exact', head: true })
                .eq('id_rotativo', r.id);
            return { data: r.data, inscricoes_count: count || 0 };
        }));

        const byDate: Record<string, { hasRotativo: boolean; hasInscriptions: boolean }> = {};
        for (const r of results) {
            if (!byDate[r.data]) {
                byDate[r.data] = { hasRotativo: true, hasInscriptions: false };
            }
            if (r.inscricoes_count > 0) {
                byDate[r.data].hasInscriptions = true;
            }
        }
        return byDate;
    }

    static async getRotativoInscritos(rotativoId: string) {
        const { data, error } = await supabase
            .from('rotativo_inscricoes')
            .select(`
                *,
                atleta:id_atleta (
                    nome_perfil
                )
            `)
            .eq('id_rotativo', rotativoId)
            .order('data_inscricao', { ascending: true });

        if (error) {
            console.error('Error fetching rotativo participants:', error);
            throw error;
        }
        return data;
    }

    static async registerAthlete(rotativoId: string, athleteId: string, valuePaid: number) {
        const { data: rotativo, error: rotativoError } = await supabase
            .from('rotativos')
            .select('limitado, limite_participantes')
            .eq('id', rotativoId)
            .single();

        if (rotativoError) throw rotativoError;

        if (rotativo.limitado) {
            const { count, error: countError } = await supabase
                .from('rotativo_inscricoes')
                .select('*', { count: 'exact', head: true })
                .eq('id_rotativo', rotativoId);

            if (countError) throw countError;

            if (count !== null && count >= (rotativo.limite_participantes || 0)) {
                throw new Error("Limite de participantes atingido.");
            }
        }

        const { data, error } = await supabase
            .from('rotativo_inscricoes')
            .insert({
                id_rotativo: rotativoId,
                id_atleta: athleteId,
                valor_pago: valuePaid,
                status_pagamento: 'pago'
            })
            .select()
            .single();

        if (error) {
            if (error.code === '23505') {
                throw new Error("Atleta já inscrito nesta sessão.");
            }
            console.error('Error registering athlete for rotativo:', error);
            throw error;
        }
        return data;
    }
}
