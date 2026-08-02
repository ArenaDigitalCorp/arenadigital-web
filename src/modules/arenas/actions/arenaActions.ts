"use server"

import { revalidatePath } from 'next/cache'
import { getLocationPointFromAddress } from '@/lib/geocoding'
import {
    assertArenaAdminAccess,
    assertArenaBackofficeAccess,
    assertArenaCreationAccess,
    assertArenaOwnerAccess,
    assertPlatformAdminAccess,
} from '@/lib/server-auth'
import { getSupabaseAdmin } from '@/lib/supabase-server'
import { SupabaseArenaRepository } from '@/modules/arenas/repositories/SupabaseArenaRepository'
import type { CreateArenaDTO, UpdateArenaDTO } from '@/modules/arenas/types/arena.types'
import type {
    ArenaPixSplitSettings,
    ArenaPixSplitStatus,
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
        const location = input.location ?? (await resolveArenaLocation(input)) ?? undefined
        const arena = await new SupabaseArenaRepository(getSupabaseAdmin()).create({
            ...input,
            ...(location ? { location: location as CreateArenaDTO['location'] } : {}),
            owner_id: dbUserId,
        })
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
        const safeInput = { ...input }
        delete safeInput.owner_id
        const location = safeInput.location ?? (await resolveArenaLocation(safeInput)) ?? undefined
        const arena = await new SupabaseArenaRepository(getSupabaseAdmin()).update(arenaId, {
            ...safeInput,
            ...(location ? { location: location as UpdateArenaDTO['location'] } : {}),
        })
        revalidatePath(`/dashboard/arenas/${arenaId}/edit`)
        revalidatePath('/dashboard/settings/arenas')
        return { success: true, data: arena }
    } catch (err) {
        const message = err instanceof Error ? err.message : 'Erro ao atualizar arena'
        return { success: false, error: message, data: null }
    }
}

function cleanNullableText(value: string | null | undefined): string | null {
    const trimmed = typeof value === 'string' ? value.trim() : ''
    return trimmed.length > 0 ? trimmed : null
}

function onlyDigitsLocal(value: string | null | undefined): string | null {
    const digits = typeof value === 'string' ? value.replace(/\D/g, '') : ''
    return digits.length > 0 ? digits : null
}

function defaultPixSplitSettings(): ArenaPixSplitSettings {
    return {
        enabled: false,
        asaasWalletId: '',
        asaasAccountId: '',
        holderName: '',
        holderDocument: '',
        pixKey: '',
        status: 'disabled',
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
    updated_at: string | null
}

type ArenaPaymentAccountPayload = {
    arena_id: string
    provider: 'asaas'
    asaas_wallet_id: string | null
    asaas_account_id: string | null
    holder_name: string | null
    holder_document: string | null
    pix_key: string | null
    platform_fee_basis_points: number
    status: 'active' | 'disabled'
    updated_at: string
}

type ArenaPaymentAccountsQuery = {
    select(columns: string): ArenaPaymentAccountsQuery
    eq(column: string, value: string): ArenaPaymentAccountsQuery
    maybeSingle(): Promise<{ data: ArenaPaymentAccountRow | null; error: SupabaseErrorLike | null }>
    single(): Promise<{ data: ArenaPaymentAccountRow; error: SupabaseErrorLike | null }>
    upsert(payload: ArenaPaymentAccountPayload, options: { onConflict: string }): ArenaPaymentAccountsQuery
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
    return {
        enabled: row.status === 'active' && Boolean(row.asaas_wallet_id),
        asaasWalletId: row.asaas_wallet_id ?? '',
        asaasAccountId: row.asaas_account_id ?? '',
        holderName: row.holder_name ?? '',
        holderDocument: row.holder_document ?? '',
        pixKey: row.pix_key ?? '',
        status,
        platformFeeBasisPoints: Number(row.platform_fee_basis_points ?? 200),
        updatedAt: row.updated_at ?? null,
    }
}

export async function getArenaPixSplitSettingsAction(
    arenaId: string
): Promise<{ success: boolean; data: ArenaPixSplitSettings; error?: string }> {
    try {
        await assertPlatformAdminAccess()
        const { data, error } = await arenaPaymentAccountsTable()
            .select(
                'asaas_wallet_id, asaas_account_id, holder_name, holder_document, pix_key, platform_fee_basis_points, status, updated_at'
            )
            .eq('arena_id', arenaId)
            .eq('provider', 'asaas')
            .maybeSingle()

        if (error) throw new Error(error.message)
        return { success: true, data: mapPixSplitSettings(data) }
    } catch (err) {
        const message = err instanceof Error ? err.message : 'Erro ao carregar configuração Pix da arena'
        return { success: false, data: defaultPixSplitSettings(), error: message }
    }
}

export async function updateArenaPixSplitSettingsAction(
    arenaId: string,
    input: UpdateArenaPixSplitSettingsInput
): Promise<{ success: boolean; data: ArenaPixSplitSettings; error?: string }> {
    try {
        await assertPlatformAdminAccess()

        const enabled = Boolean(input.enabled)
        const asaasWalletId = cleanNullableText(input.asaasWalletId)
        if (enabled && !asaasWalletId) {
            throw new Error('Informe o Wallet ID do Asaas para ativar o Pix com split nas reservas do app.')
        }

        const payload: ArenaPaymentAccountPayload = {
            arena_id: arenaId,
            provider: 'asaas',
            asaas_wallet_id: enabled ? asaasWalletId : null,
            asaas_account_id: cleanNullableText(input.asaasAccountId),
            holder_name: cleanNullableText(input.holderName),
            holder_document: onlyDigitsLocal(input.holderDocument),
            pix_key: cleanNullableText(input.pixKey),
            platform_fee_basis_points: 200,
            status: enabled ? 'active' : 'disabled',
            updated_at: new Date().toISOString(),
        }

        const { data, error } = await arenaPaymentAccountsTable()
            .upsert(payload, { onConflict: 'arena_id,provider' })
            .select(
                'asaas_wallet_id, asaas_account_id, holder_name, holder_document, pix_key, platform_fee_basis_points, status, updated_at'
            )
            .single()

        if (error) throw new Error(error.message)

        revalidatePath(`/dashboard/arenas/${arenaId}/edit`)
        revalidatePath('/dashboard/admin/platform')
        revalidatePath('/dashboard/settings/arenas')
        return { success: true, data: mapPixSplitSettings(data) }
    } catch (err) {
        const message = err instanceof Error ? err.message : 'Erro ao salvar configuração Pix da arena'
        return { success: false, data: defaultPixSplitSettings(), error: message }
    }
}
