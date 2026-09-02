"use server"

import { createCipheriv, createDecipheriv, createHash, randomBytes, randomUUID } from 'node:crypto'
import { revalidatePath } from 'next/cache'
import { getLocationPointFromAddress } from '@/lib/geocoding'
import {
    AuthorizationError,
    assertArenaAdminAccess,
    assertArenaBackofficeAccess,
    assertArenaCreationAccess,
    assertArenaOwnerAccess,
    assertPlatformSuperAdminAccess,
} from '@/lib/server-auth'
import { getSupabaseAdmin } from '@/lib/supabase-server'
import type { Json } from '@/types/supabase.types'
import { SupabaseArenaRepository } from '@/modules/arenas/repositories/SupabaseArenaRepository'
import {
    createArenaAsaasSubaccountSchema,
    normalizeAsaasSubaccountInput,
    updateArenaPixSplitSettingsSchema,
} from '@/modules/arenas/schemas/asaas-baas.schema'
import {
    AsaasRequestError,
    assertArenaAsaasRuntimeCredentials,
    createAsaasSubaccount,
    ensureArenaAsaasPixKey,
    findAsaasSubaccountsByDocument,
    getArenaAsaasOnboardingSnapshot,
    recoverAsaasSubaccountCredential,
} from '@/modules/arenas/services/asaas-baas.service'
import { arenaSchema } from '@/modules/arenas/schemas/arena.schema'
import {
    appBookingModeAcceptsPreBookings,
    normalizeAppBookingMode,
} from '@/modules/arenas/domain/app-booking-mode'
import type { AppBookingMode } from '@/modules/arenas/domain/app-booking-mode'
import type { AsaasSubaccountCreation } from '@/modules/arenas/services/asaas-baas.service'
import type { CreateArenaDTO, UpdateArenaDTO } from '@/modules/arenas/types/arena.types'
import type {
    ArenaAsaasOnboardingStatus,
    ArenaPixSplitSettings,
    ArenaPixSplitStatus,
    CreateArenaAsaasSubaccountInput,
    UpdateArenaPixSplitSettingsInput,
} from '@/modules/arenas/types/pix-split.types'

// Resolve a coordenada (WKT POINT) da arena no servidor a partir do endereço.
// Tenta geocodificar o endereço completo via Nominatim e, se falhar, usa o
// centroide do município (lat/lng já disponíveis na tabela `municipios`).
// Geocodificar no servidor evita o erro "Failed to fetch" do navegador, já que
// o Nominatim bloqueia chamadas client-side.
async function resolveArenaLocation(
    input: Partial<CreateArenaDTO>
): Promise<string | null> {
    const street = typeof input.address === 'string' ? input.address : null
    const idMunicipio = input.id_municipio
    if (!idMunicipio) return null

    const supabase = getSupabaseAdmin()
    const { data: municipio } = await supabase
        .from('municipios')
        .select('nome, codigo_uf, latitude, longitude')
        .eq('codigo_ibge', idMunicipio)
        .maybeSingle()
    if (!municipio) return null

    const { data: estado } = await supabase
        .from('estados')
        .select('uf')
        .eq('codigo_uf', municipio.codigo_uf)
        .maybeSingle()

    if (street && estado?.uf) {
        const point = await getLocationPointFromAddress({
            street,
            number: typeof input.number === 'string' ? input.number : '',
            neighborhood: typeof input.neighborhood === 'string' ? input.neighborhood : '',
            city: municipio.nome,
            state: estado.uf,
        })
        if (point) return point
    }

    if (municipio.latitude != null && municipio.longitude != null) {
        return `POINT(${municipio.longitude} ${municipio.latitude})`
    }
    return null
}

export async function deleteArenaAction(arenaId: string): Promise<{ success: boolean; error?: string }> {
    try {
        await assertArenaOwnerAccess(arenaId)
        const supabase = getSupabaseAdmin()
        const { error } = await supabase.from('arenas').delete().eq('id', arenaId)
        if (error) throw new Error(error.message)
        revalidatePath('/dashboard/settings/arenas')
        return { success: true }
    } catch (err) {
        const message = err instanceof Error ? err.message : 'Erro ao excluir arena'
        console.error('[deleteArenaAction]', message)
        return { success: false, error: message }
    }
}

export async function getArenaByIdAction(arenaId: string) {
    try {
        await assertArenaBackofficeAccess(arenaId)
        const arena = await new SupabaseArenaRepository(getSupabaseAdmin()).findById(arenaId)
        return { success: true, data: arena }
    } catch (err) {
        const message = err instanceof Error ? err.message : 'Erro ao buscar arena'
        return { success: false, error: message, data: null }
    }
}

export async function createArenaAction(input: CreateArenaDTO) {
    try {
        const { dbUserId } = await assertArenaCreationAccess()
        const parsed = arenaSchema.parse(input)
        const location = (await resolveArenaLocation(parsed as unknown as Partial<CreateArenaDTO>)) ?? undefined
        const appBookingMode = normalizeAppBookingMode(
            parsed.app_booking_mode,
            parsed.accepts_app_booking_requests,
        )
        const payload = {
            ...parsed,
            ...(location ? { location } : {}),
            app_booking_mode: appBookingMode,
            accepts_app_booking_requests: appBookingModeAcceptsPreBookings(appBookingMode),
            owner_id: dbUserId,
        } as unknown as CreateArenaDTO
        const arena = await new SupabaseArenaRepository(getSupabaseAdmin()).create(payload)
        revalidatePath('/dashboard/settings/arenas')
        return { success: true, data: arena }
    } catch (err) {
        const message = err instanceof Error ? err.message : 'Erro ao criar arena'
        return { success: false, error: message, data: null }
    }
}

