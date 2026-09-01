"use server"

import { revalidatePath } from "next/cache"
import { assertArenaAdminAccess } from "@/lib/server-auth"
import { createSupabaseServerClient } from "@/lib/supabase/server"
import { getSupabaseAdmin } from "@/lib/supabase-server"
import { cancellationPolicyTiersSchema } from "@/modules/arenas/schemas/cancellation-policy.schema"
import type {
    ArenaCancellationPolicy,
    ArenaCancellationPolicySettings,
    ArenaCancellationPolicyTier,
} from "@/modules/arenas/types/cancellation-policy.types"
import { EMPTY_ARENA_CANCELLATION_POLICY_SETTINGS } from "@/modules/arenas/types/cancellation-policy.types"

type DbError = { message: string }

type PolicyRow = {
    id: string
    arena_id: string
    version: number
    status: "draft" | "published"
    created_at: string
    published_at: string | null
}

type TierRow = {
    policy_id: string
    minimum_hours_before_start: number
    refund_percentage: number
}

type CurrentPolicyRow = { policy_id: string }

type PolicyReadClient = {
    from: (table: "arena_cancellation_policies") => {
        select: (columns: string) => {
            eq: (column: "arena_id", value: string) => {
                order: (
                    column: "version",
                    options: { ascending: boolean },
                ) => Promise<{ data: PolicyRow[] | null; error: DbError | null }>
            }
        }
    }
}

type TierReadClient = {
    from: (table: "arena_cancellation_policy_tiers") => {
        select: (columns: string) => {
            in: (
                column: "policy_id",
                values: string[],
            ) => Promise<{ data: TierRow[] | null; error: DbError | null }>
        }
    }
}

type CurrentPolicyReadClient = {
    from: (table: "arena_current_cancellation_policies") => {
        select: (columns: string) => {
            eq: (column: "arena_id", value: string) => {
                maybeSingle: () => Promise<{ data: CurrentPolicyRow | null; error: DbError | null }>
            }
        }
    }
}

type CancellationPolicyRpcClient = {
    rpc: (
        name:
            | "create_arena_cancellation_policy_draft"
            | "replace_arena_cancellation_policy_tiers"
            | "publish_arena_cancellation_policy",
        args: Record<string, unknown>,
    ) => Promise<{ data: unknown; error: DbError | null }>
}

type CancellationPolicyActionResult = {
    success: boolean
    data: ArenaCancellationPolicySettings
    error?: string
}

function mapTier(row: TierRow): ArenaCancellationPolicyTier {
    return {
        minimumHoursBeforeStart: row.minimum_hours_before_start,
        refundPercentage: row.refund_percentage,
    }
}

async function loadArenaCancellationPolicySettings(
    arenaId: string,
): Promise<ArenaCancellationPolicySettings> {
    const admin = getSupabaseAdmin()
    const policyQuery = admin as unknown as PolicyReadClient
    const currentPolicyQuery = admin as unknown as CurrentPolicyReadClient

    const [policiesResponse, currentPolicyResponse] = await Promise.all([
        policyQuery
            .from("arena_cancellation_policies")
            .select("id, arena_id, version, status, created_at, published_at")
            .eq("arena_id", arenaId)
            .order("version", { ascending: false }),
        currentPolicyQuery
            .from("arena_current_cancellation_policies")
            .select("policy_id")
            .eq("arena_id", arenaId)
            .maybeSingle(),
    ])

    if (policiesResponse.error) throw new Error(policiesResponse.error.message)
    if (currentPolicyResponse.error) throw new Error(currentPolicyResponse.error.message)

    const policyRows = policiesResponse.data ?? []
    const policyIds = policyRows.map((policy) => policy.id)
    let tierRows: TierRow[] = []

    if (policyIds.length > 0) {
        const tierQuery = admin as unknown as TierReadClient
        const tiersResponse = await tierQuery
            .from("arena_cancellation_policy_tiers")
            .select("policy_id, minimum_hours_before_start, refund_percentage")
            .in("policy_id", policyIds)

        if (tiersResponse.error) throw new Error(tiersResponse.error.message)
        tierRows = tiersResponse.data ?? []
    }

    const policies: ArenaCancellationPolicy[] = policyRows.map((policy) => ({
        id: policy.id,
        arenaId: policy.arena_id,
        version: policy.version,
        status: policy.status,
        createdAt: policy.created_at,
        publishedAt: policy.published_at,
        tiers: tierRows
            .filter((tier) => tier.policy_id === policy.id)
            .map(mapTier)
            .sort((left, right) => left.minimumHoursBeforeStart - right.minimumHoursBeforeStart),
    }))

    const currentPolicyId = currentPolicyResponse.data?.policy_id ?? null
    return {
        currentPolicy: policies.find((policy) => policy.id === currentPolicyId) ?? null,
        draftPolicy: policies.find((policy) => policy.status === "draft") ?? null,
        publishedVersions: policies.filter((policy) => policy.status === "published"),
    }
}

