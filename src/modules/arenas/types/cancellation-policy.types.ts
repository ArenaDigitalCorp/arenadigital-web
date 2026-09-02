export type ArenaCancellationPolicyStatus = "draft" | "published"

export type ArenaCancellationPolicyTier = {
    minimumHoursBeforeStart: number
    refundPercentage: number
}

export type ArenaCancellationPolicy = {
    id: string
    arenaId: string
    version: number
    status: ArenaCancellationPolicyStatus
    createdAt: string
    publishedAt: string | null
    tiers: ArenaCancellationPolicyTier[]
}

export type ArenaCancellationPolicySettings = {
    currentPolicy: ArenaCancellationPolicy | null
    draftPolicy: ArenaCancellationPolicy | null
    publishedVersions: ArenaCancellationPolicy[]
}

export const EMPTY_ARENA_CANCELLATION_POLICY_SETTINGS: ArenaCancellationPolicySettings = {
    currentPolicy: null,
    draftPolicy: null,
    publishedVersions: [],
}