export async function getComodidadesAction() {
    try {
        const { data, error } = await getSupabaseAdmin().from('comodidades').select('*').order('name')
        if (error) throw new Error(error.message)
        return { success: true, data: data ?? [] }
    } catch (err) {
        const message = err instanceof Error ? err.message : 'Erro ao buscar comodidades'
        return { success: false, error: message, data: [] }
    }
}

export async function getEstadosAction() {
    try {
        const { data, error } = await getSupabaseAdmin().from('estados').select('*').order('nome')
        if (error) throw new Error(error.message)
        return { success: true, data: data ?? [] }
    } catch (err) {
        const message = err instanceof Error ? err.message : 'Erro ao buscar estados'
        return { success: false, error: message, data: [] }
    }
}

export async function getMunicipiosByEstadoAction(codigoUf: number) {
    try {
        const { data, error } = await getSupabaseAdmin()
            .from('municipios').select('*').eq('codigo_uf', codigoUf).order('nome')
        if (error) throw new Error(error.message)
        return { success: true, data: data ?? [] }
    } catch (err) {
        const message = err instanceof Error ? err.message : 'Erro ao buscar municípios'
        return { success: false, error: message, data: [] }
    }
}

export async function getMunicipioByIbgeAction(codigoIbge: number) {
    try {
        const { data, error } = await getSupabaseAdmin()
            .from('municipios').select('*').eq('codigo_ibge', codigoIbge).single()
        if (error) throw new Error(error.message)
        return { success: true, data }
    } catch (err) {
        const message = err instanceof Error ? err.message : 'Erro ao buscar município'
        return { success: false, error: message, data: null }
    }
}

export async function updateArenaAction(arenaId: string, input: UpdateArenaDTO) {
    try {
        await assertArenaAdminAccess(arenaId)
        const safeInput = arenaSchema.partial().parse(input)
        const location = (await resolveArenaLocation(safeInput as unknown as Partial<CreateArenaDTO>)) ?? undefined
        const hasAppBookingModeUpdate = safeInput.app_booking_mode !== undefined
            || safeInput.accepts_app_booking_requests !== undefined
        const appBookingMode = hasAppBookingModeUpdate
            ? normalizeAppBookingMode(
                safeInput.app_booking_mode,
                safeInput.accepts_app_booking_requests,
            )
            : undefined
        const payload = {
            ...safeInput,
            ...(location ? { location } : {}),
            ...(appBookingMode ? {
                app_booking_mode: appBookingMode,
                accepts_app_booking_requests: appBookingModeAcceptsPreBookings(appBookingMode),
            } : {}),
        } as unknown as UpdateArenaDTO
        const arena = await new SupabaseArenaRepository(getSupabaseAdmin()).update(arenaId, payload)
        revalidatePath(`/dashboard/arenas/${arenaId}/edit`)
        revalidatePath('/dashboard/settings/arenas')
        return { success: true, data: arena }
    } catch (err) {
        const message = err instanceof Error ? err.message : 'Erro ao atualizar arena'
        return { success: false, error: message, data: null }
    }
}

export async function updateArenaAppBookingModeAction(
    arenaId: string,
    appBookingMode: AppBookingMode,
) {
    return updateArenaAction(arenaId, { app_booking_mode: appBookingMode })
}

function defaultPixSplitSettings(): ArenaPixSplitSettings {
    return {
        enabled: false,
        hasPaymentAccount: false,
        onboardingStarted: false,
        webhookConfigured: false,
        credentialRecoveryRequired: false,
        paymentFlow: 'arena_subaccount_split',
        asaasWalletId: '',
        asaasAccountId: '',
        holderName: '',
        holderDocument: '',
        pixKey: '',
        status: 'disabled',
        onboardingStatus: 'NOT_STARTED',
        commercialInfoStatus: 'NOT_STARTED',
        bankAccountInfoStatus: 'NOT_STARTED',
        documentationStatus: 'NOT_STARTED',
        onboardingUrl: null,
        lastStatusCheckedAt: null,
        activatedAt: null,
        platformFeeBasisPoints: 200,
        updatedAt: null,
    }
}

type SupabaseErrorLike = { message: string }

type ArenaPaymentAccountRow = {
    asaas_wallet_id: string | null
    asaas_account_id: string | null
    holder_name: string | null
    holder_document: string | null
    pix_key: string | null
    platform_fee_basis_points: number | null
    status: string | null
    payment_flow: string | null
    onboarding_status: string | null
    commercial_info_status: string | null
    bank_account_info_status: string | null
    documentation_status: string | null
    onboarding_url: string | null
    last_status_checked_at: string | null
    activated_at: string | null
    webhook_token_hash: string | null
    credential_recovery_pending: boolean | null
    metadata: Json | null
    updated_at: string | null
}

type ArenaPaymentAccountPayload = Partial<ArenaPaymentAccountRow> & { arena_id: string; provider: 'asaas' }

