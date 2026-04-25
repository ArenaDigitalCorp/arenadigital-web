"use server"

import { getSupabaseAdmin } from '@/lib/supabase-server'
import { assertArenaBackofficeAccess, requireAuthenticatedDbUser } from '@/lib/server-auth'
import { SupabaseFinanceRepository } from '@/modules/finance/repositories/SupabaseFinanceRepository'
import { revalidatePath } from 'next/cache'
import type { CreateTransactionDTO, UpdateTransactionDTO } from '@/modules/finance/types/finance.types'

export async function getFinanceDashboardAction(arenaId: string) {
    try {
        await assertArenaBackofficeAccess(arenaId)
        const repo = new SupabaseFinanceRepository(getSupabaseAdmin())
        const now = new Date()
        const end = new Date(now.getFullYear(), now.getMonth(), now.getDate())
        const start = new Date(end)
        start.setDate(start.getDate() - 29)

        const [summary, recentIn, recentOut, series] = await Promise.all([
            repo.getSummary(arenaId),
            repo.findRecent(arenaId, 'entrada', 4),
            repo.findRecent(arenaId, 'saída', 4),
            repo.getDailyTotals(arenaId, start.toISOString().split('T')[0], end.toISOString().split('T')[0]),
        ])

        return { success: true, data: { summary, recentIn, recentOut, series } }
    } catch (err) {
        const message = err instanceof Error ? err.message : 'Erro ao carregar financeiro'
        return { success: false, error: message, data: null }
    }
}

export async function getModoPagamentoAction() {
    try {
        const { data, error } = await getSupabaseAdmin()
            .from('modo_pagamento')
            .select('id, nome')
            .order('nome')

        if (error) throw new Error(error.message)
        return { success: true, data: data ?? [] }
    } catch (err) {
        const message = err instanceof Error ? err.message : 'Erro ao carregar modos de pagamento'
        return { success: false, error: message, data: [] }
    }
}

export async function getTransactionsAction(arenaId: string, type?: 'entrada' | 'saída', startDate?: string, endDate?: string) {
    try {
        await assertArenaBackofficeAccess(arenaId)
        const repo = new SupabaseFinanceRepository(getSupabaseAdmin())
        const data = await repo.findByArena(arenaId, type, startDate, endDate)
        return { success: true, data }
    } catch (err) {
        const message = err instanceof Error ? err.message : 'Erro ao buscar lançamentos'
        return { success: false, error: message, data: [] }
    }
}

export async function createTransactionAction(arenaId: string, input: Omit<CreateTransactionDTO, 'arena_id' | 'registered_by'>) {
    try {
        await assertArenaBackofficeAccess(arenaId)
        const { dbUserId } = await requireAuthenticatedDbUser()
        const repo = new SupabaseFinanceRepository(getSupabaseAdmin())
        const data = await repo.create({ ...input, arena_id: arenaId, registered_by: dbUserId })
        revalidatePath(`/dashboard/finance/${arenaId}`)
        return { success: true, data }
    } catch (err) {
        const message = err instanceof Error ? err.message : 'Erro ao criar lançamento'
        return { success: false, error: message }
    }
}

export async function updateTransactionAction(arenaId: string, transactionId: string, input: UpdateTransactionDTO) {
    try {
        await assertArenaBackofficeAccess(arenaId)
        const repo = new SupabaseFinanceRepository(getSupabaseAdmin())
        const data = await repo.update(transactionId, input)
        revalidatePath(`/dashboard/finance/${arenaId}`)
        return { success: true, data }
    } catch (err) {
        const message = err instanceof Error ? err.message : 'Erro ao atualizar lançamento'
        return { success: false, error: message }
    }
}

export async function deleteTransactionAction(arenaId: string, transactionId: string) {
    try {
        await assertArenaBackofficeAccess(arenaId)
        const repo = new SupabaseFinanceRepository(getSupabaseAdmin())
        await repo.delete(transactionId)
        revalidatePath(`/dashboard/finance/${arenaId}`)
        return { success: true }
    } catch (err) {
        const message = err instanceof Error ? err.message : 'Erro ao excluir lançamento'
        return { success: false, error: message }
    }
}

export async function getMensalistasComPendenciaAction(arenaId: string) {
    try {
        await assertArenaBackofficeAccess(arenaId)
        const supabase = getSupabaseAdmin()

        const { data: planos, error } = await supabase
            .from('planos_mensalista')
            .select('id, athlete_id, athlete_name, valor_mensal, sessoes_por_mes, dia_semana, horario_inicio, horario_fim, data_inicio, atleta:athlete_id(id, nome_perfil, telefone), court:court_id(id, name), sports:sport_id(id, name)')
            .eq('arena_id', arenaId)
            .eq('status', 'ativo')
            .order('created_at', { ascending: false })

        if (error) throw new Error(error.message)

        const now = new Date().toISOString()
        const withPending = await Promise.all(
            (planos || []).map(async (plano: any) => {
                const { data: reservado } = await supabase
                    .from('bookings')
                    .select('start_time')
                    .eq('plano_mensalista_id', plano.id)
                    .eq('status', 'reservado')
                    .gte('start_time', now)
                    .order('start_time', { ascending: true })
                    .limit(1)

                return { ...plano, proximo_mes_reservado: reservado?.[0]?.start_time || null }
            })
        )

        const pendentes = withPending.filter(p => p.proximo_mes_reservado !== null)
        return { success: true, data: pendentes }
    } catch (err) {
        const message = err instanceof Error ? err.message : 'Erro ao buscar pendências'
        return { success: false, error: message, data: [] }
    }
}
