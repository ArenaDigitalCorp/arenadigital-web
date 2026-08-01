"use server"

import { getSupabaseAdmin } from "@/lib/supabase-server"
import { assertArenaAdminAccess, assertArenaBackofficeAccess, requireAuthenticatedDbUser } from "@/lib/server-auth"
import { SupabaseLoyaltyRepository } from "@/modules/loyalty/repositories/SupabaseLoyaltyRepository"
import { revalidatePath } from "next/cache"
import * as z from "zod"

const validitySchema = z.enum([
    'indeterminate', '1_mes', '2_meses', '3_meses',
    '6_meses', '1_ano', '2_anos',
])

const creditTransactionSchema = z.object({
    operationId: z.string().uuid(),
    arenaId: z.string().uuid(),
    id_atleta: z.string().uuid(),
    valor: z.number().positive().max(99999999.99).multipleOf(0.01),
    validade: validitySchema,
    descricao: z.string().trim().max(1000).optional(),
}).strict()

const redemptionTransactionSchema = creditTransactionSchema.omit({ validade: true }).strict()

type LoyaltyRpcClient = {
    rpc: (
        name: 'record_backoffice_loyalty_transaction',
        args: Record<string, unknown>,
    ) => Promise<{ data: unknown; error: { message: string } | null }>
}

async function recordLoyaltyTransaction(args: {
    operationId: string
    arenaId: string
    athleteId: string
    kind: 'crédito' | 'resgate'
    value: number
    validityCode: z.infer<typeof validitySchema> | null
    description?: string
    createdBy: string
}) {
    const client = getSupabaseAdmin() as unknown as LoyaltyRpcClient
    const { data, error } = await client.rpc('record_backoffice_loyalty_transaction', {
        p_operation_id: args.operationId,
        p_arena_id: args.arenaId,
        p_athlete_id: args.athleteId,
        p_kind: args.kind,
        p_value: args.value,
        p_validity_code: args.validityCode,
        p_description: args.description ?? null,
        p_created_by: args.createdBy,
    })

    if (error) throw new Error(error.message)
    return data
}

export async function updateCurrencyName(arenaId: string, name: string) {
    try {
        await requireAuthenticatedDbUser()
        await assertArenaAdminAccess(arenaId)

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

export async function createCreditTransactionAction(input: unknown) {
    try {
        const parsed = creditTransactionSchema.parse(input)
        const { dbUserId } = await assertArenaAdminAccess(parsed.arenaId)

        await recordLoyaltyTransaction({
            operationId: parsed.operationId,
            arenaId: parsed.arenaId,
            athleteId: parsed.id_atleta,
            kind: 'crédito',
            value: parsed.valor,
            validityCode: parsed.validade,
            description: parsed.descricao,
            createdBy: dbUserId,
        })

        revalidatePath("/dashboard/loyalty")
        return { success: true }
    } catch (error: unknown) {
        console.error("Error in createCreditTransactionAction:", error)
        const message = error instanceof Error ? error.message : "Erro ao criar transação"
        return { success: false, error: message }
    }
}

export async function createRedemptionTransactionAction(input: unknown) {
    try {
        const parsed = redemptionTransactionSchema.parse(input)
        const { dbUserId } = await assertArenaAdminAccess(parsed.arenaId)

        await recordLoyaltyTransaction({
            operationId: parsed.operationId,
            arenaId: parsed.arenaId,
            athleteId: parsed.id_atleta,
            kind: 'resgate',
            value: parsed.valor,
            validityCode: null,
            description: parsed.descricao,
            createdBy: dbUserId,
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