type ArenaPaymentAccountSelect = {
    eq(column: string, value: string): ArenaPaymentAccountSelect
    maybeSingle(): Promise<{ data: ArenaPaymentAccountRow | null; error: SupabaseErrorLike | null }>
}

type ArenaPaymentAccountMutation = {
    eq(column: string, value: string): ArenaPaymentAccountMutation
    select(columns: string): {
        single(): Promise<{ data: ArenaPaymentAccountRow; error: SupabaseErrorLike | null }>
    }
}

type ArenaPaymentAccountsQuery = {
    select(columns: string): ArenaPaymentAccountSelect
    update(payload: Partial<ArenaPaymentAccountRow>): ArenaPaymentAccountMutation
    upsert(payload: ArenaPaymentAccountPayload, options: { onConflict: string }): ArenaPaymentAccountMutation
}

type StoreSubaccountCredentialRpc = {
    rpc(name: 'store_arena_asaas_subaccount_credentials', args: {
        p_arena_id: string
        p_asaas_account_id: string
        p_asaas_wallet_id: string
        p_api_key: string
    }): Promise<{ error: SupabaseErrorLike | null }>
}

type ClaimSubaccountProvisioningRpc = {
    rpc(
        name: 'claim_arena_asaas_subaccount_provisioning',
        args: { p_arena_id: string; p_request_id: string },
    ): Promise<{ data: boolean | null; error: { message: string } | null }>
}

type ApplyManualAsaasStatusSnapshotRpc = {
    rpc(
        name: 'apply_arena_asaas_manual_status_snapshot',
        args: {
            p_arena_id: string
            p_asaas_account_id: string
            p_commercial_info_status: ArenaAsaasOnboardingStatus
            p_bank_account_info_status: ArenaAsaasOnboardingStatus
            p_documentation_status: ArenaAsaasOnboardingStatus
            p_general_status: ArenaAsaasOnboardingStatus
            p_snapshot_observed_at: string
            p_onboarding_url: string | null
            p_pix_key: string | null
            p_commercial_info_expiration_status: null
            p_commercial_info_expiration_scheduled_date: null
        },
    ): Promise<{ data: unknown; error: SupabaseErrorLike | null }>
}

type SubaccountRecoveryRpc = {
    rpc(
        name: 'store_arena_asaas_credential_recovery',
        args: {
            p_arena_id: string
            p_account_id: string
            p_wallet_id: string
            p_encrypted_payload: string
            p_expires_at: string
        },
    ): Promise<{ error: SupabaseErrorLike | null }>
    rpc(
        name: 'get_arena_asaas_credential_recovery',
        args: { p_arena_id: string },
    ): Promise<{ data: unknown; error: SupabaseErrorLike | null }>
    rpc(
        name: 'delete_arena_asaas_credential_recovery',
        args: { p_arena_id: string },
    ): Promise<{ error: SupabaseErrorLike | null }>
    rpc(
        name: 'release_arena_asaas_subaccount_provisioning',
        args: { p_arena_id: string; p_request_id: string; p_reason: string },
    ): Promise<{ data: boolean | null; error: SupabaseErrorLike | null }>
}

const PAYMENT_ACCOUNT_COLUMNS = [
    'asaas_wallet_id',
    'asaas_account_id',
    'holder_name',
    'holder_document',
    'pix_key',
    'platform_fee_basis_points',
    'status',
    'payment_flow',
    'onboarding_status',
    'commercial_info_status',
    'bank_account_info_status',
    'documentation_status',
    'onboarding_url',
    'last_status_checked_at',
    'activated_at',
    'webhook_token_hash',
    'credential_recovery_pending',
    'metadata',
    'updated_at',
].join(', ')

function revalidatePixSplitPaths(arenaId: string): void {
    revalidatePath(`/dashboard/arenas/${arenaId}/edit`)
    revalidatePath('/dashboard/admin/platform')
    revalidatePath('/dashboard/admin/super-admin')
    revalidatePath('/admin/settings')
    revalidatePath('/dashboard/settings/arenas')
}

async function loadArenaPaymentAccount(arenaId: string): Promise<ArenaPaymentAccountRow | null> {
    const { data, error } = await arenaPaymentAccountsTable()
        .select(PAYMENT_ACCOUNT_COLUMNS)
        .eq('arena_id', arenaId)
        .eq('provider', 'asaas')
        .maybeSingle()
    if (error) throw new Error(error.message)
    return data
}

async function saveArenaPaymentAccount(
    payload: ArenaPaymentAccountPayload,
): Promise<ArenaPaymentAccountRow> {
    const { data, error } = await arenaPaymentAccountsTable()
        .upsert(payload, { onConflict: 'arena_id,provider' })
        .select(PAYMENT_ACCOUNT_COLUMNS)
        .single()
    if (error) throw new Error(error.message)
    return data
}

async function updateArenaPaymentAccount(
    arenaId: string,
    payload: Partial<ArenaPaymentAccountRow>,
): Promise<ArenaPaymentAccountRow> {
    const { data, error } = await arenaPaymentAccountsTable()
        .update(payload)
        .eq('arena_id', arenaId)
        .eq('provider', 'asaas')
        .select(PAYMENT_ACCOUNT_COLUMNS)
        .single()
    if (error) throw new Error(error.message)
    return data
}

