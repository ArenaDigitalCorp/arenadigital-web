"use server"

import { auth } from "@clerk/nextjs/server"
import { UserService } from "@/modules/users/services/userService"
import { ArenaService } from "@/modules/arenas/services/arenaService"
import { LoyaltyService } from "@/modules/loyalty/services/loyaltyService"
import { revalidatePath } from "next/cache"

export async function updateCurrencyName(name: string) {
    try {
        const { userId: clerkId } = await auth()
        if (!clerkId) {
            return { success: false, error: "Não autorizado" }
        }

        const dbUser = await UserService.getUserByClerkId(clerkId)
        if (!dbUser) {
            return { success: false, error: "Usuário não encontrado" }
        }

        const arena = await ArenaService.getFirstArenaByOrganizationUser(dbUser.id)
        if (!arena) {
            return { success: false, error: "Arena não encontrada" }
        }

        await ArenaService.updateArena(arena.id, {
            nome_moeda_virtual: name
        })

        revalidatePath("/dashboard/loyalty")
        return { success: true }
    } catch (error: any) {
        console.error("Error updating currency name:", error)
        return { success: false, error: error.message || "Erro ao atualizar nome da moeda" }
    }
}

export async function getLatestCreditsAction() {
    try {
        const { userId: clerkId } = await auth()
        if (!clerkId) return { success: false, error: "Não autorizado" }

        const dbUser = await UserService.getUserByClerkId(clerkId)
        if (!dbUser) return { success: false, error: "Usuário não encontrado" }

        const arena = await ArenaService.getFirstArenaByOrganizationUser(dbUser.id)
        if (!arena) return { success: false, error: "Arena não encontrada" }

        const credits = await LoyaltyService.getLatestCredits(arena.id)
        return { success: true, data: credits }
    } catch (error: any) {
        console.error("Error in getLatestCreditsAction:", error)
        return { success: false, error: error.message || "Erro ao buscar envios" }
    }
}

export async function getLatestRedemptionsAction() {
    try {
        const { userId: clerkId } = await auth()
        if (!clerkId) return { success: false, error: "Não autorizado" }

        const dbUser = await UserService.getUserByClerkId(clerkId)
        if (!dbUser) return { success: false, error: "Usuário não encontrado" }

        const arena = await ArenaService.getFirstArenaByOrganizationUser(dbUser.id)
        if (!arena) return { success: false, error: "Arena não encontrada" }

        const redemptions = await LoyaltyService.getLatestRedemptions(arena.id)
        return { success: true, data: redemptions }
    } catch (error: any) {
        console.error("Error in getLatestRedemptionsAction:", error)
        return { success: false, error: error.message || "Erro ao buscar resgates" }
    }
}

export async function searchAthletesAction(query?: string) {
    try {
        const { userId: clerkId } = await auth()
        if (!clerkId) return { success: false, error: "Não autorizado" }

        const dbUser = await UserService.getUserByClerkId(clerkId)
        if (!dbUser) return { success: false, error: "Usuário não encontrado" }

        const arena = await ArenaService.getFirstArenaByOrganizationUser(dbUser.id)
        if (!arena) return { success: false, error: "Arena não encontrada" }

        const athletes = await LoyaltyService.searchArenaAthletes(arena.id, query)
        return { success: true, data: athletes }
    } catch (error: any) {
        console.error("Error in searchAthletesAction:", error)
        return { success: false, error: error.message || "Erro ao buscar atletas" }
    }
}

export async function createCreditTransactionAction(data: {
    id_atleta: string;
    valor: number;
    validade: string;
    descricao?: string;
}) {
    try {
        const { userId: clerkId } = await auth()
        if (!clerkId) return { success: false, error: "Não autorizado" }

        const dbUser = await UserService.getUserByClerkId(clerkId)
        if (!dbUser) return { success: false, error: "Usuário não encontrado" }

        const arena = await ArenaService.getFirstArenaByOrganizationUser(dbUser.id)
        if (!arena) return { success: false, error: "Arena não encontrada" }

        let data_vencimento: string | null = null;
        const now = new Date();

        if (data.validade === "3_meses") {
            const d = new Date(now);
            d.setMonth(d.getMonth() + 3);
            data_vencimento = d.toISOString();
        } else if (data.validade === "6_meses") {
            const d = new Date(now);
            d.setMonth(d.getMonth() + 6);
            data_vencimento = d.toISOString();
        } else if (data.validade === "1_ano") {
            const d = new Date(now);
            d.setFullYear(d.getFullYear() + 1);
            data_vencimento = d.toISOString();
        } else if (data.validade === "2_anos") {
            const d = new Date(now);
            d.setFullYear(d.getFullYear() + 2);
            data_vencimento = d.toISOString();
        }

        await LoyaltyService.createTransaction({
            id_arena: arena.id,
            id_atleta: data.id_atleta,
            valor: data.valor,
            tipo: 'crédito',
            descricao: data.descricao,
            data_vencimento,
            created_by: dbUser.id
        })

        revalidatePath("/dashboard/loyalty")
        return { success: true }
    } catch (error: any) {
        console.error("Error in createCreditTransactionAction:", error)
        return { success: false, error: error.message || "Erro ao criar transação" }
    }
}