async function cancellationPolicyRpc(): Promise<CancellationPolicyRpcClient> {
    return await createSupabaseServerClient() as unknown as CancellationPolicyRpcClient
}

function revalidateArenaSettings(arenaId: string) {
    revalidatePath(`/dashboard/arenas/${arenaId}/edit`)
}

async function loadFailureSettings(arenaId: string): Promise<ArenaCancellationPolicySettings> {
    try {
        return await loadArenaCancellationPolicySettings(arenaId)
    } catch {
        return EMPTY_ARENA_CANCELLATION_POLICY_SETTINGS
    }
}

export async function getArenaCancellationPolicySettingsAction(
    arenaId: string,
): Promise<CancellationPolicyActionResult> {
    try {
        await assertArenaAdminAccess(arenaId)
        return { success: true, data: await loadArenaCancellationPolicySettings(arenaId) }
    } catch (error) {
        return {
            success: false,
            data: EMPTY_ARENA_CANCELLATION_POLICY_SETTINGS,
            error: error instanceof Error ? error.message : "Não foi possível carregar a política de cancelamento.",
        }
    }
}

export async function createArenaCancellationPolicyDraftAction(
    arenaId: string,
): Promise<CancellationPolicyActionResult> {
    try {
        await assertArenaAdminAccess(arenaId)
        const existingSettings = await loadArenaCancellationPolicySettings(arenaId)
        if (existingSettings.draftPolicy) {
            return { success: true, data: existingSettings }
        }

        const { error } = await (await cancellationPolicyRpc()).rpc(
            "create_arena_cancellation_policy_draft",
            { p_arena_id: arenaId },
        )
        if (error) throw new Error(error.message)

        revalidateArenaSettings(arenaId)
        return { success: true, data: await loadArenaCancellationPolicySettings(arenaId) }
    } catch (error) {
        return {
            success: false,
            data: await loadFailureSettings(arenaId),
            error: error instanceof Error ? error.message : "Não foi possível criar o rascunho.",
        }
    }
}

export async function saveArenaCancellationPolicyDraftAction(
    arenaId: string,
    policyId: string,
    tiers: ArenaCancellationPolicyTier[],
): Promise<CancellationPolicyActionResult> {
    try {
        await assertArenaAdminAccess(arenaId)
        const settings = await loadArenaCancellationPolicySettings(arenaId)
        if (settings.draftPolicy?.id !== policyId) {
            throw new Error("O rascunho informado não pertence a esta Arena ou já foi publicado.")
        }

        const parsedTiers = cancellationPolicyTiersSchema.parse(tiers)
        const rpcTiers = parsedTiers.map((tier) => ({
            minimum_hours_before_start: tier.minimumHoursBeforeStart,
            refund_percentage: tier.refundPercentage,
        }))
        const { error } = await (await cancellationPolicyRpc()).rpc(
            "replace_arena_cancellation_policy_tiers",
            { p_policy_id: policyId, p_tiers: rpcTiers },
        )
        if (error) throw new Error(error.message)

        revalidateArenaSettings(arenaId)
        return { success: true, data: await loadArenaCancellationPolicySettings(arenaId) }
    } catch (error) {
        return {
            success: false,
            data: await loadFailureSettings(arenaId),
            error: error instanceof Error ? error.message : "Não foi possível salvar o rascunho.",
        }
    }
}

export async function publishArenaCancellationPolicyAction(
    arenaId: string,
    policyId: string,
): Promise<CancellationPolicyActionResult> {
    try {
        await assertArenaAdminAccess(arenaId)
        const settings = await loadArenaCancellationPolicySettings(arenaId)
        if (settings.draftPolicy?.id !== policyId) {
            throw new Error("O rascunho informado não pertence a esta Arena ou já foi publicado.")
        }
        if (settings.draftPolicy.tiers.length === 0) {
            throw new Error("Salve ao menos uma faixa antes de publicar a política.")
        }

        const { error } = await (await cancellationPolicyRpc()).rpc(
            "publish_arena_cancellation_policy",
            { p_policy_id: policyId },
        )
        if (error) throw new Error(error.message)

        revalidateArenaSettings(arenaId)
        return { success: true, data: await loadArenaCancellationPolicySettings(arenaId) }
    } catch (error) {
        return {
            success: false,
            data: await loadFailureSettings(arenaId),
            error: error instanceof Error ? error.message : "Não foi possível publicar a política.",
        }
    }
}