async function recordPaymentAudit(input: {
    arenaId: string
    actorId: string
    action: string
    newValue: Record<string, unknown>
    metadata?: Record<string, unknown>
    source?: 'arena_self_service' | 'super_admin_backoffice'
}): Promise<void> {
    const { error } = await getSupabaseAdmin().from('audit_logs').insert({
        entity_type: 'arena_payment_account',
        entity_id: input.arenaId,
        action: input.action,
        actor_id: input.actorId,
        actor_type: 'user',
        new_value: input.newValue as Json,
        metadata: {
            provider: 'asaas',
            source: input.source ?? 'super_admin_backoffice',
            ...input.metadata,
        },
    })
    if (error) console.error(`[${input.action}] Failed to record audit event`, error.message)
}

type ArenaFinancialOnboardingAccess = {
    dbUserId: string
    source: 'arena_self_service' | 'super_admin_backoffice'
}

async function assertArenaFinancialOnboardingAccess(
    arenaId: string,
): Promise<ArenaFinancialOnboardingAccess> {
    let arenaAccessError: unknown
    try {
        const profile = await assertArenaAdminAccess(arenaId)
        return { dbUserId: profile.dbUserId, source: 'arena_self_service' }
    } catch (error) {
        if (!(error instanceof AuthorizationError) || error.status !== 403) throw error
        arenaAccessError = error
    }

    try {
        const profile = await assertPlatformSuperAdminAccess()
        return { dbUserId: profile.dbUserId, source: 'super_admin_backoffice' }
    } catch {
        throw arenaAccessError
    }
}

function safeOnboardingUrl(value: string | null): string | null {
    if (!value) return null
    try {
        const url = new URL(value)
        return url.protocol === 'https:' ? url.toString() : null
    } catch {
        return null
    }
}

function normalizeOnboardingStatus(status: string | null): ArenaAsaasOnboardingStatus {
    const normalized = status?.toUpperCase()
    if (
        normalized === 'PENDING' ||
        normalized === 'AWAITING_APPROVAL' ||
        normalized === 'APPROVED' ||
        normalized === 'REJECTED'
    ) {
        return normalized
    }
    return 'NOT_STARTED'
}

type AsaasCredentialRecoveryPayload = {
    arenaId: string
    accountId: string
    walletId: string
    apiKey: string
    issuedAt: string
}

function credentialRecoveryKey(): Buffer {
    const secret = process.env.ASAAS_CREDENTIAL_RECOVERY_KEY?.trim()
    if (!secret || secret.length < 32) {
        throw new Error('A chave de recuperação das credenciais Asaas não está configurada com segurança.')
    }
    return createHash('sha256').update(secret).digest()
}

function encryptCredentialRecovery(payload: AsaasCredentialRecoveryPayload): string {
    const iv = randomBytes(12)
    const cipher = createCipheriv('aes-256-gcm', credentialRecoveryKey(), iv)
    const encrypted = Buffer.concat([cipher.update(JSON.stringify(payload), 'utf8'), cipher.final()])
    return [iv, cipher.getAuthTag(), encrypted].map((value) => value.toString('base64url')).join('.')
}

function decryptCredentialRecovery(token: string): AsaasCredentialRecoveryPayload {
    const [ivValue, tagValue, encryptedValue, extra] = token.split('.')
    if (!ivValue || !tagValue || !encryptedValue || extra) throw new Error('Código de recuperação inválido.')
    const decipher = createDecipheriv('aes-256-gcm', credentialRecoveryKey(), Buffer.from(ivValue, 'base64url'))
    decipher.setAuthTag(Buffer.from(tagValue, 'base64url'))
    const plaintext = Buffer.concat([
        decipher.update(Buffer.from(encryptedValue, 'base64url')),
        decipher.final(),
    ]).toString('utf8')
    const payload = JSON.parse(plaintext) as Partial<AsaasCredentialRecoveryPayload>
    if (!payload.arenaId || !payload.accountId || !payload.walletId || !payload.apiKey || !payload.issuedAt) {
        throw new Error('Código de recuperação incompleto.')
    }
    return payload as AsaasCredentialRecoveryPayload
}

function recoveryRpc(): SubaccountRecoveryRpc {
    return getSupabaseAdmin() as unknown as SubaccountRecoveryRpc
}

async function storeCredentialRecoveryEnvelope(
    payload: AsaasCredentialRecoveryPayload,
): Promise<void> {
    const encryptedPayload = encryptCredentialRecovery(payload)
    const { error } = await recoveryRpc().rpc('store_arena_asaas_credential_recovery', {
        p_arena_id: payload.arenaId,
        p_account_id: payload.accountId,
        p_wallet_id: payload.walletId,
        p_encrypted_payload: encryptedPayload,
        p_expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    })
    if (error) throw new Error(`Não foi possível proteger a credencial para recuperação: ${error.message}`)
}

async function loadCredentialRecoveryEnvelope(arenaId: string): Promise<string | null> {
    const { data, error } = await recoveryRpc().rpc('get_arena_asaas_credential_recovery', {
        p_arena_id: arenaId,
    })
    if (error) throw new Error(error.message)
    if (!data || typeof data !== 'object' || Array.isArray(data)) return null
    const token = (data as Record<string, unknown>).encryptedPayload
    return typeof token === 'string' && token.length > 0 ? token : null
}