export async function createRedemptionTransactionAction(data: {
    id_atleta: string;
    valor: number;
    descricao?: string;
}) {
    try {
        const { userId: clerkId } = await auth()
        if (!clerkId) return { success: false, error: "Não autorizado" }

        const dbUser = await UserService.getUserByClerkId(clerkId)
        if (!dbUser) return { success: false, error: "Usuário não encontrado" }

        const arena = await ArenaService.getFirstArenaByOrganizationUser(dbUser.id)
        if (!arena) return { success: false, error: "Arena não encontrada" }

        await LoyaltyService.createTransaction({
            id_arena: arena.id,
            id_atleta: data.id_atleta,
            valor: data.valor,
            tipo: 'resgate',
            descricao: data.descricao,
            data_vencimento: null,
            created_by: dbUser.id
        })

        revalidatePath("/dashboard/loyalty")
        return { success: true }
    } catch (error: any) {
        console.error("Error in createRedemptionTransactionAction:", error)
        return { success: false, error: error.message || "Erro ao criar resgate" }
    }
}

export async function getTopAthletesAction() {
    try {
        const { userId: clerkId } = await auth()
        if (!clerkId) return { success: false, error: "Não autorizado" }

        const dbUser = await UserService.getUserByClerkId(clerkId)
        if (!dbUser) return { success: false, error: "Usuário não encontrado" }

        const arena = await ArenaService.getFirstArenaByOrganizationUser(dbUser.id)
        if (!arena) return { success: false, error: "Arena não encontrada" }

        const topAthletes = await LoyaltyService.getTopAthletes(arena.id)
        return { success: true, data: topAthletes }
    } catch (error: any) {
        console.error("Error in getTopAthletesAction:", error)
        return { success: false, error: error.message || "Erro ao buscar top atletas" }
    }
}
export async function getAthletesWithBalanceAction(page = 1, pageSize = 10, query?: string) {
    try {
        const { userId: clerkId } = await auth()
        if (!clerkId) return { success: false, error: "Não autorizado" }

        const dbUser = await UserService.getUserByClerkId(clerkId)
        if (!dbUser) return { success: false, error: "Usuário não encontrado" }

        const arena = await ArenaService.getFirstArenaByOrganizationUser(dbUser.id)
        if (!arena) return { success: false, error: "Arena não encontrada" }

        const result = await LoyaltyService.getAthletesWithBalance(arena.id, page, pageSize, query)
        return { success: true, ...result }
    } catch (error: any) {
        console.error("Error in getAthletesWithBalanceAction:", error)
        return { success: false, error: error.message || "Erro ao buscar atletas" }
    }
}
export async function getStatementAction(page = 1, pageSize = 10, filters?: { athleteName?: string, startDate?: string, endDate?: string }) {
    try {
        const { userId: clerkId } = await auth()
        if (!clerkId) return { success: false, error: "Não autorizado" }

        const dbUser = await UserService.getUserByClerkId(clerkId)
        if (!dbUser) return { success: false, error: "Usuário não encontrado" }

        const arena = await ArenaService.getFirstArenaByOrganizationUser(dbUser.id)
        if (!arena) return { success: false, error: "Arena não encontrada" }

        const result = await LoyaltyService.getStatement(arena.id, page, pageSize, filters)
        return { success: true, ...result }
    } catch (error: any) {
        console.error("Error in getStatementAction:", error)
        return { success: false, error: error.message || "Erro ao buscar extrato" }
    }
}
