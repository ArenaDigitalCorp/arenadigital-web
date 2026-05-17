"use server"

import { getSupabaseAdmin } from "@/lib/supabase-server"
import { assertArenaBackofficeAccess, requireAuthenticatedDbUser } from "@/lib/server-auth"
import { SupabaseLoyaltyRepository } from "@/modules/loyalty/repositories/SupabaseLoyaltyRepository"
import { revalidatePath } from "next/cache"

export async function updateCurrencyName(arenaId: string, name: string) {
    try {
        await requireAuthenticatedDbUser()
        await assertArenaBackofficeAccess(arenaId)

        const { error } = await getSupabaseAdmin()
            .from('arenas').update({ nome_moeda_virtual: name }).eq('id', arenaId)
        if (error) throw error

        revalidatePath("/dashboard/loyalty")
        return { success: true }
    } catch (error: unknown) {
        console.error("Error updating currency name:", error)
        const message = error instanceof Error ? error.message : "Erro ao atualizar nome da moeda"
        return { success: false, error: message }
    }
}

export async function getLatestCreditsAction(arenaId: string) {
    try {
        await requireAuthenticatedDbUser()
        await assertArenaBackofficeAccess(arenaId)

        const repo = new SupabaseLoyaltyRepository(getSupabaseAdmin())
        const credits = await repo.findRecent(arenaId, 'crédito')
        return { success: true, data: credits }
    } catch (error: unknown) {
        console.error("Error in getLatestCreditsAction:", error)
        const message = error instanceof Error ? error.message : "Erro ao buscar envios"
        return { success: false, error: message }
    }
}

export async function getLatestRedemptionsAction(arenaId: string) {
    try {
        await requireAuthenticatedDbUser()
        await assertArenaBackofficeAccess(arenaId)

        const repo = new SupabaseLoyaltyRepository(getSupabaseAdmin())
        const redemptions = await repo.findRecentRedemptions(arenaId)
        return { success: true, data: redemptions }
    } catch (error: unknown) {
        console.error("Error in getLatestRedemptionsAction:", error)
        const message = error instanceof Error ? error.message : "Erro ao buscar resgates"
        return { success: false, error: message }
    }
}

export async function searchAthletesAction(arenaId: string, query?: string) {
    try {
        await requireAuthenticatedDbUser()
        await assertArenaBackofficeAccess(arenaId)

        const repo = new SupabaseLoyaltyRepository(getSupabaseAdmin())
        const athletes = await repo.searchAthletes(arenaId, query)
        return { success: true, data: athletes }
    } catch (error: unknown) {
        console.error("Error in searchAthletesAction:", error)
        const message = error instanceof Error ? error.message : "Erro ao buscar atletas"
        return { success: false, error: message }
    }
}

export async function createCreditTransactionAction(data: {
    arenaId: string;
    id_atleta: string;
    valor: number;
    validade: string;
    descricao?: string;
}) {
    try {
        const { dbUserId } = await requireAuthenticatedDbUser()
        await assertArenaBackofficeAccess(data.arenaId)

        let data_vencimento: string | null = null;
        const now = new Date();

        if (data.validade === "1_mes") {
            const d = new Date(now); d.setDate(d.getDate() + 30); data_vencimento = d.toISOString();
        } else if (data.validade === "2_meses") {
            const d = new Date(now); d.setDate(d.getDate() + 60); data_vencimento = d.toISOString();
        } else if (data.validade === "3_meses") {
            const d = new Date(now); d.setMonth(d.getMonth() + 3); data_vencimento = d.toISOString();
        } else if (data.validade === "6_meses") {
            const d = new Date(now); d.setMonth(d.getMonth() + 6); data_vencimento = d.toISOString();
        } else if (data.validade === "1_ano") {
            const d = new Date(now); d.setFullYear(d.getFullYear() + 1); data_vencimento = d.toISOString();
        } else if (data.validade === "2_anos") {
            const d = new Date(now); d.setFullYear(d.getFullYear() + 2); data_vencimento = d.toISOString();
        }

        const repo = new SupabaseLoyaltyRepository(getSupabaseAdmin())
        await repo.create({
            id_arena: data.arenaId,
            id_atleta: data.id_atleta,
            valor: data.valor,
            tipo: 'crédito',
            descricao: data.descricao,
            data_vencimento,
            created_by: dbUserId
        })

        revalidatePath("/dashboard/loyalty")
        return { success: true }
    } catch (error: unknown) {
        console.error("Error in createCreditTransactionAction:", error)
        const message = error instanceof Error ? error.message : "Erro ao criar transação"
        return { success: false, error: message }
    }
}