async function deleteCredentialRecoveryEnvelope(arenaId: string): Promise<void> {
    const { error } = await recoveryRpc().rpc('delete_arena_asaas_credential_recovery', {
        p_arena_id: arenaId,
    })
    if (error) throw new Error(error.message)
}

function provisioningRequestId(metadata: Json | null): string | null {
    if (!metadata || Array.isArray(metadata) || typeof metadata !== 'object') return null
    const value = metadata.asaasProvisioningRequestId
    return typeof value === 'string' && value.length > 0 ? value : null
}

async function releaseProvisioningOrThrow(
    arenaId: string,
    requestId: string,
    reason: string,
): Promise<void> {
    const { data, error } = await recoveryRpc().rpc('release_arena_asaas_subaccount_provisioning', {
        p_arena_id: arenaId,
        p_request_id: requestId,
        p_reason: reason,
    })
    if (error || data !== true) {
        throw new Error(`Não foi possível liberar o provisionamento com segurança: ${error?.message ?? 'claim divergente'}`)
    }
}

async function storeSubaccountCredentials(
    arenaId: string,
    accountId: string,
    walletId: string,
    apiKey: string,
): Promise<void> {
    const credentialRpc = getSupabaseAdmin() as unknown as StoreSubaccountCredentialRpc
    const { error } = await credentialRpc.rpc('store_arena_asaas_subaccount_credentials', {
        p_arena_id: arenaId,
        p_asaas_account_id: accountId,
        p_asaas_wallet_id: walletId,
        p_api_key: apiKey,
    })
    if (error) throw new Error(error.message)
}

type PixSplitActionResult = {
    success: boolean
    data: ArenaPixSplitSettings
    error?: string
    warning?: string
}

async function syncArenaAsaasSubaccount(
    arenaId: string,
    actorId: string,
    source: ArenaFinancialOnboardingAccess['source'],
): Promise<ArenaPixSplitSettings> {
    const existing = await loadArenaPaymentAccount(arenaId)
    if (
        !existing?.asaas_account_id ||
        normalizeOnboardingStatus(existing.onboarding_status) === 'NOT_STARTED'
    ) {
        throw new Error('Esta arena ainda não possui onboarding Asaas BaaS para sincronizar.')
    }

    if (!existing.last_status_checked_at && existing.updated_at) {
        const firstSyncAvailableAt = Date.parse(existing.updated_at) + 15_000
        if (Number.isFinite(firstSyncAvailableAt) && firstSyncAvailableAt > Date.now()) {
            const remainingSeconds = Math.max(1, Math.ceil((firstSyncAvailableAt - Date.now()) / 1_000))
            throw new Error(`Aguarde ${remainingSeconds} segundos antes da primeira sincronização do Asaas.`)
        }
    }

    const snapshot = await getArenaAsaasOnboardingSnapshot(arenaId)
    const snapshotObservedAt = new Date().toISOString()
    const approved =
        snapshot.status.general === 'APPROVED' &&
        Boolean(existing.webhook_token_hash) &&
        Boolean(existing.asaas_account_id) &&
        Boolean(existing.asaas_wallet_id)
    if (approved) await assertArenaAsaasRuntimeCredentials(arenaId)
    const pixKey = approved ? await ensureArenaAsaasPixKey(arenaId) : existing.pix_key
    const onboardingUrl = snapshot.documents
        .find((document) => document.status !== 'APPROVED' && safeOnboardingUrl(document.onboardingUrl))
        ?.onboardingUrl ?? snapshot.documents.find((document) => safeOnboardingUrl(document.onboardingUrl))?.onboardingUrl ?? null
    const snapshotRpc = getSupabaseAdmin() as unknown as ApplyManualAsaasStatusSnapshotRpc
    const { error: snapshotError } = await snapshotRpc.rpc('apply_arena_asaas_manual_status_snapshot', {
        p_arena_id: arenaId,
        p_asaas_account_id: existing.asaas_account_id,
        p_commercial_info_status: snapshot.status.commercialInfo,
        p_bank_account_info_status: snapshot.status.bankAccountInfo,
        p_documentation_status: snapshot.status.documentation,
        p_general_status: snapshot.status.general,
        p_snapshot_observed_at: snapshotObservedAt,
        p_onboarding_url: safeOnboardingUrl(onboardingUrl),
        p_pix_key: pixKey,
        p_commercial_info_expiration_status: null,
        p_commercial_info_expiration_scheduled_date: null,
    })
    if (snapshotError) throw new Error(snapshotError.message)

    const updated = await loadArenaPaymentAccount(arenaId)
    if (!updated) throw new Error('A conta Asaas não foi encontrada depois da sincronização transacional.')
    const firstApproval =
        existing.activated_at === null &&
        updated.activated_at !== null &&
        updated.status === 'active'

    await recordPaymentAudit({
        arenaId,
        actorId,
        action: firstApproval ? 'asaas_subaccount_approved' : 'asaas_subaccount_status_synced',
        newValue: {
            onboarding_status: snapshot.status.general,
            commercial_info_status: snapshot.status.commercialInfo,
            bank_account_info_status: snapshot.status.bankAccountInfo,
            documentation_status: snapshot.status.documentation,
            pix_key_configured: Boolean(updated.pix_key),
            payment_flow: updated.payment_flow,
            status: updated.status,
        },
        metadata: { webhook_configured: Boolean(updated.webhook_token_hash) },
        source,
    })
    return mapPixSplitSettings(updated)
}

