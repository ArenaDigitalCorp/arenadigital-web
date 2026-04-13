"use server"

import { auth } from "@clerk/nextjs/server"
import { getSupabaseAdmin } from "@/lib/supabase-server"
import { SupabaseLoyaltyRepository } from "@/modules/loyalty/repositories/SupabaseLoyaltyRepository"
import { revalidatePath } from "next/cache"

async function getDbUserId(clerkId: string) {
    const { data } = await getSupabaseAdmin().from('users').select('id').eq('clerk_user_id', clerkId).single()
    return data?.id ?? null
}

export async function updateCurrencyName(arenaId: string, name: string) {
    try {
        const { userId: clerkId } = await auth()
        if (!clerkId) return { success: false, error: "Não autorizado" }

        const dbUserId = await getDbUserId(clerkId)
        if (!dbUserId) return { success: false, error: "Usuário não encontrado" }

        const { error } = await getSupabaseAdmin()
            .from('arenas').update({ nome_moeda_virtual: name }).eq('id', arenaId)
        if (error) throw error

        revalidatePath("/dashboard/loyalty")
        return { success: true }
    } catch (error: any) {
        console.error("Error updating currency name:", error)
        return { success: false, error: error.message || "Erro ao atualizar nome da moeda" }
    }
}

export async function getLatestCreditsAction(arenaId: string) {
    try {
        const { userId: clerkId } = await auth()
        if (!clerkId) return { success: false, error: "Não autorizado" }

        const dbUserId = await getDbUserId(clerkId)
        if (!dbUserId) return { success: false, error: "Usuário não encontrado" }

        const repo = new SupabaseLoyaltyRepository(getSupabaseAdmin())
        const credits = await repo.findRecent(arenaId, 'crédito')
        return { success: true, data: credits }
    } catch (error: any) {
        console.error("Error in getLatestCreditsAction:", error)
        return { success: false, error: error.message || "Erro ao buscar envios" }
    }
}

export async function getLatestRedemptionsAction(arenaId: string) {
    try {
        const { userId: clerkId } = await auth()
        if (!clerkId) return { success: false, error: "Não autorizado" }

        const dbUserId = await getDbUserId(clerkId)
        if (!dbUserId) return { success: false, error: "Usuário não encontrado" }

        const repo = new SupabaseLoyaltyRepository(getSupabaseAdmin())
        const redemptions = await repo.findRecentRedemptions(arenaId)
        return { success: true, data: redemptions }
    } catch (error: any) {
        console.error("Error in getLatestRedemptionsAction:", error)
        return { success: false, error: error.message || "Erro ao buscar resgates" }
    }
}

export async function searchAthletesAction(arenaId: string, query?: string) {
    try {
        const { userId: clerkId } = await auth()
        if (!clerkId) return { success: false, error: "Não autorizado" }

        const dbUserId = await getDbUserId(clerkId)
        if (!dbUserId) return { success: false, error: "Usuário não encontrado" }

        const repo = new SupabaseLoyaltyRepository(getSupabaseAdmin())
        const athletes = await repo.searchAthletes(arenaId, query)
        return { success: true, data: athletes }
    } catch (error: any) {
        console.error("Error in searchAthletesAction:", error)
        return { success: false, error: error.message || "Erro ao buscar atletas" }
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
        const { userId: clerkId } = await auth()
        if (!clerkId) return { success: false, error: "Não autorizado" }

        const dbUserId = await getDbUserId(clerkId)
        if (!dbUserId) return { success: false, error: "Usuário não encontrado" }

        let data_vencimento: string | null = null;
        const now = new Date();

        if (data.validade === "3_meses") {
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
    } catch (error: any) {
        console.error("Error in createCreditTransactionAction:", error)
        return { success: false, error: error.message || "Erro ao criar transação" }
    }
}

export async function createRedemptionTransactionAction(data: {
    arenaId: string;
    id_atleta: string;
    valor: number;
    descricao?: string;
}) {
    try {
        const { userId: clerkId } = await auth()
        if (!clerkId) return { success: false, error: "Não autorizado" }

        const dbUserId = await getDbUserId(clerkId)
        if (!dbUserId) return { success: false, error: "Usuário não encontrado" }

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
    } catch (error: any) {
        console.error("Error in createRedemptionTransactionAction:", error)
        return { success: false, error: error.message || "Erro ao criar resgate" }
    }
}

export async function getTopAthletesAction(arenaId: string) {
    try {
        const { userId: clerkId } = await auth()
        if (!clerkId) return { success: false, error: "Não autorizado" }

        const dbUserId = await getDbUserId(clerkId)
        if (!dbUserId) return { success: false, error: "Usuário não encontrado" }

        const repo = new SupabaseLoyaltyRepository(getSupabaseAdmin())
        const topAthletes = await repo.getTopAthletes(arenaId)
        return { success: true, data: topAthletes }
    } catch (error: any) {
        console.error("Error in getTopAthletesAction:", error)
        return { success: false, error: error.message || "Erro ao buscar top atletas" }
    }
}

export async function getLoyaltyDashboardDataAction(arenaId: string) {
    try {
        const { userId: clerkId } = await auth()
        if (!clerkId) return { success: false, error: "Não autorizado" }

        const dbUserId = await getDbUserId(clerkId)
        if (!dbUserId) return { success: false, error: "Usuário não encontrado" }

        const repo = new SupabaseLoyaltyRepository(getSupabaseAdmin())
        const [credits, redemptions, topAthletes] = await Promise.all([
            repo.findRecent(arenaId, 'crédito'),
            repo.findRecentRedemptions(arenaId),
            repo.getTopAthletes(arenaId),
        ])

        return { success: true, data: { credits, redemptions, topAthletes } }
    } catch (error: any) {
        console.error("Error in getLoyaltyDashboardDataAction:", error)
        return { success: false, error: error.message || "Erro ao carregar programa de fidelidade" }
    }
}

export async function getAthletesWithBalanceAction(arenaId: string, page = 1, pageSize = 10, query?: string) {
    try {
        const { userId: clerkId } = await auth()
        if (!clerkId) return { success: false, error: "Não autorizado" }

        const dbUserId = await getDbUserId(clerkId)
        if (!dbUserId) return { success: false, error: "Usuário não encontrado" }

        const repo = new SupabaseLoyaltyRepository(getSupabaseAdmin())
        const result = await repo.getAthletesWithBalance(arenaId, page, pageSize, query)
        return { success: true, ...result }
    } catch (error: any) {
        console.error("Error in getAthletesWithBalanceAction:", error)
        return { success: false, error: error.message || "Erro ao buscar atletas" }
    }
}

export async function getStatementAction(arenaId: string, page = 1, pageSize = 10, filters?: { athleteName?: string, startDate?: string, endDate?: string }) {
    try {
        const { userId: clerkId } = await auth()
        if (!clerkId) return { success: false, error: "Não autorizado" }

        const dbUserId = await getDbUserId(clerkId)
        if (!dbUserId) return { success: false, error: "Usuário não encontrado" }

        const repo = new SupabaseLoyaltyRepository(getSupabaseAdmin())
        const result = await repo.getStatement(arenaId, page, pageSize, filters)
        return { success: true, ...result }
    } catch (error: any) {
        console.error("Error in getStatementAction:", error)
        return { success: false, error: error.message || "Erro ao buscar extrato" }
    }
}