export async function createRedemptionTransactionAction(data: {
    arenaId: string;
    id_atleta: string;
    valor: number;
    descricao?: string;
}) {
    try {
        const { dbUserId } = await requireAuthenticatedDbUser()
        await assertArenaBackofficeAccess(data.arenaId)

        const repo = new SupabaseLoyaltyRepository(getSupabaseAdmin())
        await repo.create({
            id_arena: data.arenaId,
            id_atleta: data.id_atleta,
            valor: data.valor,
            tipo: 'resgate',
            descricao: data.descricao,
            data_vencimento: null,
            created_by: dbUserId
        })

        revalidatePath("/dashboard/loyalty")
        return { success: true }
    } catch (error: unknown) {
        console.error("Error in createRedemptionTransactionAction:", error)
        const message = error instanceof Error ? error.message : "Erro ao criar resgate"
        return { success: false, error: message }
    }
}

export async function getTopAthletesAction(arenaId: string) {
    try {
        await requireAuthenticatedDbUser()
        await assertArenaBackofficeAccess(arenaId)

        const repo = new SupabaseLoyaltyRepository(getSupabaseAdmin())
        const topAthletes = await repo.getTopAthletes(arenaId)
        return { success: true, data: topAthletes }
    } catch (error: unknown) {
        console.error("Error in getTopAthletesAction:", error)
        const message = error instanceof Error ? error.message : "Erro ao buscar top atletas"
        return { success: false, error: message }
    }
}

export async function getLoyaltyDashboardDataAction(arenaId: string) {
    try {
        await requireAuthenticatedDbUser()
        await assertArenaBackofficeAccess(arenaId)

        const repo = new SupabaseLoyaltyRepository(getSupabaseAdmin())
        const [credits, redemptions, topAthletes] = await Promise.all([
            repo.findRecent(arenaId, 'crédito'),
            repo.findRecentRedemptions(arenaId),
            repo.getTopAthletes(arenaId),
        ])

        return { success: true, data: { credits, redemptions, topAthletes } }
    } catch (error: unknown) {
        console.error("Error in getLoyaltyDashboardDataAction:", error)
        const message = error instanceof Error ? error.message : "Erro ao carregar programa de fidelidade"
        return { success: false, error: message }
    }
}

export async function getAthletesWithBalanceAction(arenaId: string, page = 1, pageSize = 10, query?: string) {
    try {
        await requireAuthenticatedDbUser()
        await assertArenaBackofficeAccess(arenaId)

        const repo = new SupabaseLoyaltyRepository(getSupabaseAdmin())
        const result = await repo.getAthletesWithBalance(arenaId, page, pageSize, query)
        return { success: true, ...result }
    } catch (error: unknown) {
        console.error("Error in getAthletesWithBalanceAction:", error)
        const message = error instanceof Error ? error.message : "Erro ao buscar atletas"
        return { success: false, error: message }
    }
}

export async function getStatementAction(arenaId: string, page = 1, pageSize = 10, filters?: { athleteName?: string, startDate?: string, endDate?: string }) {
    try {
        await requireAuthenticatedDbUser()
        await assertArenaBackofficeAccess(arenaId)

        const repo = new SupabaseLoyaltyRepository(getSupabaseAdmin())
        const result = await repo.getStatement(arenaId, page, pageSize, filters)
        return { success: true, ...result }
    } catch (error: unknown) {
        console.error("Error in getStatementAction:", error)
        const message = error instanceof Error ? error.message : "Erro ao buscar extrato"
        return { success: false, error: message }
    }
}