function arenaPaymentAccountsTable(): ArenaPaymentAccountsQuery {
    return (
        getSupabaseAdmin() as unknown as {
            from(table: 'arena_payment_accounts'): ArenaPaymentAccountsQuery
        }
    ).from('arena_payment_accounts')
}

function normalizePixSplitStatus(status: string | null): ArenaPixSplitStatus {
    if (status === 'pending' || status === 'active' || status === 'disabled' || status === 'rejected') {
        return status
    }
    return 'disabled'
}

function mapPixSplitSettings(row: ArenaPaymentAccountRow | null): ArenaPixSplitSettings {
    if (!row) return defaultPixSplitSettings()
    const status = normalizePixSplitStatus(row.status)
    const onboardingStatus = normalizeOnboardingStatus(row.onboarding_status)
    const onboardingStarted = onboardingStatus !== 'NOT_STARTED'
    const paymentFlow = 'arena_subaccount_split' as const
    const webhookConfigured = Boolean(row.webhook_token_hash)
    return {
        enabled:
            row.status === 'active' &&
            Boolean(row.asaas_wallet_id) &&
            onboardingStatus === 'APPROVED' && webhookConfigured,
        hasPaymentAccount: true,
        onboardingStarted,
        webhookConfigured,
        credentialRecoveryRequired:
            row.credential_recovery_pending === true ||
            (onboardingStarted && !row.asaas_account_id),
        paymentFlow,
        asaasWalletId: row.asaas_wallet_id ?? '',
        asaasAccountId: row.asaas_account_id ?? '',
        holderName: row.holder_name ?? '',
        holderDocument: row.holder_document ?? '',
        pixKey: row.pix_key ?? '',
        status,
        onboardingStatus,
        commercialInfoStatus: normalizeOnboardingStatus(row.commercial_info_status),
        bankAccountInfoStatus: normalizeOnboardingStatus(row.bank_account_info_status),
        documentationStatus: normalizeOnboardingStatus(row.documentation_status),
        onboardingUrl: safeOnboardingUrl(row.onboarding_url),
        lastStatusCheckedAt: row.last_status_checked_at ?? null,
        activatedAt: row.activated_at ?? null,
        platformFeeBasisPoints: Number(row.platform_fee_basis_points ?? 200),
        updatedAt: row.updated_at ?? null,
    }
}

function settingsForFinancialOnboardingAccess(
    settings: ArenaPixSplitSettings,
    source: ArenaFinancialOnboardingAccess['source'],
): ArenaPixSplitSettings {
    if (source === 'super_admin_backoffice') return settings

    return {
        ...settings,
        asaasWalletId: '',
        asaasAccountId: '',
        pixKey: '',
        platformFeeBasisPoints: 0,
    }
}

export async function getArenaPixSplitSettingsAction(
    arenaId: string
): Promise<{ success: boolean; data: ArenaPixSplitSettings; error?: string }> {
    try {
        const access = await assertArenaFinancialOnboardingAccess(arenaId)
        const data = await loadArenaPaymentAccount(arenaId)
        return {
            success: true,
            data: settingsForFinancialOnboardingAccess(mapPixSplitSettings(data), access.source),
        }
    } catch (err) {
        const message = err instanceof Error ? err.message : 'Erro ao carregar configuração Pix da arena'
        return { success: false, data: defaultPixSplitSettings(), error: message }
    }
}

export async function updateArenaPixSplitSettingsAction(
    arenaId: string,
    input: UpdateArenaPixSplitSettingsInput
): Promise<PixSplitActionResult> {
    try {
        const profile = await assertPlatformSuperAdminAccess()
        const parsed = updateArenaPixSplitSettingsSchema.parse(input)
        const platformFeeBasisPoints = parsed.platformFeeBasisPoints
        const existing = await loadArenaPaymentAccount(arenaId)
        if (!existing) throw new Error('Crie a subconta Asaas antes de configurar o split.')

        const approvedForNewFlow =
            normalizeOnboardingStatus(existing.onboarding_status) === 'APPROVED' &&
            Boolean(existing.webhook_token_hash) &&
            Boolean(existing.asaas_account_id) &&
            Boolean(existing.asaas_wallet_id)
        if (parsed.enabled && !approvedForNewFlow) {
            throw new Error('O split só pode ser ativado depois da aprovação geral e da confirmação do webhook exclusivo.')
        }
        if (parsed.enabled && approvedForNewFlow) {
            await assertArenaAsaasRuntimeCredentials(arenaId)
        }

        const pixKey = parsed.enabled ? await ensureArenaAsaasPixKey(arenaId) : existing.pix_key

        const now = new Date().toISOString()
        const payload: ArenaPaymentAccountPayload = {
            arena_id: arenaId,
            provider: 'asaas',
            payment_flow: 'arena_subaccount_split',
            pix_key: pixKey,
            platform_fee_basis_points: platformFeeBasisPoints,
            status: parsed.enabled ? 'active' : 'disabled',
            activated_at: parsed.enabled && !existing.activated_at ? now : existing.activated_at,
            updated_at: now,
        }

        const data = await saveArenaPaymentAccount(payload)
        await recordPaymentAudit({
            arenaId,
            actorId: profile.dbUserId,
            action: 'platform_split_updated',
            newValue: {
                enabled: parsed.enabled,
                platform_fee_basis_points: platformFeeBasisPoints,
            },
            metadata: { payment_flow: 'arena_subaccount_split' },
        })
        revalidatePixSplitPaths(arenaId)
        return { success: true, data: mapPixSplitSettings(data) }
    } catch (err) {
        const message = err instanceof Error ? err.message : 'Erro ao salvar configuração Pix da arena'
        return { success: false, data: defaultPixSplitSettings(), error: message }
    }
}

export async function createArenaAsaasSubaccountAction(
    arenaId: string,
    input: CreateArenaAsaasSubaccountInput,
): Promise<PixSplitActionResult> {
    try {
        const profile = await assertArenaFinancialOnboardingAccess(arenaId)
        const parsedArenaId = typeof arenaId === 'string' ? arenaId.trim() : ''
        if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu.test(parsedArenaId)) {
            throw new Error('Arena inválida para o onboarding Asaas.')
        }
        const parsed = normalizeAsaasSubaccountInput(createArenaAsaasSubaccountSchema.parse(input))
        credentialRecoveryKey()
        const existing = await loadArenaPaymentAccount(parsedArenaId)
        if (
            existing && (
                normalizeOnboardingStatus(existing.onboarding_status) !== 'NOT_STARTED' ||
                Boolean(existing.asaas_account_id)
            )
        ) {
            throw new Error('Já existe uma subconta Asaas registrada para esta arena. Sincronize ou recupere o cadastro existente; não crie outra.')
        }

        const provisioningRpc = getSupabaseAdmin() as unknown as ClaimSubaccountProvisioningRpc
        const provisioningRequestId = randomUUID()
        const { data: provisioningClaimed, error: provisioningError } = await provisioningRpc.rpc(
            'claim_arena_asaas_subaccount_provisioning',
            { p_arena_id: parsedArenaId, p_request_id: provisioningRequestId },
        )
        if (provisioningError || provisioningClaimed !== true) {
            throw new Error('O provisionamento desta arena já foi iniciado. Sincronize ou recupere o cadastro existente.')
        }

        const webhookToken = randomBytes(32).toString('base64url')
        const webhookTokenHash = createHash('sha256').update(webhookToken).digest('hex')
        const provisioningStartedAt = new Date().toISOString()
        await saveArenaPaymentAccount({
            arena_id: parsedArenaId,
            provider: 'asaas',
            holder_name: parsed.name,
            holder_document: parsed.cpfCnpj,
            webhook_token_hash: webhookTokenHash,
            onboarding_status: 'PENDING',
            commercial_info_status: 'PENDING',
            bank_account_info_status: 'PENDING',
            documentation_status: 'PENDING',
            onboarding_url: null,
            last_status_checked_at: null,
            activated_at: null,
            status: 'pending',
            updated_at: provisioningStartedAt,
        })
        let subaccount: AsaasSubaccountCreation
        try {
            subaccount = await createAsaasSubaccount(parsed, webhookToken)
        } catch (error) {
            if (error instanceof AsaasRequestError && error.status === 401) {
                await releaseProvisioningOrThrow(
                    parsedArenaId,
                    provisioningRequestId,
                    'asaas_parent_key_unauthorized',
                )
            } else if (error instanceof AsaasRequestError && [400, 422].includes(error.status)) {
                const matches = await findAsaasSubaccountsByDocument(parsed.cpfCnpj)
                if (matches.length === 0) {
                    await releaseProvisioningOrThrow(
                        parsedArenaId,
                        provisioningRequestId,
                        'asaas_validation_rejected_without_account',
                    )
                } else if (matches.length === 1) {
                    await updateArenaPaymentAccount(parsedArenaId, {
                        asaas_account_id: matches[0].id,
                        asaas_wallet_id: matches[0].walletId,
                        credential_recovery_pending: true,
                        updated_at: new Date().toISOString(),
                    })
                }
            }
            throw error
        }

        const recoveryPayload: AsaasCredentialRecoveryPayload = {
            arenaId: parsedArenaId,
            accountId: subaccount.id,
            walletId: subaccount.walletId,
            apiKey: subaccount.apiKey,
            issuedAt: new Date().toISOString(),
        }
        await storeCredentialRecoveryEnvelope(recoveryPayload)
        const recoveryBaseline = await updateArenaPaymentAccount(parsedArenaId, {
            asaas_account_id: subaccount.id,
            asaas_wallet_id: subaccount.walletId,
            credential_recovery_pending: true,
            updated_at: new Date().toISOString(),
        })

        try {
            await storeSubaccountCredentials(parsedArenaId, subaccount.id, subaccount.walletId, subaccount.apiKey)
            await deleteCredentialRecoveryEnvelope(parsedArenaId)
        } catch (error) {
            await recordPaymentAudit({
                arenaId: parsedArenaId,
                actorId: profile.dbUserId,
                action: 'asaas_subaccount_credential_recovery_required',
                newValue: { asaas_account_id: subaccount.id, status: 'pending' },
                metadata: { reason: error instanceof Error ? error.message : 'vault_write_failed' },
                source: profile.source,
            })
            revalidatePixSplitPaths(parsedArenaId)
            return {
                success: false,
                data: settingsForFinancialOnboardingAccess(
                    mapPixSplitSettings(recoveryBaseline),
                    profile.source,
                ),
                error: 'A subconta foi criada, mas o cofre não confirmou a credencial. Use a recuperação segura antes de sincronizar.',
            }
        }

        const now = new Date().toISOString()
        const baseline = await saveArenaPaymentAccount({
            arena_id: parsedArenaId,
            provider: 'asaas',
            holder_name: parsed.name,
            holder_document: parsed.cpfCnpj,
            webhook_token_hash: webhookTokenHash,
            onboarding_status: 'PENDING',
            commercial_info_status: 'PENDING',
            bank_account_info_status: 'PENDING',
            documentation_status: 'PENDING',
            onboarding_url: null,
            last_status_checked_at: null,
            activated_at: null,
            status: 'pending',
            updated_at: now,
        })

        await recordPaymentAudit({
            arenaId: parsedArenaId,
            actorId: profile.dbUserId,
            action: 'asaas_subaccount_created',
            newValue: {
                asaas_account_id: subaccount.id,
                onboarding_status: 'PENDING',
                status: 'pending',
            },
            metadata: { webhook_configured: true },
            source: profile.source,
        })

        revalidatePixSplitPaths(parsedArenaId)
        return {
            success: true,
            data: settingsForFinancialOnboardingAccess(mapPixSplitSettings(baseline), profile.source),
            warning: 'Subconta criada. Aguarde ao menos 15 segundos antes de sincronizar o status e os documentos.',
        }
    } catch (err) {
        const message = err instanceof Error ? err.message : 'Erro ao criar subconta Asaas para a arena'
        return { success: false, data: defaultPixSplitSettings(), error: message }
    }
}

export async function recoverArenaAsaasSubaccountCredentialAction(
    arenaId: string,
): Promise<PixSplitActionResult> {
    try {
        const profile = await assertPlatformSuperAdminAccess()
        const account = await loadArenaPaymentAccount(arenaId)
        if (!account || !account.holder_document) {
            throw new Error('Não existe cadastro Asaas pendente de recuperação para esta arena.')
        }

        const token = await loadCredentialRecoveryEnvelope(arenaId)
        let credential: AsaasSubaccountCreation
        if (token) {
            const payload = decryptCredentialRecovery(token)
            if (
                payload.arenaId !== arenaId ||
                payload.accountId !== account.asaas_account_id ||
                payload.walletId !== account.asaas_wallet_id
            ) {
                throw new Error('A credencial pendente não pertence à conta Asaas registrada para esta arena.')
            }
            credential = { id: payload.accountId, walletId: payload.walletId, apiKey: payload.apiKey }
        } else {
            let accountId = account.asaas_account_id
            if (!accountId) {
                const matches = await findAsaasSubaccountsByDocument(account.holder_document)
                if (matches.length === 0) {
                    const requestId = provisioningRequestId(account.metadata)
                    if (!requestId) throw new Error('A subconta não foi localizada e o claim de provisionamento está incompleto.')
                    await releaseProvisioningOrThrow(arenaId, requestId, 'asaas_recovery_found_no_account')
                    throw new Error('Nenhuma subconta foi localizada. O provisionamento foi liberado para uma nova tentativa segura.')
                }
                if (matches.length > 1) {
                    throw new Error('Mais de uma subconta foi localizada para o CNPJ; a recuperação exige conferência manual.')
                }
                accountId = matches[0].id
                await updateArenaPaymentAccount(arenaId, {
                    asaas_account_id: matches[0].id,
                    asaas_wallet_id: matches[0].walletId,
                    credential_recovery_pending: true,
                    updated_at: new Date().toISOString(),
                })
            }
            credential = await recoverAsaasSubaccountCredential({
                accountId,
                cpfCnpj: account.holder_document,
            })
            await storeCredentialRecoveryEnvelope({
                arenaId,
                accountId: credential.id,
                walletId: credential.walletId,
                apiKey: credential.apiKey,
                issuedAt: new Date().toISOString(),
            })
        }

        await storeSubaccountCredentials(arenaId, credential.id, credential.walletId, credential.apiKey)
        await deleteCredentialRecoveryEnvelope(arenaId)
        const recovered = await loadArenaPaymentAccount(arenaId)
        await recordPaymentAudit({
            arenaId,
            actorId: profile.dbUserId,
            action: 'asaas_subaccount_credential_recovered',
            newValue: { asaas_account_id: credential.id, status: recovered?.status ?? 'pending' },
        })
        revalidatePixSplitPaths(arenaId)
        return { success: true, data: mapPixSplitSettings(recovered) }
    } catch (err) {
        const message = err instanceof Error ? err.message : 'Erro ao recuperar a credencial da subconta Asaas'
        const data = await loadArenaPaymentAccount(arenaId).catch(() => null)
        return { success: false, data: mapPixSplitSettings(data), error: message }
    }
}

export async function syncArenaAsaasSubaccountStatusAction(
    arenaId: string,
): Promise<PixSplitActionResult> {
    try {
        const profile = await assertArenaFinancialOnboardingAccess(arenaId)
        const data = await syncArenaAsaasSubaccount(arenaId, profile.dbUserId, profile.source)
        revalidatePixSplitPaths(arenaId)
        return {
            success: true,
            data: settingsForFinancialOnboardingAccess(data, profile.source),
        }
    } catch (err) {
        const message = err instanceof Error ? err.message : 'Erro ao sincronizar o onboarding Asaas'
        return { success: false, data: defaultPixSplitSettings(), error: message }
    }
}
